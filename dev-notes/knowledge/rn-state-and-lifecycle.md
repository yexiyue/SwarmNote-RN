# RN 状态管理与生命周期

mobile-core FFI 桥接完成后，RN 侧有一套稳定的"状态 + 生命周期"约定，核心规则如下。

## Store 分工

五个 Zustand store，每个职责单一，彼此不相互引用：

| Store | 职责 | 是否 persist |
|---|---|---|
| [`swarm-store`](../../src/stores/swarm-store.ts) | P2P 运行时状态：online / devices / pairedDevices / syncProgress / hydrateProgress / keychainEphemeral | ❌ |
| [`onboarding-store`](../../src/stores/onboarding-store.ts) | onboarding 流程状态：hasOnboarded / currentStep / userPath / pairedInOnboarding | ✅ 只 persist `hasOnboarded` + `userPath` |
| [`network-preference-store`](../../src/stores/network-preference-store.ts) | Swarm 页 master toggle：`userWantsNetwork` | ✅ |
| [`workspace-store`](../../src/stores/workspace-store.ts) | 当前 workspace 的 `UniffiWorkspaceInfo` 投影（id/name/path），不含 handle | ❌ |
| [`notification-store`](../../src/stores/notification-store.ts) | 全局通知队列：配对请求、未来可能的升级提示等 | ❌ |

**不要**在 store 里存 `UniffiAppCore` 或 `UniffiWorkspaceCore` handle——native pointer 持久化会崩。workspace handle 走 React Context（见 [`WorkspaceProvider`](../../src/providers/workspace-provider.tsx)），`useWorkspace()` / `useOptionalWorkspace()` 读取。

### Setter-style actions，不在 store 里调 AppCore

stores 只暴露 `setX` actions，**不**在 action 里调 `getAppCore()` —— 这样避免 store 依赖 core bridge，彻底切断循环依赖的可能。需要"事件进来 → 拉新列表 → 写 store"的场景（如 `PairedDeviceAdded/Removed` 只携带单条，需要重新 `listPairedDevices`）统一放在 [`event-bus.ts`](../../src/core/event-bus.ts) 的 `switch` 里做 fire-and-forget refresh。

## 事件桥的单点分发

`ForeignEventBus.emit(event: UniffiAppEvent)` 由 Rust 侧同步调用，全部 15 个变体都在一个 `switch(event.tag)` 里处理，直接写 store。规则：

- **禁止** 在 `emit` 里 await 或跑长任务（Rust 运行时等着它返回）
- 需要异步拉列表的（`PairedDeviceAdded/Removed`）用 `.then().catch()` fire-and-forget
- 每加一个 `UniffiAppEvent` 变体，`event-bus.ts` 的 `default: const _exhaustive: never = event;` 守卫会强制覆盖

`DocFlushed` / `ExternalUpdate` / `ExternalConflict` / `FileTreeChanged` 当前不写 store —— 编辑器 WebView 桥和 workspace 文件树 hook 将来会各自订阅。

### `pairedDevices` 双路径填充：NodeStarted + 增量事件

`swarmStore.pairedDevices` 由两条路径写入，缺一不可：

1. **节点启动兜底**：`NodeStarted` 分支调用 `refreshPairedDevices()`，把后端启动时装入内存的配对缓存一次性拉到前端。Rust core **不会**为已存在的配对关系补发 `PairedDeviceAdded` 事件，没有这一步冷启动后 store 永远 `[]`。
2. **运行时增量**：`PairedDeviceAdded` / `PairedDeviceRemoved` 事件触发同一个 `refreshPairedDevices()` 拉全量列表。

**不要**只靠某个 UI 页面 mount 时 `useEffect` 拉一次——`pairedDevices` 被 `settings/devices.tsx`、`settings/devices/[peerId].tsx`、`settings/network.tsx`、`workspace-sync-card.tsx` 等多个组件消费，逐个挂 effect 容易漏写，且用户可能不经过 devices 页面。

`NodeStopped` 时**不**清空 `pairedDevices`（不在 `resetRuntimeFields()` 里）：配对关系与节点运行状态正交，离线时 UI 仍要展示历史配对记录（每条带 `isOnline=false`），与桌面端 `pairingStore` 行为一致。

### Pairing emit 责任在 host shell，不在 PairingManager

`swarmnote_core::PairingManager` 自身**只对对端**那一侧（接收方）发事件——本端是 host shell 的职责。host shell 指的是：

- 桌面端：`src-tauri/src/commands/pairing.rs` 的 Tauri 命令
- 移动端：`packages/swarmnote-core/rust/mobile-core/src/pairing.rs` 的 `UniffiAppCore` wrapper 方法

三个成功的 pairing transition 都必须由 host shell 主动 emit，缺一不可：

| Wrapper | 触发条件 | emit 序列 |
|---|---|---|
| `request_pairing` | `PairingResponse::Success` | `PairedDeviceAdded { info: None }` → `DevicesChanged` |
| `respond_pairing_request` | `handle_pairing_request` 返回 `Some(info)` | `PairedDeviceAdded { info: Some(info) }` → `DevicesChanged` |
| `unpair_device` | `pm.unpair` 成功 | `PairedDeviceRemoved { peer_id }` → `DevicesChanged` |

`DevicesChanged` 是必要补充（`emit_devices_changed(core, bus)` helper）：发现列表里该设备的 `is_paired` 标志变化后，"附近设备"区需要重新过滤。

如果只 emit `PairedDeviceAdded/Removed` 漏了 `DevicesChanged`，已配对区会刷新但附近设备区会出现"明明已配对了还显示在 nearby"的不一致——这是早期 mobile-core 漏 emit 时的实际现象。

**未来若新增 pairing wrapper**：参照这套模式，不要假设 `PairingManager` 会替你发事件。

## P2P 网络生命周期

两层控制，严格分离：

```
用户意愿 (master toggle, 持久化)      系统状态 (AppState)
         │                                    │
         └────────── NetworkLifecycle ────────┘
                          │
                  reconcile() ─► startNetwork / stopNetwork
```

### 规则

| master toggle | AppState | 动作 |
|---|---|---|
| off | 任何 | 立即 stopNetwork，AppState 失效 |
| on | active | startNetwork |
| on | background | 30s 后 stopNetwork，30s 内回 active → 取消 |
| on | inactive | 忽略（iOS 的短暂过渡态） |

`NetworkLifecycle` 只在 **`(tabs)` 分支挂载**（见 [`NetworkLifecycleMounter`](../../src/components/network-lifecycle-mounter.tsx)）—— onboarding 期间 `Pairing` 页自己调 `startNetwork` / `generatePairingCode`，不受 AppState 干扰。

### 为什么选"30s 延迟 stop"而不是激进 stop / 永久保活

- iOS 后台默认 ~30s 天花板（`beginBackgroundTask` 机制），试图永久保活要 VoIP / Audio background mode，对 P2P 语义不匹配且审核风险高
- Android 永久保活要 Foreground Service + 常驻通知，体感重，留给后续换开关做
- 30s 覆盖"切出去拍照 / 回条消息"的高频场景，代价是长时间后台回来有 3–10s 冷启延迟
- 设计稿 Swarm 页的 master toggle 提供了用户 override 通道

### Zustand v5 selector-subscribe 需要 middleware

`useStore.subscribe(selector, listener)` 两参模式在 v5 **默认不支持**，需要在 create 时包一层 `subscribeWithSelector` middleware，否则 tsc 报 `Expected 1 arguments, but got 2`。`network-preference-store` 是目前唯一需要的 store，写法参考：

```ts
export const useNetworkPreferenceStore = create<State>()(
  subscribeWithSelector(
    persist((set) => ({ ... }), { name: "...", storage: ... }),
  ),
);
```

## Pairing 请求全局队列

后端任何时刻都可能 emit `PairingRequestReceived`，为避免并发请求互相覆盖：

1. `event-bus.ts` 收到事件时 `push` 进 `notification-store` 的队列
2. [`PairingRequestHost`](../../src/components/pairing-request-host.tsx) 在 `_layout.tsx` 根层挂载，监听 `current` slice 渲染 `AlertDialog`
3. 用户接受 / 拒绝 / 过期 → `respond(id)`，下一条自动 promote 为 `current`

`pendingId` 是 `bigint`（uniffi u64），**不要**转成 `Number`，高位会丢。

## 路由 gate

`src/app/_layout.tsx` 在启动时 `Promise.all([restoreThemePreference(), waitForOnboardingHydration(), initAppCore()])`，三者全部 resolve 后才渲染 `<Stack>`。

`src/app/index.tsx` 根据 `hasOnboarded` 做 `<Redirect>`：

- `false` → `/onboarding/welcome`（Stack 分支）
- `true` → `/(tabs)`（NativeTabs 分支，内部 `openDefaultWorkspace()` 后再挂 `NetworkLifecycleMounter`）

Onboarding 4 步是强制顺序流（`gestureEnabled: false`），最后一步 `markCompleted()` + `router.replace('/(tabs)')`。

### "无工作区"是路由级 redirect，不是叶子页面的特殊分支

`(main)/_layout.tsx` 在 `openLastOrDefault()` resolve 为 `null` 时返回 `<Redirect href="/workspaces" />`，让用户落到独立的 [`/workspaces`](../../src/app/workspaces/) 顶级 stack（与 `(main)`、`settings` 平级）。

**不要**在 `(main)/index.tsx` 内联渲染"还没有工作区"的空态屏幕——这种写法的隐患是：在 modal/兄弟 stack 里创建完工作区返回时，`(main)/_layout` 已经挂载且 `useEffect` 不会再跑，新工作区不会被 `openLastOrDefault` 拾取，CTA 看起来"按了没用"。

**正确模式**：

1. 资源缺失 → 路由级 `<Redirect>` 到对应管理页
2. 创建/切换资源后 → `router.dismissAll() + router.replace("/(main)")`
3. `replace("/(main)")` 强制 `(main)/_layout` 重新挂载 → `useEffect` 重新跑 boot probe → 拿到刚创建的资源

`createWorkspace` / `switchWorkspace` 内部已经 `openWorkspaceAt`（[workspace-manager.ts](../../src/core/workspace-manager.ts)）写了 `activeWorkspace` 模块状态和 `useWorkspaceStore.setInfo`，新挂载的 `(main)/_layout` 走 `openLastOrDefault → openWorkspaceAt` 时会命中"同 path 已激活"的快路径，不会重复 hydrate。

### `router.canGoBack()` 用于顶层页面的返回按钮条件渲染

如果一个页面既可能作为顶层 redirect 落点（无返回历史），也可能从其他页面 push 进来，header 的返回按钮要按 `router.canGoBack()` 条件渲染，避免出现"按了没反应的返回按钮"。

参考 [`workspaces/index.tsx`](../../src/app/workspaces/index.tsx) header 区，从 `(main)` 或 settings push 时显示返回按钮，作为首次启动的 redirect 落点时不显示。`router.canGoBack()` 是同步方法，组件渲染时直接读即可。

## 文件树 / 笔记的 store 边界

文件面板涉及 3 个独立 store，**不要**合并：

| Store | 内容 | 持久化 |
|---|---|---|
| [`file-tree-store`](../../src/stores/file-tree-store.ts) | `tree: UniffiFileTreeNode[] \| null` + `loading` + `refresh()` | ❌ |
| [`current-doc-store`](../../src/stores/current-doc-store.ts) | `docUuid? / relPath? / initialState? / openState` + `open(relPath) / close() / reset()` | ❌ |
| [`files-ui-store`](../../src/stores/files-ui-store.ts) | `selectedNodeId / expandedFolderIds: Set / draft` + 全套 actions | ❌ |

**关键点**：

- 三个 store 的更新频率/订阅者完全不同：tree 数据变化稀疏；当前文档常变；UI 选中态最频繁。合并会带来无关 re-render。
- `current-doc-store.open(relPath)` 内部用一个**模块级 `openSeq` 计数器**抢占快速点击：每次 `open()` 自增；async 流程拿到结果时若 `seq !== openSeq` 则丢弃并 `closeDoc` 释放。`close()` 与 `reset()` 也 bump 该 seq。这套模式比"AbortController + race"实现起来简单很多。
- `tree` 不要持有 Y.Doc 或 native handle。Yjs 实例由 Rust 侧持有（`workspace.openDoc → {docUuid, yjsState}`），RN 侧只缓存元数据。

### 移动端无 FileWatcher，创建后必须手动 refresh

`FileTreeChanged` 事件在移动端**仅** `move_node` 显式 emit；纯 DB 操作（`createFolder` / `upsertDocument`）不会触发。同时 `scan_tree` 是物理 fs 扫描，所以新建流程必须按"fs 操作 → DB 操作 → 手动 refresh"的顺序：

```
新建文件夹: workspace.createDir(relPath)
         → workspace.createFolder({parentFolderId: undefined, name, relPath})
         → useFileTreeStore.refresh()

新建笔记:   workspace.writeText(relPath, "")
         → workspace.upsertDocument({folderId: undefined, title, relPath, fileHash: undefined})
         → useFileTreeStore.refresh()
```

[`src/core/files-actions.ts`](../../src/core/files-actions.ts) 封装了这两条流程，store 不直接调 Rust（保持 setter-only 约定）。

MVP 设计：DB 层的 `parent_folder_id` / `folder_id` 一律传 `undefined`（虚拟根），因为 `scan_tree` 走物理路径渲染树，DB folder 行只是元数据。等出现"按文件夹过滤文档"等场景再补 UUID 索引。

### Inline rename 状态机

[`files-ui-store`](../../src/stores/files-ui-store.ts) 维护单一 `draft`：

```
idle ──startDraft({kind, parentRelPath})──▶ creating(submitting=false)
                                              │
                              setDraftName(name) ──▶ creating(name)
                              onSubmit:  trim()=='' ──▶ idle (取消)
                                         else ──▶ submitting=true
                                                   ├─ ok  ─▶ idle (FileTreeChanged or 手动 refresh)
                                                   └─ err ─▶ creating + setDraftError
                              ✕ / cancelDraft() ───────▶ idle
```

**parentRelPath 派生（按 selection）**：

| selection | parentRelPath |
|---|---|
| 文件夹 | 该文件夹的 relPath（= 其 id） |
| 文件 | 文件的 dirname（lastIndexOf('/')） |
| null | null（根） |

详见 [`files-panel.tsx`](../../src/components/files-panel.tsx) 的 `deriveParentRelPath`。

### 工作区切换时的 store 重置

[`workspace-manager.closeWorkspace()`](../../src/core/workspace-manager.ts) 在 `await ws.close()` **前**依序调用：

```ts
useCurrentDocStore.getState().reset();
useFileTreeStore.getState().reset();
useFilesUiStore.getState().reset();
```

这样一来切换工作区后没有任何脏数据带到下一个 workspace。reset 在 close 之前执行，避免任何订阅者在 teardown 中途仍尝试用已死的 handle 触发刷新。

## Expo 依赖使用注意

- **`expo-file-system` v55** 砍掉了 `FileSystem.documentDirectory` 字符串常量，改用 `Paths.document.uri` —— 代码里统一用后者，会返回 `file://...` URI，Rust 侧 `strip_file_uri` 自动剥前缀
- **`expo-secure-store`** 读写字符串，二进制走 base64 转换，**不要**存 `JSON.stringify(uint8array)` —— 会丢字节
- **`react-native` 0.83 的 `AppState`** 有两份类型定义冲突（`Libraries/` vs `types_generated/`），`addEventListener("change", cb)` 可能被 tsc 判为 "expected 1 argument"；用本地 `AppStateLike` 接口 cast 绕过（见 [`network-lifecycle.ts`](../../src/core/network-lifecycle.ts)）
