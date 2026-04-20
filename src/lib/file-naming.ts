const MAX_LEN = 100;
const ILLEGAL_CHARS = /[\\/:*?"<>|]/;

export type NameValidation = { ok: true } | { ok: false; reason: string };

/** Validate a user-entered note or folder name (single path segment).
 *  Illegal chars mirror Windows + POSIX reserved set so the same name
 *  stays portable across devices. */
export function validateNodeName(raw: string): NameValidation {
  if (raw.length === 0) {
    return { ok: false, reason: "请输入名称" };
  }
  if (raw !== raw.trim()) {
    return { ok: false, reason: "不能以空格开头或结尾" };
  }
  if (raw.length > MAX_LEN) {
    return { ok: false, reason: `不能超过 ${MAX_LEN} 个字符` };
  }
  if (ILLEGAL_CHARS.test(raw)) {
    return { ok: false, reason: '不能包含 / \\ : * ? " < > |' };
  }
  if (raw === "." || raw === "..") {
    return { ok: false, reason: "保留名称" };
  }
  return { ok: true };
}

/** Build the workspace-relative path for a new node. `.md` suffix is
 *  appended for documents but not folders. */
export function buildRelPath(
  parentRelPath: string | null,
  name: string,
  kind: "document" | "folder",
): string {
  const leaf = kind === "document" ? `${name}.md` : name;
  if (parentRelPath === null || parentRelPath === "") return leaf;
  return `${parentRelPath}/${leaf}`;
}
