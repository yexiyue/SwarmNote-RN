import { Redirect } from "expo-router";
import { useOnboardingStore } from "@/stores/onboarding-store";

/** Root redirect: onboarding gate. `_layout.tsx` has already awaited
 *  `waitForOnboardingHydration()`, so `hasOnboarded` is authoritative here. */
export default function Index() {
  const hasOnboarded = useOnboardingStore((s) => s.hasOnboarded);
  // `as never` sidesteps typedRoutes' type-gen which only resolves after
  // `expo start`; routes below exist in the filesystem so runtime is fine.
  return <Redirect href={(hasOnboarded ? "/(tabs)" : "/onboarding/welcome") as never} />;
}
