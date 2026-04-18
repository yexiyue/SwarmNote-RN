import { ChevronRight, FolderOpen, Globe, Palette, Ruler } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingDivider, SettingRow, SettingSection } from "@/components/setting-row";
import { SettingsHeader } from "@/components/settings-header";
import { ThemePickerSheet, type ThemePickerSheetRef } from "@/components/theme-picker-sheet";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  getThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme-persistence";

const THEME_LABEL: Record<ThemePreference, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
};

export default function GeneralSettings() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const themeSheetRef = useRef<ThemePickerSheetRef>(null);
  const [readableWidth, setReadableWidth] = useState(true);
  const [restoreWorkspace, setRestoreWorkspace] = useState(true);

  useEffect(() => {
    getThemePreference()
      .then(setTheme)
      .catch(() => {});
  }, []);

  const onPickTheme = async (next: ThemePreference) => {
    setTheme(next);
    try {
      await saveThemePreference(next);
    } catch (err) {
      console.warn("[general] saveThemePreference failed:", err);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
      <SettingsHeader title="通用" />

      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <SettingSection label="外观">
          <SettingRow icon={Globe} label="语言" description="选择界面显示语言">
            <SelectValue value="中文" />
          </SettingRow>
          <SettingDivider />
          <SettingRow
            icon={Palette}
            label="外观"
            description="选择明亮或暗色主题"
            onPress={() => themeSheetRef.current?.present()}
          >
            <SelectValue value={THEME_LABEL[theme]} />
          </SettingRow>
          <SettingDivider />
          <SettingRow icon={Ruler} label="可读行宽" description="限制编辑器内容宽度以提升阅读体验">
            <Switch checked={readableWidth} onCheckedChange={setReadableWidth} />
          </SettingRow>
        </SettingSection>

        <SettingSection label="启动行为">
          <SettingRow
            icon={FolderOpen}
            label="恢复上次工作区"
            description="启动时自动打开上次使用的工作区"
          >
            <Switch checked={restoreWorkspace} onCheckedChange={setRestoreWorkspace} />
          </SettingRow>
        </SettingSection>
      </ScrollView>

      <ThemePickerSheet ref={themeSheetRef} current={theme} onSelect={onPickTheme} />
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
