import { Trans, useLingui } from "@lingui/react/macro";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CloudOff, Copy, Download, FolderClosed, Unlink } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  UniffiConnectionType,
  type UniffiPairedDeviceInfo,
  type UniffiRemoteWorkspaceInfo,
} from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { devicePlatformIcon } from "@/lib/device-platform";
import { truncatePeerId } from "@/lib/peer-id";
import { LAN_FG, LAN_TINT, WARNING_FG, WARNING_TINT } from "@/lib/theme-tokens";
import { formatAbsoluteDate, formatRelativeTime } from "@/lib/time-format";
import { errorMessage } from "@/lib/utils";
import { useSwarmStore } from "@/stores/swarm-store";

export default function PairedDeviceDetail() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useLingui();
  const params = useLocalSearchParams<{ peerId: string }>();
  const targetPeerId = useMemo(
    () => (typeof params.peerId === "string" ? decodeURIComponent(params.peerId) : null),
    [params.peerId],
  );

  const pairedDevices = useSwarmStore((s) => s.pairedDevices);
  const discoveryDevices = useSwarmStore((s) => s.devices);
  const device = useMemo(
    () => pairedDevices.find((d) => d.peerId === targetPeerId) ?? null,
    [pairedDevices, targetPeerId],
  );
  const connection = useMemo(() => {
    const hit = discoveryDevices.find((d) => d.peerId === targetPeerId);
    return hit?.connection;
  }, [discoveryDevices, targetPeerId]);

  if (targetPeerId === null || device === null) {
    return <MissingDevice onBack={() => router.back()} />;
  }

  const isOnline = device.isOnline === true;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <View className="h-13 flex-row items-center gap-3 px-4">
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t`返回`}>
          <ArrowLeft color={colors.foreground} size={22} />
        </Pressable>
        <Text className="text-[16px] font-semibold text-foreground">
          <Trans>设备详情</Trans>
        </Text>
      </View>

      <DeviceDetailBody
        device={device}
        connection={connection}
        isOnline={isOnline}
        onUnpaired={() => router.back()}
      />
    </SafeAreaView>
  );
}

function DeviceDetailBody({
  device,
  connection,
  isOnline,
  onUnpaired,
}: {
  device: UniffiPairedDeviceInfo;
  connection: UniffiConnectionType | undefined;
  isOnline: boolean;
  onUnpaired: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const [remoteWorkspaces, setRemoteWorkspaces] = useState<UniffiRemoteWorkspaceInfo[] | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [unpairing, setUnpairing] = useState(false);

  const loadRemoteWorkspaces = useCallback(
    async (
      { userInitiated = false }: { userInitiated?: boolean } = {},
      isCancelled: () => boolean = () => false,
    ) => {
      if (!isOnline) {
        if (!isCancelled()) setRemoteWorkspaces([]);
        return;
      }
      if (userInitiated) setRefreshing(true);
      try {
        const list = await getAppCore().getRemoteWorkspaces();
        if (isCancelled()) return;
        setRemoteWorkspaces(list.filter((w) => w.peerId === device.peerId));
      } catch (err) {
        console.warn("[device-detail] getRemoteWorkspaces failed:", err);
        if (!isCancelled()) setRemoteWorkspaces([]);
      } finally {
        if (userInitiated && !isCancelled()) setRefreshing(false);
      }
    },
    [device.peerId, isOnline],
  );

  useEffect(() => {
    let cancelled = false;
    void loadRemoteWorkspaces({}, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadRemoteWorkspaces]);

  const handleCopyPeerId = async () => {
    await Clipboard.setStringAsync(device.peerId);
  };

  const confirmUnpair = () => {
    Alert.alert(
      t`取消配对`,
      t`已下载的笔记仍保留在本地，只是不再与此设备同步。`,
      [
        { text: t`取消`, style: "cancel" },
        {
          text: t`确认取消配对`,
          style: "destructive",
          onPress: async () => {
            setUnpairing(true);
            try {
              await getAppCore().unpairDevice(device.peerId);
              onUnpaired();
            } catch (err) {
              Alert.alert(t`取消配对失败`, errorMessage(err));
            } finally {
              setUnpairing(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <ScrollView
      contentContainerClassName="gap-4 px-5 pt-2 pb-8"
      showsVerticalScrollIndicator={false}
      refreshControl={
        isOnline ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRemoteWorkspaces({ userInitiated: true })}
            tintColor={colors.mutedForeground}
          />
        ) : undefined
      }
    >
      <HeroCard device={device} isOnline={isOnline} />

      <DeviceMetaCard
        device={device}
        connection={connection}
        isOnline={isOnline}
        onCopyPeerId={handleCopyPeerId}
      />

      <SharedWorkspacesSection isOnline={isOnline} remoteWorkspaces={remoteWorkspaces} />

      <Pressable
        onPress={confirmUnpair}
        disabled={unpairing}
        accessibilityLabel={t`取消配对`}
        className="h-[50px] flex-row items-center justify-center gap-2 rounded-[14px] bg-destructive disabled:opacity-60"
      >
        {unpairing ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <Unlink color={colors.background} size={18} />
        )}
        <Text className="text-[16px] font-semibold text-destructive-foreground">
          <Trans>取消配对</Trans>
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function HeroCard({ device, isOnline }: { device: UniffiPairedDeviceInfo; isOnline: boolean }) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const Icon = devicePlatformIcon(device.platform);

  let statusText: string;
  if (isOnline) statusText = t`在线`;
  else if (device.lastSeen !== undefined)
    statusText = t`最后在线 ${formatRelativeTime(device.lastSeen)}`;
  else statusText = t`离线`;

  return (
    <View className="items-center gap-3 rounded-xl border border-border bg-card p-5">
      <View
        className="h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: isOnline ? colors.primary : `${colors.mutedForeground}20` }}
      >
        <Icon color={isOnline ? colors.background : colors.mutedForeground} size={28} />
      </View>
      <View className="items-center gap-1">
        <Text className="text-[16px] font-semibold text-foreground" numberOfLines={1}>
          {device.name ?? device.hostname}
        </Text>
        <Text className="text-[11px] text-muted-foreground">
          {device.os} · {device.platform}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View
          style={{ backgroundColor: isOnline ? colors.success : colors.mutedForeground }}
          className="h-2 w-2 rounded-full"
        />
        <Text
          style={{ color: isOnline ? colors.success : colors.mutedForeground }}
          className="text-[12px] font-medium"
        >
          {statusText}
        </Text>
      </View>
    </View>
  );
}

function DeviceMetaCard({
  device,
  connection,
  isOnline,
  onCopyPeerId,
}: {
  device: UniffiPairedDeviceInfo;
  connection: UniffiConnectionType | undefined;
  isOnline: boolean;
  onCopyPeerId: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const rtt = device.rttMs !== undefined ? Number(device.rttMs) : undefined;
  const pill = isOnline ? connectionPillProps(connection) : null;

  return (
    <View className="rounded-xl border border-border bg-card overflow-hidden">
      <MetaRow label={t`连接方式`}>
        {pill !== null ? (
          <View
            className="flex-row items-center gap-1 rounded-md px-2 py-0.5"
            style={{ backgroundColor: pill.bg }}
          >
            <Text style={{ color: pill.fg }} className="text-[10px] font-semibold uppercase">
              {pill.label}
            </Text>
          </View>
        ) : (
          <Text className="text-[12px] text-muted-foreground">—</Text>
        )}
      </MetaRow>
      <RowDivider />
      <MetaRow label={t`延迟`}>
        <Text className={`text-[12px] ${isOnline ? "text-foreground" : "text-muted-foreground"}`}>
          {isOnline && rtt !== undefined ? `${rtt} ms` : "—"}
        </Text>
      </MetaRow>
      <RowDivider />
      <MetaRow label="Peer ID">
        <Text className="flex-1 text-right text-[11px] font-mono text-foreground" numberOfLines={1}>
          {truncatePeerId(device.peerId)}
        </Text>
        <Pressable
          onPress={onCopyPeerId}
          hitSlop={8}
          accessibilityLabel={t`复制 Peer ID`}
          className="h-7 w-7 items-center justify-center rounded-md active:bg-muted"
        >
          <Copy color={colors.mutedForeground} size={14} />
        </Pressable>
      </MetaRow>
      <RowDivider />
      <MetaRow label={t`首次配对`}>
        <Text className="text-[12px] text-foreground">{formatAbsoluteDate(device.pairedAt)}</Text>
      </MetaRow>
    </View>
  );
}

function SharedWorkspacesSection({
  isOnline,
  remoteWorkspaces,
}: {
  isOnline: boolean;
  remoteWorkspaces: UniffiRemoteWorkspaceInfo[] | null;
}) {
  const colors = useThemeColors();

  if (!isOnline) {
    return (
      <View className="gap-2">
        <Text className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Trans>共享的工作区</Trans>
        </Text>
        <View className="items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-4 py-6">
          <CloudOff color={colors.mutedForeground} size={24} strokeWidth={1.5} />
          <Text className="text-center text-[12px] text-muted-foreground">
            <Trans>工作区列表来自对方设备</Trans>
          </Text>
          <Text className="text-center text-[11px] text-muted-foreground">
            <Trans>设备离线时无法刷新</Trans>
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Trans>共享的工作区</Trans>
        {remoteWorkspaces !== null && remoteWorkspaces.length > 0
          ? `  ·  ${remoteWorkspaces.length}`
          : ""}
      </Text>
      {remoteWorkspaces === null ? (
        <View className="h-24 items-center justify-center rounded-xl border border-border bg-card">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : remoteWorkspaces.length === 0 ? (
        <View className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-5">
          <Text className="text-center text-[12px] text-muted-foreground">
            <Trans>对方设备暂未打开任何工作区</Trans>
          </Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {remoteWorkspaces.map((ws, idx) => (
            <View key={ws.uuid}>
              {idx > 0 ? <RowDivider /> : null}
              <RemoteWorkspaceRow workspace={ws} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function RemoteWorkspaceRow({ workspace }: { workspace: UniffiRemoteWorkspaceInfo }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-3 px-3.5 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <FolderClosed color={colors.primary} size={18} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
          {workspace.name}
        </Text>
        <Text className="text-[11px] text-muted-foreground">
          <Trans>{workspace.docCount} 篇笔记</Trans>
        </Text>
      </View>
      {workspace.isLocal ? (
        <View className="flex-row items-center gap-1">
          <View style={{ backgroundColor: colors.success }} className="h-1.5 w-1.5 rounded-full" />
          <Text style={{ color: colors.success }} className="text-[11px] font-medium">
            <Trans>已在本地</Trans>
          </Text>
        </View>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Download color={colors.primary} size={14} />
        </View>
      )}
    </View>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-2 px-4 py-3">
      <Text className="text-[12px] text-muted-foreground">{label}</Text>
      <View className="flex-1 flex-row items-center justify-end gap-2">{children}</View>
    </View>
  );
}

function RowDivider() {
  return <View className="mx-4 h-px bg-border" />;
}

function MissingDevice({ onBack }: { onBack: () => void }) {
  const colors = useThemeColors();
  const { t } = useLingui();
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <View className="h-13 flex-row items-center gap-3 px-4">
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel={t`返回`}>
          <ArrowLeft color={colors.foreground} size={22} />
        </Pressable>
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-[13px] text-muted-foreground">
          <Trans>设备不存在或已取消配对</Trans>
        </Text>
      </View>
    </SafeAreaView>
  );
}

function connectionPillProps(connection: UniffiConnectionType | undefined): {
  label: string;
  bg: string;
  fg: string;
} {
  switch (connection) {
    case UniffiConnectionType.Lan:
      return { label: "LAN", bg: LAN_TINT, fg: LAN_FG };
    case UniffiConnectionType.Relay:
      return { label: "Relay", bg: WARNING_TINT, fg: WARNING_FG };
    case UniffiConnectionType.Dcutr:
      return { label: "DCUtR", bg: WARNING_TINT, fg: WARNING_FG };
    default:
      return { label: "—", bg: "transparent", fg: WARNING_FG };
  }
}
