import { Trans, useLingui } from "@lingui/react/macro";
import { Power, Zap } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingRow, SettingSection } from "@/components/setting-row";
import { SettingsHeader } from "@/components/settings-header";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useNetworkPreferenceStore } from "@/stores/network-preference-store";
import { useSwarmStore } from "@/stores/swarm-store";

// 在线状态的卡片背景 / 边框 / 图标底用固定 green 色的淡色变体。
// 不接入主题 token：这些是功能性状态色，不跟 brand 变；hsl 变量做 alpha 合成繁琐，直接用 hex + alpha。
const SUCCESS_TINT_BG = "#4CAF5010";
const SUCCESS_TINT_BORDER = "#4CAF5040";
const SUCCESS_TINT_ICON_BG = "#4CAF5022";

export default function NetworkSettings() {
  const colors = useThemeColors();
  const { t } = useLingui();
  const online = useSwarmStore((s) => s.online);
  const natStatus = useSwarmStore((s) => s.natStatus);
  const pairedOnline = useSwarmStore(
    (s) => s.pairedDevices.filter((d) => d.isOnline === true).length,
  );
  const userWantsNetwork = useNetworkPreferenceStore((s) => s.userWantsNetwork);
  const setUserWantsNetwork = useNetworkPreferenceStore((s) => s.setUserWantsNetwork);

  const subtitle = online
    ? t`已连接 ${pairedOnline} 台设备 · ${natStatus ?? t`NAT 未知`}`
    : userWantsNetwork
      ? t`正在启动…`
      : t`已手动关闭`;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <SettingsHeader title={t`网络`} />

      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2">
          <Text className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Trans>P2P 网络</Trans>
          </Text>
          <View
            className="flex-row items-center gap-3 rounded-xl border p-4"
            style={{
              borderColor: online ? SUCCESS_TINT_BORDER : colors.border,
              backgroundColor: online ? SUCCESS_TINT_BG : colors.card,
            }}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: online ? SUCCESS_TINT_ICON_BG : colors.border }}
            >
              <Power color={online ? colors.success : colors.mutedForeground} size={20} />
            </View>
            <View className="flex-1 gap-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[14px] font-semibold text-foreground">
                  {online ? <Trans>运行中</Trans> : <Trans>未启动</Trans>}
                </Text>
                <View
                  className="rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: online ? SUCCESS_TINT_ICON_BG : colors.border }}
                >
                  <Text
                    className="text-[10px] font-medium"
                    style={{ color: online ? colors.success : colors.mutedForeground }}
                  >
                    P2P
                  </Text>
                </View>
              </View>
              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <Pressable
              onPress={() => setUserWantsNetwork(!userWantsNetwork)}
              hitSlop={6}
              className="h-8 rounded-lg border border-border px-3 justify-center"
              accessibilityLabel={userWantsNetwork ? t`关闭` : t`开启`}
            >
              <Text className="text-[12px] text-foreground">
                {userWantsNetwork ? <Trans>关闭</Trans> : <Trans>开启</Trans>}
              </Text>
            </Pressable>
          </View>
        </View>

        <SettingSection label={t`设置`}>
          <SettingRow
            icon={Zap}
            label={t`开机自动启动网络`}
            description={t`打开工作区时自动启动 P2P 节点`}
          >
            <Switch checked={userWantsNetwork} onCheckedChange={setUserWantsNetwork} />
          </SettingRow>
        </SettingSection>
      </ScrollView>
    </SafeAreaView>
  );
}
