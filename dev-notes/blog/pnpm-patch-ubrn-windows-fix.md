---
title: "用 pnpm patch 修一个上游没 merge 的 bug：以 uniffi-bindgen-react-native 的 Windows 长路径为例"
date: 2026-04-17
excerpt: "依赖里有 bug，上游 PR 开着但没 release。fork 嫌重，补丁脚本嫌脏。pnpm patch 是两者之间最干净的折中——这篇讲清楚它怎么用、怎么在 monorepo 里落地、什么时候该删。"
---

# 用 pnpm patch 修一个上游没 merge 的 bug：以 uniffi-bindgen-react-native 的 Windows 长路径为例

一个挺常见的窘境：你依赖的某个 npm 包里有 bug，GitHub 上已经有人提了 PR 修好，但 PR 一周两周不合、release 一月两月不发。你是继续等？自己 fork？还是？

本文讲 pnpm 生态下最干净的答案——`pnpm patch`——用一个刚在项目里踩到的真实 case 串起来：`uniffi-bindgen-react-native`（ubrn）0.31.0-2 在 Windows 上有个 `\\?\` 长路径前缀污染 linker 参数的 bug，上游 PR [#367](https://github.com/jhugman/uniffi-bindgen-react-native/pull/367) 已提但未 merge。

## 现场：ld.lld 说它看不见自己的临时文件

Windows 下跑 `pnpm ubrn:android` 编 arm64 binary，link 阶段成百上千行错误：

```
error: linking with `C:/Users/gy/.cargo/bin/cargo-ndk` failed: exit code: 1
ld.lld: error: cannot find version script \\?\D:\workspace\...\rustc6MrA9A\list
ld.lld: error: cannot open \\?\D:\workspace\...\deps\mobile_core.<hash>.rcgu.o: No such file or directory
ld.lld: error: cannot open \\?\D:\workspace\...\deps\mobile_core.<hash>.rcgu.o: No such file or directory
...
ld.lld: error: too many errors emitted, stopping now
```

路径前面那个 `\\?\D:\...` 是 Windows 的 **extended-length path** 前缀，允许超过 MAX_PATH（260 字符）的路径。`std::fs::canonicalize` 在 Windows 上**总是**返回这种前缀，**不管路径本身多短**。

`ld.lld` 不认识 `\\?\` 前缀，但它不会给你一个"unsupported prefix"错误——而是当成普通路径去 `open()`，发现"文件不存在"。

## 根因：前缀从哪儿来，怎么传染过来的

先看 `cargo-ndk` 调起的 rustc 命令（从错误消息里抠出来的）：

```bash
rustc --manifest-path "\\?\D:\workspace\swarmnote-mobile\packages\swarmnote-core\rust\mobile-core\Cargo.toml" ...
```

`--manifest-path` 已经带 `\\?\` 前缀进来了。cargo 读这个路径后，**所有生成的中间文件路径都会继承这个前缀**——`target/.../deps/rustc6MrA9A/list`、`target/.../deps/*.rcgu.o`，全部带上。然后这些路径作为 `-Wl,--version-script=` / 直接传给 linker 的参数，喂给 `ld.lld`，`ld.lld` 懵了。

为什么 `--manifest-path` 带 `\\?\`？往上追一层，是 ubrn 给的：

```rust
// ubrn_common/src/rust_crate.rs:105
let manifest_path = manifest_path.canonicalize_utf8()?;
//                                 ^^^^^^^^^^^^^^^^^
// Windows 上这里返回 `\\?\D:\...`
```

`canonicalize_utf8` 是 `camino` crate 对 `std::fs::canonicalize` 的 UTF-8 封装。Windows 下的 `std::fs::canonicalize` 源码里直接调 `GetFinalPathNameByHandleW`——这个 Win32 API 默认返回 extended-length 格式。

`subst` 虚拟盘符之类的花活绕不过去：`canonicalize` 会解析虚拟盘符回真实盘符，还是得加 `\\?\`。

## 上游早修过了，只是没 release

搜 `jhugman/uniffi-bindgen-react-native` 的 PR：

```bash
gh search issues --repo jhugman/uniffi-bindgen-react-native "ld.lld" --include-prs
```

拿到 PR #367：**"Strip \\\\?\\ prefix from canonicalized paths on Windows"**，状态 APPROVED 但未 merge，最近 commit 在两周前。这个 PR 用 `dunce` crate（专门解决这个场景的工具 crate）替代 `std::fs::canonicalize`，所有 `ubrn_common` 里的 `canonicalize` 都走 `dunce::canonicalize`，自动剥 `\\?\` 前缀。

只动 3 个文件：

- `crates/ubrn_common/Cargo.toml` —— 加 `dunce = "1.0.5"` 依赖
- `crates/ubrn_common/src/files.rs` —— 两处替换
- `crates/ubrn_common/src/rust_crate.rs` —— 一个 import + 两处替换

加上 Cargo.lock 里 dunce 的条目，就这么多。

## 选项评估：fork、patch-package、pnpm patch

上游不合，我们自己得动手。三个方向：

**Fork 整个仓库，pin 到自己的 commit。** 最重的路。git 有分叉、依赖有分叉、以后升级有合并冲突。修一个 3 行的 bug 开整个 fork 工程 overkill。

**patch-package（npm 生态常用）。** 它读当前 `node_modules` 相对原始包的 diff，把 diff 写到 `patches/`，在 `postinstall` 钩子里再 apply 回去。问题：它是基于修改后的 `node_modules` 反推 diff，你中间如果手抖把别的文件也改了会被一起抓进去；而且 `postinstall` 钩子是约定 ≠ 强制，pnpm 的严格模式有时不跑。

**pnpm patch（pnpm 原生机制）。** 把包**干净地**展开到临时目录，你在临时目录改；pnpm 从原始包 → 临时目录抽 diff，写到 `patches/<pkg>@<ver>.patch`，同时往根 `package.json` 写 `pnpm.patchedDependencies` 映射。之后每次 `pnpm install` 在解析依赖阶段就 apply 掉。无外部钩子、版本锁定、monorepo 原生支持。

这次我们选 pnpm patch。

## pnpm patch 的四步流程

```bash
# 1. 展开干净副本到临时目录
pnpm patch uniffi-bindgen-react-native@0.31.0-2

# 它会打印一个临时目录路径，大致长这样：
#   Patch: You can now edit the package at:
#     D:\workspace\swarmnote-mobile\node_modules\.pnpm_patches\uniffi-bindgen-react-native@0.31.0-2
#   To commit your changes, run:
#     pnpm patch-commit "D:\...\uniffi-bindgen-react-native@0.31.0-2"
```

关键细节：**展开的是原始未修改的包内容**，不是你现在 `node_modules/uniffi-bindgen-react-native/` 里手改过的版本。你之前的手改完全不影响这一步。pnpm 之所以把目录放 `node_modules/.pnpm_patches/`（不是 `/tmp/`），是为了确保文件系统在同一个卷，diff 足够快。

```bash
# 2. 在临时目录编辑文件
```

编辑 3 个文件，完全照搬 PR #367 的改动——对照上游 PR 的 diff 抄即可。这一步没有魔法，就是文本编辑。

```bash
# 3. 提交 patch
pnpm patch-commit "D:\...\uniffi-bindgen-react-native@0.31.0-2"
```

这一步做的事：

1. 从原始包 → 临时目录抽 diff，写到项目 `patches/<pkg>@<ver>.patch`。
2. 往根 `package.json` 的 `pnpm` 字段加 `patchedDependencies` 映射。
3. 触发一次 `pnpm install` 重新装包，确认 patch 可 apply。
4. 清理临时目录。

完事后你的工作区长这样：

```diff
  package.json
+   "pnpm": {
+     "patchedDependencies": {
+       "uniffi-bindgen-react-native@0.31.0-2":
+         "patches/uniffi-bindgen-react-native@0.31.0-2.patch"
+     }
+   }

+ patches/uniffi-bindgen-react-native@0.31.0-2.patch

  pnpm-lock.yaml  # 也更新了，记录了 patched 版本的 hash
```

```bash
# 4. git add + commit，团队其他人 pnpm install 自动生效
```

## patch 文件长什么样

就是一个普通的 unified diff，跟 git diff 几乎一样：

```diff
diff --git a/crates/ubrn_common/Cargo.toml b/crates/ubrn_common/Cargo.toml
index 7b60c9b3..1f05b3de 100644
--- a/crates/ubrn_common/Cargo.toml
+++ b/crates/ubrn_common/Cargo.toml
@@ -8,6 +8,7 @@ publish = false
 anyhow = { workspace = true }
 camino = { workspace = true }
 cargo_metadata = { workspace = true }
+dunce = "1.0.5"
 extend = { workspace = true }
 glob = "0.3.1"
 serde = { workspace = true }
diff --git a/crates/ubrn_common/src/files.rs b/crates/ubrn_common/src/files.rs
...
```

存放在仓库的 `patches/` 下、进 git、人类可读。code review 时能直接看 diff 做什么，不用 diff-on-diff。

## pnpm install 是怎么 apply 的

执行 `pnpm install` 时，pnpm 解析每个依赖时会查 `package.json` 的 `patchedDependencies`。匹配到 `<pkg>@<ver>`，pnpm：

1. 正常下载原始包到内容寻址 store。
2. 在**复制到 `node_modules/<pkg>/` 之前**，先对这份拷贝 apply `patches/<pkg>@<ver>.patch`。
3. patched 后的文件树的 hash 存进 `pnpm-lock.yaml`，保证团队每个人的 `node_modules` 内容一致。

如果 patch apply 失败（比如你升级了上游版本，文件已改、hunk 对不上），pnpm 会报错退出 install，不会给你一个半截打上 patch 的坏包。

## Monorepo 注意事项

本项目是 pnpm workspace，几个坑：

**1. `pnpm patch` 必须在 workspace root 执行。** 在子包执行会报错或者 patch 写到错地方。我们的 `uniffi-bindgen-react-native` 是 `packages/swarmnote-core/` 的 devDep，但 patch 命令要在根仓 `d:/workspace/swarmnote-mobile/` 跑，最终 `patches/` 目录和 `pnpm.patchedDependencies` 字段也在根 `package.json`。

**2. 加 patch 会触发一次 lockfile 更新。** `pnpm-lock.yaml` 里 patched 版本的 integrity 会变（因为 patch 算进了内容 hash），要一起 commit。如果你跑 CI 用 `--frozen-lockfile`，不 commit lockfile 会报错。

**3. 展开的临时目录放在 `node_modules/.pnpm_patches/`。** `.gitignore` 早就忽略 `node_modules/`，不用额外配置。但 patch 过程中如果报错退出，临时目录会留着——下次 `pnpm install` 时 pnpm 可能会 warn；手动删干净即可。

## 实战：我们这次的完整操作

```bash
# 在 workspace root
cd d:/workspace/swarmnote-mobile

# 1. 展开
pnpm patch uniffi-bindgen-react-native@0.31.0-2
# -> D:\workspace\swarmnote-mobile\node_modules\.pnpm_patches\uniffi-bindgen-react-native@0.31.0-2

# 2. 编辑（按 PR #367 改 3 个文件）
# - crates/ubrn_common/Cargo.toml: 加 dunce = "1.0.5"
# - crates/ubrn_common/src/files.rs:
#     - pwd() 里 std::env::current_dir()? 外包一层 dunce::canonicalize()?
#     - canonicalize_utf8_or_shim 用 Utf8PathBuf::try_from(dunce::canonicalize(self)?)?
# - crates/ubrn_common/src/rust_crate.rs:
#     - use crate::{path_or_shim, run_cmd_quietly, Utf8PathExt};
#     - 两处 canonicalize_utf8()? 换成 canonicalize_utf8_or_shim()?

# 3. 提交 patch
pnpm patch-commit "D:/workspace/swarmnote-mobile/node_modules/.pnpm_patches/uniffi-bindgen-react-native@0.31.0-2"

# 4. git commit
git add patches/ package.json pnpm-lock.yaml
git commit -m "build: persist ubrn PR #367 as pnpm patch for Windows long-path fix"
```

之后任何队友 clone 仓库，`pnpm install`，自动拿到 patched 版本的 ubrn。Windows 跑 `pnpm ubrn:android`，ld.lld 不再对着 `\\?\` 发疯。

## 什么时候可以删掉

上游 ubrn 发布了包含 PR #367 的正式版本时。具体来说：

1. 把 `uniffi-bindgen-react-native` 升级到新版本（改 `package.json` 的 `latest` 固定到具体版本号 or `pnpm up uniffi-bindgen-react-native`）。
2. 删 `package.json` 的 `pnpm.patchedDependencies` 里那一行。
3. 删 `patches/uniffi-bindgen-react-native@0.31.0-2.patch`。
4. 跑 `pnpm install`，lock 文件刷新。
5. commit。

pnpm 的版本锁定逻辑保证：只要 `<pkg>@<ver>` 精确匹配，patch 一直生效；不匹配（包升级了），pnpm 警告你 patch 可能过期，需要手动迁移 patch 或删掉。

## 小结

- 依赖有 bug、上游 PR 没合、release 遥遥无期 → 用 `pnpm patch` 本地打补丁。
- 流程四步：`pnpm patch <pkg>@<ver>` 展开 → 编辑临时目录 → `pnpm patch-commit <path>` 抽 diff → git add 提交。
- 产物：`patches/*.patch` + 根 `package.json` 的 `pnpm.patchedDependencies` 映射。
- 之后 `pnpm install` 自动 apply，团队零手工同步。
- 上游合了就删 patch，lockfile 会告诉你是否还能安全删。

比 fork 轻、比 patch-package 干净，pnpm 生态内最佳实践。下次再见到上游 PR 堆积如山的场面，不要犹豫。

## 相关资源

- [pnpm patch 官方文档](https://pnpm.io/cli/patch)
- [pnpm patch-commit 官方文档](https://pnpm.io/cli/patch-commit)
- [dunce crate](https://gitlab.com/kornelski/dunce) —— Rust 侧处理 Windows `\\?\` 的标准方案
- [本项目修 ubrn 的那个 PR #367](https://github.com/jhugman/uniffi-bindgen-react-native/pull/367)
- 本项目的 `patches/uniffi-bindgen-react-native@0.31.0-2.patch` —— 具体 diff 参考
- 本项目的 `dev-notes/knowledge/ubrn.md` 坑 3 —— 更简短的条目版

---

**最后更新**：2026 年 4 月
**测试环境**：pnpm 10.x、Node 20.x、Windows 11、uniffi-bindgen-react-native 0.31.0-2
