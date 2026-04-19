import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  CloudDownload,
  FolderClosed,
  FolderPlus,
  Inbox,
  Plus,
} from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiRecentWorkspace } from "react-native-swarmnote-core";
import { SettingDivider } from "@/components/setting-row";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useRecentWorkspacesStore } from "@/stores/recent-workspaces-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function WorkspacesIndex() {
  const router = useRouter();
  const colors = useThemeColors();
  const items = useRecentWorkspacesStore((s) => s.items);
  const refresh = useRecentWorkspacesStore((s) => s.refresh);
  const activeInfo = useWorkspaceStore((s) => s.info);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openDetail = (path: string) => {
    router.push(`/settings/workspaces/${encodeURIComponent(path)}` as never);
  };
  const openCreate = () => router.push("/settings/workspaces/new" as never);

  const count = items?.length ?? 0;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <View className="h-13 flex-row items-center justify-between gap-3 px-4">
        <View className="flex-row items-center gap-3 flex-1">
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="返回">
            <ArrowLeft color={colors.foreground} size={22} />
          </Pressable>
          <Text className="text-[16px] font-semibold text-foreground">工作区</Text>
        </View>
        <Pressable onPress={openCreate} hitSlop={12} accessibilityLabel="新建工作区">
          <Plus color={colors.foreground} size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <Section label="添加工作区">
          <AddRow
            icon={FolderPlus}
            label="新建工作区"
            description="在 App 空间创建一个新的工作区"
            onPress={openCreate}
          />
          <SettingDivider />
          <AddRow
            icon={CloudDownload}
            label="从设备同步"
            description="从已配对的设备拉取工作区"
            badge="即将推出"
          />
        </Section>

        <Section label={`我的工作区${count > 0 ? `  ·  ${count}` : ""}`}>
          {items === null ? (
            <View className="h-24 items-center justify-center">
              <Text className="text-[12px] text-muted-foreground">加载中…</Text>
            </View>
          ) : items.length === 0 ? (
            <EmptyListSlot />
          ) : (
            items.map((ws, idx) => (
              <View key={ws.path}>
                {idx > 0 ? <SettingDivider /> : null}
                <WorkspaceRow
                  workspace={ws}
                  isActive={activeInfo?.path === ws.path}
                  onPress={() => openDetail(ws.path)}
                />
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Text>
      <View className="rounded-xl border border-border bg-card overflow-hidden">{children}</View>
    </View>
  );
}

interface AddRowProps {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  label: string;
  description: string;
  onPress?: () => void;
  badge?: string;
}

function AddRow({ icon: Icon, label, description, onPress, badge }: AddRowProps) {
  const colors = useThemeColors();
  const disabled = badge !== undefined;
  const className = `flex-row items-center gap-3 px-3.5 py-3.5 ${
    disabled ? "" : "active:bg-muted"
  }`;

  const inner = (
    <>
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${
          disabled ? "bg-muted/60" : "bg-primary/10"
        }`}
      >
        <Icon color={disabled ? colors.mutedForeground : colors.primary} size={18} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          className={`text-[14px] font-medium ${
            disabled ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {label}
        </Text>
        <Text className="text-[11px] text-muted-foreground">{description}</Text>
      </View>
      {badge ? (
        <View className="rounded-md bg-muted px-2 py-1">
          <Text className="text-[10px] text-muted-foreground">{badge}</Text>
        </View>
      ) : !disabled && onPress !== undefined ? (
        <ChevronRight color={colors.mutedForeground} size={16} />
      ) : null}
    </>
  );

  if (disabled || onPress === undefined) {
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

function WorkspaceRow({
  workspace,
  isActive,
  onPress,
}: {
  workspace: UniffiRecentWorkspace;
  isActive: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={workspace.name}
      className="flex-row items-center gap-3 px-3.5 py-3.5 active:bg-muted"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <FolderClosed color={colors.primary} size={18} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-[14px] font-medium text-foreground shrink" numberOfLines={1}>
            {workspace.name}
          </Text>
          {isActive ? (
            <View className="rounded-md bg-primary/10 px-1.5 py-0.5">
              <Text className="text-[10px] font-medium text-primary">当前</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-[11px] text-muted-foreground">
          {formatLastOpened(workspace.lastOpenedAt)}
        </Text>
      </View>
      <ChevronRight color={colors.mutedForeground} size={16} />
    </Pressable>
  );
}

function EmptyListSlot() {
  const colors = useThemeColors();
  return (
    <View className="items-center gap-2 py-8 px-4">
      <View className="h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-border">
        <Inbox color={colors.mutedForeground} size={22} />
      </View>
      <Text className="text-[13px] font-medium text-foreground">还没有工作区</Text>
      <Text className="text-[11px] text-muted-foreground text-center">
        点击右上角 + 创建你的第一个工作区
      </Text>
    </View>
  );
}

/** Lightweight ISO-8601 → "刚刚 / N 分钟前 / N 小时前 / YYYY-MM-DD" formatter.
 *  Avoids pulling a full i18n lib for one display string. */
function formatLastOpened(iso: string): string {
  const opened = new Date(iso);
  if (Number.isNaN(opened.getTime())) return iso;
  const diffMs = Date.now() - opened.getTime();
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diffMs < min) return "刚刚打开";
  if (diffMs < hour) return `${Math.floor(diffMs / min)} 分钟前`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} 天前`;
  const y = opened.getFullYear();
  const m = String(opened.getMonth() + 1).padStart(2, "0");
  const d = String(opened.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
