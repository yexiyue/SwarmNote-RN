import { Trans } from "@lingui/react/macro";
import { View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
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
 * Non-cancellable progress dialog while the APK is being downloaded. Once the
 * download finishes, status flips to "ready" and the system PackageInstaller
 * takes over — at which point this dialog naturally unmounts.
 */
export function UpdateProgressDialog() {
  const { status, progress } = useUpdateStore(
    useShallow((s) => ({ status: s.status, progress: s.progress })),
  );

  const open = status === "downloading";

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
      </AlertDialogContent>
    </AlertDialog>
  );
}
