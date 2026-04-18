import { useRouter } from "expo-router";
import { ArrowLeft, Radar } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type UniffiDevice, UniffiPairingMethod } from "react-native-swarmnote-core";
import { CodePairingCard } from "@/components/code-pairing-card";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { usePairingCodeGenerator } from "@/hooks/usePairingCodeGenerator";
import { useThemeColors } from "@/hooks/useThemeColors";
import { devicePlatformIcon } from "@/lib/device-platform";
import { useNetworkPreferenceStore } from "@/stores/network-preference-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useSwarmStore } from "@/stores/swarm-store";

function deviceMeta(device: UniffiDevice): string {
  const os = device.os ? device.os : "未知";
  return `${os} · 局域网`;
}

export default function Pairing() {
  const router = useRouter();
  const colors = useThemeColors();
  const userWantsNetwork = useNetworkPreferenceStore((s) => s.userWantsNetwork);
  const online = useSwarmStore((s) => s.online);
  const devices = useSwarmStore((s) => s.devices);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const { code, expiresAt, generating, generate, reset } = usePairingCodeGenerator();

  useEffect(() => {
    if (!userWantsNetwork || online) return;
    getAppCore()
      .startNetwork()
      .catch((err: unknown) => {
        console.warn("[onboarding/pairing] startNetwork failed:", err);
      });
  }, [userWantsNetwork, online]);

  const [pairingPeerId, setPairingPeerId] = useState<string | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);

  const gotoComplete = () => {
    nextStep();
    router.push("/onboarding/complete" as never);
  };

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
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-6 px-6 pt-2 pb-6">
        <View className="h-11 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="返回"
            className="h-11 w-11 -ml-2 items-start justify-center"
          >
            <ArrowLeft color={colors.foreground} size={24} />
          </Pressable>
          <Pressable onPress={gotoComplete} hitSlop={12} accessibilityLabel="跳过配对">
            <Text className="text-[15px] font-medium text-muted-foreground">跳过</Text>
          </Pressable>
        </View>

        <View className="gap-2.5">
          <Text className="text-[28px] font-bold text-foreground">配对设备</Text>
          <Text className="text-[15px] leading-6 text-muted-foreground">
            与其他设备配对后即可同步笔记。{"\n"}你也可以跳过，稍后在 Swarm 中配对。
          </Text>
        </View>

        <View className="gap-2">
          <CodePairingCard
            code={code ?? undefined}
            expiresAt={expiresAt ?? undefined}
            loading={generating}
            onGenerate={generate}
            onExpire={reset}
          />
          <Pressable
            onPress={() => router.push("/pairing/input-code" as never)}
            hitSlop={8}
            accessibilityLabel="输入配对码"
          >
            <Text className="text-center text-[13px] text-primary">有配对码？点击输入</Text>
          </Pressable>
        </View>

        <View className="flex-1 gap-3">
          <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            附近的设备
          </Text>
          {pairError !== null ? (
            <Text className="text-[13px] text-destructive">{pairError}</Text>
          ) : null}
          {devices.length > 0 ? (
            <ScrollView
              className="flex-1"
              contentContainerClassName="gap-3 pb-2"
              showsVerticalScrollIndicator={false}
            >
              {devices.map((d) => {
                const Icon = devicePlatformIcon(d.platform);
                return (
                  <View
                    key={d.peerId}
                    className="h-15 flex-row items-center gap-3 rounded-xl border border-border bg-muted px-3.5"
                  >
                    <Icon color={colors.mutedForeground} size={22} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
                        {d.name ?? d.hostname}
                      </Text>
                      <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
                        {deviceMeta(d)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onPairNearby(d)}
                      disabled={pairingPeerId !== null}
                      accessibilityLabel={`配对 ${d.name ?? d.hostname}`}
                      className="h-9 min-w-16 items-center justify-center rounded-lg bg-primary px-4 disabled:opacity-60"
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
              })}
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center gap-2 px-4">
              <Radar color={colors.mutedForeground} size={40} strokeWidth={1.5} />
              <Text className="text-center text-[15px] font-medium text-foreground">
                暂无附近设备
              </Text>
              <Text className="text-center text-[13px] leading-5 text-muted-foreground">
                请确保另一台设备已连接同一局域网{"\n"}并打开 SwarmNote
              </Text>
            </View>
          )}
        </View>

        <View className="gap-4">
          <Pressable
            onPress={gotoComplete}
            accessibilityLabel="继续"
            className="h-13 items-center justify-center rounded-xl bg-primary"
          >
            <Text className="text-[17px] font-semibold text-primary-foreground">继续</Text>
          </Pressable>

          <View className="flex-row items-center justify-center gap-2">
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2.5 rounded-full bg-primary" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
