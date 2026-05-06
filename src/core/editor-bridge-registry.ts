/** Singleton registry so `event-bus.ts` (a plain module, not React) can
 *  forward an `ExternalUpdate` to whichever editor is currently mounted.
 *
 *  - `register(docUuid, apply)` is called by `MarkdownEditor` after the
 *    WebView signals `onRuntimeReady` AND the doc is open in collab mode.
 *  - `clear(docUuid)` MUST be matched: clears only if the currently-active
 *    docUuid equals the caller's. This prevents React strict-mode double
 *    effects from nuking a fresh registration with a stale cleanup.
 *  - `getActive()` is used by `event-bus` when an `ExternalUpdate` lands.
 *
 *  Awareness uses a parallel pair (`registerAwareness` / `clearAwareness` /
 *  `getActiveAwareness`) — separate slot because awareness can mount before
 *  the doc bridge is ready or vice versa, and they have independent lifetimes
 *  (the awareness handler exists for as long as the editor instance does;
 *  the doc bridge needs to flip when remounting). */

type ApplyRemoteUpdate = (update: Uint8Array) => void;

interface ActiveEntry {
  docUuid: string;
  applyRemoteUpdate: ApplyRemoteUpdate;
}

let active: ActiveEntry | null = null;
let activeAwareness: ActiveEntry | null = null;

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

export function registerAwareness(
  docUuid: string,
  applyRemoteAwarenessUpdate: ApplyRemoteUpdate,
): void {
  activeAwareness = { docUuid, applyRemoteUpdate: applyRemoteAwarenessUpdate };
}

export function clearAwareness(docUuid: string): void {
  if (activeAwareness !== null && activeAwareness.docUuid === docUuid) {
    activeAwareness = null;
  }
}

export function getActiveAwareness(): ActiveEntry | null {
  return activeAwareness;
}
