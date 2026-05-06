# 编辑器工具栏（移动端）

移动端编辑器在键盘上方常驻一行横向滚动的格式化工具栏，对齐 Obsidian 移动端体验。命令全部走 `EditorApi.execCommand` Comlink RPC，**不**修改 editor 核心 / editor-web bundle。

## 架构与文件

```
src/components/editor/
├─ MarkdownEditor.tsx              挂载 toolbar + heading sheet；持有图片 picker 处理函数
├─ EditorToolbar.tsx               单行 ScrollView + 14 个 ToolbarButton
├─ EditorHeadingSheet.tsx          gorhom BottomSheetModal — 7 个标题级别选项
├─ useEditorFormatting.ts          订阅 SelectionFormattingChange，返回 formatting state
└─ useEditorBridge.ts              Comlink endpoint（已有，未改）

src/components/
└─ bottom-command-bar.tsx          胶囊浮层（搜索/新建/命令）— 与工具栏互斥联动
```

## 键盘联动：`react-native-keyboard-controller`

工具栏的位置完全由 keyboard 高度的 sharedValue 驱动，**不**订阅 `EditorEvent.Focus/Blur`。

### `KeyboardProvider` 的位置

`src/app/_layout.tsx` 把 `KeyboardProvider` 包在 `GestureHandlerRootView` 内、`SafeAreaProvider` 外（最高层级）：

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <KeyboardProvider>
    <SafeAreaProvider>...</SafeAreaProvider>
  </KeyboardProvider>
</GestureHandlerRootView>
```

### `useReanimatedKeyboardAnimation` 联动公式

```tsx
const { height, progress } = useReanimatedKeyboardAnimation();
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: height.value + (1 - progress.value) * TOOLBAR_HEIGHT }],
}));
```

- `height.value`：键盘弹起时是负数（如 -300），收起时是 0
- `progress.value`：0 → 1 跟随键盘动画
- `(1 - progress) * TOOLBAR_HEIGHT` 在键盘收起时把 toolbar 整体下沉到屏幕外，避免常驻空 bar
- toolbar 自身 `position: absolute, bottom: 0, left: 0, right: 0`，跟随 transform 上移

### Android `softwareKeyboardLayoutMode`

`app.json` 的 `expo-build-properties` plugin 配置：

```json
"android": { "softwareKeyboardLayoutMode": "resize" }
```

不配 `resize` 在 Android 上键盘会盖住编辑器内容，CodeMirror selection 抓不到 anchor。**必须 prebuild** 才生效。

### 新增依赖必须 prebuild

接入 `react-native-keyboard-controller` + `expo-image-picker` 后必须双端 `npx expo prebuild --platform android` / `--platform ios`，再 `pnpm android` / `pnpm ios` 重编。

## 按钮态同步：`useEditorFormatting`

按钮活跃态（B/I/S/Code 5 个内联 + H 角标级别 + 列表类型）由 `EditorEventType.SelectionFormattingChange` 事件驱动：

```
CM6 selection 变化
  → editor 核心 emit SelectionFormattingChange
  → editor-runtime 通过 Comlink 转发到 RN
  → useEditorBridge → onEditorEvent
  → useEditorFormatting hook 拦截 SelectionFormattingChange → setFormatting
  → EditorToolbar 接收 formatting 重新渲染按钮 active / badge
```

### `useEditorFormatting` 是 onEditorEvent 的中间件

```tsx
const { formatting, handleEditorEvent } = useEditorFormatting(onEditorEvent);

// useEditorBridge 用 wrapped handler
useEditorBridge({ onEditorEvent: handleEditorEvent, ... });
```

hook 内部把 `SelectionFormattingChange` 抽出来 `setFormatting`，其它事件原样转发给上层 `onEditorEvent` prop。**不要**让 toolbar 自己订阅 — formatting state 与 editorApi 同生命周期，切笔记时整个 `MarkdownEditor` 重建（`key={docUuid}`），formatting 自动重置。

### 初始 formatting 默认全非活跃

`createEditor` 不会立即触发 `SelectionFormattingChange`，hook 默认值用 `DEFAULT_SELECTION_FORMATTING`，按钮全部非活跃直到首次事件到达。一帧延迟用户不可感知。

## 图片插入：单击直接打开系统相册

工具栏 📷 按钮 `onPressIn` 直接调用 `ImagePicker.launchImageLibraryAsync` — **不**经 ActionSheet 中间层。逻辑在 `MarkdownEditor.handleRequestInsertImage` 中实现，作为 prop 传给 `EditorToolbar`。

```
工具栏 📷 按钮
  → ImagePicker.launchImageLibraryAsync (mediaTypes: ['images'])
  → expo-file-system File(uri).bytes() → ArrayBuffer
  → workspace.saveMedia(noteRel, fileName, arrayBuffer): Promise<relPath>
  → editorApi.execCommand('insertImage', relPath, alt)
```

`alt` 默认取 `asset.fileName` 去扩展名（如 `IMG_1234.jpg` → `IMG_1234`），用户不需要额外输入。

### `workspace` 或 `noteRelPath` 为 null 时静默 noop

test 页面 / 编辑器尚未绑定到具体文档时，按钮单击不打开相册不抛错，等价于"未启用"。后续如果用户反馈不直观，再考虑 disabled 视觉态。

### `expo-file-system` 新 File API

```tsx
import { File } from "expo-file-system";
const file = new File(asset.uri);
const bytes = await file.bytes();  // Promise<Uint8Array>，必须 await
const arrayBuffer = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength,
) as ArrayBuffer;
```

`file.bytes()` 是 async，**必须 await**。返回的 `Uint8Array` 可能复用底层 `ArrayBuffer`（byteOffset > 0），用 `slice` 取得纯净 ArrayBuffer 再传给 uniffi `saveMedia`。

### 外链 URL 入口 deferred

工具栏首版不内置外链 URL 输入入口。原计划走 ActionSheet 二选一，落地后判断价值与体验不匹配（用户更常用相册；外链可手敲 markdown）。后续若用例显示需要，再加入口（候选：长按图片按钮 / 命令面板）。

### `expo-image-picker` plugin + permission

`app.json` 中：

```json
[
  "expo-image-picker",
  {
    "photosPermission": "允许 SwarmNote 访问相册以插入图片到笔记中。",
    "cameraPermission": "允许 SwarmNote 使用相机拍摄图片插入到笔记中。"
  }
]
```

iOS 必须配 usage description，否则首次 prompt 直接闪退。Android 自动注入 `READ_MEDIA_IMAGES`。

## 标题按钮：BottomSheet 选级别（关键盘）

`H` 按钮 `onPressIn` 不再走 `cycleHeading`，而是：

```tsx
const handleRequestHeading = useCallback(() => {
  Keyboard.dismiss();
  void editorApi?.blur();     // ← 必须，否则 IME 不收（见下）
  headingSheetRef.current?.present();
}, [editorApi]);
```

### `Keyboard.dismiss()` 不够 — 必须同时 `editorApi.blur()`

RN 的 `Keyboard.dismiss()` 只收 RN `TextInput` owner 的键盘。本应用编辑输入是在 **WebView 内的 contentEditable** — IME 由 WebView 持有，RN 看不到、也收不掉。结果：sheet 弹出时 IME 仍占据屏幕下半部、把 sheet 选项盖住。

正确做法：同时调 `editorApi.blur()`（Comlink RPC → editor-runtime → `view.contentDOM.blur()`）。WebView 的 contentEditable 失焦后，IME 才会真正收起。两个调用并行，sheet present 不 await，IME 收起动画与 sheet 弹起动画同时进行。

**图片按钮同理**：`launchImageLibraryAsync` 打开系统相册前也要 blur，否则相册返回时键盘弹回 + 之后状态怪异。`handleRequestInsertImage` 已加上同样的两行。

`EditorHeadingSheet` 是 gorhom `BottomSheetModal` + 7 个选项（无标题 + 标题 1-6），lucide 图标用 `Type` + `Heading1..Heading6`。当前 level 在 sheet 中 `bg-border` 高亮 + active 文字色。

### 利用 `toggleHeading` 现有语义实现 level 切换

editor 核心的 `toggleHeading(view, level)` 行为：当前行已是该 level 时清除前缀；其他情况替换为该 level 前缀。`MarkdownEditor.handleSelectHeading` 利用这点：

| 用户选择 | 当前 level | 调用 |
|---|---|---|
| 无标题 (level=0) | >= 1 | `toggleHeading(currentLevel)` 清除 |
| 无标题 (level=0) | 0 | noop |
| 标题 N (level=N) | N | noop（避免误清除）|
| 标题 N (level=N) | ≠N | `toggleHeading(level)` 切换 |

**不引入新命令**：与 highlight / blockquote 不同，heading sheet 完全在 RN 侧实现 + 复用现有 `toggleHeading`，不触发跨仓提交。

## 防止浮层遮挡内容：单一入口同步 padding + scrollMargins

工具栏 / 键盘 / BottomCommandBar 都浮在屏幕底部，会遮挡编辑器最后几行。需要同时覆盖**两种滚动场景**，但两者由 **同一个入口** `EditorControl.setScrollBottomMargin(px)` 一次 dispatch 同步驱动 — 单一真值源，绝不会出现"两值不一致"的中间状态。

| 场景 | 触发 | CM 是否主动滚动 | 由 `setScrollBottomMargin(px)` 驱动的机制 |
|---|---|---|---|
| 编辑时光标进入遮挡区 | 输入 / 光标移动 / scrollIntoView | 是 | `EditorView.scrollMargins.of(() => ({ bottom: px }))` |
| 用户用手指拖到末尾 | 用户主动滚 | 否 | `.cm-content` inline `padding-bottom: ${px}px`（经 `EditorView.contentAttributes`）|

`px` 表示"底部障碍区高度"。键盘弹起时 = `keyboardHeight + 56`，未弹起 = `insets.bottom + 68`。

> 历史教训：早期 padding 是一段宿主一次性 inject 的 `<style>` 标签写死 120 px，scrollMargins 是动态的。键盘 (~300) + toolbar (56) ≈ 356 px 的浮层下，120 px 的 padding 让最后一行依然被遮 ~236 px，**手指怎么拖都看不到**。修复后两值同源，详见 OpenSpec change `editor-bottom-obstruction-padding`。

### `.cm-content`（非 `.cm-scroller`）+ `EditorView.contentAttributes`

Chromium 长期 bug [#879745](https://bugs.chromium.org/p/chromium/issues/detail?id=879745)：在 `overflow: auto` 元素上加 `padding-bottom`，padding 区不能滚到。CodeMirror 的 `.cm-scroller` 是 `overflow: auto` 容器、`.cm-content` 是被滚动的内容。padding 加在 `.cm-content` 上才有效。

`packages/editor/src/createEditor.ts` 用一个独立的 `Compartment` 容纳 `EditorView.contentAttributes.of({ style: 'padding-bottom: 0px' })`，与 `scrollMarginsCompartment` 并列。`EditorControl.setScrollBottomMargin(px)` 在一次 `view.dispatch` 内同时 `reconfigure` 两个 compartment，不直接改 `view.contentDOM.style`。

### 默认 `padding-bottom = 0`，宿主自管首屏空窗期

Editor 核心初始 `padding-bottom: 0` —— 桌面端不调用 `setScrollBottomMargin`，编辑器底部不带任何附加留白。

移动端在 `MarkdownEditor.tsx` 通过 `injectedJavaScript` 注入 `<style>` 兜底 `.cm-content { padding-bottom: 70px }` —— 仅作为 webview ready → editor created 之间几百毫秒的过渡，覆盖 BottomCommandBar (~68 px) 浮层。editor created + RN useEffect 跑后调 `setScrollBottomMargin`，inline style 优先级 1000 覆盖 `<style>` selector style，padding 由 editor 核心接管。

#### `<style>` 兜底**不要**带 `!important`（自家压自家陷阱）

历史踩坑：旧版本 `INJECTED_BOTTOM_PADDING_CSS` 写的是 `.cm-content { padding-bottom: 70px !important; }`，结果 editor 核心通过 `EditorView.contentAttributes` 写出的 inline `style="padding-bottom: 358px"` **被 `!important` 压住**——CSS specificity 规则下，任何 `!important` 声明（无论 selector 还是 inline）都胜过非 `!important` 的 inline style。表现是：键盘弹起后 setScrollBottomMargin 显然调用了（CDP `Runtime.evaluate` 看 `c.getAttribute('style')` 显示 `padding-bottom: 358px` 已写入），但 `getComputedStyle(c).paddingBottom` 仍然是 70px，最后几行依然被键盘盖。

**正确做法**：

- 兜底 `<style>` selector rule **不带 `!important`**（specificity 10）
- editor 核心写 inline style **也不带 `!important`**（specificity 1000，自然胜出）
- 加 `!important` 任意一边都会反向卡死

**诊断手法（值得记）**：webview debugging 默认在 `react-native-webview` 的 dev build 上开启，但 mobile MCP 的 `system_webview` 工具有时连不上。可绕过为：

```bash
# 1. 找 devtools socket
adb shell cat /proc/net/unix | grep webview
# → @webview_devtools_remote_<pid>

# 2. 转发到 PC
adb forward tcp:9999 localabstract:webview_devtools_remote_<pid>

# 3. 列页
curl http://127.0.0.1:9999/json
# → 拿到 webSocketDebuggerUrl

# 4. 用 WebSocket + Runtime.evaluate 注入诊断 JS
# 见 PowerShell 5.1 ClientWebSocket 范例（仓库 history 中有）
```

诊断 padding 时，**同时取** `getAttribute('style')`（什么被写入了）和 `getComputedStyle().paddingBottom`（最终生效是什么）；两者一致 = 没人覆盖；前者是新值后者是旧值 = 被覆盖（`!important` / theme / 别处 contributor）。

### `setScrollBottomMargin` 链路（跨 RN ↔ WebView ↔ CM）

```
RN MarkdownEditor
  ├─ useKeyboardState 拿 isVisible + height
  ├─ useSafeAreaInsets 拿 insets.bottom
  └─ useEffect: editorApi.setScrollBottomMargin(px)
       ↓ Comlink RPC
     editor-runtime.setScrollBottomMargin(px)
       ↓
     EditorControl.setScrollBottomMargin(px)
       ↓ view.dispatch({
       ↓   effects: [
       ↓     scrollMarginsCompartment.reconfigure(EditorView.scrollMargins.of(() => ({ bottom: px }))),
       ↓     contentPaddingCompartment.reconfigure(EditorView.contentAttributes.of({ style: `padding-bottom: ${px}px` })),
       ↓   ],
       ↓ })
     CodeMirror
```

**px 数值（RN 端计算）**：

```ts
const TOOLBAR_OVERLAY_PX = 56;     // toolbar 48 + gap 8
const BOTTOM_BAR_OVERLAY_PX = 68;  // BottomCommandBar 52 + 浮起 gap 16
const px = keyboardVisible
  ? keyboardHeight + TOOLBAR_OVERLAY_PX
  : insets.bottom + BOTTOM_BAR_OVERLAY_PX;
```

键盘高度变化每次都触发 RPC（频率有限：键盘 will/did show/hide 各一次）。

### 跨仓提交顺序

修改 `packages/editor` 触发 [editor.md "Submodule 提交顺序"](./editor.md)：

1. swarmnote-editor 仓库 commit + push
2. SwarmNote-RN（移动）仓库 `git add packages/editor` bump pointer + commit
3. SwarmNote（桌面）仓库同步 bump pointer。**API 签名不变**（仅扩语义），桌面端无须 wire 任何代码。

## 与 BottomCommandBar 互斥联动

主屏 / 笔记编辑器页底部还有一个胶囊状的 `BottomCommandBar`（搜索 / 新建 / 命令）。它与 EditorToolbar 互斥 — 键盘弹起即工具栏起、`BottomCommandBar` 同步淡出 + 下沉 80px；键盘收起两者反向。两者共用同一个 `useReanimatedKeyboardAnimation` 的 progress sharedValue 驱动，所以动画曲线完全同步。

```tsx
// BottomCommandBar 内部
const { progress } = useReanimatedKeyboardAnimation();
const { isVisible: keyboardVisible } = useKeyboardState();
const animatedStyle = useAnimatedStyle(() => ({
  opacity: 1 - progress.value,
  transform: [{ translateY: progress.value * 80 }],
}));
return (
  <Animated.View
    pointerEvents={keyboardVisible ? "none" : "box-none"}
    style={[..., animatedStyle]}
  >
    ...
  </Animated.View>
);
```

`pointerEvents` 必须用普通 React state（`isVisible`）而不是 sharedValue 控制 — 因为 `pointerEvents` 不是 worklet 友好属性，opacity=0 时仍会响应触摸，所以需要单独 disable 点击响应。

## 焦点保持 + 横向滑动手势

工具栏交互（按按钮、滚动条）SHALL 不让 WebView 失焦，否则键盘"先收后弹"会闪烁。

- `Pressable` 用 `onPress`（不是 `onPressIn`）触发命令
- ScrollView `keyboardShouldPersistTaps="always"` 让点击不收键盘
- 容器 `collapsable={false}` 防止 Android RN 编译期把单子 View 优化掉

### `onPressIn` 会破坏横向滑动 — 必须用 `onPress`

直觉上 `onPressIn` 让按钮"按下瞬间就响应"显得更灵敏，但工具栏在 horizontal ScrollView 内时这是错的：用户想要左右滑动时，手指落在某个按钮上的第一帧就会被 `onPressIn` 当成"点击"立即触发命令，结果是"想滚到右边的按钮，结果触发了第一个按钮"。

`onPress` 让 RN 的手势识别有时间区分点击 vs 滚动 — ScrollView 检测到手指水平位移超过阈值时会取消所有子 Pressable 的按压，`onPress` 不触发；只有手指落下后没明显移动且抬起时 `onPress` 才 fire。这与 RN ScrollView + Pressable 的标准组合一致。

实测无副作用：
- 焦点保持：`onPress` 在 touchend 时触发，contentEditable 还没失焦，命令照样发到 editor
- 反馈灵敏度：不到 100ms 的延迟用户感知不到

iOS Safari/WebView 上 ScrollView 滚动手势在某些场景下抢焦点 — 如果出现，备选方案是换成 `react-native-gesture-handler` 的 `ScrollView` 配 `simultaneousHandlers`。**先按现状上线**，QA 反馈再处理。

## 链接按钮：编辑器内插模板

`🔗` 单击 → `editorApi.execCommand('insertLink')` 不传参数 → 编辑器内部插入 `[选中文本](|)` 并把光标定位到 URL 占位处。**不**弹移动端 URL 对话框（链接 URL 短，就地敲两个字比弹 dialog 快）。这与 obsidian 桌面 `Ctrl+K` 行为一致。

## 命令清单与延迟项

本 MVP 14 个按钮全走现有 `execCommand`：undo/redo + B/I/S/Code + cycleHeading + ul/ol/check + insertLink/insertImage + indentMore/indentLess。

**Deferred to 桌面端右键菜单 change**（详见 `~/.claude/projects/-Volumes-yexiyue-SwarmNote-RN/memory/editor-pending-commands.md`）：

- `toggleHighlight` — `SelectionFormatting.highlight` 字段已存在但无写入命令
- `toggleBlockquote` — 同上

两个新命令需要在 swarmnote-editor 子仓加文件，触发跨仓提交序，与桌面端右键菜单合并做摊销成本。

**Deferred to v0.3+**：

- 长按 Tooltip 视觉浮层（accessibilityLabel 已覆盖屏幕阅读器场景）
- wikilink `[[ ]]` 按钮（依赖 editor 核心 lezer 节点扩展）
- `#tag` 按钮、附件按钮

## i18n

按钮 `accessibilityLabel` 通过 lingui `t``加粗` 等调用，extract 后 `zh-Hans` 是 source、`en` 已补全本次新增的 20 条 msgstr。改文案 → 重跑 `pnpm lingui:extract` 确认 missing 数。

**相关文件**：[src/components/editor/EditorToolbar.tsx](../../src/components/editor/EditorToolbar.tsx)、[src/components/editor/EditorImageInsertSheet.tsx](../../src/components/editor/EditorImageInsertSheet.tsx)、[src/components/editor/useEditorFormatting.ts](../../src/components/editor/useEditorFormatting.ts)、[src/components/editor/MarkdownEditor.tsx](../../src/components/editor/MarkdownEditor.tsx)、[src/app/_layout.tsx](../../src/app/_layout.tsx)、[app.json](../../app.json)
