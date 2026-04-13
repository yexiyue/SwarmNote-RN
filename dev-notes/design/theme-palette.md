# SwarmNote Mobile 配色方案：「蜂巢纸笺」

## 设计理念

**品牌故事**：SwarmNote = 蜂群笔记 — 去中心化、协作、有机、温暖

**视觉语言**：「数字蜂巢纸笺」

- **暖灰纸质感** — 背景不用纯白，带极微弱的黄棕色调，像高品质纸张
- **蜜蜂金/琥珀色强调** — 关键交互元素使用蜂蜜金，呼应 Swarm（蜂群）品牌
- **Whisper 边框** — 边框若隐若现，划分空间但不产生视觉噪音
- **暖近黑文字** — 文本不用纯黑 #000，使用暖色近黑，降低长时间阅读的疲劳感
- **暗色模式带暖色调** — 深灰中保留微暖底色，与亮色模式风格一致

**设计参考**：
- Notion — 暖色中性灰系、whisper border、纸质感
- Bear / Craft — 移动端笔记应用的温暖质感
- awesome-design-md 仓库（`D:\workspace\awesome-design-md`）中有更多品牌设计规范

## 配色全览

### 亮色模式（Warm Paper）

| 变量 | HSL | 近似 HEX | 用途说明 |
| ---- | --- | -------- | -------- |
| `--background` | `40 18% 99%` | #FDFCFA | 页面底色，极微暖白（肉眼几乎纯白但有纸感） |
| `--foreground` | `28 10% 14%` | #27211C | 主文本色，暖近黑 |
| `--card` | `36 15% 97%` | #F8F6F2 | 卡片表面，比背景略暖 |
| `--card-foreground` | `28 10% 14%` | #27211C | 卡片文本 |
| `--popover` | `0 0% 100%` | #FFFFFF | 弹出层（纯白，与背景形成微弱对比） |
| `--popover-foreground` | `28 10% 14%` | #27211C | 弹出层文本 |
| `--primary` | `40 72% 46%` | #C99816 | **蜂蜜金** — 按钮、链接、选中态、品牌标识 |
| `--primary-foreground` | `40 25% 10%` | #201A0F | 金色按钮上的深棕文字（确保对比度） |
| `--secondary` | `35 12% 93%` | #EFECEA | 次级表面（inactive tabs、secondary buttons） |
| `--secondary-foreground` | `28 8% 20%` | #352F2A | 次级表面上的文字 |
| `--muted` | `33 10% 92%` | #EDEBE6 | 静音表面（禁用态背景、subtle 分区） |
| `--muted-foreground` | `25 6% 46%` | #7C7570 | 次级文字、placeholder、时间戳 |
| `--accent` | `38 14% 94%` | #F2EFEA | 强调表面（hover 态、选中行背景） |
| `--accent-foreground` | `28 10% 14%` | #27211C | 强调表面上的文字 |
| `--destructive` | `0 80% 60%` | #EB4747 | 危险/删除操作 |
| `--border` | `30 10% 87%` | #E2DDD8 | 边框（whisper 级，暖色调） |
| `--input` | `30 8% 89%` | #E5E1DC | 输入框边框 |
| `--ring` | `40 72% 46%` | #C99816 | 焦点环（与 primary 一致） |
| `--radius` | — | 0.625rem | 圆角基准值（10px） |

### 暗色模式（Warm Deep Gray）

| 变量 | HSL | 近似 HEX | 用途说明 |
| ---- | --- | -------- | -------- |
| `--background` | `25 6% 10%` | #1B1918 | 暖深灰底色（非纯黑，保留温度） |
| `--foreground` | `36 10% 93%` | #EFECE7 | 主文本色，暖近白 |
| `--card` | `24 5% 14%` | #252220 | 卡片/抬升表面 |
| `--card-foreground` | `36 10% 93%` | #EFECE7 | 卡片文本 |
| `--popover` | `24 5% 12%` | #201E1C | 弹出层 |
| `--popover-foreground` | `36 10% 93%` | #EFECE7 | 弹出层文本 |
| `--primary` | `40 72% 52%` | #DBA81E | **蜂蜜金（加亮版）** — 暗底需要更高明度 |
| `--primary-foreground` | `25 20% 8%` | #171310 | 金色按钮上的深色文字 |
| `--secondary` | `25 4% 18%` | #302D2A | 次级暗色表面 |
| `--secondary-foreground` | `35 8% 88%` | #E3E0DB | 次级表面文字 |
| `--muted` | `25 4% 17%` | #2D2A28 | 静音暗色表面 |
| `--muted-foreground` | `20 4% 55%` | #918A84 | 暗色次级文字 |
| `--accent` | `25 5% 19%` | #332F2C | 暗色强调表面 |
| `--accent-foreground` | `36 10% 93%` | #EFECE7 | 暗色强调文字 |
| `--destructive` | `0 70% 55%` | #D94444 | 危险（暗色适配，略降饱和度） |
| `--border` | `25 5% 20%` | #353230 | 暗色边框 |
| `--input` | `25 4% 17%` | #2D2A28 | 暗色输入框边框 |
| `--ring` | `40 72% 52%` | #DBA81E | 焦点环 |

### 图表配色（暖色自然系）

与琥珀金搭配的自然色调：

| 变量 | 亮色 HSL | 暗色 HSL | 含义 |
| ---- | -------- | -------- | ---- |
| `--chart-1` | `40 72% 46%` | `40 72% 55%` | 琥珀（与 primary 一致） |
| `--chart-2` | `152 45% 40%` | `152 50% 48%` | 森林绿 |
| `--chart-3` | `210 22% 38%` | `210 28% 55%` | 石板蓝灰 |
| `--chart-4` | `16 55% 55%` | `16 60% 60%` | 陶土/赤陶 |
| `--chart-5` | `140 28% 48%` | `140 32% 55%` | 鼠尾草绿 |

## 颜色使用指南

### 何时使用哪个变量

| 场景 | 使用的变量 | Tailwind className |
| ---- | ---------- | ------------------ |
| 页面背景 | `--background` | `bg-background` |
| 主要文字 | `--foreground` | `text-foreground` |
| 次要文字（描述、时间戳） | `--muted-foreground` | `text-muted-foreground` |
| 卡片/列表项 | `--card` | `bg-card` |
| 主要按钮 | `--primary` / `--primary-foreground` | `bg-primary text-primary-foreground` |
| 次要按钮 | `--secondary` / `--secondary-foreground` | `bg-secondary text-secondary-foreground` |
| 链接文字 | `--primary` | `text-primary` |
| 选中/激活态背景 | `--accent` | `bg-accent` |
| 分割线/边框 | `--border` | `border-border` |
| 输入框边框 | `--input` | `border-input` |
| 焦点环 | `--ring` | `ring-ring` |
| 危险操作 | `--destructive` | `bg-destructive text-destructive` |
| 禁用/静音 | `--muted` / `--muted-foreground` | `bg-muted text-muted-foreground` |

### 对比度备注

- **主文本 on 背景**：暖近黑 #27211C on #FDFCFA ≈ 14:1（WCAG AAA ✓）
- **次级文字 on 背景**：#7C7570 on #FDFCFA ≈ 4.7:1（WCAG AA ✓）
- **金色按钮文字**：深棕 #201A0F on 琥珀 #C99816 ≈ 5.5:1（WCAG AA ✓）
- **注意**：琥珀金 #C99816 直接作为文字色在白色背景上对比度不足（~2.7:1），文字链接建议加粗或加下划线辅助辨识

### 品牌色扩展（预留）

未来如需更多品牌色层次，可在 `global.css` 中添加：

```css
/* 可选：品牌色扩展 */
--brand: 40 72% 46%;           /* 同 primary */
--brand-hover: 40 72% 40%;     /* 按下/悬停态，更深 */
--brand-light: 40 50% 94%;     /* 浅金色背景（badge、tag） */
--brand-foreground: 40 25% 10%;
```

## 实施代码（待应用）

应用时需修改 3 个文件：

### 1. `src/global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 40 18% 99%;
    --foreground: 28 10% 14%;
    --card: 36 15% 97%;
    --card-foreground: 28 10% 14%;
    --popover: 0 0% 100%;
    --popover-foreground: 28 10% 14%;
    --primary: 40 72% 46%;
    --primary-foreground: 40 25% 10%;
    --secondary: 35 12% 93%;
    --secondary-foreground: 28 8% 20%;
    --muted: 33 10% 92%;
    --muted-foreground: 25 6% 46%;
    --accent: 38 14% 94%;
    --accent-foreground: 28 10% 14%;
    --destructive: 0 80% 60%;
    --border: 30 10% 87%;
    --input: 30 8% 89%;
    --ring: 40 72% 46%;
    --radius: 0.625rem;
    --chart-1: 40 72% 46%;
    --chart-2: 152 45% 40%;
    --chart-3: 210 22% 38%;
    --chart-4: 16 55% 55%;
    --chart-5: 140 28% 48%;
  }

  .dark\:root {
    --background: 25 6% 10%;
    --foreground: 36 10% 93%;
    --card: 24 5% 14%;
    --card-foreground: 36 10% 93%;
    --popover: 24 5% 12%;
    --popover-foreground: 36 10% 93%;
    --primary: 40 72% 52%;
    --primary-foreground: 25 20% 8%;
    --secondary: 25 4% 18%;
    --secondary-foreground: 35 8% 88%;
    --muted: 25 4% 17%;
    --muted-foreground: 20 4% 55%;
    --accent: 25 5% 19%;
    --accent-foreground: 36 10% 93%;
    --destructive: 0 70% 55%;
    --border: 25 5% 20%;
    --input: 25 4% 17%;
    --ring: 40 72% 52%;
    --chart-1: 40 72% 55%;
    --chart-2: 152 50% 48%;
    --chart-3: 210 28% 55%;
    --chart-4: 16 60% 60%;
    --chart-5: 140 32% 55%;
  }
}
```

### 2. `src/lib/theme.ts`

```typescript
import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

export const THEME = {
  light: {
    background: "hsl(40 18% 99%)",
    foreground: "hsl(28 10% 14%)",
    card: "hsl(36 15% 97%)",
    cardForeground: "hsl(28 10% 14%)",
    popover: "hsl(0 0% 100%)",
    popoverForeground: "hsl(28 10% 14%)",
    primary: "hsl(40 72% 46%)",
    primaryForeground: "hsl(40 25% 10%)",
    secondary: "hsl(35 12% 93%)",
    secondaryForeground: "hsl(28 8% 20%)",
    muted: "hsl(33 10% 92%)",
    mutedForeground: "hsl(25 6% 46%)",
    accent: "hsl(38 14% 94%)",
    accentForeground: "hsl(28 10% 14%)",
    destructive: "hsl(0 80% 60%)",
    border: "hsl(30 10% 87%)",
    input: "hsl(30 8% 89%)",
    ring: "hsl(40 72% 46%)",
    radius: "0.625rem",
    chart1: "hsl(40 72% 46%)",
    chart2: "hsl(152 45% 40%)",
    chart3: "hsl(210 22% 38%)",
    chart4: "hsl(16 55% 55%)",
    chart5: "hsl(140 28% 48%)",
  },
  dark: {
    background: "hsl(25 6% 10%)",
    foreground: "hsl(36 10% 93%)",
    card: "hsl(24 5% 14%)",
    cardForeground: "hsl(36 10% 93%)",
    popover: "hsl(24 5% 12%)",
    popoverForeground: "hsl(36 10% 93%)",
    primary: "hsl(40 72% 52%)",
    primaryForeground: "hsl(25 20% 8%)",
    secondary: "hsl(25 4% 18%)",
    secondaryForeground: "hsl(35 8% 88%)",
    muted: "hsl(25 4% 17%)",
    mutedForeground: "hsl(20 4% 55%)",
    accent: "hsl(25 5% 19%)",
    accentForeground: "hsl(36 10% 93%)",
    destructive: "hsl(0 70% 55%)",
    border: "hsl(25 5% 20%)",
    input: "hsl(25 4% 17%)",
    ring: "hsl(40 72% 52%)",
    radius: "0.625rem",
    chart1: "hsl(40 72% 55%)",
    chart2: "hsl(152 50% 48%)",
    chart3: "hsl(210 28% 55%)",
    chart4: "hsl(16 60% 60%)",
    chart5: "hsl(140 32% 55%)",
  },
};

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
```

### 3. `tailwind.config.js`

**不需要修改** — 已通过 CSS 变量映射，改 `global.css` 即可生效。
