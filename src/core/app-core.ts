import { Paths } from "expo-file-system";
import { UniffiAppCore, type UniffiAppCoreLike } from "react-native-swarmnote-core";
import { EventBus } from "./event-bus";
import { Keychain } from "./keychain";

let corePromise: Promise<UniffiAppCoreLike> | null = null;
let core: UniffiAppCoreLike | null = null;

/** Idempotent lazy bootstrap. Safe to call multiple times — the second call
 *  returns the same promise (not a new `UniffiAppCore.create`).
 *
 *  The `appDataDir` passed to the Rust side is `Paths.document.uri` raw
 *  (`file://...`); mobile-core strips the `file://` prefix internally. */
export function initAppCore(): Promise<UniffiAppCoreLike> {
  if (corePromise !== null) return corePromise;
  corePromise = (async () => {
    const instance = await UniffiAppCore.create(new Keychain(), new EventBus(), Paths.document.uri);
    core = instance;
    return instance;
  })();
  return corePromise;
}

/** Synchronous accessor for code paths where AppCore is known to be ready
 *  (e.g. inside event-bus dispatchers, store actions invoked from UI).
 *  Throws if `initAppCore` has not resolved yet. */
export function getAppCore(): UniffiAppCoreLike {
  if (core === null) {
    throw new Error("AppCore not initialized — call initAppCore() first");
  }
  return core;
}

/** Release the native handle and clear the cached singleton. Usually only
 *  called in tests or on explicit sign-out (not implemented in v1). */
export function teardownAppCore(): void {
  if (core !== null) {
    (core as { uniffiDestroy?: () => void }).uniffiDestroy?.();
  }
  core = null;
  corePromise = null;
}
