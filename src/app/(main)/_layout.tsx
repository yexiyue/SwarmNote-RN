import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { UniffiWorkspaceCoreLike } from "react-native-swarmnote-core";
import { NetworkLifecycleMounter } from "@/components/network-lifecycle-mounter";
import { openLastOrDefault } from "@/core/workspace-manager";
import { WorkspaceProvider } from "@/providers/workspace-provider";

/** Three-state resolution:
 *  - `undefined`: boot probe still in flight, render spinner
 *  - `null`: resolved, no workspace exists yet → redirect to `/workspaces`
 *    so the user lands on the manager page (not a leaf-level empty state)
 *  - value: workspace handle ready */
type WorkspaceResolution = UniffiWorkspaceCoreLike | null | undefined;

export default function MainLayout() {
  const [workspace, setWorkspace] = useState<WorkspaceResolution>(undefined);

  useEffect(() => {
    let cancelled = false;
    openLastOrDefault()
      .then((ws) => {
        if (!cancelled) setWorkspace(ws);
      })
      .catch((err: unknown) => {
        console.warn("[main] openLastOrDefault failed:", err);
        if (!cancelled) setWorkspace(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (workspace === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (workspace === null) {
    return <Redirect href={"/workspaces" as never} />;
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
