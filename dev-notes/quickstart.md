# 快速启动指南

新设备上从零跑起 SwarmNote Mobile 的完整流程。本仓库由 Expo + React Native + Rust（uniffi）+ CodeMirror（WebView）多层组成,跳过任何一层都跑不起来。

> 一句话流程:**装环境 → 拉代码（含 submodule） → `pnpm install` → 编辑器 web bundle → Rust 桥接产物 → `expo prebuild` → `pnpm ios` / `pnpm android`**。

---

## 1. 环境依赖

| 依赖 | 版本 | 备注 |
|---|---|---|
| Node.js | 22+ | LTS |
| pnpm | 10+ | `corepack enable` 或 `npm i -g pnpm` |
| Rust | stable | 通过 [rustup](https://rustup.rs/) 安装 |
| Git | 2.x | 仓库含 submodule,旧版 git 行为差异较大 |
| Android Studio | 最新 | 含 Android SDK + NDK,Android 开发 |
| Xcode | 16+ | 仅 macOS,iOS 开发;CLI Tools `xcode-select --install` |
| CocoaPods | 最新 | iOS 才需要,`brew install cocoapods` |
| JDK | 17 | Android 构建,推荐 Temurin |

### Rust 交叉编译 target

仅需要装目标平台的 target,不必两端都装:

```bash
# Android
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

# iOS
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
```

### Android NDK / 环境变量

- 在 Android Studio 的 SDK Manager 里安装 **NDK (Side by side)** 和 **CMake**。
- shell 配置(`~/.zshrc` 或 `~/.bashrc`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk           # macOS 默认路径
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/<version>     # 替换成实际版本号
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

### cargo git fetch 走系统 git

Rust 端依赖会拉私有 submodule,cargo 内置的 libgit2 拿不到 macOS keychain / SSH 凭据。在 `~/.cargo/config.toml` 加:

```toml
[net]
git-fetch-with-cli = true
```

> 这是项目级踩坑,详见 [dev-notes/knowledge/ubrn.md](knowledge/ubrn.md) 坑 4。

---

## 2. 克隆仓库 + 初始化 submodule

`packages/editor/` 是独立 Git 仓库(`yexiyue/swarmnote-editor`),通过 submodule 挂载,**漏掉这一步后续 `pnpm install` 会因为 workspace 解析失败而报错**。

```bash
# 一步到位
git clone --recurse-submodules https://github.com/yexiyue/SwarmNote-RN.git
cd SwarmNote-RN

# 或者已经 clone 了的:
git submodule update --init
```

---

## 3. 安装 Node 依赖

```bash
pnpm install
```

会发生:

1. pnpm 按 `pnpm-workspace.yaml` 解析三个 workspace 包(`react-native-swarmnote-core`, `@swarmnote/editor`, `@swarmnote/editor-web`)。
2. 自动应用 `patches/uniffi-bindgen-react-native@0.31.0-2.patch`(Windows lld 路径修复)。
3. `react-native-swarmnote-core` 的 `prepare` 脚本会跑 `bob build`,把 `packages/swarmnote-core/src/` 编译到 `lib/`(模块 + d.ts)。

> **不要删 `.npmrc` 中的 `node-linker=hoisted`**,Metro 不兼容 pnpm 默认的 symlink node_modules 布局。

---

## 4. 构建编辑器 WebView bundle

编辑器走 RN → WebView → CodeMirror 的链路,`MarkdownEditor` 注入的是 `@swarmnote/editor-web/dist/bundle`,**不构建这个 bundle 编辑器页面会白屏**。

```bash
pnpm --filter @swarmnote/editor-web build
```

> 之后如果改了 `packages/editor/` 或 `packages/editor-web/` 下的代码,必须重跑这条命令,否则 WebView 仍加载旧 bundle。详见 [CLAUDE.md](../CLAUDE.md) 的「Editor stack」段。

---

## 5. 生成 Rust 桥接产物

`packages/swarmnote-core/{src,cpp}/generated/` 由 `uniffi-bindgen-react-native`(简称 ubrn)生成,**首次 clone 一定要跑**,否则 RN 侧 import 不到 `mobile_core.ts`。

只跑你要构建的平台即可:

```bash
# Android
pnpm --filter react-native-swarmnote-core ubrn:android

# iOS（仅 macOS）
pnpm --filter react-native-swarmnote-core ubrn:ios
```

每条命令做的事:

1. `cargo build --target <triple>` 编译 `rust/mobile-core/`,产出静态库或 xcframework。
2. 生成 C++ JSI 胶水(`cpp/generated/`)和 TS 绑定(`src/generated/`)。
3. 跑 `scripts/fix-ubrn-output.mjs` 修补 ubrn `0.31.0-2` 的 `async static` 模板 bug。

> 不要手改 `cpp/generated/` 和 `src/generated/`,下次重新生成会被覆盖。详见 [dev-notes/knowledge/ubrn.md](knowledge/ubrn.md)。

---

## 6. 生成原生项目并运行

Expo 用 prebuild 把 `app.json` + 插件展开成真正的 `android/` 和 `ios/` 工程,**新设备 / 改了 `app.json` 后必须 prebuild**。

### Android

```bash
npx expo prebuild --platform android
pnpm android         # 等价于 expo run:android
```

首次会 Gradle 同步 + 下载 NDK 工具链,几分钟到十几分钟。

### iOS（仅 macOS）

```bash
npx expo prebuild --platform ios --clean
pnpm ios             # 等价于 expo run:ios
```

`--clean` 让 prebuild 用 `expo-build-properties` 的 `ios.deploymentTarget: 17.0` 重写 `ios/swarmnotemobile.xcodeproj/project.pbxproj`,避免 Xcode 26 的 `SwiftUICore.tbd allowable-clients` 链接错误(详见 [dev-notes/knowledge/ubrn.md](knowledge/ubrn.md) 坑 5)。

`pnpm ios` 内部会自动 `pod install`,首次会拉一堆 Pod,耐心等。

---

## 7. 验证启动成功

打开应用后:

- 进入主 Tab,能看到 Workspace / Devices / Settings 几个页面;
- 进入编辑器测试页(代码里 `src/app/editor-test.tsx`),CodeMirror 可以编辑;
- adb logcat / Xcode console 不应该有 `Rust panic` / `no reactor running` 等异常。

---

## 常见首次启动问题

### `Cannot find module '@swarmnote/editor-web/dist/bundle'`

没跑步骤 4。`pnpm --filter @swarmnote/editor-web build`。

### `Cannot find module './generated/mobile_core'`

没跑步骤 5。按目标平台跑 `pnpm --filter react-native-swarmnote-core ubrn:android` 或 `ubrn:ios`。

### `pnpm install` 卡在 `react-native-swarmnote-core prepare`

通常是 `packages/editor/` submodule 没初始化,workspace 解析失败,bob build 找不到入口。`git submodule update --init` 后重试。

### iOS 链接报 `SwiftUICore.tbd ... not an allowed client`

`expo prebuild --platform ios --clean` 走一遍。如果还报,确认 `app.json` 里 `expo-build-properties` 的 `ios.deploymentTarget` 是 `"17.0"`,以及 `packages/swarmnote-core/rust/mobile-core/.cargo/config.toml` 的 `IPHONEOS_DEPLOYMENT_TARGET` 也是 `"17.0"`,然后重跑步骤 5。

### iOS 链接报 `Undefined symbols: _SC*`

需要在 `packages/swarmnote-core/SwarmnoteCore.podspec` 显式声明 framework。详见 [dev-notes/knowledge/ubrn.md](knowledge/ubrn.md) 坑 6。

### Windows 上 `pnpm ubrn:android` 报 `ld.lld: cannot find ... \\?\...`

仓库已带 ubrn patch(`patches/uniffi-bindgen-react-native@0.31.0-2.patch`),`pnpm install` 会自动应用。如果还报,确认 patch 已应用 + `pnpm install` 没跳过 `patchedDependencies`。详见 [dev-notes/knowledge/ubrn.md](knowledge/ubrn.md) 坑 3。

### Metro 报 NativeWind / global.css 异常

改过 `src/global.css`、`metro.config.js`、`babel.config.js`、`postcss.config.mjs` 之后必须清缓存:

```bash
npx expo start --clear
```

---

## 改动后的局部重建速查

| 改了什么 | 需要做的事 |
|---|---|
| `packages/editor/` 或 `packages/editor-web/` 任意源码 | `pnpm --filter @swarmnote/editor-web build` 后 reload app |
| `rust/mobile-core/` Rust 源码 | `pnpm --filter react-native-swarmnote-core ubrn:android` 或 `ubrn:ios`,然后重跑 `pnpm android` / `pnpm ios` |
| `app.json`、原生插件配置 | `npx expo prebuild --platform <ios\|android> --clean` 然后重跑 `pnpm ios` / `pnpm android` |
| `src/global.css`、Metro / Babel / NativeWind 配置 | `npx expo start --clear` |
| 仅 RN/TS 业务代码 | Metro fast refresh,无需重建 |

---

## UpgradeLink secrets(可选,用于自动更新)

仓库带 Android in-app updater(走 UpgradeLink),如果你想发布时让旧版本设备能自动收到更新通知,需要在 GitHub repo Settings → Secrets and variables → Actions 配 3 个 secret:

| Name | 用途 |
|---|---|
| `UPGRADE_LINK_ACCESS_KEY` | UpgradeLink 账号 access key |
| `UPGRADE_LINK_ACCESS_SECRET` | UpgradeLink 账号 access secret |
| `UPGRADE_LINK_APK_KEY` | UpgradeLink 平台上为这个 app 创建的 Android 项目 key |

CI 通过这些 secret:

1. 用 `EXPO_PUBLIC_*` 前缀同名环境变量在 `gradlew assembleRelease` 时让 Metro inline 进 JS bundle(client 端调 UpgradeLink 用)
2. 在 `upgradelink-upload` job 里通过 `toolsetlink/upgradelink-action@3.0.2` 把新 release 的 APK URL 推到 UpgradeLink

本地开发:在仓库根创建 `.env.local`(已 gitignored),内容:

```
EXPO_PUBLIC_UPGRADELINK_ACCESS_KEY=...
EXPO_PUBLIC_UPGRADELINK_ACCESS_SECRET=...
EXPO_PUBLIC_UPGRADELINK_APK_KEY=...
```

不配的话客户端会 silent skip 更新检查,App 仍可正常使用。

详见 [dev-notes/knowledge/auto-update.md](knowledge/auto-update.md)。

---

# 知识库索引

更深的踩坑记录散在 `dev-notes/knowledge/`:

- [theme-and-styling.md](knowledge/theme-and-styling.md) — NativeWind v5 + Tailwind 4 + CSS 变量主题
- [editor.md](knowledge/editor.md) — 编辑器整体链路
- [editor-core-abstractions.md](knowledge/editor-core-abstractions.md) — `@swarmnote/editor` 平台无关核心
- [rust-bridge.md](knowledge/rust-bridge.md) — uniffi 桥接架构、async runtime、wrap 决策
- [ubrn.md](knowledge/ubrn.md) — ubrn 构建工具链所有踩坑(iOS / Android / Windows / Xcode 26)
- [toolchain.md](knowledge/toolchain.md) — Biome / Lingui / Lefthook / Metro
- [sync.md](knowledge/sync.md) — P2P 同步
- [files-panel.md](knowledge/files-panel.md) — 文件面板
- [i18n.md](knowledge/i18n.md) — Lingui i18n
- [rn-state-and-lifecycle.md](knowledge/rn-state-and-lifecycle.md) — RN 状态与生命周期
