import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "lucide-react-native";
import { useCallback } from "react";
import { Dimensions, Platform, Pressable, View } from "react-native";
import { DeviceCard } from "@/components/device-card";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useExpiresCountdown } from "@/hooks/useExpiresCountdown";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useNotificationStore } from "@/stores/notification-store";

/** Global listener for `PairingRequestReceived` events — renders an
 *  `AlertDialog` for the topmost pending request. Mounts once in the root
 *  layout; reads `current` from `notificationStore` (queue behind it). */
export function PairingRequestHost() {
  const { t } = useLingui();
  const colors = useThemeColors();
  const current = useNotificationStore((s) => s.current);
  const respond = useNotificationStore((s) => s.respond);

  const open = current !== null && current.type === "pairing-request";
  const payload = open ? current.payload : null;

  const respondToRequest = useCallback(
    (accept: boolean) => {
      if (!current || !payload) return;
      respond(current.id);
      // PairingExpired on reject is fine — user / system may have beat us to it.
      getAppCore()
        .respondPairingRequest(payload.pendingId, accept)
        .catch((err: unknown) => {
          console.warn(`[pairing-host] ${accept ? "accept" : "reject"} failed:`, err);
        });
    },
    [current, payload, respond],
  );

  const onExpire = useCallback(() => {
    if (!current) return;
    respond(current.id);
  }, [current, respond]);

  const remaining = useExpiresCountdown(payload?.expiresAt, onExpire);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        style={[
          {
            borderRadius: 20,
            borderWidth: 0,
            width: Math.min(Dimensions.get("window").width * 0.8, 480),
          },
          Platform.OS === "android"
            ? { elevation: 24 }
            : {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 0.2,
                shadowRadius: 40,
              },
        ]}
        className="max-w-none gap-4 bg-card p-6 sm:max-w-none"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-accent">
            <Link color={colors.primary} size={22} />
          </View>
          <AlertDialogTitle className="text-foreground text-lg font-bold">
            <Trans>配对请求</Trans>
          </AlertDialogTitle>
          <View className="flex-1" />
          {payload ? (
            <Text className="text-xs text-muted-foreground">
              {remaining > 0 ? t`${remaining}s` : t`已过期`}
            </Text>
          ) : null}
        </View>

        {payload ? (
          <>
            <Text className="text-sm text-muted-foreground">
              {t`${payload.deviceName} 请求与你的设备配对`}
            </Text>

            <DeviceCard
              variant="filled"
              name={payload.deviceName}
              os={payload.os}
              platform={payload.platform}
              network={t`局域网`}
            />
          </>
        ) : null}

        <View className="gap-2.5">
          <Pressable
            onPress={() => respondToRequest(true)}
            accessibilityRole="button"
            accessibilityLabel={t`接受`}
            className="h-12 items-center justify-center rounded-xl bg-primary active:opacity-80"
          >
            <Text className="text-base font-semibold text-primary-foreground">
              <Trans>接受</Trans>
            </Text>
          </Pressable>
          <Pressable
            onPress={() => respondToRequest(false)}
            accessibilityRole="button"
            accessibilityLabel={t`拒绝`}
            className="h-12 items-center justify-center rounded-xl border border-border bg-card active:opacity-80"
          >
            <Text className="text-base font-medium text-foreground">
              <Trans>拒绝</Trans>
            </Text>
          </Pressable>
        </View>
      </AlertDialogContent>
    </AlertDialog>
  );
}
