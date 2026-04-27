import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, FolderOpen, Globe, Palette, Ruler } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingDivider, SettingRow, SettingSection } from "@/components/setting-row";
import { SettingsHeader } from "@/components/settings-header";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  getStoredLanguagePreference,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n/languageDetector";
import { getThemePreference, type ThemePreference } from "@/lib/theme-persistence";

const THEME_LABEL: Record<ThemePreference, ReturnType<typeof msg>> = {
  light: msg`浅色`,
  dark: msg`深色`,
  system: msg`跟随系统`,
};

export default function GeneralSettings() {
  const router = useRouter();
  const { t, i18n } = useLingui();
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [storedLang, setStoredLang] = useState<SupportedLanguage | null>(null);
  const [readableWidth, setReadableWidth] = useState(true);
  const [restoreWorkspace, setRestoreWorkspace] = useState(true);

  // Re-read on focus so coming back from /settings/{theme,language}
  // refreshes the displayed value rows.
  useFocusEffect(
    useCallback(() => {
      Promise.all([getThemePreference(), getStoredLanguagePreference()])
        .then(([t, lang]) => {
          setTheme(t);
          setStoredLang(lang);
        })
        .catch(() => {});
    }, []),
  );

  const languageValue =
    storedLang === null ? t`跟随系统` : SUPPORTED_LANGUAGES[storedLang].nativeName;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <SettingsHeader title={t`通用`} />

      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <SettingSection label={t`外观`}>
          <SettingRow
            icon={Globe}
            label={t`语言`}
            description={t`选择界面显示语言`}
            onPress={() => router.push("/settings/language" as never)}
          >
            <SelectValue value={languageValue} />
          </SettingRow>
          <SettingDivider />
          <SettingRow
            icon={Palette}
            label={t`外观`}
            description={t`选择明亮或暗色主题`}
            onPress={() => router.push("/settings/theme" as never)}
          >
            <SelectValue value={i18n._(THEME_LABEL[theme])} />
          </SettingRow>
          <SettingDivider />
          <SettingRow
            icon={Ruler}
            label={t`可读行宽`}
            description={t`限制编辑器内容宽度以提升阅读体验`}
          >
            <Switch checked={readableWidth} onCheckedChange={setReadableWidth} />
          </SettingRow>
        </SettingSection>

        <SettingSection label={t`启动行为`}>
          <SettingRow
            icon={FolderOpen}
            label={t`恢复上次工作区`}
            description={t`启动时自动打开上次使用的工作区`}
          >
            <Switch checked={restoreWorkspace} onCheckedChange={setRestoreWorkspace} />
          </SettingRow>
        </SettingSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function SelectValue({ value }: { value: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-[13px] text-muted-foreground">{value}</Text>
      <ChevronRight color={colors.mutedForeground} size={14} />
    </View>
  );
}
