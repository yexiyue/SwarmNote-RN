import { Trans, useLingui } from "@lingui/react/macro";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Platform, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExternalLink } from "@/components/external-link";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Collapsible } from "@/components/ui/collapsible";
import { WebBadge } from "@/components/web-badge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function TabTwoScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();
  const { t } = useLingui();

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
    >
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">
            <Trans>Explore</Trans>
          </ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            <Trans>This starter app includes example{"\n"}code to help you get started.</Trans>
          </ThemedText>

          <ExternalLink href="https://docs.expo.dev" asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.linkButton}>
                <ThemedText type="link">
                  <Trans>Expo documentation</Trans>
                </ThemedText>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: "arrow.up.right.square", android: "link", web: "link" }}
                  size={12}
                />
              </ThemedView>
            </Pressable>
          </ExternalLink>
        </ThemedView>

        <ThemedView style={styles.sectionsWrapper}>
          <Collapsible title={t`File-based routing`}>
            <ThemedText type="small">
              <Trans>
                This app has two screens: <ThemedText type="code">src/app/index.tsx</ThemedText> and{" "}
                <ThemedText type="code">src/app/explore.tsx</ThemedText>
              </Trans>
            </ThemedText>
            <ThemedText type="small">
              <Trans>
                The layout file in <ThemedText type="code">src/app/_layout.tsx</ThemedText> sets up
                the tab navigator.
              </Trans>
            </ThemedText>
            <ExternalLink href="https://docs.expo.dev/router/introduction">
              <ThemedText type="linkPrimary">
                <Trans>Learn more</Trans>
              </ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={t`Android, iOS, and web support`}>
            <ThemedView type="backgroundElement" style={styles.collapsibleContent}>
              <ThemedText type="small">
                <Trans>
                  You can open this project on Android, iOS, and the web. To open the web version,
                  press <ThemedText type="smallBold">w</ThemedText> in the terminal running this
                  project.
                </Trans>
              </ThemedText>
              <Image
                source={require("@/assets/images/tutorial-web.png")}
                style={styles.imageTutorial}
              />
            </ThemedView>
          </Collapsible>

          <Collapsible title={t`Images`}>
            <ThemedText type="small">
              <Trans>
                For static images, you can use the <ThemedText type="code">@2x</ThemedText> and{" "}
                <ThemedText type="code">@3x</ThemedText> suffixes to provide files for different
                screen densities.
              </Trans>
            </ThemedText>
            <Image source={require("@/assets/images/react-logo.png")} style={styles.imageReact} />
            <ExternalLink href="https://reactnative.dev/docs/images">
              <ThemedText type="linkPrimary">
                <Trans>Learn more</Trans>
              </ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={t`Light and dark mode components`}>
            <ThemedText type="small">
              <Trans>
                This template has light and dark mode support. The{" "}
                <ThemedText type="code">useColorScheme()</ThemedText> hook lets you inspect what the
                user&apos;s current color scheme is, and so you can adjust UI colors accordingly.
              </Trans>
            </ThemedText>
            <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
              <ThemedText type="linkPrimary">
                <Trans>Learn more</Trans>
              </ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={t`Animations`}>
            <ThemedText type="small">
              <Trans>
                This template includes an example of an animated component. The{" "}
                <ThemedText type="code">src/components/ui/collapsible.tsx</ThemedText> component
                uses the powerful <ThemedText type="code">react-native-reanimated</ThemedText>{" "}
                library to animate opening this hint.
              </Trans>
            </ThemedText>
          </Collapsible>
        </ThemedView>
        {Platform.OS === "web" && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: {
    gap: Spacing.three,
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    flexDirection: "row",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    justifyContent: "center",
    gap: Spacing.one,
    alignItems: "center",
  },
  sectionsWrapper: {
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  collapsibleContent: {
    alignItems: "center",
  },
  imageTutorial: {
    width: "100%",
    aspectRatio: 296 / 171,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  imageReact: {
    width: 100,
    height: 100,
    alignSelf: "center",
  },
});
