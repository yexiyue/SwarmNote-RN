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

### SafeAreaView 的 className 布局类不生效（v5 preview.3 已知 bug）

`react-native-safe-area-context` 的 `<SafeAreaView>` 在 NativeWind v5 preview.3 下，`className` 里的**布局类**（`flex-1` / `items-*` / `justify-*` / `gap-*` / `px-*`）**不会应用**，颜色类（`bg-*` / `text-*`）却能用。结果：页面内容塌缩在屏幕顶部，子节点互相重叠。

**症状**：
- 所有内容挤在顶部（子 View 的 `flex-1` 因父级没高度全部失效）
- 按钮、标题、图标重叠
- 但颜色（button 橙色 / 背景米白）正常

**根因**：NativeWind v5 preview 对 `SafeAreaView` 的 className→style 通道处理有 bug，相关 issue：[react-native-css#234](https://github.com/nativewind/react-native-css/issues/234)。维护者 `@danstepanov` 确认是 bug，尚未修复。

**正确做法**：把布局类从 SafeAreaView 的 `className` 搬到 inline `style`；颜色类可以留在 `className`。内层普通 `View` 的 `className="flex-1"` 等正常工作，不用改。

```tsx
<SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
  {/* 内层普通 View 的 flex-1 是生效的 */}
  <View className="flex-1 px-6 pb-6">
    ...
  </View>
</SafeAreaView>
```

**不要做**：
- 不要在 SafeAreaView 上用 `className="flex-1"` —— 不会报错，但静默失效
- 不要把 `style` 和 `className` 重复写同一属性（flex-1 + style flex:1）—— 按 `react-native-css` 语义，style 会覆盖 className
- 不要去掉 inline `style={{flex:1}}` 尝试用其他变通（如 `h-full` / 绝对定位），都解决不了本质的"SafeAreaView 自己没高度"问题

**何时可以删掉这个 workaround**：NativeWind v5 正式版发布且 issue #234 关闭后；届时全项目 grep `style={{ flex: 1 }} className="bg-background"` 改回 `className="flex-1 bg-background"`。

**相关文件**：`src/app/onboarding/*.tsx`、`src/app/(tabs)/*.tsx`、`src/app/pairing/input-code.tsx`

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

### Android TextInput 中文字符被裁切

RN `<TextInput>` 在 Android 上默认给中文 / CJK 字形加 `includeFontPadding: true`，再加上固定 `h-10` / `h-12` 容器，字形上下会被切掉（"我的 iPhone" 的"我"顶部被削）。iOS 忽略这两个 prop，不受影响。

**正确做法**（已落地在 `src/components/ui/input.tsx`）：

```tsx
<TextInput
  textAlignVertical="center"
  style={[Platform.OS === "android" && { includeFontPadding: false }, style]}
  {...props}
/>
```

**不要做**：

- 不要把 `includeFontPadding` 直接当 prop 传给 `TextInput`——RN 类型上它不是 TextInputProps 字段，只能通过 `style` 传
- 不要靠加 `py-2` 挤空间解决——不同字重 / 字号差异会再次踩到

**相关文件**：`src/components/ui/input.tsx`

### 浮层组件依赖

Dialog、AlertDialog、Popover、Tooltip、DropdownMenu、Select 等浮层组件依赖 `<PortalHost />`，已在根布局 `_layout.tsx` 配置。

## 图标库

### 统一使用 lucide-react-native

所有 lucide icon 走 `lucide-react-native`，颜色通过 `useThemeColors()` 动态读取：

```tsx
import { ArrowLeft } from "lucide-react-native";
const colors = useThemeColors();
<ArrowLeft color={colors.foreground} size={24} />
```

**不要做**：

- 不要用 emoji 做图标
- 不要用 `react-native-vector-icons` / 自己画 SVG——设计稿里所有图标名都对齐 lucide 命名
- 不要硬编码颜色 hex，用 `useThemeColors()`（例外：设计稿里明确指定的功能色如 `#4CAF50` 绿色）

### lucide-react-native 缺失图标对照

`lucide-react-native@1.8` 与 web 版 `lucide-react` **图标集不完全一致**，以下名称在 RN 版里不存在或被改名：

| 想要的图标 | 实际导出名 |
| --- | --- |
| `Github` | **不存在**，用 `Code`（设置/关于页 GitHub 链接）或直接在 SVG 资源里自定义 |
| `MoreVertical` | `EllipsisVertical` |
| `WrapText` | 不存在（语义替换：`Ruler` 用于"可读行宽"） |
| `CheckCircle2` | `BadgeCheck`（带勾选标记的徽章更贴近"已是最新"语义） |
| `Code2` | `Code` |

编码前可以 `ls node_modules/lucide-react-native/dist/esm/icons/ | grep -i <name>` 确认。

## Pager / 侧滑面板

### Obsidian 风格的 workspace ↔ files 双页用 `react-native-pager-view`

不是用 expo-router stack + `slide_from_left` 加手势层。那种方案只有"过阈值就 push"的单次动画，没有"手指跟随 + 看见另一页内容 + 松手 snap"的体验。

**正确做法**：在 `(main)/index.tsx` 顶层用 `PagerView` 承载两页，files 是 page 0、workspace 是 page 1，`initialPage={1}`。panel-left 按钮和"关闭"按钮通过 `pagerRef.current?.setPage(...)` 编程切页，左右滑由原生组件接管（iOS UIPageViewController / Android ViewPager2）。

```tsx
<PagerView ref={pagerRef} style={{ flex: 1 }} initialPage={1} offscreenPageLimit={1} overdrag>
  <View key="files" collapsable={false} style={{ flex: 1 }}>
    <FilesPanel onClose={() => pagerRef.current?.setPage(1)} />
  </View>
  <View key="workspace" collapsable={false} style={{ flex: 1 }}>
    {/* workspace content */}
  </View>
</PagerView>
```

**关键 prop 解释**：

- `collapsable={false}` 必须加在每个子 View 上，否则 Android RN 编译期会把单子 View 的容器 optimize 掉，PagerView 认不到页
- `overdrag` 在第一/最后一页允许短暂弹性拖动，跟 Obsidian 一致
- `offscreenPageLimit={1}` 保留 1 页在后台不销毁，页面状态连续
- 文件树 / 工具栏的 SafeAreaView 要放在每一页**内部**（不是 PagerView 外层），两页各自处理安全区

**为什么不能用 stack + slide_from_left + Pan**：stack 动画是 push 瞬间播一次，手势只能做"过阈值就触发"的单次动作，体验不跟手。

**note 编辑器仍走 stack push**：`router.push("/note/[id]")` 盖在整个 pager 之上，跟桌面打开笔记等价，不参与左右滑。

**添加新依赖要记得** `npx expo prebuild` + 重新 `pnpm android` / `pnpm ios`，因为 pager-view 有原生模块。

**相关文件**：`src/app/(main)/index.tsx`、`src/components/files-panel.tsx`

## Bottom Sheet

### 选用 `@gorhom/bottom-sheet@^5`

项目内所有 Obsidian 风格的底部弹起面板（命令 sheet、主题选择 sheet 等）用 `@gorhom/bottom-sheet` v5，不要再写 `react-native` `Modal` + `animationType="slide"` 那套，体验差（没有 drag handle 跟手、没有 snap、关闭只能点遮罩）。

**根布局强制要求**（[src/app/_layout.tsx](src/app/_layout.tsx)）：

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <ThemeProvider ...>
      <BottomSheetModalProvider>
        ...app tree...
      </BottomSheetModalProvider>
    </ThemeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

缺 `GestureHandlerRootView` 或 `BottomSheetModalProvider` 任一层会静默失败（sheet 根本不显示或手势无效）。

**组件封装模式**：sheet 组件用 `forwardRef` + `useImperativeHandle` 对外暴露 `{ present, dismiss }`，不要把 `open` / `onClose` 布尔 state 提到 parent，这会破坏 gorhom 的动画生命周期。消费方保持一个 `useRef<CommandSheetRef>(null)` 并 `ref.current?.present()` 触发。

**动态高度**：`enableDynamicSizing` + `<BottomSheetView>`，让 sheet 高度按内容自适应，不写死 `snapPoints`。

**主题色**：`backgroundStyle={{ backgroundColor: colors.card }}` + `handleIndicatorStyle={{ backgroundColor: colors.border }}`，走项目主题变量。

**遮罩**：`BottomSheetBackdrop` + `pressBehavior="close"` + `appearsOnIndex={0}` + `disappearsOnIndex={-1}`。

**相关文件**：`src/components/command-sheet.tsx`、`src/components/theme-picker-sheet.tsx`

## OTP / 6 位验证码输入

### 选用 `input-otp-native`

配对码输入用 [`input-otp-native`](https://github.com/yjose/input-otp-native)，headless / copy-paste 风格，样式用 NativeWind 自写。已落地在 `src/app/pairing/input-code.tsx`。

**为什么不是 `react-native-otp-entry`**：后者是成品组件，定制样式要绕 props；`input-otp-native` 源码进项目 + `render={({ slots }) => ...}` 暴露每个格子的 `char` / `isActive`，跟 shadcn 哲学一致。

**关键 prop**：

- `maxLength={6}`、`value` / `onChange` 双向绑定、`onComplete` 在用户输完 6 位时触发
- 每个 `SlotProps` 含 `char`（当前字符，空时 null）和 `isActive`（是否当前光标位 / 正在输入的格子）
- `ref` + `otpRef.current?.clear()` 用于失败时重置（配对码错误清空）

**相关文件**：`src/app/pairing/input-code.tsx`

## Pencil 设计文件

### 设计稿位置

`dev-notes/design/mobile-design.pen`，使用 Pencil MCP 工具操作。

### 主题变量

.pen 文件的主题变量已与 `src/global.css` 对齐。设置变量时每个值都必须显式带 theme 标记：

```json
{"value": "#FDFCFA", "theme": {"Mode": "Light"}}
{"value": "#1B1918", "theme": {"Mode": "Dark"}}
```

不带 theme 的值只是 fallback，不会注册到 Mode 轴，切换时不生效。

### 自定义组件

设计系统 frame `MzSDs` 中包含两个自定义可复用组件：

- `Code Pairing Card/Idle` (RbpHz) — 配对码卡片未生成状态
- `Code Pairing Card/Generated` (b5PSu) — 配对码卡片已生成状态

Pencil 不支持 Figma 式组件变体，不同状态用独立 reusable 组件 + `/` 命名分层。
