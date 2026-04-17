import { useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function Complete() {
  const router = useRouter();
  const markCompleted = useOnboardingStore((s) => s.markCompleted);

  const onEnter = () => {
    markCompleted();
    router.replace("/(tabs)" as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-3xl font-bold text-foreground text-center">已完成设置</Text>
        <Text className="text-base text-muted-foreground text-center">开始写你的第一篇笔记吧</Text>
      </View>
      <View className="px-6 pb-6">
        <Button onPress={onEnter} size="lg">
          <Text>进入 App</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
