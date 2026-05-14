import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
} from "@gorhom/bottom-sheet";
import type { SlashItem, SlashTriggerMatch } from "@swarmnote/editor-core";
import {
  CircleAlert,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Lightbulb,
  List,
  ListOrdered,
  ListTodo,
  type LucideIcon,
  Minus,
  OctagonAlert,
  Quote,
  Sigma,
  StickyNote,
  Table as TableIcon,
  TriangleAlert,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";

const DEFAULT_ICON_REGISTRY: Record<string, LucideIcon> = {
  // basic blocks
  "heading-1": Heading1,
  "heading-2": Heading2,
  "heading-3": Heading3,
  list: List,
  "list-ordered": ListOrdered,
  "list-todo": ListTodo,
  quote: Quote,
  minus: Minus,
  "file-text": FileText,
  // built-in plugins
  table: TableIcon,
  sigma: Sigma,
  "square-code": Code,
  image: ImageIcon,
  // admonition variants
  "sticky-note": StickyNote,
  lightbulb: Lightbulb,
  "triangle-alert": TriangleAlert,
  "circle-alert": CircleAlert,
  "octagon-alert": OctagonAlert,
};

interface SlashSheetProps {
  match: SlashTriggerMatch | null;
  onPick: (index: number) => void;
  onDismiss?: () => void;
  /** Title rendered at the top of the sheet. Defaults to "Slash commands". */
  headerLabel?: string;
  /** Text shown when `match.items` is empty. Defaults to "No matching commands". */
  emptyLabel?: string;
  /**
   * Optional icon registry override. Items with an unknown icon name fall
   * back to text rendering (legacy emoji strings still display).
   */
  iconRegistry?: Record<string, LucideIcon>;
}

function hsl(v: string | undefined): string {
  return v ? `hsl(${v})` : "transparent";
}

/**
 * Notion-style slash command picker for React Native, styled via NativeWind
 * className. Consumes host theme tokens (`bg-background` / `text-foreground`
 * / `bg-accent` / `text-muted-foreground` etc.) — same names as shadcn Web.
 * Auto-adapts to dark mode through CSS variables in `src/global.css`.
 *
 * Reactively bound to `match.active`: `present()`s when active, `dismiss()`es
 * when inactive. Backdrop tap + pan-down close. Host MUST wrap its app in
 * `<BottomSheetModalProvider>` (typically in `_layout.tsx`) for portal
 * rendering — without it the sheet sits inline under bottom toolbars.
 *
 * Icons default to lucide-react-native via the built-in `iconRegistry`.
 */
export function SlashSheet({
  match,
  onPick,
  onDismiss,
  headerLabel = "Slash commands",
  emptyLabel = "No matching commands",
  iconRegistry,
}: SlashSheetProps) {
  const background = hsl(useUnstableNativeVariable("--background"));
  const foreground = hsl(useUnstableNativeVariable("--foreground"));
  const accentForeground = hsl(useUnstableNativeVariable("--accent-foreground"));
  const mutedForeground = hsl(useUnstableNativeVariable("--muted-foreground"));

  const icons = iconRegistry
    ? { ...DEFAULT_ICON_REGISTRY, ...iconRegistry }
    : DEFAULT_ICON_REGISTRY;
  const sheetRef = useRef<BottomSheetModal>(null);
  const active = match?.active ?? false;
  const items: SlashItem[] = match?.items ?? [];
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
            const prevSection = index > 0 ? items[index - 1].section : undefined;
            const showSection = item.section && item.section !== prevSection;
            const isActive = index === activeIndex;
            return (
              <View>
                {showSection ? (
                  <Text className="px-4 pt-3 pb-1 text-[11px] font-medium text-muted-foreground">
                    {item.section}
                  </Text>
                ) : null}
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
                      <Text className="mt-0.5 text-xs text-muted-foreground">
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </BottomSheetModal>
  );
}
