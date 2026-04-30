import { Platform } from "react-native";
import { ForceUpdateDialog } from "./ForceUpdateDialog";
import { UpdateBackgroundTracker } from "./UpdateBackgroundTracker";
import { UpdateDialog } from "./UpdateDialog";
import { UpdateErrorDialog } from "./UpdateErrorDialog";
import { UpdateProgressDialog } from "./UpdateProgressDialog";

/**
 * Aggregates the update UI surface. Each child reads its own slice of
 * `useUpdateStore` and gates its rendering by `status` (and `backgrounded`
 * for the progress pair), so they can all be mounted side-by-side and the
 * store stays the single source of truth. iOS skips the host entirely.
 */
export function UpdateHost() {
  if (Platform.OS !== "android") return null;
  return (
    <>
      <UpdateDialog />
      <ForceUpdateDialog />
      <UpdateProgressDialog />
      <UpdateBackgroundTracker />
      <UpdateErrorDialog />
    </>
  );
}
