import type { EditorEvent } from "@swarmnote/editor/events";
import type { SearchState, SelectionFormatting } from "@swarmnote/editor/types";
import {
  DEFAULT_SELECTION_FORMATTING,
  DEFAULT_SETTINGS,
  EditorCommandType,
} from "@swarmnote/editor/types";
import type { EditorInitOptions } from "@swarmnote/editor-web";
import { Asset } from "expo-asset";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, useColorScheme, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import WebView from "react-native-webview";
import { clear as clearBridge, register as registerBridge } from "@/core/editor-bridge-registry";
import { FormattingToolbar } from "./FormattingToolbar";
import { SearchBar } from "./SearchBar";
import { useEditorBridge } from "./useEditorBridge";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EDITOR_HTML_MODULE = require("@swarmnote/editor-web/dist/index.html");

const TOOLBAR_HEIGHT = 44;

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
  /** Called with each local Y.Doc update the editor produces. */
  onCollabUpdate?: (update: Uint8Array) => void;
  /** Non-collab editor events (Change, Focus, Blur, SearchStateChange …).
   *  CollaborationUpdate is filtered out — it goes through `onCollabUpdate`. */
  onEditorEvent?: (event: EditorEvent) => void;
  /** When true, shows the search bar above the editor. */
  searchVisible?: boolean;
  /** Called when search visibility should change (e.g. user closes search bar). */
  onSearchVisibilityChange?: (visible: boolean) => void;
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
  searchVisible = false,
  onSearchVisibilityChange,
  enableYjs = false,
}: MarkdownEditorProps) {
  const webviewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [editorCreated, setEditorCreated] = useState(false);

  // Keyboard & toolbar state
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [focused, setFocused] = useState(false);
  const [selectionFormatting, setSelectionFormatting] = useState<SelectionFormatting>(
    DEFAULT_SELECTION_FORMATTING,
  );

  // Search state (driven by SearchStateChange events from the editor)
  const [searchState, setSearchState] = useState<SearchState | null>(null);

  const collabMode = docUuid !== undefined && initialState !== undefined;
  const toolbarVisible = focused && keyboardHeight > 0;
  const bottomPad = keyboardHeight + (toolbarVisible ? TOOLBAR_HEIGHT : 0);

  // Load the editor HTML asset
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

  // Track keyboard height to resize WebView and position toolbar
  useEffect(() => {
    // iOS: use Will events for smoother animation; Android: use Did events
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Scroll cursor into view after keyboard fully appears
  const editorApiRef = useRef<ReturnType<typeof useEditorBridge>["editorApi"]>(null);
  useEffect(() => {
    if (keyboardHeight > 0 && editorApiRef.current) {
      void editorApiRef.current.execCommand(EditorCommandType.ScrollSelectionIntoView);
    }
  }, [keyboardHeight]);

  const handleCollaborationUpdate = useCallback(
    (update: Uint8Array) => {
      onCollabUpdate?.(update);
    },
    [onCollabUpdate],
  );

  // Route editor events: intercept focus/blur/formatting/search locally,
  // forward the rest to the parent's onEditorEvent prop.
  const handleEditorEvent = useCallback(
    (event: EditorEvent) => {
      if (event.kind === "focus") {
        setFocused(true);
        return;
      }
      if (event.kind === "blur") {
        setFocused(false);
        return;
      }
      if (event.kind === "selectionFormattingChange") {
        setSelectionFormatting(event.formatting);
        return;
      }
      if (event.kind === "searchStateChange") {
        setSearchState(event.search);
        return;
      }
      // collaborationUpdate goes through onCollabUpdate, not here
      onEditorEvent?.(event);
    },
    [onEditorEvent],
  );

  const { editorApi, setWebViewRef, onWebViewMessage } = useEditorBridge({
    onRuntimeReady() {
      setRuntimeReady(true);
    },
    onEditorEvent: handleEditorEvent,
    onCollaborationUpdate: handleCollaborationUpdate,
  });

  // Keep a ref to editorApi so keyboard effect can access it without re-running
  useEffect(() => {
    editorApiRef.current = editorApi;
  }, [editorApi]);

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

  const options: EditorInitOptions = useMemo(
    () => ({
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
    }),
    [appearance, collabMode, enableYjs, initialText],
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

  // Search bar handlers
  const handleSearchQueryChange = useCallback(
    (query: string) => {
      if (!editorApi) return;
      void editorApi.setSearchState({
        query,
        replaceQuery: "",
        caseSensitive: false,
        wholeWord: false,
        regexp: false,
        isOpen: true,
        activeMatchIndex: null,
        totalMatches: 0,
      });
    },
    [editorApi],
  );

  const handleFindNext = useCallback(() => {
    void editorApi?.execCommand(EditorCommandType.FindNext);
  }, [editorApi]);

  const handleFindPrev = useCallback(() => {
    void editorApi?.execCommand(EditorCommandType.FindPrevious);
  }, [editorApi]);

  const handleSearchClose = useCallback(() => {
    void editorApi?.setSearchState(null);
    setSearchState(null);
    onSearchVisibilityChange?.(false);
  }, [editorApi, onSearchVisibilityChange]);

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
      {searchVisible && (
        <SearchBar
          searchState={searchState}
          onQueryChange={handleSearchQueryChange}
          onFindNext={handleFindNext}
          onFindPrev={handleFindPrev}
          onClose={handleSearchClose}
        />
      )}

      <View style={{ flex: 1, marginBottom: bottomPad }}>
        <WebView
          ref={handleRef}
          source={{ uri: htmlUri }}
          originWhitelist={["file://*"]}
          onMessage={handleMessage}
          style={{ flex: 1, opacity: 0.99 }}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowFileAccessFromFileURLs
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

      {toolbarVisible && (
        <FormattingToolbar
          formatting={selectionFormatting}
          onCommand={(cmd) => void editorApi?.execCommand(cmd)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: keyboardHeight,
          }}
        />
      )}
    </View>
  );
}
