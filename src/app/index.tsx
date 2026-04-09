import { Trans, useLingui } from "@lingui/react/macro";
import * as Device from "expo-device";
import { Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedIcon } from "@/components/animated-icon";
import { HintRow } from "@/components/hint-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WebBadge } from "@/components/web-badge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";

function getDevMenuHint() {
  if (Platform.OS === "web") {
    return (
      <ThemedText type="small">
        <Trans>use browser devtools</Trans>
      </ThemedText>
    );
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        <Trans>
          shake device or press <ThemedText type="code">m</ThemedText> in terminal
        </Trans>
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === "android" ? "cmd+m (or ctrl+m)" : "cmd+d";
  return (
    <ThemedText type="small">
      <Trans>
        press <ThemedText type="code">{shortcut}</ThemedText>
      </Trans>
    </ThemedText>
  );
}

export default function HomeScreen() {
  const { t } = useLingui();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            <Trans>Welcome to&nbsp;Expo</Trans>
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          <Trans>get started</Trans>
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title={t`Try editing`}
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title={t`Dev tools`} hint={getDevMenuHint()} />
          <HintRow
            title={t`Fresh start`}
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === "web" && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  code: {
    textTransform: "uppercase",
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
