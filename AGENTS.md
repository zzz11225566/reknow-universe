# AGENTS.md — 炼知 ReKnow「宇宙版」新对话 AI 快速上手

> 本文档发给每个新加入的 AI。读完本文件即可开始工作；细节再按指引去读对应文件。
> 最后更新：2026-09-12（修改版四件套已转正为根目录正式文件名，旧版归档 archive/v6.5/）

---

## 0. 一句话定位

**炼知 ReKnow v6.5「炼金宇宙版」** —— 知乎黑客松 2026「知识炼金场」赛道参赛作品：一款把知乎「收藏」炼成「自己的回答」的 AI 学习应用。在 v5 学习闭环（收藏 → 拆解 → 四种学习方式：闯关/快答/听讲/AI 开杠 → DIY 思维导图 → 回流知乎）之上，叠加沉浸式 3D 知识宇宙（收藏=星体、理解=点亮、炼金炉=经验值、天气/真实时间联动场景）。

---

## 1. 红线（先读这段，违反任何一条都可能造成事故）

1. **活跃主线就是根目录四件套**（9/12 起由「修改版」转正，文件名已去掉全角括号）：
   - `index.html` / `app.js` / `boot.js` / `universe.js`
   - 旧版 v6.5 四件套在 `archive/v6.5/`，是历史基线，**除非明确要合入原版改进，否则不要动**。
   - 引用关系固定：`index.html` 引 `app.js` + `boot.js`；`boot.js` 懒加载 `universe.js`。
2. **历史命名**：老文档/任务书里出现的 `xxx（修改）.js/html` 就是现在根目录的 `xxx.js/html`（2026-09-12 改名）；命令行里遇到含全角括号的文件名必须**加引号、逐字复制**。
3. **根工作区没有 git**。唯一版本控制是 `reknow-universe/` 子目录，且其中快照是 9/10 补丁**前**的原版（比 archive/v6.5/ 更旧）。对四件套做任何大改前，**先手动备份**（复制一份加日期后缀），不要指望 git 兜底。
4. **前端零密钥**。AI Key、知乎 token、用户数据只放后端；浏览器端绝不出现任何密钥。
5. **首页内容由 JS 运行时渲染**（hero / 分类书架 / 题卡在 `app.js` 里生成）。改首页视觉只能通过 CSS 命中现有类名（`.hero-band` / `.cat-shelf` / `.tcard` / `.pick-bar` 等），**不得改 JS 生成的内容结构**。
6. **`app.js` 是含两代代码的 13 万字符单体**，同名函数靠「后者声明覆盖前者」生效（v6 增补在文件后半）。查找函数定义时**认准最后一次出现**；不大改结构，只在外层扩展。
7. **vendor/ 与 assets/ 不动**（Three.js 兼容构建、看山官方 GIF）。
8. **不要把历史产物当垃圾清理**：`_verify_*.png`、`_shot-*.png`、`_verify-out.json` 是验证截图/输出；`首页重做-设计稿.jpg` 是首页重做设计稿原图（曾用哈希命名 `fcda45d…jpg`）。

---

## 2. 当前任务与进度（接手前先看这里）

- **刚完成（9/12）**：按设计稿重做首页与顶栏（任务书：`首页重做-prompt.md`，设计稿：`首页重做-设计稿.jpg`）。新设计已落地：白底顶栏 + 金色胶囊分段控件、衬线大标题 hero、静态「五步炼知法」卡片条、分类书架。桌面端（1440px）截图 `_verify_desktop.png` 与移动端（390px，无横向溢出）`_verify_mobile.png` 均已验证通过。
- **9/11 完成的结构改版**：砍掉「思维图谱」「知识库」两个独立视图，功能并入炼金宇宙（`uniMind` 导图覆盖层 + `uniKnowPanel`「已习得」面板 + 交叉分析）。
- **同日（9/12）工程整理**：修改版四件套转正为根目录正式文件名；旧版 v6.5 与历史脚本归档 `archive/`；根目录文档统一为最新版。
- **下一步方向**（详见 `reknow-universe/网站构建指导.md` 的六步路线图）：账户系统 + SQLite + JWT 云端同步 → AI 助手小窗（SSE 流式）→「炼金配方」个性化系统 → 知乎开放平台接入 → …
- README 标注 "v6.9 精简 IA" 方向的改版在规划中。

---

## 3. 目录结构

```
C:\Users\cxy\Desktop\宇宙版\
├─ AGENTS.md                  ← 本文档
├─ README.md                  项目说明（v6.5 运行方式、文件结构、开发者说明）
├─ 使用指南.html               用户使用指南（自包含独立文档页）
├─ 策划书.html                 项目策划书 v6（9/10 22:14 动机卡片版，最新）
├─ 首页重做-prompt.md          首页重做任务书（含验收清单，是「给 AI 的任务书」范本）
├─ 首页重做-设计稿.jpg          ★ 首页重做 UI 设计稿原图
├─ package.json               入口 server.js；npm start = node server.js
├─ server.js                  可选实时后端：静态托管 + REST + 手写 WebSocket，纯 Node 零依赖，端口 8787
│
├─ index.html                 ★ 主应用（骨架+全部CSS；9/12 已按设计稿重绘首页）
├─ app.js                     ★ 应用逻辑（砍掉 mind/lib 视图，图谱并入宇宙；含两代代码单体）
├─ boot.js                    ★ 接入层：包裹 showView、懒加载 three+universe、入口注入、看山换动作
├─ universe.js                ★ 3D 宇宙场景/天气引擎/热榜搜索/原文圈点 + v7 已习得面板/导图覆盖层
├─ data.js                    演示数据：4 主题 + 12 选题 + 自定义选题（window.DEMO）
│
├─ assets/                    看山官方 6 动作 GIF（idle/pc/wave/sway/dozing/dribble）
├─ vendor/three.min.js        Three.js r160 UMD 兼容别名构建（离线内置）
├─ demo/                      两个独立静态 Demo（collection-demo / optimized-demo）
├─ v2-rebuild/                另一套 v6.6.0 精简版原型（CDN Chart.js，独立代码基，9/9 后未动）
├─ archive/
│  ├─ v6.5/                   旧版四件套（9/10 22:30 前基线，含补丁）
│  └─ patches/                一次性历史脚本 + *.patched-20260912 回滚产物（见 §6/§7）
├─ reknow-universe/           ★ 唯一 Git 仓库（github.com/zzz11225566/reknow-universe）
│  ├─ 原版四件套快照（9/10 补丁前）+ README/LICENSE/.gitignore
│  ├─ 网站构建指导.md           ★★ 面向 AI 的架构「施工图」（先读）
│  └─ 项目策划书.md             策划书 Markdown 版
└─ _verify_*.png / verify_port_out.json  验证截图/输出（证据产物，勿删）
```

---

## 4. 核心文件职责表

| 文件 | 职责 |
|---|---|
| `index.html` | 主应用骨架 + 几乎全部 CSS（单 `<style>`）；9/12 已按设计稿重绘首页 |
| `app.js` | 全局状态 `S`（localStorage `rkSave`/`rkCustom`）；`showView` 只切 home/flow 两视图；`renderHome` 动态渲染 hero/分类书架/题卡；学习流四步（拆解→四种学习方式→成果→回流）；`renderMindMap`/`bindMindMap(t, hostId)` 思维导图（可挂任意宿主）；AI 开杠 `debateRebuttals` |
| `boot.js` | 零侵入接入层：包裹 `showView` 支持 `'uni'`；懒加载 `vendor/three.min.js` → `universe.js`；拆解页注入「📖 原文圈点」按钮；`__rkOnWeather` 按天气给看山换 GIF；调试钩子 `?auto=uni` / `?diag=1` |
| `universe.js` | `window.ReckonUniverse`：Three.js 星海（星体=已习得收藏、Bezier 炼金链路、中央炼金炉）、5 种天气 1.5s 过渡、真实时间昼夜、热榜抽屉+全站搜索+镜头飞行、星体卡、原文阅读器（3 色高亮+旁注）；v7 新增 `uniMind` 导图覆盖层、`uniKnowPanel`「已习得」面板 |
| `data.js` | `window.DEMO`：4 主题分类 + 12 篇演示选题（拆解块 type 1–7）+ 账号信息；真实接入时替换为知乎开放平台数据 |
| `server.js` | 可选后端（ESM、零依赖）：静态托管；`/api/hotlist`（模拟热榜，id 与本地选题对应）、`/api/search`、`/api/env`（模拟天气）、`/ws` 手写 WebSocket 定时广播；前端自动探测，连上点亮「实时」徽标 |

**localStorage 键位表**：`rkSave`（学习进度）、`rkCustom`（自定义选题）、`rkUni6`（宇宙偏好/天气）、`rkUniOrig`（原文+批注）；规划中的 `rkRecipe`（炼金配方，未实现）。

---

## 5. 启动 / 运行 / 验证

- **主方式（推荐，零依赖）**：直接双击 `index.html`（file:// 可用 —— Three.js 本地内置，热榜/搜索/天气走内置模拟数据自洽）。
- **可选后端**：`node server.js`（或 `npm start`）→ http://localhost:8787，获得实时热榜/环境推送（绿色「实时」徽标）。Node ≥ 18（`"type":"module"`）。
  - ⚠️ 启动前确认 8787 未被占用。
  - ⚠️ `v2-rebuild/` 的 server 是 CommonJS，与主项目 ESM 不通用，别混启动方式。
- **语法自检**：`node archive/patches/_syntax.js`（对 app/universe/boot/data 四件套做编译检查）。⚠️ 该脚本写于双轨期、按**当前正式文件名**检查，检的即主线代码。
- **浏览器验证**：改动后必须在真实浏览器打开检查桌面 + 移动两端（历史做法：Playwright + 本机 Chrome，参考 `archive/patches/_verify.js` / 参数化版 `_verify_port.cjs`；产出截图作为证据）。

---

## 6. 历史一次性脚本（已执行完毕，勿重跑；均在 archive/patches/）

| 脚本 | 时间 | 作用 |
|---|---|---|
| `_verify.js` | 9/10 21:19 | Playwright 验证**原版**：首页渲染/进宇宙/阅读器/截图 |
| `_syntax.js` / `_syntax.cjs` | 9/10 21:58 | 四文件语法检查（`.js` 已删，留 `.cjs`） |
| `_patch_debate.py` | 9/10 21:48 | 改原版 app.js：开杠话术引用用户原话 |
| `_patch_fox.py` / `_patch_foxcss.py` | 9/10 22:02–03 | 改原版 universe.js + index.html：看山固定右下角 |
| `_patch_plan.py` | 9/10 22:14 | 改策划书.html：插入动机卡片 |
| `_patch_home.py` | 9/10 22:29 | 改原版 app.js：首页「⚡ 打开即学」CTA + 炼金成就入口 |
| `_patch_label.py` | 9/10 22:30 | 改原版 index.html：顶栏改名「🏆 炼金成就」 |
| `*.patched-20260912` | 9/12 13:35 | 上述 4 个补丁移植到修改版的产物，**同日经 owner 决定回滚**，保留可复用 |

---

## 7. 待办与风险

### 待办
1. **原版 4 个内容补丁是否合入主线**：移植产物在 `archive/patches/*.patched-20260912`（9/12 经 owner 决定回滚），是否重新合入待 owner 决策；验证脚本 `_verify_port.cjs` 在根目录保留。
2. **改造验证工具链**：`archive/patches/_verify.js` 是双轨期旧脚本；参数化脚本 `_verify_port.cjs`（支持自定义端口与入口）可在此基础上收敛统一。
3. **版本控制 consolidation（建议）**：把 `reknow-universe/.git` 上移到工作区根（仓库跟踪路径与根目录一致，历史可无缝衔接），此后在工作区直接 commit/push；同步解决 reknow-universe/ 内的旧版文档重复。
4. 按 `reknow-universe/网站构建指导.md` 六步路线图推进（第 0 步：需求冻结）。

### 风险
1. **主线四件套仍无版本控制**（reknow-universe 仓库快照是补丁前原版）——当前最大工程风险。大改前手动备份；待办 3 完成后解除。
2. **历史任务书/文档里的旧文件名**：`xxx（修改）` 即现 `xxx`（见 §1.2），接手老任务书先对表。
3. Three.js 控制台必打一条 deprecation 提示，是已知噪音不是错误。
4. 演示数据为本地模拟，接入知乎真实数据前注意接口与字段映射。

---

## 8. 深读顺序（按需）

1. `README.md` —— 项目全貌与运行方式
2. `首页重做-prompt.md` —— 任务书范本 + 验收清单范式（注意其中文件名为旧称）
3. `reknow-universe/网站构建指导.md` —— 架构第一原则与六步施工图（含改动原则表、同步策略）
4. `策划书.html` / `reknow-universe/项目策划书.md` —— 产品与商业动机
5. 具体改代码时：先按 §4 职责表定位文件，遵守 §1 红线

## 9. 协作约定

- commit message 用 `docs:` / `init:` 等前缀 + 中文描述。
- 每步改动独立交付、互不推翻；完成一步即 commit（在 `reknow-universe/` 仓库内；待办 3 完成后改在工作区根）。
- 验证截图/输出文件保留作为证据产物。
