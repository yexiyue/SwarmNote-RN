import { useLingui } from "@lingui/react/macro";
import { Menu, Plus, Search } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useKeyboardState, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/useThemeColors";

interface BottomCommandBarProps {
  onSearch: () => void;
  onNew: () => void;
  onMenu: () => void;
}

/**
 * 悬浮底部胶囊工具栏 (h-13 rounded-full bg-card)。
 * 仅在 workspace 主屏 / 笔记编辑器页展示，files / settings modal 不使用。
 *
 * 与 EditorToolbar 互斥：键盘弹起时淡出并下沉，让位给工具栏；键盘收起后恢复。
 */
export function BottomCommandBar({ onSearch, onNew, onMenu }: BottomCommandBarProps) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const { isVisible: keyboardVisible } = useKeyboardState();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: progress.value * 80 }],
  }));

  return (
    <Animated.View
      pointerEvents={keyboardVisible ? "none" : "box-none"}
      style={[{ bottom: insets.bottom + 16 }, animatedStyle]}
      className="absolute left-5 right-5"
    >
      <View
        className="h-13 flex-row items-center rounded-full border border-border bg-card px-7"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <PillButton onPress={onSearch} label={t`搜索`}>
          <Search color={colors.mutedForeground} size={20} />
        </PillButton>
        <PillButton onPress={onNew} label={t`新建`}>
          <Plus color={colors.mutedForeground} size={22} />
        </PillButton>
        <PillButton onPress={onMenu} label={t`命令`}>
          <Menu color={colors.mutedForeground} size={20} />
        </PillButton>
      </View>
    </Animated.View>
  );
}

function PillButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="flex-1 h-full items-center justify-center"
    >
      {children}
    </Pressable>
  );
}
