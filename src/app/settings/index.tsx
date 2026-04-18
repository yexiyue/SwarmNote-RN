import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ChevronRight,
  Globe,
  Info,
  type LucideIcon,
  MonitorSmartphone,
  Settings,
  Smartphone,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiDeviceInfo } from "react-native-swarmnote-core";
import { SettingDivider } from "@/components/setting-row";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { truncatePeerId } from "@/lib/peer-id";
import { useSwarmStore } from "@/stores/swarm-store";

export default function SettingsIndex() {
  const router = useRouter();
  const colors = useThemeColors();
  const [info, setInfo] = useState<UniffiDeviceInfo | null>(null);
  const keychainEphemeral = useSwarmStore((s) => s.keychainEphemeral);

  useEffect(() => {
    try {
      setInfo(getAppCore().deviceInfo());
    } catch (err) {
      console.warn("[settings] deviceInfo failed:", err);
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <View className="items-center pt-1 pb-2">
        <View className="h-1 w-9 rounded-full bg-border" />
      </View>
      <View className="h-13 flex-row items-center justify-between px-5">
        <View className="w-6" />
        <Text className="text-[16px] font-semibold text-foreground">设置</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="关闭">
          <X color={colors.foreground} size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {keychainEphemeral ? (
          <View className="flex-row items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <AlertTriangle color={colors.destructive} size={14} />
            <Text className="text-[12px] text-destructive">密钥链不可用，身份为临时状态</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push("/settings/devices" as never)}
          accessibilityLabel="我的设备"
          className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4"
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Smartphone color={colors.primary} size={20} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
              {info?.deviceName ?? "—"}
            </Text>
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
              {info ? truncatePeerId(info.peerId) : ""}
            </Text>
          </View>
          <ChevronRight color={colors.mutedForeground} size={16} />
        </Pressable>

        <View className="rounded-xl border border-border bg-card overflow-hidden">
          <NavRow
            icon={Settings}
            label="通用"
            onPress={() => router.push("/settings/general" as never)}
          />
          <SettingDivider />
          <NavRow
            icon={Globe}
            label="网络"
            onPress={() => router.push("/settings/network" as never)}
          />
          <SettingDivider />
          <NavRow
            icon={MonitorSmartphone}
            label="设备"
            onPress={() => router.push("/settings/devices" as never)}
          />
          <SettingDivider />
          <NavRow
            icon={Info}
            label="关于"
            onPress={() => router.push("/settings/about" as never)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NavRow({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-12 flex-row items-center px-3.5 gap-3 active:bg-muted"
    >
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted">
        <Icon color={colors.mutedForeground} size={16} />
      </View>
      <Text className="flex-1 text-[14px] text-foreground">{label}</Text>
      <ChevronRight color={colors.mutedForeground} size={16} />
    </Pressable>
  );
}
