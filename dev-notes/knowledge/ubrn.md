# ubrn 构建踩坑

`uniffi-bindgen-react-native`（简称 ubrn）把 Rust crate 封装成 React Native Turbo Module。它驱动 `pnpm ubrn:ios` / `pnpm ubrn:android`，执行流程：

```
cargo build --target <apple|android target>
  → 生成静态库 / xcframework
  → 生成 C++ JSI 胶水（cpp/generated/）
  → 生成 TS 绑定（src/generated/）
```

`ubrn.config.yaml` 只是把这些 artifact 放到 `packages/swarmnote-core/{cpp,src}/generated/` 下。

---

## 坑 1：iOS 链接 `___chkstk_darwin` 未定义

**症状**：`pnpm ubrn:ios` 走 `cargo build --target aarch64-apple-ios` 时报

```
ld: warning: object file ... was built for newer 'iOS' version (26.4) than being linked (10.0)
Undefined symbols for architecture arm64:
  "___chkstk_darwin", referenced from:
      _blake3_hash4_neon in libblake3-*.rlib
ld: symbol(s) not found for architecture arm64
error: could not compile `mobile-core` (lib)
```

**原因**：
- `rustc` 的 `aarch64-apple-ios` target 默认把链接器 deployment target 设成 iOS 10（`-target arm64-apple-ios10.0.0`）。
- 但 `cc` crate 用当前 Xcode SDK（iOS 26.x）编译依赖里的 C 代码（`blake3`、`ring`、`libsqlite3-sys` 等）。
- iOS 13 才引入的 `___chkstk_darwin` 就被 C obj 引用了，而 Rust 侧选 iOS 10 作链接目标 → 找不到符号。

**修复**：`packages/swarmnote-core/rust/mobile-core/.cargo/config.toml`

```toml
[env]
IPHONEOS_DEPLOYMENT_TARGET = "17.0"
```

- `IPHONEOS_DEPLOYMENT_TARGET` 同时影响 `cc` crate 和 `rustc`——两边统一到同一 min version 就不再错配。
- `17.0` 与 app 的 `ios.deploymentTarget`（由 `expo-build-properties` 在 `app.json` 里配）对齐，见坑 5。
- 作用域故意放在 crate 级 `.cargo/config.toml`，不污染全局 cargo。

**不要**：
- 不要改成 `10.0` 或更低版本把 C 警告压下去——新 SDK 里 iOS 10 已经不可用。
- 不要只设 `IPHONEOS_DEPLOYMENT_TARGET` 当临时 shell env，重新进终端会丢；写进 crate 级 config 更稳。
- 不要把 `15.1` 这个旧值写回来——2025-04 起 Apple 强制 App Store 提交 target iOS 17+ SDK，且 Xcode 26 的 `SwiftUICore.tbd` allowable-clients 也把 15/16 挡在外面（见坑 5）。

---

## 坑 2：async primary constructor 生成非法 TS `async static`

**症状**：`pnpm prepare`（`bob build`）失败

```
SyntaxError: src/generated/mobile_core.ts: Unexpected token, expected "(" (4492:13)
  4492 | async static create(keychain: ..., ...) /*throws*/ {
                       ^
```

**原因**：ubrn `0.31.0-2`（目前 npm / GitHub release 上最新版）的 TS 模板 bug。
- 触发点：Rust 端给 uniffi object 声明了 async primary constructor（`UniffiAppCore::new` 用 `async fn` 构造）。
- 模板逻辑：
  - `crates/ubrn_bindgen/src/bindings/gen_typescript/templates/ObjectTemplate.ts:54` 对 async 构造器调用 `method_decl("static", ...)`。
  - `crates/ubrn_bindgen/src/bindings/gen_typescript/templates/macros.ts:89` 展开成 `{% call async_kw %}{{ func_decl }} name(` → `async ` + `static` + ` create(` → **`async static create(`**（TS 不允许这种修饰符顺序）。
- 上游没有更新版本修掉它，PR #29 只引入了 async constructor 这个特性。

**修复**：`packages/swarmnote-core/scripts/fix-ubrn-output.mjs` 扫 `src/generated/*.ts`，把 `async static` 改成 `static async`。

`package.json` 里：

```jsonc
"ubrn:ios":     "ubrn build ios     --and-generate && pnpm ubrn:fix",
"ubrn:android": "ubrn build android --and-generate && pnpm ubrn:fix",
"ubrn:fix":     "node scripts/fix-ubrn-output.mjs"
```

- 脚本是幂等的：二次执行时无匹配就不写盘。
- 替换范围仅限 `src/generated/` 下 `.ts`——避免误改手写代码。

**什么时候可以删掉这个 workaround**：ubrn 发布修复版本后（关注 `jhugman/uniffi-bindgen-react-native` 的 release 里 `macros.ts` / `ObjectTemplate.ts` 的改动）。届时 `package.json` 里把 `pnpm ubrn:fix` 去掉、删除 `scripts/fix-ubrn-output.mjs` 即可。

---

## 坑 3：Windows `\\?\` 长路径前缀打穿 lld（仅 Windows）

**症状**：`pnpm ubrn:android` 在 Windows 上 link 阶段大量报错

```
error: linking with `C:/Users/.../cargo-ndk` failed: exit code: 1
ld.lld: error: cannot find version script \\?\D:\workspace\...\rustc6MrA9A\list
ld.lld: error: cannot open \\?\D:\workspace\...\deps\mobile_core.<hash>.rcgu.o: No such file or directory
(几十条类似错误)
```

**原因**：ubrn `0.31.0-2` 在 `crates/ubrn_common/src/rust_crate.rs` 里用 `manifest_path.canonicalize_utf8()`。Windows 的 `std::fs::canonicalize` **总是**返回 `\\?\`（extended-length path）前缀，即使路径没到 MAX_PATH。这个前缀被 cargo 传给 rustc，rustc 把所有临时 `.o` / `.list` 路径也带上前缀喂给 `ld.lld`，**而 `ld.lld` 不认识 `\\?\` 前缀**，全部报 "cannot open"。

传染链：`ubrn canonicalize → cargo --manifest-path \\?\... → rustc deps 路径 → lld 参数 → lld 失败`。

**不能靠 `subst X: D:\...` 绕过**——cargo 内部还会 `canonicalize` 回真实盘符，`\\?\` 前缀照样加。

**修复**：apply ubrn PR [#367](https://github.com/jhugman/uniffi-bindgen-react-native/pull/367) 的改动，用 `dunce::canonicalize`（自动剥 `\\?\` 前缀）替代 `std::fs::canonicalize`。通过 `pnpm patch` 持久化：

```bash
# 1. 生成 patch 源目录（路径以输出为准）
pnpm patch uniffi-bindgen-react-native

# 2. 在 patch 源目录里改 3 个文件：
#    crates/ubrn_common/Cargo.toml      — [dependencies] 加 `dunce = "1.0.5"`
#    crates/ubrn_common/src/files.rs    — pwd() 和 canonicalize_utf8_or_shim 用 dunce
#    crates/ubrn_common/src/rust_crate.rs — import Utf8PathExt + 两处 canonicalize_utf8() → canonicalize_utf8_or_shim()

# 3. commit patch，写进 package.json 的 pnpm.patchedDependencies
pnpm patch-commit <patch 源目录>
```

commit 后 `patches/uniffi-bindgen-react-native@0.31.0-2.patch` 进 git，`pnpm install` 自动 apply。

**什么时候可以删掉这个 patch**：ubrn 把 PR #367 合进正式 release 后（关注 `jhugman/uniffi-bindgen-react-native` 的 release notes 里 `dunce` / `canonicalize_utf8_or_shim` 相关条目）。

**不要**：

- 不要试图靠 `subst`、短路径、`CARGO_TARGET_DIR` 绕过——Windows `canonicalize` 对短路径也加 `\\?\`，这 bug 必须改 ubrn 源码。
- 不要等上游修好再用 ubrn——patch 本地维护成本很低（PR #367 只改 3 个文件）。

---

## 坑 4：cargo 拉私有 submodule 鉴权失败

**症状**（历史上踩过，不是这次）：`cargo build` 里 `mobile-core → entity (git dep on swarmnote.git) → submodule packages/editor` 拉取时

```
failed to authenticate when downloading repository
attempted to find username/password via git's `credential.helper` support, but failed
```

**原因**：cargo 内置 libgit2 不走 git CLI，拿不到 macOS keychain / SSH agent 的凭据。

**修复**：全局 `~/.cargo/config.toml`（只要一份，覆盖所有 cargo 项目）

```toml
[net]
git-fetch-with-cli = true
```

让 cargo 调用系统 `git` CLI 拉远程，这样 `credential.helper = osxkeychain` 和 SSH key 才生效。

---

## 坑 5：Xcode 26 链接报 `SwiftUICore.tbd` "not an allowed client"

**症状**：`expo run:ios` / `xcodebuild` 链接 app target 时

```
Could not parse or use implicit file '.../SwiftUICore.framework/SwiftUICore.tbd':
cannot link directly with 'SwiftUICore' because product being built is not an allowed client of it
ld: Undefined symbols for architecture arm64
```

**原因**：Xcode 16+（包括 Xcode 26）的 linker 对 Apple 私有子 framework `SwiftUICore.tbd` 有 `allowable-clients` 白名单，只对 iOS 17+ target 开放。SDK 里 CocoaPods 插入的 implicit autolink 会把它拖进来，deployment target < 17 就被拒。跟 `ubrn` 本身无关，但因为我们会跑 `pnpm ubrn:ios` 产出 xcframework，链接阶段才会暴露。

**修复**（Expo 官方路径）：

1. 装 `expo-build-properties`：`npx expo install expo-build-properties`
2. `app.json` plugins 里加：

   ```json
   ["expo-build-properties", {
     "ios": { "deploymentTarget": "17.0" }
   }]
   ```

3. `.cargo/config.toml` 的 `IPHONEOS_DEPLOYMENT_TARGET` 同步到 `17.0`（见坑 1）
4. `npx expo prebuild --platform ios --clean`（让它按新 target 重写 `ios/swarmnotemobile.xcodeproj/project.pbxproj` + `ios/Podfile.properties.json`）
5. `pnpm --filter react-native-swarmnote-core ubrn:ios` 重编 xcframework，验证 `LC_BUILD_VERSION minos = 17.0`：
   ```bash
   otool -l target/aarch64-apple-ios-sim/debug/libmobile_core.a | grep -A3 LC_BUILD_VERSION | head
   ```

**为什么不用 `-weak_framework SwiftUICore` 这种 Podfile hack**：社区有零星做法用 `post_install` 往 `OTHER_LDFLAGS` 塞 `-weak_framework SwiftUICore` 压住错误，但 Expo/RN 都没官方背书；运行到 < iOS 17 设备上如果真调 SwiftUICore 会 silent crash。且 Apple 2025-04 起已强制 App Store 提交 target iOS 17+ SDK，这不是临时绕过、是大方向。

**相关 issue**：
- [expo/expo#44229](https://github.com/expo/expo/issues/44229) — SDK 55 + Xcode 26.4 build failures
- [expo/expo#41991](https://github.com/expo/expo/issues/41991) — SDK 54 + Xcode 26
- [expo/expo#36276](https://github.com/expo/expo/issues/36276) — 最早一批 allowable-clients 讨论

**Safety net**（目前没踩到，记在这里备用）：如果后续发现某些 Pod target 没被 `expo-build-properties` 覆盖（历史 [expo/expo#28476](https://github.com/expo/expo/issues/28476)），通过 Expo config plugin 往 Podfile 注入 `post_install` 兜底（直接改 `ios/Podfile` 会被 `expo prebuild` 覆盖，别直接改）：

```ruby
installer.pods_project.targets.each do |target|
  target.build_configurations.each do |config|
    if config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 17.0
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
    end
  end
end
```

---

## 坑 6：`libmobile_core.a` 缺 Apple framework 符号（`_SC*` 系列）

**症状**：Rust 静态库链进 app 时报

```
Undefined symbols for architecture arm64:
  "_SCPreferencesCreate", referenced from: ...
  "_kSCNetworkInterfaceTypeIEEE80211", referenced from: ...
ld: symbol(s) not found for architecture arm64
```

**原因**：Rust 依赖链 `libp2p-tcp → if-watch → system-configuration` 的 build.rs 会 emit `cargo:rustc-link-lib=framework=SystemConfiguration`，但 **cargo 在 `crate-type = ["staticlib"]` 下故意丢弃所有 transitive build metadata**（[rust-lang/cargo#4814](https://github.com/rust-lang/cargo/issues/4814)，2017 年就存在的设计限制，上游不会修）。于是 `libmobile_core.a` 里只有对 `_SC*` 符号的引用，没有 `-framework SystemConfiguration` 指令。app 链接时自然找不到。

**修复**：在 `packages/swarmnote-core/SwarmnoteCore.podspec` 显式声明：

```ruby
s.frameworks = "SystemConfiguration"
```

这是业界通用做法——**Signal（libsignal）、Mozilla application-services 都是手写 framework 列表**，没有自动传播方案。ubrn `ubrn.config.yaml` 也没有 `ios.frameworks` 字段可用。

**如何发现新依赖需要哪些 framework**：每次加 Rust crate 后跑一次

```bash
cd packages/swarmnote-core/rust/mobile-core
cargo build --target aarch64-apple-ios --message-format=json 2>/dev/null \
  | grep -oE 'rustc-link-lib=framework=[A-Za-z]+' | sort -u
```

把输出里每个 `framework=X` 对照 podspec 的 `s.frameworks`，缺的补上，并在 podspec 里用注释标明由哪条 crate 链触发，方便未来 review。

**常见嫌疑**：`libp2p` / `rustls` / `tokio` / `ring` 这个组合可能用到 `SystemConfiguration` / `Security` / `Network` / `CoreFoundation`。按实际链接报错增加，不用预防性全加。

---

## 坑 7：RN 0.83 Turbo Module codegen duplicate symbols

**症状**：xcodebuild 链接 app 时报

```
duplicate symbol '_OBJC_CLASS_$_NativeSwarmnoteCoreSpecBase' in:
    .../SwarmnoteCore/libSwarmnoteCore.a[6](SwarmnoteCoreSpec-generated.o)
    .../ReactCodegen/libReactCodegen.a[45](SwarmnoteCoreSpec-generated.o)
ld: 5 duplicate symbols
```

**原因**：RN 0.70+ 新架构有两种模式（详见 [reactwg/react-native-new-architecture discussions#158](https://github.com/reactwg/react-native-new-architecture/discussions/158)）：

| 模式 | `codegenConfig.includesGeneratedCode` | `codegenConfig.outputDir` | podspec `source_files` 是否含 `ios/generated/**` |
| --- | --- | --- | --- |
| **A — app 侧生成**（库用这个） | 不设 | 不设 | **否** |
| **B — 库预生成代码随包发** | `true` | 设 | 是 |

这是互斥的：
- 不设 `includesGeneratedCode: true` 时，aggregated `ReactCodegen` pod target 会统一编所有 TurboModule spec 进 `libReactCodegen.a`。
- 如果此时库的 podspec 也 glob 了 `ios/generated/**`，且 `codegenConfig.outputDir.ios` 配成 `"ios/generated"`，RN codegen CLI 还会额外写一份到库本地目录 → 两边都编 → duplicate symbol。

ubrn `0.31.0-2` 和早期 `create-react-native-library` 0.61 的模板默认产出 **Mode A 用途但 Mode B 写法** 的 podspec + package.json，就是这个错配。[callstack/react-native-builder-bob#755](https://github.com/callstack/react-native-builder-bob/issues/755) 追的就是这个 bug。

**修复**（Mode A — 本仓选）：

1. 删 `package.json` 的 `codegenConfig.outputDir`
2. 删 `package.json` 的 `react-native-builder-bob.targets` 中的 `"codegen"` 条目
3. podspec 的 `source_files` 去掉 `"ios/generated/**/*.{h,m,mm}"`（保留 `cpp/generated/**`——那是 ubrn 的 JSI wrapper，不是 RN codegen）
4. 删 `packages/swarmnote-core/ios/generated/` 残留目录
5. `.gitignore` 确保 `ios/generated/` 被忽略（本仓已有）
6. `pod install` + rebuild

**为什么 targets 里也不能留 `"codegen"`**：`react-native-builder-bob@0.41` 的 codegen target 在 `codegenConfig.type === 'modules'` 时，会无条件调用 `patchCodegenAndroidPackage()`，而该函数开头硬断言 `packageJson.codegenConfig?.outputDir?.android` 必须有值，否则抛：

```text
Error: Your package.json doesn't contain codegenConfig.outputDir.android.
Please see https://reactnative.dev/docs/the-new-architecture/using-codegen#configuring-codegen
```

这就跟坑 7 的 Mode A 要求（不设 `outputDir`）互斥——只能通过**不跑 bob codegen** 绕开，即从 `targets` 删掉 `"codegen"`。Mode A 下 library 不需要预生成 codegen，app 侧 `pod install` / gradle `:generateCodegenArtifactsFromSchema` 会根据 library 的 `codegenConfig` 统一生成到 `ReactCodegen` pod / `app/build/generated/source/codegen/`。

这条坑会**跨平台一致复现**（bob 源码里没有 platform 分支）。如果 macOS 上"看起来没事"，只是因为日常链路（`ubrn:ios` → `expo prebuild` → `expo run:ios`）没触发 `prepare`/`bob build`；一旦在任一平台 `pnpm install` 重新触发 `prepare`，或直接跑 `pnpm bob build`，两边都会炸。

**不要试 Mode B**：`includesGeneratedCode: true` 在跨 RN 版本时脆弱——[facebook/react-native#55544](https://github.com/facebook/react-native/issues/55544) 说 RN 0.84 的 codegen 改了 `ResultT` 类型别名，< 0.84 预生成的代码在 ≥ 0.84 上编不过。

**ubrn 下次 `ubrn:checkout` 可能把 `ios/generated/**` glob 写回 podspec**——如果它真覆盖（`ubrn.config.yaml` 的 `noOverwrite` 默认保护已提交文件），checkout 后 review podspec 确认这一条没被加回。`create-react-native-library` 模板同样可能把 `"codegen"` 写回 `react-native-builder-bob.targets`，一并 review。

---

## 生成代码铁律

`cpp/generated/` 和 `src/generated/` 完全由 ubrn 管，**唯一允许的手改**就是上面坑 2 的 `async static` patch，而且那一步由 `scripts/fix-ubrn-output.mjs` 自动完成，不要手工 edit。

- Rust 端改接口 → `pnpm ubrn:ios` / `ubrn:android` 重新生成 → `pnpm prepare`（`bob build`）打 lib。
- 不要把未经 `ubrn:fix` 的 `src/generated/*.ts` 提交：bob/babel 会炸。
- `pnpm prepare` 本身不调用 ubrn，只做 tsc + babel（**不跑 RN codegen**，原因见坑 7）。生成代码的新鲜度由 ubrn 脚本保证。

**相关文件**：
- `packages/swarmnote-core/ubrn.config.yaml`
- `packages/swarmnote-core/package.json`（`ubrn:*` 脚本 + `codegenConfig`——不要加 `outputDir`、`react-native-builder-bob.targets` 不要含 `"codegen"`，见坑 7）
- `packages/swarmnote-core/rust/mobile-core/.cargo/config.toml`（`IPHONEOS_DEPLOYMENT_TARGET`，见坑 1、5）
- `packages/swarmnote-core/scripts/fix-ubrn-output.mjs`
- `packages/swarmnote-core/SwarmnoteCore.podspec`（`s.frameworks` 见坑 6、`source_files` 不要含 `ios/generated/**` 见坑 7）
- `app.json`（`expo-build-properties` 的 `ios.deploymentTarget`，见坑 5）
