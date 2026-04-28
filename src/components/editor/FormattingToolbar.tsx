import type { SelectionFormatting } from "@swarmnote/editor/types";
import { EditorCommandType } from "@swarmnote/editor/types";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  SquareCheck,
  Strikethrough,
  Undo2,
} from "lucide-react-native";
import { Pressable, ScrollView, type StyleProp, View, type ViewStyle } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

interface FormattingToolbarProps {
  formatting: SelectionFormatting;
  onCommand: (cmd: EditorCommandType) => void;
  style?: StyleProp<ViewStyle>;
}

export function FormattingToolbar({ formatting, onCommand, style }: FormattingToolbarProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        {
          height: 44,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        style,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: 8 }}
        keyboardShouldPersistTaps="always"
      >
        <ToolButton
          onPress={() => onCommand(EditorCommandType.Undo)}
          label="撤销"
          color={colors.mutedForeground}
        >
          <Undo2 size={18} color={colors.mutedForeground} />
        </ToolButton>

        <ToolButton
          onPress={() => onCommand(EditorCommandType.Redo)}
          label="重做"
          color={colors.mutedForeground}
        >
          <Redo2 size={18} color={colors.mutedForeground} />
        </ToolButton>

        <Divider color={colors.border} />

        <ToolButton
          onPress={() => onCommand(EditorCommandType.ToggleBold)}
          label="粗体"
          active={formatting.bold}
          color={colors.mutedForeground}
          activeColor={colors.foreground}
        >
          <Bold size={18} color={formatting.bold ? colors.foreground : colors.mutedForeground} />
        </ToolButton>

        <ToolButton
          onPress={() => onCommand(EditorCommandType.ToggleItalic)}
          label="斜体"
          active={formatting.italic}
          color={colors.mutedForeground}
          activeColor={colors.foreground}
        >
          <Italic
            size={18}
            color={formatting.italic ? colors.foreground : colors.mutedForeground}
          />
        </ToolButton>

        <ToolButton
          onPress={() => onCommand(EditorCommandType.ToggleStrike)}
          label="删除线"
          active={formatting.strikethrough}
          color={colors.mutedForeground}
          activeColor={colors.foreground}
        >
          <Strikethrough
            size={18}
            color={formatting.strikethrough ? colors.foreground : colors.mutedForeground}
          />
        </ToolButton>

        <ToolButton
          onPress={() => onCommand(EditorCommandType.ToggleCode)}
          label="行内代码"
          active={formatting.code}
          color={colors.mutedForeground}
          activeColor={colors.foreground}
        >
          <Code size={18} color={formatting.code ? colors.foreground : colors.mutedForeground} />
        </ToolButton>

        <Divider color={colors.border} />

        <ToolButton
          onPress={() => onCommand(EditorCommandType.CycleHeading)}
          label="标题"
          active={formatting.heading > 0}
          color={colors.mutedForeground}
          activeColor={colors.foreground}
        >
          <Heading2
            size={18}
            color={formatting.heading > 0 ? colors.foreground : colors.mutedForeground}
          />
        </ToolButton>

        <Divider color={colors.border} />

        <ToolButton
          onPress={() => onCommand(EditorCommandType.ToggleUnorderedList)}
          label="无序列表"
          active={formatting.listType === "unordered"}
          color={colors.mutedForeground}
          activeColor={colors.foreground}
        >
          <List
            size={18}
            color={formatting.listType === "unordered" ? colors.foreground : colors.mutedForeground}
          />
        </ToolButton>

        <ToolButton
          onPress={() => onCommand(EditorCommandType.ToggleOrderedList)}
          label="有序列表"
          active={formatting.listType === "ordered"}
          color={colors.mutedForeground}
          activeColor={colors.foreground}
        >
          <ListOrdered
            size={18}
            color={formatting.listType === "ordered" ? colors.foreground : colors.mutedForeground}
          />
        </ToolButton>

        <ToolButton
          onPress={() => onCommand(EditorCommandType.ToggleCheckList)}
          label="任务列表"
          active={formatting.listType === "check"}
          color={colors.mutedForeground}
          activeColor={colors.foreground}
        >
          <SquareCheck
            size={18}
            color={formatting.listType === "check" ? colors.foreground : colors.mutedForeground}
          />
        </ToolButton>
      </ScrollView>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ width: 1, height: 20, backgroundColor: color, marginHorizontal: 4 }} />;
}

function ToolButton({
  onPress,
  label,
  active = false,
  children,
}: {
  onPress: () => void;
  label: string;
  active?: boolean;
  color: string;
  activeColor?: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        marginHorizontal: 2,
        opacity: pressed ? 0.6 : 1,
        backgroundColor: active ? "rgba(128,128,128,0.15)" : "transparent",
      })}
    >
      {children}
    </Pressable>
  );
}
