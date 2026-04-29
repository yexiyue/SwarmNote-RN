import { Platform } from "react-native";
import { ForceUpdateDialog } from "./ForceUpdateDialog";
import { UpdateDialog } from "./UpdateDialog";
import { UpdateProgressDialog } from "./UpdateProgressDialog";

/**
 * Aggregates the three update dialogs. Each dialog reads its own slice of
 * `useUpdateStore` and decides whether to render based on `status`, so we can
 * mount them all and let the store be the single source of truth. iOS skips
 * the host entirely.
 */
export function UpdateHost() {
  if (Platform.OS !== "android") return null;
  return (
    <>
      <UpdateDialog />
      <ForceUpdateDialog />
      <UpdateProgressDialog />
    </>
  );
}
