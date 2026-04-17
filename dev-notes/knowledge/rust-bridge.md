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

- 当前 `mobile-core` 是独立的最小化 crate（验证链路用），后续会 submodule 引入共享 `swarmnote-core` 做真正的 FFI wrap
- ubrn 编译 Android 产物位置可能需要手动 fix（参考 `dev-notes/blog/ubrn-android-build-gradle-fix.md`）

## 待接入：`swarmnote-core` FFI wrap（下一步）

桌面端 `swarmnote-core`（位于 `swarmnote` 主仓 `crates/core/`）已经做完 FFI-friendly hardening（change `harden-core-for-ffi`）。接入步骤：

1. 通过 git submodule 把 `swarmnote-core` 挂到 `packages/swarmnote-core/rust/swarmnote-core/`
2. 在 `rust/mobile-core/Cargo.toml` 里 path 依赖
3. 在 `mobile-core/src/lib.rs` 写**镜像类型 + From 转换**的 wrap，不修改 `swarmnote-core` 本身

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
