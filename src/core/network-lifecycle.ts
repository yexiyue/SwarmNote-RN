import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import { useNetworkPreferenceStore } from "@/stores/network-preference-store";
import { getAppCore } from "./app-core";

/** RN 0.83 ships two conflicting `AppState` type definitions (`Libraries/` vs
 *  `types_generated/`); the variadic one tsc picks up here causes spurious
 *  "Expected 1 argument, but got 2". Narrow to the stable 2-arg shape. */
interface AppStateLike {
  currentState: AppStateStatus;
  addEventListener(
    type: "change",
    listener: (state: AppStateStatus) => void,
  ): NativeEventSubscription;
}
const AppStateTyped = AppState as unknown as AppStateLike;

const BACKGROUND_STOP_DELAY_MS = 30_000;

/** Couples React Native `AppState` and the persisted master toggle to the
 *  P2P node lifecycle. Rules:
 *  - master toggle off → P2P stays stopped regardless of AppState
 *  - master toggle on  → active: start; background: stop after 30s unless we
 *                        come back to active first
 *
 *  Intended to be mounted once in `_layout.tsx` after onboarding completes.
 *  Not for onboarding-phase use — the Pairing step controls P2P manually. */
export class NetworkLifecycle {
  private appStateSub: NativeEventSubscription | null = null;
  private prefUnsub: (() => void) | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    this.appStateSub = AppStateTyped.addEventListener("change", this.handleAppStateChange);
    this.prefUnsub = useNetworkPreferenceStore.subscribe(
      // Respond to master-toggle flips; reconcile() reads both values together.
      (s) => s.userWantsNetwork,
      () => this.reconcile(),
    );

    // Initial reconcile: AppState on mount is typically "active".
    this.reconcile();
  }

  dispose(): void {
    if (!this.started) return;
    this.started = false;
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.prefUnsub?.();
    this.prefUnsub = null;
    this.clearStopTimer();
  }

  private handleAppStateChange = (next: AppStateStatus): void => {
    const wantsNetwork = useNetworkPreferenceStore.getState().userWantsNetwork;
    if (!wantsNetwork) return;

    if (next === "active") {
      this.clearStopTimer();
      void this.safeStart();
    } else if (next === "background") {
      this.scheduleStop();
    }
    // "inactive" on iOS is a brief transition; ignore to avoid flapping.
  };

  /** Called when the master toggle changes. Inline-reconciles the current
   *  (master toggle, AppState) pair. */
  private reconcile(): void {
    const wantsNetwork = useNetworkPreferenceStore.getState().userWantsNetwork;
    if (!wantsNetwork) {
      this.clearStopTimer();
      void this.safeStop();
      return;
    }
    if (AppState.currentState === "active") {
      this.clearStopTimer();
      void this.safeStart();
    } else {
      this.scheduleStop();
    }
  }

  private scheduleStop(): void {
    if (this.stopTimer !== null) return;
    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      void this.safeStop();
    }, BACKGROUND_STOP_DELAY_MS);
  }

  private clearStopTimer(): void {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private async safeStart(): Promise<void> {
    try {
      await getAppCore().startNetwork();
    } catch (err) {
      // NetworkAlreadyRunning is expected when called on an already-up node.
      const msg = String(err);
      if (!msg.includes("NetworkAlreadyRunning")) {
        console.warn("[network-lifecycle] startNetwork failed:", err);
      }
    }
  }

  private async safeStop(): Promise<void> {
    try {
      await getAppCore().stopNetwork();
    } catch (err) {
      console.warn("[network-lifecycle] stopNetwork failed:", err);
    }
  }
}
