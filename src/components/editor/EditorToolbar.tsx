import { useLingui } from "@lingui/react/macro";
import type { SelectionFormatting } from "@swarmnote/editor/types";
import type { EditorApi } from "@swarmnote/editor-web";
import type * as Comlink from "comlink";
import {
  Bold,
  Code,
  Heading,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  ListTodo,
  type LucideIcon,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useThemeColors } from "@/hooks/useThemeColors";

const TOOLBAR_HEIGHT = 48;
const ICON_SIZE = 22;
const BUTTON_WIDTH = 44;
const TOOLBAR_HORIZONTAL_MARGIN = 12;
const TOOLBAR_KEYBOARD_GAP = 8;

interface EditorToolbarProps {
  editorApi: Comlink.Remote<EditorApi>;
  formatting: SelectionFormatting;
  onRequestInsertImage: () => void;
  onRequestHeading: () => void;
}

interface ButtonSpec {
  id: string;
  icon: LucideIcon;
  accessibilityLabel: string;
  active?: boolean;
  /** Optional small overlay label (e.g. "H1" / "H2") rendered at the bottom-right corner. */
  badge?: string;
  onPress: () => void;
}

function ToolbarButton({ spec }: { spec: ButtonSpec }) {
  const colors = useThemeColors();
  const Icon = spec.icon;
  return (
    <Pressable
      onPress={spec.onPress}
      accessibilityRole="button"
      accessibilityLabel={spec.accessibilityLabel}
      hitSlop={4}
      style={{
        width: BUTTON_WIDTH,
        height: 40,
        marginHorizontal: 2,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: spec.active ? colors.border : "transparent",
      }}
    >
      <Icon color={spec.active ? colors.foreground : colors.mutedForeground} size={ICON_SIZE} />
      {spec.badge ? (
        <Text
          style={{
            position: "absolute",
            right: 4,
            bottom: 2,
            fontSize: 9,
            fontWeight: "600",
            color: colors.foreground,
          }}
        >
          {spec.badge}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Separator() {
  const colors = useThemeColors();
  return (
    <View
      style={{
        width: 1,
        height: 20,
        marginHorizontal: 6,
        backgroundColor: colors.border,
      }}
    />
  );
}

export function EditorToolbar({
  editorApi,
  formatting,
  onRequestInsertImage,
  onRequestHeading,
}: EditorToolbarProps) {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const colors = useThemeColors();
  const { t } = useLingui();

  // height.value is 0 when keyboard is dismissed and negative (e.g. -300) while
  // it's open. progress goes 0 → 1 alongside the keyboard animation.
  //
  // - `(1 - progress) * TOOLBAR_HEIGHT` slides the bar fully off-screen when
  //   the keyboard is gone (no stray pill at idle state).
  // - `-progress * TOOLBAR_KEYBOARD_GAP` adds an 8px breathing gap above the
  //   keyboard once it's fully open, matching the BottomCommandBar's
  //   "floating pill" feel.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          height.value +
          (1 - progress.value) * TOOLBAR_HEIGHT -
          progress.value * TOOLBAR_KEYBOARD_GAP,
      },
    ],
  }));

  const exec = useCallback(
    (cmd: string, ...args: unknown[]) => {
      void editorApi.execCommand(cmd, ...args);
    },
    [editorApi],
  );

  const buttons: ButtonSpec[] = useMemo(
    () => [
      // History
      {
        id: "undo",
        icon: Undo,
        accessibilityLabel: t`撤销`,
        onPress: () => exec("undo"),
      },
      {
        id: "redo",
        icon: Redo,
        accessibilityLabel: t`重做`,
        onPress: () => exec("redo"),
      },
      // Inline formatting
      {
        id: "bold",
        icon: Bold,
        accessibilityLabel: t`加粗`,
        active: formatting.bold,
        onPress: () => exec("toggleBold"),
      },
      {
        id: "italic",
        icon: Italic,
        accessibilityLabel: t`斜体`,
        active: formatting.italic,
        onPress: () => exec("toggleItalic"),
      },
      {
        id: "strike",
        icon: Strikethrough,
        accessibilityLabel: t`删除线`,
        active: formatting.strikethrough,
        onPress: () => exec("toggleStrike"),
      },
      {
        id: "code",
        icon: Code,
        accessibilityLabel: t`行内代码`,
        active: formatting.code,
        onPress: () => exec("toggleCode"),
      },
      // Heading — taps open a BottomSheet to pick the level (Obsidian style)
      {
        id: "heading",
        icon: Heading,
        accessibilityLabel: t`标题`,
        active: formatting.heading >= 1,
        badge: formatting.heading >= 1 ? `H${formatting.heading}` : undefined,
        onPress: onRequestHeading,
      },
      // Lists
      {
        id: "ul",
        icon: List,
        accessibilityLabel: t`无序列表`,
        active: formatting.listType === "unordered",
        onPress: () => exec("toggleUnorderedList"),
      },
      {
        id: "ol",
        icon: ListOrdered,
        accessibilityLabel: t`有序列表`,
        active: formatting.listType === "ordered",
        onPress: () => exec("toggleOrderedList"),
      },
      {
        id: "check",
        icon: ListTodo,
        accessibilityLabel: t`任务列表`,
        active: formatting.listType === "check",
        onPress: () => exec("toggleCheckList"),
      },
      // Insert
      {
        id: "link",
        icon: Link,
        accessibilityLabel: t`链接`,
        onPress: () => exec("insertLink"),
      },
      {
        id: "image",
        icon: ImageIcon,
        accessibilityLabel: t`图片`,
        onPress: onRequestInsertImage,
      },
      // Indent
      {
        id: "indent-more",
        icon: ListIndentIncrease,
        accessibilityLabel: t`增加缩进`,
        onPress: () => exec("indentMore"),
      },
      {
        id: "indent-less",
        icon: ListIndentDecrease,
        accessibilityLabel: t`减少缩进`,
        onPress: () => exec("indentLess"),
      },
    ],
    [formatting, exec, t, onRequestInsertImage, onRequestHeading],
  );

  // Insert visual separators between logical groups.
  const separatorAfterIds = new Set(["redo", "code", "heading", "check", "image"]);

  return (
    <Animated.View
      collapsable={false}
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          left: TOOLBAR_HORIZONTAL_MARGIN,
          right: TOOLBAR_HORIZONTAL_MARGIN,
          bottom: 0,
          height: TOOLBAR_HEIGHT,
          backgroundColor: colors.card,
          borderRadius: TOOLBAR_HEIGHT / 2,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
          overflow: "hidden",
        },
        animatedStyle,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{
          paddingHorizontal: 16,
          alignItems: "center",
          height: TOOLBAR_HEIGHT,
        }}
      >
        {buttons.map((b, idx) => (
          <View key={b.id} style={{ flexDirection: "row", alignItems: "center" }}>
            <ToolbarButton spec={b} />
            {separatorAfterIds.has(b.id) && idx < buttons.length - 1 ? <Separator /> : null}
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}
