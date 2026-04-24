import { useRouter } from "expo-router";
import { ExternalLink, Info } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SyncItemStatusRow } from "@/components/sync/sync-item-status-row";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { WARNING_FG, WARNING_TINT_SOFT } from "@/lib/theme-tokens";
import { errorMessage } from "@/lib/utils";
import { workspacesBaseDirUri } from "@/lib/workspace-naming";
import { useSyncWizardStore } from "@/stores/sync-wizard-store";

export default function SyncWizardSyncing() {
  const router = useRouter();
  const colors = useThemeColors();
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
      await Promise.allSettled(
        snapshot.map(async (wi, i) => {
          if (cancelledRef.current) return;
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
          try {
            await core.triggerSyncWithPeer(wi.ws.uuid, wi.ws.peerId);
            if (!cancelledRef.current) updateItem(i, { status: "done", localPath });
          } catch (err) {
            if (!cancelledRef.current) {
              // localPath preserved so Done screen can still open the empty workspace
              updateItem(i, { status: "error", error: errorMessage(err), localPath });
            }
          }
        }),
      );
      if (!cancelledRef.current) router.replace("/workspaces/sync/done" as never);
    };

    void run();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const title = items.length === 1 ? "正在同步" : `正在同步 ${items.length} 个工作区`;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="h-13 flex-row items-center justify-center px-4">
        <Text className="text-[16px] font-semibold text-foreground">{title}</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-2.5 px-4 pt-2 pb-4"
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <SyncItemStatusRow key={item.ws.uuid} item={item} live />
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
            同步期间请保持两台设备在线，可切到后台。
          </Text>
        </View>
      </ScrollView>

      <View className="border-t border-border px-5 py-3 bg-background">
        <Pressable
          onPress={() => router.dismissAll()}
          accessibilityLabel="后台运行"
          className="h-10 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-background active:bg-muted"
        >
          <ExternalLink color={colors.foreground} size={14} />
          <Text className="text-[13px] font-medium text-foreground">后台运行</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
