import { useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function Welcome() {
  const router = useRouter();
  const nextStep = useOnboardingStore((s) => s.nextStep);

  const onNext = () => {
    nextStep();
    router.push("/onboarding/device-name" as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-3xl font-bold text-foreground text-center">欢迎来到 SwarmNote</Text>
        <Text className="text-base text-muted-foreground text-center">去中心化笔记与 P2P 同步</Text>
      </View>
      <View className="px-6 pb-6">
        <Button onPress={onNext} size="lg">
          <Text>开始</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
