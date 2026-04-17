import { useEffect, useState } from "react";

/** Count down to `expiresAt` at 1s cadence. Returns remaining seconds
 *  (0 once expired). The `onExpire` callback fires exactly once when
 *  the countdown first hits zero. */
export function useExpiresCountdown(
  expiresAt: Date | null | undefined,
  onExpire?: () => void,
): number {
  const [remaining, setRemaining] = useState(() => computeRemaining(expiresAt));

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0);
      return;
    }

    setRemaining(computeRemaining(expiresAt));
    let id: ReturnType<typeof setInterval>;

    const tick = () => {
      const next = computeRemaining(expiresAt);
      setRemaining(next);
      if (next <= 0) {
        onExpire?.();
        clearInterval(id);
      }
    };

    id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  return remaining;
}

function computeRemaining(expiresAt: Date | null | undefined): number {
  if (!expiresAt) return 0;
  const delta = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return Math.max(0, delta);
}
