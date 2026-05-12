import {
  DEFAULT_SELECTION_FORMATTING,
  type EditorEvent,
  EditorEventType,
  type SelectionFormatting,
} from "@swarmnote/editor-web/contracts";
import { useCallback, useState } from "react";

interface EditorFormattingBridge {
  formatting: SelectionFormatting;
  /** Drop-in replacement for the original `onEditorEvent` prop:
   *  intercepts `SelectionFormattingChange` and forwards every other event
   *  to the upstream caller untouched. */
  handleEditorEvent: (event: EditorEvent) => void;
}

export function useEditorFormatting(
  onEditorEvent?: (event: EditorEvent) => void,
): EditorFormattingBridge {
  const [formatting, setFormatting] = useState<SelectionFormatting>(DEFAULT_SELECTION_FORMATTING);

  const handleEditorEvent = useCallback(
    (event: EditorEvent) => {
      if (event.kind === EditorEventType.SelectionFormattingChange) {
        setFormatting(event.formatting);
      }
      onEditorEvent?.(event);
    },
    [onEditorEvent],
  );

  return { formatting, handleEditorEvent };
}
