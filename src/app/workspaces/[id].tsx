import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  FolderClosed,
  type LucideIcon,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiRecentWorkspace } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { getActiveWorkspaceOrNull, switchWorkspace } from "@/core/workspace-manager";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useRecentWorkspacesStore } from "@/stores/recent-workspaces-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function WorkspaceDetail() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ id: string }>();
  const targetPath = useMemo(
    () => (typeof params.id === "string" ? decodeURIComponent(params.id) : null),
    [params.id],
  );

  const items = useRecentWorkspacesStore((s) => s.items);
  const refresh = useRecentWorkspacesStore((s) => s.refresh);
  const activeInfo = useWorkspaceStore((s) => s.info);
  const workspace = useMemo(
    () => items?.find((w) => w.path === targetPath) ?? null,
    [items, targetPath],
  );
  const isActive = activeInfo !== null && activeInfo.path === targetPath;
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (targetPath === null) {
    return <MissingWorkspace message="无效的工作区路径" onBack={() => router.back()} />;
  }
  if (items !== null && workspace === null) {
    return <MissingWorkspace message="工作区不存在" onBack={() => router.back()} />;
  }

  const handleOpen = async () => {
    if (isActive || workspace === null) return;
    setSwitching(true);
    try {
      await switchWorkspace(workspace.path);
      router.dismissAll();
      router.replace("/(main)" as never);
    } catch (err) {
      Alert.alert("打开失败", err instanceof Error ? err.message : String(err));
    } finally {
      setSwitching(false);
    }
  };

  const handleCopyId = async () => {
    const id = workspace?.uuid ?? activeInfo?.id;
    if (id === undefined || id === null) return;
    await Clipboard.setStringAsync(id);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <View className="h-13 flex-row items-center gap-3 px-4">
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="返回">
          <ArrowLeft color={colors.foreground} size={22} />
        </Pressable>
        <Text className="text-[16px] font-semibold text-foreground">工作区详情</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {workspace === null ? (
          <View className="h-32 items-center justify-center">
            <ActivityIndicator color={colors.mutedForeground} />
          </View>
        ) : (
          <>
            <InfoCard workspace={workspace} isActive={isActive} onCopyId={handleCopyId} />

            <View className="gap-2">
              <Text className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                操作
              </Text>
              <View className="rounded-xl border border-border bg-card overflow-hidden">
                <ActionRow
                  icon={ExternalLink}
                  label={isActive ? "当前工作区" : "打开工作区"}
                  disabled={isActive}
                  badge={isActive ? "使用中" : undefined}
                  onPress={handleOpen}
                  loading={switching}
                />
                <RowDivider />
                <ActionRow icon={Pencil} label="重命名" disabled badge="即将推出" />
                <RowDivider />
                <ActionRow icon={Trash2} label="删除" disabled destructive badge="即将推出" />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({
  workspace,
  isActive,
  onCopyId,
}: {
  workspace: UniffiRecentWorkspace;
  isActive: boolean;
  onCopyId: () => void;
}) {
  const colors = useThemeColors();
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setDocCount(null);
      return;
    }
    const active = getActiveWorkspaceOrNull();
    if (active === null) return;
    let cancelled = false;
    active
      .listDocuments()
      .then((docs) => {
        if (!cancelled) setDocCount(docs.length);
      })
      .catch((err: unknown) => {
        console.warn("[workspace-detail] listDocuments failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const displayId = workspace.uuid ?? "—";
  const truncatedId = truncateUuid(displayId);

  return (
    <View className="rounded-xl border border-border bg-card overflow-hidden">
      <View className="flex-row items-center gap-3 px-4 pt-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <FolderClosed color={colors.primary} size={20} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {workspace.name}
          </Text>
        </View>
        {isActive ? (
          <View className="flex-row items-center gap-1 rounded-md bg-primary/10 px-2 py-1">
            <CheckCircle2 color={colors.primary} size={12} />
            <Text className="text-[10px] font-medium text-primary">当前</Text>
          </View>
        ) : null}
      </View>

      <Text className="px-4 pt-1 pb-4 text-[11px] text-muted-foreground">
        应用空间{docCount !== null ? `  ·  ${docCount} 个笔记` : ""}
      </Text>

      <View className="mx-4 h-px bg-border" />

      <View className="flex-row items-center gap-2 px-4 py-3">
        <Text className="text-[11px] text-muted-foreground">工作区 ID</Text>
        <Text className="flex-1 text-[11px] font-mono text-foreground" numberOfLines={1}>
          {truncatedId}
        </Text>
        <Pressable
          onPress={onCopyId}
          disabled={displayId === "—"}
          hitSlop={8}
          accessibilityLabel="复制工作区 ID"
          className="h-7 w-7 items-center justify-center rounded-md active:bg-muted"
        >
          <Copy color={colors.mutedForeground} size={14} />
        </Pressable>
      </View>
    </View>
  );
}

interface ActionRowProps {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  badge?: string;
  loading?: boolean;
}

function ActionRow({
  icon: Icon,
  label,
  onPress,
  disabled,
  destructive,
  badge,
  loading,
}: ActionRowProps) {
  const colors = useThemeColors();
  const isInteractive = !disabled && onPress !== undefined;
  const textColor = destructive ? "text-destructive" : "text-foreground";
  const iconColor = destructive ? colors.destructive : colors.foreground;
  const className = `h-12 flex-row items-center gap-3 px-3.5 ${
    isInteractive ? "active:bg-muted" : ""
  }`;

  const inner = (
    <>
      <Icon color={disabled ? colors.mutedForeground : iconColor} size={16} />
      <Text className={`flex-1 text-[14px] ${disabled ? "text-muted-foreground" : textColor}`}>
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : badge ? (
        <View className="rounded-md bg-muted px-2 py-1">
          <Text className="text-[10px] text-muted-foreground">{badge}</Text>
        </View>
      ) : null}
    </>
  );

  if (!isInteractive) {
    return <View className={className}>{inner}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={className}
    >
      {inner}
    </Pressable>
  );
}

function RowDivider() {
  return <View className="h-px bg-border" />;
}

function MissingWorkspace({ message, onBack }: { message: string; onBack: () => void }) {
  const colors = useThemeColors();
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <View className="h-13 flex-row items-center gap-3 px-4">
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="返回">
          <ArrowLeft color={colors.foreground} size={22} />
        </Pressable>
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-[13px] text-muted-foreground">{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function truncateUuid(uuid: string): string {
  if (uuid.length <= 14) return uuid;
  return `${uuid.slice(0, 8)}…${uuid.slice(-4)}`;
}
