# 工作区同步

## 三层 IA（P2P 模型下的信息架构）

P2P 同步关系由设备**配对**自动产生，不存在"为工作区授权哪些设备可同步"的概念。所以同步功能按三层视角组织：

| 视角 | 入口 | 页面 | 职责 |
| --- | --- | --- | --- |
| 设备视角 | Settings → Devices | `settings/devices.tsx` → `settings/devices/[peerId].tsx` | 看此设备共享了哪些工作区、取消配对 |
| 工作区视角 | Workspace Manager → Workspace Detail | `workspaces/index.tsx` → `workspaces/[id].tsx` (SyncCard) | 工作区详情内展示"与 N 台设备保持同步 · 最后同步 X · 立即同步"，无配置 |
| 拉取新工作区 | Workspace Manager → "从设备同步" | `workspaces/sync/{select,syncing,done}.tsx` | Wizard 三屏：按设备分组多选 → 多行进度 → 结果 |

**不要做**：不要在 UI 上画"给工作区 A 授权哪些设备"这样的配置 —— 配对即有同步关系，分工作区授权是假概念。

## `WorkspaceInfo.doc_count` 陷阱

`swarmnote_core::WorkspaceInfo` 有一个 `doc_count: u32` 字段，但它在 **`WorkspaceCore::info()` 返回的缓存快照里永远是 0**。真实值只在调用 `WorkspaceCore::fresh_info() -> AppResult<WorkspaceInfo>` 时才查一次 DB row count 回填。

**FFI 层约定**：

```rust
// UniffiAppCore::list_workspaces / workspace_info 都用 fresh_info
for ws in self.inner.list_workspaces().await {
    out.push(ws.fresh_info().await?.into());  // ← 不要 ws.info().clone().into()
}
```

**RN 侧**：`getAppCore().workspaceInfo(uuid)` / `listWorkspaces()` 返回的 `UniffiWorkspaceInfo.docCount` 是 fresh 值，可以直接用。不要 hack 用 `listDocuments().length`（多一次全表扫描，贵）。

**相关文件**：`packages/swarmnote-core/rust/mobile-core/src/app.rs::list_workspaces`, `src/app/workspaces/[id].tsx::InfoCard`

## `lastSyncedAt` 纯前端保留 + AsyncStorage persist

后端 Rust core **不**持久化"最后同步时间戳"。桌面端 `src/stores/syncStore.ts` 也是纯 Zustand 内存，冷启动就丢。移动端对齐桌面语义，但加 persist 中间件让冷启动保留：

```ts
// src/stores/sync-persist-store.ts
export const useSyncPersistStore = create<...>()(
  persist(
    (set) => ({ lastSyncedAt: {}, ... }),
    { name: "swarmnote-sync-persist", storage: createJSONStorage(() => AsyncStorage), ... }
  )
);
```

写入点在 `src/core/event-bus.ts` 的 `SyncCompleted { cancelled: false }` 分支。

**不要**：不要在这里调桌面端不存在的"get_last_sync_at FFI" —— 没有这个 API（调研过 `d:/workspace/swarmnote/src/stores/syncStore.ts`，纯前端内存）。

## `SyncProgress` 事件字段边界

后端 `AppEvent::SyncProgress` 事件只有 4 个字段：`workspace_id / peer_id / completed / total`。

- ✅ UI 可以画：百分比（前端 `completed/total` 自算）、"N/M 篇文档"、elapsed（前端从 `SyncStarted` 自计时）
- ❌ UI 不能画：传输速率（MB/s）、当前文件名、ETA（剩余时间）、字节进度 —— 后端不 emit

扩展字段前先改 `d:/workspace/swarmnote/crates/core/src/events.rs::AppEvent::SyncProgress` + `workspace/sync/full_sync.rs` 的 emit 逻辑。UI 不要提前画。

**相关文件**：`src/core/event-bus.ts`, `src/components/workspace-sync-card.tsx`, `src/app/workspaces/sync/syncing.tsx`

## Wizard 多屏跨页传参用临时 zustand store

Expo Router params 只适合原始字符串。复杂对象（`UniffiRemoteWorkspaceInfo[]` / 同步进度条目）用临时 zustand store 更干净：

```ts
// src/stores/sync-wizard-store.ts
export const useSyncWizardStore = create<SyncWizardState>((set) => ({
  items: [],
  setItems, updateItem, reset,
}));
```

select → syncing 传选中 items；syncing 原位 updateItem；done 从 items 渲染结果；dismiss 前 `reset()` 清空避免下次进入污染状态。

**不要**：不要 JSON.stringify 大对象塞进 router.push params —— URL-encode 成本、类型丢失、嵌套对象反序列化脆弱。

## 触发命令并行 + done 语义事件驱动

`createWorkspaceForSync` / `triggerSyncWithPeer` 都是毫秒级 RPC（Rust 侧 `spawn_full_sync` 立即 return，真正传输在 spawn 里异步跑）。Wizard 用 `Promise.allSettled` 并行触发所有选中项，每项内部状态机：

```text
 pending
    │ onStart
    ▼
 syncing ── createWorkspaceForSync / triggerSyncWithPeer RPC
    │
    │ ✅ SyncCompleted{cancelled:false} 事件到达 → done
    │ ❌ RPC reject → error（保留 localPath 方便 Done 屏打开空工作区）
    │ ⚠️ SyncCompleted{cancelled:true} → 保持 syncing（当前没有用户可达取消路径）
```

**关键：`triggerSyncWithPeer` RPC 返回 ≠ item done**。RPC 返回只代表请求已投递给后端 `spawn_full_sync`，后台可能还在跑 DocList diff / 拉 Yjs update。Wizard 必须订阅 `swarmStore.syncProgress[syncKey]`，等 event-bus 收到 `SyncCompleted{cancelled:false}` 再把 item 标 done。否则 Done 屏点"打开"的瞬间切入工作区，文件树还是空的。

**Mount race 守卫**：Wizard mount 时先读 `useSwarmStore.getState().syncProgress[key]`，若已是 cancelled:false 终态直接标 done，避免漏事件。

**不设超时兜底**：慢工作区 / 慢网络下用户可以点"后台运行"逃生，后端完成时 event-bus 仍会正确落地到 `syncPersist` 和文件树（见下一条）。

**不要**：不要画"大号全局百分比"（把多个并发 session 的 `completed/total` 加权平均）—— 慢项会让数字跳动，用户困惑。桌面端 `WorkspaceSyncDialog.SyncProgressRow` 是多行独立模式，移动端沿用。

**相关文件**：`src/app/workspaces/sync/syncing.tsx`, `d:/workspace/swarmnote/src/components/workspace/WorkspaceSyncDialog.tsx`, `d:/workspace/swarmnote/crates/core/src/workspace/sync/full_sync.rs`

## 同步完成事件 → UI 反应链

mobile 没有 FileWatcher，后端 `full_sync.rs` 完成时只 emit `SyncCompleted`，不 emit `FileTreeChanged`。所以 `SyncCompleted{cancelled:false}` 是 mobile 侧唯一的"工作区内容可能变了"信号，event-bus 要自己兜住：

```ts
// src/core/event-bus.ts::SyncCompleted
if (!cancelled) {
  useSyncPersistStore.getState().setLastSyncedAt(workspaceId, Date.now());
  const active = useWorkspaceStore.getState().info;
  if (active?.id === workspaceId) {
    useFileTreeStore.getState().refresh().catch((err) => { /* warn */ });
  }
}
```

**只刷 active workspace**：后台工作区收到 SyncCompleted 不触发前台 refresh —— 用户下次 `switchWorkspace` 时 `openWorkspaceAt` 的初次 refresh 会拉到最新 DB 状态。

**`cancelled:true` 不刷**：无落地变更，避免无谓的 DB 扫描。

**相关文件**：`src/core/event-bus.ts`, `src/stores/file-tree-store.ts::refresh`

## 破坏性操作按钮规格

两处 destructive filled 按钮统一：`cornerRadius:14`, `height:50`, `bg-destructive`, 前缀 18×18 白色图标 + 16px 600 weight 白色文字。

- 永久删除此工作区（trash-2）
- 取消配对（unlink）

**不包括** "取消同步" —— 同步中屏只提供 outline "后台运行" 按钮（对齐桌面）。后端没 pause/cancel API，不假装能做。

## 暂停按钮当前禁用

Workspace Detail SyncCard 的暂停按钮是 40×40 outline square + `pause` 图标 + `opacity-50` + 下方 "即将推出" micro badge。保留视觉设计意图，等后端补 `cancel_sync_with_peer` API 后再接上。

**不要**：不要让这个按钮可点击但偷偷调 "断网"（语义污染）。

## `getRemoteWorkspaces` 只对在线配对 peer 有效

后端 `get_remote_workspaces()` 并发向所有**在线已配对** peer 发 `ListWorkspaces` 请求，5s 超时。设备离线时此 API 不会返回该 peer 的任何 workspace。

- Paired Device Detail 离线分支：UI 直接渲染 cloud-off 空态 + "工作区列表来自对方设备，设备离线时无法刷新" hint，不调 API
- Wizard Select 屏：空列表态 "未找到可同步的工作区" 提示用户"请确认对方设备已在线并已配对"

**`isLocal` 后端已 join**：结果项的 `isLocal: bool` 是后端和 `AppCore::list_workspaces()` UUID 集合比对过的，前端直接用，不要再 join 一次。

**相关文件**：`packages/swarmnote-core/rust/mobile-core/src/app.rs::get_remote_workspaces`, `src/app/settings/devices/[peerId].tsx`, `src/app/workspaces/sync/select.tsx`

## 取消配对保留本地文件

`unpairDevice(peerId)` 只拆设备关系，**不删除任何本地工作区**。Alert 二次确认文案必须清楚："已下载的笔记仍保留在本地，只是不再与此设备同步。"

P2P + CRDT 模型下每台设备是独立副本，删文件等于销毁本设备独立状态。"取消配对"和"删除工作区"是两个独立动作。

**相关文件**：`src/app/settings/devices/[peerId].tsx::confirmUnpair`
