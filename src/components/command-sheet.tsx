import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { FolderPlus, Info, type LucideIcon, Search, Settings } from "lucide-react-native";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";

export interface CommandSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}

interface CommandSheetProps {
  onQuickSwitch: () => void;
  onNewFolder: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

export const CommandSheet = forwardRef<CommandSheetRef, CommandSheetProps>(function CommandSheet(
  { onQuickSwitch, onNewFolder, onOpenSettings, onOpenAbout },
  ref,
) {
  const colors = useThemeColors();
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.4}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const items: CommandItem[] = [
    { id: "switch", label: "快速切换笔记", icon: Search, onPress: onQuickSwitch },
    { id: "folder", label: "新建文件夹", icon: FolderPlus, onPress: onNewFolder },
    { id: "settings", label: "设置", icon: Settings, onPress: onOpenSettings },
    { id: "about", label: "关于", icon: Info, onPress: onOpenAbout },
  ];

  const dismissThen = (cb: () => void) => {
    sheetRef.current?.dismiss();
    cb();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView>
        <View className="pb-2 pt-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                onPress={() => dismissThen(item.onPress)}
                className="flex-row items-center gap-3 px-5 h-12 active:bg-muted"
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Icon color={colors.mutedForeground} size={18} />
                <Text className="text-[15px] text-foreground">{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
