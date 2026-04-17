import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiDeviceInfo } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useSwarmStore } from "@/stores/swarm-store";

export default function Settings() {
  const [info, setInfo] = useState<UniffiDeviceInfo | null>(null);
  const keychainEphemeral = useSwarmStore((s) => s.keychainEphemeral);

  useEffect(() => {
    try {
      setInfo(getAppCore().deviceInfo());
    } catch (err) {
      console.warn("[settings] deviceInfo failed:", err);
    }
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="rounded-xl border border-border bg-card p-4 gap-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase">我的设备</Text>
          <Text className="text-lg font-semibold text-foreground">{info?.deviceName ?? "—"}</Text>
          <Text className="text-xs font-mono text-muted-foreground" numberOfLines={1}>
            {info?.peerId ?? ""}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {info ? `${info.os} · ${info.platform} · ${info.arch}` : ""}
          </Text>
          {keychainEphemeral ? (
            <Text className="text-xs text-destructive">⚠ 密钥链不可用，身份为临时状态</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
