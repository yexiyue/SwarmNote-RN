# Rust 桥接（uniffi）

## 用户故事

作为开发者，我希望在 React Native 中能调用 Rust 函数，以便后续复用桌面端的核心逻辑（数据层、P2P、CRDT）。

## 依赖

- 无依赖（L0）

## 需求描述

集成 uniffi-bindgen-react-native，验证从 React Native 调用 Rust 代码的完整链路。v0.1.0 仅验证链路通畅，不涉及复杂的业务逻辑桥接。

关键步骤：
1. 配置 Rust 工具链（Android NDK cross-compile）
2. 创建最小化 Rust crate，定义 `#[uniffi::export]` 函数
3. 配置 uniffi-bindgen-react-native 生成 TypeScript 绑定
4. 在 RN 侧调用生成的函数并验证结果
5. 确保 Android 真机/模拟器可正常运行

## 交互设计

- 无用户可见 UI（或在设置页/调试页显示 Rust 返回值作为验证）

## 技术方案

### 前端

- 调用 uniffi 生成的 TypeScript 函数
- 在某个页面展示调用结果（验证用）

### 后端（Rust）

- 创建独立 crate（如 `mobile-core`），暴露简单函数（如 `fn greet(name: String) -> String`）
- 使用 `#[uniffi::export]` 标注
- 参考：`dev-notes/blog/uniffi-bindgen-react-native-guide.md`

### 构建配置

- 配置 Android NDK 交叉编译
- Expo prebuild 集成
- CI 暂不要求（本地验证即可）

## 验收标准

- [ ] Rust crate 编译通过（Android target）
- [ ] uniffi-bindgen-react-native 成功生成 TypeScript 绑定
- [ ] RN 侧调用 Rust 函数返回正确结果
- [ ] Android 模拟器/真机上可正常运行
- [ ] 构建步骤文档化（README 或 dev-notes）

## 任务拆分建议

> 此部分可留空，由 /project-plan 自动拆分为 GitHub Issues。

## 开放问题

- iOS 环境暂不验证（开发环境为 Windows），后续在 macOS 上补充
- 桌面端 `app-core` crate 尚未抽离，v0.1.0 先用独立的最小 crate 验证
- uniffi-bindgen-react-native 版本选择（需确认与 Expo SDK 55 的兼容性）
