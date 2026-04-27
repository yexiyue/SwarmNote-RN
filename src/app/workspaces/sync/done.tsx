import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { CircleCheck, ExternalLink, XCircle } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SyncItemStatusRow } from "@/components/sync/sync-item-status-row";
import { Text } from "@/components/ui/text";
import { switchWorkspace } from "@/core/workspace-manager";
import { useThemeColors } from "@/hooks/useThemeColors";
import { errorMessage } from "@/lib/utils";
import { useSyncWizardStore, type WizardItem } from "@/stores/sync-wizard-store";

export default function SyncWizardDone() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useLingui();
  const items = useSyncWizardStore((s) => s.items);
  const reset = useSyncWizardStore((s) => s.reset);
  const [opening, setOpening] = useState(false);

  const { doneCount, errorCount, firstDone } = useMemo(() => summarize(items), [items]);

  const handleDismiss = () => {
    reset();
    router.dismissAll();
  };

  const handleOpen = async () => {
    if (firstDone === undefined || firstDone.localPath === undefined) return;
    setOpening(true);
    try {
      await switchWorkspace(firstDone.localPath);
      reset();
      router.dismissAll();
    } catch (err) {
      Alert.alert(t`打开失败`, errorMessage(err));
    } finally {
      setOpening(false);
    }
  };

  let title: string;
  if (errorCount === 0) title = t`同步完成`;
  else if (doneCount === 0) title = t`同步失败`;
  else title = t`同步完成（部分失败）`;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="h-13 flex-row items-center justify-center px-4">
        <Text className="text-[16px] font-semibold text-foreground">{title}</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-3 pb-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-2 py-4">
          {errorCount === 0 ? (
            <CircleCheck color={colors.success} size={48} strokeWidth={1.5} />
          ) : (
            <XCircle color={colors.destructive} size={48} strokeWidth={1.5} />
          )}
          <Text className="text-[13px] text-muted-foreground">
            {t`${doneCount} 个成功 · ${errorCount} 个失败`}
          </Text>
        </View>

        <View className="gap-2.5">
          {items.map((item) => (
            <SyncItemStatusRow key={item.ws.uuid} item={item} live={false} />
          ))}
        </View>
      </ScrollView>

      <View className="border-t border-border px-5 py-3 bg-background gap-2">
        {firstDone !== undefined ? (
          <Pressable
            onPress={handleOpen}
            disabled={opening}
            accessibilityLabel={t`打开工作区`}
            className="h-10 flex-row items-center justify-center gap-2 rounded-lg bg-primary disabled:opacity-60"
          >
            {opening ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <ExternalLink color={colors.background} size={14} />
            )}
            <Text className="text-[13px] font-semibold text-primary-foreground">
              {t`打开 ${firstDone.ws.name}`}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleDismiss}
          accessibilityLabel={t`完成`}
          className="h-10 flex-row items-center justify-center rounded-lg border border-border bg-background active:bg-muted"
        >
          <Text className="text-[13px] font-medium text-foreground">
            <Trans>完成</Trans>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function summarize(items: WizardItem[]): {
  doneCount: number;
  errorCount: number;
  firstDone: WizardItem | undefined;
} {
  let doneCount = 0;
  let errorCount = 0;
  let firstDone: WizardItem | undefined;
  for (const item of items) {
    if (item.status === "done") {
      doneCount++;
      if (firstDone === undefined && item.localPath !== undefined) firstDone = item;
    } else if (item.status === "error") {
      errorCount++;
    }
  }
  return { doneCount, errorCount, firstDone };
}
