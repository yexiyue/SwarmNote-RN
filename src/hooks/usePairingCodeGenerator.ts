import { useCallback, useState } from "react";
import { getAppCore } from "@/core/app-core";

const PAIRING_CODE_TTL_SECS = 600n;

/** State + action pair for "generate a 6-digit pairing code" —
 *  shared between the Onboarding Pairing step and the Swarm tab so the
 *  TTL constant and error handling stay in one place. */
export function usePairingCodeGenerator() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const info = await getAppCore().generatePairingCode(PAIRING_CODE_TTL_SECS);
      setCode(info.code);
      setExpiresAt(info.expiresAt);
    } catch (err) {
      console.warn("[pairing] generatePairingCode failed:", err);
    } finally {
      setGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setCode(null);
    setExpiresAt(null);
  }, []);

  return { code, expiresAt, generating, generate, reset };
}
