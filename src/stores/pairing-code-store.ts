/**
 * Pairing Code Store
 *
 * 全局单例的配对码管理，对齐 SwarmDrop / SwarmNote 桌面：
 *   - 跨 onboarding ↔ settings ↔ 关闭重开持久化
 *   - 过期前 500ms 自动续生（避免 UI 闪 "已过期"）
 *   - 被消耗后（PairedDeviceAdded 事件且本端有 activeCode）自动续生
 *
 * 后端 share code 单例设计：reject 不消耗码；仅 accept 后端触发 PairedDeviceAdded
 * 事件，event-bus 在收到时调 markConsumed 触发续生。
 */

import type { UniffiPairingCodeInfo } from "react-native-swarmnote-core";
import { create } from "zustand";
import { getAppCore } from "@/core/app-core";

const TTL_SECS = 600n;

interface PairingCodeState {
  codeInfo: UniffiPairingCodeInfo | null;
  generating: boolean;
  error: string | null;

  ensure(): Promise<void>;
  regenerate(): Promise<void>;
  clear(): void;
  markConsumed(): void;
}

let autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (autoRefreshTimer !== null) {
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function scheduleRefresh(info: UniffiPairingCodeInfo) {
  clearTimer();
  // UniffiTimestamp = Date（ubrn 把 chrono::DateTime 映射成 JS Date）
  const ms = Math.max(0, info.expiresAt.getTime() - Date.now() - 500);
  autoRefreshTimer = setTimeout(() => {
    autoRefreshTimer = null;
    if (usePairingCodeStore.getState().codeInfo !== null) {
      void usePairingCodeStore.getState().regenerate();
    }
  }, ms);
}

function isExpired(info: UniffiPairingCodeInfo): boolean {
  return info.expiresAt.getTime() <= Date.now();
}

async function doGenerate(): Promise<void> {
  usePairingCodeStore.setState({ generating: true, error: null });
  try {
    const info = await getAppCore().generatePairingCode(TTL_SECS);
    usePairingCodeStore.setState({
      codeInfo: info,
      generating: false,
      error: null,
    });
    scheduleRefresh(info);
  } catch (err) {
    clearTimer();
    usePairingCodeStore.setState({
      codeInfo: null,
      generating: false,
      error: err instanceof Error ? err.message : String(err),
    });
    console.warn("[pairing-code] generate failed:", err);
  }
}

export const usePairingCodeStore = create<PairingCodeState>()(() => ({
  codeInfo: null,
  generating: false,
  error: null,

  async ensure() {
    const { codeInfo, generating } = usePairingCodeStore.getState();
    if (generating) return;
    if (codeInfo !== null && !isExpired(codeInfo)) return;
    await doGenerate();
  },

  async regenerate() {
    if (usePairingCodeStore.getState().generating) return;
    await doGenerate();
  },

  clear() {
    clearTimer();
    usePairingCodeStore.setState({ codeInfo: null, error: null });
  },

  markConsumed() {
    // 仅在有活跃码时续生；无码 = 用户没在用配对码功能，不主动生成
    if (usePairingCodeStore.getState().codeInfo !== null) {
      void doGenerate();
    }
  },
}));
