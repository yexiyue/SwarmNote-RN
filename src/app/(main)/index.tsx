import { Trans, useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { EllipsisVertical, PanelLeft, PencilLine, Plus } from "lucide-react-native";
import { useCallback, useRef } from "react";
import { Pressable, View } from "react-native";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomCommandBar } from "@/components/bottom-command-bar";
import { CommandSheet, type CommandSheetRef } from "@/components/command-sheet";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { FilesPanel } from "@/components/files-panel";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useWorkspace } from "@/providers/workspace-provider";
import { useCurrentDocStore } from "@/stores/current-doc-store";
import { useFilesUiStore } from "@/stores/files-ui-store";
import { useSwarmStore } from "@/stores/swarm-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function WorkspaceScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useLingui();
  const workspace = useWorkspace();
  const workspaceInfo = useWorkspaceStore((s) => s.info);
  const keychainEphemeral = useSwarmStore((s) => s.keychainEphemeral);
  const currentDocUuid = useCurrentDocStore((s) => s.docUuid);
  const currentRelPath = useCurrentDocStore((s) => s.relPath);
  const currentInitialState = useCurrentDocStore((s) => s.initialState);
  const commandSheetRef = useRef<CommandSheetRef>(null);
  const pagerRef = useRef<PagerView>(null);

  const openFiles = useCallback(() => pagerRef.current?.setPage(0), []);
  const openWorkspace = useCallback(() => pagerRef.current?.setPage(1), []);

  const handleNewFromBottomBar = useCallback(() => {
    useFilesUiStore.getState().startDraft({ kind: "document", parentRelPath: null });
    openFiles();
  }, [openFiles]);

  const handleNewFolderFromSheet = useCallback(() => {
    useFilesUiStore.getState().startDraft({ kind: "folder", parentRelPath: null });
    openFiles();
  }, [openFiles]);

  const openWorkspaceManager = () => router.push("/workspaces" as never);

  const onCollabUpdate = useCallback(
    (update: Uint8Array) => {
      if (currentDocUuid === null) return;
      // FFI wrapper wants `ArrayBuffer`; slice a fresh one covering exactly
      // the update — `Uint8Array.buffer` may be wider than the view.
      const buf = update.buffer.slice(update.byteOffset, update.byteOffset + update.byteLength);
      workspace.applyUpdate(currentDocUuid, buf as ArrayBuffer).catch((err: unknown) => {
        console.warn("[editor-host] applyUpdate failed:", err);
      });
    },
    [currentDocUuid, workspace],
  );

  const headerTitle =
    currentRelPath !== null ? basename(currentRelPath) : (workspaceInfo?.name ?? t`我的工作区`);

  return (
    <PagerView ref={pagerRef} style={{ flex: 1 }} initialPage={1} offscreenPageLimit={1} overdrag>
      <View key="files" collapsable={false} style={{ flex: 1 }}>
        <FilesPanel onClose={openWorkspace} />
      </View>

      <View key="workspace" collapsable={false} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top"]}>
          <View className="h-13 flex-row items-center justify-between px-4">
            <Pressable onPress={openFiles} hitSlop={12} accessibilityLabel={t`打开文件面板`}>
              <PanelLeft color={colors.foreground} size={22} />
            </Pressable>
            <Text
              className="text-[16px] font-semibold text-foreground flex-1 text-center px-2"
              numberOfLines={1}
            >
              {headerTitle}
            </Text>
            <Pressable
              onPress={openWorkspaceManager}
              hitSlop={12}
              accessibilityLabel={t`管理工作区`}
            >
              <EllipsisVertical color={colors.foreground} size={22} />
            </Pressable>
          </View>

          {keychainEphemeral ? (
            <View className="mx-5 rounded-lg bg-destructive/10 px-3 py-2">
              <Text className="text-[11px] text-destructive">
                <Trans>密钥链不可用，当前身份为临时状态（下次启动将改变）</Trans>
              </Text>
            </View>
          ) : null}

          {currentDocUuid !== null && currentInitialState !== null ? (
            <MarkdownEditor
              key={currentDocUuid}
              docUuid={currentDocUuid}
              initialState={currentInitialState}
              onCollabUpdate={onCollabUpdate}
            />
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <View className="h-20 w-20 items-center justify-center rounded-full bg-muted">
                <PencilLine color={colors.mutedForeground} size={36} strokeWidth={1.5} />
              </View>
              <Text className="mt-5 text-[17px] font-semibold text-foreground">
                <Trans>还没有打开的笔记</Trans>
              </Text>
              <Text className="mt-2 text-[13px] text-muted-foreground text-center">
                <Trans>在左侧文件面板中选择一篇笔记，或新建一篇</Trans>
              </Text>
              <Pressable
                onPress={handleNewFromBottomBar}
                className="mt-6 h-10 flex-row items-center justify-center gap-1.5 rounded-lg bg-primary px-5"
                accessibilityLabel={t`新建笔记`}
              >
                <Plus color={colors.background} size={16} />
                <Text className="text-[14px] font-semibold text-primary-foreground">
                  <Trans>新建笔记</Trans>
                </Text>
              </Pressable>
            </View>
          )}

          <BottomCommandBar
            onSearch={() => console.log("[workspace] search tapped")}
            onNew={handleNewFromBottomBar}
            onMenu={() => commandSheetRef.current?.present()}
          />

          <CommandSheet
            ref={commandSheetRef}
            onQuickSwitch={openFiles}
            onNewFolder={handleNewFolderFromSheet}
            onOpenSettings={() => router.push("/settings" as never)}
            onOpenAbout={() => router.push("/settings/about" as never)}
          />
        </SafeAreaView>
      </View>
    </PagerView>
  );
}

function basename(relPath: string): string {
  const withoutSlash = relPath.endsWith("/") ? relPath.slice(0, -1) : relPath;
  const idx = withoutSlash.lastIndexOf("/");
  const last = idx === -1 ? withoutSlash : withoutSlash.slice(idx + 1);
  return last.endsWith(".md") ? last.slice(0, -3) : last;
}
