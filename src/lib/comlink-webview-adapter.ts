/**
 * Comlink WebView Adapter
 *
 * 把 react-native-webview 的 postMessage / onMessage 接口
 * 包装成 Comlink 期望的 Endpoint 接口。
 *
 * 参考: https://github.com/nicolo-ribaudo/comlink-webview (思路相同但独立实现)
 */
import type { Endpoint } from "comlink";

export interface WebViewRef {
  injectJavaScript(js: string): void;
  postMessage?(data: unknown): void;
}

type MessageHandler = (event: MessageEvent) => void;

/**
 * RN 侧 Endpoint: 把消息发给 WebView, 从 WebView 收消息
 *
 * 使用方式:
 * ```ts
 * const endpoint = createRNEndpoint(webviewRef);
 * const editorApi = Comlink.wrap<EditorApi>(endpoint);
 * ```
 */
export function createRNEndpoint(getWebView: () => WebViewRef | null): Endpoint {
  const listeners = new Set<MessageHandler>();

  return {
    postMessage(msg: unknown) {
      const webview = getWebView();
      if (!webview) return;

      // 把消息发送到 WebView 的 window 上
      const serialized = JSON.stringify(msg);
      webview.injectJavaScript(`
        window.dispatchEvent(new MessageEvent('message', { data: ${serialized} }));
        true;
      `);
    },

    addEventListener(_type: string, handler: EventListenerOrEventListenerObject) {
      const fn = typeof handler === "function" ? handler : handler.handleEvent.bind(handler);
      listeners.add(fn as MessageHandler);
    },

    removeEventListener(_type: string, handler: EventListenerOrEventListenerObject) {
      const fn = typeof handler === "function" ? handler : handler.handleEvent.bind(handler);
      listeners.delete(fn as MessageHandler);
    },

    /**
     * 在 WebView 的 onMessage 回调中调用此方法,
     * 把 WebView 发来的消息转发给 Comlink listener.
     */
    dispatchMessage(data: unknown) {
      const event = { data } as MessageEvent;
      for (const handler of listeners) {
        handler(event);
      }
    },
  } as Endpoint & { dispatchMessage(data: unknown): void };
}

/**
 * WebView 侧 Endpoint (在 editor-web bundle 里使用)
 *
 * 在 WebView 的 JS 环境中, Comlink 默认的 `self` endpoint 就能工作:
 * - `self.postMessage(msg)` → 触发 RN 的 onMessage
 * - `self.addEventListener('message', ...)` → 收 RN 发来的消息
 *
 * 但 react-native-webview 的 postMessage 是 `window.ReactNativeWebView.postMessage`,
 * 不是标准的 `self.postMessage`. 所以需要适配:
 */
export function createWebViewEndpoint(): Endpoint {
  return {
    postMessage(msg: unknown) {
      // react-native-webview 的标准方式
      const rnWebView = (
        window as unknown as { ReactNativeWebView?: { postMessage(s: string): void } }
      ).ReactNativeWebView;
      if (rnWebView) {
        rnWebView.postMessage(JSON.stringify(msg));
      }
    },

    addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      // 监听 RN 通过 injectJavaScript dispatchEvent 发来的 message
      window.addEventListener(type, handler as EventListener);
    },

    removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      window.removeEventListener(type, handler as EventListener);
    },
  };
}
