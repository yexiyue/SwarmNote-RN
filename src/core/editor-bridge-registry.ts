/** Singleton registry so `event-bus.ts` (a plain module, not React) can
 *  forward an `ExternalUpdate` to whichever editor is currently mounted.
 *
 *  - `register(docUuid, apply)` is called by `MarkdownEditor` after the
 *    WebView signals `onRuntimeReady` AND the doc is open in collab mode.
 *  - `clear(docUuid)` MUST be matched: clears only if the currently-active
 *    docUuid equals the caller's. This prevents React strict-mode double
 *    effects from nuking a fresh registration with a stale cleanup.
 *  - `getActive()` is used by `event-bus` when an `ExternalUpdate` lands. */

type ApplyRemoteUpdate = (update: Uint8Array) => void;

interface ActiveEntry {
  docUuid: string;
  applyRemoteUpdate: ApplyRemoteUpdate;
}

let active: ActiveEntry | null = null;

export function register(docUuid: string, applyRemoteUpdate: ApplyRemoteUpdate): void {
  active = { docUuid, applyRemoteUpdate };
}

export function clear(docUuid: string): void {
  if (active !== null && active.docUuid === docUuid) {
    active = null;
  }
}

export function getActive(): ActiveEntry | null {
  return active;
}
