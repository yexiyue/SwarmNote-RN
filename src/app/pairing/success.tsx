import { Trans, useLingui } from "@lingui/react/macro";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, RefreshCw } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UniffiConnectionType } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { truncatePeerId } from "@/lib/peer-id";
import { useSwarmStore } from "@/stores/swarm-store";

export default function PairingSuccess() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useLingui();
  const params = useLocalSearchParams<{
    peerId: string;
    name?: string;
    hostname: string;
    os: string;
    arch: string;
  }>();

  const device = useSwarmStore((s) => s.devices.find((d) => d.peerId === params.peerId));
  const displayName = params.name || params.hostname;
  const latency =
    device?.latency !== undefined && device.latency !== null ? Number(device.latency) : undefined;

  const connectionLabel = (type: UniffiConnectionType | undefined): string => {
    if (type === undefined) return t`已连接`;
    const kind =
      type === UniffiConnectionType.Lan
        ? t`局域网`
        : type === UniffiConnectionType.Dcutr
          ? t`打洞`
          : t`中继`;
    const rtt = latency !== undefined ? ` · ${latency}ms` : "";
    return t`已连接 · ${kind}${rtt}`;
  };

  const finish = () => {
    router.dismissAll();
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center gap-5 px-6 pb-6">
        <View className="items-center gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Check color={colors.success} size={32} strokeWidth={2.5} />
          </View>
          <Text className="text-[22px] font-bold text-foreground">
            <Trans>配对成功！</Trans>
          </Text>
          <Text className="text-center text-[15px] text-muted-foreground">
            <Trans>已与 {displayName} 建立安全连接</Trans>
          </Text>
        </View>

        <View className="gap-3.5 rounded-2xl border border-border bg-muted p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-muted-foreground">
              <Trans>设备名称</Trans>
            </Text>
            <Text className="max-w-[60%] text-[14px] font-medium text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          <View className="h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-muted-foreground">
              <Trans>系统</Trans>
            </Text>
            <Text className="text-[14px] font-medium text-foreground" numberOfLines={1}>
              {params.os} · {params.arch}
            </Text>
          </View>
          <View className="h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-muted-foreground">
              <Trans>设备 ID</Trans>
            </Text>
            <Text className="text-[14px] font-medium text-foreground">
              {truncatePeerId(params.peerId)}
            </Text>
          </View>
          <View className="h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-muted-foreground">
              <Trans>连接状态</Trans>
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View style={{ backgroundColor: colors.success }} className="h-2 w-2 rounded-full" />
              <Text style={{ color: colors.success }} className="text-[14px] font-medium">
                {connectionLabel(device?.connection)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="gap-2.5 px-6 pb-6">
        <Pressable
          onPress={finish}
          accessibilityLabel={t`同步工作区`}
          className="h-13 flex-row items-center justify-center gap-2 rounded-xl bg-primary"
        >
          <RefreshCw color={colors.foreground} size={18} />
          <Text className="text-[17px] font-semibold text-primary-foreground">
            <Trans>同步工作区</Trans>
          </Text>
        </Pressable>

        <Pressable
          onPress={finish}
          accessibilityLabel={t`完成`}
          className="h-13 items-center justify-center rounded-xl border border-border bg-background"
        >
          <Text className="text-[17px] font-medium text-foreground">
            <Trans>完成</Trans>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
