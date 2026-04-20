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

- ubrn 构建工具链 / 代码生成踩坑（iOS deployment target、async static 生成 bug、cargo git 鉴权）见 `dev-notes/knowledge/ubrn.md`
- ubrn 编译 Android 产物位置可能需要手动 fix（参考 `dev-notes/blog/ubrn-android-build-gradle-fix.md`）

### `open_workspace` 要求目录已存在，否则 `InvalidPath`

`swarmnote_core::AppCore::open_workspace` 第一步就 `path.is_dir()`，返回 false 直接抛 `AppError::InvalidPath` → FFI 层映射为 `FfiError.InvalidPath`。mobile 侧首启时 `${document}/default` 还没建出来，调用会失败。

**正确做法**：RN 侧在调 `openWorkspace` 前用 `new Directory(Paths.document, "default").create({ intermediates: true, idempotent: true })` 兜底创建。Rust 侧保持"目录必须存在"的语义，不要改成自动 mkdir——核心要区分"用户指定了不存在的路径"和"刚创建的空 workspace"。

**不要做**：不要在 Rust wrap 层 `std::fs::create_dir_all(&path)`。那会掩盖用户误输入外部路径的错误（如果 `open_workspace` 接受任意挂载路径）。创建目录是 host 的职责。

**相关文件**：`src/core/workspace-manager.ts::ensureDefaultWorkspaceDir`

### uniffi async 方法必须标 `async_runtime = "tokio"`

`#[uniffi::export] impl` 块里含 `async fn` 时，如果不加 `async_runtime = "tokio"`，生成的桥接代码会用 uniffi 默认的 futures executor，它**不是 tokio Reactor**——`sea-orm` / `tokio::fs` 等任何依赖 tokio reactor 的 future 会立刻 panic `there is no reactor running, must be called from the context of a Tokio 1.x runtime`。

**正确做法**：
```rust
#[uniffi::export(async_runtime = "tokio")]
impl UniffiAppCore {
    pub async fn start_network(&self) -> Result<(), FfiError> { ... }
}
```

`Cargo.toml` 的 uniffi 依赖也要启用 `tokio` feature：
```toml
uniffi = { version = "0.31", features = ["bindgen", "build", "cli", "tokio"] }
```

所有含 async 方法的 impl 块都要标（`app.rs` / `pairing.rs` / `device.rs` / `workspace.rs`）。模块级 async 函数同理。

**症状**：运行时首个 async 调用（一般是 `UniffiAppCore::create`）panic `[Error: Rust panic]` 但栈看不到具体原因；只有 adb logcat 能看到 `no reactor running`。

**相关文件**：`packages/swarmnote-core/rust/mobile-core/src/app.rs`、`device.rs`、`pairing.rs`、`workspace.rs`

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

**8. `move_node` 用公共 API 组装，不走子模块 ops**

mobile 的 `move_node` 用 `fs().rename() + rebase_documents_by_prefix() / rebase_document() + ydoc().rename_doc() + event_bus().emit(FileTreeChanged)` 组合实现。桌面端过去用 `internal::fs::ops::move_node`；flatten 后桌面也走公共组合，两端语义一致。

### 顶层扁平 public surface（上游 flatten 后）

上游 swarmnote `crates/core`（2026-04 commit bdb52b7，change `flatten-core-module-layout`）把 `swarmnote_core::api::*` 和 `swarmnote_core::internal::*` 两个 re-export 命名空间都废除了，统一走根级单层 `pub use`。mobile-core 的 import 已迁移为：

```rust
use swarmnote_core::{
    // host 核心 + 平台注入 trait
    AppCore, AppCoreBuilder, WorkspaceCore, WorkspaceInfo,
    FsFactory, WatcherFactory,
    FileSystem, FileWatcher, FileTreeNode, LocalFs,
    EventBus, AppEvent, KeychainProvider,
    // 错误与身份
    AppError, AppResult, IdentityManager, DeviceInfo,
    // 设备 / 配对 / 网络
    Device, DeviceFilter, DeviceListResult, DeviceManager, DeviceStatus,
    PairedDeviceInfo, PairingCodeInfo, PairingManager,
    AppNetClient, NetManager, NodeStatus,
    // 文档 / yjs
    DocumentCrud, UpsertDocumentInput, CreateFolderInput,
    YDocManager, OpenDocResult, ReloadStatus,
    // hydrate（原在 yjs::doc_state::，现顶层可达）
    hydrate_workspace, HydrateResult, HydrateProgress, HydrateProgressFn,
    AppSyncCoordinator, WorkspaceSync, ensure_workspace_row,
};
// 命名空间型 API 仍走子路径
use swarmnote_core::protocol::{AppRequest, AppResponse, OsInfo};
use swarmnote_core::config::{save_config, RecentWorkspace};
```

以前 mobile-core 被 D5 分类挡在 `internal::` 外面的 `hydrate_workspace` / `AppSyncCoordinator` / `ensure_workspace_row` 现在可直接 `use`——D5 的 "wrapper 只消费 api、桌面才用 internal" 前提在 mobile-core 实际 wrap 时就被推翻了（mobile 同样需要 hydrate + sync coordinator）。

**不要**再写 `swarmnote_core::api::X` 或 `swarmnote_core::internal::Y`——这两个模块根本不存在，编译器会直接报 `could not find \`api\` / \`internal\` in \`swarmnote_core\``。

### mobile-core wrap 不要只代理 core，必须对照桌面 Tauri command 的"额外副作用"

mobile-core 的 wrap 方法默认会写成"对 `self.inner.xxx()` 的一行透传"。这是**陷阱**——桌面端的 Tauri command（`src-tauri/src/commands/*.rs`）经常在 core 调用之外**还**做了关键的副作用，比如发布到 P2P / 触发额外事件。如果 wrap 只代理 core 调用，编译通过、单端工作正常，但跨端协作 / 远端 sync / 状态广播会**静默失效**。

**已经栽过的坑**：

`apply_update` mobile 端最初只调 `self.inner.ydoc().apply_update(uuid, &update)`，落盘正常，但跨设备协同永远不工作。原因是桌面端的 `apply_ydoc_update` (`src-tauri/src/commands/yjs.rs`) 在 core 调用之后还有：

```rust
if let Some(ws_sync) = ws.sync().await {
    ws_sync.publish_doc_update(uuid, update).await;  // ← mobile 漏了这个
}
```

修复后 mobile-core 的 `apply_update` 也要带上这个 publish：

```rust
pub async fn apply_update(&self, doc_uuid: String, update: Vec<u8>) -> Result<(), FfiError> {
    let uuid = parse_uuid("doc_uuid", &doc_uuid)?;
    self.inner.ydoc().apply_update(uuid, &update).await.map_err(FfiError::from)?;
    if let Some(ws_sync) = self.inner.sync().await {
        ws_sync.publish_doc_update(uuid, update).await;
    }
    Ok(())
}
```

**正确做法**：每加一个 wrap 方法，**必读**桌面端同名 Tauri command 的完整实现，把里面 `if let Some(...)` / `event_bus().emit(...)` / 多步组合等副作用也搬到 mobile 上。如果桌面端没有对应 command（核心方法只在 sync 内部调用），这条不适用。

**症状识别**：本端编辑一切正常但远端收不到 / 远端事件本端不响应 → 大概率是 wrap 缺失某个 broadcast / emit 调用。

**相关文件**：[`packages/swarmnote-core/rust/mobile-core/src/workspace.rs::apply_update`](../../packages/swarmnote-core/rust/mobile-core/src/workspace.rs)、`SwarmNote/src-tauri/src/commands/yjs.rs::apply_ydoc_update`

### 临时切 swarmnote-core 为本地 path 依赖快速迭代

当需要在 mobile-core 的 wrap 层试用 / 调试 swarmnote-core 还没推到 git develop 的新 API（或者反过来：先在本地试改 swarmnote-core 看 mobile-core 调起来对不对），临时把 git 依赖切成 path 依赖最快。

**前提**：本地有 `SwarmNote` 仓库（桌面端工作树）`/Users/yexiyue/workspace/SwarmNote/`，包含 `crates/core` 与 `crates/entity`。

**1. 改 [packages/swarmnote-core/rust/mobile-core/Cargo.toml](../../packages/swarmnote-core/rust/mobile-core/Cargo.toml)**：注释掉 git 行，加 path 行（保留 git 行作为还原参考）：

```toml
# swarmnote-core = { git = "https://github.com/yexiyue/swarmnote.git", branch = "develop" }
# entity = { git = "https://github.com/yexiyue/swarmnote.git", branch = "develop" }
swarmnote-core = { path = "/Users/yexiyue/workspace/SwarmNote/crates/core" }
entity = { path = "/Users/yexiyue/workspace/SwarmNote/crates/entity" }
```

**2. 直接 cargo check** —— path 依赖会沿父目录找到 `SwarmNote` 根 `Cargo.toml` 的 `workspace.dependencies`，自动解析 swarmnote-core 内部的 `tokio = { workspace = true }` 等条目，不需要额外配置。首次会编译整个核心树（约 1 分钟），后续增量编译秒级。

**3. 还原 = 反向编辑 + cargo update**：

```bash
# 把 path 行注释、解开 git 行注释
cargo update -p swarmnote-core -p entity   # 让 lockfile 重新指向 git revision
cargo check                                # 验证 git 版本编译通过
```

**4. 跑 ubrn 重新生成产物**：只在 wrap 层签名（uniffi `pub` 方法）有变更时需要；纯实现内调整不影响 TS bindings。

```bash
pnpm --filter react-native-swarmnote-core ubrn:ios     # 或 :android
```

**坑**：

- **不要忘记还原 path → git 就 commit**：CI / 别人 clone 后 cargo 会找不到 `/Users/yexiyue/workspace/SwarmNote`。Cargo.toml 顶部留一段注释提醒"TEMPORARY"，commit 前 grep 一下。
- **lockfile 同步**：path 模式下 Cargo.lock 会写成 `swarmnote-core = "0.1.0"`（无 source URL）；切回 git 时 `cargo update -p swarmnote-core -p entity` 重写为 `git+https://...?branch=develop#<commit>`。如果忘了 update，下次别人 clone 会看到 lockfile 没 git source 报错。
- **submodule 自动归位**：cargo update 拉 git develop branch 时，会把 SwarmNote 仓库的 `libs/` submodule pointer 重置为 develop HEAD 引用的 commit。如果你之前手动在 SwarmNote 仓库 bump 过 libs（GossipSub 那种 case），改 path 时不会被影响，但还原后 cargo 会按 git 拉，本地 SwarmNote 仓库的 libs 会被恢复到 develop branch 引用的 commit——**任何对 libs 的改动应该先在 SwarmNote 仓库 commit + 推 develop**，才不会被还原步骤吞掉。
- **path 模式不能用于真机分发**：path 引用是绝对路径，只对当前开发机有效。CI / 其他开发者 clone 后会编译失败。把这个看成"本地 spike 工具"，spike 完一定要还原。

**相关 commit 经验**：本次 `apply_update + publish_doc_update` 修复就是用这条流程在 mobile-core wrap 层迭代验证后才推回 git。

### 给 mobile-core 加一个新 FFI API 的模板

每次要给 RN 暴露一个新能力时，按这五步走，避免漏步：

1. **types.rs** —— 新增 `UniffiFooResult` / `UniffiFooInput` 之类的 FFI 类型（`#[derive(uniffi::Record)]` 或 `#[derive(uniffi::Enum)]`），如果有对应的 core 类型，同时 `impl From<core::Foo> for UniffiFoo`。`usize` / `u64` / `i64` 要显式选一个（uniffi 不支持 `usize`，移动端常用 `u64`）。
2. **events.rs** —— 如果新能力需要回传进度 / 变化，在 `UniffiAppEvent` enum 加变体（不改共享 crate 的 `AppEvent`）。在 `UniffiEventBusAdapter` 加一个 `emit_xxx()` helper 供 wrap 层调（直接 `foreign.emit(UniffiAppEvent::Xxx { ... })`），不走 `map_event`——它只映射来自 core 的原生事件。
3. **对应 Object 方法** —— 在 `app.rs` 的 `UniffiAppCore` 或 `workspace.rs` 的 `UniffiWorkspaceCore` 的 `#[uniffi::export] impl` 块里加 `pub async fn foo(&self, ...)`，内部调 `self.inner.xxx()` 或顶层 `swarmnote_core::bar(...)`。错误转换用 `.map_err(Into::into)`；字符串 UUID 用 `parse_uuid("workspace_id", &s)`。如果需要 event bus，从 `self.event_bus.clone()`（`UniffiAppCore.event_bus` / `UniffiWorkspaceCore.event_bus` 都持一份 `Arc<UniffiEventBusAdapter>`）拿。
4. **模块级函数**（不需要 `AppCore` 实例） —— 直接 `#[uniffi::export] pub fn foo() -> Result<T, FfiError>` 写在对应 module 顶层（例：`keychain.rs::generate_keypair_bytes()`）。TS 侧变成 `import { foo } from 'react-native-swarmnote-core';`。
5. **重新生成 + 后处理** —— 跑 `pnpm --filter react-native-swarmnote-core ubrn:android`（或 `ubrn:ios`）；它会：
   - 重编 Rust 到四个 Android target (arm64-v8a / armv7 / x86 / x86_64)
   - 重新生成 `src/generated/mobile_core{,-ffi}.ts` 和 `cpp/generated/*`
   - 复制 `.a` 到 `android/src/main/jniLibs/<abi>/libmobile_core.a`
   - 跑 `scripts/fix-ubrn-output.mjs` 修 async-static 的已知 bug

   再跑 `pnpm --filter react-native-swarmnote-core prepare` 重新编译 `lib/typescript/*.d.ts`（builder-bob 输出的类型产物才是 tsc 看的入口——忘记跑这步会导致"property 'foo' does not exist on type 'UniffiAppCoreLike'"）。

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
