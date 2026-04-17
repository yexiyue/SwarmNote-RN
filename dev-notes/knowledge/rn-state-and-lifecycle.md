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

## Expo 依赖使用注意

- **`expo-file-system` v55** 砍掉了 `FileSystem.documentDirectory` 字符串常量，改用 `Paths.document.uri` —— 代码里统一用后者，会返回 `file://...` URI，Rust 侧 `strip_file_uri` 自动剥前缀
- **`expo-secure-store`** 读写字符串，二进制走 base64 转换，**不要**存 `JSON.stringify(uint8array)` —— 会丢字节
- **`react-native` 0.83 的 `AppState`** 有两份类型定义冲突（`Libraries/` vs `types_generated/`），`addEventListener("change", cb)` 可能被 tsc 判为 "expected 1 argument"；用本地 `AppStateLike` 接口 cast 绕过（见 [`network-lifecycle.ts`](../../src/core/network-lifecycle.ts)）
