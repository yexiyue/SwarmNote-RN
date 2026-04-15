import type { EditorEvent } from "@swarmnote/editor/events";
import type { EditorApi, HostApi } from "@swarmnote/editor-web";
import * as Comlink from "comlink";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  createRNEndpoint,
  registerTransferHandlers,
  type WebViewRef,
} from "@/lib/comlink-webview-adapter";

registerTransferHandlers(Comlink);

interface UseEditorBridgeOptions {
  onRuntimeReady?: () => void;
  onEditorEvent?: (event: EditorEvent) => void;
}

interface EditorBridge {
  editorApi: Comlink.Remote<EditorApi> | null;
  setWebViewRef: (ref: WebViewRef | null) => void;
  onWebViewMessage: (event: { nativeEvent: { data: string } }) => void;
}

const RUNTIME_CHANNEL = "editor-runtime";
const HOST_CHANNEL = "editor-host";

export function useEditorBridge(options: UseEditorBridgeOptions = {}): EditorBridge {
  const webviewRef = useRef<WebViewRef | null>(null);
  const runtimeEndpointRef = useRef<ReturnType<typeof createRNEndpoint> | null>(null);
  const hostEndpointRef = useRef<ReturnType<typeof createRNEndpoint> | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const editorApi = useMemo(() => {
    const endpoint = createRNEndpoint(RUNTIME_CHANNEL, () => webviewRef.current);
    runtimeEndpointRef.current = endpoint;
    return Comlink.wrap<EditorApi>(endpoint);
  }, []);

  const hostEndpoint = useMemo(() => {
    const endpoint = createRNEndpoint(HOST_CHANNEL, () => webviewRef.current);
    hostEndpointRef.current = endpoint;
    return endpoint;
  }, []);

  useEffect(() => {
    const hostApi: HostApi = {
      onRuntimeReady() {
        optionsRef.current.onRuntimeReady?.();
      },
      onEditorEvent(event) {
        optionsRef.current.onEditorEvent?.(event);
      },
      log(message: string) {
        console.log("[Editor WebView]", message);
      },
    };

    Comlink.expose(hostApi, hostEndpoint);
  }, [hostEndpoint]);

  const setWebViewRef = useCallback((ref: WebViewRef | null) => {
    webviewRef.current = ref;
  }, []);

  const onWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const raw = event.nativeEvent.data;

    // 拦截调试日志（不走 Comlink）
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed?.__debugLog) {
        console.log("[Editor WebView]", parsed.__debugLog);
        return;
      }
    } catch {
      // 非 JSON，继续交给 Comlink
    }

    runtimeEndpointRef.current?.dispatchMessage(raw);
    hostEndpointRef.current?.dispatchMessage(raw);
  }, []);

  return { editorApi, setWebViewRef, onWebViewMessage };
}
