# Rust 桥接

## 架构

通过 uniffi-bindgen-react-native 桥接 Rust 核心逻辑，作为 React Native Turbo Module。

调用链：`TypeScript → Hermes JSI → C++ → Rust`（无 JSON 序列化）

## 目录结构

```
packages/swarmnote-core/
├── ubrn.config.yaml              # uniffi-bindgen 构建配置
├── rust/mobile-core/             # Rust crate（#[uniffi::export]）
├── src/generated/                # ubrn 自动生成的 TS 绑定
├── cpp/generated/                # ubrn 自动生成的 C++ JSI 绑定
└── android/ | ios/               # 平台原生代码 + 静态库
```

## 自动生成代码

**不要做**：
- 不要手动编辑 `packages/swarmnote-core/src/generated/` 下的文件
- 不要手动编辑 `packages/swarmnote-core/cpp/generated/` 下的文件
- 这些文件由 `pnpm ubrn:android` / `pnpm ubrn:ios` 自动生成

## 编译流程

修改 `rust/` 下 Rust 代码后需重新编译：

```bash
cd packages/swarmnote-core
pnpm ubrn:android    # 或 pnpm ubrn:ios
cd ../..
npx expo run:android  # 或 run:ios
```

## Android 交叉编译 targets

首次需安装：
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## 已知问题

- ubrn 编译 Android 产物位置可能需要手动 fix（参考 `dev-notes/blog/ubrn-android-build-gradle-fix.md`）

## FFI wrap 已落地（2026-04-17）

`mobile-core` 通过 git 依赖引入 `swarmnote-core`（不抽独立 repo），wrap 代码按领域拆 module：

```text
rust/mobile-core/src/
├── lib.rs          # uniffi::setup_scaffolding! + pub mod
├── path.rs         # strip_file_uri（剥 Expo 'file://' 前缀）
├── error.rs        # FfiError + From<AppError> + parse_uuid helper
├── keychain.rs     # ForeignKeychainProvider + adapter
├── events.rs       # UniffiAppEvent（14 变体全映射）+ ForeignEventBus + adapter
├── types.rs        # Workspace / Doc / Folder / FileTree / NodeStatus / inputs / MoveNodeResult
├── app.rs          # UniffiAppCore 核心方法（构造 / 身份 / 网络 / 工作区）
├── pairing.rs      # 配对类型 + UniffiAppCore 配对方法（impl 分离）
├── device.rs       # 设备类型 + UniffiAppCore.list_devices
└── workspace.rs    # UniffiWorkspaceCore（fs + documents + folders + ydoc 全部 collapse）
```

### RN-specific 设计决策（和 Tauri 不同的地方）

这些决策跟 Tauri 桌面不一样，是为了匹配 RN + uniffi 的使用模式。

**1. workspace_id / doc_uuid 从 handle 隐式取，不透传**

Tauri 每个 `invoke('list_documents', { workspaceId })` 都要带 `workspaceId`，因为前端不持有 Rust 对象。RN 直接持有 `UniffiWorkspaceCore` 引用，所以 `ws.listDocuments()` 不用再传 workspace_id——wrap 层从 `self.inner.id()` 取。

- **正确**：定义独立的 FFI input 类型（`UpsertDocInput` / `CreateFolderInput`），省略 `workspace_id`，wrap 方法里拼进 core 的 `UpsertDocumentInput`。
- **不要**：直接镜像 core 的 input 类型——RN 调用者会重复写 workspaceId 且可能填错。

**2. fs / documents / ydoc 全部 collapse 到 `UniffiWorkspaceCore`**

桌面把三者分成独立对象（`fs.rs`、`document.rs`、`yjs.rs` command 模块）。RN 上全部 flat 到一个 handle：`ws.readText()` / `ws.listDocuments()` / `ws.openDoc()`。

- **Why**：每个子对象都要 `uniffiDestroy()` 管理生命周期；RN 开发者只想拿 `ws` 一个引用。JSI 调用链也更短。
- **代价**：`UniffiWorkspaceCore` 方法多（~25 个），但语义清晰（workspace 是自然的 scope）。

**3. Path 参数在 wrap 层剥 `file://` 前缀**

Expo 的 `FileSystem.documentDirectory` 返回 `file:///var/mobile/.../Documents/`，`tokio::fs` / `PathBuf` 要纯文件系统路径。`path.rs::strip_file_uri` 兜底剥前缀，RN 调用者可以直接传 Expo 路径。

**4. 事件只走 EventBus callback（`#[uniffi::export(with_foreign)]`）**

不提供 getter + poll 模式。`UniffiAppEvent` 覆盖 core 全部 14 变体，RN 实现 `ForeignEventBus.emit(event)` 分发到 zustand store。**关键**：`ExternalUpdate` 事件携带远端 Yjs update bytes，RN 必须立即转发给 WebView 编辑器——这是唯一的实时路径。

**5. 时间戳统一 `std::time::SystemTime`**

core 的 `chrono::DateTime<Utc>` 一律转 `SystemTime`（uniffi 原生支持 → TS `Date`）。`DeviceInfo.created_at` 例外——core 本身就是 `String` (ISO-8601)，保持透传。

**6. UI-friendly 实体投影，不暴露存储内部字段**

`UniffiDocument` 只有 id / folder_id / title / rel_path / created_at / updated_at / created_by。`yjs_state` / `state_vector` / `file_hash` / `lamport_clock` 永远不回到 RN——它们是存储内部细节。

**7. 错误：镜像 `AppError` kind 名 + 新增 `InvalidInput` 变体**

`FfiError` 22 个变体一一对应 `AppError`（kind 名稳定 API 合约），额外加 `InvalidInput { field, reason }` 覆盖 wrap 层的 UUID 解析失败。RN 侧用 `FfiError.<Variant>.instanceOf(e)` 判别（不是 `instanceof`）。

**8. `move_node` 用公共 API 组装，不走 `internal::fs::ops`**

桌面 `move_document` 用 `swarmnote_core::internal::fs::ops::move_node`。mobile 拒绝碰 `internal::*`，改用 `fs().rename() + rebase_documents_by_prefix() / rebase_document() + ydoc().rename_doc() + event_bus().emit(FileTreeChanged)` 组合实现相同语义。

### 只用 `api::` 命名空间

```rust
use swarmnote_core::api::{
    AppCore, AppCoreBuilder, WorkspaceCore, YDocManager, OpenDocResult,
    DocumentCrud, DeviceInfo, PairedDeviceInfo, EventBus, AppEvent,
    FileSystem, FileWatcher, LocalFs, KeychainProvider, AppError, AppResult,
};
// ❌ 不要碰 swarmnote_core::internal::*（NetManager / AppSyncCoordinator 等）
//    那是桌面 command 层的内部类型,不应泄到 FFI
```

`swarmnote_core` 根级没有 flat re-exports——必须显式写 `api::` 或 `internal::`。

### AppCore 构造走 AppCoreBuilder + factory 注入

```rust
#[uniffi::export]
impl UniffiAppCore {
    pub async fn new(
        keychain: Arc<dyn ForeignKeychainProvider>,
        event_bus: Arc<dyn ForeignEventBus>,
        app_data_dir: String,
    ) -> Result<Arc<Self>, FfiError> {
        let inner = AppCoreBuilder::new(
            Arc::new(UniffiKeychainAdapter::new(keychain)),
            Arc::new(UniffiEventBusAdapter::new(event_bus)),
            PathBuf::from(app_data_dir),
        )
        // mobile 沙盒不装 watcher,fs_factory 默认 LocalFs 即可
        .build().await?;
        Ok(Arc::new(Self { inner }))
    }

    pub async fn open_workspace(&self, path: String) -> Result<Arc<UniffiWorkspaceCore>, FfiError> {
        let ws = self.inner.open_workspace(path).await?;  // 单参数
        Ok(Arc::new(UniffiWorkspaceCore { inner: ws }))
    }
}
```

`open_workspace` 是 1 参数（不是 3 参数）——fs/watcher 通过 builder 的 factory 注入。mobile 上 `fs_factory` 默认 `LocalFs`（沙盒路径直接可用），`watcher_factory` 保持 `None`。

### Platform traits 用 `#[uniffi::export(with_foreign)]`

`FileSystem` / `EventBus` / `KeychainProvider` 是 `Arc<dyn Trait>`，对应 uniffi CallbackInterface 模式：

```rust
#[uniffi::export(with_foreign)]
#[async_trait::async_trait]
pub trait ForeignKeychainProvider: Send + Sync {
    async fn get_or_create_keypair(&self) -> Result<Vec<u8>, FfiError>;
}

// 适配器把 foreign trait 转成 core trait
struct UniffiKeychainAdapter {
    foreign: Arc<dyn ForeignKeychainProvider>,
}

#[async_trait::async_trait]
impl swarmnote_core::api::KeychainProvider for UniffiKeychainAdapter {
    async fn get_or_create_keypair(&self) -> AppResult<Vec<u8>> {
        self.foreign.get_or_create_keypair().await
            .map_err(Into::into)  // FfiError → AppError
    }
}
```

`EventBus::emit(AppEvent)` 同理——定义镜像 `UniffiAppEvent` enum（`#[derive(uniffi::Enum)]`），`From<swarmnote_core::api::AppEvent>` 做字段转换（`Uuid → String`、`Vec<u8>` 保留）。

### AppError 用镜像 FfiError + From 转换

**不要**给 `swarmnote-core::api::AppError` 加 `uniffi::Error` derive（会污染共享 crate）。定义镜像：

```rust
#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum FfiError {
    #[error("database error: {0}")]
    Database(String),
    #[error("yjs decode ({context}): {reason}")]
    YjsDecode { context: String, reason: String },
    #[error("document row missing: {0}")]
    DocRowMissing(String),  // Uuid → String
    #[error("P2P node is not running")]
    NetworkNotRunning,
    // ... 按 swarmnote_core::api::AppError 的变体一一对应 ...
}

impl From<AppError> for FfiError {
    fn from(e: AppError) -> Self {
        match e {
            AppError::Database(err) => FfiError::Database(err.to_string()),
            AppError::YjsDecode { context, reason } =>
                FfiError::YjsDecode { context: context.to_string(), reason },
            AppError::DocRowMissing(uuid) => FfiError::DocRowMissing(uuid.to_string()),
            AppError::NetworkNotRunning => FfiError::NetworkNotRunning,
            // ...
        }
    }
}
```

`kind` 名（`YjsDecode` / `DocRowMissing` / `NetworkNotRunning` 等）是 **API 合约**，跨桌面 + mobile 共享——RN 侧 i18n / 错误恢复按 kind 分支。不要自己改 kind 名字。

### Rust 类型 → FFI 类型映射

| `swarmnote_core::api` 类型 | FFI wrap 对照 | 备注 |
|---|---|---|
| `PathBuf` | `String` | wrapper 里 `PathBuf::from(s)` |
| `Uuid` | `String` | UniFfi 不直接支持 Uuid，wrapper 里 parse |
| `PeerId` | `String` | 只在 core 内部出现；FFI API 用字符串 |
| `Vec<u8>`（事件 payload / yjs_state） | `Vec<u8>` | uniffi 原生支持 |
| `Arc<dyn FileSystem>` | `Arc<dyn ForeignFileSystem>` via CallbackInterface | 适配器转换 |
| `async fn` | uniffi 自动映射到 Promise | RN 侧 `await` |

### 生命周期契约（必读）

- **mobile 最多一个活跃 WorkspaceCore**：core 没有类型层限制，mobile host 需要自己维护 `Mutex<Option<Arc<WorkspaceCore>>>`，切换工作区前先 `close` 旧的
- **`close()` 必须 await**：`WorkspaceCore::close() -> AppResult<()>` 会聚合 dirty doc 持久化错误；host 拿 `Err` 时要 toast 给用户（不要静默吞）
- **P2P 显式 start/stop**：`AppCore::start_network()` / `stop_network()` 不自动化，host 在 `onAppActive` 启、`onBackground` 停
- **AppEvent 没有 NavigateTo 变体**：那是桌面 emit_to 用的，mobile 忽略

### 不要做

- 不要在 `swarmnote-core`（submodule）里加 `uniffi` derive / `#[uniffi::export]` —— 污染共享 crate，桌面不需要
- 不要在 mobile-core 里重新定义 `AppError` / `AppEvent` 的 "更干净的版本"——对 kind 名字做一一映射就行
- 不要试图用 `swarmnote_core::internal::*` 里的 `NetManager` / `AppSyncCoordinator`——那些是桌面 command 层的深访问，mobile 不碰
- 不要手动 `Arc::new(LocalFs::new(path))` 调 `open_workspace`——走 `AppCoreBuilder` 的 `fs_factory` 默认值

**相关文件**：`packages/swarmnote-core/rust/mobile-core/src/lib.rs`（未来 wrap 代码）、`packages/swarmnote-core/ubrn.config.yaml`、主仓 `swarmnote/crates/core/src/lib.rs` 的 `api` + `internal` 模块、主仓 `swarmnote/openspec/changes/harden-core-for-ffi/` 的 design.md（API 设计决策）
