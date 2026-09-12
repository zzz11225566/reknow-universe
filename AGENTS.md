# AGENTS.md — 炼知 ReKnow「宇宙版」新对话 AI 快速上手

> 本文档发给每个新加入的 AI。读完本文档即可开始工作；细节再按指引去读对应文件。
> 最后更新：2026-09-12（v7 主线转正 + 目录收敛为 docs/scripts/evidence 分区）

---

## 0. 一句话定位

**炼知 ReKnow v6.5「炼金宇宙版」** —— 知乎黑客松 2026「知识炼金场」赛道参赛作品：一款把知乎「收藏」炼成「自己的回答」的 AI 学习应用。在 v5 学习闭环（收藏 → 拆解 → 四种学习方式：闯关/快答/听讲/AI 开杠 → DIY 思维导图 → 回流知乎）之上，叠加沉浸式 3D 知识宇宙（收藏=星体、理解=点亮、炼金炉=经验值、天气/真实时间联动场景）。

---

## 1. 红线（先读这段，违反任何一条都可能造成事故）

1. **活跃主线就是根目录四件套**（9/12 起由「修改版」转正，文件名已去掉全角括号）：
   - `index.html` / `app.js` / `boot.js` / `universe.js`
   - 旧版 v6.5 四件套在本地 `archive/v6.5/`（不入库），是历史基线，**除非明确要合入原版改进，否则不要动**。
   - 引用关系固定：`index.html` 引 `app.js` + `boot.js`；`boot.js` 懒加载 `universe.js`。
2. **历史命名**：老文档/任务书里出现的 `xxx（修改）.js/html` 就是现在根目录的 `xxx.js/html`（2026-09-12 改名）；命令行里遇到含全角括号的文件名必须**加引号、逐字复制**。
3. **工作区根就是 git 仓库**（9/12 由 `reknow-universe/` 子目录上移至根，GitHub：github.com/zzz11225566/reknow-universe）。每步改动完成即 commit + push；`archive/`、设计草稿（`_draft_uni_*`、`_uni_*`）、`*.bak-*` 已被 .gitignore 忽略，不要强行 `git add -f`。
4. **前端零密钥**。AI Key、知乎 token、用户数据只放后端；浏览器端绝不出现任何密钥。
5. **首页内容由 JS 运行时渲染**（hero / 分类书架 / 题卡在 `app.js` 里生成）。改首页视觉只能通过 CSS 命中现有类名（`.hero-band` / `.cat-shelf` / `.tcard` / `.pick-bar` 等），**不得改 JS 生成的内容结构**。
6. **`app.js` 是含两代代码的 13 万字符单体**，同名函数靠「后者声明覆盖前者」生效（v6 增补在文件后半）。查找函数定义时**认准最后一次出现**；不大改结构，只在外层扩展。⚠️ 因此 `node --check` 会报「重复声明」，这是既定模式；用 `vm.Script` 检查（见 §5）。
7. **vendor/ 与 assets/ 不动**（Three.js 兼容构建、看山官方 GIF）。
8. **不要把历史产物当垃圾清理**：`evidence/` 里的验证截图/输出是证据产物；`docs/首页重做-设计稿.jpg` 是首页重做设计稿原图。

---

## 2. 当前任务与进度（接手前先看这里）

- **进行中（9/12）**：「炼金宇宙优化——熔炉核心」改造（任务书：`docs/炼金宇宙优化-prompt.md`）：3D 中央炼金炉 → 底部 CSS 熔炉（`#uniHearth`），群星整体抬升，`#uniShell[data-tod=day|dusk|night]` 昼夜 HUD 适配。`index.html` HUD CSS 已入库；`universe.js` 对应 JS 改动**尚未提交**，接手前先 `git status` 看现场。
- **刚完成（9/12）**：按设计稿重做首页与顶栏（任务书：`docs/首页重做-prompt.md`，设计稿：`docs/首页重做-设计稿.jpg`）。桌面端 `evidence/_verify_desktop.png` 与移动端 `evidence/_verify_mobile.png` 均验证通过。
- **9/11 完成的结构改版**：砍掉「思维图谱」「知识库」两个独立视图，功能并入炼金宇宙（`uniMind` 导图覆盖层 + `uniKnowPanel`「已习得」面板 + 交叉分析）。
- **同日（9/12）工程整理**：v7 转正、`.git` 上移、目录收敛（docs/ scripts/ evidence/）。
- **下一步方向**（详见 `docs/网站构建指导.md` 六步路线图）：账户系统 + SQLite + JWT 云端同步 → AI 助手小窗（SSE 流式）→「炼金配方」个性化系统 → 知乎开放平台接入 → …

---

## 3. 目录结构

```
C:\Users\cxy\Desktop\宇宙版\          （= git 仓库根 = GitHub reknow-universe）
├─ AGENTS.md / README.md / LICENSE    上手文档 / 项目说明 / 许可证（保持根目录）
├─ index.html                         ★ 主应用（骨架+全部CSS）
├─ app.js / boot.js / universe.js     ★ 主线三件套（职责见 §4）
├─ data.js                            演示数据（window.DEMO）
├─ server.js / package.json           可选实时后端（纯 Node 零依赖，端口 8787）
├─ assets/ vendor/                    看山 GIF / Three.js r160（不动）
│
├─ docs/                              文档与任务书（含设计稿）
│  ├─ 策划书.html  使用指南.html        项目策划书（最新）/ 用户使用指南
│  ├─ 网站构建指导.md  项目策划书.md     ★★ 架构施工图（先读）/ 策划书 Markdown 版
│  ├─ 首页重做-prompt.md  炼金宇宙优化-prompt.md   任务书范本
│  └─ 首页重做-设计稿.jpg
├─ scripts/                           Playwright 验证/截图脚本（机器相关路径，需按需改）
├─ evidence/                          验证截图与输出（证据产物，勿删勿ignore）
├─ demo/                              两个独立静态 Demo
├─ v2-rebuild/                        另一套 v6.6.0 精简版原型（CDN Chart.js，9/9 后未动）
└─ （本地不入库）archive/  _draft_uni_*  _uni_*  *.bak-*
```

---

## 4. 核心文件职责表

| 文件 | 职责 |
|---|---|
| `index.html` | 主应用骨架 + 几乎全部 CSS（单 `<style>`）；9/12 已按设计稿重绘首页 + 熔炉 HUD |
| `app.js` | 全局状态 `S`（localStorage `rkSave`/`rkCustom`）；`showView` 只切 home/flow 两视图；`renderHome` 动态渲染 hero/分类书架/题卡；学习流四步（拆解→四种学习方式→成果→回流）；`renderMindMap`/`bindMindMap(t, hostId)` 思维导图（可挂任意宿主）；AI 开杠 `debateRebuttals` |
| `boot.js` | 零侵入接入层：包裹 `showView` 支持 `'uni'`；懒加载 `vendor/three.min.js` → `universe.js`；拆解页注入「📖 原文圈点」按钮；`__rkOnWeather` 按天气给看山换 GIF；调试钩子 `?auto=uni` / `?diag=1` |
| `universe.js` | `window.ReckonUniverse`：Three.js 星海（星体=已习得收藏、Bezier 炼金链路）、5 种天气 1.5s 过渡、真实时间昼夜、热榜抽屉+全站搜索+镜头飞行、星体卡、原文阅读器（3 色高亮+旁注）；v7 新增 `uniMind` 导图覆盖层、`uniKnowPanel`「已习得」面板；熔炉改造中：3D 炉火 → 底部 CSS `#uniHearth` |
| `data.js` | `window.DEMO`：4 主题分类 + 12 篇演示选题（拆解块 type 1–7）+ 账号信息；真实接入时替换为知乎开放平台数据 |
| `server.js` | 可选后端（ESM、零依赖）：静态托管；`/api/hotlist`（模拟热榜，id 与本地选题对应）、`/api/search`、`/api/env`（模拟天气）、`/ws` 手写 WebSocket 定时广播；前端自动探测，连上点亮「实时」徽标 |

**localStorage 键位表**：`rkSave`（学习进度）、`rkCustom`（自定义选题）、`rkUni6`（宇宙偏好/天气）、`rkUniOrig`（原文+批注）；规划中的 `rkRecipe`（炼金配方，未实现）。

---

## 5. 启动 / 运行 / 验证

- **主方式（推荐，零依赖）**：直接双击 `index.html`（file:// 可用 —— Three.js 本地内置，热榜/搜索/天气走内置模拟数据自洽）。
- **可选后端**：`node server.js`（或 `npm start`）→ http://localhost:8787，获得实时热榜/环境推送（绿色「实时」徽标）。Node ≥ 18（`"type":"module"`）。
  - ⚠️ 启动前确认 8787 未被占用（僵尸预览服务会 EADDRINUSE）。
  - ⚠️ `v2-rebuild/` 的 server 是 CommonJS，与主项目 ESM 不通用，别混启动方式。
- **语法自检**：`node archive/patches/_syntax.cjs`（用 `vm.Script` 检查 app/universe/boot/data 四件套；`node --check` 不适用，见 §1.6）。
- **浏览器验证**：改动后必须在真实浏览器检查桌面 + 移动两端。脚本在 `scripts/`（`_verify_port.cjs`、`_shot_*.cjs`，内含本机绝对路径，换机器需改）；截图证据存 `evidence/`。

---

## 6. 历史一次性脚本（已执行完毕，勿重跑；在本地 archive/patches/，不入库）

| 脚本 | 时间 | 作用 |
|---|---|---|
| `_verify.js` | 9/10 21:19 | Playwright 验证旧版：首页渲染/进宇宙/阅读器/截图 |
| `_syntax.cjs` | 9/10 21:58 | 四文件语法检查（vm.Script 方式） |
| `_patch_debate.py` | 9/10 21:48 | 改旧版 app.js：开杠话术引用用户原话 |
| `_patch_fox.py` / `_patch_foxcss.py` | 9/10 22:02–03 | 改旧版 universe.js + index.html：看山固定右下角 |
| `_patch_plan.py` | 9/10 22:14 | 改策划书.html：插入动机卡片 |
| `_patch_home.py` | 9/10 22:29 | 改旧版 app.js：首页「⚡ 打开即学」CTA + 炼金成就入口 |
| `_patch_label.py` | 9/10 22:30 | 改旧版 index.html：顶栏改名「🏆 炼金成就」 |
| `*.patched-20260912` | 9/12 13:35 | 上述 4 个补丁移植到修改版的产物，**同日经 owner 决定回滚**，保留可复用 |

---

## 7. 待办与风险

### 待办
1. **熔炉核心改造收尾**：`universe.js` 的 JS 部分（`#uniHearth` 注入、`data-tod` 已部分入库）提交后，删除根目录 `_uni_*` scratch，并补一次真实浏览器验证截图入 `evidence/`。
2. **原版 4 个内容补丁是否合入主线**：移植产物在 `archive/patches/*.patched-20260912`，是否重新合入待 owner 决策。
3. 按 `docs/网站构建指导.md` 六步路线图推进（第 0 步：需求冻结）。

### 风险
1. **多会话并行**：熔炉改造会话与本仓库整理可能同时改 `index.html`/`universe.js`，动手前先 `git status` + `git diff`，别覆盖他人未提交工作。
2. **历史任务书里的旧文件名**：`xxx（修改）` 即现 `xxx`（见 §1.2）。
3. Three.js 控制台必打一条 deprecation 提示，是已知噪音不是错误。
4. 演示数据为本地模拟，接入知乎真实数据前注意接口与字段映射。

---

## 8. 深读顺序（按需）

1. `README.md` —— 项目全貌与运行方式
2. `docs/首页重做-prompt.md` —— 任务书范本 + 验收清单范式（注意其中文件名为旧称）
3. `docs/网站构建指导.md` —— 架构第一原则与六步施工图（含改动原则表、同步策略）
4. `docs/策划书.html` / `docs/项目策划书.md` —— 产品与商业动机
5. 具体改代码时：先按 §4 职责表定位文件，遵守 §1 红线

## 9. 协作约定

- commit message 用 `docs:` / `feat:` / `chore:` / `fix:` 等前缀 + 中文描述。
- 每步改动独立交付、互不推翻；完成一步即 commit + push（工作区根即仓库）。
- 验证截图/输出存 `evidence/` 作为证据产物。
- 换行符由 `.gitattributes` 统一（`text=auto eol=lf`），不要改全局 git 配置去迁就它。
