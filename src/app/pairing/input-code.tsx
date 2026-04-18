import { useRouter } from "expo-router";
import { OTPInput, type OTPInputRef, type SlotProps } from "input-otp-native";
import { ArrowLeft } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useThemeColors } from "@/hooks/useThemeColors";

const SLOT_KEYS = ["s0", "s1", "s2", "s3", "s4", "s5"] as const;

/** 6-digit OTP entry. On complete: `lookupDeviceByCode` resolves the remote
 *  peer, then we navigate to `found-device` for the confirmation step. */
export default function InputCode() {
  const router = useRouter();
  const colors = useThemeColors();
  const otpRef = useRef<OTPInputRef>(null);
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLookup = async (filled: string) => {
    if (looking) return;
    setError(null);
    setLooking(true);
    try {
      const result = await getAppCore().lookupDeviceByCode(filled);
      router.push({
        pathname: "/pairing/found-device",
        params: {
          peerId: result.peerId,
          code: filled,
          name: result.osInfo.name ?? "",
          hostname: result.osInfo.hostname,
          os: result.osInfo.os,
          platform: result.osInfo.platform,
          arch: result.osInfo.arch,
        },
      });
    } catch (_err) {
      setError("配对码无效或已过期");
      setCode("");
      otpRef.current?.clear();
    } finally {
      setLooking(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <View className="mt-2 h-11 flex-row items-center justify-between px-6">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="返回"
          className="h-11 w-11 -ml-2 items-start justify-center"
        >
          <ArrowLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text className="text-[17px] font-semibold text-foreground">输入配对码</Text>
        <View className="h-6 w-6" />
      </View>

      <View className="flex-1 items-center justify-center gap-5 px-6 pb-6">
        <Text className="text-center text-[15px] text-muted-foreground">
          输入对方设备上显示的 6 位配对码
        </Text>
        <OTPInput
          ref={otpRef}
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={onLookup}
          textAlign="center"
          render={({ slots }) => (
            <View className="flex-row items-center justify-center gap-2.5">
              {slots.map((slot, i) => (
                <Pressable key={SLOT_KEYS[i]} onPress={() => otpRef.current?.focus()}>
                  <OtpSlot {...slot} />
                </Pressable>
              ))}
            </View>
          )}
        />
        {error !== null ? (
          <Text className="text-[13px] text-destructive">{error}</Text>
        ) : looking ? (
          <ActivityIndicator color={colors.mutedForeground} />
        ) : null}
      </View>

      <View className="px-6 pb-6">
        <Pressable
          onPress={() => onLookup(code)}
          disabled={code.length !== 6 || looking}
          accessibilityLabel="连接"
          className="h-13 items-center justify-center rounded-xl bg-primary disabled:bg-muted"
        >
          {looking ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <Text className="text-[17px] font-semibold text-primary-foreground disabled:text-muted-foreground">
              连接
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function OtpSlot({ char, isActive }: SlotProps) {
  return (
    <View
      className={`h-15 w-12 items-center justify-center rounded-[10px] bg-muted ${
        isActive ? "border-2 border-primary" : "border border-border"
      }`}
    >
      {char !== null ? <Text className="text-[28px] font-bold text-foreground">{char}</Text> : null}
    </View>
  );
}
