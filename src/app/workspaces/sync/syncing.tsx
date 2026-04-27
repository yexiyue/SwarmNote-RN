import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { ExternalLink, Info } from "lucide-react-native";
import { Fragment, useEffect, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SyncItemStatusRow } from "@/components/sync/sync-item-status-row";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { WARNING_FG, WARNING_TINT_SOFT } from "@/lib/theme-tokens";
import { errorMessage } from "@/lib/utils";
import { workspacesBaseDirUri } from "@/lib/workspace-naming";
import { syncKey, useSwarmStore } from "@/stores/swarm-store";
import { useSyncWizardStore, type WizardItem } from "@/stores/sync-wizard-store";

/** `SyncCompleted` is written to swarmStore as `{completed:0, total:0, cancelled}`;
 *  `cancelled === false` is the signal that a full_sync landed successfully. */
function isSyncCompletedOk(
  entry: { completed: number; total: number; cancelled?: boolean } | undefined,
): boolean {
  return entry !== undefined && entry.cancelled === false;
}

export default function SyncWizardSyncing() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useLingui();
  const items = useSyncWizardStore((s) => s.items);
  const updateItem = useSyncWizardStore((s) => s.updateItem);
  const didStartRef = useRef(false);
  const cancelledRef = useRef(false);

  // `didStartRef` survives StrictMode double-invoke / dev hot reloads;
  // `cancelledRef` blocks late writes after `done.tsx` runs `reset()`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot on mount; guarded by didStartRef
  useEffect(() => {
    if (didStartRef.current) return;
    const snapshot = useSyncWizardStore.getState().items;
    if (snapshot.length === 0) {
      router.replace("/workspaces/sync/done" as never);
      return;
    }
    didStartRef.current = true;
    cancelledRef.current = false;

    const run = async () => {
      const core = getAppCore();
      const base = workspacesBaseDirUri();
      const swarmState = useSwarmStore.getState();
      await Promise.allSettled(
        snapshot.map(async (wi, i) => {
          if (cancelledRef.current) return;

          // Race guard: SyncCompleted may have landed before Wizard mount
          // (e.g. user re-entered the wizard while a prior sync was wrapping up).
          const existing = swarmState.syncProgress[syncKey(wi.ws.uuid, wi.ws.peerId)];
          if (isSyncCompletedOk(existing)) {
            updateItem(i, { status: "done" });
            return;
          }

          updateItem(i, { status: "syncing" });
          let localPath: string | undefined;
          try {
            localPath = await core.createWorkspaceForSync(wi.ws.uuid, wi.ws.name, base);
          } catch (err) {
            if (!cancelledRef.current) {
              updateItem(i, { status: "error", error: errorMessage(err) });
            }
            return;
          }
          // Remember localPath so a failed triggerSyncWithPeer still lets the
          // Done screen open the (empty-but-registered) workspace.
          updateItem(i, { localPath });
          try {
            await core.triggerSyncWithPeer(wi.ws.uuid, wi.ws.peerId);
            // Keep status:"syncing" — SyncItemCompletedWatcher flips to done
            // once SyncCompleted{cancelled:false} lands on swarmStore.
          } catch (err) {
            if (!cancelledRef.current) {
              updateItem(i, { status: "error", error: errorMessage(err), localPath });
            }
          }
        }),
      );
    };

    void run();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Advance to Done only when every item reaches a terminal UI state.
  // Items start at "pending" so this doesn't fire before `run()` kicks off.
  useEffect(() => {
    if (items.length === 0) return;
    const allSettled = items.every((it) => it.status === "done" || it.status === "error");
    if (allSettled && !cancelledRef.current) {
      router.replace("/workspaces/sync/done" as never);
    }
  }, [items, router]);

  const title = items.length === 1 ? t`正在同步` : t`正在同步 ${items.length} 个工作区`;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="h-13 flex-row items-center justify-center px-4">
        <Text className="text-[16px] font-semibold text-foreground">{title}</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-2.5 px-4 pt-2 pb-4"
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, idx) => (
          <Fragment key={item.ws.uuid}>
            <SyncItemStatusRow item={item} live />
            <SyncItemCompletedWatcher index={idx} item={item} cancelledRef={cancelledRef} />
          </Fragment>
        ))}

        <View
          className="mt-2 flex-row items-center gap-2.5 rounded-[10px] px-3.5 py-2.5"
          style={{ backgroundColor: WARNING_TINT_SOFT }}
        >
          <Info color={WARNING_FG} size={14} />
          <Text
            style={{ color: WARNING_FG }}
            className="flex-1 text-[11px] font-medium leading-normal"
          >
            <Trans>同步期间请保持两台设备在线，可切到后台。</Trans>
          </Text>
        </View>
      </ScrollView>

      <View className="border-t border-border px-5 py-3 bg-background">
        <Pressable
          onPress={() => router.dismissAll()}
          accessibilityLabel={t`后台运行`}
          className="h-10 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-background active:bg-muted"
        >
          <ExternalLink color={colors.foreground} size={14} />
          <Text className="text-[13px] font-medium text-foreground">
            <Trans>后台运行</Trans>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface WatcherProps {
  index: number;
  item: WizardItem;
  cancelledRef: React.RefObject<boolean>;
}

/** Headless per-item listener: flips the wizard item to `done` once the
 *  backend `full_sync` emits `SyncCompleted{cancelled:false}`. Cancelled
 *  completions are ignored — no user-facing cancel path exists today. */
function SyncItemCompletedWatcher({ index, item, cancelledRef }: WatcherProps) {
  const entry = useSwarmStore((s) => s.syncProgress[syncKey(item.ws.uuid, item.ws.peerId)]);
  const updateItem = useSyncWizardStore((s) => s.updateItem);
  useEffect(() => {
    if (cancelledRef.current) return;
    if (item.status !== "syncing") return;
    if (isSyncCompletedOk(entry)) {
      updateItem(index, { status: "done" });
    }
  }, [entry, item.status, index, updateItem, cancelledRef]);
  return null;
}
