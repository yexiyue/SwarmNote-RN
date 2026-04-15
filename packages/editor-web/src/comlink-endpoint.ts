/**
 * WebView 侧 Comlink Endpoint 适配器
 *
 * 与 RN 侧的 `src/lib/comlink-webview-adapter.ts` 对称。
 * 把 ReactNativeWebView.postMessage / window 'message' 事件
 * 包装成 Comlink 期望的 Endpoint 接口，通过 channel 做多路复用。
 */
import * as Comlink from 'comlink';

type ComlinkEnvelope = {
  channel: string;
  payload: unknown;
};

function createEnvelope(
  channel: string,
  payload: unknown,
): ComlinkEnvelope {
  return { channel, payload };
}

function parseEnvelope(data: unknown): ComlinkEnvelope | null {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('channel' in parsed) ||
    !('payload' in parsed)
  ) {
    return null;
  }

  return parsed as ComlinkEnvelope;
}

function getRNBridge(): { postMessage(payload: string): void } | undefined {
  return (
    globalThis as typeof globalThis & {
      ReactNativeWebView?: { postMessage(payload: string): void };
    }
  ).ReactNativeWebView;
}

export function createWebViewEndpoint(channel: string): Comlink.Endpoint {
  const listenerMap = new WeakMap<
    EventListenerOrEventListenerObject,
    EventListener
  >();

  return {
    postMessage(message: unknown) {
      getRNBridge()?.postMessage(
        JSON.stringify(createEnvelope(channel, message)),
      );
    },
    addEventListener(
      type: string,
      handler: EventListenerOrEventListenerObject,
    ) {
      const wrapped: EventListener = ((event: Event) => {
        const envelope = parseEnvelope((event as MessageEvent).data);
        if (!envelope || envelope.channel !== channel) {
          return;
        }

        if (typeof handler === 'function') {
          handler({ data: envelope.payload } as MessageEvent);
          return;
        }

        handler.handleEvent({
          data: envelope.payload,
        } as MessageEvent as Event);
      }) as EventListener;

      listenerMap.set(handler, wrapped);
      globalThis.addEventListener(type, wrapped);
    },
    removeEventListener(
      type: string,
      handler: EventListenerOrEventListenerObject,
    ) {
      const wrapped = listenerMap.get(handler);
      if (!wrapped) {
        return;
      }

      listenerMap.delete(handler);
      globalThis.removeEventListener(type, wrapped);
    },
  };
}

/**
 * 注册 Uint8Array 的 Comlink transferHandler。
 * JSON.stringify(Uint8Array) 会变成 {"0":1,"1":2,...} 丢失类型，
 * 需要在 RN 和 WebView 两端都注册。
 */
export function registerTransferHandlers(): void {
  Comlink.transferHandlers.set('uint8array', {
    canHandle: (val: unknown): val is Uint8Array => val instanceof Uint8Array,
    serialize: (val: Uint8Array): [number[], Transferable[]] => [
      Array.from(val),
      [],
    ],
    deserialize: (val: unknown) => new Uint8Array(val as number[]),
  });
}

/**
 * 检测当前是否在 RN WebView 内运行。
 */
export function isWebViewEnvironment(): boolean {
  return !!getRNBridge();
}

/**
 * 通过 RN bridge 发送调试日志（不走 Comlink）。
 */
export function debugLog(msg: string): void {
  getRNBridge()?.postMessage(JSON.stringify({ __debugLog: msg }));
}
