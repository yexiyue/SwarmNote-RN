import type { EditorEvent } from "@swarmnote/editor/events";
import { DEFAULT_SETTINGS } from "@swarmnote/editor/types";
import type { EditorInitOptions } from "@swarmnote/editor-web";
import { Asset } from "expo-asset";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import WebView from "react-native-webview";
import { useEditorBridge } from "./useEditorBridge";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EDITOR_HTML_MODULE = require("@swarmnote/editor-web/dist/index.html");

interface MarkdownEditorProps {
  initialText?: string;
  enableYjs?: boolean;
  onEditorEvent?: (event: EditorEvent) => void;
}

export function MarkdownEditor({
  initialText = "",
  enableYjs = false,
  onEditorEvent,
}: MarkdownEditorProps) {
  const webviewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [editorCreated, setEditorCreated] = useState(false);

  // 加载 HTML 资源到本地文件系统（每次强制重新下载）
  useEffect(() => {
    let cancelled = false;
    const asset = Asset.fromModule(EDITOR_HTML_MODULE);
    // 强制重新下载，忽略缓存
    asset.localUri = null;
    (asset as unknown as { downloaded: boolean }).downloaded = false;
    asset
      .downloadAsync()
      .then(() => {
        if (!cancelled && asset.localUri) {
          console.log("[Editor] HTML asset loaded:", asset.localUri);
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

  const { editorApi, setWebViewRef, onWebViewMessage } = useEditorBridge({
    onRuntimeReady() {
      console.log("[Editor] onRuntimeReady called, setting runtimeReady=true");
      setRuntimeReady(true);
    },
    onEditorEvent,
  });

  const handleRef = useCallback(
    (ref: WebView | null) => {
      console.log("[Editor] handleRef:", ref ? "WebView mounted" : "WebView unmounted");
      if (!ref) {
        setRuntimeReady(false);
        setEditorCreated(false);
      }

      (webviewRef as React.MutableRefObject<WebView | null>).current = ref;
      setWebViewRef(
        ref
          ? {
              injectJavaScript: (js: string) => ref.injectJavaScript(js),
            }
          : null,
      );
    },
    [setWebViewRef],
  );

  const colorScheme = useColorScheme();
  const appearance = colorScheme === "dark" ? "dark" : "light";

  const options: EditorInitOptions = useMemo(
    () => ({
      initialText,
      settings: {
        ...DEFAULT_SETTINGS,
        theme: { appearance },
      },
      collaboration: enableYjs
        ? {
            ydoc: {},
            fragmentName: "document",
          }
        : undefined,
    }),
    [appearance, enableYjs, initialText],
  );

  // Sync theme when color scheme changes at runtime
  useEffect(() => {
    if (!editorApi || !editorCreated) return;
    void editorApi.updateSettings({ theme: { appearance } });
  }, [appearance, editorApi, editorCreated]);

  useEffect(() => {
    console.log("[Editor] createEditor effect:", {
      hasApi: !!editorApi,
      runtimeReady,
      editorCreated,
    });
    if (!editorApi || !runtimeReady || editorCreated) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        console.log("[Editor] calling createEditor...");
        await editorApi.createEditor(options);
        if (cancelled) {
          return;
        }
        console.log("[Editor] editor created successfully");
        setEditorCreated(true);
        await editorApi.focus();
        console.log("[Editor] editor focused");
      } catch (err) {
        console.error("[Editor] createEditor failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editorApi, editorCreated, options, runtimeReady]);

  useEffect(() => {
    return () => {
      if (!editorApi) {
        return;
      }

      void editorApi.destroyEditor();
    };
  }, [editorApi]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      console.log("[Editor] onMessage:", event.nativeEvent.data?.substring(0, 150));
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
  );
}
