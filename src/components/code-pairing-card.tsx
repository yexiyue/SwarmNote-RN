import { ActivityIndicator, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useExpiresCountdown } from "@/hooks/useExpiresCountdown";

/** Mirrors the two `Code Pairing Card/*` reusables in the Pencil design
 *  (idle + generated) as one React component — the design-side split only
 *  exists to work around Pencil's lack of variants. Branch on `code != null`. */
interface CodePairingCardProps {
  code?: string;
  expiresAt?: Date;
  loading?: boolean;
  onGenerate?: () => void;
  onExpire?: () => void;
}

export function CodePairingCard({
  code,
  expiresAt,
  loading = false,
  onGenerate,
  onExpire,
}: CodePairingCardProps) {
  const generated = code !== undefined && code !== null;
  const remaining = useExpiresCountdown(generated ? expiresAt : null, onExpire);

  return (
    <View className="self-stretch rounded-xl border border-border bg-card p-4 gap-3">
      {!generated ? (
        <>
          <Text className="text-sm font-semibold text-muted-foreground uppercase">跨网络配对</Text>
          <Text className="text-sm text-muted-foreground">生成 6 位配对码，发给对方设备输入</Text>
          <Button onPress={onGenerate} disabled={loading}>
            {loading ? <ActivityIndicator /> : <Text>生成配对码</Text>}
          </Button>
        </>
      ) : (
        <>
          <Text className="text-sm font-semibold text-muted-foreground uppercase">配对码</Text>
          <Text className="text-4xl font-bold tracking-widest text-foreground text-center font-mono">
            {code ?? "------"}
          </Text>
          <Text className="text-xs text-muted-foreground text-center">
            {remaining > 0 ? `${formatRemaining(remaining)} 后过期` : "已过期"}
          </Text>
        </>
      )}
    </View>
  );
}

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
