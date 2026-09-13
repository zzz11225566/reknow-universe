# AGENTS.md — 炼知 ReKnow「宇宙版」新对话 AI 快速上手

> 本文档发给每个新加入的 AI。读完本文档即可开始工作；细节再按指引去读对应文件。
> 最后更新：2026-09-13（v7：知乎开放平台 + DeepSeek/知乎直答 + 多人实时 + 电影级宇宙与六种天气）

---

## 0. 一句话定位

**炼知 ReKnow v7「炼金宇宙版」** —— 知乎黑客松 2026「知识炼金场」赛道参赛作品：一款把知乎「收藏」炼成「自己的回答」的 AI 学习应用。在 v5 学习闭环（收藏 → 拆解 → 四种学习方式：闯关/快答/听讲/AI 开杠 → DIY 思维导图 → 回流知乎）之上，叠加沉浸式 3D 知识宇宙（收藏=星体、理解=点亮、炼金炉=经验值、天气/真实时间联动场景），v7 再接入**知乎开放平台真实数据、真实大模型（DeepSeek/知乎直答）、多人实时热点话题房间**，并把画面升级为**电影级 + 玻璃液态 + 六种天气（含高分辨率极光）**。

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

- **刚完成（v7）：「知乎开放数据 + DeepSeek + 多人实时 + 电影级宇宙」整合批**。只改 `server.js` / `universe.js` / `index.html` / `app.js` / `boot.js`，未动 `data.js`、`vendor/`、`assets/`。八项需求全部落地（不可实现项与替代方案见 `docs/v7-交付说明.md`）：
  1. **知乎开放平台真接入**（`developer.zhihu.com`，Bearer + `X-Request-Timestamp`）：站内搜索 / 全网搜索 / 实时热榜 / 问题回答 / 我的收藏 / 收藏夹 / 额度查询，全部带 TTL 缓存护额度（热榜 30min、搜索 10min、问题回答 60min、原文 30min）。
  2. **原文圈点批注 bug 修复**：根因是点击浮动工具条时浏览器会清空文档选区 → 旧 `rdApply` 直接 `return null`（表现为"点色块没反应"）。修法三层：工具条 `mousedown` 全部 `preventDefault`（保住选区）+ `selectionchange`/`mouseup` 同步捕获 Range 作兜底 + 段落左侧 `✏️` 一键整段批注。另加 3 步上手引导、`1/2/3` 换色 + `N` 批注快捷键、`touchend` 移动端支持。
  3. **知乎真实原文进阅读器**：`/api/zhihu/original` 多级降级（问题回答 → 站内搜索 → 搜索直达链接），正文按段落切成 `p.para.zh-real`，可直接在**真实知乎原文**上批注。
  4. **6 种天气**：新增第 6 种 `thunder`（雷暴：压暗长空 + 折线闪电 + 全屏闪光 + 低频轰鸣），`WEATHER_ORDER = [sunny, cloudy, rain, thunder, snow, aurora]`。
  5. **极光重做**：三层高分辨率帘幕（240×96 / 160×64 / 96×40 分段）共享一个 3D value-noise fbm 着色器（丝状 rays + 呼吸 + 横向流动 + 青绿→翠绿→品红紫四色阶）+ 地面反光；极光天气自动开超采样（桌面 1.45×、触屏 1.25×）。
  6. **电影级 + 玻璃液态**：新增 WebGL 后处理链（超采样 RT → 桶形畸变/玻璃折射 + 边缘色散 + 高光泛光近似 + ACES + 冷暖分离调色 + 暗角 + 胶片颗粒 + 闪电闪光），出错自动降级直出；CSS 层新增 `#uniGrade`（暗角/高光/颗粒/镜片四层）与全套玻璃语言（`backdrop-filter` + 液膜 `::before` + 流动高光 `::after`）。
  7. **刘看山重定位**：废弃"投影到星海中央"的旧实现（会挡视野），改为 DOM 固定停靠左下安全角、拖拽自动吸附四角、打开右侧面板时自动让位；卡通化表现（Squash & Stretch 弹跳 / 歪头 / 转圈 / 脚下暖光 / ✨ 星点 / hover 工具条 🐾🔽📌🙈）。
  8. **AI 对话 + 多人实时热点房间**：`#uniAiPanel` 双页签；AI 走 `/api/ai/chat/stream`（SSE 流式，上下文=当前星体+原文选区+已写批注）；房间走 `/ws`（补全了客户端上行帧解析、房间成员广播、`@AI` 回答广播全房间）。抬杠改为真实模型（`/api/ai/debate`，提示词硬约束"必须引用用户原话里的具体词"），本地话术库降为离线兜底。
  9. **拆解页接知乎搜索**：`app.js` 末尾外层包装 `renderFlow`，注入「🔍 知乎原文对照」条（第 2 步置顶）：搜索 → 打开知乎原链接 → 用它做原文圈点批注 → 问小炼。
  - **密钥状态（均已实测可用）**：`ZHIHU_ACCESS_TOKEN` ✅；`DEEPSEEK_API_KEY` ✅（2026-09-13 由 owner 更换为有效 key，启动日志会打印 `DeepSeek ✅ 鉴权通过 · 可用模型：deepseek-flash / deepseek-v4-pro · 余额 xx CNY`）。
    **模型分工（2026-09-13 按 owner 要求）**：AI 问答/房间讨论 `zhida → deepseek`（知乎直答优先）；AI 抬杠 `deepseek → zhida`（DeepSeek 优先）。两侧都不可用时落本地兜底话术。`server.js` 的 `providerOrder(mode)` 决定，`/api/ai/models` 返回 `order`（问答链）与 `debateOrder`（抬杠链）。
    ⚠️ 该账号实际可用模型是 `deepseek-flash` 与 `deepseek-v4-pro`；`deepseek-chat` 会被服务端别名到 `deepseek-flash`（实测 ~1.5s，话术紧凑，**默认用它**）。
    `deepseek-v4-pro` 是**推理型**：会先花 ~400 token 写 `reasoning_content` 再出正文，实测 5-6s；`llmOnce`/`streamLLM` 已按 `isReasoningModel()` 自动把 token 预算抬到 2600（否则正文会被截成空串，报"返回为空"），流式还会先发一个 `{type:'thinking'}` 让前端显示"深度思考中…"。演示建议仍用 `deepseek-chat`。
    新增状态接口：`GET /api/ai/models`（模型列表 + 余额 + 探针结果，5 分钟缓存，`?force=1` 强刷）；`/api/health` 里也带 `deepseek.verified/models/balance`。
  - 验证：`node _syntax_v7.cjs`（全绿）+ `node _test_api.cjs`（29/29）+ `node _verify_front.cjs`（109/109；jsdom 三个实例=两个用户 + 取证钩子实例，真连后端）；证据 `evidence/_v7_*.txt`。
  - 密钥文件 `env` 已补进 `.gitignore`（原 `.gitignore` 只忽略 `.env`，会把密钥推上 GitHub）；新增 `env.example` 模板。
  - **知乎官方 Skill 已安装（2026-09-13）**：Skill `zhihu` 0.7.1 在 `C:\Users\rocky\.dsh\skills\zhihu`（DSH 自动发现，技能目录已出现该技能）；官方 CLI `zhihu-cli` 0.6.0 在 `C:\Users\rocky\AppData\Local\ZhihuCLI\current\zhihu-cli.exe`，鉴权 READY（keychain，已 auth status --verify 校验 + me contents 最小验收）。Skill 与 CLI 均已是 stable 最新版（`update_available:false`）。按 SKILL.md 要求**未在工作区留同名副本**，避免宿主发现两个 zhihu Skill。日常可用 `zhihu-cli search zhihu|hot|answer|question answers|me ...|quota`。
  - ⚠️ **本工作区没有 `.git`**（`git status` 报 not a repository），所以本轮**没有备份链、也无法 commit**：改动前的原始版本已不可获取。请把改动同步到你的 `reknow-universe` 仓库副本后再提交（建议：`feat: v7 接入知乎开放平台+DeepSeek+多人实时+电影级宇宙与六种天气`）。
  - ⚠️ 本机沙箱**跑不了 headless 浏览器渲染**（crashpad `OpenProcess: 拒绝访问`、CDP 页面域无响应），本轮**无真实渲染截图**；视觉部分靠着色器源码断言 + DOM/样式断言间接验证，请在正常浏览器打开 `?wx=aurora` 亲验。

- **刚完成（9/12）**：「炼金宇宙优化——熔炉核心 + 星糖罐风」A→E 五批全部交付并回归通过（任务书：`docs/炼金宇宙优化-prompt.md` 或根目录 `炼金宇宙优化-prompt.md`）。批次0 熔炉核心（3D 炉火 → 底部 CSS `#uniHearth`、群星抬升、昼夜 HUD）+ A（内存/泄漏/帧率解耦）+ B（交互反馈/音效/空态）+ C（性能与内存复验/捏合/双击）+ D（雨雪氛围音/两级分层星海）+ E（星糖 shader 星体、糖丝 TubeGeometry 链路、新星诞生动画、`?fps=1` 角标、移动端几何减半）。只改 `universe.js` / `index.html`，硬约束全遵守（app/boot/data/server/vendor/assets 未动、file:// 可用、新状态进 `rkUni6` 子键）。备份链 `*.bak-unifix-20260912-pA~pE`（+各 pX0）在根目录，本地不入库。验证：`_uni_e_verify.cjs` + A/B/C/D 回归脚本全过（证据在 `evidence/_uni_e_*`）。
- **刚完成（9/12）**：覆盖层互斥与移动端修复批。修复「先点已习得再点热榜，面板不互斥」同类问题共 5 处：`showHot()` 补 `hideKnow()+closeCard()`（与 `showKnow` 对称）、`U.exit()` 补收已习得面板与导图覆盖层（重进不再残留）、`rdOpen()` 补收已习得面板、Esc 分层链插入热榜/已习得两级（原只处理导图/阅读器/分类层）；移动端（≤760px）时钟从左上 `top:140px` 移左下（原位置挡住天气按钮带，点不到晴昼/雨夜）、看山气泡限宽右对齐防裁字。备份 `universe.js-bak-overlay-20260912`；验证 `_verify_overlay.cjs`（5 场景 PASS）+ `_verify_final.cjs`（五天气连切、双端截图 `_final_wx_*.png`/`_final_mob_*.png`、无横向溢出、零报错）。
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
│  ├─ v7-交付说明.md                   ★★ v7 交付说明：能力评估 + 需求对照 + **不可实现项与替代方案**
│  ├─ 测试验收清单.md                   ★★ 完整测试流程（自动化三件套 + 浏览器逐条勾 + 部署复测 + 排错表）
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
| `universe.js` | `window.ReckonUniverse`：Three.js 星海（星体=已习得收藏、炼金链路）、真实时间昼夜、热榜抽屉+全站搜索+镜头飞行、星体卡、原文阅读器（3 色高亮+旁注）；`uniMind` 导图覆盖层、`uniKnowPanel`「已习得」面板；熔炉核心：底部 CSS `#uniHearth`、群星抬升；星糖共享 shader 星体、糖丝 TubeGeometry 链路、新星诞生动画、`?fps=1` 角标、`IS_TOUCH` 移动端几何减半。**v7 新增（文件最末的 v7 模块，约 1400 行）**：① 六种天气（`thunder` 雷暴：闪电折线 + 全屏闪光 + 低频轰鸣）② 极光三层高分辨率帘幕 shader（`AURORA_VERT/FRAG`，240×96 主帘 + 地面反光）+ 极光天气自动超采样（`setSuperSample`）③ 电影级后处理链（`buildPost`/`renderFrame`：超采样 RT → 桶形畸变 + 色散 + 泛光近似 + ACES + 暗角 + 颗粒，出错自动降级直出）④ 看山安全停靠（`placeFox`/`foxDock`/`foxHop`/`foxSpin`/`bindFoxTools`，废弃旧的 3D 投影）⑤ AI 对话面板（`ai*`，SSE 流式，上下文=当前星体+选区+批注）⑥ 多人热点房间（`room*` + `wsHooks` 接管 `probeBackend` 的 WS 消息）⑦ 阅读器 v7（`rdApplyV7` 修批注 bug、`rdCaptureSelection` 选区兜底、`injectParaBtns` 段落一键批注、`rdGuideShow` 3 步引导、`paintSrcBar`+`fetchOriginal` 拉知乎真实原文、`openReaderFromZhihu`）⑧ 取证钩子 `?wx=` / `?show=` / `?selftest=1` / `U.debugV7()` |
| `data.js` | `window.DEMO`：4 主题分类 + 12 篇演示选题（拆解块 type 1–7）+ 账号信息；现在是**离线兜底**，真实数据走知乎开放平台 |
| `server.js` | 后端（ESM、**运行时零依赖**，端口 `PORT` 默认 8787）：静态托管；env 装载（读 `env`/`.env`，不覆盖已有环境变量）；知乎开放平台客户端（Bearer + `X-Request-Timestamp`，TTL 缓存护额度）：`/api/zhihu/search|global|hot|answers|original|quota|collections|favlists`；LLM 双通道（问答 zhida → deepseek；抬杠 deepseek → zhida → 本地兜底话术）：`/api/ai/chat`、`/api/ai/chat/stream`（SSE，推理模型先发 `{type:'thinking'}`）、`/api/ai/debate`、`/api/ai/models`（模型列表 + 余额 + 探针 + 两条链，5min 缓存，`?force=1` 强刷）；`providerOrder(mode)` 按用途分链（问答走 zhida、抬杠走 deepseek）；`deepseekProbe()` 启动即验证 key 并把可用模型/余额打进日志；`isReasoningModel()`/`budgetFor()` 自动给 `deepseek-v4-pro` 这类推理模型抬高 token 预算（否则正文会被思考过程挤空 → "返回为空"）；`/ws` 手写 WebSocket（**含客户端掩码帧解析**、房间表 + 广播 + `@AI` 全房间回答、presence/typing）；兼容旧前端的 `/api/hotlist`（真实知乎热榜优先）与 `/api/search`；`/api/health` 报告各密钥是否就绪（不泄露密钥） |

**localStorage 键位表**：`rkSave`（学习进度）、`rkCustom`（自定义选题）、`rkUni6`（宇宙偏好/天气；子键：`pendingBirth`={list,played} 诞生动画队列（E 组）、`followLive`、`weather`、**v7 新增** `aiMsgs`（AI 对话留存最近 40 条）、`roomNick`（热点房间昵称）、`foxDock`（看山停靠位置/缩小/隐藏）、`rdGuideDone`（批注引导是否已看）、`apiBase`（后端基址覆盖，默认同源或 `http://127.0.0.1:8787`））、`rkUniOrig`（原文段落 HTML + 批注）；规划中的 `rkRecipe`（炼金配方，未实现）。

---

## 5. 启动 / 运行 / 验证

- **主方式（推荐，零依赖）**：直接双击 `index.html`（file:// 可用 —— Three.js 本地内置）。AI 对话 / 知乎原文 / 多人房间会自动走本地兜底并提示"未连接后端"，不报错。
- **完整能力（推荐给答辩/部署）**：`node server.js`（或 `npm start`）→ http://localhost:8787。Node ≥ 18（`"type":"module"`），**运行时零依赖**，无需 `npm install`（`devDependencies` 里的 jsdom 只给测试用）。
  - 得到：知乎开放平台真实数据、真实大模型（DeepSeek/知乎直答）、多人实时 WS、真实时间天气推送（含雷暴档）。
  - ⚠️ 启动前确认 8787 未被占用（僵尸预览服务会 EADDRINUSE）。
  - ⚠️ 腾讯云部署：放行端口或前面挂 Nginx，**必须转发 WebSocket 升级头**（`Upgrade`/`Connection`），否则房间退化为本地回显。
  - ⚠️ `v2-rebuild/` 的 server 是 CommonJS，与主项目 ESM 不通用，别混启动方式。
- **语法自检**：`node _syntax_v7.cjs`（根目录：vm.Script 检查 app/universe/boot/data + index.html 结构 + server.js ESM 函数体）。`node --check` 对 app.js 不适用（两代代码同名函数重复声明，见 §1.6），在沙箱里对 server.js 也不适用（禁止 spawn 带管道子进程）。
- **后端自测**：`node _test_api.cjs`（29 项：REST / 知乎接口 / AI(SSE) / WebSocket 双人房间）。需先起 server。
- **前端自测**：`node _verify_front.cjs`（109 项：jsdom 真实 DOM + **真连后端**，含两个实例=两个用户验证多人实时互通、批注 bug 回归、知乎原文批注、抬杠贴合原话）。需先起 server；`jsdom` 在 devDependencies。
- **浏览器验证（人工，必做）**：打开 `http://localhost:8787/?diag=1&auto=uni`（右下角诊断条应为 `errs: []`），再 `?wx=aurora` 看极光、`?show=reader` 试批注、`?show=room` 试多人房间。`?selftest=1` 会跑 30+ 条页内自测并输出到 `#rkSelfTest`。
  - ⚠️ 沙箱/无头环境可能起不来渲染进程（crashpad `OpenProcess: 拒绝访问`），此时 CDP 页面域命令会全部超时——不是代码问题，换正常浏览器即可。
  - 📋 **完整人工验收流程见 `docs/测试验收清单.md`**（准备 → 自动化三件套 → 浏览器逐条勾 2.1–2.10 → 腾讯云部署复测 → 排错对照表 → 需求↔验收小节对照）。
- **截图证据存 `evidence/`**（本仓库约定），本轮证据为文本产物 `evidence/_v7_*.txt`。

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
1. ~~熔炉核心改造收尾~~（9/12 完成：随 A–E 批交付，验证截图入 `evidence/_uni_e_*`）。
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
