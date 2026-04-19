import { useRouter } from "expo-router";
import { EllipsisVertical, FolderPlus, PanelLeft, PencilLine, Plus } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, View } from "react-native";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomCommandBar } from "@/components/bottom-command-bar";
import { CommandSheet, type CommandSheetRef } from "@/components/command-sheet";
import { FilesPanel } from "@/components/files-panel";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useOptionalWorkspace } from "@/providers/workspace-provider";
import { useSwarmStore } from "@/stores/swarm-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function WorkspaceScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const workspace = useOptionalWorkspace();
  const workspaceInfo = useWorkspaceStore((s) => s.info);
  const keychainEphemeral = useSwarmStore((s) => s.keychainEphemeral);
  const commandSheetRef = useRef<CommandSheetRef>(null);
  const pagerRef = useRef<PagerView>(null);

  const openFiles = () => pagerRef.current?.setPage(0);
  const openWorkspace = () => pagerRef.current?.setPage(1);

  const handleNew = () => {
    // TODO P2: 弹出命名对话框 + workspace.createDocument()
    console.log("[workspace] new note tapped");
  };

  const openWorkspaceManager = () => router.push("/settings/workspaces" as never);
  const openWorkspaceCreate = () => router.push("/settings/workspaces/new" as never);

  if (workspace === null) {
    return (
      <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
        <View className="h-13 flex-row items-center justify-between px-4">
          <View className="w-5.5" />
          <Text className="text-[16px] font-semibold text-foreground">SwarmNote</Text>
          <View className="w-5.5" />
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-muted">
            <FolderPlus color={colors.mutedForeground} size={36} strokeWidth={1.5} />
          </View>
          <Text className="mt-5 text-[17px] font-semibold text-foreground">还没有工作区</Text>
          <Text className="mt-2 text-[13px] text-muted-foreground text-center">
            创建你的第一个工作区开始记录
          </Text>
          <Pressable
            onPress={openWorkspaceCreate}
            className="mt-6 h-10 flex-row items-center justify-center gap-1.5 rounded-lg bg-primary px-5"
            accessibilityLabel="创建工作区"
          >
            <Plus color={colors.background} size={16} />
            <Text className="text-[14px] font-semibold text-primary-foreground">创建工作区</Text>
          </Pressable>
        </View>

        {keychainEphemeral ? (
          <View className="mx-5 mb-5 rounded-lg bg-destructive/10 px-3 py-2">
            <Text className="text-[11px] text-destructive">
              密钥链不可用，当前身份为临时状态（下次启动将改变）
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <PagerView ref={pagerRef} style={{ flex: 1 }} initialPage={1} offscreenPageLimit={1} overdrag>
      <View key="files" collapsable={false} style={{ flex: 1 }}>
        <FilesPanel onClose={openWorkspace} />
      </View>

      <View key="workspace" collapsable={false} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
          <View className="h-13 flex-row items-center justify-between px-4">
            <Pressable onPress={openFiles} hitSlop={12} accessibilityLabel="打开文件面板">
              <PanelLeft color={colors.foreground} size={22} />
            </Pressable>
            <Text className="text-[16px] font-semibold text-foreground">
              {workspaceInfo?.name ?? "我的工作区"}
            </Text>
            <Pressable onPress={openWorkspaceManager} hitSlop={12} accessibilityLabel="管理工作区">
              <EllipsisVertical color={colors.foreground} size={22} />
            </Pressable>
          </View>

          {keychainEphemeral ? (
            <View className="mx-5 rounded-lg bg-destructive/10 px-3 py-2">
              <Text className="text-[11px] text-destructive">
                密钥链不可用，当前身份为临时状态（下次启动将改变）
              </Text>
            </View>
          ) : null}

          <View className="flex-1 items-center justify-center px-8">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-muted">
              <PencilLine color={colors.mutedForeground} size={36} strokeWidth={1.5} />
            </View>
            <Text className="mt-5 text-[17px] font-semibold text-foreground">还没有笔记</Text>
            <Text className="mt-2 text-[13px] text-muted-foreground text-center">
              创建第一篇笔记，开始记录你的想法
            </Text>
            <Pressable
              onPress={handleNew}
              className="mt-6 h-10 flex-row items-center justify-center gap-1.5 rounded-lg bg-primary px-5"
              accessibilityLabel="新建笔记"
            >
              <Plus color={colors.background} size={16} />
              <Text className="text-[14px] font-semibold text-primary-foreground">新建笔记</Text>
            </Pressable>
          </View>

          <BottomCommandBar
            onSearch={() => console.log("[workspace] search tapped")}
            onNew={handleNew}
            onMenu={() => commandSheetRef.current?.present()}
          />

          <CommandSheet
            ref={commandSheetRef}
            onQuickSwitch={openFiles}
            onNewFolder={() => console.log("[workspace] new folder")}
            onOpenSettings={() => router.push("/settings" as never)}
            onOpenAbout={() => router.push("/settings/about" as never)}
          />
        </SafeAreaView>
      </View>
    </PagerView>
  );
}
