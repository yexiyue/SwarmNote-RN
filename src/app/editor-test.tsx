import { type EditorEvent, EditorEventType } from "@swarmnote/editor/events";
import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";

const SAMPLE_MARKDOWN = `# SwarmNote Editor

这是一个 **CodeMirror 6** 编辑器测试页面，用于验证各种 Markdown 语法的渲染和编辑体验。

## 基础格式

这是普通段落。支持 **加粗**、*斜体*、~~删除线~~ 和 \`行内代码\` 等格式。还有 ==高亮文本== 和 [链接](https://example.com)。

## 列表

### 无序列表

- 第一项
- 第二项
  - 嵌套第一项
  - 嵌套第二项
    - 三级嵌套
- 第三项

### 有序列表

1. 打开编辑器
2. 输入 Markdown 内容
3. 实时预览效果
4. 保存文档

### 任务列表

- [ ] 实现 Live Preview 渲染
- [ ] 添加列表切换命令
- [x] 创建 Widget 替换系统
- [x] 实现 Reveal Strategy
- [ ] 添加图片渲染

## 代码块

\`\`\`typescript
interface EditorControl {
  getText(): string;
  setText(text: string): void;
  execCommand(name: string, ...args: unknown[]): unknown;
  getSelectionFormatting(): SelectionFormatting;
  focus(): void;
  destroy(): void;
}
\`\`\`

\`\`\`rust
fn main() {
    let doc = Doc::new();
    let text = doc.get_or_insert_text("document");
    text.insert(&mut doc.transact_mut(), 0, "Hello, SwarmNote!");
    println!("{}", text.get_string(&doc.transact()));
}
\`\`\`

## 引用

> 最好的代码是不需要写的代码。最好的桥接层是不需要桥接的架构。
>
> — SwarmNote CM6 迁移总结

## 表格

| 功能 | 状态 | 优先级 |
| ---- | ---- | ------ |
| 基础装饰 | ✅ 完成 | P0 |
| Widget 替换 | ✅ 完成 | P0 |
| 列表命令 | ✅ 完成 | P1 |
| 图片渲染 | ❌ 待做 | P0 |
| 数学公式 | ❌ 待做 | P2 |

## 分隔线

---

## 长文本滚动测试

以下是一段较长的文本，用于测试编辑器的滚动行为。

CodeMirror 6 是一个从头重写的代码编辑器框架。和传统的富文本编辑器不同，CM6 的文档模型是纯字符串——你看到的标题、加粗、代码块都是通过 Decoration 在渲染层添加的视觉效果，底层数据始终是 Markdown 源码。

这种设计带来了几个关键优势：首先，输入法（IME）只需要往一个扁平字符串里插入字符，不需要处理嵌套 DOM 结构，这就是为什么 CM6 在移动端中文输入上比 ProseMirror 稳定得多。其次，文档模型和渲染是解耦的，你可以在不改变文档的情况下完全改变它的视觉呈现。

Live Preview 系统是让编辑器从"代码编辑器"变成"Obsidian 式笔记体验"的核心技术。它的工作原理是：遍历语法树，为每个 Markdown 标记字符创建 Widget 或 Decoration。当光标不在附近时，标记字符被隐藏或替换成 Widget；当光标移到那一行时，原始 Markdown 恢复显示，让用户可以编辑。

这种 reveal strategy 有三种模式：line（光标在同一行时显示原始 Markdown）、select（选区与节点相交时）、active（光标在节点范围内时）。不同的元素使用不同的策略——列表标记用 line，因为光标在同行就该能编辑；加粗标记用 active，因为只有光标在加粗文字里才需要看到 ** 符号。

## 末尾

如果你能看到这里并且滚动流畅，说明编辑器的基本功能正常工作！🎉
`;

export default function EditorTestScreen() {
  const [docChanged, setDocChanged] = useState(0);
  const [focusState, setFocusState] = useState("blurred");
  const [searchSummary, setSearchSummary] = useState("closed");
  const [lastEvent, setLastEvent] = useState("none");

  const handleEditorEvent = useCallback((event: EditorEvent) => {
    setLastEvent(event.kind);

    switch (event.kind) {
      case EditorEventType.Change:
        setDocChanged((n) => n + 1);
        return;
      case EditorEventType.Focus:
        setFocusState("focused");
        return;
      case EditorEventType.Blur:
        setFocusState("blurred");
        return;
      case EditorEventType.SearchStateChange:
        setSearchSummary(
          event.search
            ? `${event.search.isOpen ? "open" : "closed"} · ${event.search.query || "<empty>"} · ${event.search.totalMatches}`
            : "closed",
        );
        return;
      default:
        return;
    }
  }, []);

  const statusLines = useMemo(
    () => [
      `changes: ${docChanged}`,
      `focus: ${focusState}`,
      `search: ${searchSummary}`,
      `last event: ${lastEvent}`,
    ],
    [docChanged, focusState, lastEvent, searchSummary],
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: "#e5e5e5",
        }}
      >
        <Text style={{ fontWeight: "600", fontSize: 18 }}>Editor Test</Text>
        {statusLines.map((line) => (
          <Text key={line} style={{ color: "#888", fontSize: 13 }}>
            {line}
          </Text>
        ))}
      </View>
      <MarkdownEditor initialText={SAMPLE_MARKDOWN} onEditorEvent={handleEditorEvent} />
    </SafeAreaView>
  );
}
