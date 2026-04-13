# 工具链

## Biome（Lint + Format）

替代 ESLint + Prettier。配置在 `biome.json`。

**常用命令**：
- `pnpm lint` — 检查 `src/`
- `pnpm lint:ci` — CI 模式（非零退出码）
- `pnpm format` — 自动修复

**配置要点**：
- `recommended` 规则集，2 空格缩进，行宽 100
- 排除 `src/locales/**`
- `src/global.css` 关闭 `noUnknownAtRules`（Tailwind v4 指令）
- RNR 组件（`src/components/ui/`）的 info 级别提示可忽略，不改源码

## Lingui（i18n）

- 源语言：zh，翻译：en
- catalogs 在 `src/locales/`
- `pnpm lingui:extract` 提取翻译消息
- 配置文件：`lingui.config.ts`

## Expo + Metro

### 构建与启动

- `pnpm start` — 启动 Metro
- `pnpm android` — 运行 Android
- `npx expo prebuild` — 生成原生项目
- `npx expo start --clear` — 清除缓存启动（改 CSS/配置后必须）

### 不支持 Expo Go

项目使用原生模块（NativeWind、uniffi），必须用 Development Build。

### pnpm hoisted

`.npmrc` 中的 `node-linker=hoisted` 不可删除，React Native Metro 不支持 pnpm 默认的 symlink 式 node_modules。

## Git Hooks（Lefthook）

- `pre-commit`：Biome check（并行执行）
- `commit-msg`：commitlint 校验 Conventional Commits 格式

提交前建议先跑 `pnpm format`，否则 pre-commit hook 可能失败。

## Monorepo 工作区

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

三个工作区包：
- `react-native-swarmnote-core` — Rust 桥接
- `@swarmnote/editor` — 平台无关编辑器核心
- `@swarmnote/editor-web` — WebView bundle

## GitHub Actions CI

PR/push 到 main/develop 时自动跑 Biome lint + TypeScript check。

配置文件：`.github/workflows/ci.yml`
