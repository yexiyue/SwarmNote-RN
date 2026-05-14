import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
} from "@gorhom/bottom-sheet";
import type { WikilinkItem, WikilinkTriggerMatch } from "@swarmnote/editor-core";
import { FileText, type LucideIcon } from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";

const DEFAULT_ICON_REGISTRY: Record<string, LucideIcon> = {
  "file-text": FileText,
};

interface WikilinkSheetProps {
  match: WikilinkTriggerMatch | null;
  onPick: (index: number) => void;
  onDismiss?: () => void;
  /** Title above the list. Defaults to "Link to note". */
  headerLabel?: string;
  /** Text shown when no items match. Defaults to "No matching notes". */
  emptyLabel?: string;
  iconRegistry?: Record<string, LucideIcon>;
}

function hsl(v: string | undefined): string {
  return v ? `hsl(${v})` : "transparent";
}

/**
 * Obsidian-style wikilink picker for React Native, styled via NativeWind
 * className. Consumes host theme tokens (`bg-background` / `text-foreground`
 * / `bg-accent` / `text-muted-foreground`) — same names as shadcn Web.
 * Auto-adapts to dark mode through CSS variables in `src/global.css`.
 *
 * Host MUST wrap its app in `<BottomSheetModalProvider>` for portal rendering.
 */
export function WikilinkSheet({
  match,
  onPick,
  onDismiss,
  headerLabel = "Link to note",
  emptyLabel = "No matching notes",
  iconRegistry,
}: WikilinkSheetProps) {
  const background = hsl(useUnstableNativeVariable("--background"));
  const foreground = hsl(useUnstableNativeVariable("--foreground"));
  const accentForeground = hsl(useUnstableNativeVariable("--accent-foreground"));
  const mutedForeground = hsl(useUnstableNativeVariable("--muted-foreground"));

  const icons = iconRegistry
    ? { ...DEFAULT_ICON_REGISTRY, ...iconRegistry }
    : DEFAULT_ICON_REGISTRY;
  const sheetRef = useRef<BottomSheetModal>(null);
  const active = match?.active ?? false;
  const items: WikilinkItem[] = match?.items ?? [];
  const activeIndex = match?.activeIndex ?? 0;
  const snapPoints = useMemo(() => ["50%"], []);

  useEffect(() => {
    if (active) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [active]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.4}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleDismiss = useCallback(() => {
    if (active) onDismiss?.();
  }, [active, onDismiss]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: background }}
      handleIndicatorStyle={{ backgroundColor: mutedForeground }}
    >
      <View className="px-2 pb-1">
        <Text className="px-2 py-1 text-[11px] text-muted-foreground">{headerLabel}</Text>
      </View>
      {items.length === 0 ? (
        <Text className="px-4 py-2 text-muted-foreground">{emptyLabel}</Text>
      ) : (
        <BottomSheetFlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={({ item, index }) => {
            const Icon = item.icon ? icons[item.icon] : undefined;
            const isActive = index === activeIndex;
            return (
              <Pressable
                onPress={() => onPick(index)}
                className={`mx-2 flex-row items-start gap-3 rounded-md border-b border-border px-3 py-2.5 ${
                  isActive ? "bg-accent" : "active:bg-muted"
                }`}
              >
                {Icon ? (
                  <Icon
                    size={18}
                    color={isActive ? accentForeground : foreground}
                    style={{ marginTop: 2 }}
                  />
                ) : item.icon ? (
                  <Text
                    className={
                      isActive ? "text-base text-accent-foreground" : "text-base text-foreground"
                    }
                  >
                    {item.icon}
                  </Text>
                ) : null}
                <View className="flex-1">
                  <Text
                    className={
                      isActive
                        ? "text-[15px] text-accent-foreground"
                        : "text-[15px] text-foreground"
                    }
                  >
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground">{item.description}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </BottomSheetModal>
  );
}
