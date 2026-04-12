# 桌面端 CM6 迁移

## 用户故事

作为用户，我希望桌面端也切换到与移动端相同的 Markdown Live Preview 编辑器，以获得一致的双端编辑体验，并让 yjs 协作 schema 统一为简单的 Y.Text。

## 依赖

- Live Preview 装饰扩展（L1）

## 需求描述

在 SwarmNote 桌面端（Tauri v2 + React 19）中，将 BlockNote 编辑器替换为 `@swarmnote/editor`（CodeMirror 6），并完成旧文档数据迁移。

### 核心变更

1. **编辑器替换**：`NoteEditor.tsx` 从 BlockNote → `createEditor()` from `@swarmnote/editor`
2. **yjs schema 迁移**：从 BlockNote XML schema（`<blockGroup>/<blockContainer>/<paragraph>`） → 单个 `Y.Text`
3. **数据迁移**：旧 `yjs_state` 中的 BlockNote Y.Doc → Markdown 文本 → 新 Y.Text Y.Doc
4. **自定义 block 替换**：`CustomReactImageBlock` / `CustomReactVideoBlock` → CM6 Widget Decoration

## 交互设计

- 编辑体验从 Notion 式 block 编辑转为 Obsidian 式 Markdown Live Preview
- 不再支持 block 拖拽重排、slash menu 等 Notion 式交互
- 新增 Markdown 语法的实时预览渲染

## 技术方案

### 编辑器替换

```tsx
// 桌面端 NoteEditor.tsx（迁移后）
import { createEditor } from '@swarmnote/editor';
import * as Y from 'yjs';

const NoteEditor: FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [ydoc] = useState(() => new Y.Doc());

  useEffect(() => {
    loadInitialYjsState(ydoc);  // 从 Rust 后端加载
    const control = createEditor(editorRef.current, {
      initialText: '',
      yjsCollab: { ydoc, fragmentName: 'document' },
      settings: editorSettings,
    });
    return () => control.destroy();
  }, []);

  return <div ref={editorRef} />;
};
```

### 数据迁移脚本

```text
旧 Y.Doc (BlockNote XML schema)
  → yrs_blocknote::doc_to_markdown()  // Rust 侧转换
  → Markdown 纯文本
  → 新 Y.Doc (Y.Text)                // 重新创建
  → 覆盖写入 yjs_state
```

- CRDT 历史会被重置（格式升级，可接受）
- 需要一次性迁移所有文档，不可逆
- 建议在迁移前自动备份旧 `yjs_state`

### Image/Video Widget

- Phase 1：只读渲染（CM6 Widget Decoration + `<img>` / `<video>` 标签）
- Phase 2（后续版本）：交互编辑（缩放、caption、拖拽）

## 验收标准

- [ ] 桌面端 `NoteEditor.tsx` 完全替换为 CM6
- [ ] Live Preview 装饰在桌面端正常工作
- [ ] `TauriYjsProvider` 适配新的单 Y.Text schema
- [ ] 数据迁移脚本可将所有旧 BlockNote 文档转为 Markdown Y.Text
- [ ] 迁移后文档内容无丢失（文本、标题、列表、代码块等保留）
- [ ] 图片以只读 Widget 渲染（可见但暂不可交互编辑）
- [ ] 删除 BlockNote 相关依赖（`@blocknote/*`、`yrs-blocknote` 仅保留作为迁移工具）

## 任务拆分建议

1. 桌面端 `NoteEditor.tsx` 替换为 `@swarmnote/editor`（不接 yjs）
2. 集成 `y-codemirror.next` + `TauriYjsProvider` 适配
3. 编写数据迁移脚本（Rust 侧 `yrs_blocknote::doc_to_markdown()`）
4. 执行全量数据迁移 + 验证
5. Image/Video Widget Decoration 只读渲染
6. 删除 BlockNote 依赖，清理代码

## 开放问题

- 桌面端仓库需要先转成 monorepo workspace 才能引用 `@swarmnote/editor`（或通过 git submodule）
- `yrs-blocknote` 迁移完成后是否整个删除，还是重命名为 `yrs-markdown`？
- 自定义 block 的交互编辑（缩放、caption）推迟到哪个版本？
