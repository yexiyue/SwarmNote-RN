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

### AlertDialog / Dialog 遮罩用 inline style 设置 backgroundColor

`react-native-css`（NativeWind v5 内核）对 `bg-{color}/{alpha}` 这种**带 alpha 的颜色 className** 解析失败 —— 转 RN style 时 `backgroundColor` 字段直接丢弃。结果：`<AlertDialogOverlay>` / `<DialogOverlay>` 的 `bg-black/50` 完全不生效，弹窗时屏幕周围依然亮，没有半透明遮罩。

**症状**：

- dialog 弹起时背景没变暗（设备列表 / 其他元素清晰可见）
- dialog 自身位置不居中（看似 layout 流位置而非屏幕中心）—— 是同一个 bug 的次生现象，因为 alpha 颜色失败时整个 className 解析链可能被影响

**根因**（spike 验证 2026-04-30，参考 `openspec/changes/fix-alert-dialog-overlay/design.md`）：

| className | 实际效果 |
| --- | --- |
| `bg-black/50` | ❌ backgroundColor 不应用 |
| `bg-red-500`（不透明） | ✅ 整屏变红，正常 |
| inline `style={{backgroundColor:'rgba(0,0,0,0.5)'}}` | ✅ 50% 黑遮罩正常 |
| `absolute inset-0` / `flex items-center justify-center` | ✅ 都正常 |

**正确做法**（已落地在 [src/components/ui/alert-dialog.tsx](src/components/ui/alert-dialog.tsx) 和 [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx)）：

```tsx
<AlertDialogPrimitive.Overlay
  style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
  className="absolute bottom-0 left-0 right-0 top-0 z-50 flex items-center justify-center p-2"
/>
```

布局类（`absolute` / `flex` / `items-center` / `justify-center`）保留在 className，仅遮罩颜色用 inline style 兜底。

**不要做**：

- 不要在 className 写 `bg-black/50`、`bg-white/30`、`bg-foreground/20` 之类带 alpha 的颜色 —— 静默失效。改用 inline style 的 `rgba(...)`
- 不要因为这个 bug 就把所有 className 都搬 inline —— 布局类工作正常，搬过去等同于放弃 NativeWind 的 DX
- 不要给 `<PortalHost />` 套 absoluteFill 容器 —— spike 证明 absolute inset-0 在 Overlay 上正常撑全屏，PortalHost 不需要 wrapper

**何时可以删掉这个 workaround**：`react-native-css` 修复 alpha 颜色解析后，把 inline style 删掉、把 `bg-black/50` 加回 className。可参考 [react-native-css#234](https://github.com/nativewind/react-native-css/issues/234)（同一仓库的 SafeAreaView className 失效 issue，根因可能相关）。

**相关文件**：`src/components/ui/alert-dialog.tsx`、`src/components/ui/dialog.tsx`

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

### batch_design 常见坑

用 `batch_design` 在 .pen 文件里 insert / update 节点时踩过的雷：

**不支持的 frame 属性**：

- `effects`（drop_shadow 等）— 报 `unexpected property`；如果需要阴影效果，目前只能靠 fill + 留白硬凑层次，或者用 inspector 手动加
- `clipsContent` — 同样 unexpected property

**`fontFamily` 引用 token 会 warning**：

- `fontFamily: "$--font-primary"` / `"$--font-secondary"` 会报 `Font family '$--font-primary' is invalid`，但操作不 fail，节点照常创建
- 可以直接省略 `fontFamily` 字段让节点走默认（iOS 系统字体），或传具体字体名（"SF Pro Display" / "Inter"）

**text 节点宽度**：

- 长文本如果不写 `width: "fill_container"`，会按内容撑开到一行撑爆容器；写了 `width: "fill_container"` 才会在容器宽度内 wrap
- 中文字符行高约 22px（fontSize: 11 时），估算一行能放 ~27 字，超过会换行但可能溢出边界

**批次上限**：每次 `batch_design` **硬上限 25 ops**，超过会整块 rollback。大 frame 要拆成 2-4 批。

**返回的 binding 不跨批次**：每次 batch 结束后，`op=I(var, ...)` 的 `var` 就失效了；下一批要引用前面节点必须用它返回的真实 node id（如 `I("X2p3s", ...)`）。

**fit_content 空容器警告**：创建 `height: "fit_content"` 的容器但暂时不放 child，会 warning `will result in zero size`；只要下一批把 child 塞进去就行。

**array 类参数要传 JSON**：MCP schema 里 array 参数传字符串会报 `width must be a number` / `is not a string slice`。`find_empty_space_on_canvas` 实际用起来坏了（传 number / string 都报错），靠 `snapshot_layout` 手动看现有 frame 坐标代替。

**文件体积**：`batch_get` 整个 frame 返回 JSON 动辄 9 MB+，超过 token 上限。只用 `get_editor_state` 拿 top-level node id，用 `snapshot_layout` 拿坐标，再 `get_screenshot` 取视觉反馈，不要去 `batch_get` 整个 frame。

### 工作区管理页（2026-04-18，2026-04-19 参考 Obsidian 调整）

设计稿里的 5 个 frame 对齐桌面端 `src/routes/workspace-manager.tsx` 的功能，但做了移动端特化。二轮参照 Obsidian 移动端 vault 启动页后调整了操作路径。

**设计决策**：

- **单活动工作区模型**：同一时刻只有一个 active workspace；切换 = 卸载 + 加载。
- **存储策略一期只做 App storage**：工作区统一放 App 私有沙盒，不给"Device storage / 公共存储"选项。理由：
  - iOS 没有 Device storage 的对等语义，双端必须通过 App storage 才能统一
  - P2P 同步 + CRDT 是产品核心，**不靠文件管理器搬文件**（Obsidian 靠这个是因为没有内建 sync）
  - `.swarmnote/` CRDT 元数据放公共目录容易被用户或备份工具破坏
  - 卸载清除 = 符合移动端用户心智和隐私预期
  - P3 再考虑"导出工作区到文件夹"作为备份/分享功能
- **不做 "Open folder as workspace"**：移动端用户几乎没有现成 SwarmNote workspace 目录，从桌面端来的工作区走「从设备同步」更自然。
- **操作简化**：桌面端「新建 / 打开本地 / 同步远程」三卡简化为「新建 / 从设备同步」两项。
- **空态/有态同结构**（参照 devices 页：主操作在上、列表在下）：同一套页面布局，"添加工作区"卡片（新建 / 同步）放在顶部，"我的工作区"列表放在下方；空态时列表卡内嵌虚线空态占位（inbox icon + 「还没有工作区」+ 引导文案），不画独立 Hero 页。
- **项操作走独立子页**（对齐 Obsidian，不走 Action Sheet）：从 Populated 列表项右箭头进 Detail 页，Detail 里的「重命名」「删除」再各 push 到独立 frame。
- **无 Forget 操作**：因为没有外部 storage，「从列表移除」和「删除」等价，只保留红色的「删除工作区」。
- **删除走严肃 confirm 页**：不是 alert dialog，而是完整 frame，要求用户输入工作区名才激活删除按钮（对齐 GitHub 等危险操作的谨慎模式）。
- **Detail 页不展示原始 App storage 路径**（`/data/data/...` / iOS sandbox UUID 对用户既无意义又不可打开），改展示「存储类型」+「工作区 ID 前缀」，对齐「我的 iPhone」卡里「Peer ID: 12D3KooW…」的范式。工作区 ID 右侧放 copy 按钮，方便跨设备比对同一工作区（未来云端 issue 报障也需要这个 ID）。
- **入口**：首次启动（onboarding 完成后）自动跳 Empty；后续从 files 页底部工作区切换按钮进入 Populated。

**frame 清单**：

| Frame | ID | 用途 |
| --- | --- | --- |
| `Main: Workspace Manager` | `X2p3s` | 主页面（添加卡在上 + 工作区列表在下） |
| `Main: Workspace Manager (empty list)` | `VmEGM` | 工作区列表为空态（card 内虚线空态占位） |
| `Workspace Detail` | `RD6Zv` | 项详情（信息卡 + 同步状态 + 操作卡 3 行；信息卡里展示 存储类型 + 工作区 ID 可复制） |
| `Workspace Rename` | `6ifdA` | 重命名子页（当前名 + input + primary 保存） |
| `Workspace Delete Confirm` | `u2Dwk` | 删除确认（警示 + 损失卡 + 输入名 + 双按钮） |

**视觉风格**：对齐项目设置页（`QeN2L` / `QxzNL` / `0g67Q` / `BHpLd`）——AppBar + section label + `bg-card` 圆角卡 + 卡内 divider 分行 + 40×40 图标方块 + 琥珀金强调色。**不采用** Obsidian 扁平无 card 的列表风格。

**一期实装范围（2026-04-19，openspec change `implement-workspace-manager`）**：

已实装：

- 列表页 `src/app/settings/workspaces/index.tsx`：加载 `GlobalConfig.recent_workspaces`，空/有合一结构，"新建"可用 / "从设备同步" disabled 标"即将推出"
- 详情页 `src/app/settings/workspaces/[id].tsx`：信息卡（40×40 icon + name + meta + 工作区 ID 可复制）+ 操作卡 3 行（"打开工作区" active ；"重命名" "删除" disabled）
- 新建 sheet `src/components/workspace-create-sheet.tsx`：gorhom bottom sheet，实时校验命名冲突/非法字符，创建成功后自动切换 + `router.replace("/(main)")`
- host 层 `src/core/workspace-manager.ts` 重构：`createWorkspace(name)` / `switchWorkspace(path)` / `openLastOrDefault()`（含老版本 `${document}/default` 迁移 fallback）
- 入口：设置首页"工作区"导航行、files-panel 底部工作区 pill、`(main)` 顶部 `⋮`

未实装（UI 留位 + "即将推出" badge）：

- 重命名 / 删除工作区（Rust API 缺失）
- 从设备同步工作区（依赖 sync flow 完善）

**目录命名策略**：新建工作区目录为 `${Paths.document}/workspaces/<用户输入 name>/`；名冲突就让用户改名（不自动加后缀）。工作区 UUID（`WorkspaceInfo.id`）是 DB 生成的稳定键，和目录名解耦 —— 未来 rename 只改 DB name 字段不改目录。

**Rust 层依赖**：需要 `swarmnote-core >= 6c6803e`（develop 分支）的 `AppCore::recent_workspaces / touch_recent_workspace / remove_recent_workspace` public API。`open_workspace` 会自动 touch MRU，host 无需显式调。

**相关文件**：`dev-notes/design/mobile-design.pen`、`openspec/changes/implement-workspace-manager/`
