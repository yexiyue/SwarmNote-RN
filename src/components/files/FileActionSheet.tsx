import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { ClipboardCopy, type LucideIcon, Pencil, Trash2 } from "lucide-react-native";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Pressable, View } from "react-native";
import type { UniffiFileTreeNode } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";

export interface FileActionSheetRef {
  present(target: UniffiFileTreeNode): void;
  dismiss(): void;
}

interface FileActionSheetProps {
  onRename(node: UniffiFileTreeNode): void;
  onDelete(node: UniffiFileTreeNode): void;
  onCopyPath(node: UniffiFileTreeNode): void;
}

interface ActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  run(node: UniffiFileTreeNode): void;
}

export const FileActionSheet = forwardRef<FileActionSheetRef, FileActionSheetProps>(
  function FileActionSheet({ onRename, onDelete, onCopyPath }, ref) {
    const colors = useThemeColors();
    const sheetRef = useRef<BottomSheetModal>(null);
    const targetRef = useRef<UniffiFileTreeNode | null>(null);

    useImperativeHandle(ref, () => ({
      present: (target) => {
        targetRef.current = target;
        sheetRef.current?.present();
      },
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

    const items: ActionItem[] = [
      { id: "rename", label: "重命名", icon: Pencil, run: onRename },
      { id: "copy-path", label: "复制路径", icon: ClipboardCopy, run: onCopyPath },
      { id: "delete", label: "删除", icon: Trash2, destructive: true, run: onDelete },
    ];

    const dismissThen = (cb: (node: UniffiFileTreeNode) => void) => {
      const node = targetRef.current;
      sheetRef.current?.dismiss();
      if (node !== null) cb(node);
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
              const iconColor = item.destructive ? colors.destructive : colors.mutedForeground;
              const textClassName = item.destructive
                ? "text-[15px] text-destructive"
                : "text-[15px] text-foreground";
              return (
                <Pressable
                  key={item.id}
                  onPress={() => dismissThen(item.run)}
                  className="flex-row items-center gap-3 px-5 h-12 active:bg-muted"
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Icon color={iconColor} size={18} />
                  <Text className={textClassName}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
