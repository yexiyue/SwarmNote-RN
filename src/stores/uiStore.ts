import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { activateLocale, detectLocale, type Locale } from "@/i18n";

interface UIState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      locale: detectLocale(),

      setLocale: (locale) => {
        activateLocale(locale).then(
          () => set({ locale }),
          (err) => console.error("Failed to activate locale:", err),
        );
      },
    }),
    {
      name: "swarmnote-ui-mobile",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        // App 冷启动时恢复用户上次选择的语言
        if (state) {
          activateLocale(state.locale).catch(console.error);
        }
      },
    },
  ),
);
