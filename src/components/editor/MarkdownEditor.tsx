import type { EditorEvent } from "@swarmnote/editor/events";
import { DEFAULT_SETTINGS } from "@swarmnote/editor/types";
import type { EditorInitOptions } from "@swarmnote/editor-web";
import { Asset } from "expo-asset";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import WebView from "react-native-webview";
import { clear as clearBridge, register as registerBridge } from "@/core/editor-bridge-registry";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useEditorBridge } from "./useEditorBridge";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EDITOR_HTML_MODULE = require("@swarmnote/editor-web/dist/index.html");

interface MarkdownEditorProps {
  /** Fallback text-mode content. Used only when `docUuid` is not provided. */
  initialText?: string;
  /** When provided together with `initialState`, switches to collaboration
   *  mode backed by a Y.Doc seeded with `initialState`. */
  docUuid?: string;
  /** Full Y.Doc v1 update bytes returned by `workspace.openDoc`. Applied to
   *  the in-WebView Y.Doc via `applyRemoteCollaborationUpdate` (REMOTE origin,
   *  so it will NOT fire back as a local CollaborationUpdate). */
  initialState?: Uint8Array;
  /** Called with each local Y.Doc update the editor produces. Caller forwards
   *  to `workspace.applyUpdate(docUuid, update)` for writeback. */
  onCollabUpdate?: (update: Uint8Array) => void;
  /** Non-collab editor events (Change, Focus, Blur, SearchStateChange …).
   *  CollaborationUpdate is filtered out — it goes through `onCollabUpdate`. */
  onEditorEvent?: (event: EditorEvent) => void;
  /** Legacy toggle for callers that want a Y.Doc without a seeded state
   *  (editor-test.tsx). Ignored when `docUuid` is provided. */
  enableYjs?: boolean;
}

export function MarkdownEditor({
  initialText = "",
  docUuid,
  initialState,
  onCollabUpdate,
  onEditorEvent,
  enableYjs = false,
}: MarkdownEditorProps) {
  const webviewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [editorCreated, setEditorCreated] = useState(false);

  const collabMode = docUuid !== undefined && initialState !== undefined;

  useEffect(() => {
    let cancelled = false;
    const asset = Asset.fromModule(EDITOR_HTML_MODULE);
    asset.localUri = null;
    (asset as unknown as { downloaded: boolean }).downloaded = false;
    asset
      .downloadAsync()
      .then(() => {
        if (!cancelled && asset.localUri) {
          setHtmlUri(asset.localUri);
        }
      })
      .catch((err) => {
        console.error("[Editor] HTML asset download failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCollaborationUpdate = useCallback(
    (update: Uint8Array) => {
      onCollabUpdate?.(update);
    },
    [onCollabUpdate],
  );

  const { editorApi, setWebViewRef, onWebViewMessage } = useEditorBridge({
    onRuntimeReady() {
      setRuntimeReady(true);
    },
    onEditorEvent,
    onCollaborationUpdate: handleCollaborationUpdate,
  });

  const handleRef = useCallback(
    (ref: WebView | null) => {
      if (!ref) {
        setRuntimeReady(false);
        setEditorCreated(false);
      }
      (webviewRef as React.MutableRefObject<WebView | null>).current = ref;
      setWebViewRef(ref ? { injectJavaScript: (js: string) => ref.injectJavaScript(js) } : null);
    },
    [setWebViewRef],
  );

  const colorScheme = useColorScheme();
  const appearance = colorScheme === "dark" ? "dark" : "light";
  const workspacePath = useWorkspaceStore((s) => s.info?.path);

  const options: EditorInitOptions = useMemo(
    () => ({
      // In collab mode the initial text comes from Y.Doc state (applied just
      // after createEditor), so seed an empty string.
      initialText: collabMode ? "" : initialText,
      settings: {
        ...DEFAULT_SETTINGS,
        theme: { appearance },
      },
      collaboration:
        collabMode || enableYjs
          ? {
              ydoc: {},
              fragmentName: "document",
            }
          : undefined,
      workspacePath,
    }),
    [appearance, collabMode, enableYjs, initialText, workspacePath],
  );

  useEffect(() => {
    if (!editorApi || !editorCreated) return;
    void editorApi.updateSettings({ theme: { appearance } });
  }, [appearance, editorApi, editorCreated]);

  useEffect(() => {
    if (!editorApi || !runtimeReady || editorCreated) return;

    let cancelled = false;
    void (async () => {
      try {
        await editorApi.createEditor(options);
        if (cancelled) return;

        // Seed Y.Doc from `open_doc`'s yjs_state. Using the REMOTE origin
        // ensures y-codemirror.next does NOT fire a CollaborationUpdate back
        // to us for this initial application (see editor-runtime.ts:88-91).
        if (collabMode && initialState) {
          await editorApi.applyRemoteCollaborationUpdate(initialState);
          if (cancelled) return;
        }

        setEditorCreated(true);
        await editorApi.focus();
      } catch (err) {
        console.error("[Editor] createEditor failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editorApi, editorCreated, options, runtimeReady, collabMode, initialState]);

  // Register with the bridge registry so `event-bus` can push remote updates
  // into this editor. Only meaningful in collab mode.
  useEffect(() => {
    if (!collabMode || !editorCreated || !editorApi || docUuid === undefined) return;
    const apply = (update: Uint8Array) => {
      void editorApi.applyRemoteCollaborationUpdate(update);
    };
    registerBridge(docUuid, apply);
    return () => {
      clearBridge(docUuid);
    };
  }, [collabMode, editorCreated, editorApi, docUuid]);

  useEffect(() => {
    return () => {
      if (!editorApi) return;
      void editorApi.destroyEditor();
    };
  }, [editorApi]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      onWebViewMessage(event);
    },
    [onWebViewMessage],
  );

  if (!htmlUri) {
    return <View className="flex-1" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={handleRef}
        source={{ uri: htmlUri }}
        originWhitelist={["file://*", "https://*", "data:*"]}
        onMessage={handleMessage}
        style={{ flex: 1, opacity: 0.99 }}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        scrollEnabled
        nestedScrollEnabled
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />
    </View>
  );
}
