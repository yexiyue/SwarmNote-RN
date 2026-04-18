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
import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FilesToolbar } from "@/components/files-toolbar";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface FileNode {
  id: string;
  name: string;
  kind: "folder" | "file";
  children?: FileNode[];
}

const MOCK_TREE: FileNode[] = [
  {
    id: "folder-project",
    name: "项目",
    kind: "folder",
    children: [
      { id: "note-idea", name: "构思.md", kind: "file" },
      { id: "note-arch", name: "架构.md", kind: "file" },
    ],
  },
  { id: "folder-weekly", name: "周会记录", kind: "folder", children: [] },
  { id: "note-untitled", name: "Untitled.md", kind: "file" },
];

function collectFolderIds(nodes: FileNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.kind === "folder") {
      acc.push(n.id);
      if (n.children) collectFolderIds(n.children, acc);
    }
  }
  return acc;
}

interface FilesPanelProps {
  onClose: () => void;
}

export function FilesPanel({ onClose }: FilesPanelProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const workspaceInfo = useWorkspaceStore((s) => s.info);

  // Expanded-folder set at panel level. Previous revision used a `collapseSignal` counter
  // with a `useEffect` in every tree node — that forced every node to subscribe and re-run
  // on any collapse. Now we own the state here, a single setState collapses the whole tree.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(collectFolderIds(MOCK_TREE)));

  const toggleFolder = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const tree = useMemo(
    () =>
      MOCK_TREE.map((node) => (
        <FileTreeNode
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          colors={colors}
          onToggle={toggleFolder}
        />
      )),
    [expanded, colors, toggleFolder],
  );

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerClassName="px-2 pt-3 pb-4"
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >
        {tree}
      </ScrollView>

      <FilesToolbar
        onNewNote={() => console.log("[files] new note")}
        onNewFolder={() => console.log("[files] new folder")}
        onSort={() => console.log("[files] sort")}
        onCollapseAll={collapseAll}
        onClose={onClose}
      />

      <View className="flex-row items-center justify-between border-t border-border px-3 py-2.5">
        <Pressable
          onPress={() => console.log("[files] switch workspace")}
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

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  colors: ThemeColors;
  onToggle: (id: string) => void;
}

const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  expanded,
  colors,
  onToggle,
}: FileTreeNodeProps) {
  const isFolder = node.kind === "folder";
  const isOpen = isFolder && expanded.has(node.id);
  const Icon: LucideIcon = isFolder ? Folder : FileText;
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  const onPress = () => {
    if (isFolder) onToggle(node.id);
    else console.log("[files] open note", node.id);
  };

  const childCount = isFolder ? (node.children?.length ?? 0) : 0;

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={{ paddingLeft: 8 + depth * 16 }}
        className="h-9 flex-row items-center gap-1.5 pr-3 rounded-md active:bg-muted"
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
      {isOpen && node.children
        ? node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              colors={colors}
              onToggle={onToggle}
            />
          ))
        : null}
    </View>
  );
});
