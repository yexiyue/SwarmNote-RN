# SwarmNote Mobile

SwarmNote 的移动端应用，使用 Expo (React Native) 构建。通过 uniffi-bindgen-react-native 桥接 Rust 核心逻辑，与桌面端共享 P2P 同步、CRDT 协作、文档管理等核心能力。

## 项目背景

[SwarmNote](https://github.com/yexiyue/SwarmNote) 是一个去中心化、本地优先的 P2P 笔记同步工具。桌面端已实现完整功能（Tauri v2 + React），本仓库是其移动端对应项目。

### 核心理念

- **P2P 免费同步** — 设备间直接通信，不经过第三方服务器
- **CRDT 自动合并** — 离线编辑后重连，字符级自动合并，零冲突
- **数据完全本地** — 笔记存储在设备上，隐私优先
- **跨平台复用** — Rust 核心逻辑通过 uniffi 桥接，桌面端和移动端共享同一套后端

### Swarm 生态

```
SwarmDrop   v0.4.4  — 点对点文件传输（已完成）
SwarmNote   v0.2.3  — P2P 笔记同步-桌面端（已完成核心功能）
SwarmNote Mobile    — P2P 笔记同步-移动端（本项目，开发中）
swarm-p2p-core      — P2P 网络 SDK（共享基础库）
```

## 技术栈

| 层面 | 选型 | 说明 |
|------|------|------|
| 框架 | Expo SDK 55 | React Native 0.83 + React 19 |
| 路由 | Expo Router | 文件路由（`src/app/`） |
| 样式 | NativeWind v4 | Tailwind CSS 3 for React Native |
| UI 组件 | React Native Reusables | shadcn/ui 的 RN 移植版 |
| 状态管理 | Zustand | 与桌面端一致 |
| 国际化 | Lingui | zh 源语言，en 翻译 |
| Rust 桥接 | uniffi-bindgen-react-native | 待集成，桥接 Rust 核心逻辑 |
| Lint/Format | Biome | 替代 ESLint + Prettier |
| Git Hooks | Lefthook | pre-commit (Biome) + commit-msg (commitlint) |
| 包管理 | pnpm | `.npmrc` 配置 `node-linker=hoisted` |

### 与桌面端的对应关系

| 桌面端 (Tauri + React) | 移动端 (Expo + RN) |
|---|---|
| shadcn/ui (Radix + Tailwind 4) | React Native Reusables (NativeWind) |
| TanStack Router | Expo Router |
| Zustand stores | Zustand stores（逻辑可复用） |
| `invoke('cmd', args)` | uniffi 直接函数调用（类型安全） |
| `app.emit("event")` | uniffi callback interface |
| `src/components/ui/` | `src/components/ui/`（同路径） |

## 目录结构

```
swarmnote-mobile/
├── src/
│   ├── app/                # Expo Router 文件路由
│   │   └── _layout.tsx     # 根布局（ThemeProvider + PortalHost）
│   ├── components/
│   │   └── ui/             # RNR 组件（copy-paste，CLI 添加）
│   ├── lib/
│   │   ├── theme.ts        # 主题配置（CSS 变量的 JS 镜像）
│   │   └── utils.ts        # cn() 工具函数
│   ├── hooks/              # 自定义 hooks
│   ├── stores/             # Zustand stores（待创建）
│   ├── locales/            # i18n 翻译文件
│   └── global.css          # Tailwind CSS 变量（亮/暗主题）
├── assets/                 # 图片、字体等静态资源
├── dev-notes/              # 开发笔记、技术调研
├── milestones/             # 版本规划文档
├── app.json                # Expo 配置
├── babel.config.js         # NativeWind babel preset
├── metro.config.js         # withNativeWind + inlineRem
├── tailwind.config.js      # 主题色、圆角、动画
├── biome.json              # Lint + Format 配置
├── components.json         # RNR CLI 配置
├── lefthook.yml            # Git hooks
├── cliff.toml              # Changelog 生成
├── lingui.config.ts        # i18n 配置
└── CLAUDE.md               # AI 开发指南
```

## 开发

### 环境要求

- Node.js 22+
- pnpm 10+
- Android Studio（Android 开发）
- Xcode（iOS 开发，仅 macOS）

### 快速开始

```bash
# 安装依赖
pnpm install

# 启动 Metro 开发服务器
pnpm start

# Android
pnpm android

# iOS（仅 macOS）
pnpm ios

# Web
pnpm web
```

### 常用命令

```bash
# Lint
pnpm lint          # Biome check
pnpm lint:ci       # CI 模式（非零退出码）
pnpm format        # 自动修复

# i18n
pnpm lingui:extract    # 提取翻译消息

# Changelog
pnpm changelog         # 生成 CHANGELOG.md
pnpm changelog:latest  # 查看未发布变更

# UI 组件
pnpm dlx @react-native-reusables/cli@latest add button    # 添加单个组件
pnpm dlx @react-native-reusables/cli@latest add --all     # 添加所有组件
pnpm dlx @react-native-reusables/cli@latest doctor         # 诊断配置
```

### 注意事项

- **不支持 Expo Go** — 使用 Development Build（`npx expo run:android` / `npx expo run:ios`）
- **pnpm 必须 hoisted** — `.npmrc` 中的 `node-linker=hoisted` 不可删除
- **修改 babel/metro 配置后** — 必须清缓存：`npx expo start --clear`
- **暗色模式 CSS 选择器** — 用 `.dark:root`（NativeWind 约定），不是 `.dark`
- **RN 样式不继承** — 每个 `<Text>` 需单独加 className

## Rust 桥接架构（待实现）

移动端通过 uniffi-bindgen-react-native 桥接桌面端的 Rust 核心逻辑：

```
swarmnote（桌面端仓库）
├── crates/app-core/        # 平台无关 Rust 核心（#[uniffi::export]）
├── libs/core/              # swarm-p2p-core (P2P 网络)
├── crates/yrs-blocknote/   # CRDT ↔ Markdown
└── src-tauri/              # Tauri 薄包装层

swarmnote-mobile（本仓库）
├── packages/core/          # 桥接库（Turbo Module，待创建）
│   ├── ubrn.config.yaml
│   └── rust_modules/       # submodule → 桌面端仓库
└── src/                    # RN 前端，调用生成的 TS API
```

调用链路：`TypeScript → Hermes JSI → C++ → Rust`，无 JSON 序列化，性能优于 Tauri 的 WebView invoke。

## 开发路线

### Phase 1: UI 壳 + Rust 桥接验证

- [ ] Tab 导航结构（笔记列表 / 编辑器 / 同步 / 设置）
- [ ] 基础页面和组件
- [ ] `crates/app-core/` 骨架 + uniffi hello world 调用

### Phase 2: 功能串联

- [ ] 工作区管理（打开/创建/列表）
- [ ] 文档列表 + Markdown 预览
- [ ] 身份管理（设备名、PeerId）

### Phase 3: 核心能力

- [ ] 富文本编辑器（RN 端方案调研）
- [ ] P2P 同步
- [ ] 设备配对

## License

MIT
