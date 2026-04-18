import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Check, type LucideIcon, Monitor, Moon, Sun } from "lucide-react-native";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemePreference } from "@/lib/theme-persistence";

export interface ThemePickerSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface ThemePickerSheetProps {
  current: ThemePreference;
  onSelect: (next: ThemePreference) => void;
}

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
];

export const ThemePickerSheet = forwardRef<ThemePickerSheetRef, ThemePickerSheetProps>(
  function ThemePickerSheet({ current, onSelect }, ref) {
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
          <Text className="px-5 pt-2 pb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            外观
          </Text>
          <View className="pb-2">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = opt.value === current;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    sheetRef.current?.dismiss();
                    onSelect(opt.value);
                  }}
                  className="flex-row items-center gap-3 px-5 h-12 active:bg-muted"
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  <Icon color={colors.mutedForeground} size={18} />
                  <Text className="flex-1 text-[15px] text-foreground">{opt.label}</Text>
                  {selected ? <Check color={colors.primary} size={18} /> : null}
                </Pressable>
              );
            })}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
