import { Trans, useLingui } from "@lingui/react/macro";
import { Copy, KeyRound } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useExpiresCountdown } from "@/hooks/useExpiresCountdown";
import { useThemeColors } from "@/hooks/useThemeColors";

interface CodePairingCardProps {
  code?: string;
  expiresAt?: Date;
  loading?: boolean;
  onGenerate?: () => void;
  onExpire?: () => void;
  onCopy?: () => void;
}

export function CodePairingCard({
  code,
  expiresAt,
  loading = false,
  onGenerate,
  onExpire,
  onCopy,
}: CodePairingCardProps) {
  const colors = useThemeColors();
  const { t } = useLingui();
  const generated = code !== undefined && code !== null;
  const remaining = useExpiresCountdown(generated ? expiresAt : null, onExpire);

  if (!generated) {
    return (
      <View className="flex-row items-center gap-3 rounded-xl border border-border bg-muted p-4">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1.5">
            <KeyRound color={colors.primary} size={14} />
            <Text className="text-[13px] font-semibold text-foreground">
              <Trans>配对码</Trans>
            </Text>
          </View>
          <Text className="text-[11px] text-muted-foreground">
            <Trans>生成 6 位码，在另一台设备输入即可配对</Trans>
          </Text>
        </View>
        <Pressable
          onPress={onGenerate}
          disabled={loading}
          className="h-8.5 items-center justify-center rounded-lg bg-primary px-3.5 disabled:opacity-60"
          accessibilityLabel={t`生成配对码`}
        >
          {loading ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <Text className="text-[13px] font-semibold text-primary-foreground">
              <Trans>生成</Trans>
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  const expiryLabel =
    remaining > 0 ? t`${formatRemaining(remaining)} 后过期 · 在另一台设备输入此码` : t`已过期`;

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-primary bg-muted/60 p-4">
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <KeyRound color={colors.primary} size={14} />
          <Text className="text-[13px] font-semibold text-primary">
            <Trans>配对码</Trans>
          </Text>
          <Text className="text-[15px] font-bold tracking-[2px] text-foreground">{code}</Text>
        </View>
        <Text className="text-[11px] text-muted-foreground">{expiryLabel}</Text>
      </View>
      <Pressable
        onPress={onCopy}
        hitSlop={8}
        className="h-7.5 flex-row items-center justify-center gap-1 rounded-md border border-border px-2.5"
        accessibilityLabel={t`复制配对码`}
      >
        <Copy color={colors.mutedForeground} size={12} />
        <Text className="text-[11px] text-muted-foreground">
          <Trans>复制</Trans>
        </Text>
      </Pressable>
    </View>
  );
}

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
