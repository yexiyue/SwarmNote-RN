import { useRouter } from "expo-router";
import { ArrowLeft, Check, Hexagon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiDeviceInfo } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";
import { truncatePeerId } from "@/lib/peer-id";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function Complete() {
  const router = useRouter();
  const colors = useThemeColors();
  const markCompleted = useOnboardingStore((s) => s.markCompleted);
  const [info, setInfo] = useState<UniffiDeviceInfo | null>(null);

  useEffect(() => {
    try {
      setInfo(getAppCore().deviceInfo());
    } catch (err) {
      console.warn("[onboarding/complete] deviceInfo failed:", err);
    }
  }, []);

  const onEnter = () => {
    markCompleted();
    router.replace("/(main)" as never);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 pb-6 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="返回"
          className="h-11 w-11 -ml-2 items-start justify-center"
        >
          <ArrowLeft color={colors.foreground} size={24} />
        </Pressable>

        <View className="flex-1 justify-center gap-8">
          <View className="items-center gap-5">
            <View className="h-22 w-22 items-center justify-center rounded-full bg-muted">
              <Check color={colors.primary} size={40} strokeWidth={2.5} />
            </View>
            <Text className="text-[28px] font-bold text-foreground">一切就绪！</Text>
            <Text className="text-center text-[16px] text-muted-foreground">
              你的设备已准备好加入蜂群网络
            </Text>
          </View>

          <View className="gap-3.5 rounded-xl border border-border bg-muted p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[14px] text-muted-foreground">设备名称</Text>
              <Text
                className="max-w-[60%] text-[14px] font-medium text-foreground"
                numberOfLines={1}
              >
                {info?.deviceName ?? "—"}
              </Text>
            </View>
            <View className="h-px bg-border" />
            <View className="flex-row items-center justify-between">
              <Text className="text-[14px] text-muted-foreground">设备 ID</Text>
              <Text className="text-[14px] font-medium text-foreground">
                {info ? truncatePeerId(info.peerId) : "—"}
              </Text>
            </View>
          </View>
        </View>

        <View className="gap-4">
          <Pressable
            onPress={onEnter}
            accessibilityLabel="进入 SwarmNote"
            className="h-13 flex-row items-center justify-center gap-2 rounded-xl bg-primary"
          >
            <Hexagon color={colors.foreground} size={20} />
            <Text className="text-[17px] font-semibold text-primary-foreground">
              进入 SwarmNote
            </Text>
          </Pressable>

          <View className="flex-row items-center justify-center gap-2">
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2.5 rounded-full bg-primary" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
