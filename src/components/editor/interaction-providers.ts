import type { SlashItem, WikilinkItem } from "@swarmnote/editor-react-native/contracts";
import type { UniffiFileTreeNode } from "react-native-swarmnote-core";

const MAX_NOTE_JUMP_ITEMS = 8;

function flattenNotes(nodes: readonly UniffiFileTreeNode[] | null): UniffiFileTreeNode[] {
  if (!nodes) return [];
  const flat: UniffiFileTreeNode[] = [];
  const walk = (xs: readonly UniffiFileTreeNode[]) => {
    for (const n of xs) {
      if (n.children) walk(n.children);
      else if (n.id.endsWith(".md")) flat.push(n);
    }
  };
  walk(nodes);
  return flat;
}

function basename(relPath: string): string {
  const last = relPath.split("/").pop() ?? relPath;
  return last.replace(/\.md$/i, "");
}

/** Snapshot notes matching `query`. Empty query → first MAX_NOTE_JUMP_ITEMS. */
function matchNotes(
  query: string,
  tree: readonly UniffiFileTreeNode[] | null,
): UniffiFileTreeNode[] {
  const trimmed = query.trim().toLowerCase();
  const notes = flattenNotes(tree);
  if (!trimmed) return notes.slice(0, MAX_NOTE_JUMP_ITEMS);
  return notes
    .filter((n) => basename(n.id).toLowerCase().includes(trimmed))
    .slice(0, MAX_NOTE_JUMP_ITEMS);
}

const BASIC_BLOCK_ITEMS: readonly SlashItem[] = [
  {
    id: "heading.1",
    title: "Heading 1",
    description: "Top-level section heading",
    icon: "heading-1",
    keywords: ["h1", "heading", "标题"],
    section: "Basic",
    commandId: "toggleHeading",
    commandArgs: [1],
  },
  {
    id: "heading.2",
    title: "Heading 2",
    description: "Section heading",
    icon: "heading-2",
    keywords: ["h2", "heading", "标题"],
    section: "Basic",
    commandId: "toggleHeading",
    commandArgs: [2],
  },
  {
    id: "heading.3",
    title: "Heading 3",
    description: "Subsection heading",
    icon: "heading-3",
    keywords: ["h3", "heading", "标题"],
    section: "Basic",
    commandId: "toggleHeading",
    commandArgs: [3],
  },
  {
    id: "list.bulleted",
    title: "Bulleted list",
    description: "Insert an unordered list",
    icon: "list",
    keywords: ["list", "bullet", "unordered", "无序列表"],
    section: "Basic",
    commandId: "toggleUnorderedList",
  },
  {
    id: "list.numbered",
    title: "Numbered list",
    description: "Insert an ordered list",
    icon: "list-ordered",
    keywords: ["list", "ordered", "numbered", "有序列表"],
    section: "Basic",
    commandId: "toggleOrderedList",
  },
  {
    id: "list.check",
    title: "Check list",
    description: "Insert a todo / checkbox list",
    icon: "list-todo",
    keywords: ["check", "todo", "task", "任务", "复选"],
    section: "Basic",
    commandId: "toggleCheckList",
  },
  {
    id: "quote",
    title: "Quote",
    description: "Insert a blockquote",
    icon: "quote",
    keywords: ["quote", "blockquote", "引用"],
    section: "Basic",
    commandId: "toggleBlockquote",
  },
  {
    id: "divider",
    title: "Divider",
    description: "Insert a horizontal rule",
    icon: "minus",
    keywords: ["divider", "hr", "separator", "分割线"],
    section: "Basic",
    commandId: "insertHorizontalRule",
  },
];

/**
 * Slash items provider for RN host. Returns:
 * - Basic block catalog (always)
 * - Jump-to-note items disabled on RN (would need cross-Comlink callback;
 *   v0.5 follow-up). For now only the basic catalog.
 *
 * Items use `commandId` + `commandArgs` because closures don't survive
 * Comlink serialization to the WebView editor.
 */
export function buildSlashItems(_query: string): SlashItem[] {
  return [...BASIC_BLOCK_ITEMS];
}

/**
 * Wikilink items provider for RN host. Walks the workspace file tree and
 * returns up to 8 matching notes. `commit: 'replaceWithLink'` is serializable
 * (string, not closure), so this works through Comlink.
 */
export function buildWikilinkItems(
  query: string,
  tree: readonly UniffiFileTreeNode[] | null,
): WikilinkItem[] {
  return matchNotes(query, tree).map((note) => ({
    id: note.id,
    title: basename(note.id),
    description: note.id,
    icon: "file-text",
    commit: "replaceWithLink",
  }));
}

/**
 * Resolve a `LinkOpen` event's url to an internal note. Returns null when
 * the url should be treated as an external URL (host may opt to open it
 * via `expo-web-browser` or similar).
 *
 * Match order (matches desktop's resolveInternalLink):
 * 1. External scheme (`xxx://` / `mailto:` / `tel:` ...) → null
 * 2. `.md` path → exact match against note id
 * 3. Wikilink target → basename case-insensitive, then fuzzy contains
 */
export function resolveInternalLink(
  url: string,
  tree: readonly UniffiFileTreeNode[] | null,
): { id: string; title: string } | null {
  if (!url) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;

  const normalized = url.startsWith("./") ? url.slice(2) : url;
  const lowered = normalized.toLowerCase();
  const notes = flattenNotes(tree);

  if (lowered.endsWith(".md")) {
    const hit = notes.find((n) => n.id === normalized);
    if (hit) return { id: hit.id, title: basename(hit.id) };
  }

  const exactTitle = notes.find((n) => basename(n.id).toLowerCase() === lowered);
  if (exactTitle) return { id: exactTitle.id, title: basename(exactTitle.id) };

  const fuzzy = notes.find((n) => basename(n.id).toLowerCase().includes(lowered));
  if (fuzzy) return { id: fuzzy.id, title: basename(fuzzy.id) };

  return null;
}
