import { useLingui } from "@lingui/react/macro";
import { Circle, CircleCheck, LoaderCircle, type LucideIcon, XCircle } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { syncKey, useSwarmStore } from "@/stores/swarm-store";
import type { WizardItem, WizardItemStatus } from "@/stores/sync-wizard-store";

interface Props {
  item: WizardItem;
  /** When `true`, subscribes to live progress from swarm-store and renders a
   *  progress bar while `status === "syncing"`. Used by the wizard's syncing
   *  screen; the done screen passes `false`. */
  live: boolean;
}

export function SyncItemStatusRow({ item, live }: Props) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const entry = useSwarmStore((s) =>
    live ? s.syncProgress[syncKey(item.ws.uuid, item.ws.peerId)] : undefined,
  );
  const hasProgress =
    live &&
    item.status === "syncing" &&
    entry !== undefined &&
    entry.total > 0 &&
    entry.cancelled === undefined;
  const percent = hasProgress ? Math.round((entry.completed / entry.total) * 100) : 0;

  const { Icon, iconColor } = statusVisual(item.status, colors);
  const subtitle = (() => {
    switch (item.status) {
      case "error":
        return item.error ?? t`同步失败`;
      case "done": {
        const count = item.ws.docCount;
        return t`同步完成 · ${count} 篇笔记`;
      }
      case "syncing":
        if (hasProgress && entry !== undefined) {
          return `${entry.completed} / ${entry.total}`;
        }
        return t`准备同步 · ${item.ws.docCount} 篇笔记`;
      default:
        return t`${item.ws.docCount} 篇笔记`;
    }
  })();

  return (
    <View className="gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5">
      <View className="flex-row items-center gap-3">
        <Icon color={iconColor} size={18} />
        <View className="flex-1 gap-0.5">
          <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
            {item.ws.name}
          </Text>
          <Text
            className="text-[11px]"
            style={{ color: item.status === "error" ? colors.destructive : colors.mutedForeground }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>
        {hasProgress ? (
          <Text className="text-[12px] font-medium text-muted-foreground">{percent}%</Text>
        ) : null}
      </View>
      {hasProgress ? (
        <View
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ backgroundColor: colors.border }}
        >
          <View
            className="h-full rounded-full"
            style={{ backgroundColor: colors.primary, width: `${percent}%` }}
          />
        </View>
      ) : null}
    </View>
  );
}

type Colors = ReturnType<typeof useThemeColors>;

function statusVisual(
  status: WizardItemStatus,
  colors: Colors,
): { Icon: LucideIcon; iconColor: string } {
  switch (status) {
    case "done":
      return { Icon: CircleCheck, iconColor: colors.success };
    case "error":
      return { Icon: XCircle, iconColor: colors.destructive };
    case "syncing":
      return { Icon: LoaderCircle, iconColor: colors.primary };
    default:
      return { Icon: Circle, iconColor: colors.mutedForeground };
  }
}
