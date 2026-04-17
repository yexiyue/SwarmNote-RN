import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** User path choice; `null` until user picks one.
 *  Mirrors desktop `onboardingStore.userPath`. */
type UserPath = "new" | "add-device" | null;

interface OnboardingState {
  /** Persisted. Routes gate on this. */
  hasOnboarded: boolean;
  /** Persisted. Retained so the user sees the same path-specific flow on
   *  partial re-entry. */
  userPath: UserPath;
  /** Not persisted — reset on app restart. */
  currentStep: number;
  /** Not persisted — reset on app restart. */
  pairedInOnboarding: boolean;
}

interface OnboardingActions {
  nextStep(): void;
  prevStep(): void;
  setUserPath(p: UserPath): void;
  setPairedInOnboarding(v: boolean): void;
  markCompleted(): void;
  reset(): void;
}

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set) => ({
      hasOnboarded: false,
      userPath: null,
      currentStep: 0,
      pairedInOnboarding: false,

      nextStep: () => set((s) => ({ currentStep: s.currentStep + 1 })),
      prevStep: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
      setUserPath: (userPath) => set({ userPath }),
      setPairedInOnboarding: (pairedInOnboarding) => set({ pairedInOnboarding }),
      markCompleted: () => set({ hasOnboarded: true }),
      reset: () =>
        set({
          hasOnboarded: false,
          userPath: null,
          currentStep: 0,
          pairedInOnboarding: false,
        }),
    }),
    {
      name: "swarmnote-onboarding",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ hasOnboarded: s.hasOnboarded, userPath: s.userPath }),
    },
  ),
);

/** Resolve once the onboarding store has hydrated from AsyncStorage.
 *  Root layout must await this before reading `hasOnboarded` for routing. */
export const waitForOnboardingHydration = (): Promise<void> =>
  new Promise((resolve) => {
    if (useOnboardingStore.persist.hasHydrated()) {
      resolve();
      return;
    }
    const unsub = useOnboardingStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
