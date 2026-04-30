import { Trans } from "@lingui/react/macro";
import { View } from "react-native";
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
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { useUpdateStore } from "@/stores/update-store";

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/**
 * Foreground progress dialog while the APK is downloading. The user can hit
 * "后台下载" to flip `backgrounded`, which hides this dialog and lets
 * `UpdateBackgroundTracker` take over with a sonner toast. Download itself
 * keeps running — `installer.ts` doesn't accept an abort signal yet, so we
 * don't expose a cancel action either.
 */
export function UpdateProgressDialog() {
  const { status, progress, backgrounded, backgroundDownload } = useUpdateStore(
    useShallow((s) => ({
      status: s.status,
      progress: s.progress,
      backgrounded: s.backgrounded,
      backgroundDownload: s.backgroundDownload,
    })),
  );

  const open = status === "downloading" && !backgrounded;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>正在下载新版本</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>下载完成后系统会引导你完成安装</Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <View className="gap-2">
          <Progress value={progress?.percent ?? 0} />
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground text-xs">{progress?.percent ?? 0}%</Text>
            <Text className="text-muted-foreground text-xs">
              {formatMB(progress?.downloaded ?? 0)} / {formatMB(progress?.total ?? 0)} MB
            </Text>
          </View>
        </View>
        <AlertDialogFooter>
          <AlertDialogAction onPress={backgroundDownload}>
            <Text>
              <Trans>后台下载</Trans>
            </Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
