import * as Haptics from "expo-haptics";
import { toast as sonner } from "sonner-native";
import { errorMessage } from "./utils";

interface BaseOptions {
  description?: string;
  duration?: number;
}

interface PromiseOptions<T> {
  loading: string;
  success: (result: T) => string;
  error: ((err: unknown) => string) | string;
  duration?: number;
}

function triggerErrorHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export const toast = {
  success(message: string, opts?: BaseOptions) {
    return sonner.success(message, opts);
  },

  info(message: string, opts?: BaseOptions) {
    return sonner.info(message, opts);
  },

  /** Pass `err` to expand `errorMessage(err)` into the description. */
  error(message: string, err?: unknown) {
    triggerErrorHaptic();
    return sonner.error(
      message,
      err === undefined ? undefined : { description: errorMessage(err) },
    );
  },

  promise<T>(promise: Promise<T>, opts: PromiseOptions<T>) {
    return sonner.promise(promise, opts);
  },
};
