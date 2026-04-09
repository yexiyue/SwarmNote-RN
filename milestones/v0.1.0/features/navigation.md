# 导航 + 页面框架

## 用户故事

作为用户，我希望 App 有清晰的导航结构，能快速找到各功能入口，交互符合移动端习惯。

## 依赖

- 主题 + UI 组件库（导航栏、Tab 栏需要主题色支持）

## 需求描述

设计并实现 Drawer + Tab 混合导航骨架。v0.1.0 仅搭建框架结构，各页面放占位内容，具体页面布局和交互等后续版本有实际功能时再完善。

### 导航结构

- **底部 Tab**：主导航入口（具体 Tab 项需调研主流 App 后确定）
- **侧边 Drawer**：辅助导航（工作区切换、用户信息等，具体内容待定）
- **Stack**：页面内的层级跳转（如列表 → 详情）

### 占位页面

为每个主要页面创建骨架：
- 各 Tab 对应的页面
- 设置页
- 其他必要页面

## 交互设计

- 需参考主流笔记/效率类 App（Notion、Obsidian、Bear、Craft 等）的移动端导航模式
- 具体设计方案待调研后确定
- 设计稿放置在 `design/` 目录

## 技术方案

### 前端

- 使用 Expo Router 文件路由
- Drawer：`expo-router` + `@react-navigation/drawer`
- Tab：考虑继续使用 `NativeTabs`（`expo-router/unstable-native-tabs`）或标准 Bottom Tabs
- Stack：Expo Router 默认 Stack 导航

### 路由结构（初步，待设计确认后调整）

```
src/app/
├── _layout.tsx          # 根布局（Drawer）
├── (drawer)/
│   ├── _layout.tsx      # Drawer 布局
│   ├── (tabs)/
│   │   ├── _layout.tsx  # Tab 布局
│   │   ├── index.tsx    # Tab 1
│   │   ├── ...          # 其他 Tab
│   └── settings.tsx     # 设置页
```

## 验收标准

- [ ] Drawer + Tab 导航结构搭建完成
- [ ] 左滑或按钮可打开 Drawer
- [ ] 底部 Tab 切换正常
- [ ] 各占位页面可正常访问
- [ ] 导航过渡动画流畅
- [ ] Android 模拟器/真机测试通过

## 任务拆分建议

> 此部分可留空，由 /project-plan 自动拆分为 GitHub Issues。

## 开放问题

- 底部 Tab 具体放哪些页面？需要调研主流 App 后确定
- Drawer 内放什么内容？（工作区切换、用户头像、快捷操作？）
- 是否使用 NativeTabs（iOS 原生 Tab 样式）还是标准 Bottom Tabs？
- 导航手势交互（Drawer 的滑动触发区域、Tab 切换手势）
