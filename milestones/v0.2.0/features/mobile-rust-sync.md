# 移动端 Rust 后端对接

## 用户故事

作为用户，我希望在手机上编辑的笔记能自动通过 P2P 网络同步到桌面端，实现多设备无缝协作。

## 依赖

- 桌面端 CM6 迁移（L2，需要双端 yjs schema 统一为 Y.Text）
- v0.1.0 Rust 桥接（uniffi）已验证

## 需求描述

通过 uniffi-bindgen-react-native 将 Rust 核心的 yjs 持久化 + P2P 同步能力暴露给移动端，打通"移动端编辑 → WebView Y.Doc → RN → Rust → P2P → 桌面端"的完整链路。

### 数据流

```text
用户打字
  → CM6 EditorView (WebView)
  → y-codemirror.next → Y.Text 操作
  → Y.Doc 产生增量 update (Uint8Array)
  → notifyHost('onYjsUpdate', update) via Comlink
  → RN useEditorBridge 收到 onYjsUpdate 回调
  → uniffi: documentManager.applyLocalUpdate(docId, update)
  → Rust yrs 持久化到 SQLite
  → Rust libp2p gossipsub 广播给其他节点

远端 P2P update 到达
  → Rust libp2p 收到
  → uniffi callback: observer.onRemoteUpdate(docId, update)
  → RN 收到回调
  → editorApi.applyYjsUpdate(update) via Comlink RPC
  → WebView Y.Doc 合并远端 update
  → y-codemirror.next 自动更新 CM6 视图
```

## 技术方案

### Rust 侧 uniffi 导出

在桌面端 `app-core` crate 中新增：

```rust
#[uniffi::export]
impl DocumentManager {
    /// 加载文档的完整 yjs 状态（用于初始化 WebView Y.Doc）
    pub fn load_doc(&self, id: String) -> Vec<u8>;

    /// 应用本地产生的 yjs update（持久化 + P2P 广播）
    pub fn apply_local_update(&self, id: String, update: Vec<u8>) -> Result<()>;

    /// 订阅远端 update（P2P 收到其他节点的更新时回调）
    pub fn subscribe(&self, id: String, observer: Arc<dyn UpdateObserver>);
}

#[uniffi::export(callback_interface)]
pub trait UpdateObserver: Send + Sync {
    fn on_remote_update(&self, doc_id: String, update: Vec<u8>);
}
```

### RN 侧对接

在 `useEditorBridge` 的回调中集成 uniffi 调用：

- `onYjsUpdate(update)` → `documentManager.applyLocalUpdate(docId, update)`
- `observer.onRemoteUpdate` → `editorApi.applyYjsUpdate(update)` via Comlink

### Uint8Array 序列化

WebView ↔ RN 通过 JSON 传输，`Uint8Array` 需要编码：
- 方案 A：Base64 编码（简单，增加 ~33% 体积）
- 方案 B：Array 序列化（`[...uint8Array]`）
- 方案 C：Comlink transferHandler 自定义序列化

建议先用方案 A（Base64），后续优化。

## 验收标准

- [ ] Rust `DocumentManager` uniffi API 定义完成并生成 TypeScript 绑定
- [ ] 移动端编辑内容可持久化到本地 SQLite（通过 Rust）
- [ ] 移动端启动时可从 Rust 加载已有文档的 yjs 状态
- [ ] 远端 P2P update 可实时应用到移动端编辑器
- [ ] 移动端和桌面端可通过 P2P 网络双向同步编辑内容
- [ ] yjs update 传输正确（Uint8Array 序列化/反序列化无数据丢失）

## 任务拆分建议

1. Rust `app-core` 定义 `DocumentManager` uniffi API
2. 生成 TypeScript 绑定并在 RN 侧验证调用
3. 实现 `UpdateObserver` callback interface
4. `useEditorBridge` 集成 uniffi 回调
5. Uint8Array Base64 编解码适配
6. 端到端测试：移动端 ↔ 桌面端双向同步

## 开放问题

- `app-core` crate 是否需要从桌面端仓库抽离为独立仓库/submodule？
- 大文档的增量 update 频率如何控制？（防止高频 P2P 广播）
- 离线编辑后重新上线的 update 合并策略？
