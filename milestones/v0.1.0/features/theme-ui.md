# 主题 + UI 组件库

## 用户故事

作为用户，我希望 App 有统一美观的视觉风格和流畅的亮色/暗色主题切换，获得原生级的移动端体验。

## 依赖

- 无依赖（L0）

## 需求描述

为移动端独立设计主题系统（不复用桌面端主题色），建立完整的设计变量体系，引入常用 React Native Reusables 组件，确保亮色/暗色模式正常工作。

### 主题设计

- 独立定义移动端配色方案（primary、secondary、background、foreground 等）
- 亮色 + 暗色两套主题
- 与系统主题联动（跟随系统 / 手动切换）

### UI 组件引入

- 通过 RNR CLI 引入常用组件（Button、Card、Input、Dialog、Sheet、Avatar 等）
- 验证组件在自定义主题下的显示效果

## 交互设计

- 暗色/亮色模式跟随系统自动切换
- 设置页提供主题切换入口（跟随系统 / 亮色 / 暗色）

## 技术方案

### 前端

- 修改 `src/global.css` 定义新的 CSS 变量（移动端独立配色）
- 同步更新 `src/lib/theme.ts`（NAV_THEME）
- `tailwind.config.js` 通常不需要改（已映射 CSS 变量）
- 引入 RNR 组件：`pnpm dlx @react-native-reusables/cli@latest add <name>`

### 主题切换

- 使用 `useColorScheme` + AsyncStorage 持久化用户偏好
- ThemeProvider 已在根布局配置

## 验收标准

- [ ] 移动端独立配色方案定义完成（CSS 变量 + JS 镜像）
- [ ] 亮色/暗色模式切换正常，所有页面颜色一致
- [ ] 常用 RNR 组件引入并在主题下显示正确
- [ ] 主题切换可持久化（重启 App 后保持用户选择）

## 任务拆分建议

> 此部分可留空，由 /project-plan 自动拆分为 GitHub Issues。

## 开放问题

- 具体配色方案需要设计（可参考主流笔记应用如 Notion、Obsidian Mobile 的配色）
- 是否需要支持自定义主题色（v0.1.0 可先不做）
