import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Laptop,
  type LucideIcon,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UniffiPairingMethod } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";

function devicePlatformIcon(platform: string): LucideIcon {
  const p = platform.toLowerCase();
  if (p.includes("ios") || p.includes("android")) return Smartphone;
  if (p.includes("ipad") || p.includes("tablet")) return Tablet;
  if (p.includes("mac") || p.includes("windows")) return Laptop;
  return Monitor;
}

function truncatePeerId(peerId: string): string {
  if (peerId.length <= 16) return peerId;
  return `${peerId.slice(0, 8)}…${peerId.slice(-4)}`;
}

export default function FoundDevice() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{
    peerId: string;
    code: string;
    name?: string;
    hostname: string;
    os: string;
    platform: string;
    arch: string;
  }>();

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = params.name || params.hostname;
  const Icon = devicePlatformIcon(params.platform);

  const onConfirm = async () => {
    setError(null);
    setConfirming(true);
    try {
      const resp = await getAppCore().requestPairing(
        params.peerId,
        UniffiPairingMethod.Code.new({ code: params.code }),
        {
          name: params.name,
          hostname: params.hostname,
          os: params.os,
          platform: params.platform,
          arch: params.arch,
        },
      );
      if (resp.tag === "Refused") {
        setError("配对被拒绝");
      } else {
        router.replace({
          pathname: "/pairing/success",
          params: {
            peerId: params.peerId,
            name: params.name ?? "",
            hostname: params.hostname,
            os: params.os,
            arch: params.arch,
          },
        });
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="mt-2 h-11 flex-row items-center justify-between px-6">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          disabled={confirming}
          accessibilityLabel="返回"
          className="h-11 w-11 -ml-2 items-start justify-center"
        >
          <ArrowLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text className="text-[17px] font-semibold text-foreground">确认设备</Text>
        <View className="h-6 w-6" />
      </View>

      <View className="flex-1 justify-center gap-6 px-6">
        <View className="items-center gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon color={colors.primary} size={32} />
          </View>
          <Text className="text-[22px] font-bold text-foreground">找到设备</Text>
          <Text className="text-center text-[15px] text-muted-foreground">
            确认这是你要配对的设备？
          </Text>
        </View>

        <View className="gap-3.5 rounded-2xl border border-border bg-muted p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-muted-foreground">设备名称</Text>
            <Text className="max-w-[60%] text-[14px] font-medium text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          <View className="h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-muted-foreground">系统</Text>
            <Text className="text-[14px] font-medium text-foreground" numberOfLines={1}>
              {params.os} · {params.arch}
            </Text>
          </View>
          <View className="h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-muted-foreground">设备 ID</Text>
            <Text className="text-[14px] font-medium text-foreground">
              {truncatePeerId(params.peerId)}
            </Text>
          </View>
        </View>

        {error !== null ? (
          <Text className="text-center text-[13px] text-destructive">{error}</Text>
        ) : null}
      </View>

      <View className="gap-2.5 px-6 pb-6">
        <Pressable
          onPress={onConfirm}
          disabled={confirming}
          accessibilityLabel="确认配对"
          className="h-13 items-center justify-center rounded-xl bg-primary disabled:opacity-60"
        >
          {confirming ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <Text className="text-[17px] font-semibold text-primary-foreground">确认配对</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          disabled={confirming}
          accessibilityLabel="取消"
          className="h-13 items-center justify-center rounded-xl border border-border bg-background"
        >
          <Text className="text-[17px] font-medium text-foreground">取消</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
