import { Paths } from "expo-file-system";

const MAX_LEN = 50;
const ILLEGAL_CHARS = /[\\/:*?"<>|]/;
const WORKSPACES_SUBDIR = "workspaces";

export type NameValidation = { ok: true } | { ok: false; reason: string };

/** Validate a user-entered workspace name. Rules come from two places:
 *  - filesystem safety (Windows & POSIX reserved chars, leading/trailing
 *    whitespace confuses path resolution)
 *  - UX (upper bound so the picker doesn't overflow) */
export function validateWorkspaceName(raw: string): NameValidation {
  if (raw.length === 0) {
    return { ok: false, reason: "请输入工作区名称" };
  }
  if (raw !== raw.trim()) {
    return { ok: false, reason: "名称不能以空格开头或结尾" };
  }
  if (raw.length > MAX_LEN) {
    return { ok: false, reason: `名称不能超过 ${MAX_LEN} 个字符` };
  }
  if (ILLEGAL_CHARS.test(raw)) {
    return { ok: false, reason: '名称不能包含 / \\ : * ? " < > |' };
  }
  return { ok: true };
}

/** Build the on-disk path for a workspace directory under the app sandbox.
 *  Always `${document}/workspaces/<name>`; caller is responsible for running
 *  `validateWorkspaceName` first. */
export function workspaceNameToDirUri(name: string): string {
  const base = Paths.document.uri.replace(/\/$/, "");
  return `${base}/${WORKSPACES_SUBDIR}/${name}`;
}
