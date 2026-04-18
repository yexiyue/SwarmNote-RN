import { useRouter } from "expo-router";
import {
  Keyboard,
  Laptop,
  type LucideIcon,
  Monitor,
  Radar,
  Smartphone,
  Tablet,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type UniffiDevice, UniffiPairingMethod } from "react-native-swarmnote-core";
import { CodePairingCard } from "@/components/code-pairing-card";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { usePairingCodeGenerator } from "@/hooks/usePairingCodeGenerator";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useNetworkPreferenceStore } from "@/stores/network-preference-store";
import { useSwarmStore } from "@/stores/swarm-store";

const SUCCESS_GREEN = "#4CAF50";

function devicePlatformIcon(platform: string): LucideIcon {
  const p = platform.toLowerCase();
  if (p.includes("ios") || p.includes("android")) return Smartphone;
  if (p.includes("ipad") || p.includes("tablet")) return Tablet;
  if (p.includes("mac") || p.includes("windows")) return Laptop;
  return Monitor;
}

export default function Swarm() {
  const router = useRouter();
  const colors = useThemeColors();
  const online = useSwarmStore((s) => s.online);
  const natStatus = useSwarmStore((s) => s.natStatus);
  const devices = useSwarmStore((s) => s.devices);
  const pairedDevices = useSwarmStore((s) => s.pairedDevices);
  const userWantsNetwork = useNetworkPreferenceStore((s) => s.userWantsNetwork);
  const setUserWantsNetwork = useNetworkPreferenceStore((s) => s.setUserWantsNetwork);

  const { code, expiresAt, generating, generate, reset } = usePairingCodeGenerator();

  const nearby = devices.filter((d) => !d.isPaired);
  const [pairingPeerId, setPairingPeerId] = useState<string | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);

  const statusSub = online
    ? `已连接 ${pairedDevices.filter((d) => d.isOnline).length} 台设备 · ${natStatus ?? "NAT 未知"}`
    : userWantsNetwork
      ? "正在启动…"
      : "已手动关闭";

  const onPairNearby = async (device: UniffiDevice) => {
    if (pairingPeerId !== null) return;
    setPairError(null);
    setPairingPeerId(device.peerId);
    try {
      const resp = await getAppCore().requestPairing(
        device.peerId,
        UniffiPairingMethod.Direct.new(),
        {
          name: device.name,
          hostname: device.hostname,
          os: device.os,
          platform: device.platform,
          arch: device.arch,
        },
      );
      if (resp.tag === "Refused") {
        setPairError("配对被拒绝");
      } else {
        router.push({
          pathname: "/pairing/success",
          params: {
            peerId: device.peerId,
            name: device.name ?? "",
            hostname: device.hostname,
            os: device.os,
            arch: device.arch,
          },
        });
      }
    } catch (err) {
      setPairError(String(err));
    } finally {
      setPairingPeerId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <View className="h-13 flex-row items-center justify-between px-5">
        <Text className="text-[20px] font-bold text-foreground">Swarm</Text>
        <Pressable
          onPress={() => router.push("/pairing/input-code" as never)}
          hitSlop={12}
          accessibilityLabel="输入配对码"
        >
          <Keyboard color={colors.foreground} size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-2 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Network Status */}
        <View className="flex-row items-center gap-3.5 rounded-2xl border border-border bg-muted p-4">
          <View
            style={{ backgroundColor: online ? SUCCESS_GREEN : colors.mutedForeground }}
            className="h-2.5 w-2.5 rounded-full"
          />
          <View className="flex-1 gap-0.5">
            <Text className="text-[15px] font-semibold text-foreground">
              {online ? "P2P 网络运行中" : "P2P 网络未运行"}
            </Text>
            <Text className="text-[13px] text-muted-foreground">{statusSub}</Text>
          </View>
          <Switch checked={userWantsNetwork} onCheckedChange={setUserWantsNetwork} />
        </View>

        {/* Paired Devices */}
        <View className="gap-3">
          <Text className="px-1 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            已配对设备{pairedDevices.length > 0 ? ` (${pairedDevices.length})` : ""}
          </Text>
          {pairedDevices.length > 0 ? (
            pairedDevices.map((d) => {
              const Icon = devicePlatformIcon(d.platform);
              const isOnline = d.isOnline === true;
              const rtt = d.rttMs !== undefined ? Number(d.rttMs) : undefined;
              const meta =
                isOnline && rtt !== undefined
                  ? `${d.os} · 局域网 · ${rtt}ms`
                  : `${d.os} · ${d.platform}`;
              return (
                <View
                  key={d.peerId}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3.5"
                >
                  <Icon color={colors.mutedForeground} size={22} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
                      {d.name ?? d.hostname}
                    </Text>
                    <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
                      {meta}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <View
                      style={{ backgroundColor: isOnline ? SUCCESS_GREEN : colors.mutedForeground }}
                      className="h-2 w-2 rounded-full"
                    />
                    <Text
                      style={{ color: isOnline ? SUCCESS_GREEN : colors.mutedForeground }}
                      className="text-[12px] font-medium"
                    >
                      {isOnline ? "在线" : "离线"}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5">
              <Text className="text-center text-[13px] text-muted-foreground">还没有配对设备</Text>
            </View>
          )}
        </View>

        {/* Nearby Devices */}
        <View className="gap-3">
          <Text className="px-1 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            附近的设备
          </Text>
          {pairError !== null ? (
            <Text className="px-1 text-[13px] text-destructive">{pairError}</Text>
          ) : null}
          {nearby.length > 0 ? (
            nearby.map((d) => {
              const Icon = devicePlatformIcon(d.platform);
              return (
                <View
                  key={d.peerId}
                  className="h-15 flex-row items-center gap-3 rounded-xl border border-border bg-muted px-3.5"
                >
                  <Icon color={colors.mutedForeground} size={20} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[14px] font-medium text-foreground" numberOfLines={1}>
                      {d.name ?? d.hostname}
                    </Text>
                    <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
                      {d.os} · 局域网
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onPairNearby(d)}
                    disabled={pairingPeerId !== null}
                    accessibilityLabel={`配对 ${d.name ?? d.hostname}`}
                    className="h-8 min-w-14 items-center justify-center rounded-lg bg-primary px-3.5 disabled:opacity-60"
                  >
                    {pairingPeerId === d.peerId ? (
                      <ActivityIndicator color={colors.foreground} size="small" />
                    ) : (
                      <Text className="text-[13px] font-semibold text-primary-foreground">
                        配对
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View className="items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5">
              <Radar color={colors.mutedForeground} size={28} strokeWidth={1.5} />
              <Text className="text-center text-[13px] text-muted-foreground">暂无附近设备</Text>
            </View>
          )}
        </View>

        {/* Cross-network pair */}
        <View className="gap-3">
          <Text className="px-1 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            跨网络配对
          </Text>
          <CodePairingCard
            code={code ?? undefined}
            expiresAt={expiresAt ?? undefined}
            loading={generating}
            onGenerate={generate}
            onExpire={reset}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
