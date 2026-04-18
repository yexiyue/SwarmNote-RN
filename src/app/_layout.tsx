import "../global.css";

import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PairingRequestHost } from "@/components/pairing-request-host";
import { initAppCore } from "@/core/app-core";
import { useNavTheme } from "@/hooks/useThemeColors";
import { restoreThemePreference } from "@/lib/theme-persistence";
import { waitForOnboardingHydration } from "@/stores/onboarding-store";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const navTheme = useNavTheme();
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([restoreThemePreference(), waitForOnboardingHydration(), initAppCore()]);
      } catch (err) {
        console.error("[boot] initAppCore failed:", err);
        setBootError(String(err));
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  if (!ready) return null;

  if (bootError !== null) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pairing/input-code" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="pairing/found-device" options={{ animation: "slide_from_right" }} />
          <Stack.Screen
            name="pairing/success"
            options={{ animation: "slide_from_right", gestureEnabled: false }}
          />
          <Stack.Screen name="editor-test" />
          <Stack.Screen name="explore" />
        </Stack>
        <PairingRequestHost />
        <PortalHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
