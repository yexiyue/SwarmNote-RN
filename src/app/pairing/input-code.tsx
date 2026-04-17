import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UniffiPairingMethod } from "react-native-swarmnote-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";

/** 6-digit OTP code entry. Flow:
 *  1. user types 6 digits
 *  2. `lookupDeviceByCode` fetches the remote peer's info
 *  3. user confirms → `requestPairing(peer, Code{code})`
 *  4. success → pop back; UI catches `PairedDeviceAdded` via event bus */
export default function InputCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{
    peerId: string;
    deviceName: string;
    os: string;
  } | null>(null);

  const onLookup = async () => {
    setError(null);
    setLooking(true);
    try {
      const result = await getAppCore().lookupDeviceByCode(code);
      setResolved({
        peerId: result.peerId,
        deviceName: result.osInfo.name ?? result.osInfo.hostname,
        os: result.osInfo.os,
      });
    } catch (_err) {
      setError("配对码无效或已过期");
      setCode("");
    } finally {
      setLooking(false);
    }
  };

  const onConfirm = async () => {
    if (!resolved) return;
    setError(null);
    setConfirming(true);
    try {
      await getAppCore().requestPairing(
        resolved.peerId,
        UniffiPairingMethod.Code.new({ code }),
        undefined,
      );
      router.back();
    } catch (err) {
      setError(String(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 gap-6 px-6 pt-12">
        {resolved === null ? (
          <>
            <View className="gap-2">
              <Text className="text-2xl font-bold text-foreground">输入配对码</Text>
              <Text className="text-sm text-muted-foreground">
                从另一台设备的 Swarm 页面获取 6 位配对码
              </Text>
            </View>
            <Input
              placeholder="6 位配对码"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
            />
            {error !== null ? <Text className="text-sm text-destructive">{error}</Text> : null}
          </>
        ) : (
          <>
            <View className="gap-2">
              <Text className="text-2xl font-bold text-foreground">确认配对</Text>
              <Text className="text-sm text-muted-foreground">
                找到 "{resolved.deviceName}" ({resolved.os})
              </Text>
              <Text className="text-xs font-mono text-muted-foreground">
                peer {resolved.peerId.slice(0, 12)}…
              </Text>
            </View>
            {error !== null ? <Text className="text-sm text-destructive">{error}</Text> : null}
          </>
        )}
      </View>
      <View className="px-6 pb-6">
        {resolved === null ? (
          <Button onPress={onLookup} size="lg" disabled={code.length !== 6 || looking}>
            {looking ? <ActivityIndicator /> : <Text>查找设备</Text>}
          </Button>
        ) : (
          <Button onPress={onConfirm} size="lg" disabled={confirming}>
            {confirming ? <ActivityIndicator /> : <Text>确认配对</Text>}
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
