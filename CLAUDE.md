# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SwarmNote Mobile 是 SwarmNote 的移动端应用，使用 Expo + React Native 构建。通过 uniffi-bindgen-react-native 桥接 Rust 核心逻辑，实现与桌面端（Tauri）共享 P2P 同步、CRDT 协作、文档管理等核心能力。

**姐妹项目**：[swarmnote](https://github.com/yexiyue/swarmnote)（桌面端，Tauri v2 + React）

## Development Commands

```bash
# 安装依赖
pnpm install

# 启动 Metro 开发服务器
pnpm start

# 启动并打开 Android 模拟器
pnpm android

# 启动并打开 iOS 模拟器（仅 macOS）
pnpm ios

# 启动 Web 版本
pnpm web

# Lint（Biome check）
pnpm lint

# Lint CI 模式（无自动修复，非零退出码）
pnpm lint:ci

# 自动修复 lint + format
pnpm format

# i18n: 提取翻译消息
pnpm lingui:extract

# 生成 CHANGELOG
pnpm changelog

# 显示未发布变更
pnpm changelog:latest

# 添加 RNR UI 组件
pnpm dlx @react-native-reusables/cli@latest add <component-name>

# 添加所有 RNR 组件
pnpm dlx @react-native-reusables/cli@latest add --all

# 检查 RNR 配置是否正确
pnpm dlx @react-native-reusables/cli@latest doctor

# 生成原生项目（Android/iOS）
npx expo prebuild

# 本地开发构建（不使用 Expo Go）
npx expo run:android
npx expo run:ios
```

**工具版本**：Node 22+、pnpm 10+、Expo SDK 55、React Native 0.83

## Tech Stack

| 层面 | 选型 |
|------|------|
| 框架 | Expo SDK 55 (React Native 0.83, React 19) |
| 路由 | Expo Router（文件路由，`src/app/`） |
| 样式 | NativeWind v4（Tailwind CSS 3 for React Native） |
| UI 组件 | React Native Reusables（shadcn/ui 的 RN 移植版） |
| 状态管理 | Zustand（与桌面端一致） |
| Rust 桥接 | uniffi-bindgen-react-native（待集成） |
| 包管理 | pnpm（`.npmrc` 配置 `node-linker=hoisted`） |

## Architecture

> **当前状态**：项目处于初始模板阶段，`src/` 下的代码大部分是 Expo 模板生成的示例代码，尚未开始实际业务开发。以下架构描述的是已配置好的基础设施和规划方向。

### 关键目录

- `src/app/` — Expo Router 文件路由
- `src/components/ui/` — RNR 组件（copy-paste，勿直接修改源码）
- `src/lib/` — `theme.ts`（NAV_THEME）+ `utils.ts`（cn()）
- `src/hooks/` — 自定义 hooks
- `src/stores/` — Zustand stores（待创建）
- `src/global.css` — Tailwind CSS 变量（亮色/暗色主题）
- `dev-notes/` — 开发笔记（uniffi 集成指南等）

### 平台特定文件

React Native 平台后缀约定（Metro bundler 自动选择）：`*.tsx`（原生端）、`*.web.tsx`（Web 端覆盖）。

### 主题系统（4 个文件联动）

| 文件 | 职责 |
| ---- | ---- |
| `src/global.css` | 定义 CSS 变量（`:root` 亮色 / `.dark:root` 暗色） |
| `tailwind.config.js` | 将 CSS 变量映射为 Tailwind 工具类 |
| `src/lib/theme.ts` | CSS 变量的 JS 镜像，供 React Navigation ThemeProvider 使用 |
| `components.json` | RNR CLI 配置，指定组件路径和样式方案 |

**修改主题色时**：改 `global.css` → 同步更新 `lib/theme.ts` → `tailwind.config.js` 通常不需要改。

### Rust 桥接架构（待实现）

```text
swarmnote（桌面端仓库）
├── crates/app-core/        # 平台无关 Rust 核心（#[uniffi::export]）
└── src-tauri/              # Tauri 薄包装层

swarmnote-mobile（本仓库）
├── libs/swarmnote/         # 桌面端仓库（git submodule，引用 app-core）
└── src/                    # RN 前端，直接调用 uniffi 生成的 TS 函数
```

## Code Conventions

### 通用

- **TypeScript**: strict mode，路径别名 `@/` → `src/`
- **React**: 函数组件 + hooks，PascalCase 文件名
- **Package manager**: pnpm（不用 npm/yarn）
- **Git commits**: Conventional Commits（`feat:`, `fix:`, `docs:`, `chore:` 等）
- **Git commits**: 不要添加 `Co-authored-by` trailer

### 样式

- **优先使用 NativeWind className**，避免 `StyleSheet.create`
- **颜色统一使用主题变量**：`text-foreground`、`bg-background`、`border-border`、`bg-primary`、`text-muted-foreground` 等，不硬编码颜色值
- **暗色模式选择器**：CSS 中用 `.dark:root`（NativeWind 约定），不是 `.dark`
- **RN 样式不继承**：子元素不会继承父元素的文本样式，每个 `<Text>` 需单独加 className

### UI 组件

- **优先使用 React Native Reusables 组件**（`@/components/ui/`），能用就用
- **添加组件用 CLI**：`pnpm dlx @react-native-reusables/cli@latest add <name>`
- **不要直接修改 `components/ui/` 下的源码**——如需定制，在外层包装
- **浮层组件**（Dialog、Sheet、Popover 等）依赖 `<PortalHost />`，已在根布局配置
- **图标**：使用 Lucide React Native（RNR 内置）

### 与桌面端的对应关系

| 桌面端 (SwarmNote) | 移动端 (本项目) |
| --- | --- |
| shadcn/ui | React Native Reusables |
| Tailwind CSS 4 | NativeWind v4 (Tailwind 3) |
| TanStack Router | Expo Router |
| Zustand stores | Zustand stores（可复用逻辑） |
| `invoke('cmd', args)` | uniffi 直接函数调用 |
| `app.emit("event")` | uniffi callback interface |
| `src/components/ui/` | `src/components/ui/`（同路径） |

## Code Quality Toolchain

- **Biome** (`biome.json`): lint + format（替代 ESLint + Prettier），`recommended` 规则集，自动 organize imports，2 空格缩进，行宽 100。排除 `src/locales/**`，`src/global.css` 关闭 `noUnknownAtRules`（Tailwind v3 指令）
- **Lefthook** (`lefthook.yml`): Git hooks 管理
  - `pre-commit`: Biome check（并行执行）
  - `commit-msg`: commitlint 校验 Conventional Commits 格式
- **commitlint** (`commitlint.config.js`): 提交信息必须遵循 Conventional Commits（`feat:`, `fix:`, `docs:`, `chore:` 等）
- **git-cliff** (`cliff.toml`): 基于 Conventional Commits 自动生成 CHANGELOG
- **Lingui** (`lingui.config.ts`): i18n 国际化，zh 为源语言，en 翻译，catalogs 在 `src/locales/`
- **GitHub Actions** (`.github/workflows/ci.yml`): PR/push 到 main/develop 时自动跑 Biome lint + TypeScript check

## Key Config Files

- `app.json` — Expo 应用配置（名称、图标、插件、实验性功能）
- `babel.config.js` — NativeWind 需要 `jsxImportSource: "nativewind"` + `nativewind/babel` preset
- `metro.config.js` — `withNativeWind(config, { input: "./src/global.css", inlineRem: 16 })`
- `tailwind.config.js` — `darkMode: "class"`，`presets: [nativewind/preset]`，主题色映射
- `tsconfig.json` — 路径别名 `@/` → `src/`，`@/assets/` → `assets/`
- `components.json` — RNR CLI 配置，style: `new-york`，路径指向 `@/components/ui`
- `.npmrc` — `node-linker=hoisted`（pnpm + React Native 兼容必需）

## Important Notes

- **不支持 Expo Go** — 项目使用原生模块（NativeWind、uniffi），必须用 Development Build
- **pnpm 必须配置 hoisted** — React Native Metro 不支持 pnpm 默认的 symlink 式 node_modules
- **NativeWind v4 需要 Tailwind CSS 3** — 不是 Tailwind v4，配置文件是 `tailwind.config.js` 不是 CSS
- **修改 babel/metro 配置后** — 必须清除缓存：`npx expo start --clear`
