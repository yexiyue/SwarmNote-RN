import { Trans, useLingui } from "@lingui/react/macro";
import { ExternalLink } from "lucide-react-native";
import type { ReactNode } from "react";
import { Linking, Pressable, ScrollView } from "react-native";
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { toast } from "@/lib/toast";

const REPO_RELEASES_URL = "https://github.com/yexiyue/SwarmNote-RN/releases";
const NOTES_MAX_HEIGHT = 220;

interface UpdateDialogContentProps {
  title: ReactNode;
  /** Short summary like "v0.3.0 · 当前 v0.2.0". Rendered above the notes scroll. */
  versionLine: string;
  releaseNotes: string | null;
  /** Pinned to a specific tag when available so users see the exact diff. */
  latestVersion: string | null;
  footer: ReactNode;
}

/** Shared body for UpdateDialog / ForceUpdateDialog. Renders header + version
 *  line + scrollable plain-text notes (or a fallback "open release page" link
 *  when `releaseNotes` is empty) + footer slot. */
export function UpdateDialogContent({
  title,
  versionLine,
  releaseNotes,
  latestVersion,
  footer,
}: UpdateDialogContentProps) {
  const colors = useThemeColors();
  const { t } = useLingui();

  const openReleasePage = () => {
    const target = latestVersion ? `${REPO_RELEASES_URL}/tag/v${latestVersion}` : REPO_RELEASES_URL;
    Linking.openURL(target).catch((err: unknown) => toast.error(t`无法打开链接`, err));
  };

  const trimmedNotes = releaseNotes?.trim() ?? "";
  const hasNotes = trimmedNotes.length > 0;

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{versionLine}</AlertDialogDescription>
      </AlertDialogHeader>

      {hasNotes ? (
        <ScrollView
          style={{ maxHeight: NOTES_MAX_HEIGHT }}
          contentContainerClassName="pr-1"
          showsVerticalScrollIndicator
        >
          <Text className="text-foreground text-sm leading-5">{trimmedNotes}</Text>
        </ScrollView>
      ) : (
        <Pressable onPress={openReleasePage} className="flex-row items-center gap-1">
          <Text className="text-primary text-sm underline">
            <Trans>查看更新内容</Trans>
          </Text>
          <ExternalLink color={colors.primary} size={14} />
        </Pressable>
      )}

      <AlertDialogFooter>{footer}</AlertDialogFooter>
    </AlertDialogContent>
  );
}
