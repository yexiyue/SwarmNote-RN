# 文件面板（FilesPanel）交互

左侧文件面板是 `(main)/index.tsx` 里 PagerView 的第 0 页（第 1 页是编辑器）。下文只讲交互约定，不讲布局。

## `onClose` 语义 = "切到编辑器页"

`FilesPanel` 的 `onClose` prop 不是"关闭面板"，而是"把用户注意力切到编辑器页"（实际是 `pagerRef.current?.setPage(1)`）。命名从历史遗留，**不要按字面理解改成 `onDismiss`**——改名会让父组件误以为需要销毁 FilesPanel。

**触发点**：
- 工具栏的 X 按钮（用户主动）
- 点击文件后的自动切页（文件面板把焦点让给编辑器）

## 两套选中语义共存

文件面板里有**两个独立**的"被选中"状态，它们可以同时存在，视觉上独立表达：

| 字段 | 含义 | 视觉 |
|---|---|---|
| `useCurrentDocStore.relPath` | 编辑器当前打开的文件 | `border border-primary` + `bg-primary/10`（主题色整行边框） |
| `useFilesUiStore.selectedNodeId` | UI 点中态（决定新建位置） | `bg-muted`（灰底） |

**视觉优先级**：current 压过 selected —— 同一节点两个状态都命中时，只显示 current 的 primary tint，不叠加 muted 底。

**判定写法**（files-panel.tsx FileTreeNode 里）：
```tsx
const rowClassName = cn(
  "h-9 flex-row items-center gap-1.5 pr-3 rounded-md",
  isCurrent && "border border-primary bg-primary/10",
  !isCurrent && selected && "bg-muted",
  !isCurrent && !selected && "active:bg-muted",
);
```

**不要**：不要把 current 和 selected 合并成单一概念——两者职责不同，合并会让"文件夹 selected"（给新建文件定位）和"文件 current"（正在编辑）互相抢渲染。

## 点击 / 长按手势分工

- **点击文件** → `useCurrentDocStore.open(node.id)`（fire-and-forget）+ 同步调 `onClose()` 切页。不等 Promise resolve，pager 立即切；编辑器页自己 render `opening → open` 状态机。
- **点击文件夹** → 切换 `expandedFolderIds`。不切页。
- **长按任一节点** → `FileActionSheet.present(node)` 打开 BottomSheetModal。RN `Pressable` 的 `onLongPress` 和 `onPress` 天然互斥（500ms 系统默认时长），不要引入 gesture-handler 的 `LongPress`。

## `InlineNameInput` blur-to-confirm（Obsidian 风格）

`InlineNameInput` 的 TextInput 失焦触发 `onSubmit()`，空串走 `onSubmit` 里的空 → `cancelDraft()` 分支；X 按钮通过 `onPressIn` 先置 `cancelledRef.current = true` 跳过后续 blur 的 submit。

**关键时序**：RN 里 Pressable 的 `onPressIn` 早于 TextInput 的 `onBlur`，所以 X 的 onPressIn 能在 blur 之前设置 ref。不要改成 `onPress` 里置 flag——那样会被 blur 的 submit 抢先跑掉。

**submitting 状态下忽略 blur**：FFI 调用在途时 blur（例如用户点到别处让键盘收起）应当 no-op，避免重复提交。

**不要**：不要把 blur 和 `onSubmitEditing`（键盘"完成"）两个路径都跑 submit——键盘"完成"会触发 `blurOnSubmit` → blur 会跟着触发 submit，已经有 submitting 状态守卫兜住；但如果把 `onBlur` 的 submit 改成 async-await 等 submit 完才复位 submitting，会漏掉第二轮守卫。保持 `onBlur` 里只 *发起* `onSubmit()`，不等 Promise。

## 重命名走 InlineNameInput（复用新建 UI）

长按 → sheet → 点"重命名" → sheet dismiss → 把被选节点原位切成 `InlineNameInput`（通过 `useFilesUiStore.startDraft({ renameTarget: node, name: node.name, kind, parentRelPath })`）。`onSubmitDraft` 分支：`draft.renameTarget !== null` → 调 `renameNode(target, name)`；否则现有 create 分支。

**理由**：用户心智模型不区分"新建"和"重命名"——都是"inline 编辑文件名"。用同一 UI 一致性最高，也复用了 blur-to-confirm / focus-border / X 按钮等 affordance。不另开 Dialog。

## `renameNode` / `deleteNode` helpers

封装在 [src/core/files-actions.ts](../../src/core/files-actions.ts)，不直接在组件里调 FFI。

### `renameNode(node, newName)`

- 同目录 rename = `moveNode(oldRelPath, newRelPath, isDir)`。
- `moveNode` 一站式：FS rename + DB rebase + Y.Doc 重绑 + emit `FileTreeChanged`（event-bus 自动 refresh 文件树）。所以 helper 里**不需要主动 refresh**。
- 当前打开文件被重命名时，调 `useCurrentDocStore.rebindRelPath(newRelPath)` 只更新 store 的 `relPath`，**不**重新 open（Y.Doc handle 是 Rust 侧负责 rebind 的，docUuid 不变）。
- 当前文件在被重命名的文件夹内部时，按前缀 splice 算新 relPath：`newRelPath + currentRelPath.slice(oldFolder.length)`。

### `deleteNode(node)`

- **文件**：`deleteDocumentByRelPath(relPath)`（DB 删 + 墓碑）+ `removeFile(relPath)`（FS 物理删）。
- **文件夹**：`deleteDocumentsByPrefix(${relPath}/)`（DB 批量删子文档 + 墓碑）+ `removeDir(relPath)`（FS 层 `remove_dir_all` 递归）。
- 不调 `deleteFolder(folder_id)`—— 它需要 DB 层 folder UUID（从文件树节点拿不到），且只能删空文件夹。DB `folders` 表的孤儿行不影响 UI，因为 `scan_tree` 只扫 FS，不读 folders 表；后续 reconcile 会清理。
- 主动 `useFileTreeStore.refresh()`（delete 不 emit `FileTreeChanged`）。
- 命中当前打开文件（含祖先文件夹）时调 `useCurrentDocStore.close()`。

**相关文件**：`src/core/files-actions.ts`、`src/components/files-panel.tsx`、`src/components/files/FileActionSheet.tsx`、`d:/workspace/swarmnote/crates/core/src/document.rs`、`d:/workspace/swarmnote/crates/core/src/fs/mod.rs`

## BottomSheetModal 封装模式

项目里两处 sheet 用同一套 forwardRef + imperative handle 模式：

- [src/components/command-sheet.tsx](../../src/components/command-sheet.tsx)（主页右上角 ⋮）
- [src/components/files/FileActionSheet.tsx](../../src/components/files/FileActionSheet.tsx)（文件长按）

要点：
- `BottomSheetModalProvider` 已在 `_layout.tsx` 全局 mount，不要在子组件再包一层
- `enableDynamicSizing` + `enablePanDownToClose` + 自定义 `BottomSheetBackdrop`（`opacity: 0.4` + `pressBehavior: "close"`）
- `backgroundStyle={{ backgroundColor: colors.card }}` / `handleIndicatorStyle={{ backgroundColor: colors.border }}` 走 theme 变量
- 每项用 `<Pressable onPress={() => dismissThen(item.onPress)} />`，sheet 先 `dismiss()` 再执行动作（避免 sheet 叠在 Alert/新界面之上）
- **destructive item** 用 `text-destructive` + `colors.destructive` 图标色

**不要**：不要把 sheet 里做 TextInput 的编辑（重命名走 sheet-dismiss-then-InlineNameInput），否则要处理 BottomSheet 和键盘的联动。
