# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发工作流

**IMPORTANT**: 执行任何开发任务（编写代码、修改配置、添加依赖）前，必须先调用 `/dev-workflow` skill。它会加载项目知识库（`dev-notes/knowledge/`）中的最佳实践和踩坑记录，并在开发完成后更新知识库。

## Project Overview

SwarmNote Mobile — Expo + React Native 移动端，通过 uniffi 桥接 Rust 核心逻辑，与桌面端（Tauri）共享 P2P 同步、CRDT 协作能力。

## Commands

```bash
pnpm install          # 安装依赖
pnpm start            # Metro 开发服务器
pnpm android          # Android 模拟器
pnpm ios              # iOS 模拟器（仅 macOS）
pnpm lint             # Biome check
pnpm format           # 自动修复 lint + format
pnpm lingui:extract   # 提取翻译消息

# 包级别
cd packages/swarmnote-core && pnpm ubrn:android   # Rust 编译
cd packages/editor-web && pnpm build               # 编辑器 WebView bundle
```

## Tech Stack

| 层面 | 选型 |
|------|------|
| 框架 | Expo SDK 55 (React Native 0.83, React 19) |
| 路由 | Expo Router（文件路由，`src/app/`） |
| 样式 | NativeWind v5（Tailwind CSS 4，CSS-first） |
| UI 组件 | React Native Reusables（shadcn/ui RN 移植版） |
| 编辑器 | CodeMirror 6（WebView + Comlink RPC） |
| Rust 桥接 | uniffi-bindgen-react-native（Turbo Module） |
| 包管理 | pnpm monorepo |

## Architecture

### Monorepo

| 包 | 路径 | 用途 |
|----|------|------|
| `react-native-swarmnote-core` | `packages/swarmnote-core/` | Rust → RN 桥接 |
| `@swarmnote/editor` | `packages/editor/` | 平台无关 CM6 编辑器核心 |
| `@swarmnote/editor-web` | `packages/editor-web/` | WebView IIFE bundle |

### 主题系统（单一真相源）

`src/global.css` 是唯一真相源。改主题色只改这个文件，JS 侧通过 `useThemeColors()` 动态读取。不需要 `tailwind.config.js`，不需要 `theme.ts`。

### Pencil 设计文件（.pen）

设计稿位于 `dev-notes/design/mobile-design.pen`，主题变量已与 `src/global.css` 对齐。

**切换主题**：通过 `batch_design` 修改根 frame 的 `theme` 属性：

```javascript
U("MzSDs", {theme: {"Mode": "Light"}})   // 亮色
U("MzSDs", {theme: {"Mode": "Dark"}})    // 暗色
```

**设置主题变量**：使用 `set_variables` + `replace: true`，每个变量的亮/暗值都必须显式带 theme 标记：

```json
{"value": "#FDFCFA", "theme": {"Mode": "Light"}}
{"value": "#1B1918", "theme": {"Mode": "Dark"}}
```

不带 theme 的值只是 fallback，不会注册到 Mode 轴，切换时不生效。

**配色参考**：`dev-notes/design/theme-palette.md`

### 项目知识库

详细的架构说明、最佳实践、踩坑记录在 `dev-notes/knowledge/` 下按主题组织：
- `theme-and-styling.md` — NativeWind v5、配色、RNR 组件
- `editor.md` — CM6、WebView、Comlink
- `rust-bridge.md` — uniffi、交叉编译
- `toolchain.md` — Biome、Lingui、Metro、Expo

## Code Conventions

- **TypeScript** strict mode，路径别名 `@/` → `src/`
- **样式**：NativeWind className，不用 `StyleSheet.create` 定主题色，不硬编码颜色
- **UI 组件**：优先用 RNR（`@/components/ui/`），CLI 添加，不直接改源码
- **useColorScheme** 从 `react-native` 导入（不是 `nativewind`）
- **Git commits**: Conventional Commits，不加 `Co-authored-by` trailer
- **Package manager**: pnpm（不用 npm/yarn）

## Critical Notes

- **不支持 Expo Go** — 必须用 Development Build
- **pnpm 必须 hoisted** — `.npmrc` 中 `node-linker=hoisted` 不可删除
- **修改 global.css 后** — 必须 `npx expo start --clear`
- **lightningcss 锁定 1.30.1** — 否则 global.css 反序列化错误
- **editor-web 修改后** — 必须 `pnpm build` 重新生成 bundle
- **`src/generated/` 和 `cpp/generated/`** — 自动生成，勿手动编辑
