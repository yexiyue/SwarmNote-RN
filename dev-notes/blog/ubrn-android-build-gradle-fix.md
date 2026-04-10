---
title: "Rust + React Native (Expo) 集成之旅：uniffi-bindgen-react-native 的三大坑"
date: 2025-04-10
excerpt: "从零开始整合 Rust 核心逻辑与 Expo 55 移动应用，踩坑、排坑、最后豁然开朗的完整经历。"
---

# Rust + React Native (Expo) 集成之旅：uniffi-bindgen-react-native 的三大坑

你想要在 Expo 应用中调用 Rust 代码吗？听起来很酷，也很有挑战。如果你选择了 uniffi-bindgen-react-native (ubrn)，恭喜你，你踏上了一条少人走的路。

这篇文章记录了我在 SwarmNote Mobile（Expo SDK 55 + React Native 0.83）中集成 Rust 的完整历程。我会分享 ubrn 0.31.0-2 这个版本的三个致命陷阱，以及如何绕过它们。希望能帮你省掉几个小时的调试时间。

## 为什么要在 React Native 中用 Rust？

先说说动机。我们的团队构建了 SwarmNote，一个 P2P 笔记同步工具。桌面端（Tauri）已经有了完整的 Rust 核心逻辑——处理 CRDT 冲突解决、P2P 网络、本地存储。我们想把同样的能力带到移动端，而不是用 TypeScript 重写一遍这些复杂逻辑。

uniffi 就是为这个目的而生的：一次用 Rust 写，两个平台（桌面、移动）使用。不仅代码复用，而且调用是零序列化开销的——TypeScript 直接通过 JSI（JavaScript Interface）调用 C++ 桥接，C++ 桥接调用 Rust。速度快，类型安全。

听起来完美？等着，坑来了。

## 项目结构：Monorepo + Turbo Module

首先，简单了解一下我们的项目架构：

```
SwarmNote-RN/              # Expo monorepo 根目录
├── src/app/              # Expo Router 页面（TypeScript/React）
├── packages/
│   └── swarmnote-core/   # Rust 桥接库（Turbo Module，通过 create-react-native-library 创建）
│       ├── rust/mobile-core/      # Rust 源码（Cargo.toml + src/lib.rs）
│       ├── ubrn.config.yaml       # uniffi 构建配置
│       ├── android/               # 生成的 Android 模块
│       ├── ios/                   # 生成的 iOS 模块
│       ├── cpp/                   # 生成的 C++ JSI 桥接
│       ├── src/                   # 生成的 TypeScript 绑定
│       └── package.json
└── android/               # expo prebuild 生成的 Android 项目
```

关键一点：ubrn 会自动生成 `android/build.gradle`、`android/CMakeLists.txt`、iOS podspec、C++ 头文件和 TypeScript 绑定。开发者的工作是：
1. 写 Rust 代码并标上 `#[uniffi::export]`
2. 配置 `ubrn.config.yaml`
3. 运行 `ubrn build android --and-generate`（或 iOS）
4. 修复生成代码的问题（这是重点！）

## 问题 1：`includesGeneratedCode` 陷阱

### 症状

你第一次运行 `pnpm ubrn:android` 后，兴高采烈地执行 `npx expo run:android`，然后看到这个错误：

```
CMake Error at CMakeLists.txt:xxx:
  Cannot find source file: android/build/generated/source/codegen/jni/...
```

或者：

```
error: could not compile `mobile-core` (build script `build.rs` failed)
```

为什么找不到？文件明明应该在那里。

### 根因

ubrn 生成的 `packages/swarmnote-core/package.json` 中有：

```json
{
  "codegenConfig": {
    "name": "SwarmnoteCoreSpec",
    "type": "modules",
    "jsSrcsDir": "src",
    "outputDir": {
      "android": "android/generated"
    },
    "includesGeneratedCode": true
  }
}
```

看起来合理，但 `includesGeneratedCode: true` 是个陷阱。这个标记告诉 React Native 的代码生成系统："跳过代码生成，我已经提供了生成的代码"。

问题是，ubrn 的 CMakeLists.txt 并不知道你跳过了代码生成。它在 `android/build.gradle` 中硬编码了一条路径：

```cmake
# android/CMakeLists.txt 片段
set(CODEGEN_DIR "${CMAKE_CURRENT_SOURCE_DIR}/build/generated/source/codegen/jni")
# ... 稍后用 ${CODEGEN_DIR} 包含文件
```

当 `includesGeneratedCode: true` 时，RN 的 codegen 不运行，所以这个目录永远不会被创建。CMake 在查找头文件时失败了。

### 解决方案

删除 `includesGeneratedCode` 这一行，**保留** `outputDir`（builder-bob 用它来放 TypeScript 编译产物）：

```json
{
  "codegenConfig": {
    "name": "SwarmnoteCoreSpec",
    "type": "modules",
    "jsSrcsDir": "src",
    "outputDir": {
      "android": "android/generated"
    }
    // includesGeneratedCode 删除！
  }
}
```

现在代码生成会真正运行，CMake 能找到生成的头文件。

如果生成失败（比如 `outputDir` 不存在），你可能需要手工创建目录或清空缓存：

```bash
rm -rf android/build android/generated
npx expo run:android  # 重新构建
```

## 问题 2：`isNewArchitectureEnabled()` 的幻象

### 症状

构建成功了，APK 也安装了，但应用启动时：

```
Crash: TurboModuleRegistry.getEnforcing(...) 'SwarmnoteCore' could not be found
```

或者看起来找到了，但方法调用时：

```
Exception: Cannot call method on undefined SwarmnoteCore module
```

特别是当你修改了 Rust 代码重新构建时，这个问题时有时无，很诡异。

### 根因

ubrn 生成的 `android/build.gradle` 有这样的代码：

```gradle
if (isNewArchitectureEnabled()) {
  apply plugin: "com.facebook.react"
  
  react {
    jsEngine = "hermes"
  }
}
```

这是为了支持 React Native 的 New Architecture（也叫 Fabric + TurboModules）。但在 Expo SDK 55 中，New Architecture **总是打开的**，不能关闭。

问题是什么？Gradle 的条件检查有时候会被缓存。特别是：

1. 首次构建时，`isNewArchitectureEnabled()` 可能返回 false（因为某些依赖还没加载）
2. 条件成立，插件没有应用
3. TurboModule 的自动注册跳过了
4. 下次构建，缓存生效，插件应用了，但注册代码已经被跳过

结果是构建成功了，但运行时找不到模块。

### 解决方案

在 `android/build.gradle` 中，**去掉条件，让插件应用总是执行**：

```gradle
// 修改前（有问题）
if (isNewArchitectureEnabled()) {
  apply plugin: "com.facebook.react"
  
  react {
    jsEngine = "hermes"
  }
}

// 修改后（正确）
apply plugin: "com.facebook.react"

react {
  jsEngine = "hermes"
}
```

你可能会担心：如果 old architecture 呢？在 Expo 55 中不存在这个问题。New Architecture 是标准配置，不可禁用。

如果你想更安心，可以加个注释：

```gradle
// New Architecture is always enabled in Expo SDK 55+
apply plugin: "com.facebook.react"

react {
  jsEngine = "hermes"
}
```

修改后，删除缓存重新构建：

```bash
rm -rf android/build .gradle
npx expo run:android
```

## 问题 3：iOS podspec 的兼容性代码

### 症状

在 iOS 上，pod install 可能失败，或者构建成功但 module 无法导入。错误信息含糊其辞：

```
error: module 'SwarmnoteCore' not found
```

或者在 podfile.lock 中看到重复的依赖定义。

### 根因

ubrn 生成的 `SwarmnoteCore.podspec` 包含了 old architecture 的兼容代码：

```ruby
# SwarmnoteCore.podspec（有问题的版本）
if respond_to?(:install_modules_dependencies)
  install_modules_dependencies(s)
else
  # 手工定义依赖，包括 old architecture 的东西
  s.dependency "React"
  s.dependency "React-Core"
  # ... 其他依赖
end
```

这是一个 Ruby 的版本检查——如果宿主项目支持 New Architecture，就用新的注册方式；否则手工定义。

但在现代的 Expo + React Native 项目中，`install_modules_dependencies` 总是存在的。else 分支永远不执行。问题是，podspec 中混合了两套依赖定义方式，会导致 CocoaPods 解析时混淆。

### 解决方案

简化 podspec，只保留新方式：

```ruby
# SwarmnoteCore.podspec（修正版）
Pod::Spec.new do |s|
  s.name          = 'SwarmnoteCore'
  s.version       = '0.1.0'
  s.summary       = 'Rust core bindings for SwarmNote mobile'
  s.description   = 'uniffi-bindgen-react-native integration'
  
  s.authors       = { 'Your Name' => 'your@email.com' }
  s.homepage      = 'https://github.com/yexiyue/swarmnote'
  s.license       = { :type => 'MIT' }
  s.platform      = :ios, '13.0'
  
  s.source        = { :path => '.' }
  s.source_files  = 'ios/**/*.{h,m,mm,swift}'
  
  s.frameworks    = ['Foundation', 'Security']
  s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/ios/generated"',
    'GCC_PREPROCESSOR_DEFINITIONS' => 'UNIFFI_MODULE_NAME=SwarmnoteCoreUniffi'
  }
  
  # 仅使用新方式
  install_modules_dependencies(s)
end
```

删除 if/else，直接用 `install_modules_dependencies`。现代工具链总是支持这个方法。

## 终极解决方案：noOverwrite 机制

现在的问题是：每次运行 `ubrn build android --and-generate`，它都会重新生成这三个文件，覆盖你的修改。你修好了，下次构建又被打回原形。

这就是 `noOverwrite` 的用途。在 `ubrn.config.yaml` 中指定哪些文件在重新生成时不覆盖：

```yaml
rust:
  directory: ./rust/mobile-core
  manifestPath: Cargo.toml

bindings:
  cpp: cpp/generated
  ts: src/generated

noOverwrite:
  - android/build.gradle
  - package.json
  - SwarmnoteCore.podspec
```

这样，你第一次修好这三个文件后，后续的 `--and-generate` 就不会再覆盖它们。ubrn 会跳过这些文件，保留你的修改。

整个流程变成：

1. 第一次：`pnpm ubrn:android` 生成所有文件
2. 修改 `android/build.gradle`（删除 `isNewArchitectureEnabled()` 条件）
3. 修改 `package.json`（删除 `includesGeneratedCode`）
4. 修改 `SwarmnoteCore.podspec`（简化 if/else）
5. 配置 `ubrn.config.yaml` 的 `noOverwrite` 列表
6. 后续任何 `pnpm ubrn:android` 都会重新编译 Rust，但保留你修改的构建配置

## 额外问题：react-native.config.js

如果你从 create-react-native-library 的模板继承了一个 `react-native.config.js` 文件，删除它：

```javascript
// react-native.config.js（删除整个文件！）
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  // 可能还有 cxxModuleName, cxxModulePackageName 等
};
```

这个文件告诉 Metro 去寻找 C++ 模块头文件，但路径指向的是 ubrn 还没生成的位置。结果是编译时：

```
fatal error: 'SwarmnoteCoreImpl.h' file not found
```

删除这个文件，ubrn 生成的 CMake 配置会自动处理头文件搜索路径。

## 清理生成产物

如果你陷入了很深的坑，想完全重来，这个命令可以清空所有 ubrn 生成的文件：

```bash
cd packages/swarmnote-core
pnpm ubrn:clean
rm -rf android/generated cpp/
```

然后从头开始：

```bash
pnpm ubrn:android
# 修改上述三个文件
# 配置 noOverwrite
pnpm install  # 更新 package.json
```

## 完整的第一次集成步骤

假设你从头开始，这是推荐的流程：

### 1. 创建 Turbo Module 库

```bash
cd packages
npx create-react-native-library@latest swarmnote-core --languages cpp
cd swarmnote-core
```

### 2. 添加 Rust 代码

创建 `rust/mobile-core/Cargo.toml` 和 `rust/mobile-core/src/lib.rs`，标记 `#[uniffi::export]` 函数。

### 3. 首次生成

```bash
pnpm ubrn:android
```

### 4. 修复三个问题

编辑 `android/build.gradle`、`package.json`、`SwarmnoteCore.podspec`（见上文）。

### 5. 配置 noOverwrite

编辑 `ubrn.config.yaml`，添加 `noOverwrite` 列表。

### 6. 删除 react-native.config.js

```bash
rm react-native.config.js
```

### 7. 清空 Gradle 缓存

```bash
cd ../..
rm -rf android/build .gradle
npx expo prebuild --platform android --clean
npx expo run:android
```

### 8. 在 TypeScript 中调用

```typescript
// src/screens/HomeScreen.tsx
import { greet } from 'react-native-swarmnote-core';

export default function HomeScreen() {
  const message = greet('World');
  return <Text>{message}</Text>;
}
```

## 常见错误速查

| 错误 | 原因 | 修复 |
|------|------|------|
| `Cannot find source file: android/build/generated/...` | `includesGeneratedCode: true` | 删除这一行 |
| `'SwarmnoteCore' could not be found` (运行时) | `isNewArchitectureEnabled()` 条件 | 删除 if，让 plugin 总是应用 |
| `error: module 'SwarmnoteCore' not found` (iOS) | podspec 兼容性代码 | 简化为只用 `install_modules_dependencies` |
| `fatal error: SwarmnoteCoreImpl.h file not found` | `react-native.config.js` 干扰 | 删除整个文件 |
| 修改后 `--and-generate` 被覆盖 | 没有配置 `noOverwrite` | 在 `ubrn.config.yaml` 中添加 |
| `bob build` 失败，缺少 `codegenConfig.outputDir` | 删除了整个 `codegenConfig` | 保留 `outputDir`，只删除 `includesGeneratedCode` |

## 参考项目和资源

- [react-native-matrix-sdk](https://github.com/unomed-dev/react-native-matrix-sdk) — 使用 noOverwrite 的参考实现
- [fressh](https://github.com/EthanShoeDev/fressh) — Expo 54 + ubrn monorepo 示例
- [uniffi-bindgen-react-native 官方 GitHub](https://github.com/jhugman/uniffi-bindgen-react-native)

特别有帮助的 issue：
- [ubrn#161](https://github.com/jhugman/uniffi-bindgen-react-native/issues/161) — CMake 路径问题讨论
- [ubrn#295](https://github.com/jhugman/uniffi-bindgen-react-native/issues/295) — New Architecture 相关
- [builder-bob#647](https://github.com/callstack/react-native-builder-bob/issues/647) — codegenConfig 配置

## 总结

uniffi-bindgen-react-native 是一个很有前景的工具，能让你真正复用 Rust 代码。但 0.31.0-2 版本在与 Expo 55 的适配上还有粗糙之处。好消息是，这三个问题都不难修，只要知道根因就能快速解决。

关键要点：

1. **删除 `includesGeneratedCode`**，让代码生成真正运行
2. **删除 New Architecture 的条件检查**，Expo 55 总是使用 New Architecture
3. **简化 iOS podspec**，去掉过时的兼容代码
4. **配置 `noOverwrite`**，保护你的修改不被覆盖
5. **删除 `react-native.config.js`**，避免头文件搜索路径冲突

祝你的 Rust + React Native 之旅顺利。如果遇到新的问题，check 一下错误信息中的文件路径，往往能看出端倪。Happy coding!

---

**最后更新**：2025 年 4 月  
**测试环境**：React Native 0.83.4, Expo SDK 55, ubrn 0.31.0-2, Android NDK r25, iOS 14.0+

| 模板 | 特点 |
|------|------|
| `build.gradle`（Java 风格） | AGP 7.2.1，硬编码路径，条件式 codegen |
| `build.kt.gradle`（Kotlin 风格） | 读取 `package.json` 的 `outputDir`，路径更灵活 |

ubrn 通过检测项目是否使用 Kotlin 来选择模板。如果检测失败或项目在早期版本生成，就会使用旧的 `build.gradle` 模板。这个模板是基于 `create-react-native-library` 的老版本设计的，**没有跟上 React Native 0.76+ 新架构默认开启后的变化**。

核心矛盾在于：

- **RN < 0.76**：新架构是可选的，`isNewArchitectureEnabled()` 条件判断有意义
- **RN 0.76+**：新架构默认开启，`com.facebook.react` 插件需要无条件应用
- **RN 0.83**：进一步强化了 codegen 流程，库如果不正确集成就无法编译

ubrn 的 CI 兼容矩阵测试 RN 0.77.2、0.81.4 和 `latest`，但使用的是 `build.kt.gradle` 模板 + 正确的 compat fixture 配置。老的 `build.gradle` 模板实际上已经"年久失修"。

## 解决方案

最终采用的方案是：**让 RN 的 codegen 在构建时自动运行**，而不是依赖预生成的代码。

### 步骤 1：修改 `package.json` — 移除 `includesGeneratedCode` 和 `outputDir`

```json
{
  "codegenConfig": {
    "name": "SwarmnoteCoreSpec",
    "type": "modules",
    "jsSrcsDir": "src",
    "android": {
      "javaPackageName": "com.swarmnotecore"
    }
  }
}
```

这样 `com.facebook.react` 插件会在构建时自动：
1. 从 `NativeSwarmnoteCore.ts` 生成 Java Spec 类和 JNI 代码
2. 输出到 `android/build/generated/source/codegen/`（autolinking 期望的默认路径）
3. 自动将生成的源码加入编译 classpath

### 步骤 2：修改 `build.gradle` — 两处关键改动

**改动 1**：移除不存在的 `AndroidManifestNew.xml` 引用

```groovy
// 修改前
if (supportsNamespace()) {
  namespace "com.swarmnotecore"
  sourceSets {
    main {
      manifest.srcFile "src/main/AndroidManifestNew.xml"
    }
  }
}

// 修改后
if (supportsNamespace()) {
  namespace "com.swarmnotecore"
}
```

**改动 2**：移除手动添加 generated 目录到 sourceSets

```groovy
// 修改前
sourceSets {
  main {
    if (isNewArchitectureEnabled()) {
      java.srcDirs += ["generated/java", "generated/jni"]
    }
  }
}

// 修改后（留空即可，codegen 插件自动处理）
sourceSets {
  main {
  }
}
```

为什么要移除？因为移除 `includesGeneratedCode` 后，`com.facebook.react` 插件会自动运行 codegen 并将输出目录加入 classpath。如果同时保留手动添加的 `generated/java`（预生成代码），会导致**类重复定义**错误。

### 不需要 `react-native.config.js`

由于 codegen 现在写入默认路径 `build/generated/source/codegen/jni/`，autolinking 不需要 `cmakeListsPath` 覆盖，一切走默认即可。

## 方案对比

| 方案 | 做法 | 优缺点 |
|------|------|--------|
| **A: 让 codegen 自动运行**（采用） | 移除 `includesGeneratedCode`，让构建时自动生成 | 简单可靠，与 RN 生态一致，但每次构建都跑 codegen |
| B: 配置 `cmakeListsPath` | 保留预生成代码，通过 `react-native.config.js` 指定路径 | 跳过 codegen 更快，但需要额外配置且容易出错 |
| C: 全面更新 `build.gradle` | 移除旧 buildscript、无条件 apply 插件、Java 17 等 | 最彻底，但改动大，可能与 ubrn 后续更新冲突 |

方案 A 的改动最小（只改 `package.json` 的 2 个字段 + `build.gradle` 的 2 处），而且完全依赖 RN 官方的 codegen 流程，未来升级 RN 或 ubrn 时不容易出问题。

## 总结

| 问题 | 原因 | 修复 |
|------|------|------|
| CMake 找不到 codegen/jni 目录 | `includesGeneratedCode: true` 跳过 codegen，默认路径下没有文件 | 移除 `includesGeneratedCode` 和 `outputDir` |
| Kotlin 编译找不到 NativeSwarmnoteCoreSpec | 手动 sourceSets 与 codegen 插件冲突 | 移除手动 `java.srcDirs` 添加 |
| manifest 文件不存在 | 模板引用了 `AndroidManifestNew.xml` 但 ubrn 没生成 | 移除 manifest.srcFile 引用 |

**核心教训**：ubrn 的 `build.gradle` 模板是基于旧版 RN 设计的。在 RN 0.76+ 新架构时代，最安全的做法是让 `com.facebook.react` 插件全权管理 codegen 流程，而不是预生成后手动配置路径。
