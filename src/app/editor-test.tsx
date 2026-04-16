import { type EditorEvent, EditorEventType } from "@swarmnote/editor/events";
import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";

const SAMPLE_MARKDOWN = `---
title: SwarmNote Editor Test
tags: [editor, live-preview, test]
date: 2026-04-15
---

# SwarmNote Editor

这是 **Live Preview** 编辑器的完整功能测试页面。光标移到任何元素上可以看到原始 Markdown。

## 格式字符隐藏

**加粗文字** 和 *斜体文字* 的标记符号在非编辑行自动隐藏。~~删除线~~ 和 ==高亮文本== 也是如此。\`行内代码\` 会有背景色。

反斜杠转义测试：\\*这不是斜体\\*，\\**这也不是加粗\\**。

## 链接

[SwarmNote 主页](https://example.com) — 光标离开时 \`[]\` 和 \`()\` 标记隐藏。Ctrl+Click 或长按打开链接。Hover 显示 URL tooltip。

## 列表续行

在列表末尾按 Enter 自动续行，空行按 Enter 删除标记：

- 无序列表第一项
- 第二项（试试在这里按 Enter）
  - 嵌套项

1. 有序列表
2. 自动编号递增
3. 试试在这里按 Enter

- [ ] 未完成任务
- [x] 已完成任务
- [ ] 试试点击 checkbox 切换

## 引用

> 最好的代码是不需要写的代码。
> 最好的桥接层是不需要桥接的架构。
>
> — SwarmNote CM6 迁移总结

## 代码块语法高亮

\`\`\`typescript
interface EditorControl {
  getText(): string;
  setText(text: string): void;
  focus(): void;
}
\`\`\`

\`\`\`rust
fn main() {
    let msg = "Hello, SwarmNote!";
    println!("{msg}");
}
\`\`\`

\`\`\`python
def fibonacci(n: int) -> list[int]:
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result
\`\`\`

## 表格

| 功能 | 状态 | 说明 |
| :--- | :---: | ---: |
| 格式字符隐藏 | ✅ | \`**\` \`*\` 等标记自动隐藏 |
| 块级图像 | ✅ | 渲染为 \`<img>\` Widget |
| 表格渲染 | ✅ | 渲染为 HTML **table** |
| 数学公式 | ✅ | KaTeX 渲染 |
| 主题切换 | ✅ | 深色/浅色跟随系统 |

## 图片渲染

独占一行的图片会渲染为实际图像（光标进入时显示原始 Markdown）：

![SwarmNote Logo](https://via.placeholder.com/600x200/f5f0e8/8b7355?text=SwarmNote+Live+Preview)

## 数学公式

行内公式：能量方程 $E = mc^2$ 非常优雅。

块级公式：

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Inline HTML

以下标签会被渲染为对应样式：

- <mark>高亮文字</mark>
- <kbd>Ctrl</kbd> + <kbd>C</kbd> 复制
- H<sub>2</sub>O 是水的化学式
- x<sup>2</sup> + y<sup>2</sup> = r<sup>2</sup>

## 分隔线

---

## 编辑命令测试

试试以下快捷键：

- **Tab / Shift+Tab** — 缩进/反缩进
- **Enter** — 列表续行
- **自动括号** — 输入 \`(\` 自动补 \`)\`

## 末尾

如果你能看到这里并且滚动流畅，所有 Markdown 元素正确渲染，说明 Live Preview 功能正常！
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
