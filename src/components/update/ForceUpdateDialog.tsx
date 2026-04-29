import { Trans } from "@lingui/react/macro";
import { ExternalLink } from "lucide-react-native";
import { Linking, Pressable } from "react-native";
import { useShallow } from "zustand/react/shallow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useUpdateStore } from "@/stores/update-store";

const REPO_RELEASES_URL = "https://github.com/yexiyue/SwarmNote-RN/releases";

/**
 * Force-update dialog. Has no cancel button — the user can only update or
 * back out to the home screen via the OS. This mirrors the contract of
 * `upgradeType=2` from UpgradeLink.
 */
export function ForceUpdateDialog() {
  const colors = useThemeColors();
  const { status, latestVersion, currentVersion, executeUpdate } = useUpdateStore(
    useShallow((s) => ({
      status: s.status,
      latestVersion: s.latestVersion,
      currentVersion: s.currentVersion,
      executeUpdate: s.executeUpdate,
    })),
  );

  const open = status === "force-required";
  const latest = latestVersion ?? "";
  const current = currentVersion ?? "";

  const openReleaseNotes = () => {
    const target = latestVersion ? `${REPO_RELEASES_URL}/tag/v${latestVersion}` : REPO_RELEASES_URL;
    Linking.openURL(target).catch(() => {});
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>必须更新</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              当前版本 v{current} 已不再受支持,请升级到 v{latest} 才能继续使用。
            </Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Pressable onPress={openReleaseNotes} className="flex-row items-center gap-1">
          <Text className="text-primary text-sm underline">
            <Trans>查看更新内容</Trans>
          </Text>
          <ExternalLink color={colors.primary} size={14} />
        </Pressable>
        <AlertDialogFooter>
          <AlertDialogAction onPress={() => void executeUpdate()}>
            <Text>
              <Trans>立即更新</Trans>
            </Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
