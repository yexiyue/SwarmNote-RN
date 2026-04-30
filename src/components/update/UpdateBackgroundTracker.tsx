import { useLingui } from "@lingui/react/macro";
import { useEffect } from "react";
import { toast as sonner } from "sonner-native";
import { useShallow } from "zustand/react/shallow";
import { useUpdateStore } from "@/stores/update-store";

const TOAST_ID = "update-background-download";
/** Long enough to outlive any APK download; we dismiss manually when status
 *  flips away from "downloading". Avoid Infinity since sonner-native's
 *  duration semantics around it aren't documented. */
const LONG_DURATION_MS = 60 * 60 * 1000;

/**
 * Mirrors a backgrounded APK download into a sonner toast. Renders nothing —
 * the side effect is the toast itself, kept in sync with `progress.percent`
 * via the stable `id` so sonner-native reuses the same slot instead of
 * stacking a new toast for every progress tick.
 *
 * We bypass `@/lib/toast` here because that wrapper doesn't expose
 * `toast.loading` (intentional — loading toasts are reserved for promise
 * flows). This tracker manually owns the toast lifecycle.
 */
export function UpdateBackgroundTracker() {
  const { t } = useLingui();
  const { status, percent, backgrounded } = useUpdateStore(
    useShallow((s) => ({
      status: s.status,
      percent: s.progress?.percent ?? 0,
      backgrounded: s.backgrounded,
    })),
  );

  const active = backgrounded && status === "downloading";

  useEffect(() => {
    if (!active) {
      sonner.dismiss(TOAST_ID);
      return;
    }
    sonner.loading(t`正在下载新版本 · ${percent}%`, {
      id: TOAST_ID,
      duration: LONG_DURATION_MS,
    });
    return () => {
      sonner.dismiss(TOAST_ID);
    };
  }, [active, percent, t]);

  return null;
}
