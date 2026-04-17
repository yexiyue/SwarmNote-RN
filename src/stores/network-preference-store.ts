import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";

interface NetworkPreferenceState {
  /** The Swarm-page master toggle. Persisted across launches;
   *  NetworkLifecycle treats this as the user's authoritative intent
   *  and gates every AppState-driven start/stop on it. */
  userWantsNetwork: boolean;
}

interface NetworkPreferenceActions {
  setUserWantsNetwork(next: boolean): void;
}

export const useNetworkPreferenceStore = create<
  NetworkPreferenceState & NetworkPreferenceActions
>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        userWantsNetwork: true,
        setUserWantsNetwork: (userWantsNetwork) => set({ userWantsNetwork }),
      }),
      {
        name: "swarmnote-network-preference",
        storage: createJSONStorage(() => AsyncStorage),
      },
    ),
  ),
);
