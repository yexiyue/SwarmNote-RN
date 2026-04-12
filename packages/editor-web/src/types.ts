import type { EditorSettings } from '@swarmnote/editor';

/**
 * WebView 端暴露给 RN 的 API（通过 Comlink）
 */
export interface EditorApi {
  /** 创建编辑器实例 */
  init(options: EditorInitOptions): void;

  /** 获取当前文档文本 */
  getText(): string;

  /** 替换整个文档 */
  setText(text: string): void;

  /** 执行编辑命令 */
  execCommand(name: string, ...args: unknown[]): void;

  /** 更新编辑器设置 */
  updateSettings(settings: Partial<EditorSettings>): void;

  /** 应用远端 yjs update */
  applyYjsUpdate(update: Uint8Array): void;

  /** 设置选区 */
  select(from: number, to?: number): void;

  /** 聚焦编辑器 */
  focus(): void;
}

export interface EditorInitOptions {
  initialText: string;
  settings: EditorSettings;
  enableYjs: boolean;
}

/**
 * RN 端暴露给 WebView 的 API（通过 Comlink）
 */
export interface HostApi {
  /** 编辑器内容变化 */
  onDocChange(): void;

  /** 本地 yjs update 产生（需要发送给 Rust 侧持久化 + P2P 广播） */
  onYjsUpdate(update: Uint8Array): void;

  /** 编辑器获得/失去焦点 */
  onFocusChange(hasFocus: boolean): void;

  /** 日志（调试用） */
  log(message: string): void;
}
