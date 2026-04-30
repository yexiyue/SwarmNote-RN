import { Trans, useLingui } from "@lingui/react/macro";
import { ExternalLink } from "lucide-react-native";
import { Linking, Pressable } from "react-native";
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
import { useThemeColors } from "@/hooks/useThemeColors";
import { toast } from "@/lib/toast";
import { useUpdateStore } from "@/stores/update-store";

const REPO_RELEASES_URL = "https://github.com/yexiyue/SwarmNote-RN/releases";

export function UpdateDialog() {
  const colors = useThemeColors();
  const { t } = useLingui();
  const { status, latestVersion, currentVersion, dismiss, executeUpdate } = useUpdateStore(
    useShallow((s) => ({
      status: s.status,
      latestVersion: s.latestVersion,
      currentVersion: s.currentVersion,
      dismiss: s.dismiss,
      executeUpdate: s.executeUpdate,
    })),
  );

  const open = status === "available";
  const latest = latestVersion ?? "";
  const current = currentVersion ?? "";

  const openReleaseNotes = () => {
    const target = latestVersion ? `${REPO_RELEASES_URL}/tag/v${latestVersion}` : REPO_RELEASES_URL;
    Linking.openURL(target).catch((err: unknown) => toast.error(t`无法打开链接`, err));
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>发现新版本</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              新版本 v{latest} 可用,当前 v{current}
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
