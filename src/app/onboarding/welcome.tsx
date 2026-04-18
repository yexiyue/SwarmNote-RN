import { useRouter } from "expo-router";
import { Hexagon, Merge, Repeat, ShieldCheck } from "lucide-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useOnboardingStore } from "@/stores/onboarding-store";

const FEATURES = [
  { icon: ShieldCheck, text: "数据完全本地，隐私优先" },
  { icon: Repeat, text: "P2P 免服务器，设备直连同步" },
  { icon: Merge, text: "CRDT 自动合并，离线也能编辑" },
];

export default function Welcome() {
  const router = useRouter();
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const colors = useThemeColors();

  const onNext = () => {
    nextStep();
    router.push("/onboarding/device-name" as never);
  };

  // `flex: 1` as inline style on SafeAreaView is a workaround for nativewind v5
  // preview.3 bug where className-driven layout isn't applied on SafeAreaView —
  // see https://github.com/nativewind/react-native-css/issues/234. Plain `View`
  // components accept `className="flex-1"` normally.
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 pb-6">
        <View className="flex-1 items-center justify-center gap-8">
          <View className="items-center gap-4">
            <Hexagon color={colors.primary} size={80} strokeWidth={1.5} />
            <Text className="text-4xl font-bold text-foreground">SwarmNote</Text>
            <Text className="text-base text-muted-foreground">去中心化笔记，自然同步</Text>
          </View>

          <View className="w-75 gap-5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <View key={text} className="flex-row items-center gap-3.5">
                <Icon color={colors.primary} size={24} strokeWidth={2} />
                <Text className="flex-1 text-[15px] text-foreground">{text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-4">
          <Button
            onPress={onNext}
            size="lg"
            className="h-13 rounded-xl"
            accessibilityLabel="开始使用 SwarmNote"
          >
            <Text className="text-[17px] font-semibold text-primary-foreground">开始使用</Text>
          </Button>

          <View className="flex-row items-center justify-center gap-2">
            <View className="size-2.5 rounded-full bg-primary" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
            <View className="size-2 rounded-full bg-muted-foreground/40" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
