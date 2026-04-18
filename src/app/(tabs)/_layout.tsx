import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Hexagon, House, type LucideIcon, Settings } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiWorkspaceCoreLike } from "react-native-swarmnote-core";
import { NetworkLifecycleMounter } from "@/components/network-lifecycle-mounter";
import { Text } from "@/components/ui/text";
import { openDefaultWorkspace } from "@/core/workspace-manager";
import { useThemeColors } from "@/hooks/useThemeColors";
import { WorkspaceProvider } from "@/providers/workspace-provider";

const TAB_ITEMS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: "index", label: "主页", icon: House },
  { name: "swarm", label: "Swarm", icon: Hexagon },
  { name: "settings", label: "设置", icon: Settings },
];

export default function TabsLayout() {
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
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="swarm" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </WorkspaceProvider>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();

  return (
    <SafeAreaView edges={["bottom"]} className="border-t border-border bg-muted">
      <View className="h-15.5 flex-row">
        {state.routes.map((route, index) => {
          const item = TAB_ITEMS.find((t) => t.name === route.name);
          if (!item) return null;

          const isFocused = state.index === index;
          const Icon = item.icon;
          const tint = isFocused ? colors.primary : colors.mutedForeground;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={item.label}
              className="flex-1 items-center justify-center gap-1"
            >
              <Icon color={tint} size={24} strokeWidth={isFocused ? 2.25 : 1.75} />
              <Text
                style={{ color: tint }}
                className={`text-[11px] ${isFocused ? "font-semibold" : "font-medium"}`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
