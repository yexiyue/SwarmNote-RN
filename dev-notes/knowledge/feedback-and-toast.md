# 用户反馈与 Toast 政策

移动端所有"操作完成 / 操作失败"的 UI 反馈都通过这一层规范，**不要**直接 `import` `react-native-notifier`，统一通过 `@/lib/toast` 调用。

## 唯一入口

```ts
import { toast } from "@/lib/toast";

toast.success(t`已复制`);                     // 过去分词回执
toast.info(t`重启后生效`);                    // 中性提示
toast.error(t`保存失败`, err);                // 自动 errorMessage(err) 进 description + Haptics 振动
toast.promise(p, {                            // 同步 / 网络等异步流转
  loading: t`正在同步…`,
  success: (r) => r.length === 0 ? t`同步完成` : t`部分设备同步失败`,
  error: t`同步失败`,
});
```

`toast.error` 的第二参数可以是 `unknown`（错误对象）也可以是 `{ description, duration }`，封装层会判别。

## Alert vs Toast 边界

| 场景 | 用什么 | 例子 |
|------|-------|------|
| 破坏性操作的二次确认 | `Alert.alert` 或 RNR `<AlertDialog>` | 取消配对、删除文件 |
| 用户正在等结果的同步阻塞错误 | `Alert.alert` | `current-doc-store` 打开笔记失败（路由跳转后才暴露的失败） |
| 后台行为失败、部分成功、纯回执 | `toast` | 同步失败、复制成功、保存成功 |
| 用户感知不到的内部错误 | 仅 `console.warn`，**不**弹 toast | event-bus 内部刷新、被动 hydrate / refresh |

判断要点："用户主动触发的操作？"+"如果不告诉，他会不会以为成功了/失败了？"两个都为是→toast 或 Alert；任一为否→静默 + 日志。

## 文案规范

- **必须**走 Lingui：组件里用 ``` t`...` ```，模块层（store / core）用 `i18n._(msg`...`)`，确保 `pnpm lingui:extract` 能拾取。
- `toast.error` 主标题 = 简短动作短语（`同步失败`、`保存失败`、`复制失败`、`联网失败`）；细节走 description（自动从 `errorMessage(err)` 拿）。
- `toast.success` 文案 = 过去分词回执（`已复制`、`已保存`、`同步完成`、`主题已更新`）；不要写"操作成功"这种空话。
- `toast.info` 用于中性中间态（`重启后生效`、`等待对方确认`），不要拿来做成功提示。

## 触觉反馈

- `toast.error` 自动触发一次 `Haptics.NotificationFeedbackType.Error`。
- `toast.success` / `toast.info` 不振动（高频操作如复制、保存会让设备一直颤抖，已知反感来源）。
- 不要给 toast 添加自定义 `Haptics` 调用——封装层是唯一入口。

## 位置 & 层级

- 默认顶部居中，与桌面 sonner / iOS 灵动岛认知一致。
- 根布局只挂一个 `<NotifierRoot useRNScreensOverlay />`，位置在 `SafeAreaProvider` 直接子节点的**最末**——确保 z-order 高过 `BottomSheetModalProvider` / `Stack` / `PortalHost`。
- `useRNScreensOverlay` 在 iOS 上让 toast 走 `react-native-screens` 的 `FullWindowOverlay`，渲染在所有 native-stack modals 和 RN Modal 之上；Android 上无该机制，用最末 sibling + `View` 顶层位置已足够。
- 不要在子页面再挂 `<NotifierRoot />`——`Notifier.showNotification` 是全局单例，重复挂会争抢。

## 常见反例

```ts
// ❌ 直接 import react-native-notifier
import { Notifier } from "react-native-notifier";

// ❌ 给 toast.success 加触觉
import * as Haptics from "expo-haptics";
toast.success(t`已复制`);
Haptics.notificationAsync(...);

// ❌ 用 toast 代替破坏性二次确认
toast.warning(t`确认删除？`, { action: ... });

// ❌ 用 Alert 提示后台同步失败（用户没在等）
Alert.alert(t`同步失败`, ...);

// ❌ 模块层直接写中文字面量绕过 lingui
toast.error("保存失败", err);
```

## 何时**不**该弹 toast

- 用户没主动触发的内部刷新（event-bus FileTreeChanged 后台失败、被动 hydrate 部分失败、SplashScreen 隐藏失败、`Linking.openURL` 静默失败）。
- 路由切换前置加载（`Promise.all([getThemePreference(), getStoredLanguagePreference()])`）的读取失败：用户感知不到，保留 `console.warn` 即可。
- 已经在 UI 里有就地状态展示的失败（如 `pairing/setPairError` 已经把错误显示在 inline area），重复 toast 没意义。

## 引擎选型决策（2026-04）

**最终选 `react-native-notifier@^2`**，自定义 `IosToast` 组件作为 `Component`。下面是放弃其他选项的原因，避免下次重复绕弯。

| 候选 | 放弃原因 |
|---|---|
| `sonner-native` | Android 上用普通 `View`（**不是** `FullWindowOverlay`），任何 native Stack/Portal/Bottom Sheet 都能盖住它 → 在我们这种 modal/dialog 多层的 app 里 Android 完全看不见 toast |
| `react-native-toast-message` | 跨端工作了，但默认样式（绿/红/蓝边框 banner）观感廉价，自定义成本与直接写一个 component 接近 |
| `burnt` | iOS 走 SPIndicator + AlertKit、Android 走 ToastAndroid——视觉跨端不统一；且 `ToastAndroid` 不支持单 toast 持续更新（百分比下载进度做不了） |

`react-native-notifier` 的关键能力：
- `useRNScreensOverlay` prop 在 iOS 上自动套 `FullWindowOverlay`（其他库都没有）
- 默认 `queueMode: 'reset'` → 反复 `showNotification` 替换当前 toast，正好用来做下载进度的就地刷新
- 自定义 `Component` 完全自由，能做出 SPIndicator 风格胶囊
- 纯 JS，无 native 模块（`expo-blur` 是另算的）

## 自定义 IosToast 组件实现要点

`src/components/ios-toast.tsx`，用 `expo-blur` 的 `BlurView` 做毛玻璃，套阴影 + 胶囊圆角 + lucide 图标 + 系统色。下面是这次踩过的坑，**改这个组件前先读完**。

**1. `componentProps` 是直接展开为 Component 的 props，不是嵌套**

```ts
Notifier.showNotification({
  Component: IosToast,
  componentProps: { alertType: "success" },  // 展开为 IosToast 的 props
});

// IosToast 接收：
function IosToast({ title, description, alertType }) { ... }
//                                       ^^^^^^^^^ 直接拿，不是 componentProps.alertType
```

**2. 自定义 Component 不会自动套 `SafeAreaView`**

`NotifierComponents.Notification` / `.Alert` 默认 `componentProps.ContainerComponent = SafeAreaView`，但只对它们生效。我们用自定义 Component 时**必须自己 `useSafeAreaInsets()`**，不然 toast 会被 Dynamic Island / 状态栏遮挡。

```tsx
const { top } = useSafeAreaInsets();
return <View style={[SHADOW, { marginTop: top + 8 }]}>...</View>;
```

**3. 不要传 `translucentStatusBar: true`**

那是给默认 Component 在 Android 上加 `StatusBar.currentHeight` padding 的开关。如果同时用 `useSafeAreaInsets`，会**双重补偿**（safe-area top + status bar 高度）→ Android 上 toast 离顶部太远，看起来漂浮在页面中间。

**4. shadow 与 `overflow: hidden` 必须分两层**

`BlurView` 模糊效果需要 `overflow: hidden` 才能裁剪到圆角；但 `overflow: hidden` 会把 `shadow` 一起裁掉。解法：

```tsx
<View style={SHADOW}>                   {/* 只有 shadow + borderRadius，不裁剪 */}
  <BlurView style={PILL}>               {/* 自己 borderRadius + overflow:hidden */}
    {...}
  </BlurView>
</View>
```

**5. 容器布局走 inline style，不用 className**

`react-native-css`（NativeWind v5 preview）会丢 alpha 颜色和任意布局类（参见 `theme-and-styling.md > AlertDialog/Dialog overlay`）。`SHADOW` / `PILL` / 半透明背景全部 inline。`Text` 的 `text-foreground` / `text-muted-foreground` 这种纯主题色 className 是安全的。

**6. `expo-blur` 是 native 模块**

新装后**必须 `npx expo prebuild`** 重出原生工程，否则 dev build 会 crash 或 BlurView 静默失败。Android 上默认是半透明 fallback（不开 `experimentalBlurMethod`，避免运行时开销），跟 SPIndicator 体感差不多。

**7. 系统色硬编码**

`success / info / error / warn` 用 Apple HIG 标准色（`#34C759 / #0A84FF / #FF3B30 / #FF9500`），不走 `--success` / `--destructive` 这些 CSS 变量——主题色在浅深色之间会变饱和度，破坏 SPIndicator 的视觉一致性。如果以后想接主题色，记得 light/dark 各调一次。

**相关文件**：
- `src/components/ios-toast.tsx` — 组件
- `src/lib/toast.ts` — wrapper（show 函数把 alertType 翻译进 componentProps）
- `src/app/_layout.tsx` — `<NotifierRoot useRNScreensOverlay />` 挂载位置
