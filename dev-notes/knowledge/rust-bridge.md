# Rust 桥接

## 架构

通过 uniffi-bindgen-react-native 桥接 Rust 核心逻辑，作为 React Native Turbo Module。

调用链：`TypeScript → Hermes JSI → C++ → Rust`（无 JSON 序列化）

## 目录结构

```
packages/swarmnote-core/
├── ubrn.config.yaml              # uniffi-bindgen 构建配置
├── rust/mobile-core/             # Rust crate（#[uniffi::export]）
├── src/generated/                # ubrn 自动生成的 TS 绑定
├── cpp/generated/                # ubrn 自动生成的 C++ JSI 绑定
└── android/ | ios/               # 平台原生代码 + 静态库
```

## 自动生成代码

**不要做**：
- 不要手动编辑 `packages/swarmnote-core/src/generated/` 下的文件
- 不要手动编辑 `packages/swarmnote-core/cpp/generated/` 下的文件
- 这些文件由 `pnpm ubrn:android` / `pnpm ubrn:ios` 自动生成

## 编译流程

修改 `rust/` 下 Rust 代码后需重新编译：

```bash
cd packages/swarmnote-core
pnpm ubrn:android    # 或 pnpm ubrn:ios
cd ../..
npx expo run:android  # 或 run:ios
```

## Android 交叉编译 targets

首次需安装：
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## 已知问题

- 当前 `mobile-core` 是独立的最小化 crate（验证链路用），后续桌面端 `app-core` 抽离后将替换为共享 crate
- ubrn 编译 Android 产物位置可能需要手动 fix（参考 `dev-notes/blog/ubrn-android-build-gradle-fix.md`）
