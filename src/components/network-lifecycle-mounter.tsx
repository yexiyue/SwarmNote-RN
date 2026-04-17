import { useEffect } from "react";
import { NetworkLifecycle } from "@/core/network-lifecycle";

/** Side-effect-only component. Mount inside the `(tabs)` branch (i.e. when
 *  `hasOnboarded === true`); onboarding screens control P2P manually and
 *  shouldn't have AppState-driven start/stop interfering. */
export function NetworkLifecycleMounter() {
  useEffect(() => {
    const lifecycle = new NetworkLifecycle();
    lifecycle.start();
    return () => lifecycle.dispose();
  }, []);
  return null;
}
