import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";

const SAMPLE_MARKDOWN = `# SwarmNote Editor

这是一个 **CodeMirror 6** 编辑器测试页面。

## 功能测试

- 中文输入测试
- **加粗** 和 *斜体*
- \`行内代码\`
- [链接](https://example.com)

### 代码块

\`\`\`typescript
const hello = "world";
console.log(hello);
\`\`\`

> 引用文本测试

1. 有序列表
2. 第二项
3. 第三项
`;

export default function EditorTestScreen() {
  const [docChanged, setDocChanged] = useState(0);

  const handleDocChange = useCallback(() => {
    setDocChanged((n) => n + 1);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-border">
        <Text className="text-foreground font-semibold text-lg">Editor Test</Text>
        <Text className="text-muted-foreground text-sm">changes: {docChanged}</Text>
      </View>
      <View className="flex-1">
        <MarkdownEditor initialText={SAMPLE_MARKDOWN} onDocChange={handleDocChange} />
      </View>
    </SafeAreaView>
  );
}
