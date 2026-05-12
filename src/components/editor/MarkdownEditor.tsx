import {
  type AwarenessUserState,
  DEFAULT_EDITOR_SETTINGS,
  type EditorEvent,
  type EditorInitOptions,
} from "@swarmnote/editor-web/contracts";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, useColorScheme, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { WebViewMessageEvent } from "react-native-webview";
import WebView from "react-native-webview";
import {
  clearAwareness as clearAwarenessBridge,
  clear as clearBridge,
  registerAwareness as registerAwarenessBridge,
  register as registerBridge,
} from "@/core/editor-bridge-registry";
import { colorForDevice } from "@/lib/awareness-color";
import { useOptionalWorkspace } from "@/providers/workspace-provider";
import { useCurrentDocStore } from "@/stores/current-doc-store";
import { useEditorPresenceStore } from "@/stores/editor-presence-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  EditorHeadingSheet,
  type EditorHeadingSheetRef,
  type HeadingLevel,
} from "./EditorHeadingSheet";
import { EditorToolbar } from "./EditorToolbar";
import { useEditorBridge } from "./useEditorBridge";
import { useEditorFormatting } from "./useEditorFormatting";

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

// Toolbar 48 + gap 8.
const TOOLBAR_OVERLAY_PX = 56;
// BottomCommandBar 52 + float gap 16.
const BOTTOM_BAR_OVERLAY_PX = 68;

// Pre-editor bootstrap fallback. Padding goes on `.cm-content` (the scrolled
// element) — Chromium #879745 prevents padding-bottom on `.cm-scroller`
// (overflow:auto container) from being scrolled into view. NO !important:
// once the editor mounts, `setScrollBottomMargin` writes inline style via
// `EditorView.contentAttributes` (specificity 1000) and must win over this
// selector rule (specificity 10).
const CONTENT_BOTTOM_PADDING_PX = BOTTOM_BAR_OVERLAY_PX + 2;
const INJECTED_BOTTOM_PADDING_CSS = `
(function () {
  var id = '__swarmnote_content_bottom_padding__';
  if (document.getElementById(id)) return;
  var style = document.createElement('style');
  style.id = id;
  style.textContent = '.cm-content { padding-bottom: ${CONTENT_BOTTOM_PADDING_PX}px; }';
  document.head.appendChild(style);
})();
true;
`;

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
  /** Called with each local Awareness update the editor publishes. Caller
   *  forwards to `workspace.broadcastAwareness(docUuid, update)`. */
  onAwarenessUpdate?: (update: Uint8Array) => void;
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
  onAwarenessUpdate,
  onEditorEvent,
  enableYjs = false,
}: MarkdownEditorProps) {
  const webviewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [editorCreated, setEditorCreated] = useState(false);
  const setPresence = useEditorPresenceStore((s) => s.setPresence);
  const clearPresence = useEditorPresenceStore((s) => s.clear);

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

  const handleAwarenessUpdate = useCallback(
    (update: Uint8Array) => {
      onAwarenessUpdate?.(update);
    },
    [onAwarenessUpdate],
  );

  const handlePresenceChange = useCallback(
    (users: AwarenessUserState[]) => {
      setPresence(users);
    },
    [setPresence],
  );

  // Intercepts SelectionFormattingChange to drive the toolbar's button state.
  // Forwards every other event to the upstream `onEditorEvent` prop untouched.
  const { formatting, handleEditorEvent } = useEditorFormatting(onEditorEvent);

  const { editorApi, setWebViewRef, onWebViewMessage } = useEditorBridge({
    onRuntimeReady() {
      setRuntimeReady(true);
    },
    onEditorEvent: handleEditorEvent,
    onCollaborationUpdate: handleCollaborationUpdate,
    onAwarenessUpdate: handleAwarenessUpdate,
    onPresenceChange: handlePresenceChange,
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
        ...DEFAULT_EDITOR_SETTINGS,
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
    const applyAwareness = (update: Uint8Array) => {
      void editorApi.applyRemoteAwarenessUpdate(update);
    };
    registerBridge(docUuid, apply);
    registerAwarenessBridge(docUuid, applyAwareness);
    return () => {
      clearBridge(docUuid);
      clearAwarenessBridge(docUuid);
    };
  }, [collabMode, editorCreated, editorApi, docUuid]);

  // Seed local user state for awareness once the editor is up. Color is
  // derived from peer_id so it stays stable across sessions and matches what
  // the desktop / other peers compute independently.
  useEffect(() => {
    if (!collabMode || !editorCreated || !editorApi) return;
    let cancelled = false;
    void (async () => {
      try {
        const { getAppCore } = await import("@/core/app-core");
        const info = await getAppCore().deviceInfo();
        if (cancelled) return;
        await editorApi.setLocalUserState({
          name: info.deviceName,
          platform: "mobile",
          deviceId: info.peerId,
          color: colorForDevice(info.peerId),
        });
      } catch (err) {
        console.warn("[MarkdownEditor] setLocalUserState failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collabMode, editorCreated, editorApi]);

  useEffect(() => {
    return () => {
      if (!editorApi) return;
      void editorApi.destroyEditor();
      clearPresence();
    };
  }, [editorApi, clearPresence]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      onWebViewMessage(event);
    },
    [onWebViewMessage],
  );

  const activeWorkspace = useOptionalWorkspace();
  const noteRelPath = useCurrentDocStore((s) => s.relPath);
  const insets = useSafeAreaInsets();
  const { isVisible: keyboardVisible, height: keyboardHeight } = useKeyboardState();

  // Push the bottom scroll margin to CM whenever the obscured-region height
  // changes — keyboard show/hide, safe-area changes, or editor (re)creation.
  // CM uses this to keep the cursor above the toolbar/keyboard during
  // scrollIntoView (e.g. typing on the last line, cursor jumps).
  useEffect(() => {
    if (!editorApi || !editorCreated) return;
    const margin = keyboardVisible
      ? keyboardHeight + TOOLBAR_OVERLAY_PX
      : insets.bottom + BOTTOM_BAR_OVERLAY_PX;
    void editorApi.setScrollBottomMargin(margin);
  }, [editorApi, editorCreated, keyboardVisible, keyboardHeight, insets.bottom]);

  const headingSheetRef = useRef<EditorHeadingSheetRef>(null);

  const handleRequestHeading = useCallback(() => {
    // Keyboard.dismiss() only collapses the RN keyboard owner. The actual
    // IME is owned by the WebView's contentEditable, so we must also blur
    // the editor to make the IME slide away.
    Keyboard.dismiss();
    void editorApi?.blur();
    headingSheetRef.current?.present();
  }, [editorApi]);

  const handleSelectHeading = useCallback(
    (level: HeadingLevel) => {
      if (!editorApi) return;
      const current = formatting.heading;

      if (level === 0) {
        // Clear: toggleHeading at the current level toggles the prefix off.
        if (current >= 1) void editorApi.execCommand("toggleHeading", current);
      } else if (level !== current) {
        void editorApi.execCommand("toggleHeading", level);
      }
    },
    [editorApi, formatting.heading],
  );

  const handleRequestInsertImage = useCallback(async () => {
    if (!editorApi || activeWorkspace === null || noteRelPath === null) return;

    // Blur the editor so the IME collapses before the system picker shows.
    Keyboard.dismiss();
    void editorApi.blur();

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];

    const fileName = asset.fileName ?? `image-${Date.now()}.png`;
    const alt = stripExtension(fileName);

    try {
      const file = new File(asset.uri);
      const bytes = await file.bytes();
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;

      const relPath = await activeWorkspace.saveMedia(noteRelPath, fileName, arrayBuffer);
      await editorApi.execCommand("insertImage", relPath, alt);
    } catch (err) {
      console.error("[MarkdownEditor] image insert failed:", err);
    }
  }, [editorApi, activeWorkspace, noteRelPath]);

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
        injectedJavaScript={INJECTED_BOTTOM_PADDING_CSS}
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
      {editorApi && editorCreated ? (
        <EditorToolbar
          editorApi={editorApi}
          formatting={formatting}
          onRequestInsertImage={handleRequestInsertImage}
          onRequestHeading={handleRequestHeading}
        />
      ) : null}
      <EditorHeadingSheet
        ref={headingSheetRef}
        currentLevel={formatting.heading}
        onSelect={handleSelectHeading}
      />
    </View>
  );
}
