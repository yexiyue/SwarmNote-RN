import { Trans, useLingui } from "@lingui/react/macro";
import { useShallow } from "zustand/react/shallow";
import { AlertDialog, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { useUpdateStore } from "@/stores/update-store";
import { UpdateDialogContent } from "./update-dialog-content";

export function UpdateDialog() {
  const { t } = useLingui();
  const { status, latestVersion, currentVersion, releaseNotes, dismiss, executeUpdate } =
    useUpdateStore(
      useShallow((s) => ({
        status: s.status,
        latestVersion: s.latestVersion,
        currentVersion: s.currentVersion,
        releaseNotes: s.releaseNotes,
        dismiss: s.dismiss,
        executeUpdate: s.executeUpdate,
      })),
    );

  const open = status === "available";
  const latest = latestVersion ?? "";
  const current = currentVersion ?? "";

  return (
    <AlertDialog open={open}>
      <UpdateDialogContent
        title={<Trans>发现新版本</Trans>}
        versionLine={t`v${latest} · 当前 v${current}`}
        releaseNotes={releaseNotes}
        latestVersion={latestVersion}
        footer={
          <>
            <AlertDialogCancel onPress={() => void dismiss()}>
              <Text>
                <Trans>稍后</Trans>
              </Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => void executeUpdate()}>
              <Text>
                <Trans>立即更新</Trans>
              </Text>
            </AlertDialogAction>
          </>
        }
      />
    </AlertDialog>
  );
}
