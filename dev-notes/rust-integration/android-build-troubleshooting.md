# Android 构建问题快速诊断指南

> uniffi-bindgen-react-native (ubrn) + Expo SDK 55 + React Native 0.83 的常见错误和解决方案

## 快速诊断流程

### 第 1 步：确认错误类型

运行 `npx expo run:android` 并查看错误信息的**第一行**：

| 第一行错误信息 | 跳转到下面的章节 |
|---|---|
| `CMake Error` 或 `Cannot find source file` | [CMake 路径错误](#cmake-路径错误) |
| `TurboModuleRegistry.getEnforcing` 或 `could not be found` | [TurboModule 找不到](#turbomodule-找不到) |
| `fatal error: SwarmnoteCoreImpl.h file not found` | [头文件搜索路径错误](#头文件搜索路径错误) |
| `duplicate class` 或 `already defined` | [重复生成的代码](#重复生成的代码) |
| `pod install` 失败（iOS） | [iOS CocoaPods 错误](#ios-cocoapods-错误) |

## 错误详解与修复

### CMake 路径错误

**症状**
```
CMake Error at CMakeLists.txt:14 (add_subdirectory):
  add_subdirectory given source ".../android/build/generated/source/codegen/jni/"
  which is not an existing directory.
```

**原因**
`package.json` 中的 `includesGeneratedCode: true` 跳过了代码生成，但 CMake 硬编码的路径期望生成的文件存在。

**修复清单**

- [ ] 打开 `packages/swarmnote-core/package.json`
- [ ] 找到 `codegenConfig` 段落
- [ ] 删除 `"includesGeneratedCode": true` 这一行
- [ ] **保留** `outputDir` 和其他配置
- [ ] 运行 `rm -rf android/build android/generated`
- [ ] 运行 `npx expo run:android`

**修复前后对比**
```json
// 修复前（有问题）
"codegenConfig": {
  "name": "SwarmnoteCoreSpec",
  "type": "modules",
  "jsSrcsDir": "src",
  "outputDir": { "android": "android/generated" },
  "includesGeneratedCode": true  // <- 删除这一行
}

// 修复后（正确）
"codegenConfig": {
  "name": "SwarmnoteCoreSpec",
  "type": "modules",
  "jsSrcsDir": "src",
  "outputDir": { "android": "android/generated" }
}
```

---

### TurboModule 找不到

**症状**
```
Crash: TurboModuleRegistry.getEnforcing('SwarmnoteCore', ...) -> 'SwarmnoteCore' could not be found
```

或应用启动时：
```
Exception: Cannot call method on undefined SwarmnoteCore module
```

或在日志中看到：
```
Cannot find TurboModule for name: SwarmnoteCore
```

**原因**
`android/build.gradle` 中的 `if (isNewArchitectureEnabled())` 条件跳过了 TurboModule 注册。在 Expo SDK 55 中，New Architecture 总是启用的，但条件检查的缓存可能导致注册代码被跳过。

**修复清单**

- [ ] 打开 `packages/swarmnote-core/android/build.gradle`
- [ ] 查找以下代码块：
  ```gradle
  if (isNewArchitectureEnabled()) {
    apply plugin: "com.facebook.react"
    react { ... }
  }
  ```
- [ ] 删除 `if (isNewArchitectureEnabled()) {` 行
- [ ] 删除对应的结尾 `}`
- [ ] 让 `apply plugin` 和 `react` 块变成无条件执行
- [ ] 运行 `rm -rf android/build .gradle`
- [ ] 运行 `npx expo run:android`

**修复前后对比**
```gradle
// 修复前（有问题）
if (isNewArchitectureEnabled()) {
  apply plugin: "com.facebook.react"
  react {
    jsEngine = "hermes"
  }
}

// 修复后（正确）
apply plugin: "com.facebook.react"
react {
  jsEngine = "hermes"
}
```

**可选：添加说明注释**
```gradle
// New Architecture is always enabled in Expo SDK 55+
apply plugin: "com.facebook.react"
react {
  jsEngine = "hermes"
}
```

---

### 头文件搜索路径错误

**症状**
```
fatal error: 'SwarmnoteCoreImpl.h' file not found
     ^
1 error generated.
```

或：
```
error: no member named '...' in namespace 'facebook::react'
```

**原因**
`react-native.config.js` 文件中的配置干扰了 ubrn 生成的 CMake 头文件搜索路径。

**修复清单**

- [ ] 检查是否存在 `packages/swarmnote-core/react-native.config.js`
- [ ] 如果存在，删除整个文件（`rm react-native.config.js`）
- [ ] 运行 `rm -rf android/build cpp/generated`
- [ ] 运行 `npx expo run:android`

**文件内容示例（应该删除）**
```javascript
// react-native.config.js - 删除这个文件！
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  dependency: {
    cxxModuleName: 'SwarmnoteCore',
    cxxModulePackageName: 'com.swarmnotecore',
  },
};
```

---

### 重复生成的代码

**症状**
```
error: duplicate class com.swarmnotecore.NativeSwarmnoteCoreSpec
```

或：
```
duplicate symbol '_ZN...' in:
    android/generated/.../SwarmnoteCoreSpec-generated.o
    android/build/generated/.../SwarmnoteCoreSpec-generated.o
```

**原因**
同一份代码在两个位置被生成和编译：
- `android/generated/` （ubrn 生成的预生成代码）
- `android/build/generated/` （构建时的 codegen 生成）

结果是链接器看到两份相同的符号。

**修复清单**

- [ ] 运行 `rm -rf packages/swarmnote-core/android/generated`
- [ ] 确认 `package.json` 中 `includesGeneratedCode` 已删除（见上文）
- [ ] 运行 `rm -rf android/build`
- [ ] 运行 `npx expo run:android`

**验证修复**
```bash
ls -la packages/swarmnote-core/android/
# 应该看不到 generated/ 目录，只有：
# - CMakeLists.txt
# - build.gradle
# - src/
```

---

### iOS CocoaPods 错误

**症状**
```
[!] CocoaPods could not find compatible versions for pod "SwarmnoteCore"
```

或：
```
error: module 'SwarmnoteCore' not found
```

或 `pod install` 挂起/循环依赖。

**原因**
`SwarmnoteCore.podspec` 中的 if/else 混合了两套依赖定义方式，导致 CocoaPods 解析混乱。

**修复清单**

- [ ] 打开 `packages/swarmnote-core/SwarmnoteCore.podspec`
- [ ] 查找以下代码块：
  ```ruby
  if respond_to?(:install_modules_dependencies)
    install_modules_dependencies(s)
  else
    # 一堆手工定义的依赖
    s.dependency "React"
    ...
  end
  ```
- [ ] 删除整个 if/else 块
- [ ] 替换为单行：`install_modules_dependencies(s)`
- [ ] 运行 `cd ../.. && npx expo prebuild --platform ios --clean`
- [ ] 运行 `npx expo run:ios`

**修复前后对比**
```ruby
# 修复前（有问题）
if respond_to?(:install_modules_dependencies)
  install_modules_dependencies(s)
else
  s.dependency "React"
  s.dependency "React-Core"
  s.dependency "glog"
  s.dependency "hermes-engine"
end

# 修复后（正确）
install_modules_dependencies(s)
```

---

## 防止修改被覆盖

### 问题
每次运行 `pnpm ubrn:android --and-generate`，ubrn 都会重新生成文件，覆盖你的修改。

### 解决方案
配置 `ubrn.config.yaml` 的 `noOverwrite` 列表：

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

**修复清单**

- [ ] 打开 `packages/swarmnote-core/ubrn.config.yaml`
- [ ] 在文件末尾添加 `noOverwrite:` 段（如上）
- [ ] 添加三个文件路径
- [ ] 运行 `pnpm install`（更新 yarn.lock）
- [ ] 运行 `pnpm ubrn:android`（验证不覆盖）

---

## 核心修复快速检查清单

在运行 `npx expo run:android` 前，确认以下清单：

### package.json
```json
✓ "codegenConfig": { ... "outputDir": { ... } }
✗ "includesGeneratedCode" 这一行已删除
```

### android/build.gradle
```gradle
✓ apply plugin: "com.facebook.react"  (无条件)
✓ react { jsEngine = "hermes" }  (无条件)
✗ if (isNewArchitectureEnabled()) { ... } 已删除
```

### SwarmnoteCore.podspec
```ruby
✓ install_modules_dependencies(s)  (单行，无 if/else)
✗ if respond_to?(:install_modules_dependencies) ... else ... end 已删除
```

### 文件清理
```bash
✓ rm -rf packages/swarmnote-core/android/generated
✓ rm -rf android/build .gradle
✓ rm packages/swarmnote-core/react-native.config.js (如果存在)
```

### ubrn.config.yaml
```yaml
✓ noOverwrite:
    - android/build.gradle
    - package.json
    - SwarmnoteCore.podspec
```

---

## 逐步重建（核弹选项）

如果上述修复都不行，完全重来：

```bash
cd packages/swarmnote-core

# 1. 清空所有生成的代码
pnpm ubrn:clean
rm -rf android/generated cpp/

# 2. 回到项目根目录清除缓存
cd ../..
rm -rf android/build .gradle node_modules/.gradle

# 3. 重新生成（一次性）
cd packages/swarmnote-core
pnpm ubrn:android

# 4. 应用三个修复（见上面的修复清单）
# - 编辑 package.json (删除 includesGeneratedCode)
# - 编辑 android/build.gradle (删除 if 条件)
# - 编辑 SwarmnoteCore.podspec (简化)

# 5. 配置 noOverwrite
# - 编辑 ubrn.config.yaml

# 6. 清除缓存并构建
cd ../..
rm -rf android/build .gradle
npx expo run:android
```

---

## 环境检查

如果问题仍然存在，验证开发环境：

```bash
# 检查 Node 和 pnpm 版本
node -v          # 应该 >= 22
pnpm -v          # 应该 >= 10

# 检查 Expo 和 React Native 版本
grep -A1 '"expo"' package.json       # 应该 >= 55
grep -A1 '"react-native"' package.json  # 应该 >= 0.83

# 检查 Rust 工具链
rustc --version  # 任何最近的版本都可以

# 检查 Android NDK
echo $ANDROID_NDK_HOME  # 应该指向 NDK 安装目录
```

如果版本不匹配，需要升级相应工具。

---

## 获取帮助

如果以上都不行：

1. 检查 `npx expo run:android` 的完整输出（往上看，第一个错误通常是根因）
2. 查看 GitHub issues：
   - [ubrn#161](https://github.com/jhugman/uniffi-bindgen-react-native/issues/161)
   - [ubrn#295](https://github.com/jhugman/uniffi-bindgen-react-native/issues/295)
   - [builder-bob#647](https://github.com/callstack/react-native-builder-bob/issues/647)
3. 参考完整教程：[Rust + React Native (Expo) 集成之旅](../blog/ubrn-android-build-gradle-fix.md)

---

**最后更新**：2025 年 4 月  
**适用版本**：ubrn 0.31.0-2, Expo SDK 55, RN 0.83
