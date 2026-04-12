import type { EditorInitOptions } from "@swarmnote/editor-web";
import { useCallback, useMemo, useRef } from "react";
import { View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import WebView from "react-native-webview";
import { useEditorBridge } from "./useEditorBridge";

// TODO: 这个字符串在构建阶段从 packages/editor-web/dist/ 读取
// 暂时用 placeholder,后续用 Metro asset 或 build-time codegen 替代
const EDITOR_BUNDLE_JS = "/* editor bundle will be injected here */";

interface MarkdownEditorProps {
  initialText?: string;
  enableYjs?: boolean;
  onDocChange?: () => void;
  onYjsUpdate?: (update: Uint8Array) => void;
  onFocusChange?: (hasFocus: boolean) => void;
}

const EDITOR_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; overflow: hidden; }
    #editor-root {
      height: 100%;
      padding: 12px;
      font-size: 16px;
      line-height: 1.6;
    }
    .cm-editor { height: 100%; }
    .cm-scroller { overflow: auto !important; }
    .cm-content { padding-bottom: 50vh; }
    .cm-focused { outline: none; }
  </style>
</head>
<body>
  <div id="editor-root"></div>
</body>
</html>`;

export function MarkdownEditor({
  initialText = "",
  enableYjs = false,
  onDocChange,
  onYjsUpdate,
  onFocusChange,
}: MarkdownEditorProps) {
  const webviewRef = useRef<WebView>(null);

  const { editorApi, setWebViewRef, onWebViewMessage } = useEditorBridge({
    onDocChange,
    onYjsUpdate,
    onFocusChange,
  });

  // WebView ref 设置
  const handleRef = useCallback(
    (ref: WebView | null) => {
      (webviewRef as React.MutableRefObject<WebView | null>).current = ref;
      setWebViewRef(ref ? { injectJavaScript: (js: string) => ref.injectJavaScript(js) } : null);
    },
    [setWebViewRef],
  );

  // WebView 加载完成后初始化编辑器
  const handleLoadEnd = useCallback(async () => {
    if (!editorApi) return;

    const options: EditorInitOptions = {
      initialText,
      settings: {
        readonly: false,
        lineWrapping: true,
        indentWithTabs: false,
        tabSize: 2,
      },
      enableYjs,
    };

    await editorApi.init(options);
    await editorApi.focus();
  }, [editorApi, initialText, enableYjs]);

  // 注入编辑器 bundle 的 JS
  const injectedJavaScript = useMemo(
    () => `
      try {
        ${EDITOR_BUNDLE_JS}
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.message }));
      }
      true;
    `,
    [],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      onWebViewMessage(event);
    },
    [onWebViewMessage],
  );

  return (
    <View className="flex-1">
      <WebView
        ref={handleRef}
        source={{ html: EDITOR_HTML }}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
      />
    </View>
  );
}
