import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function DeviceName() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useLingui();
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const disabled = saving || trimmed.length === 0;

  const onNext = async () => {
    setSaving(true);
    setError(null);
    try {
      await getAppCore().setDeviceName(trimmed);
      nextStep();
      router.push("/onboarding/pairing" as never);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-8 px-6 pt-2 pb-6">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel={t`返回`}
          className="h-11 w-11 -ml-2 items-start justify-center"
        >
          <ArrowLeft color={colors.foreground} size={24} />
        </Pressable>

        <View className="gap-2.5">
          <Text className="text-[28px] font-bold text-foreground">
            <Trans>给设备取个名字</Trans>
          </Text>
          <Text className="text-[15px] leading-6 text-muted-foreground">
            <Trans>用于在 P2P 网络中识别这台设备，{"\n"}其他设备配对时会看到这个名称。</Trans>
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">
            <Trans>设备名称</Trans>
          </Text>
          <Input
            className="h-12 rounded-[10px] border-border bg-muted px-3.5 text-base"
            placeholder={t`我的 iPhone`}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={40}
          />
          <Text className="text-[13px] text-muted-foreground">
            <Trans>默认使用系统主机名，你可以随时在设置中修改</Trans>
          </Text>
          {error !== null ? <Text className="text-[13px] text-destructive">{error}</Text> : null}
        </View>

        <View className="flex-1" />

        <View className="gap-4">
          <Button
            onPress={onNext}
            disabled={disabled}
            size="lg"
            className="h-13 rounded-xl"
            accessibilityLabel={t`继续`}
          >
            {saving ? (
              <ActivityIndicator color={colors.foreground} />
            ) : (
              <Text className="text-[17px] font-semibold text-primary-foreground">
                <Trans>继续</Trans>
              </Text>
            )}
          </Button>

          <View className="flex-row items-center justify-center gap-2">
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2.5 rounded-full bg-primary" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
