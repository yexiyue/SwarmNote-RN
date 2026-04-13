# 主题与样式

## NativeWind v5 配置

### CSS-first 配置（无 tailwind.config.js）

NativeWind v5 使用 Tailwind CSS v4，采用 CSS-first 配置，不需要 `tailwind.config.js`。

**正确做法**：
- `global.css` 中用 `@import "tailwindcss/theme.css" layer(theme)` + `@import "nativewind/theme"` + `@theme inline` 注册类名
- `postcss.config.mjs` 使用 `@tailwindcss/postcss` 插件
- `metro.config.js` 使用 `withNativewind(config)` 无需传参数

**不要做**：
- 不要创建 `tailwind.config.js`（v4 的事）
- 不要在 babel.config.js 中加 `nativewind/babel`（v5 Metro 自动注入）
- 不要用 `@tailwind base/components/utilities`（v4 指令，v5 用 `@import`）

**相关文件**：`src/global.css`、`postcss.config.mjs`、`metro.config.js`、`babel.config.js`

### 暗色模式选择器

v5 使用标准 `@media` 查询，不是 v4 的 `.dark\:root`。

**正确做法**：
```css
@custom-variant dark (@media (prefers-color-scheme: dark));

:root { /* 亮色变量 */ }

@media (prefers-color-scheme: dark) {
  :root { /* 暗色变量 */ }
}
```

**不要做**：
- 不要用 `.dark\:root`（v4 NativeWind 约定，v5 已弃用）
- 不要用 `.dark`（从未被 NativeWind 支持）

### lightningcss 版本锁定

不锁定版本会导致 `global.css` 反序列化错误。

**正确做法**：
```json
{ "pnpm": { "overrides": { "lightningcss": "1.30.1" } } }
```

**相关文件**：`package.json`

## useColorScheme 与主题切换

### useColorScheme 来源

NativeWind v5 废弃了自己的 `useColorScheme`，回到 React Native 原生 API。

**正确做法**：
```typescript
import { useColorScheme, Appearance } from "react-native";

const colorScheme = useColorScheme();            // 读取
Appearance.setColorScheme("dark");                // 设为深色
Appearance.setColorScheme("light");               // 设为浅色
Appearance.setColorScheme("unspecified");          // 跟随系统
```

**不要做**：
- 不要从 `nativewind` 导入 `useColorScheme`（v5 已废弃）
- 不要用 `colorScheme.set()`（v4 API）
- 不要传 `null` 给 `Appearance.setColorScheme()`（Android RN 0.83+ 会崩溃，用 `"unspecified"`）

### useThemeColors — JS 侧读取 CSS 变量

需要 JS 颜色值时（图标 color prop、React Navigation ThemeProvider），使用 `useThemeColors()` hook 动态读取 CSS 变量，不需要手动维护 `theme.ts` 镜像。

**正确做法**：
```typescript
import { useThemeColors, useNavTheme } from "@/hooks/useThemeColors";

// 组件中获取颜色值
const colors = useThemeColors();
<SomeIcon color={colors.foreground} />

// 根布局中获取 Navigation Theme
const navTheme = useNavTheme();
<ThemeProvider value={navTheme}>
```

**不要做**：
- 不要创建 `theme.ts` 手动镜像 CSS 变量值（已删除，改用动态读取）
- 不要硬编码颜色 hex 值

**相关文件**：`src/hooks/useThemeColors.ts`

### TypeScript .native.ts 类型解析

`react-native-css` 的类型定义分 web 和 native 两套。TypeScript 默认解析到 web 版（`() => never`），需要配置 `moduleSuffixes` 让 tsc 优先解析 `.native.d.ts`。

**正确做法**：
```json
// tsconfig.json
{ "compilerOptions": { "moduleSuffixes": [".native", ""] } }
```

**根因**：Metro 通过 `.native.ts` 后缀约定选择平台文件，但 tsc 不认识这个约定。`moduleSuffixes` 让 tsc 在解析 `runtime` 时先找 `runtime.native.d.ts`。

**相关文件**：`tsconfig.json`

## 品牌配色（蜂巢纸笺）

### 配色方案

暖灰纸质感 + 琥珀金强调色，设计稿见 `dev-notes/design/theme-palette.md`。

**要点**：
- 亮色背景不是纯白，是暖白 `40 18% 99%`（极微弱的黄棕色调）
- 文本不是纯黑，是暖近黑 `28 10% 14%`
- primary 是琥珀金 `40 72% 46%`（亮色）/ `40 72% 52%`（暗色加亮）
- 暗色背景是暖深灰 `25 6% 10%`（非纯黑，保留温度）
- 所有灰色都带暖色调（hue 20-40）

### 修改主题色

只需改 `src/global.css` 中的 CSS 变量值。JS 侧通过 `useThemeColors()` 动态读取，无需手动同步任何 JS 文件。

## RNR 组件

### 使用规范

- 通过 CLI 添加：`pnpm dlx @react-native-reusables/cli@latest add <name>`
- 不直接修改 `src/components/ui/` 下的源码
- 如需定制，在外层包装
- RNR 组件 lint 报的 info 级别提示（如 `noUselessFragments`）可忽略，不改源码

### 已知问题

- `sheet` 组件在 RNR registry 中不存在（截至 2026-04-13）
- RNR CLI 会提示 "Tailwind config not found" 警告，v5 不需要 tailwind.config.js，忽略即可
- `components.json` 中 `tailwind.config` 字段为空字符串（v5 不需要）

### 浮层组件依赖

Dialog、AlertDialog、Popover、Tooltip、DropdownMenu、Select 等浮层组件依赖 `<PortalHost />`，已在根布局 `_layout.tsx` 配置。
