import { useCallback } from "react";
import { View } from "react-native";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { getAppCore } from "@/core/app-core";
import { useExpiresCountdown } from "@/hooks/useExpiresCountdown";
import { useNotificationStore } from "@/stores/notification-store";

/** Global listener for `PairingRequestReceived` events — renders an
 *  `AlertDialog` for the topmost pending request. Mounts once in the root
 *  layout; reads `current` from `notificationStore` (queue behind it). */
export function PairingRequestHost() {
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>收到配对请求</AlertDialogTitle>
          <AlertDialogDescription>
            {payload ? `来自 "${payload.deviceName}" (${payload.os})` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <View className="gap-1">
          <Text className="text-xs font-mono text-muted-foreground">
            peer {payload?.peerId.slice(0, 12)}…
          </Text>
          <Text className="text-xs text-muted-foreground">
            {remaining > 0 ? `${remaining} 秒后过期` : "已过期"}
          </Text>
        </View>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={() => respondToRequest(false)}>
            <Text>拒绝</Text>
          </AlertDialogCancel>
          <AlertDialogAction onPress={() => respondToRequest(true)}>
            <Text>接受</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
