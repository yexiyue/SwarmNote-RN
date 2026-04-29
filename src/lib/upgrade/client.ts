/**
 * UpgradeLink HTTP API client (Android only).
 *
 * Mirrors the desktop SwarmDrop integration but runs entirely with Expo
 * primitives so no native bridge is needed. The API requires every request
 * to be signed with `md5(body=...&nonce=...&secretKey=...&timestamp=...&url=...)`.
 *
 * The accessKey/accessSecret/apkKey are embedded into the JS bundle through
 * `EXPO_PUBLIC_*` env vars at build time. This is the same trade-off made on
 * desktop — the secret only authorizes anonymous query / report endpoints,
 * never publish operations.
 */

import * as Crypto from "expo-crypto";

const ENDPOINT = "https://api.upgrade.toolsetlink.com";
const PATH = "/v1/apk/upgrade";

const ACCESS_KEY = process.env.EXPO_PUBLIC_UPGRADELINK_ACCESS_KEY ?? "";
const ACCESS_SECRET = process.env.EXPO_PUBLIC_UPGRADELINK_ACCESS_SECRET ?? "";
const APK_KEY = process.env.EXPO_PUBLIC_UPGRADELINK_APK_KEY ?? "";

export type UpgradeType = "force" | "prompt" | "silent" | null;

export interface AndroidUpdateResult {
  hasUpdate: boolean;
  versionName: string | null;
  versionCode: number;
  upgradeType: UpgradeType;
  downloadUrl: string | null;
  promptContent: string | null;
}

const NO_UPDATE: AndroidUpdateResult = {
  hasUpdate: false,
  versionName: null,
  versionCode: 0,
  upgradeType: null,
  downloadUrl: null,
  promptContent: null,
};

/**
 * UpgradeLink upgradeType:
 *   0 = no upgrade
 *   1 = prompt upgrade (default fallback)
 *   2 = force upgrade
 *   3 = silent (Android cannot truly silent-install; downgraded to prompt)
 */
export function parseUpgradeType(raw: unknown): UpgradeType {
  switch (raw) {
    case 2:
      return "force";
    case 3:
      return "silent";
    case 1:
      return "prompt";
    default:
      return "prompt";
  }
}

export function semverToVersionCode(version: string): number {
  const parts = version.replace(/^v/, "").split(".");
  const major = Number.parseInt(parts[0] ?? "0", 10);
  const minor = Number.parseInt(parts[1] ?? "0", 10);
  const patch = Number.parseInt(parts[2] ?? "0", 10);
  return major * 10000 + minor * 1000 + patch;
}

export function versionCodeToSemver(versionCode: number): string {
  const major = Math.floor(versionCode / 10000);
  const minor = Math.floor((versionCode % 10000) / 1000);
  const patch = versionCode % 1000;
  return `${major}.${minor}.${patch}`;
}

export function isUpgradeLinkConfigured(): boolean {
  return ACCESS_KEY !== "" && ACCESS_SECRET !== "" && APK_KEY !== "";
}

async function generateNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(8);
  return Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
}

async function generateSignature(
  body: string,
  nonce: string,
  secretKey: string,
  timestamp: string,
  uri: string,
): Promise<string> {
  const parts: string[] = [];
  if (body !== "") parts.push(`body=${body}`);
  parts.push(`nonce=${nonce}`, `secretKey=${secretKey}`, `timestamp=${timestamp}`, `url=${uri}`);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, parts.join("&"));
}

export async function checkAndroidUpdate(
  currentVersionCode: number,
  deviceId = "",
): Promise<AndroidUpdateResult> {
  if (!isUpgradeLinkConfigured()) {
    console.warn("[upgrade] UpgradeLink credentials not configured, skipping check");
    return NO_UPDATE;
  }

  try {
    const body = JSON.stringify({
      apkKey: APK_KEY,
      versionCode: currentVersionCode,
      appointVersionCode: 0,
      devModelKey: "",
      devKey: deviceId,
    });

    const timestamp = new Date().toISOString();
    const nonce = await generateNonce();
    const signature = await generateSignature(body, nonce, ACCESS_SECRET, timestamp, PATH);

    const res = await fetch(`${ENDPOINT}${PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-Timestamp": timestamp,
        "x-Nonce": nonce,
        "x-AccessKey": ACCESS_KEY,
        "x-Signature": signature,
      },
      body,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = (await res.json()) as {
      code: number;
      data?: {
        versionName?: string;
        versionCode?: number;
        urlPath?: string;
        upgradeType?: number;
        promptUpgradeContent?: string;
      };
    };

    if (result.code !== 200 || !result.data) {
      return NO_UPDATE;
    }

    const remoteVersionCode = result.data.versionCode ?? 0;
    if (remoteVersionCode <= currentVersionCode) {
      return NO_UPDATE;
    }

    return {
      hasUpdate: true,
      versionName: result.data.versionName ?? null,
      versionCode: remoteVersionCode,
      upgradeType: parseUpgradeType(result.data.upgradeType),
      downloadUrl: result.data.urlPath ?? null,
      promptContent: result.data.promptUpgradeContent ?? null,
    };
  } catch (err) {
    console.warn("[upgrade] Failed to check Android update:", err);
    return NO_UPDATE;
  }
}
