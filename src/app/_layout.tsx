import "../global.css";

import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AppTabs from "@/components/app-tabs";
import { useNavTheme } from "@/hooks/useThemeColors";
import { restoreThemePreference } from "@/lib/theme-persistence";

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const navTheme = useNavTheme();
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    restoreThemePreference().then(() => {
      setThemeLoaded(true);
      SplashScreen.hideAsync();
    });
  }, []);

  if (!themeLoaded) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppTabs />
      <PortalHost />
    </ThemeProvider>
  );
}
