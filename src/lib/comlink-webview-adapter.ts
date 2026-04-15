/**
 * Comlink WebView Adapter
 *
 * 把 react-native-webview 的 postMessage / onMessage 接口
 * 包装成 Comlink 期望的 Endpoint 接口，并通过 channel 做双向多路复用。
 */
import type { Endpoint } from "comlink";

export interface WebViewRef {
  injectJavaScript(js: string): void;
}

type MessageHandler = (event: MessageEvent) => void;

/**
 * 注册 Uint8Array 的 Comlink transferHandler。
 * JSON.stringify(Uint8Array) 会变成 {"0":1,"1":2,...} 丢失类型，
 * 需要在 RN 和 WebView 两端都注册。
 */
export function registerTransferHandlers(Comlink: {
  transferHandlers: Map<
    string,
    {
      canHandle(val: unknown): boolean;
      serialize(val: unknown): [unknown, Transferable[]];
      deserialize(val: unknown): unknown;
    }
  >;
}) {
  Comlink.transferHandlers.set("uint8array", {
    canHandle: (val: unknown): boolean => val instanceof Uint8Array,
    serialize: (val: unknown) => [Array.from(val as Uint8Array), []],
    deserialize: (val: unknown) => new Uint8Array(val as number[]),
  });
}

type ComlinkEnvelope = {
  channel: string;
  payload: unknown;
};

function isEnvelope(value: unknown): value is ComlinkEnvelope {
  return typeof value === "object" && value !== null && "channel" in value && "payload" in value;
}

function toEnvelope(channel: string, payload: unknown): ComlinkEnvelope {
  return { channel, payload };
}

function parseEnvelope(data: unknown): ComlinkEnvelope | null {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return isEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createRNEndpoint(
  channel: string,
  getWebView: () => WebViewRef | null,
): Endpoint & { dispatchMessage(data: unknown): void } {
  const listeners = new Set<MessageHandler>();
  const listenerMap = new WeakMap<EventListenerOrEventListenerObject, MessageHandler>();

  return {
    postMessage(message: unknown) {
      const webview = getWebView();
      if (!webview) return;

      // 双重 stringify：外层产生安全的 JS 字符串字面量，WebView 侧 JSON.parse 还原。
      // 直接插值到模板字面量中会被反引号等字符打断。
      const escaped = JSON.stringify(JSON.stringify(toEnvelope(channel, message)));
      webview.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message',{data:JSON.parse(${escaped})}));true;`,
      );
    },

    addEventListener(_type: string, handler: EventListenerOrEventListenerObject) {
      const fn = typeof handler === "function" ? handler : handler.handleEvent.bind(handler);
      listenerMap.set(handler, fn as MessageHandler);
      listeners.add(fn as MessageHandler);
    },

    removeEventListener(_type: string, handler: EventListenerOrEventListenerObject) {
      const fn = listenerMap.get(handler);
      if (fn) {
        listeners.delete(fn);
        listenerMap.delete(handler);
      }
    },

    dispatchMessage(data: unknown) {
      const envelope = parseEnvelope(data);
      if (!envelope || envelope.channel !== channel) {
        return;
      }

      const event = { data: envelope.payload } as MessageEvent;
      for (const handler of listeners) {
        handler(event);
      }
    },
  };
}
