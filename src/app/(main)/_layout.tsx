import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { UniffiWorkspaceCoreLike } from "react-native-swarmnote-core";
import { NetworkLifecycleMounter } from "@/components/network-lifecycle-mounter";
import { openDefaultWorkspace } from "@/core/workspace-manager";
import { WorkspaceProvider } from "@/providers/workspace-provider";

export default function MainLayout() {
  const [workspace, setWorkspace] = useState<UniffiWorkspaceCoreLike | null>(null);

  useEffect(() => {
    let cancelled = false;
    openDefaultWorkspace()
      .then((ws) => {
        if (!cancelled) setWorkspace(ws);
      })
      .catch((err: unknown) => {
        console.warn("[main] openDefaultWorkspace failed:", err);
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </WorkspaceProvider>
  );
}
