import { Trans } from "@lingui/react/macro";
import { useShallow } from "zustand/react/shallow";
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
import { useUpdateStore } from "@/stores/update-store";

/**
 * Surface install/download errors that previously dropped silently.
 * - "关闭"   → acknowledgeError() flips status back to "available" so the
 *               original prompt can come up again
 * - "重试"   → acknowledgeError() then immediately re-runs executeUpdate()
 *               so the user doesn't have to walk through the optional
 *               update prompt a second time
 */
export function UpdateErrorDialog() {
  const { status, error, acknowledgeError, executeUpdate } = useUpdateStore(
    useShallow((s) => ({
      status: s.status,
      error: s.error,
      acknowledgeError: s.acknowledgeError,
      executeUpdate: s.executeUpdate,
    })),
  );

  const open = status === "error";

  const handleRetry = () => {
    acknowledgeError();
    void executeUpdate();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>更新失败</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            {error ?? <Trans>下载或安装过程中出错，请稍后重试。</Trans>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={acknowledgeError}>
            <Text>
              <Trans>关闭</Trans>
            </Text>
          </AlertDialogCancel>
          <AlertDialogAction onPress={handleRetry}>
            <Text>
              <Trans>重试</Trans>
            </Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
