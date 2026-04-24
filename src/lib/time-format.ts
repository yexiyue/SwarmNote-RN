/** Shared lightweight time formatters used across settings/workspaces screens.
 *  Intentionally dependency-free so we don't pull a full i18n lib for a handful
 *  of display strings. */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "YYYY-MM-DD" from a Date. */
export function formatAbsoluteDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "刚刚 / N 分钟前 / N 小时前 / N 天前 / YYYY-MM-DD" from a Date. */
export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < MIN) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return formatAbsoluteDate(date);
}

/** Compact "last synced" formatter: shows HH:mm for same day, "昨天 HH:mm" for
 *  yesterday, else falls back to the coarser `formatRelativeTime`. */
export function formatLastSyncedAt(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < MIN) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} 分钟前`;

  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (new Date(now).toDateString() === date.toDateString()) return `${hh}:${mm}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) return `昨天 ${hh}:${mm}`;

  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return formatAbsoluteDate(date);
}
