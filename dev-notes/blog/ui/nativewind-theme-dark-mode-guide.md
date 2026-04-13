# NativeWind v5 主题系统与暗色模式完全指南

> 基于 NativeWind v5（Tailwind CSS v4）官方文档的主题系统调研，涵盖安装配置、CSS-first 主题定义、暗色模式切换、用户偏好持久化的完整指南。

## 前置条件

- React Native 0.81+（v5 依赖新架构的 StyleSheet 改进）
- React Native Reanimated v4+
- Expo SDK 54+（推荐 55）

## 安装

```bash
# 安装 NativeWind v5 和运行时依赖
npx expo install nativewind@preview react-native-css react-native-reanimated react-native-safe-area-context

# 安装 Tailwind CSS v4 和 PostCSS（开发依赖）
npx expo install --dev tailwindcss @tailwindcss/postcss postcss
```

### 锁定 lightningcss 版本

在 `package.json` 中强制指定 lightningcss 版本，否则可能遇到 `global.css` 反序列化错误：

```json
{
  "pnpm": {
    "overrides": {
      "lightningcss": "1.30.1"
    }
  }
}
```

> 如果用 npm/yarn，对应的字段是 `"overrides"` 或 `"resolutions"`。

## 配置文件

### 文件结构总览

```
项目根目录/
├── src/global.css          # 唯一真相源：主题定义 + Tailwind 类注册
├── postcss.config.mjs      # PostCSS 配置（新增）
├── metro.config.js         # Metro 配置（简化）
├── babel.config.js         # Babel 配置（移除 nativewind 相关）
└── src/lib/theme.ts        # JS 镜像（React Navigation 需要）
```

不再需要 `tailwind.config.js`。

### postcss.config.mjs

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

### metro.config.js

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config);
```

**v4 → v5 变化**：不再需要传入第二个参数 `{ input: "./global.css" }`，函数名也从 `withNativeWind` 改为 `withNativewind`（小写 w，两者都能用）。

### babel.config.js

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // v5 不需要 nativewind/babel，Metro 自动注入
  };
};
```

**v4 → v5 变化**：移除 `["babel-preset-expo", { jsxImportSource: "nativewind" }]` 和 `"nativewind/babel"` preset。

## global.css — 唯一真相源

这是 v5 最大的变化：`global.css` 同时承担**主题变量定义**和 **Tailwind 类名注册**的职责，取代了 v4 的 `tailwind.config.js`。

### 基础结构

```css
/* 1. 导入 Tailwind CSS v4 层和 NativeWind 主题 */
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

@import "nativewind/theme";

/* 2. 通过 @theme 注册自定义设计变量为 Tailwind 工具类 */
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  /* ... */
}

/* 3. 声明暗色模式的 custom variant */
@custom-variant dark (@media (prefers-color-scheme: dark));

/* 4. 亮色模式变量值 */
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  /* ... */
}

/* 5. 暗色模式变量值 */
@media (prefers-color-scheme: dark) {
  :root {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    /* ... */
  }
}
```

### 各部分详解

**导入语句**（替代 v4 的 `@tailwind base/components/utilities`）：

```css
@import "tailwindcss/theme.css" layer(theme);   /* Tailwind 默认主题变量 */
@import "tailwindcss/preflight.css" layer(base); /* CSS 重置 */
@import "tailwindcss/utilities.css";             /* 工具类 */
@import "nativewind/theme";                      /* NativeWind 扩展：elevation、平台字体、平台 variant 等 */
```

`nativewind/theme` 提供的能力：
- Elevation 阶梯（`elevation-xs` 到 `elevation-2xl`）
- 平台字体（iOS: System/Georgia/Menlo, Android: 系统默认）
- 平台 variant（`ios:`、`android:`、`native:`、`web:`、`tv:`）
- 自定义工具类（`elevation-*`、`tint-*`、`ripple-*`、`corner-*`、`color-*`）
- Safe area 工具类

**`@theme inline`**（替代 v4 的 `tailwind.config.js` colors 映射）：

```css
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
}
```

- `--color-*` 前缀会自动注册为 `bg-*`、`text-*`、`border-*` 等工具类
- `inline` 关键字表示把值内联到样式中（性能更好，NativeWind 推荐）
- 同理，`--radius-*` 注册为 `rounded-*`，`--spacing-*` 注册为 `p-*`/`m-*` 等

**`@custom-variant dark`**（替代 v4 的 `.dark\:root`）：

```css
@custom-variant dark (@media (prefers-color-scheme: dark));
```

这使得 `dark:` 前缀映射到 `prefers-color-scheme: dark` 媒体查询。

**CSS 变量值定义**（`:root` 和 `@media`）：

```css
:root {
  --background: 0 0% 100%;    /* HSL 三个数字，不含 hsl() */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 0 0% 3.9%;
  }
}
```

与 v4 的 `.dark\:root` 不同，v5 使用标准的 `@media (prefers-color-scheme: dark)` 查询。

### 内容源检测

Tailwind CSS v4 自动检测源文件，通常不需要配置。如果需要显式指定：

```css
@source "../components/**/*.tsx";
@source "../shared-lib/**/*.ts";
```

### 添加自定义设计变量

通过 `@theme` 添加自定义颜色、间距等：

```css
@theme {
  --color-brand: #3b82f6;
  --color-brand-light: #93c5fd;
  --font-display: "CustomFont";
  --spacing-18: 4.5rem;
}
```

这些会自动变成工具类：`text-brand`、`bg-brand-light`、`font-display`、`p-18` 等。

### 自定义工具类

```css
@utility my-shadow {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

使用：`className="my-shadow"`。

## theme.ts — JS 镜像

React Navigation 的 `ThemeProvider` 需要 JS 颜色对象，因此仍需要一个 `theme.ts` 文件镜像 CSS 变量的值。

```typescript
import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

export const THEME = {
  light: {
    background: "hsl(0 0% 100%)",
    foreground: "hsl(0 0% 3.9%)",
    primary: "hsl(0 0% 9%)",
    // ... 与 global.css :root 一一对应
  },
  dark: {
    background: "hsl(0 0% 3.9%)",
    foreground: "hsl(0 0% 98%)",
    primary: "hsl(0 0% 98%)",
    // ... 与 global.css @media dark 一一对应
  },
};

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
```

**修改主题色时**：改 `global.css` → 同步更新 `theme.ts`。两个文件的值必须一致。

### 未来替代方案：useUnstableNativeVariable

v5 提供了 `useUnstableNativeVariable()` 可动态读取 CSS 变量值，理论上可以替代手动镜像：

```typescript
import { useUnstableNativeVariable } from "nativewind";

function useThemeColors() {
  const background = useUnstableNativeVariable("--background");
  const foreground = useUnstableNativeVariable("--foreground");
  // 从 CSS 变量动态读取，不需要手动同步
}
```

但 API 名字带 `Unstable`，说明尚未稳定，目前建议仍保留 `theme.ts` 手动镜像。

## 暗色模式

### 系统偏好（自动）

默认行为：`dark:` variant 自动响应系统暗色模式，无需额外配置。

```tsx
import { View, Text } from "react-native";

function Card() {
  return (
    <View className="bg-white dark:bg-gray-900">
      <Text className="text-black dark:text-white">
        自动跟随系统主题
      </Text>
    </View>
  );
}
```

底层原理：`dark:` 映射到 `@media (prefers-color-scheme: dark)`，在原生端和 Web 端都是响应式的。

### 手动切换（用户控制）

使用 React Native 原生的 `Appearance` API：

```typescript
import { useColorScheme, Appearance, Pressable, Text } from "react-native";

function ThemeToggle() {
  const colorScheme = useColorScheme();
  // colorScheme: "light" | "dark" | null

  const setColorScheme = (scheme: "light" | "dark" | null) => {
    Appearance.setColorScheme(scheme);
    // null = 跟随系统
  };

  const toggleColorScheme = () => {
    Appearance.setColorScheme(
      Appearance.getColorScheme() === "dark" ? "light" : "dark"
    );
  };

  return (
    <Pressable onPress={toggleColorScheme} className="p-4 bg-gray-200 dark:bg-gray-800">
      <Text className="text-black dark:text-white">
        当前: {colorScheme}
      </Text>
    </Pressable>
  );
}
```

**重要**：v5 废弃了 `nativewind` 导出的 `useColorScheme`，改用 `react-native` 原生的：

```typescript
// ❌ v4 写法（v5 已废弃）
import { useColorScheme } from "nativewind";
const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();

// ✅ v5 写法
import { useColorScheme, Appearance } from "react-native";
const colorScheme = useColorScheme();              // 读取
Appearance.setColorScheme("dark");                  // 设为深色
Appearance.setColorScheme("light");                 // 设为浅色
Appearance.setColorScheme(null);                    // 跟随系统
```

### 最佳实践

始终同时提供 light 和 dark 两种样式。React Native 在动态切换时，如果只有一侧的样式定义，可能会出现问题：

```tsx
{/* ✅ 始终指定两个 variant */}
<Text className="text-black dark:text-white" />

{/* ❌ 可能出问题 */}
<Text className="dark:text-white" />
```

### 根布局中的用法

```tsx
// src/app/_layout.tsx
import "../global.css";

import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { NAV_THEME } from "@/lib/theme";

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? "light";

  return (
    <ThemeProvider value={NAV_THEME[colorScheme]}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack />
      <PortalHost />
    </ThemeProvider>
  );
}
```

## 主题持久化

NativeWind 本身不提供持久化，需要自行实现。

### AsyncStorage 方案

```typescript
// src/lib/theme-persistence.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "theme-preference";

export async function restoreThemePreference() {
  try {
    const saved = await AsyncStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") {
      Appearance.setColorScheme(saved);
    }
    // "system" 或 null → 不调用 setColorScheme，保持跟随系统
  } catch (e) {
    // 忽略错误，使用系统默认
  }
}

export async function saveThemePreference(preference: ThemePreference) {
  await AsyncStorage.setItem(THEME_KEY, preference);
  Appearance.setColorScheme(preference === "system" ? null : preference);
}
```

### 配合 SplashScreen 避免闪烁

AsyncStorage 是异步的，启动时可能先渲染默认主题再切换。用 SplashScreen 遮盖：

```tsx
// src/app/_layout.tsx
import "../global.css";

import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { NAV_THEME } from "@/lib/theme";
import { restoreThemePreference } from "@/lib/theme-persistence";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    restoreThemePreference().then(() => {
      setThemeLoaded(true);
      SplashScreen.hideAsync();
    });
  }, []);

  if (!themeLoaded) return null;

  return (
    <ThemeProvider value={NAV_THEME[colorScheme]}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack />
      <PortalHost />
    </ThemeProvider>
  );
}
```

### MMKV 方案（高性能替代）

如果对启动闪烁零容忍，可用 MMKV（同步读写）：

```typescript
import { MMKV } from "react-native-mmkv";
import { Appearance } from "react-native";

const storage = new MMKV();
const THEME_KEY = "theme-preference";

// 同步恢复，无闪烁
export function restoreThemePreference() {
  const saved = storage.getString(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    Appearance.setColorScheme(saved);
  }
}

export function saveThemePreference(preference: "system" | "light" | "dark") {
  storage.set(THEME_KEY, preference);
  Appearance.setColorScheme(preference === "system" ? null : preference);
}
```

MMKV 方案可以在入口文件中同步调用，无需 SplashScreen 配合：

```typescript
// index.ts
import { restoreThemePreference } from "./src/lib/theme-persistence";
restoreThemePreference(); // 同步，首帧即正确
import "expo-router/entry";
```

## 动态主题（运行时切换）

v5 通过 CSS 变量 + `VariableContextProvider` 支持运行时动态主题。

### vars() — 通过 style prop 注入变量

```tsx
import { View, Text } from "react-native";
import { vars } from "nativewind";

function ThemedSection({ brandColor }) {
  return (
    <View style={vars({ "--brand-color": brandColor })}>
      <Text className="text-[--brand-color]">主题化文字</Text>
    </View>
  );
}
```

`vars()` 返回的是 style 对象，可以和其他样式组合：

```tsx
<View style={[{ padding: 16 }, vars({ "--accent": "blue" })]} />
```

### VariableContextProvider — 通过 React Context 注入

适用于变量需要穿透非直接样式后代的场景：

```tsx
import { VariableContextProvider } from "nativewind";

function App() {
  return (
    <VariableContextProvider variables={{ "--theme-color": "#3b82f6" }}>
      <Text className="text-[--theme-color]">蓝色文字</Text>
    </VariableContextProvider>
  );
}
```

### 多主题 + 亮暗色模式

```tsx
import { vars } from "nativewind";
import { useColorScheme } from "react-native";

const themes = {
  brand: {
    light: vars({ "--color-primary": "black", "--color-secondary": "white" }),
    dark: vars({ "--color-primary": "white", "--color-secondary": "black" }),
  },
  christmas: {
    light: vars({ "--color-primary": "red", "--color-secondary": "green" }),
    dark: vars({ "--color-primary": "green", "--color-secondary": "red" }),
  },
};

function ThemeProvider({ name, children }) {
  const colorScheme = useColorScheme() ?? "light";
  return (
    <View style={themes[name][colorScheme]}>
      {children}
    </View>
  );
}
```

## 从 v4 迁移检查清单

| 步骤 | 操作 |
| ---- | ---- |
| 1 | `npx expo install nativewind@preview react-native-css` + devDeps |
| 2 | 重写 `global.css`：`@import` 替代 `@tailwind`，加 `@theme inline`，`.dark\:root` → `@media` |
| 3 | `babel.config.js`：移除 `nativewind/babel` 和 `jsxImportSource` |
| 4 | 新建 `postcss.config.mjs` |
| 5 | `metro.config.js`：简化 `withNativewind(config)`，删除第二参数 |
| 6 | 删除 `tailwind.config.js`（或保留用 `@config` 引用，高级场景） |
| 7 | `package.json`：overrides 锁定 `lightningcss: "1.30.1"` |
| 8 | 所有 `useColorScheme` 导入从 `nativewind` 改为 `react-native` |
| 9 | `colorScheme.set()` → `Appearance.setColorScheme()` |
| 10 | `npx expo start --clear` 清除缓存 |

## 样式使用规范

### 正确做法

```tsx
// 语义颜色（通过 CSS 变量，自动响应暗色模式）
<Text className="text-foreground">主文本</Text>
<View className="bg-background">页面背景</View>
<Pressable className="bg-primary">
  <Text className="text-primary-foreground">按钮</Text>
</Pressable>

// dark: variant（直接指定两套颜色）
<Text className="text-black dark:text-white">手动指定</Text>

// 两种方式可以混用，语义颜色优先
```

### 反模式

```tsx
// ❌ StyleSheet.create 硬编码颜色
const styles = StyleSheet.create({ bg: { backgroundColor: "#ffffff" } });

// ❌ 硬编码 hex 值
<View style={{ backgroundColor: "#f0f0f0" }} />

// ❌ 从 nativewind 导入 useColorScheme（v5 已废弃）
import { useColorScheme } from "nativewind";

// ❌ 只指定一侧 variant（可能导致切换异常）
<Text className="dark:text-white" />   // 缺少 light 侧
```

### 需要 JS 颜色值的场景

部分第三方库（如图标组件）需要 JS 颜色值，使用 `THEME` 对象：

```tsx
import { useColorScheme } from "react-native";
import { THEME } from "@/lib/theme";

function MyIcon() {
  const colorScheme = useColorScheme() ?? "light";
  return <SomeIcon color={THEME[colorScheme].foreground} />;
}
```

或使用 `useUnstableNativeVariable`（实验性）：

```tsx
import { useUnstableNativeVariable } from "nativewind";

function MyIcon() {
  const color = useUnstableNativeVariable("--foreground");
  return <SomeIcon color={color} />;
}
```

## 常见问题

### Q: 改了 global.css 但没有生效？

清除 Metro 缓存：

```bash
npx expo start --clear
```

### Q: 遇到 lightningcss 反序列化错误？

锁定 lightningcss 版本：

```json
{ "pnpm": { "overrides": { "lightningcss": "1.30.1" } } }
```

### Q: `@theme` 和 `@theme inline` 有什么区别？

- `@theme { ... }`：值作为 CSS 变量保留，运行时可读取和覆盖
- `@theme inline { ... }`：值内联到样式中，性能更好但不可运行时覆盖

NativeWind 推荐用 `inline` 以获得更好的原生端性能。如果需要运行时动态切换（通过 `VariableContextProvider`），则用不带 `inline` 的 `@theme`。

### Q: 为什么 `dark:` variant 需要 `@custom-variant`？

Tailwind CSS v4 的 `dark:` 默认行为可能因配置不同而异。显式声明确保在 NativeWind 中始终映射到 `prefers-color-scheme: dark`：

```css
@custom-variant dark (@media (prefers-color-scheme: dark));
```

### Q: v5 是否稳定可用于生产？

截至 2026-04-13，v5 仍处于 preview 阶段（5.0.0-preview.3），官方明确标注 "not intended for production use"。但对于早期项目或非关键应用，已经可以使用。

### Q: React Native Reusables 与 v5 兼容吗？

RNR 组件是 copy-paste 源码模式，理论上可以直接使用。社区已有 RN 0.81+ New Arch + NativeWind v5 + RNR 的成功案例。如果遇到类名不生成的问题，可以用 `@theme inline` 强制内联。

## 参考链接

- [NativeWind v5 Overview](https://www.nativewind.dev/v5)
- [NativeWind v5 Installation](https://www.nativewind.dev/v5/getting-started/installation)
- [Migrate from v4](https://www.nativewind.dev/v5/guides/migrate-from-v4)
- [Dark Mode](https://www.nativewind.dev/v5/core-concepts/dark-mode)
- [Configuration](https://www.nativewind.dev/v5/customization/configuration)
- [Theme](https://www.nativewind.dev/v5/customization/theme)
- [Dynamic Themes](https://www.nativewind.dev/v5/guides/themes)
- [useColorScheme (Deprecated)](https://www.nativewind.dev/v5/api/use-color-scheme)
- [vars() & useUnstableNativeVariable()](https://www.nativewind.dev/v5/api/vars)
- [withNativewind API](https://www.nativewind.dev/v5/api/with-nativewind)
- [RNR Installation](https://reactnativereusables.com/docs/installation/manual)
- [RNR Customization](https://reactnativereusables.com/docs/customization)
