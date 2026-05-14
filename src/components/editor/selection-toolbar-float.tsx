import type { SelectionToolbarMatch } from "@swarmnote/editor-core";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  type LucideIcon,
  Strikethrough,
} from "lucide-react-native";
import { useUnstableNativeVariable } from "nativewind";
import { Pressable, Text, View } from "react-native";

const DEFAULT_ICON_REGISTRY: Record<string, LucideIcon> = {
  bold: Bold,
  italic: Italic,
  strikethrough: Strikethrough,
  code: Code,
  link: LinkIcon,
};

interface SelectionToolbarFloatProps {
  /**
   * Current selection toolbar match. RN host subscribes to the WebView's
   * `selectionToolbarChange` event via `useEditorBridge` and forwards.
   * Pass `null` (or match with `active: false`) to hide.
   */
  match: SelectionToolbarMatch | null;
  /** Called when an action button is tapped. Host wires to `editorApi.execCommand(commandId)`. */
  onAction: (commandId: string) => void;
  /**
   * Optional icon registry override. `action.icon` strings map to lucide
   * components. Unknown names fall back to plain `action.title` text.
   */
  iconRegistry?: Record<string, LucideIcon>;
  /**
   * Pixel offset above the selection rect. Default 48 (~ one toolbar
   * row height). Set higher if your toolbar wraps.
   */
  topOffset?: number;
}

function hsl(v: string | undefined): string {
  return v ? `hsl(${v})` : "transparent";
}

/**
 * iOS-native style selection floating toolbar for React Native — anchored
 * above the current text selection (caret rect from `match.screenRect`).
 *
 * Styled via NativeWind className (`bg-popover` / `text-popover-foreground`
 * etc.). Same theme tokens as shadcn Web; auto dark-mode.
 *
 * Action icons render via `iconRegistry` — defaults map bold / italic /
 * strike / code / link to `lucide-react-native`. Unknown icon strings fall
 * back to title text.
 */
export function SelectionToolbarFloat({
  match,
  onAction,
  iconRegistry,
  topOffset = 48,
}: SelectionToolbarFloatProps) {
  const popoverForeground = hsl(useUnstableNativeVariable("--popover-foreground"));

  const icons = iconRegistry
    ? { ...DEFAULT_ICON_REGISTRY, ...iconRegistry }
    : DEFAULT_ICON_REGISTRY;
  const active = match?.active ?? false;
  const actions = match?.actions ?? [];
  const screenRect = match?.screenRect;

  if (!active || actions.length === 0) return null;

  // Anchor above the selection if screenRect is available; otherwise center top.
  const anchorStyle = screenRect
    ? { top: Math.max(8, screenRect.y - topOffset), left: screenRect.x }
    : { top: 60, alignSelf: "center" as const };

  return (
    <View
      style={anchorStyle}
      className="absolute flex-row gap-1 rounded-lg bg-popover p-1 shadow-md"
    >
      {actions.map((action) => {
        const Icon = icons[action.icon];
        return (
          <Pressable
            key={action.id}
            accessibilityLabel={action.title}
            onPress={() => onAction(action.commandId)}
            className="items-center justify-center rounded-md px-2.5 py-1.5 active:bg-muted"
          >
            {Icon ? (
              <Icon size={18} color={popoverForeground} />
            ) : (
              <Text className="text-sm text-popover-foreground">{action.title}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
