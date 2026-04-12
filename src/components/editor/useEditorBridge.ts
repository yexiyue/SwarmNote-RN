import type { EditorApi, HostApi } from "@swarmnote/editor-web";
import * as Comlink from "comlink";
import { useCallback, useMemo, useRef } from "react";
import { createRNEndpoint, type WebViewRef } from "@/lib/comlink-webview-adapter";

interface UseEditorBridgeOptions {
  onDocChange?: () => void;
  onYjsUpdate?: (update: Uint8Array) => void;
  onFocusChange?: (hasFocus: boolean) => void;
}

interface EditorBridge {
  /** 远端编辑器 API (调用 WebView 内的编辑器) */
  editorApi: Comlink.Remote<EditorApi> | null;
  /** 给 WebView ref 的 getter */
  setWebViewRef: (ref: WebViewRef | null) => void;
  /** WebView onMessage handler — 传给 <WebView onMessage={...} /> */
  onWebViewMessage: (event: { nativeEvent: { data: string } }) => void;
}

/**
 * 管理 RN ↔ WebView 的 Comlink 桥接。
 *
 * 用法:
 * ```tsx
 * const { editorApi, setWebViewRef, onWebViewMessage } = useEditorBridge({
 *   onDocChange: () => console.log('doc changed'),
 *   onYjsUpdate: (update) => rustBridge.applyLocalUpdate(docId, update),
 * });
 * ```
 */
export function useEditorBridge(options: UseEditorBridgeOptions = {}): EditorBridge {
  const webviewRef = useRef<WebViewRef | null>(null);
  const endpointRef = useRef<ReturnType<typeof createRNEndpoint> | null>(null);

  const editorApi = useMemo(() => {
    const endpoint = createRNEndpoint(() => webviewRef.current);
    endpointRef.current = endpoint;
    return Comlink.wrap<EditorApi>(endpoint);
  }, []);

  const setWebViewRef = useCallback((ref: WebViewRef | null) => {
    webviewRef.current = ref;
  }, []);

  // 用 ref 存回调,避免 HostApi 对象随回调变化而重建
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // HostApi: 暴露给 WebView 调用的回调
  const _hostApi: HostApi = useMemo(
    () => ({
      onDocChange() {
        optionsRef.current.onDocChange?.();
      },
      onYjsUpdate(update: Uint8Array) {
        optionsRef.current.onYjsUpdate?.(update);
      },
      onFocusChange(hasFocus: boolean) {
        optionsRef.current.onFocusChange?.(hasFocus);
      },
      log(message: string) {
        console.log("[Editor WebView]", message);
      },
    }),
    [],
  );

  // TODO: 用 Comlink.expose(hostApi, endpoint) 让 WebView 能调 RN 的 HostApi
  // 这需要一个反向 endpoint,暂时先用单向(RN → WebView)

  const onWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const data = JSON.parse(event.nativeEvent.data);
    // 把 WebView 发来的消息转发给 Comlink endpoint listener
    const endpoint = endpointRef.current as ReturnType<typeof createRNEndpoint> & {
      dispatchMessage(data: unknown): void;
    };
    endpoint?.dispatchMessage(data);
  }, []);

  return { editorApi, setWebViewRef, onWebViewMessage };
}
