import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CodePairingCard } from "@/components/code-pairing-card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { usePairingCodeGenerator } from "@/hooks/usePairingCodeGenerator";
import { useNetworkPreferenceStore } from "@/stores/network-preference-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useSwarmStore } from "@/stores/swarm-store";

export default function Pairing() {
  const router = useRouter();
  const userWantsNetwork = useNetworkPreferenceStore((s) => s.userWantsNetwork);
  const online = useSwarmStore((s) => s.online);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const { code, expiresAt, generating, generate, reset } = usePairingCodeGenerator();

  useEffect(() => {
    if (!userWantsNetwork || online) return;
    getAppCore()
      .startNetwork()
      .catch((err: unknown) => {
        console.warn("[onboarding/pairing] startNetwork failed:", err);
      });
  }, [userWantsNetwork, online]);

  const gotoComplete = () => {
    nextStep();
    router.push("/onboarding/complete" as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 gap-6 px-6 pt-12">
        <View className="gap-2">
          <Text className="text-2xl font-bold text-foreground">与已有设备配对（可选）</Text>
          <Text className="text-sm text-muted-foreground">
            在另一台设备上输入配对码，即可同步数据
          </Text>
        </View>

        <CodePairingCard
          code={code ?? undefined}
          expiresAt={expiresAt ?? undefined}
          loading={generating}
          onGenerate={generate}
          onExpire={reset}
        />

        <Pressable onPress={() => router.push("/pairing/input-code" as never)}>
          <Text className="text-sm text-primary text-center">有配对码？点击输入</Text>
        </Pressable>
      </View>
      <View className="px-6 pb-6 gap-2">
        <Button onPress={gotoComplete} size="lg">
          <Text>下一步</Text>
        </Button>
        <Pressable onPress={gotoComplete} className="py-3">
          <Text className="text-sm text-muted-foreground text-center">跳过</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
