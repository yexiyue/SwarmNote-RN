import { Trans, useLingui } from "@lingui/react/macro";
import { ExternalLink } from "lucide-react-native";
import type { ReactNode } from "react";
import { Linking, Pressable, ScrollView } from "react-native";
import Markdown from "react-native-markdown-display";
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
 *  line + scrollable markdown notes (or a fallback "open release page" link
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
          <Markdown style={markdownStyles(colors)}>{trimmedNotes}</Markdown>
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

type ThemeColors = ReturnType<typeof useThemeColors>;

/** Style sheet for react-native-markdown-display tuned to NativeWind theme
 *  tokens. We can't use className here because the lib styles via inline
 *  StyleSheet objects, so we read CSS variables once via useThemeColors. */
function markdownStyles(colors: ThemeColors) {
  return {
    body: { color: colors.foreground, fontSize: 13, lineHeight: 20 },
    heading1: { color: colors.foreground, fontSize: 16, fontWeight: "600", marginTop: 4 },
    heading2: { color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 4 },
    heading3: { color: colors.foreground, fontSize: 14, fontWeight: "600", marginTop: 4 },
    paragraph: { marginTop: 0, marginBottom: 6 },
    bullet_list: { marginBottom: 4 },
    ordered_list: { marginBottom: 4 },
    list_item: { color: colors.foreground, marginBottom: 2 },
    code_inline: {
      backgroundColor: colors.card,
      color: colors.foreground,
      paddingHorizontal: 4,
      borderRadius: 3,
      fontSize: 12,
    },
    code_block: {
      backgroundColor: colors.card,
      color: colors.foreground,
      padding: 8,
      borderRadius: 6,
      fontSize: 12,
    },
    link: { color: colors.primary, textDecorationLine: "underline" },
    strong: { fontWeight: "600" },
    em: { fontStyle: "italic" },
    blockquote: {
      backgroundColor: colors.card,
      borderLeftColor: colors.border,
      borderLeftWidth: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginVertical: 4,
    },
    hr: { backgroundColor: colors.border, height: 1, marginVertical: 8 },
  } as const;
}
