# Self-Driven Learning Lab · 自驱式学习实验室

> 本项目是《内驱式学习》方法论的个人实践工具，非官方产品。

一个纯前端、单机运行的学习闭环工具：把「今天做点什么」到「复盘今天学到了什么」串成一个可日复一日运转的循环。没有账号、没有服务器、没有埋点，**所有数据只保存在你自己的浏览器里**。

---

## 一句话闭环

```
今日行动 → 概念卡片复习 → 阅读笔记 → 写作大纲 → 明辨案例 → 每日复盘 → 设置调参
   ↑                                                                        ↓
   └──────────────────────── 明日行动与调整 ←───────────────────────────────┘
```

| 页面 | 解决的问题 | 关键动作 |
| --- | --- | --- |
| 今日 | 今天从哪开始 | 加一条最小行动并打勾、看连续天数、看待复习数、四个入口 |
| 卡片 | 记住概念 | 制卡 → 自评（不会/模糊/会了）→ 按间隔重复推进下次复习 |
| 阅读 | 把书读成自己的 | 五步笔记法（关键概念 → 关键词链 → 思想费曼 → 费曼×3 → 新问题）+ 三级笔记 + 提炼卡片 |
| 写作 | 把想法写成结构 | 三种文体模板、一/二/三级大纲树、引用阅读笔记作证据、实时 Markdown 预览 |
| 明辨 | 把观点练成判断 | 质疑 → 检验 → 修正 三阶段，识别认知偏差、找反例、查前提、落成下一步行动 |
| 复盘 | 每天收口 | 完成数、卡片通过率、洞察、卡点、明日调整，一天一条 |
| 设置 | 让节奏适合自己 | 主题、每日卡片上限、复习间隔、提醒时间、导入导出与清空 |

模块之间是互相引用的：卡片可以挂来源笔记，大纲三级节点可以引用笔记作证据，明辨案例可以引用笔记也可以关联卡片——引用关系在卡片详情、笔记详情里双向可见。

---

## 本地启动

```bash
npm install
npm run dev       # 开发服务器，默认 http://localhost:5173
npm run build     # 类型检查 + 生产构建，产物在 dist/
npm run preview   # 本地预览 dist/
```

环境要求：Node.js ≥ 20（开发时使用 Node 24 / 22），现代浏览器（Chrome / Edge / Safari 近两年版本）。

---

## 线上地址

GitHub Pages：**https://lostlamb123.github.io/self-driven-learning-lab/**

仓库：https://github.com/lostlamb123/self-driven-learning-lab（public）

- 打开根路径会自动跳到 `#/today`；直接访问/刷新 `#/cards`、`#/reading`、`#/settings` 等深链接不会 404（HashRouter，服务端始终返回 `index.html`）。
- 部署方式：推送到 `main` 触发 `.github/workflows/deploy.yml` → `npm ci` → `npm run build` → 上传 `dist` → 发布 Pages；也可在 Actions 页手动 Run workflow。
- 仓库 Settings → Pages 的 Source 已设为 **GitHub Actions**（`build_type: workflow`）。
  > 注意：GitHub Free 计划只能从 **public** 仓库发布 Pages；若改回 private，需升级到 Pro/Team，否则部署会在 Setup Pages 步骤报 `Resource not accessible by integration`。

部署要点：GitHub Pages 的项目页跑在子路径下，构建时需要带前缀。`vite.config.ts` 已内置判断——在 GitHub Actions 环境（自动注入 `GITHUB_ACTIONS`）里构建会自动使用 `/self-driven-learning-lab/`，本地构建仍是根路径：

```bash
npm run build          # 本地：base = /
# GitHub Actions 中：base = /self-driven-learning-lab/
```

---

## 数据存储说明（仅本浏览器）

- 存储位置：浏览器 `localStorage`，键名 `sdlab:v1`，结构版本 `SCHEMA_VERSION = 1`。
- **不联网、不上传、无账号**：没有后端，没有同步，数据不会离开这台设备。
- 自动保存：每次修改后 500ms 防抖写入本地，页面上会显示「保存中… / 已保存」。
- 清除浏览器数据、换浏览器、换设备、使用无痕窗口关闭后，数据都会消失——**请定期导出备份**。
- 本地数据损坏时不会静默清空：应用会回落到空白数据并提示，原始字符串仍留在 `localStorage`，可用导出的备份重新导入修复。

---

## 导出 / 导入

**JSON 整库备份（设置 → 数据管理）**

- 导出：`sdlab-backup-YYYY-MM-DD.json`，包含全部笔记、卡片、大纲、案例、复盘与设置。
- 导入：选择 JSON 文件 → 二次确认（**导入会覆盖当前数据**）→ 自动刷新页面。
- 清空：需二次确认，文案明确提示「不可恢复，请先导出备份」。

**Markdown 单篇导出（阅读 / 写作 / 明辨）**

三处导出共用同一套规范，文件名统一为 `<前缀>-<标题>-YYYY-MM-DD.md`：

| 来源 | 前缀 | 标题层级 | 参考附注 |
| --- | --- | --- | --- |
| 阅读笔记 | `note` | `#` 标题、`##` 五步/三级笔记、`###` 小节 | — |
| 写作大纲 | `outline` | `#` 标题、`##` 一级论点、`###` 二级节点、`-` 三级节点 | `- 参考笔记：…` |
| 明辨案例 | `critical` | `#` 标题、`##` 一、质疑 / 二、检验 / 三、修正 | `- 参考笔记：…` |

引用完整性：被引用的笔记若已删除，导出与界面一律显示 `参考笔记：已删除`，**不会静默丢行**，也不会让页面崩溃。

---

## 版权与许可

### 内容许可

- 本项目内置的所有**方法论摘要、文体模板、提示语与文案**均为原创整理，采用
  [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)（署名—非商业性使用—相同方式共享）许可。
- **本项目不包含、不上传、不内置任何书籍原文段落。** 阅读笔记里出现的摘录与关键词，全部由使用者本人输入，版权归原书作者与使用者所有，仓库中不提供任何受版权保护的正文内容。
- 你自己在应用里写下的内容（笔记、卡片、大纲、案例、复盘）完全属于你自己，本项目不主张任何权利。

### 代码许可

- 源代码采用 [MIT License](https://opensource.org/licenses/MIT) 许可：可自由使用、修改、分发、商用，需保留版权声明与许可声明。
- 依赖库遵循各自许可：React（MIT）、Vite（MIT）、Zustand（MIT）、Immer（MIT）、Tailwind CSS（MIT）、React Router（MIT）。

### 声明

本项目是《内驱式学习》方法论的**个人实践工具**，非官方产品，与任何出版方、课程方无隶属或授权关系。书中方法论的思想归属原作者；本项目只提供把它落到日常操作里的界面与数据结构。

---

## 技术栈

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4（`@tailwindcss/vite`）
- Zustand + Immer（`updateData(draft => …)` 单入口写状态）
- React Router v7（HashRouter，静态托管无需服务端重写）
- 持久化：`localStorage` + 500ms 防抖自动保存 + 版本号校验

## 目录结构

```
src/
├─ components/          # 布局（侧边栏/底部 Tab）、Toast
├─ pages/               # 七个页面，一页一文件
├─ store/               # appStore（状态）、persistence（读写）、saveState（保存状态）
├─ types/models.ts      # 唯一的数据结构定义（schema 的唯一来源）
└─ utils/               # 日期、连续天数、复习统计、间隔算法、Markdown 导出、引用解析
```

## 已知限制

- 单机单浏览器，无多端同步、无协作、无账号体系。
- 未做代码分割，生产构建是单个 JS bundle（约 380 kB，gzip 后约 110 kB），首屏够用；若后续页面继续增长再拆分。
- 间隔重复采用固定的 `[1,3,7,14]` 天阶梯（可在设置中调整），不是完整的 SM-2 算法。
