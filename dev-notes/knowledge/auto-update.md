# Android in-app updater

应用启动后自动检查 UpgradeLink、提示用户、下载 APK、调系统 PackageInstaller 完成升级。**Android-only**,iOS 上整套机制 no-op(必须走 App Store)。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│ src/app/_layout.tsx (ready === true)                        │
│   └─ setTimeout 2s + AppState change=active                 │
│        └─ useUpdateStore.checkForUpdate()                   │
└──────────────┬──────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│ src/lib/upgrade/client.ts                                   │
│   POST https://api.upgrade.toolsetlink.com/v1/apk/upgrade   │
│   headers: x-Timestamp / x-Nonce / x-AccessKey / x-Signature│
│   sig = MD5(body=...&nonce=...&secretKey=...&timestamp=...&url=...)│
└──────────────┬──────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│ src/stores/update-store.ts (Zustand)                        │
│   state machine: idle → checking → up-to-date / available  │
│                                  / force-required          │
│                  → downloading → ready / error             │
│   AsyncStorage key `update-dismiss` 持久化"稍后"标记         │
└──────────────┬──────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│ src/components/update/UpdateHost.tsx                        │
│   ├─ UpdateDialog        (status === 'available')           │
│   ├─ ForceUpdateDialog   (status === 'force-required')      │
│   └─ UpdateProgressDialog(status === 'downloading')         │
└──────────────┬──────────────────────────────────────────────┘
               ▼ 用户点 [立即更新]
┌─────────────────────────────────────────────────────────────┐
│ src/lib/upgrade/installer.ts                                │
│   FileSystem.createDownloadResumable → cacheDirectory        │
│   FileSystem.getContentUriAsync → content:// URI            │
│   IntentLauncher.startActivityAsync('android.intent.action.VIEW',│
│      { data: contentUri, type: 'application/vnd.android.package-archive', flags })│
│   ↓                                                          │
│   系统弹 PackageInstaller 用户点"安装"                        │
└─────────────────────────────────────────────────────────────┘
```

## UpgradeLink 设计取舍

- **secret 接受 client embed**:`EXPO_PUBLIC_UPGRADELINK_ACCESS_KEY/_SECRET/_APK_KEY` 通过 Metro 在 build 时 inline 进 JS bundle。攻击者反编译能拿到 secret,但 secret 只能查询/上报,**不能发布版本**(发布是 GitHub Action 用同一对 secret 在 server-side)。这跟桌面端 SwarmDrop 的取舍一致。
- **签名是 MD5,不是 HMAC**:UpgradeLink 自己定的轻量协议,直接 `Crypto.digestStringAsync(MD5, ...)`,不需要任何第三方依赖。
- **没有匿名查询端点**:所有 endpoint 都要签名。
- **`apk` app_type 不支持 `min_version`**:强制更新只能在 UpgradeLink 控制台手动配置,GitHub Action 没有 input 透传这个字段。

## REQUEST_INSTALL_PACKAGES 权限

Android 8+ 要求第三方 App 申请 `REQUEST_INSTALL_PACKAGES` 才能调起 PackageInstaller。这个权限通过 [plugins/with-android-install-permission.js](../../plugins/with-android-install-permission.js) 在 `expo prebuild` 时注入 `AndroidManifest.xml`,因为 manifest 由 prebuild 生成,直接改会被覆盖。

用户首次更新时,系统会弹"允许此应用安装未知应用"的设置页,授权后回到 App 重试一次即可。**不上 Play Store** 是这个权限的前提 — Play Store 对未知来源安装权限管控严格。

## FileProvider 与 content:// URI

Android 7+ 不允许跨进程 file:// URI(`FileUriExposedException`)。我们用 `FileSystem.getContentUriAsync(file://...)` 把 cacheDirectory 里的 APK 路径转成 `content://`,expo-file-system 内部已经处理好 FileProvider 的 manifest 配置,我们不需要自己写。

## expo-file-system v18+ legacy API

SDK 55 起 expo-file-system 默认 API 是 OOP(`Paths` / `File` / `Directory`),但**新 API 还没暴露下载进度回调和 `getContentUriAsync`**。我们 fallback 到 `expo-file-system/legacy` 用旧的过程式 API。其他业务代码继续用新 API,无冲突。

## 失败模式

| 场景 | 行为 |
|---|---|
| UpgradeLink 服务挂 | silent fail,store 状态变 `up-to-date`(等同无新版) |
| 网络断 | 同上,下次启动/回前台重试 |
| `EXPO_PUBLIC_*` 未配 | console.warn 一次,store `up-to-date`,App 正常使用 |
| 用户拒绝 `REQUEST_INSTALL_PACKAGES` | 系统跳设置页,用户回来后可重试 |
| 下载途中切走 App | expo-file-system 不保证后台续传,下次启动重新下完整 APK |
| 安装中用户取消 | App 进程不变,下次 checkForUpdate 仍会弹 |

## 检查时机

- **冷启动** + 2 秒延迟(`_layout.tsx` ready 后挂 effect)
- **回前台**(`AppState change=active`)且距 lastCheckedAt ≥ 12h
- **手动**(设置页"检查更新"按钮调 `checkForUpdate(true)`,bypass 12h 节流)

## Dismiss 缓存

用户点"稍后"后,`{ tag, dismissedAt }` 写入 AsyncStorage `update-dismiss`,24h 内同 tag 不再弹。**强制更新无视 dismiss**(force-required 状态根本没"稍后"按钮)。

## 跟桌面端 SwarmDrop 的差异

| 维度 | SwarmDrop 桌面 | SwarmNote 移动 |
|---|---|---|
| API 客户端 | `@tauri-apps/plugin-http` + `js-md5` | RN `fetch` + `expo-crypto` |
| 下载/安装 | Tauri Updater(自动) / Tauri 插件(Android) | `expo-file-system/legacy` + `expo-intent-launcher` |
| Secret embed 方式 | `VITE_*`(Vite build) | `EXPO_PUBLIC_*`(Metro bundle) |
| 强制重启 | Tauri Updater 自动重启进程 | Android PackageInstaller 接管 |

## 相关文件

- [src/lib/upgrade/client.ts](../../src/lib/upgrade/client.ts) — UpgradeLink HTTP API
- [src/lib/upgrade/installer.ts](../../src/lib/upgrade/installer.ts) — APK 下载 + 安装
- [src/stores/update-store.ts](../../src/stores/update-store.ts) — Zustand 状态机
- [src/components/update/](../../src/components/update/) — 4 个 dialog 组件
- [plugins/with-android-install-permission.js](../../plugins/with-android-install-permission.js) — REQUEST_INSTALL_PACKAGES Expo plugin
- [.github/workflows/release.yml](../../.github/workflows/release.yml) — `upgradelink-upload` job

## 未来优化(本期未做)

### 通知栏进度

主流 Android App 在下载更新时会在系统通知栏显示进度条(`Notification.Builder.setProgress(max, progress, false)`)。这要求:

- 启动一个 foreground service 持有下载任务
- 用 `expo-notifications` 创建带 progress 字段的通知,实时 update

`expo-notifications` 当前**没有**直接暴露 Android 的 `setProgress` API,需要要么写 native module 要么换用 `react-native-blob-util`(它的 `config({ android: { notification: true, progressNotificationDelay: ... } })` 自带通知栏进度)。

但 `react-native-blob-util` 是一个相对重的原生依赖,且我们当前 Dialog 内的进度条体验已经合格。**留给 v0.3+** 决定要不要做。

### 后台续传

下载途中如果用户切走 App,Android 上 `expo-file-system/legacy` 不保证 background continuation,我们当前下次启动会重新下整包。如果要做:同样需要 foreground service。同上,**v0.3+**。

### 自动重启 App

桌面端 Tauri Updater 装完会自动重启进程。Android 上 PackageInstaller 装完后,系统会引导用户"打开新版"或留在 launcher,**第三方 App 不能强制 launcher app**。这是 Android 平台限制,无法绕过。

## 强制更新的限制(已知)

UpgradeLink action 的 `apk` app_type **不支持** `min_version` / `force_below_version` 字段。如果想强制旧版本必须升级,只能通过 UpgradeLink 控制台手动设置(每个版本有"提示升级 / 强制升级 / 静默升级"选项)。客户端拿到 `upgradeType=2` 之后会渲染 ForceUpdateDialog。

未来如果要 CI 自动设置强制版本号,需要要么:
- 改用 UpgradeLink 的更高级 API(可能要付费 plan)
- 自己写一个 step 直接调 UpgradeLink 控制台 API 设置强制
- 或在 `prompt_upgrade_content` 里嵌入约定的 marker,客户端解析后强制(hacky)

短期建议:**手动**在控制台设。
