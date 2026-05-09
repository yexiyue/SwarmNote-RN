# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发工作流

**IMPORTANT**: 执行任何开发任务（编写代码、修改配置、添加依赖）前，必须先调用 `/dev-workflow` skill。它会加载项目知识库（`dev-notes/knowledge/`）中的最佳实践和踩坑记录，并在开发完成后更新知识库。

## Project Overview

SwarmNote Mobile 是基于 Expo + React Native 的移动端应用。它通过 `uniffi-bindgen-react-native` 桥接 Rust 核心逻辑，与桌面端共享 P2P 同步、CRDT 协作和文档能力。

## Common Commands

```bash
# workspace
pnpm install
pnpm start                         # Metro dev server
pnpm android                       # Android development build
pnpm ios                           # iOS development build（仅 macOS）
pnpm web                           # Web preview
npx expo prebuild --platform android
npx expo prebuild --platform ios
npx expo start --clear             # 改 global.css / Metro / Babel / NativeWind 配置后必须

# quality
pnpm lint                          # Biome check src/
pnpm lint:ci                       # CI mode
pnpm format                        # Biome auto-fix
pnpm exec tsc --noEmit             # root TypeScript check
pnpm lingui:extract                # extract i18n messages

# editor packages
# @swarmnote/editor-core 住在 sibling 仓 ../swarmnote-editor/packages/editor-core/
# 本仓只有 @swarmnote/editor-web (WebView bundle)
pnpm --filter @swarmnote/editor-web build
pnpm --filter @swarmnote/editor-web dev
# editor-core 改动后在 sibling 仓重 build：
(cd ../swarmnote-editor && pnpm --filter @swarmnote/editor-core dev)  # watch 模式

# rust bridge package
pnpm --filter react-native-swarmnote-core typecheck
pnpm --filter react-native-swarmnote-core ubrn:android
pnpm --filter react-native-swarmnote-core ubrn:ios
pnpm --filter react-native-swarmnote-core ubrn:checkout
```

## Tests and Validation

- 当前仓库**没有配置项目级测试命令**；`package.json` 和 CI 里都只有 lint + TypeScript check，不要臆造 `pnpm test` 或“单测命令”。
- 目前可用的回归手段：
  - `pnpm lint`
  - `pnpm exec tsc --noEmit`
  - 编辑器改动后打开 `src/app/editor-test.tsx` 对应页面做手工验证
- 如果后续引入测试框架，再把“运行全部测试 / 单个测试”的命令补进本文件。

## High-Level Architecture

### App shell and routing

- Expo Router 使用 `src/app/` 文件路由。
- 根布局 `src/app/_layout.tsx` 负责：
  - 导入 `src/global.css`
  - 用 `useNavTheme()` 注入 React Navigation theme
  - 恢复持久化主题偏好
  - 挂载 `PortalHost`，供 Dialog / Popover / Tooltip / Select 等浮层组件使用
- 主导航目前由 `src/components/app-tabs.tsx` 提供，基于 `expo-router/unstable-native-tabs`。

### Theme system: CSS is the source of truth

- `src/global.css` 是主题变量的**唯一真相源**。
- JS/TS 侧如果需要颜色值，不维护 `theme.ts` 镜像，而是通过 `src/hooks/useThemeColors.ts` 动态读取 CSS 变量。
- NativeWind v5 + Tailwind CSS 4 采用 CSS-first 配置：
  - `postcss.config.mjs` 使用 `@tailwindcss/postcss`
  - `metro.config.js` 使用 `withNativewind(config)`
  - 不要添加 `tailwind.config.js`
  - 不要在 Babel 里加 `nativewind/babel`
- 主题切换相关 API 使用 `react-native` 的 `useColorScheme` / `Appearance`，不要从 `nativewind` 导入。

### Editor stack: RN → WebView → Comlink → CodeMirror

编辑器不是直接在 React Native 里渲染，而是走一条分层链路：

1. `src/components/editor/MarkdownEditor.tsx`
   - 挂载 `react-native-webview`
   - 把 `@swarmnote/editor-web/dist/bundle` 注入到 WebView
2. `src/components/editor/useEditorBridge.ts`
   - 在 RN 侧创建 Comlink bridge
3. `src/lib/comlink-webview-adapter.ts`
   - 把 `injectJavaScript` / `postMessage` 适配成 Comlink endpoint
4. `packages/editor-web/`
   - WebView 侧入口，暴露 `EditorApi`
   - 创建 Yjs 文档、把编辑器事件回传给 RN
5. `@swarmnote/editor-core`（住在 sibling 仓 `../swarmnote-editor/packages/editor-core/`，通过 `pnpm.overrides` 链入）
   - 平台无关的 CodeMirror 6 核心
   - `createEditor.ts` 里组装 markdown、history、selection、search、Yjs 扩展

关键约束：
- editor-core 保持平台无关，不引入 React Native 或 WebView 细节。
- DOM / WebView 逻辑放 `packages/editor-web/`。
- RN 容器和 bridge 逻辑放 `src/components/editor/`。
- 修改 sibling 仓 editor-core 或 `packages/editor-web/` 后，必须重新执行 `pnpm --filter @swarmnote/editor-web build`（编辑 editor-core 还需要先在 sibling 仓 build dist），否则移动端 WebView 仍会加载旧 bundle。
- Android WebView 上必须禁用 CodeMirror 的 `EditContext`，该处理已在 sibling 仓 `packages/editor-core/src/createEditor.ts` 中完成，不要删掉。

### Rust bridge: Turbo Module + uniffi

- `packages/swarmnote-core/` 是 React Native Turbo Module 包。
- 调用链是：`TypeScript → Hermes JSI → C++ → Rust`。
- Rust 源码位于 `packages/swarmnote-core/rust/mobile-core/`。
- `src/generated/` 和 `cpp/generated/` 都是 `ubrn` 自动生成产物，**不要手改**。
- 修改 Rust 代码后，需要重新执行 `pnpm --filter react-native-swarmnote-core ubrn:android` 或 `ubrn:ios`，然后重新跑 Expo development build。

### Monorepo package boundaries

`pnpm-workspace.yaml` 包含 2 个工作区包：

- `react-native-swarmnote-core` — Rust bridge / native module
- `@swarmnote/editor-web` — WebView bundle and RPC host

平台无关的 `@swarmnote/editor-core` 是**独立 sibling 仓** `swarm-apps/swarmnote-editor` 内的 monorepo 包，本地通过 `pnpm.overrides` link 到 `../swarmnote-editor/packages/editor-core`。Metro 通过 `watchFolders` + `extraNodeModules` 直接解析。

改动时优先保持边界清晰，不要把平台相关代码泄漏到共享层。

### Sibling 仓 `swarmnote-editor` (含 `@swarmnote/editor-core`)

`@swarmnote/editor-core` 住在独立 GitHub 仓库 `swarm-apps/swarmnote-editor`（pnpm workspace monorepo），与本仓和桌面端 SwarmNote 平行。本地接入方式：

- 把 sibling 仓 clone 到与本仓**同级**的 `../swarmnote-editor/`
- 在 sibling 仓跑 `pnpm install && pnpm -r build` 产出 `packages/editor-core/dist/`
- 本仓 root `package.json` 的 `pnpm.overrides.@swarmnote/editor-core` 已记录 `link:../swarmnote-editor/packages/editor-core`，`pnpm install` 会自动落 symlink 到 `node_modules/@swarmnote/editor-core` 和 `packages/editor-web/node_modules/@swarmnote/editor-core`
- Metro `watchFolders` 包含 sibling editor-core 路径（可由 `EDITOR_CORE_LOCAL_PATH` 环境变量覆盖）

**修改编辑器核心代码的流程**：

```bash
# 1. 在 sibling 仓修改、commit、push、开 PR
cd ../swarmnote-editor
git checkout -b feat/...
# ... edit packages/editor-core/src/* ...
git commit -m "feat: ..."
git push origin feat/...
# 在 GitHub 开 PR 到 main，CI 通过后合并

# 2. 在 sibling 仓重 build dist（推荐 watch 模式）
pnpm --filter @swarmnote/editor-core dev

# 3. 回本仓重建 WebView bundle
cd ../SwarmNote-RN
pnpm --filter @swarmnote/editor-web build
```

**关键注意事项**：

- editor-core 是独立仓库，在那里的 commit **不会**出现在本仓 git history；它在本仓只是 `pnpm.overrides` 一条 link 配置
- 本仓不再包含 `packages/editor/` 子目录，也不需要 `git submodule` 任何操作
- 拉取最新 editor-core：`(cd ../swarmnote-editor && git pull && pnpm -r build)`
- 不在本仓直接修改 `node_modules/@swarmnote/editor-core/` 内文件——它是 symlink 指向 sibling 仓，会污染 sibling working tree

## Documentation Conventions

- `dev-notes/` 下生成的文档（blog、design 等）中，所有图表统一使用 **Mermaid** 语法（` ```mermaid `），不要用 ASCII art。
- Mermaid 适用于流程图、时序图、架构图、状态机等所有可视化场景。
- 此规则仅限写入文件的文档，对话中可以使用 ASCII art。
- Mermaid 节点文本中**不支持 Markdown 列表语法**：数字加点加空格（如 `1.` + 空格）或短横加空格（如 `-` + 空格）会被误解析。解决方法是去掉空格，写成 `1.内容` 而非 `1.` + 空格 + `内容`。

## Repository Conventions

- TypeScript strict mode，路径别名 `@/* -> src/*`。
- `tsconfig.json` 使用 `moduleSuffixes: [".native", ""]`，这是为 `react-native-css` 类型解析服务的，不要删。
- 样式优先使用 NativeWind `className`；不要用 `StyleSheet.create` 去维护主题色，不要硬编码颜色。
- UI 组件优先使用 `src/components/ui/` 下的 React Native Reusables 组件；通过 CLI 添加，不直接修改这些生成组件源码。
- RNR 浮层组件依赖根布局里的 `<PortalHost />`；如果浮层显示异常，先检查 `_layout.tsx`。
- toast 反馈统一通过 `@/lib/toast` 调用（`toast.success / error / info / promise`），禁止直接 `import` `sonner-native`；详细政策见 `dev-notes/knowledge/feedback-and-toast.md`。
- commit message 使用 Conventional Commits；仓库通过 Lefthook + commitlint 校验。
- 包管理固定使用 `pnpm`。

## Critical Notes

- **不支持 Expo Go**：仓库依赖原生模块，必须使用 development build。
- **`.npmrc` 中 `node-linker=hoisted` 不能删**：Metro 不兼容 pnpm 默认的 symlink node_modules 布局。
- **`lightningcss` 必须锁定为 `1.30.1`**：否则 `src/global.css` 可能出现反序列化错误。
- **改 `src/global.css` 后必须 `npx expo start --clear`**。
- **改编辑器包后必须重建 `@swarmnote/editor-web` bundle**；如果改的是 sibling 仓 editor-core，还要先在 sibling 仓重 build editor-core dist。
- **不要手改生成代码**：尤其是 `packages/swarmnote-core/src/generated/` 和 `packages/swarmnote-core/cpp/generated/`。

## Project Knowledge Sources

优先查项目知识库，而不是只凭目录猜测：

- `dev-notes/knowledge/theme-and-styling.md`
- `dev-notes/knowledge/editor.md`
- `dev-notes/knowledge/editor-toolbar.md`
- `dev-notes/knowledge/editor-core-abstractions.md`
- `dev-notes/knowledge/rust-bridge.md`
- `dev-notes/knowledge/ubrn.md`
- `dev-notes/knowledge/toolchain.md`
- `dev-notes/knowledge/sync.md`
- `dev-notes/knowledge/files-panel.md`
- `dev-notes/knowledge/i18n.md`
- `dev-notes/knowledge/auto-update.md`
- `dev-notes/knowledge/feedback-and-toast.md`

设计稿位于 `dev-notes/design/mobile-design.pen`，需要通过 Pencil MCP 工具读取和修改，不要用普通文件读取工具解析 `.pen`。
