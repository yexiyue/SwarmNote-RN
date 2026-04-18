import { ChevronRight, Smartphone } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiDeviceInfo } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useSwarmStore } from "@/stores/swarm-store";

const APP_VERSION = "v0.1.0";
const SUCCESS_GREEN = "#4CAF50";

function truncatePeerId(peerId: string): string {
  if (peerId.length <= 16) return peerId;
  return `${peerId.slice(0, 8)}…${peerId.slice(-4)}`;
}

export default function Settings() {
  const colors = useThemeColors();
  const [info, setInfo] = useState<UniffiDeviceInfo | null>(null);
  const online = useSwarmStore((s) => s.online);
  const pairedCount = useSwarmStore((s) => s.pairedDevices.length);
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
      <View className="h-13 justify-center px-5">
        <Text className="text-[20px] font-bold text-foreground">设置</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-2 pb-6"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityLabel="我的设备"
          className="flex-row items-center gap-3.5 rounded-xl border border-border bg-muted p-4"
        >
          <View className="h-11 w-11 items-center justify-center rounded-full bg-background">
            <Smartphone color={colors.primary} size={22} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[16px] font-semibold text-foreground" numberOfLines={1}>
              {info?.deviceName ?? "—"}
            </Text>
            <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
              {info ? truncatePeerId(info.peerId) : ""}
            </Text>
          </View>
          <ChevronRight color={colors.mutedForeground} size={18} />
        </Pressable>

        {keychainEphemeral ? (
          <View className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <Text className="text-[13px] text-destructive">⚠ 密钥链不可用，身份为临时状态</Text>
          </View>
        ) : null}

        <Section label="通用">
          <Row label="语言" value="中文" onPress={() => {}} />
          <Divider />
          <Row label="主题" value="跟随系统" onPress={() => {}} />
        </Section>

        <Section label="同步与设备">
          <Row
            label="P2P 网络"
            valueElement={
              <Text
                style={{ color: online ? SUCCESS_GREEN : undefined }}
                className={online ? "text-[15px]" : "text-[15px] text-muted-foreground"}
              >
                {online ? "运行中" : "未启动"}
              </Text>
            }
            onPress={() => {}}
          />
          <Divider />
          <Row label="已配对设备" value={`${pairedCount} 台`} onPress={() => {}} />
          <Divider />
          <Row label="配对新设备" onPress={() => {}} />
        </Section>

        <Section label="关于">
          <Row label="版本" value={APP_VERSION} hideChevron />
          <Divider />
          <Row label="检查更新" onPress={() => {}} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
        {label}
      </Text>
      <View className="rounded-xl border border-border bg-muted overflow-hidden">{children}</View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-border ml-4" />;
}

interface RowProps {
  label: string;
  value?: string;
  valueElement?: React.ReactNode;
  hideChevron?: boolean;
  onPress?: () => void;
}

function Row({ label, value, valueElement, hideChevron, onPress }: RowProps) {
  const colors = useThemeColors();
  const content = (
    <View className="h-12 flex-row items-center justify-between px-4">
      <Text className="text-[15px] text-foreground">{label}</Text>
      <View className="flex-row items-center gap-1">
        {valueElement ??
          (value !== undefined ? (
            <Text className="text-[15px] text-muted-foreground">{value}</Text>
          ) : null)}
        {hideChevron ? null : <ChevronRight color={colors.mutedForeground} size={16} />}
      </View>
    </View>
  );
  if (onPress === undefined) return content;
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}>
      {content}
    </Pressable>
  );
}
