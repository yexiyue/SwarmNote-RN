import { useLingui } from "@lingui/react/macro";
import {
  ArrowUpNarrowWide,
  ChevronsDownUp,
  FolderPlus,
  type LucideIcon,
  SquarePen,
  X,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

interface FilesToolbarProps {
  onNewNote: () => void;
  onNewFolder: () => void;
  onSort: () => void;
  onCollapseAll: () => void;
  onClose: () => void;
}

export function FilesToolbar({
  onNewNote,
  onNewFolder,
  onSort,
  onCollapseAll,
  onClose,
}: FilesToolbarProps) {
  const { t } = useLingui();
  return (
    <View className="h-13 flex-row items-center justify-around border-t border-border px-5">
      <ToolButton icon={SquarePen} label={t`新建笔记`} onPress={onNewNote} />
      <ToolButton icon={FolderPlus} label={t`新建文件夹`} onPress={onNewFolder} />
      <ToolButton icon={ArrowUpNarrowWide} label={t`排序`} onPress={onSort} />
      <ToolButton icon={ChevronsDownUp} label={t`折叠全部`} onPress={onCollapseAll} />
      <ToolButton icon={X} label={t`关闭`} onPress={onClose} />
    </View>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="h-10 w-10 items-center justify-center rounded-lg active:bg-muted"
    >
      <Icon color={colors.mutedForeground} size={20} />
    </Pressable>
  );
}
