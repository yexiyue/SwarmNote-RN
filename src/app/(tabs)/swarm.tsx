import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CodePairingCard } from "@/components/code-pairing-card";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { usePairingCodeGenerator } from "@/hooks/usePairingCodeGenerator";
import { useNetworkPreferenceStore } from "@/stores/network-preference-store";
import { useSwarmStore } from "@/stores/swarm-store";

export default function Swarm() {
  const router = useRouter();
  const online = useSwarmStore((s) => s.online);
  const natStatus = useSwarmStore((s) => s.natStatus);
  const devices = useSwarmStore((s) => s.devices);
  const pairedDevices = useSwarmStore((s) => s.pairedDevices);
  const userWantsNetwork = useNetworkPreferenceStore((s) => s.userWantsNetwork);
  const setUserWantsNetwork = useNetworkPreferenceStore((s) => s.setUserWantsNetwork);

  const { code, expiresAt, generating, generate, reset } = usePairingCodeGenerator();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 p-4">
        {/* Network status card */}
        <View className="rounded-xl border border-border bg-card p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-1">
              <Text className="text-base font-semibold text-foreground">
                {online ? "P2P 网络运行中" : "P2P 网络未运行"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {online
                  ? `${devices.length} 台设备 · ${natStatus ?? "NAT 未知"}`
                  : userWantsNetwork
                    ? "正在启动…"
                    : "已手动关闭"}
              </Text>
            </View>
            <Switch checked={userWantsNetwork} onCheckedChange={setUserWantsNetwork} />
          </View>
        </View>

        {/* Paired devices */}
        <View className="gap-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase px-1">
            已配对设备 ({pairedDevices.length})
          </Text>
          {pairedDevices.length === 0 ? (
            <View className="rounded-xl border border-border bg-card p-4">
              <Text className="text-sm text-muted-foreground text-center">还没有配对设备</Text>
            </View>
          ) : (
            pairedDevices.map((d) => (
              <View key={d.peerId} className="rounded-xl border border-border bg-card p-4 gap-1">
                <Text className="text-base text-foreground">
                  {d.name ?? d.hostname ?? d.peerId.slice(0, 12)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {d.os} · {d.platform}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Pair Section */}
        <View className="gap-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase px-1">
            配对新设备
          </Text>
          <CodePairingCard
            code={code ?? undefined}
            expiresAt={expiresAt ?? undefined}
            loading={generating}
            onGenerate={generate}
            onExpire={reset}
          />
          <Pressable onPress={() => router.push("/pairing/input-code" as never)}>
            <Text className="text-sm text-primary text-center py-2">有配对码？点击输入</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
