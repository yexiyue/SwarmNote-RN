import { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiDocument } from "react-native-swarmnote-core";
import { Text } from "@/components/ui/text";
import { useWorkspace } from "@/providers/workspace-provider";
import { useSwarmStore } from "@/stores/swarm-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function Home() {
  const workspace = useWorkspace();
  const workspaceInfo = useWorkspaceStore((s) => s.info);
  const keychainEphemeral = useSwarmStore((s) => s.keychainEphemeral);
  const hydrateProgress = useSwarmStore((s) => s.hydrateProgress);
  const [docs, setDocs] = useState<UniffiDocument[]>([]);

  const load = useCallback(async () => {
    try {
      const list = await workspace.listDocuments();
      setDocs(list);
    } catch (err) {
      console.warn("[home] listDocuments failed:", err);
    }
  }, [workspace]);

  useEffect(() => {
    void load();
  }, [load]);

  const hydrating = workspaceInfo ? hydrateProgress[workspaceInfo.id] : undefined;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
      {keychainEphemeral ? (
        <View className="bg-destructive/10 px-4 py-2">
          <Text className="text-xs text-destructive">
            密钥链不可用，当前身份为临时状态（下次启动将改变）
          </Text>
        </View>
      ) : null}
      {hydrating && hydrating.total > 0 ? (
        <View className="bg-muted px-4 py-2">
          <Text className="text-xs text-muted-foreground">
            正在同步文档 {hydrating.current}/{hydrating.total}
          </Text>
        </View>
      ) : null}
      <View className="px-4 py-3 border-b border-border">
        <Text className="text-xl font-bold text-foreground">
          {workspaceInfo?.name ?? "Workspace"}
        </Text>
      </View>
      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        ListEmptyComponent={
          <View className="p-6">
            <Text className="text-sm text-muted-foreground text-center">
              还没有笔记 — 点右下角的 + 新建
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-4 py-3 border-b border-border">
            <Text className="text-base text-foreground" numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {item.relPath}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
