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
IPHONEOS_DEPLOYMENT_TARGET = "15.1"
```

- `IPHONEOS_DEPLOYMENT_TARGET` 同时影响 `cc` crate 和 `rustc`——两边统一到同一 min version 就不再错配。
- `15.1` 对齐 React Native 0.83 的 `min_ios_version_supported`（`SwarmnoteCore.podspec` 里用的就是这个变量）。
- 作用域故意放在 crate 级 `.cargo/config.toml`，不污染全局 cargo。

**不要**：
- 不要改成 `10.0` 或更低版本把 C 警告压下去——新 SDK 里 iOS 10 已经不可用。
- 不要只设 `IPHONEOS_DEPLOYMENT_TARGET` 当临时 shell env，重新进终端会丢；写进 crate 级 config 更稳。

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

## 坑 3：cargo 拉私有 submodule 鉴权失败

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

## 生成代码铁律

`cpp/generated/` 和 `src/generated/` 完全由 ubrn 管，**唯一允许的手改**就是上面坑 2 的 `async static` patch，而且那一步由 `scripts/fix-ubrn-output.mjs` 自动完成，不要手工 edit。

- Rust 端改接口 → `pnpm ubrn:ios` / `ubrn:android` 重新生成 → `pnpm prepare`（`bob build`）打 lib。
- 不要把未经 `ubrn:fix` 的 `src/generated/*.ts` 提交：bob/babel 会炸。
- `pnpm prepare` 本身不调用 ubrn，只做 tsc + babel + codegen。生成代码的新鲜度由 ubrn 脚本保证。

**相关文件**：
- `packages/swarmnote-core/ubrn.config.yaml`
- `packages/swarmnote-core/package.json`（`ubrn:*` 脚本）
- `packages/swarmnote-core/rust/mobile-core/.cargo/config.toml`
- `packages/swarmnote-core/scripts/fix-ubrn-output.mjs`
- `packages/swarmnote-core/SwarmnoteCore.podspec`（`min_ios_version_supported` 来源）
