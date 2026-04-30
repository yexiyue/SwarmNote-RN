import { useLingui } from "@lingui/react/macro";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "@/lib/toast";
import { useUpdateStore } from "@/stores/update-store";

/**
 * Mirrors a backgrounded APK download into a single-slot toast. Renders
 * nothing — re-issues `toast.loading` on every progress tick; Notifier's
 * `queueMode: 'reset'` replaces the visible toast in place.
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
      toast.dismiss();
      return;
    }
    toast.loading(t`正在下载新版本 · ${percent}%`);
    return () => {
      toast.dismiss();
    };
  }, [active, percent, t]);

  return null;
}
