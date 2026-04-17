import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { UniffiWorkspaceCoreLike } from "react-native-swarmnote-core";
import { NetworkLifecycleMounter } from "@/components/network-lifecycle-mounter";
import { openDefaultWorkspace } from "@/core/workspace-manager";
import { useThemeColors } from "@/hooks/useThemeColors";
import { WorkspaceProvider } from "@/providers/workspace-provider";

export default function TabsLayout() {
  const colors = useThemeColors();
  const [workspace, setWorkspace] = useState<UniffiWorkspaceCoreLike | null>(null);

  useEffect(() => {
    let cancelled = false;
    openDefaultWorkspace()
      .then((ws) => {
        if (!cancelled) setWorkspace(ws);
      })
      .catch((err: unknown) => {
        console.warn("[tabs] openDefaultWorkspace failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (workspace === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <WorkspaceProvider workspace={workspace}>
      <NetworkLifecycleMounter />
      <NativeTabs
        backgroundColor={colors.background}
        indicatorColor={colors.primary}
        labelStyle={{ selected: { color: colors.foreground } }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require("@/assets/images/tabIcons/home.png")}
            renderingMode="template"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="swarm">
          <NativeTabs.Trigger.Label>Swarm</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require("@/assets/images/tabIcons/explore.png")}
            renderingMode="template"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require("@/assets/images/tabIcons/explore.png")}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </WorkspaceProvider>
  );
}
