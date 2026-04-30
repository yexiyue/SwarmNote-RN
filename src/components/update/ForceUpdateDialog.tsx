import { Trans, useLingui } from "@lingui/react/macro";
import { useShallow } from "zustand/react/shallow";
import { AlertDialog, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { useUpdateStore } from "@/stores/update-store";
import { UpdateDialogContent } from "./update-dialog-content";

/**
 * Force-update dialog. No cancel button — the user can only update or back
 * out of the app via the OS. This mirrors the contract of `upgradeType=2`
 * from UpgradeLink.
 */
export function ForceUpdateDialog() {
  const { t } = useLingui();
  const { status, latestVersion, currentVersion, releaseNotes, executeUpdate } = useUpdateStore(
    useShallow((s) => ({
      status: s.status,
      latestVersion: s.latestVersion,
      currentVersion: s.currentVersion,
      releaseNotes: s.releaseNotes,
      executeUpdate: s.executeUpdate,
    })),
  );

  const open = status === "force-required";
  const latest = latestVersion ?? "";
  const current = currentVersion ?? "";

  return (
    <AlertDialog open={open}>
      <UpdateDialogContent
        title={<Trans>必须更新</Trans>}
        versionLine={t`当前 v${current} 已不再支持，请升级到 v${latest}`}
        releaseNotes={releaseNotes}
        latestVersion={latestVersion}
        footer={
          <AlertDialogAction onPress={() => void executeUpdate()}>
            <Text>
              <Trans>立即更新</Trans>
            </Text>
          </AlertDialogAction>
        }
      />
    </AlertDialog>
  );
}
