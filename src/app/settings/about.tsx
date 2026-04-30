import { Trans, useLingui } from "@lingui/react/macro";
import Constants from "expo-constants";
import {
  BadgeCheck,
  BookOpen,
  Code,
  Download,
  FileText,
  Loader,
  MessageSquare,
  RefreshCw,
} from "lucide-react-native";
import { Linking, Platform, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { SettingsHeader } from "@/components/settings-header";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { toast } from "@/lib/toast";
import { useUpdateStore } from "@/stores/update-store";

const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

export default function AboutSettings() {
  const colors = useThemeColors();
  const { t } = useLingui();
  const { status, checkForUpdate } = useUpdateStore(
    useShallow((s) => ({ status: s.status, checkForUpdate: s.checkForUpdate })),
  );

  const isAndroid = Platform.OS === "android";
  const isChecking = status === "checking";
  const hasUpdate = status === "available" || status === "force-required";

  const openUrl = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.warn("[about] openURL failed:", err);
      toast.error(t`无法打开链接`, err);
    });
  };

  const onCheckUpdate = () => {
    if (isChecking) return;
    void checkForUpdate(true);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <SettingsHeader title={t`关于`} />

      <View className="flex-1 items-center justify-center px-8 -mt-10">
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Text className="text-[22px] font-bold text-primary">SN</Text>
          </View>
          <View>
            <Text className="text-[19px] font-semibold tracking-tight text-foreground">
              SwarmNote
            </Text>
            <View className="flex-row items-center gap-2 mt-0.5">
              <Text className="text-[13px] text-muted-foreground">v{APP_VERSION}</Text>
              <View className="flex-row items-center gap-1">
                {hasUpdate ? (
                  <>
                    <Download color={colors.primary} size={12} />
                    <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                      <Trans>有新版可用</Trans>
                    </Text>
                  </>
                ) : isChecking ? (
                  <>
                    <Loader color={colors.mutedForeground} size={12} />
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: colors.mutedForeground }}
                    >
                      <Trans>正在检查...</Trans>
                    </Text>
                  </>
                ) : (
                  <>
                    <BadgeCheck color={colors.success} size={12} />
                    <Text className="text-[11px] font-medium" style={{ color: colors.success }}>
                      <Trans>已是最新</Trans>
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        <Text className="mt-5 text-[13px] text-muted-foreground">
          <Trans>去中心化、本地优先的 P2P 笔记应用</Trans>
        </Text>

        <View className="mt-6 flex-row items-center gap-3">
          {isAndroid && (
            <Pressable
              onPress={onCheckUpdate}
              disabled={isChecking}
              className="h-9 flex-row items-center gap-1.5 rounded-lg border border-border px-3.5"
              accessibilityLabel={t`检查更新`}
              style={{ opacity: isChecking ? 0.5 : 1 }}
            >
              <RefreshCw color={colors.foreground} size={13} />
              <Text className="text-[13px] text-foreground">
                <Trans>检查更新</Trans>
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => openUrl("https://github.com/yexiyue/SwarmNote/releases")}
            className="h-9 flex-row items-center gap-1.5 rounded-lg border border-border px-3.5"
            accessibilityLabel={t`更新日志`}
          >
            <FileText color={colors.foreground} size={13} />
            <Text className="text-[13px] text-foreground">
              <Trans>更新日志</Trans>
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom links */}
      <View className="flex-row items-center justify-center gap-5 pb-6">
        <LinkButton
          icon={Code}
          label="GitHub"
          onPress={() => openUrl("https://github.com/yexiyue/SwarmNote")}
        />
        <View className="h-3 w-px bg-border" />
        <LinkButton
          icon={BookOpen}
          label={t`文档`}
          onPress={() => openUrl("https://yexiyue.github.io/SwarmNote/")}
        />
        <View className="h-3 w-px bg-border" />
        <LinkButton
          icon={MessageSquare}
          label={t`反馈`}
          onPress={() => openUrl("https://github.com/yexiyue/SwarmNote/issues")}
        />
      </View>
    </SafeAreaView>
  );
}

function LinkButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1" accessibilityLabel={label}>
      <Icon color={colors.mutedForeground} size={12} />
      <Text className="text-[12px] text-muted-foreground">{label}</Text>
    </Pressable>
  );
}
