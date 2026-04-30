import { Trans } from "@lingui/react/macro";
import { useShallow } from "zustand/react/shallow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { useErrorDialogStore } from "@/stores/error-dialog-store";

/** Mounted once at the root layout. Renders the RNR `<AlertDialog>` whenever
 *  `useErrorDialogStore` has an active error pushed by non-React callers
 *  (store actions, event-bus handlers). Single-button "确定" — this dialog
 *  is for must-acknowledge errors only, not for confirmations. */
export function ErrorDialogHost() {
  const { open, title, description, dismiss } = useErrorDialogStore(
    useShallow((s) => ({
      open: s.open,
      title: s.title,
      description: s.description,
      dismiss: s.dismiss,
    })),
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onPress={dismiss}>
            <Text>
              <Trans>确定</Trans>
            </Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
