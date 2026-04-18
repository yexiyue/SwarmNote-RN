import { useRouter } from "expo-router";
import { Check, X as CloseIcon, Radar, RefreshCw, Smartphone } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type UniffiDevice,
  type UniffiDeviceInfo,
  UniffiPairingMethod,
} from "react-native-swarmnote-core";
import { CodePairingCard } from "@/components/code-pairing-card";
import { SettingsHeader } from "@/components/settings-header";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { usePairingCodeGenerator } from "@/hooks/usePairingCodeGenerator";
import { useThemeColors } from "@/hooks/useThemeColors";
import { devicePlatformIcon } from "@/lib/device-platform";
import { truncatePeerId } from "@/lib/peer-id";
import { useSwarmStore } from "@/stores/swarm-store";

export default function DevicesSettings() {
  const router = useRouter();
  const colors = useThemeColors();
  const devices = useSwarmStore((s) => s.devices);
  const pairedDevices = useSwarmStore((s) => s.pairedDevices);
  const [info, setInfo] = useState<UniffiDeviceInfo | null>(null);

  useEffect(() => {
    try {
      setInfo(getAppCore().deviceInfo());
    } catch (err) {
      console.warn("[devices] deviceInfo failed:", err);
    }
  }, []);

  const { code, expiresAt, generating, generate, reset } = usePairingCodeGenerator();
  const nearby = devices.filter((d) => !d.isPaired);

  const [pairingPeerId, setPairingPeerId] = useState<string | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);

  const onPairNearby = async (device: UniffiDevice) => {
    if (pairingPeerId !== null) return;
    setPairError(null);
    setPairingPeerId(device.peerId);
    try {
      const resp = await getAppCore().requestPairing(
        device.peerId,
        UniffiPairingMethod.Direct.new(),
        {
          name: device.name,
          hostname: device.hostname,
          os: device.os,
          platform: device.platform,
          arch: device.arch,
        },
      );
      if (resp.tag === "Refused") {
        setPairError("配对被拒绝");
      } else {
        router.push({
          pathname: "/pairing/success",
          params: {
            peerId: device.peerId,
            name: device.name ?? "",
            hostname: device.hostname,
            os: device.os,
            arch: device.arch,
          },
        });
      }
    } catch (err) {
      setPairError(String(err));
    } finally {
      setPairingPeerId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <SettingsHeader
        title="设备"
        right={
          <Pressable
            onPress={() => router.push("/pairing/input-code" as never)}
            className="h-8 rounded-lg border border-border px-3 justify-center"
            accessibilityLabel="输入配对码"
          >
            <Text className="text-[12px] text-foreground">输入配对码</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <MyDeviceCard
          info={info}
          onRenamed={(next) => setInfo((prev) => (prev ? { ...prev, deviceName: next } : prev))}
        />

        <CodePairingCard
          code={code ?? undefined}
          expiresAt={expiresAt ?? undefined}
          loading={generating}
          onGenerate={generate}
          onExpire={reset}
        />

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              已配对设备
            </Text>
            {pairedDevices.length > 0 ? (
              <Text className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {pairedDevices.length} 台
              </Text>
            ) : null}
          </View>
          {pairedDevices.length > 0 ? (
            <View className="overflow-hidden rounded-xl border border-border bg-card">
              {pairedDevices.map((d, i) => {
                const Icon = devicePlatformIcon(d.platform);
                const isOnline = d.isOnline === true;
                const rtt = d.rttMs !== undefined ? Number(d.rttMs) : undefined;
                const meta =
                  isOnline && rtt !== undefined
                    ? `${d.os} · 局域网 · ${rtt}ms`
                    : `${d.os} · ${d.platform}`;
                return (
                  <View key={d.peerId}>
                    <View className="flex-row items-center gap-3 px-3.5 py-3">
                      <Icon color={colors.mutedForeground} size={18} />
                      <View className="flex-1 gap-0.5">
                        <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
                          {d.name ?? d.hostname}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          {meta}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <View
                          style={{
                            backgroundColor: isOnline ? colors.success : colors.mutedForeground,
                          }}
                          className="h-2 w-2 rounded-full"
                        />
                        <Text
                          style={{ color: isOnline ? colors.success : colors.mutedForeground }}
                          className="text-[11px] font-medium"
                        >
                          {isOnline ? "在线" : "离线"}
                        </Text>
                      </View>
                    </View>
                    {i < pairedDevices.length - 1 ? <View className="h-px bg-border" /> : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-5">
              <Text className="text-center text-[12px] text-muted-foreground">还没有配对设备</Text>
            </View>
          )}
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              附近设备
            </Text>
            <Pressable
              hitSlop={6}
              className="flex-row items-center gap-1 rounded-md border border-border px-2 h-6"
              accessibilityLabel="刷新"
            >
              <RefreshCw color={colors.mutedForeground} size={11} />
              <Text className="text-[10px] text-muted-foreground">刷新</Text>
            </Pressable>
          </View>
          {pairError !== null ? (
            <Text className="px-1 text-[12px] text-destructive">{pairError}</Text>
          ) : null}
          {nearby.length > 0 ? (
            <View className="overflow-hidden rounded-xl border border-border bg-card">
              {nearby.map((d, i) => {
                const Icon = devicePlatformIcon(d.platform);
                return (
                  <View key={d.peerId}>
                    <View className="h-14 flex-row items-center gap-3 px-3.5">
                      <Icon color={colors.mutedForeground} size={18} />
                      <View className="flex-1 gap-0.5">
                        <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
                          {d.name ?? d.hostname}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          {d.os} · 局域网
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => onPairNearby(d)}
                        disabled={pairingPeerId !== null}
                        accessibilityLabel={`配对 ${d.name ?? d.hostname}`}
                        className="h-8 min-w-14 items-center justify-center rounded-lg bg-primary px-3 disabled:opacity-60"
                      >
                        {pairingPeerId === d.peerId ? (
                          <ActivityIndicator color={colors.foreground} size="small" />
                        ) : (
                          <Text className="text-[12px] font-semibold text-primary-foreground">
                            配对
                          </Text>
                        )}
                      </Pressable>
                    </View>
                    {i < nearby.length - 1 ? <View className="h-px bg-border" /> : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-4 py-5">
              <Radar color={colors.mutedForeground} size={24} strokeWidth={1.5} />
              <Text className="text-center text-[12px] text-muted-foreground">暂无附近设备</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MyDeviceCard({
  info,
  onRenamed,
}: {
  info: UniffiDeviceInfo | null;
  onRenamed: (next: string) => void;
}) {
  const colors = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(info?.deviceName ?? "");
    setError(false);
    // Defer focus one tick so the TextInput is mounted before we call focus().
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [editing, info?.deviceName]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError(true);
      return;
    }
    if (trimmed === info?.deviceName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await getAppCore().setDeviceName(trimmed);
      onRenamed(trimmed);
      setEditing(false);
    } catch (err) {
      console.warn("[devices] setDeviceName failed:", err);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-muted">
        <Smartphone color={colors.primary} size={20} />
      </View>
      <View className="flex-1 gap-0.5">
        {editing ? (
          <View className="flex-row items-center gap-1.5">
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                setError(false);
              }}
              onSubmitEditing={commit}
              maxLength={40}
              editable={!saving}
              textAlignVertical="center"
              style={[Platform.OS === "android" && { includeFontPadding: false }]}
              className={`h-8 flex-1 rounded-md border px-2 text-[13px] text-foreground ${error ? "border-destructive" : "border-border"}`}
            />
            <Pressable
              onPress={commit}
              disabled={saving}
              hitSlop={6}
              className="h-7 w-7 items-center justify-center rounded-md"
              accessibilityLabel="保存"
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <Check color={colors.primary} size={16} />
              )}
            </Pressable>
            <Pressable
              onPress={() => setEditing(false)}
              disabled={saving}
              hitSlop={6}
              className="h-7 w-7 items-center justify-center rounded-md"
              accessibilityLabel="取消"
            >
              <CloseIcon color={colors.mutedForeground} size={16} />
            </Pressable>
          </View>
        ) : (
          <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
            {info?.deviceName ?? "—"}
          </Text>
        )}
        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
          {info ? `${info.os} · ${info.arch} · 当前设备` : "—"}
        </Text>
        {info ? (
          <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
            Peer ID: {truncatePeerId(info.peerId)}
          </Text>
        ) : null}
      </View>
      {editing ? null : (
        <Pressable
          onPress={() => setEditing(true)}
          hitSlop={6}
          className="h-8 rounded-lg border border-border px-3 justify-center"
          accessibilityLabel="编辑设备名称"
        >
          <Text className="text-[12px] text-foreground">编辑</Text>
        </Pressable>
      )}
    </View>
  );
}
