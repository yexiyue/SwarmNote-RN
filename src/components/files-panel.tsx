import { Trans, useLingui } from "@lingui/react/macro";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  Folder,
  Inbox,
  type LucideIcon,
  Settings,
} from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UniffiFileTreeNode } from "react-native-swarmnote-core";
import { FileActionSheet, type FileActionSheetRef } from "@/components/files/FileActionSheet";
import { InlineNameInput } from "@/components/files/InlineNameInput";
import { FilesToolbar } from "@/components/files-toolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import {
  basenameForEdit,
  createFolderAt,
  createNoteAt,
  deleteNode,
  renameNode,
} from "@/core/files-actions";
import { useThemeColors } from "@/hooks/useThemeColors";
import { toast } from "@/lib/toast";
import { cn, errorMessage } from "@/lib/utils";
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
  const { t } = useLingui();
  const workspaceInfo = useWorkspaceStore((s) => s.info);

  const tree = useFileTreeStore((s) => s.tree);
  const loading = useFileTreeStore((s) => s.loading);
  const refresh = useFileTreeStore((s) => s.refresh);

  const selectedNodeId = useFilesUiStore((s) => s.selectedNodeId);
  const expandedFolderIds = useFilesUiStore((s) => s.expandedFolderIds);
  const draft = useFilesUiStore((s) => s.draft);
  const currentRelPath = useCurrentDocStore((s) => s.relPath);

  const sheetRef = useRef<FileActionSheetRef>(null);
  const [_actionTarget, setActionTarget] = useState<UniffiFileTreeNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UniffiFileTreeNode | null>(null);

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

  const handleNodePress = useCallback(
    (node: UniffiFileTreeNode) => {
      const isFolder = node.children !== undefined && node.children !== null;
      useFilesUiStore.getState().select(node.id);
      if (isFolder) {
        useFilesUiStore.getState().toggleExpand(node.id);
      } else {
        // Fire the open in the background and let the pager switch happen
        // immediately. The editor page renders from currentDocStore so it
        // shows a spinner (opening → open) while the doc loads.
        useCurrentDocStore
          .getState()
          .open(node.id)
          .catch((err: unknown) => {
            console.warn("[files-panel] open doc failed:", err);
          });
        onClose();
      }
    },
    [onClose],
  );

  const openActionSheet = useCallback((node: UniffiFileTreeNode) => {
    setActionTarget(node);
    sheetRef.current?.present(node);
  }, []);

  const handleRename = useCallback((node: UniffiFileTreeNode) => {
    const isFolder = node.children !== undefined && node.children !== null;
    const parentIdx = node.id.lastIndexOf("/");
    const parentRelPath = parentIdx === -1 ? null : node.id.slice(0, parentIdx);
    useFilesUiStore.getState().startDraft({
      kind: isFolder ? "folder" : "document",
      parentRelPath,
      name: basenameForEdit(node),
      renameTarget: node,
    });
  }, []);

  const handleDelete = useCallback((node: UniffiFileTreeNode) => {
    setDeleteTarget(node);
  }, []);

  const confirmDelete = useCallback(() => {
    const node = deleteTarget;
    if (node === null) return;
    setDeleteTarget(null);
    deleteNode(node)
      .then(() => toast.success(t`已删除`))
      .catch((err: unknown) => {
        toast.error(t`删除失败`, err);
      });
  }, [deleteTarget, t]);

  const deleteCopy = useMemo(() => {
    if (deleteTarget === null) return null;
    const isFolder = deleteTarget.children !== undefined && deleteTarget.children !== null;
    const childCount = countDescendants(deleteTarget);
    const title = isFolder ? t`删除文件夹` : t`删除笔记`;
    const message =
      isFolder && childCount > 0
        ? t`『${deleteTarget.name}』包含 ${childCount} 项，将一并删除。此操作无法撤销。`
        : t`确定删除『${deleteTarget.name}』？此操作无法撤销。`;
    return { title, message };
  }, [deleteTarget, t]);

  const handleCopyPath = useCallback(
    (node: UniffiFileTreeNode) => {
      Clipboard.setStringAsync(node.id)
        .then(() => toast.success(t`已复制`))
        .catch((err: unknown) => {
          console.warn("[files-panel] copy path failed:", err);
          toast.error(t`复制失败`, err);
        });
    },
    [t],
  );

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
      if (current.renameTarget !== null) {
        await renameNode(current.renameTarget, name);
      } else if (current.kind === "folder") {
        await createFolderAt(current.parentRelPath, name);
      } else {
        await createNoteAt(current.parentRelPath, name);
      }
      useFilesUiStore.getState().cancelDraft();
    } catch (err) {
      useFilesUiStore.getState().setDraftError(errorMessage(err));
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
            <Text className="text-[12px] text-muted-foreground">
              <Trans>加载中…</Trans>
            </Text>
          )}
        </View>
      );
    }
    if (tree.length === 0 && draft === null) {
      return (
        <View className="items-center gap-2.5 px-5 pt-8 pb-7">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Inbox color={colors.mutedForeground} size={26} />
          </View>
          <Text className="text-[14px] font-semibold text-foreground">
            <Trans>还没有笔记</Trans>
          </Text>
          <Text className="text-center text-[12px] text-muted-foreground">
            <Trans>点击下方工具栏新建你的第一条笔记</Trans>
          </Text>
        </View>
      );
    }
    return (
      <TreeList
        nodes={tree}
        depth={0}
        selectedNodeId={selectedNodeId}
        currentRelPath={currentRelPath}
        expandedFolderIds={expandedFolderIds}
        colors={colors}
        draft={draft}
        parentRelPath={null}
        onNodePress={handleNodePress}
        onNodeLongPress={openActionSheet}
        onSubmitDraft={onSubmitDraft}
        onCancelDraft={onCancelDraft}
        onChangeDraftName={onChangeDraftName}
      />
    );
  }, [
    tree,
    loading,
    selectedNodeId,
    currentRelPath,
    expandedFolderIds,
    colors,
    draft,
    handleNodePress,
    openActionSheet,
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
        onSort={() => toast.info(t`排序即将推出`)}
        onCollapseAll={onCollapseAll}
        onClose={onClose}
      />

      <View className="flex-row items-center justify-between border-t border-border px-3 py-2.5">
        <Pressable
          onPress={() => router.push("/workspaces" as never)}
          accessibilityLabel={t`切换工作区`}
          className="flex-row items-center gap-1.5 h-9 rounded-lg bg-muted px-3"
        >
          <Folder color={colors.primary} size={14} />
          <Text className="text-[13px] font-medium text-foreground">
            {workspaceInfo?.name ?? t`默认工作区`}
          </Text>
          <ChevronsUpDown color={colors.mutedForeground} size={12} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings" as never)}
          accessibilityLabel={t`设置`}
          hitSlop={6}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-muted"
        >
          <Settings color={colors.mutedForeground} size={18} />
        </Pressable>
      </View>

      <FileActionSheet
        ref={sheetRef}
        onRename={handleRename}
        onDelete={handleDelete}
        onCopyPath={handleCopyPath}
      />

      <AlertDialog
        open={deleteCopy !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          {deleteCopy !== null ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{deleteCopy.title}</AlertDialogTitle>
                <AlertDialogDescription>{deleteCopy.message}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <Text>
                    <Trans>取消</Trans>
                  </Text>
                </AlertDialogCancel>
                <AlertDialogAction className="bg-destructive" onPress={confirmDelete}>
                  <Text className="text-destructive-foreground">
                    <Trans>删除</Trans>
                  </Text>
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}

function countDescendants(node: UniffiFileTreeNode): number {
  if (node.children === undefined || node.children === null) return 0;
  let total = 0;
  for (const child of node.children) {
    total += 1 + countDescendants(child);
  }
  return total;
}

type ThemeColors = ReturnType<typeof useThemeColors>;

interface TreeListProps {
  nodes: UniffiFileTreeNode[];
  depth: number;
  selectedNodeId: string | null;
  currentRelPath: string | null;
  expandedFolderIds: Set<string>;
  colors: ThemeColors;
  draft: Draft | null;
  /** relPath of the folder this list represents; `null` for root. Used to
   *  decide where to drop the inline draft input. */
  parentRelPath: string | null;
  onNodePress: (node: UniffiFileTreeNode) => void;
  onNodeLongPress: (node: UniffiFileTreeNode) => void;
  onSubmitDraft: () => void;
  onCancelDraft: () => void;
  onChangeDraftName: (name: string) => void;
}

function TreeList({
  nodes,
  depth,
  selectedNodeId,
  currentRelPath,
  expandedFolderIds,
  colors,
  draft,
  parentRelPath,
  onNodePress,
  onNodeLongPress,
  onSubmitDraft,
  onCancelDraft,
  onChangeDraftName,
}: TreeListProps) {
  const showDraftHere = draft !== null && draft.parentRelPath === parentRelPath;
  return (
    <View>
      {nodes.map((node) => {
        // Replace the row with the inline input when a rename draft targets it.
        if (draft !== null && draft.renameTarget?.id === node.id) {
          return (
            <InlineNameInput
              key={node.id}
              kind={draft.kind}
              value={draft.name}
              submitting={draft.submitting}
              error={draft.error}
              depth={depth}
              onChangeText={onChangeDraftName}
              onSubmit={onSubmitDraft}
              onCancel={onCancelDraft}
            />
          );
        }
        return (
          <FileTreeNode
            key={node.id}
            node={node}
            depth={depth}
            selected={selectedNodeId === node.id}
            isCurrent={currentRelPath !== null && node.id === currentRelPath}
            expandedFolderIds={expandedFolderIds}
            colors={colors}
            draft={draft}
            onNodePress={onNodePress}
            onNodeLongPress={onNodeLongPress}
            onSubmitDraft={onSubmitDraft}
            onCancelDraft={onCancelDraft}
            onChangeDraftName={onChangeDraftName}
            selectedNodeId={selectedNodeId}
            currentRelPath={currentRelPath}
          />
        );
      })}
      {showDraftHere && draft !== null && draft.renameTarget === null ? (
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
  isCurrent: boolean;
  selectedNodeId: string | null;
  currentRelPath: string | null;
  expandedFolderIds: Set<string>;
  colors: ThemeColors;
  draft: Draft | null;
  onNodePress: (node: UniffiFileTreeNode) => void;
  onNodeLongPress: (node: UniffiFileTreeNode) => void;
  onSubmitDraft: () => void;
  onCancelDraft: () => void;
  onChangeDraftName: (name: string) => void;
}

const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  selected,
  isCurrent,
  selectedNodeId,
  currentRelPath,
  expandedFolderIds,
  colors,
  draft,
  onNodePress,
  onNodeLongPress,
  onSubmitDraft,
  onCancelDraft,
  onChangeDraftName,
}: FileTreeNodeProps) {
  const isFolder = node.children !== undefined && node.children !== null;
  const isOpen = isFolder && expandedFolderIds.has(node.id);
  const Icon: LucideIcon = isFolder ? Folder : FileText;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  const childCount = isFolder ? (node.children?.length ?? 0) : 0;

  const rowClassName = cn(
    "h-9 flex-row items-center gap-1.5 pr-3 rounded-lg",
    isCurrent && "border border-primary bg-primary/15",
    !isCurrent && selected && "bg-muted",
    !isCurrent && !selected && "active:bg-muted",
  );

  return (
    <View>
      <Pressable
        onPress={() => onNodePress(node)}
        onLongPress={() => onNodeLongPress(node)}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={rowClassName}
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
          currentRelPath={currentRelPath}
          expandedFolderIds={expandedFolderIds}
          colors={colors}
          draft={draft}
          parentRelPath={node.id}
          onNodePress={onNodePress}
          onNodeLongPress={onNodeLongPress}
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
