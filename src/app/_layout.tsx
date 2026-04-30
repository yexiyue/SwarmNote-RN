import "../global.css";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NotifierRoot } from "react-native-notifier";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorDialogHost } from "@/components/error-dialog-host";
import { PairingRequestHost } from "@/components/pairing-request-host";
import { UpdateHost } from "@/components/update/UpdateHost";
import { initAppCore } from "@/core/app-core";
import { useNavTheme } from "@/hooks/useThemeColors";
import { LinguiProvider } from "@/i18n/LinguiProvider";
import { initI18n } from "@/i18n/lingui";
import { restoreThemePreference } from "@/lib/theme-persistence";
import { waitForOnboardingHydration } from "@/stores/onboarding-store";
import { useUpdateStore } from "@/stores/update-store";

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
        await Promise.all([
          restoreThemePreference(),
          waitForOnboardingHydration(),
          initAppCore(),
          initI18n(),
        ]);
      } catch (err) {
        console.error("[boot] initAppCore failed:", err);
        setBootError(String(err));
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready || Platform.OS !== "android") return;
    const timer = setTimeout(() => {
      void useUpdateStore.getState().checkForUpdate();
    }, 2000);
    const unsubscribe = useUpdateStore.getState().setupAppStateListener();
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [ready]);

  if (!ready) return null;

  if (bootError !== null) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <LinguiProvider>
            <BottomSheetModalProvider>
              <StatusBar style={isDark ? "light" : "dark"} />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(main)" />
                <Stack.Screen name="workspaces" options={{ animation: "slide_from_right" }} />
                <Stack.Screen
                  name="settings"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="pairing/input-code"
                  options={{ animation: "slide_from_right" }}
                />
                <Stack.Screen
                  name="pairing/found-device"
                  options={{ animation: "slide_from_right" }}
                />
                <Stack.Screen
                  name="pairing/success"
                  options={{ animation: "slide_from_right", gestureEnabled: false }}
                />
                <Stack.Screen name="editor-test" />
                <Stack.Screen name="explore" />
              </Stack>
              <PairingRequestHost />
              <ErrorDialogHost />
              <UpdateHost />
              <PortalHost />
            </BottomSheetModalProvider>
          </LinguiProvider>
        </ThemeProvider>
        {/* NotifierRoot must be the last sibling under SafeAreaProvider so
            it draws above every other tree. `useRNScreensOverlay` is the
            iOS-only escape hatch that paints the toast inside react-native-
            screens' FullWindowOverlay, putting it above native-stack modals
            and RN Modal. */}
        <NotifierRoot useRNScreensOverlay />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
