import { useRouter } from "expo-router";
import { ArrowLeft, Check, FolderClosed, Monitor } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiRemoteWorkspaceInfo } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { errorMessage } from "@/lib/utils";
import { useSyncWizardStore } from "@/stores/sync-wizard-store";

interface PeerGroupData {
  peerId: string;
  peerName: string;
  workspaces: UniffiRemoteWorkspaceInfo[];
}

export default function SyncWizardSelect() {
  const router = useRouter();
  const colors = useThemeColors();
  const [remoteWorkspaces, setRemoteWorkspaces] = useState<UniffiRemoteWorkspaceInfo[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const setWizardItems = useSyncWizardStore((s) => s.setItems);

  const loadWorkspaces = useCallback(async () => {
    setLoadError(null);
    setRemoteWorkspaces(null);
    try {
      const data = await getAppCore().getRemoteWorkspaces();
      setRemoteWorkspaces(data);
    } catch (err) {
      setLoadError(errorMessage(err));
      setRemoteWorkspaces([]);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const groupedPeers = useMemo<PeerGroupData[]>(
    () => groupByPeer(remoteWorkspaces ?? []),
    [remoteWorkspaces],
  );

  const toggle = (uuid: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });

  const handleStart = () => {
    const list = remoteWorkspaces ?? [];
    const selected = list.filter((w) => selectedIds.has(w.uuid));
    if (selected.length === 0) return;
    setWizardItems(selected.map((ws) => ({ ws, status: "pending" })));
    router.replace("/workspaces/sync/syncing" as never);
  };

  const selectedCount = selectedIds.size;
  const retry = () => void loadWorkspaces();

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="h-13 flex-row items-center gap-3 px-4">
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="返回">
          <ArrowLeft color={colors.foreground} size={22} />
        </Pressable>
        <Text className="text-[16px] font-semibold text-foreground">从设备同步</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-2 pb-4"
        showsVerticalScrollIndicator={false}
      >
        <SelectBody
          remoteWorkspaces={remoteWorkspaces}
          loadError={loadError}
          groupedPeers={groupedPeers}
          selectedIds={selectedIds}
          onToggle={toggle}
          onRetry={retry}
        />
      </ScrollView>

      {groupedPeers.length > 0 && loadError === null ? (
        <View className="border-t border-border px-5 py-3 flex-row items-center gap-3 bg-background">
          <Text className="flex-1 text-[12px] text-muted-foreground">已选 {selectedCount} 个</Text>
          <Pressable
            onPress={handleStart}
            disabled={selectedCount === 0}
            accessibilityLabel="开始同步"
            className="h-10 rounded-lg bg-primary px-5 justify-center disabled:opacity-50"
          >
            <Text className="text-[13px] font-semibold text-primary-foreground">开始同步</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

interface SelectBodyProps {
  remoteWorkspaces: UniffiRemoteWorkspaceInfo[] | null;
  loadError: string | null;
  groupedPeers: PeerGroupData[];
  selectedIds: Set<string>;
  onToggle: (uuid: string) => void;
  onRetry: () => void;
}

function SelectBody({
  remoteWorkspaces,
  loadError,
  groupedPeers,
  selectedIds,
  onToggle,
  onRetry,
}: SelectBodyProps) {
  const colors = useThemeColors();

  if (remoteWorkspaces === null) {
    return (
      <View className="h-48 items-center justify-center gap-3">
        <ActivityIndicator color={colors.primary} />
        <Text className="text-[12px] text-muted-foreground">正在获取可同步的工作区…</Text>
      </View>
    );
  }
  if (loadError !== null) {
    return (
      <StateCard
        messages={[{ text: loadError, tone: "destructive" }]}
        actionLabel="重试"
        onAction={onRetry}
      />
    );
  }
  if (remoteWorkspaces.length === 0) {
    return (
      <StateCard
        messages={[
          { text: "未找到可同步的工作区", tone: "muted" },
          { text: "请确认对方设备已在线并已配对", tone: "muted-sm" },
        ]}
        actionLabel="重试"
        onAction={onRetry}
      />
    );
  }
  return (
    <>
      {groupedPeers.map((group) => (
        <PeerGroup
          key={group.peerId}
          peerName={group.peerName}
          workspaces={group.workspaces}
          selectedIds={selectedIds}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

type StateMessage = { text: string; tone: "destructive" | "muted" | "muted-sm" };

function StateCard({
  messages,
  actionLabel,
  onAction,
}: {
  messages: StateMessage[];
  actionLabel: string;
  onAction: () => void;
}) {
  const toneClass: Record<StateMessage["tone"], string> = {
    destructive: "text-[12px] text-destructive",
    muted: "text-[12px] text-muted-foreground",
    "muted-sm": "text-[11px] text-muted-foreground",
  };
  return (
    <View className="items-center gap-3 rounded-xl border border-border bg-card p-6">
      {messages.map((m) => (
        <Text key={m.text} className={`text-center ${toneClass[m.tone]}`}>
          {m.text}
        </Text>
      ))}
      <Pressable
        onPress={onAction}
        className="h-9 rounded-lg border border-border px-4 justify-center"
      >
        <Text className="text-[12px] text-foreground">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function PeerGroup({
  peerName,
  workspaces,
  selectedIds,
  onToggle,
}: {
  peerName: string;
  workspaces: UniffiRemoteWorkspaceInfo[];
  selectedIds: Set<string>;
  onToggle: (uuid: string) => void;
}) {
  const colors = useThemeColors();

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2 px-1">
        <Monitor color={colors.mutedForeground} size={14} />
        <Text className="text-[11px] font-semibold text-foreground">{peerName}</Text>
        <View className="rounded-md bg-success/10 px-1.5 py-0.5">
          <Text style={{ color: colors.success }} className="text-[10px] font-medium">
            在线
          </Text>
        </View>
      </View>
      <View className="overflow-hidden rounded-xl border border-border bg-card">
        {workspaces.map((ws, idx) => (
          <View key={ws.uuid}>
            {idx > 0 ? <View className="mx-3.5 h-px bg-border" /> : null}
            <WorkspaceCandidateRow
              workspace={ws}
              selected={selectedIds.has(ws.uuid)}
              onToggle={() => onToggle(ws.uuid)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function WorkspaceCandidateRow({
  workspace,
  selected,
  onToggle,
}: {
  workspace: UniffiRemoteWorkspaceInfo;
  selected: boolean;
  onToggle: () => void;
}) {
  const colors = useThemeColors();
  const disabled = workspace.isLocal;

  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={workspace.name}
      className="flex-row items-center gap-3 px-3.5 py-3"
    >
      <View
        className="h-5 w-5 items-center justify-center rounded"
        style={{
          backgroundColor: selected ? colors.primary : "transparent",
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {selected ? <Check color={colors.background} size={12} strokeWidth={3} /> : null}
      </View>
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
        <FolderClosed color={colors.primary} size={16} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          className={`text-[13px] font-medium ${disabled ? "text-muted-foreground" : "text-foreground"}`}
          numberOfLines={1}
        >
          {workspace.name}
        </Text>
        <Text className="text-[11px] text-muted-foreground">{workspace.docCount} 篇笔记</Text>
      </View>
      {workspace.isLocal ? (
        <View className="rounded-md bg-muted px-2 py-0.5">
          <Text className="text-[10px] text-muted-foreground">已在本地</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function groupByPeer(workspaces: UniffiRemoteWorkspaceInfo[]): PeerGroupData[] {
  const map = new Map<string, PeerGroupData>();
  for (const ws of workspaces) {
    const entry = map.get(ws.peerId);
    if (entry === undefined) {
      map.set(ws.peerId, { peerId: ws.peerId, peerName: ws.peerName, workspaces: [ws] });
    } else {
      entry.workspaces.push(ws);
    }
  }
  return Array.from(map.values());
}
