# 编辑器核心抽象

`packages/editor/src/core/` 提供给所有 widget / live-preview 扩展共用的四个原语。新写编辑器扩展时**优先使用这套抽象**，不要再各自写一遍光标判断或 update 调度。

灵感来自 `codemirror-live-markdown`（克隆在 `D:/workspace/codemirror-live-markdown`），但完整移植到我们 codebase 内（不依赖 npm 包），保持 submodule 纯净度。

## 四个原语

| 名字 | 作用 | 出处 |
|---|---|---|
| `collapseOnSelectionFacet` | 全局开关：是否启用"光标进入 → 显源"行为；默认 true | `core/facets.ts` |
| `mouseSelectingExtension` / `mouseSelectingField` | 跟踪用户是否在拖选；防止 drag 期间 widget 反复重建闪烁 | `core/mouseSelecting.ts` |
| `shouldShowSource(state, from, to)` | 范围相交判断；同时检查 facet 和拖选状态 | `core/shouldShowSource.ts` |
| `checkUpdateAction(update)` | ViewPlugin 统一 update 调度 → `'rebuild' \| 'skip' \| 'none'` | `core/pluginUpdateHelper.ts` |

## 使用模式

### Widget 决定显示源码 / widget

```ts
import { shouldShowSource } from '../core';

syntaxTree(state).iterate({
  enter: (node) => {
    if (node.name !== 'FencedCode') return;
    const showSource = shouldShowSource(state, node.from, node.to);
    if (showSource) {
      // 渲染原始 markdown（或 line decoration）
    } else {
      // 渲染 widget
    }
  },
});
```

**注意**：`shouldShowSource` 在三种情况下返回 false（widget 保持显示）：
1. `collapseOnSelectionFacet` 是 false（live preview 关闭）
2. 用户正在拖选
3. 选区与目标范围不相交

第 1、2 条是基础设施层的"全局短路"，第 3 条是真正的范围判断。

### ViewPlugin 的 update 逻辑

```ts
import { checkUpdateAction } from '../core';

ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view) { this.decorations = build(view); }
    update(update) {
      if (checkUpdateAction(update) === 'rebuild') {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
```

**关键收益**：drag 期间返回 `'skip'`，drag 结束时返回 `'rebuild'` 一次性同步，避免每次 selection change 都触发 widget 重建造成的闪烁。

### StateField 的 update 逻辑（**不**用 checkUpdateAction）

`checkUpdateAction` 接收 `ViewUpdate`，只能用于 ViewPlugin。StateField 的 `update(deco, tr)` 接收的是 `Transaction`，仍然手写：

```ts
StateField.define<DecorationSet>({
  update(deco, tr) {
    if (tr.docChanged || tr.reconfigured || tr.selection) {
      return buildDecorations(tr.state);
    }
    return deco;
  },
});
```

block-level decorations（影响垂直布局）必须通过 StateField 提供，所以 `renderBlockImages.ts` / `renderBlockTables.ts` / `renderBlockCode.ts` 都是这个模式。

## 不要做

- **不要在新扩展里重复写 `isCursorInRange`-like 函数**——用 `shouldShowSource`
- **不要漏注册 `mouseSelectingExtension`**——它是 `mouseSelectingField` + DOM 事件桥的组合，单独注册 field 不会自动产生 mousedown/mouseup 事件
- **不要尝试用 `checkUpdateAction` 包装 StateField update**——签名不兼容

## 已迁移的扩展

- ✅ `inlineRendering/makeInlineReplaceExtension.ts` — ViewPlugin update 用 checkUpdateAction
- ✅ `renderBlockCode.ts` — 用 shouldShowSource 判断光标
- ✅ `renderBlockTables.ts` — 通过 source-mode StateField 自定义判断（不依赖 shouldShowSource）

未迁移（无需迁移，因为不依赖 selection）：
- `markdownDecorationExtension.ts` — 只做 line/mark 装饰
- `markdownHighlightExtension.ts` — 纯 syntax highlighting
- `markdownFrontMatterExtension.ts` — 类似

## 相关文件

- `packages/editor/src/core/`
- 上游参考：`D:/workspace/codemirror-live-markdown/src/core/`
