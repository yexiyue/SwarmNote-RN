import { Laptop, type LucideIcon, Monitor, Smartphone, Tablet } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";

function iconFor(os: string | undefined, platform: string | undefined): LucideIcon {
  const hay = `${os ?? ""} ${platform ?? ""}`.toLowerCase();
  if (hay.includes("ipad") || hay.includes("tablet")) return Tablet;
  if (hay.includes("ios") || hay.includes("android")) return Smartphone;
  if (hay.includes("mac") || hay.includes("windows")) return Laptop;
  return Monitor;
}

export interface DeviceCardProps {
  name: string;
  os?: string;
  platform?: string;
  /** Optional explicit meta string. When omitted, composed from os/platform/network. */
  meta?: string;
  network?: string;
  variant?: "inline" | "filled";
  extra?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  iconSize?: number;
}

/**
 * Reusable device row: icon + name + meta + optional extra slot.
 *
 * - `inline` (default): transparent background, used inside list containers that
 *   already provide their own bg/border/divider.
 * - `filled`: `bg-background rounded-xl p-3.5`, used as a standalone card inside
 *   dialogs / sheets.
 */
export function DeviceCard({
  name,
  os,
  platform,
  meta,
  network,
  variant = "inline",
  extra,
  onPress,
  accessibilityLabel,
  iconSize = 22,
}: DeviceCardProps) {
  const colors = useThemeColors();
  const Icon = iconFor(os, platform);

  const composedMeta =
    meta ??
    [os, platform, network]
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .join(" · ");

  const content = (
    <>
      <Icon color={colors.mutedForeground} size={iconSize} />
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
          {name}
        </Text>
        {composedMeta.length > 0 ? (
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {composedMeta}
          </Text>
        ) : null}
      </View>
      {extra}
    </>
  );

  const containerClass = cn(
    "flex-row items-center gap-3",
    variant === "filled" ? "rounded-xl bg-background p-3.5" : null,
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={cn(containerClass, "active:opacity-70")}
      >
        {content}
      </Pressable>
    );
  }

  return <View className={containerClass}>{content}</View>;
}
