import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  Folder,
  type LucideIcon,
  Settings,
} from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiFileTreeNode } from "react-native-swarmnote-core";
import { InlineNameInput } from "@/components/files/InlineNameInput";
import { FilesToolbar } from "@/components/files-toolbar";
import { Text } from "@/components/ui/text";
import { createFolderAt, createNoteAt } from "@/core/files-actions";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useCurrentDocStore } from "@/stores/current-doc-store";
import { useFileTreeStore } from "@/stores/file-tree-store";
import { type Draft, useFilesUiStore } from "@/stores/files-ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface FilesPanelProps {
  onClose: () => void;
}

export function FilesPanel({ onClose }: FilesPanelProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const workspaceInfo = useWorkspaceStore((s) => s.info);

  const tree = useFileTreeStore((s) => s.tree);
  const loading = useFileTreeStore((s) => s.loading);
  const refresh = useFileTreeStore((s) => s.refresh);

  const selectedNodeId = useFilesUiStore((s) => s.selectedNodeId);
  const expandedFolderIds = useFilesUiStore((s) => s.expandedFolderIds);
  const draft = useFilesUiStore((s) => s.draft);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      // Panel unmount: drop any in-flight draft so it doesn't leak into the
      // next session. UI state is allowed to reset; workspace switches also
      // clear via `reset()` elsewhere.
      useFilesUiStore.getState().cancelDraft();
    };
  }, []);

  const handleNodePress = useCallback((node: UniffiFileTreeNode) => {
    const isFolder = node.children !== undefined && node.children !== null;
    useFilesUiStore.getState().select(node.id);
    if (isFolder) {
      useFilesUiStore.getState().toggleExpand(node.id);
    } else {
      useCurrentDocStore
        .getState()
        .open(node.id)
        .catch((err: unknown) => {
          console.warn("[files-panel] open doc failed:", err);
        });
    }
  }, []);

  const deriveParentRelPath = useCallback((): string | null => {
    if (selectedNodeId === null) return null;
    if (tree === null) return null;
    const found = findNode(tree, selectedNodeId);
    if (found === null) return null;
    const isFolder = found.children !== undefined && found.children !== null;
    if (isFolder) return found.id;
    const idx = found.id.lastIndexOf("/");
    return idx === -1 ? null : found.id.slice(0, idx);
  }, [selectedNodeId, tree]);

  const onNewNote = useCallback(() => {
    useFilesUiStore
      .getState()
      .startDraft({ kind: "document", parentRelPath: deriveParentRelPath() });
  }, [deriveParentRelPath]);

  const onNewFolder = useCallback(() => {
    useFilesUiStore.getState().startDraft({ kind: "folder", parentRelPath: deriveParentRelPath() });
  }, [deriveParentRelPath]);

  const onCollapseAll = useCallback(() => useFilesUiStore.getState().collapseAll(), []);

  const onSubmitDraft = useCallback(async () => {
    const current = useFilesUiStore.getState().draft;
    if (current === null) return;
    const name = current.name.trim();
    if (name.length === 0) {
      useFilesUiStore.getState().cancelDraft();
      return;
    }
    useFilesUiStore.getState().setDraftSubmitting(true);
    try {
      if (current.kind === "folder") {
        await createFolderAt(current.parentRelPath, name);
      } else {
        await createNoteAt(current.parentRelPath, name);
      }
      useFilesUiStore.getState().cancelDraft();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useFilesUiStore.getState().setDraftError(msg);
    }
  }, []);

  const onCancelDraft = useCallback(() => useFilesUiStore.getState().cancelDraft(), []);
  const onChangeDraftName = useCallback(
    (name: string) => useFilesUiStore.getState().setDraftName(name),
    [],
  );

  const treeContent = useMemo(() => {
    if (tree === null) {
      return (
        <View className="py-6 items-center">
          {loading ? (
            <ActivityIndicator color={colors.mutedForeground} />
          ) : (
            <Text className="text-[12px] text-muted-foreground">加载中…</Text>
          )}
        </View>
      );
    }
    if (tree.length === 0 && draft === null) {
      return (
        <View className="py-6 px-4 items-center">
          <Text className="text-[12px] text-muted-foreground text-center">
            还没有笔记，点击下方工具栏新建
          </Text>
        </View>
      );
    }
    return (
      <TreeList
        nodes={tree}
        depth={0}
        selectedNodeId={selectedNodeId}
        expandedFolderIds={expandedFolderIds}
        colors={colors}
        draft={draft}
        parentRelPath={null}
        onNodePress={handleNodePress}
        onSubmitDraft={onSubmitDraft}
        onCancelDraft={onCancelDraft}
        onChangeDraftName={onChangeDraftName}
      />
    );
  }, [
    tree,
    loading,
    selectedNodeId,
    expandedFolderIds,
    colors,
    draft,
    handleNodePress,
    onSubmitDraft,
    onCancelDraft,
    onChangeDraftName,
  ]);

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerClassName="px-2 pt-3 pb-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
      >
        {treeContent}
      </ScrollView>

      <FilesToolbar
        onNewNote={onNewNote}
        onNewFolder={onNewFolder}
        onSort={() => console.log("[files] sort")}
        onCollapseAll={onCollapseAll}
        onClose={onClose}
      />

      <View className="flex-row items-center justify-between border-t border-border px-3 py-2.5">
        <Pressable
          onPress={() => router.push("/workspaces" as never)}
          accessibilityLabel="切换工作区"
          className="flex-row items-center gap-1.5 h-9 rounded-lg bg-muted px-3"
        >
          <Folder color={colors.primary} size={14} />
          <Text className="text-[13px] font-medium text-foreground">
            {workspaceInfo?.name ?? "默认工作区"}
          </Text>
          <ChevronsUpDown color={colors.mutedForeground} size={12} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings" as never)}
          accessibilityLabel="设置"
          hitSlop={6}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-muted"
        >
          <Settings color={colors.mutedForeground} size={18} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useThemeColors>;

interface TreeListProps {
  nodes: UniffiFileTreeNode[];
  depth: number;
  selectedNodeId: string | null;
  expandedFolderIds: Set<string>;
  colors: ThemeColors;
  draft: Draft | null;
  /** relPath of the folder this list represents; `null` for root. Used to
   *  decide where to drop the inline draft input. */
  parentRelPath: string | null;
  onNodePress: (node: UniffiFileTreeNode) => void;
  onSubmitDraft: () => void;
  onCancelDraft: () => void;
  onChangeDraftName: (name: string) => void;
}

function TreeList({
  nodes,
  depth,
  selectedNodeId,
  expandedFolderIds,
  colors,
  draft,
  parentRelPath,
  onNodePress,
  onSubmitDraft,
  onCancelDraft,
  onChangeDraftName,
}: TreeListProps) {
  const showDraftHere = draft !== null && draft.parentRelPath === parentRelPath;
  return (
    <View>
      {nodes.map((node) => (
        <FileTreeNode
          key={node.id}
          node={node}
          depth={depth}
          selected={selectedNodeId === node.id}
          expandedFolderIds={expandedFolderIds}
          colors={colors}
          draft={draft}
          onNodePress={onNodePress}
          onSubmitDraft={onSubmitDraft}
          onCancelDraft={onCancelDraft}
          onChangeDraftName={onChangeDraftName}
          selectedNodeId={selectedNodeId}
        />
      ))}
      {showDraftHere && draft !== null ? (
        <InlineNameInput
          kind={draft.kind}
          value={draft.name}
          submitting={draft.submitting}
          error={draft.error}
          depth={depth}
          onChangeText={onChangeDraftName}
          onSubmit={onSubmitDraft}
          onCancel={onCancelDraft}
        />
      ) : null}
    </View>
  );
}

interface FileTreeNodeProps {
  node: UniffiFileTreeNode;
  depth: number;
  selected: boolean;
  selectedNodeId: string | null;
  expandedFolderIds: Set<string>;
  colors: ThemeColors;
  draft: Draft | null;
  onNodePress: (node: UniffiFileTreeNode) => void;
  onSubmitDraft: () => void;
  onCancelDraft: () => void;
  onChangeDraftName: (name: string) => void;
}

const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  selected,
  selectedNodeId,
  expandedFolderIds,
  colors,
  draft,
  onNodePress,
  onSubmitDraft,
  onCancelDraft,
  onChangeDraftName,
}: FileTreeNodeProps) {
  const isFolder = node.children !== undefined && node.children !== null;
  const isOpen = isFolder && expandedFolderIds.has(node.id);
  const Icon: LucideIcon = isFolder ? Folder : FileText;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  const childCount = isFolder ? (node.children?.length ?? 0) : 0;

  return (
    <View>
      <Pressable
        onPress={() => onNodePress(node)}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={`h-9 flex-row items-center gap-1.5 pr-3 rounded-md ${
          selected ? "bg-muted" : "active:bg-muted"
        }`}
        accessibilityLabel={node.name}
      >
        {isFolder ? (
          <Chevron color={colors.mutedForeground} size={14} />
        ) : (
          <View className="w-[14px]" />
        )}
        <Icon
          color={isFolder ? colors.primary : colors.mutedForeground}
          size={15}
          strokeWidth={isFolder ? 2 : 1.75}
        />
        <Text className="text-[13px] text-foreground flex-1" numberOfLines={1}>
          {node.name}
        </Text>
        {isFolder && childCount > 0 ? (
          <Text className="text-[11px] text-muted-foreground">{childCount}</Text>
        ) : null}
      </Pressable>
      {isOpen && node.children ? (
        <TreeList
          nodes={node.children}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          expandedFolderIds={expandedFolderIds}
          colors={colors}
          draft={draft}
          parentRelPath={node.id}
          onNodePress={onNodePress}
          onSubmitDraft={onSubmitDraft}
          onCancelDraft={onCancelDraft}
          onChangeDraftName={onChangeDraftName}
        />
      ) : null}
    </View>
  );
});

function findNode(nodes: UniffiFileTreeNode[], id: string): UniffiFileTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children !== undefined && n.children !== null) {
      const nested = findNode(n.children, id);
      if (nested !== null) return nested;
    }
  }
  return null;
}
