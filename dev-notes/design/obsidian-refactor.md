# Obsidian 风格导航重构

把当前"底部 Tabs（主页/Swarm/设置）"的 IA 替换为 Obsidian 移动端的"双兄弟页 + 底部命令 + 顶部抽屉式设置"结构。这份文档是 P1 骨架实施前的设计定稿，后续 P2/P3 增量落地。

决策日期 2026-04-18。

## 为什么要改

- SwarmNote 本质是**编辑器**产品，主工作流是"打开笔记 → 写字"，而不是"逛三个 tab"。底部 Tabs 把 Home / Swarm / Settings 放平级，弱化了编辑器主线。
- Swarm（P2P 配对）是**应用级设置**而非主导航入口——类比 Obsidian Sync 在设置内。
- Tabs 占用屏幕底部 83px 常驻空间，编辑时可写高度更少。
- 参考 Obsidian 移动端（用户提供的截图验证过）的成熟模式：workspace + files 兄弟页切换、settings 从底部 modal 滑起、底部悬浮胶囊工具栏做命令中心。

## 最终信息架构

```
(main) stack 根（替代当前 (tabs)）
 ├─ workspace             ← 主屏，默认 screen
 │                           空态：欢迎引导；有内容：自动恢复最后笔记
 │
 ├─ files                 ← 左兄弟，slide_from_left 切入
 │                           纯文件树（"最近"功能与 P3 多 tab 重叠，不做）
 │
 ├─ note/[id]             ← 笔记编辑器（push slide_from_right）
 │
 └─ settings (modal stack)   ← 底部 modal 滑起（slide_from_bottom）
      ├─ index                4 行导航入口 + 顶部"我的设备"卡
      ├─ general              通用（语言 / 外观 / 可读行宽 / 恢复工作区）
      ├─ network              网络（P2P 状态卡 + 自动启动）
      ├─ devices              设备（我的设备 + 配对码 + 已配对 + 附近，原 Swarm 页内容全部迁入）
      └─ about                关于（App logo + 版本 + 更新 + GitHub/文档/反馈链接）
```

关键取舍：

- **workspace 和 files 是兄弟而非 parent/child**：用 expo-router stack + `animation: slide_from_left` 做"swap"式过渡。不是 Drawer overlay。
- **Swarm 不是顶层入口**：迁入 settings modal，作为"设备与同步"子项。减少主导航噪声。
- **Tabs（多标签页）推迟到 P3**：P1 保持"当前只一个笔记打开"的心智模型，导航用 stack push/back，不引入 tab store。

## 顶部导航栏（h-13）

统一结构：`[panel-toggle] 标题 [overflow]`

| Screen | 左图标 | 标题 | 右图标 |
|---|---|---|---|
| workspace | `panel-left` → files | "我的工作区" | `⋮` workspace 操作 |
| files | `←` 返回 workspace | "文件" | `+` 新建 |
| note editor | `←` back | 笔记标题 | `📖` 预览 + `⋮` 操作 |
| settings (modal) | — | "设置" | `✕` 关闭 |
| settings 子页 | `←` back | 子页标题 | — |

左上 `panel-left` 图标（不是汉堡）= Obsidian 的"sidebar toggle"语义。

## 底部胶囊工具栏（仅 workspace / 笔记编辑器页）

```
        ╭──────────────────╮
        │                  │
        │   🔍    +    ≡  │
        │                  │
        ╰──────────────────╯
```

**只在 workspace 主屏和笔记编辑器页出现**，files / settings modal 等导航/管理型页面**不显示**胶囊。理由：胶囊承载的是"针对当前编辑内容的操作"（搜索、新建、命令），在纯浏览/配置页里无意义。files 页要新建用顶部"+"，settings 页要返回用右上"✕"。

- 位置：悬浮在底部安全区上方 16px，`mx-5`
- 视觉：`h-13 rounded-full bg-card shadow-md`
- 3 个等分触控区（P1），每个最小 44×44
- 图标用 `muted-foreground` 色（不是 `foreground`），保持低视觉权重不抢戏

P1 按钮行为：

- `🔍` 搜索：打开搜索模态（当前仅占位）
- `+` 新建笔记：弹出命名对话框 → 创建 → 进入编辑器
- `≡` 命令 sheet：从底部弹起 bottom sheet

### 命令 Sheet（≡ 点击后）

```
┌──────────────────────────────┐
│          ━━                  │  drag handle
│  🔍  快速切换笔记             │
│  📁  新建文件夹               │
│  ⚙️  设置                   │  ← 打开 settings modal
│  ℹ️  关于                    │
└──────────────────────────────┘
```

P2/P3 扩展点：查看关系图谱、白板、插入模板、命令面板、导入/导出。

## 页面过渡一览

| From | To | 触发 | 过渡 |
|---|---|---|---|
| workspace | files | 顶部 panel-toggle / 左缘右滑 | `slide_from_left` |
| files | workspace | 返回箭头 / 右缘左滑 | `slide_from_right` |
| workspace / files | note/[id] | 点笔记卡片 | push `slide_from_right` |
| 任意 | settings modal | 命令 sheet → 设置 | modal `slide_from_bottom` |
| settings index | settings/swarm 等 | 点设置项 | push `slide_from_right`（modal stack 内） |
| 任意 | 命令 sheet | 底部胶囊 ≡ | bottom sheet（滑入） |

## workspace 主屏

workspace 有两种形态，取决于是否有"最后打开的笔记"状态：

- **空态**（首次启动或无笔记）：居中欢迎区 = 圆形 `pencil-line` 图标 + "还没有笔记" + 描述 + primary CTA "+ 新建笔记"
- **有最后笔记**：直接渲染编辑器（等效于打开 `note/[id]`），顶部仍是 `[panel-left] 工作区/笔记名 [⋮]`

不做"最近笔记列表"页面。P3 引入多 tab 后，最近访问等同 tab 历史。

## files 页

纯文件树，不做"最近/文件树"分段控制器。

- 顶部：`[← 返回 workspace]` + 标题"文件" + `[+ 新建]`
- 内容：递归 workspace.fileTree()；文件夹可折叠，点击条目触发"关闭 files → push note/[id]"
- 不显示底部胶囊（浏览型页面无编辑操作）

## settings modal

模式：expo-router Stack 挂在 root 外的 Stack，配 `presentation: "modal"`。**对齐桌面端 settings 分层**（`crates/desktop/src/routes/settings/*`），不发明自己的分类。

### index（设置首页）

- 顶部：drag handle + `设置`标题 + `✕` 关闭
- "我的设备"卡片（设备名 + peerId 截断 + chevron）保留，作为身份 context
- 单张导航卡，4 行 icon + label + chevron：
  - `Settings` 通用 → general
  - `Globe` 网络 → network
  - `MonitorSmartphone` 设备 → devices
  - `Info` 关于 → about

### general 子页

跟桌面 `settings/general.tsx` 一对一。用 SettingRow 组件（`[iconBox 32×32 bg-muted rounded-8] 标签/描述 + 右侧控件`）：

**外观** section

- 语言 (Globe) + Select "中文 / English"
- 外观 (Palette) + Select "浅色 / 深色 / 跟随系统"
- 可读行宽 (Ruler) + Switch

**启动行为** section

- 恢复上次工作区 (FolderOpen) + Switch

### network 子页

跟桌面 `settings/network.tsx` 一对一。

**P2P 网络** section：一张 NetworkStatusCard（状态 pill + 描述 + 启动/关闭按钮）
**设置** section：开机自动启动网络 (Zap) + Switch

### devices 子页

合并桌面 `settings/devices.tsx` 的所有内容（即原 Swarm 页）：

- 顶部右上 `输入配对码` 按钮（outline h=32）
- 我的设备卡片（smartphone avatar + 设备名 + meta + Peer ID + `编辑`按钮）
- `CodePairingCard` reusable（Idle/Generated）
- 已配对设备 section + count pill（绿点 + "在线"/"离线"状态 text）
- 附近设备 section + `刷新`按钮 + 每条带`配对`primary 按钮

### about 子页

跟桌面 `settings/about.tsx` 一对一。

- 居中：`SN` logo 方块（64×64 rounded-16 primary/10 底 + 琥珀 SN 大字） + "SwarmNote" + `v0.1.x` + badge-check "已是最新"
- Slogan：`去中心化、本地优先的 P2P 笔记应用`
- 双 outline 按钮：`检查更新` `更新日志`
- 底部链接：GitHub | 文档 | 反馈（lucide github / book-open / message-square）

### 迁移对照

- 原 `(tabs)/settings.tsx` → `settings/index.tsx`（去掉 workspace 选择器 / tab bar，换 4 行导航）
- 原 `(tabs)/swarm.tsx` → `settings/devices.tsx`（完整搬迁）
- 其他 general / network / about 为新增，数据源对齐桌面 stores

## 分期实施

| Phase | 内容 | 可交付 |
|---|---|---|
| **P1 骨架** | 新路由结构 (main) + 壳 + 胶囊 3 按钮（仅 workspace 页）+ 迁移 Swarm/Settings 到 modal stack；文件树 mock 占位；workspace ↔ files swap | 导航跑通，设计稿一致 |
| **P2 数据** | workspace.listDocuments() 真接；新建笔记流；files 文件树 | 笔记数据真实 |
| **P3 Tabs + history** | tab store + switcher 页 + 前进后退；升级 6 按钮工具栏 | 对齐 Obsidian 完整 |

## 需要新建/改动的文件清单（P1）

**新建**：
- `src/app/(main)/_layout.tsx` - Stack 容器 + 全局胶囊工具栏
- `src/app/(main)/index.tsx` - workspace 主屏（替换现 `(tabs)/index.tsx`）
- `src/app/(main)/files.tsx` - files 兄弟页
- `src/app/settings/_layout.tsx` - modal stack
- `src/app/settings/index.tsx` - 设置首页（从现 `(tabs)/settings.tsx` 改）
- `src/app/settings/swarm.tsx` - Swarm 子页（从现 `(tabs)/swarm.tsx` 迁）
- `src/app/settings/appearance.tsx` - 外观（占位）
- `src/components/bottom-command-bar.tsx` - 胶囊工具栏组件
- `src/components/command-sheet.tsx` - 命令 sheet 组件

**删除**：
- `src/app/(tabs)/` 整个目录（由 `(main)/` 替代）

**改动**：
- `src/app/_layout.tsx` - 注册 `(main)` + `settings` 路由，后者 `presentation: "modal"`
- `src/app/index.tsx` - onboarded 后 redirect 到 `/(main)` 而非 `/(tabs)`

## 设计约束（不可妥协）

- 整套配色 / 字体保持项目当前 theme（琥珀金 + 暖灰纸感），不因为参考 Obsidian 改成 Obsidian 的紫色
- lucide 图标统一，面板切换用 `PanelLeft`，命令用 `Menu`，命令 sheet 内条目带 lucide icon
- 底部胶囊 `shadow` 深度与设计稿现有阴影系统一致（不超过 `shadow-md`）
- 暗色模式两套参数同步测试，胶囊在暗色下用 `bg-card` 色变

## 参考

- Obsidian 移动端（用户截图 2026-04-18）：workspace、sidebar、settings、命令 sheet、tab switcher
- 设计稿当前版本：`dev-notes/design/mobile-design.pen`（待更新，P1 骨架完成后用 Pencil MCP 改）
- 项目主题规范：`dev-notes/design/theme-palette.md`、`src/global.css`
