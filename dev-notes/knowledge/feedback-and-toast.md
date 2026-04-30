# 用户反馈与 Toast 政策

移动端所有"操作完成 / 操作失败"的 UI 反馈都通过这一层规范，**不要**直接 `import` `sonner-native`，统一通过 `@/lib/toast` 调用。

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

- 默认位置 `top-center`，与桌面 sonner / iOS 灵动岛认知一致。
- `<Toaster />` 在根布局里挂在 `<PortalHost />` **之前**，所以 toast 层级低于 RNR overlay（AlertDialog / Dialog / Popover），打开 dialog 期间弹 toast 不会遮挡。
- 不要随意在子页面再挂 `<Toaster />`，会导致重复渲染、id 冲突。

## 常见反例

```ts
// ❌ 直接 import sonner-native
import { toast } from "sonner-native";

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
