import "../global.css";

import { ThemeProvider } from "@react-navigation/native";
import React from "react";
import { useColorScheme } from "react-native";
import { PortalHost } from "@rn-primitives/portal";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { NAV_THEME } from "@/lib/theme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={NAV_THEME[colorScheme === "dark" ? "dark" : "light"]}>
      <AnimatedSplashOverlay />
      <AppTabs />
      <PortalHost />
    </ThemeProvider>
  );
}
