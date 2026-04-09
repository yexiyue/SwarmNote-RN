import "../global.css";

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { initI18n } from "@/i18n";
import { NAV_THEME } from "@/lib/theme";

initI18n();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider value={NAV_THEME[colorScheme === "dark" ? "dark" : "light"]}>
        <AnimatedSplashOverlay />
        <AppTabs />
        <PortalHost />
      </ThemeProvider>
    </I18nProvider>
  );
}
