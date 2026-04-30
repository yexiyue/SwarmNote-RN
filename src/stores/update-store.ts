/**
 * Android in-app update state machine.
 *
 *      ┌──────┐ checkForUpdate                    executeUpdate
 *      │ idle │──────────▶ checking ──┬─▶ up-to-date               ┌──▶ ready
 *      └──────┘                       │                            │
 *          ▲                          ├─▶ available ─────────────▶ │
 *          │ reset                    └─▶ force-required ────────▶ │ downloading
 *          │                                                       │
 *          │                                                       └─▶ error
 *          └────────── from any state via reset()
 *
 * iOS:`Platform.OS !== 'android'` → checkForUpdate() is a no-op,
 * status stays 'idle' so the dialogs never mount.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { create } from "zustand";
import {
  type AndroidUpdateResult,
  checkAndroidUpdate,
  semverToVersionCode,
  type UpgradeType,
} from "@/lib/upgrade/client";
import { type DownloadProgress, downloadAndInstallApk } from "@/lib/upgrade/installer";

const DISMISS_KEY = "update-dismiss";
const RECHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "force-required"
  | "downloading"
  | "ready"
  | "error";

interface DismissRecord {
  tag: string;
  dismissedAt: number;
}

interface UpdateState {
  status: UpdateStatus;
  upgradeType: UpgradeType;
  latestVersion: string | null;
  currentVersion: string | null;
  promptContent: string | null;
  releaseNotes: string | null;
  downloadUrl: string | null;
  progress: DownloadProgress | null;
  error: string | null;
  hasChecked: boolean;
  lastCheckedAt: number;
  /** True after user dismissed the foreground progress dialog and chose to
   *  continue downloading in the background. UI uses this to swap the dialog
   *  for a toast tracker. Reset to false on every executeUpdate() call. */
  backgrounded: boolean;

  checkForUpdate(force?: boolean): Promise<void>;
  executeUpdate(): Promise<void>;
  /** Dismiss the foreground progress dialog without aborting the download. */
  backgroundDownload(): void;
  /** Acknowledge an error after the user reads it; flips status back to
   *  "available" so the user can retry from the original dialog. */
  acknowledgeError(): void;
  dismiss(): Promise<void>;
  reset(): void;
  setupAppStateListener(): () => void;
}

async function readDismiss(): Promise<DismissRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DismissRecord;
    if (typeof parsed.tag !== "string" || typeof parsed.dismissedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeDismiss(tag: string): Promise<void> {
  try {
    const record: DismissRecord = { tag, dismissedAt: Date.now() };
    await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(record));
  } catch (err) {
    console.warn("[update] failed to persist dismiss", err);
  }
}

export const useUpdateStore = create<UpdateState>()((set, get) => ({
  status: "idle",
  upgradeType: null,
  latestVersion: null,
  currentVersion: null,
  promptContent: null,
  releaseNotes: null,
  downloadUrl: null,
  progress: null,
  error: null,
  hasChecked: false,
  lastCheckedAt: 0,
  backgrounded: false,

  async checkForUpdate(force = false) {
    if (Platform.OS !== "android") return;

    const { status, lastCheckedAt } = get();
    if (status === "checking" || status === "downloading") return;
    if (!force && lastCheckedAt > 0 && Date.now() - lastCheckedAt < RECHECK_INTERVAL_MS) {
      return;
    }

    set({ status: "checking", error: null });

    const currentVersion = Constants.expoConfig?.version ?? "0.0.0";
    const currentVersionCode = semverToVersionCode(currentVersion);

    let result: AndroidUpdateResult;
    try {
      result = await checkAndroidUpdate(currentVersionCode);
    } catch (err) {
      console.warn("[update] check failed", err);
      set({
        status: "up-to-date",
        currentVersion,
        hasChecked: true,
        lastCheckedAt: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const updates: Partial<UpdateState> = {
      currentVersion,
      hasChecked: true,
      lastCheckedAt: Date.now(),
    };

    if (!result.hasUpdate) {
      set({ ...updates, status: "up-to-date" });
      return;
    }

    // Force-update path bypasses the dismiss cache.
    if (result.upgradeType !== "force") {
      const dismiss = await readDismiss();
      if (
        dismiss &&
        dismiss.tag === result.versionName &&
        Date.now() - dismiss.dismissedAt < DISMISS_TTL_MS
      ) {
        set({ ...updates, status: "up-to-date" });
        return;
      }
    }

    set({
      ...updates,
      status: result.upgradeType === "force" ? "force-required" : "available",
      upgradeType: result.upgradeType,
      latestVersion: result.versionName,
      downloadUrl: result.downloadUrl,
      promptContent: result.promptContent,
      releaseNotes: result.promptContent,
    });
  },

  async executeUpdate() {
    const { status, downloadUrl } = get();
    if (status !== "available" && status !== "force-required") return;
    if (!downloadUrl) {
      set({ status: "error", error: "No download URL available" });
      return;
    }

    set({
      status: "downloading",
      backgrounded: false,
      progress: { downloaded: 0, total: 0, percent: 0 },
    });

    try {
      await downloadAndInstallApk(downloadUrl, (progress) => {
        set({ progress });
      });
      // Once the install intent fires, control passes to the system UI.
      // If the user accepts, the app process is replaced; if they back out,
      // the next checkForUpdate call will surface the prompt again.
      set({ status: "ready" });
    } catch (err) {
      console.error("[update] install failed", err);
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  backgroundDownload() {
    if (get().status !== "downloading") return;
    set({ backgrounded: true });
  },

  acknowledgeError() {
    if (get().status !== "error") return;
    // Drop back to "available" so the original update prompt can re-fire and
    // the user can hit "立即更新" again. If the original status was
    // "force-required", landing on "available" still surfaces the optional
    // dialog — acceptable since the underlying upgradeType is unchanged and
    // the next executeUpdate() will re-evaluate from `downloadUrl`.
    set({ status: "available", error: null, progress: null, backgrounded: false });
  },

  async dismiss() {
    const { latestVersion, upgradeType } = get();
    if (upgradeType === "force") return; // force-update cannot be dismissed
    // Update UI synchronously; persist in the background to keep the dialog
    // closing instant. AsyncStorage failures only affect the next launch and
    // are already swallowed inside writeDismiss.
    set({ status: "up-to-date" });
    if (latestVersion) {
      void writeDismiss(latestVersion);
    }
  },

  reset() {
    set({
      status: "idle",
      upgradeType: null,
      latestVersion: null,
      currentVersion: null,
      promptContent: null,
      releaseNotes: null,
      downloadUrl: null,
      progress: null,
      error: null,
      hasChecked: false,
      lastCheckedAt: 0,
      backgrounded: false,
    });
  },

  setupAppStateListener() {
    const handler = (state: AppStateStatus) => {
      if (state !== "active") return;
      void get().checkForUpdate();
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  },
}));
