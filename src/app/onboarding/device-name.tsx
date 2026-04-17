import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function DeviceName() {
  const router = useRouter();
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
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 gap-6 px-6 pt-12">
        <View className="gap-2">
          <Text className="text-2xl font-bold text-foreground">给你的设备起个名字</Text>
          <Text className="text-sm text-muted-foreground">其他设备将通过这个名字识别你</Text>
        </View>
        <Input
          placeholder="例如：我的 iPhone"
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={40}
        />
        {error !== null ? <Text className="text-sm text-destructive">{error}</Text> : null}
      </View>
      <View className="px-6 pb-6">
        <Button onPress={onNext} disabled={disabled} size="lg">
          {saving ? <ActivityIndicator /> : <Text>下一步</Text>}
        </Button>
      </View>
    </SafeAreaView>
  );
}
