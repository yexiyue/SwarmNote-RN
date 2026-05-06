import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useLingui } from "@lingui/react/macro";
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  type LucideIcon,
  Type,
} from "lucide-react-native";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";

export type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface EditorHeadingSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface EditorHeadingSheetProps {
  /** Currently active heading level (0 = paragraph). Used to highlight the current row. */
  currentLevel: number;
  onSelect: (level: HeadingLevel) => void;
}

export const EditorHeadingSheet = forwardRef<EditorHeadingSheetRef, EditorHeadingSheetProps>(
  function EditorHeadingSheet({ currentLevel, onSelect }, ref) {
    const colors = useThemeColors();
    const { t } = useLingui();
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

    const items: Array<{ level: HeadingLevel; icon: LucideIcon; label: string }> = [
      { level: 0, icon: Type, label: t`无标题` },
      { level: 1, icon: Heading1, label: t`标题 1` },
      { level: 2, icon: Heading2, label: t`标题 2` },
      { level: 3, icon: Heading3, label: t`标题 3` },
      { level: 4, icon: Heading4, label: t`标题 4` },
      { level: 5, icon: Heading5, label: t`标题 5` },
      { level: 6, icon: Heading6, label: t`标题 6` },
    ];

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
              const active = currentLevel === item.level;
              return (
                <Pressable
                  key={item.level}
                  onPress={() => {
                    sheetRef.current?.dismiss();
                    onSelect(item.level);
                  }}
                  className="h-12 flex-row items-center gap-3 px-5 active:bg-muted"
                  style={{ backgroundColor: active ? colors.border : "transparent" }}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                >
                  <Icon color={active ? colors.foreground : colors.mutedForeground} size={20} />
                  <Text className="text-[15px] text-foreground">{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
