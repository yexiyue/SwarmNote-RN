import { useLingui } from "@lingui/react/macro";
import { Pause, RefreshCw, WifiOff } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { formatLastSyncedAt } from "@/lib/time-format";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { syncKey, useSwarmStore } from "@/stores/swarm-store";
import { useSyncPersistStore } from "@/stores/sync-persist-store";

interface WorkspaceSyncCardProps {
  workspaceId: string;
}

export function WorkspaceSyncCard({ workspaceId }: WorkspaceSyncCardProps) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const pairedDevices = useSwarmStore((s) => s.pairedDevices);
  const syncProgress = useSwarmStore((s) => s.syncProgress);
  const lastSyncedAt = useSyncPersistStore((s) => s.lastSyncedAt[workspaceId]);

  const onlineDevices = useMemo(
    () => pairedDevices.filter((d) => d.isOnline === true),
    [pairedDevices],
  );
  const onlineCount = onlineDevices.length;

  const activeSync = useMemo(() => {
    for (const device of onlineDevices) {
      const entry = syncProgress[syncKey(workspaceId, device.peerId)];
      if (entry === undefined || entry.cancelled !== undefined) continue;
      if (entry.total > 0 || entry.completed > 0) return entry;
    }
    return null;
  }, [syncProgress, workspaceId, onlineDevices]);

  const offline = onlineCount === 0;
  const syncing = activeSync !== null;

  const handleSyncNow = () => {
    if (offline) return;
    const core = getAppCore();
    const devices = onlineDevices;
    const promise = Promise.allSettled(
      devices.map((device) => core.triggerSyncWithPeer(workspaceId, device.peerId)),
    ).then((results) => {
      const failures = results.flatMap((r, i) =>
        r.status === "rejected"
          ? [`${devices[i].name ?? devices[i].hostname}: ${errorMessage(r.reason)}`]
          : [],
      );
      if (failures.length === devices.length && devices.length > 0) {
        throw new Error(failures.join("\n"));
      }
      return failures;
    });

    toast.promise(promise, {
      loading: t`正在同步…`,
      success: (failures) => (failures.length === 0 ? t`同步完成` : t`部分设备同步失败`),
      error: t`同步失败`,
    });
  };

  const dotColor = offline ? colors.mutedForeground : colors.success;
  let statusLabel: string;
  if (offline) statusLabel = t`暂无在线设备`;
  else if (syncing) statusLabel = t`同步中`;
  else statusLabel = t`已同步`;

  const metaParts: string[] = [];
  if (!offline) metaParts.push(t`与 ${onlineCount} 台设备保持同步`);
  if (!syncing && lastSyncedAt !== undefined) {
    metaParts.push(t`最后同步 ${formatLastSyncedAt(lastSyncedAt)}`);
  }
  const metaLine = metaParts.join(" · ");

  return (
    <View className="rounded-xl border border-border bg-card p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <View style={{ backgroundColor: dotColor }} className="h-2 w-2 rounded-full" />
        <Text className="text-[14px] font-semibold text-foreground">{statusLabel}</Text>
        {syncing && activeSync !== null && activeSync.total > 0 ? (
          <Text className="text-[11px] text-muted-foreground">
            {activeSync.completed}/{activeSync.total}
          </Text>
        ) : null}
      </View>

      {metaLine.length > 0 ? (
        <Text className="text-[11px] text-muted-foreground">{metaLine}</Text>
      ) : offline ? (
        <View className="flex-row items-center gap-1.5">
          <WifiOff color={colors.mutedForeground} size={12} />
          <Text className="text-[11px] text-muted-foreground">
            {t`请先配对设备或等待已配对设备上线`}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={handleSyncNow}
          disabled={offline}
          accessibilityLabel={t`立即同步`}
          className="flex-1 h-10 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-background active:bg-muted disabled:opacity-50"
        >
          <RefreshCw color={colors.foreground} size={14} />
          <Text className="text-[13px] font-medium text-foreground">{t`立即同步`}</Text>
        </Pressable>

        <View className="items-center gap-1">
          <Pressable
            disabled
            accessibilityLabel={t`暂停 · 即将推出`}
            accessibilityState={{ disabled: true }}
            className="h-10 w-10 items-center justify-center rounded-lg border border-border bg-background opacity-50"
          >
            <Pause color={colors.mutedForeground} size={16} />
          </Pressable>
          <Text className="text-[9px] text-muted-foreground">{t`即将推出`}</Text>
        </View>
      </View>
    </View>
  );
}
