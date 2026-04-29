/**
 * Android APK installer.
 *
 * Downloads an APK to the cache directory, then hands the resulting
 * `content://` URI to the system PackageInstaller via `IntentLauncher`.
 * The user still sees a system "install new version?" confirmation —
 * Android does not allow third-party apps to install silently.
 */

// `createDownloadResumable` / `getContentUriAsync` are only on the legacy
// surface in expo-file-system v18+. The OOP `File` API does not yet expose
// progress callbacks or content:// URI helpers, so we keep using the legacy
// imports here and let project code continue using the new API elsewhere.
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export interface DownloadHandle {
  cancel(): Promise<void>;
}

export class UpdateNotSupportedOnIosError extends Error {
  constructor() {
    super("In-app updates are not supported on iOS");
    this.name = "UpdateNotSupportedOnIosError";
  }
}

function apkPath(): string {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error("FileSystem.cacheDirectory unavailable");
  return `${cacheDir}swarmnote-update.apk`;
}

/**
 * Download the APK with progress reporting and trigger the system installer.
 *
 * Resolves once the install intent has been dispatched. The actual install
 * confirmation happens in the system UI; control returns to the app only
 * if the user backs out.
 */
export async function downloadAndInstallApk(
  url: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<DownloadHandle> {
  if (Platform.OS !== "android") {
    throw new UpdateNotSupportedOnIosError();
  }

  const target = apkPath();

  // Clear any previous partial download to avoid resume conflicts.
  const info = await FileSystem.getInfoAsync(target);
  if (info.exists) {
    await FileSystem.deleteAsync(target, { idempotent: true });
  }

  const resumable = FileSystem.createDownloadResumable(url, target, {}, (p) => {
    if (!onProgress) return;
    const total = p.totalBytesExpectedToWrite;
    const downloaded = p.totalBytesWritten;
    const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
    onProgress({ downloaded, total, percent });
  });

  const handle: DownloadHandle = {
    async cancel() {
      try {
        await resumable.cancelAsync();
      } catch {
        // ignore — the download may have already finished
      }
    },
  };

  const result = await resumable.downloadAsync();
  if (!result?.uri) {
    throw new Error("Download produced no file");
  }

  const contentUri = await FileSystem.getContentUriAsync(result.uri);

  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    type: "application/vnd.android.package-archive",
    flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
  });

  return handle;
}
