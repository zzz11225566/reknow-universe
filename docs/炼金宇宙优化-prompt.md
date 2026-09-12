# Prompt：炼金宇宙模块优化（A 修 bug · B 体验 · C 性能卫生 · D 沉浸与规模 · E 3D 星糖罐风）

你是资深前端工程师。请优化我项目根目录下「炼金宇宙」3D 模块（修改版四件套之一）。这是知乎黑客松项目「炼知 ReKnow v6.5 · 炼金宇宙版」——把「收藏」炼成「回答」的 AI 学习应用。

> 本项目有两套文件——**原版**（`index.html` / `app.js` / `boot.js` / `universe.js`）和**修改版**（`index（修改）.html` / `app（修改）.js` / `boot（修改）.js` / `universe（修改）.js`）。**本次只操作修改版**；修改版 HTML 只引修改版 js，`boot（修改）.js` 懒加载 `universe（修改）.js`。两套互不混用。

## 0. 需求方已拍板的决策（不要反向提问，直接按此实现）

| # | 决策点 | 结论 |
|---|---|---|
| D1 | 星体「点亮」口径 | **只有 `S.learned[id]` 才算点亮**。`S.records[id]`（走完第 4 步但未点第 5 步「学懂」）**不进星海、不进「已习得」面板**。全模块统一这一个口径，消灭现有的双口径 |
| D2 | 热榜点击未习得项 | 弹出简化星体卡（标题/核心/热度 + 「⛏ 开始学这篇」+「📖 看原文 · 圈点」），不再静默无反应 |
| D3 | 手动天气 vs 实时推送 | **手动优先**：用户手动点过天气后进入手动模式，WS 环境推送不再自动切天气，只在 HUD 提示一次；提供「🛰 跟随实时」开关可恢复自动 |
| D4 | 移动端优化 | 做：双指捏合缩放、双击星体聚焦、移动端 `pixelRatio` 降到 1.5 |
| D5 | 星海规模 | **现在就做两级分层**：概览层 = 分类星团（聚合显示），点击进入分类内部平铺星体；搜索时自动切平铺层 |
| D6 | 任务范围 | A（bug 修复）、B（体验优化）、C（性能与代码卫生）、D（天气氛围音 + 分层布局）**全部都做**，按 A→B→C→D→E 顺序分批交付 |
| E1 | 3D 风格 | **提案 A「星糖罐」**（需求方基于省性能选定）：晚安糖系——柔菲涅尔边缘光 + 双层大气晕 + 微流云纹缓旋 + 呼吸式发光；不选 B 萤火系 / C 鎏金系 |
| E2 | 3D 升级范围 | 只做两项质感 + 一个动画：**星体质感**、**链路光效**、**新星诞生动画**。天空背景 / 泛光后处理 / 炼金炉重构本期不做 |
| E3 | 3D 资产边界 | **允许新增自制资产**：可在 `assets/tex/` 新建子目录放自制 PNG（光尘 sprite、噪声烘焙图等）；`assets/` 存量 6 个看山 GIF 与 `vendor/` 仍不动；不做 GLTF 模型（程序化生成足够） |
| E4 | 名场面动效 | **新星诞生**：点「学懂」时把新星 id 记入 `rkUni6.pendingBirth` 队列，**下次进入宇宙**时从炼金炉缓缓飞出、撒光尘、落位荡开柔光晕。宇宙内无法直接学新篇，动画统一在进入时补放 |

## 1. 绝对硬约束（违反任何一条即为失败）

1. **默认只许改动 `universe（修改）.js`**；B/D/E 组涉及新 UI 样式时允许在 `index（修改）.html` 的 `<style>` 里**追加** CSS（不得改动现有规则语义、不得删改任何现有 id/class 钩子）；E 组允许新增 `assets/tex/` 资产文件；`app（修改）.js` / `boot（修改）.js` / `data.js` / `server.js` / **原版四件套** / `vendor/` / `assets/` 存量 GIF 一律不动。允许新增验证脚本（`_` 前缀，如 `_uni_fix_verify.cjs`）与截图产物。
2. **保持单文件、零依赖、纯离线**：双击 `index（修改）.html`（file://）必须完整可用；禁止 CDN、外部字体、构建步骤。file:// 下无后端时全部功能走本地兜底。
3. **文件名含全角括号**（U+FF08/U+FF09）：命令行/脚本中引用**加引号、逐字复制**。
4. **大改前手动备份**：开工第一步，把 `universe（修改）.js`、`index（修改）.html` 复制为 `*.bak-unifix-20260912`（根工作区无 git，reknow-universe 仓库快照是补丁前原版，靠不住）。
5. 前端零密钥；`localStorage` 既有键（`rkSave`/`rkCustom`/`rkUni6`/`rkUniOrig`）语义不得破坏，新增键一律放进 `rkUni6` 子键。
6. 现有功能零回退：5 种天气切换、看山联动、热榜/搜索/星体卡/阅读器圈点批注/已习得面板/思维导图覆盖层/后端 WS 推送，全部保持可用。
7. Three.js 控制台必打一条 deprecation 提示，是已知噪音不是错误。

## 2. 关键架构事实（动手前必须先读代码确认）

### 2.1 文件职责

| 文件 | 与本次相关的内容 |
|---|---|
| `universe（修改）.js`（约 1760 行，单 IIFE） | 本次改动主战场。结构：工具函数 → 天气预设 `WEATHERS`（5 种，数字目标值）→ `envFrame/applyEnv`（lerp 过渡 + 真实时间昼夜）→ `buildScene`（天空穹顶/星点/星尘/轨道环/炼金炉/粒子）→ `rebuildTopics/buildEdges`（星体+链路+流动光点）→ 自制轨道相机 → DOM 看山投影 → 原文阅读器（`rd*`）→ 热榜/搜索/星体卡 → `tick` 主循环 → 后端探测 `probeBackend`（WS `/ws`）→ `U.init/U.enter/U.exit` → **文件末尾「v7 修改版整合模块」**：`uniMind` 导图覆盖层、`uniKnowPanel` 已习得面板，并且 **`var __enterBase = U.enter; U.enter = function(){...}` 包装了 enter** —— 改 `U.enter` 本体时注意包装器仍生效 |
| `boot（修改）.js` | 接入层：懒加载 three → universe；包裹 `showView('uni')`；`?auto=uni` / `?diag=1` 调试钩子（本任务不动它，但要会用钩子验证） |
| `index（修改）.html` | `#uniShell` 骨架（canvas + HUD + 阅读器 `#uniReader`）与全部 CSS（约 451 行起是宇宙样式） |
| `app（修改）.js` | 全局状态 `S`：`S.learned[id]`=第 5 步「学懂」；`S.records[id]`=第 4 步成果（含导图原料，**learned ⇒ records 必然存在**）；`window.enterFlow(id)` 进学习流；`window.save()` 写 `rkSave`；`window.renderMindMap/bindMindMap` 供导图覆盖层复用；`window.crossPairs/levelInfo/styleInsight/mmState` 供已习得面板调用。**E3 诞生动画的「学懂」埋点在 app（修改）.js，但硬约束不许改它** —— 用轮询/包装方案实现（见 E3） |
| `vendor/three.min.js` | Three.js r160 **纯核心** UMD：有全部程序化几何体（Lathe/TorusKnot/Extrude/Tube…）、Canvas/DataTexture、WebGLRenderTarget、ACES 色调映射；**无** EffectComposer/Bloom、无 GLTF/OBJ 加载器、无噪声库。E 组全部效果须程序化 + 自写 GLSL 实现 |

### 2.2 关键函数定位（行号为 2026-09-12 快照，以函数名为准）

- `uniLearnableTopics()`：星海成员口径（现为 `learned || records`，A3 要改成 `learned` only）
- `graphLayout()`：分类扇形布局（每类占位 60°，半径 7.6–11.8 按赞同数 log 缩放）
- `buildEdges()`：**每次 `U.enter` 都会执行**；内部 `var fpMesh = new T.Points(...); scene.add(fpMesh);` 无全局引用（A1 泄漏源）
- `updateFlows(t)`：流动光点用固定 `0.016` 步进（A4）
- `applyEnv()`：`fogNear = c.fogD` 存了变量但从未应用到 `scene.fog.density`（A2）
- `updateRainSnow(dt, t3)`：雨水循环里有算而未用的 `var x`（A4 死代码）
- `disposeObj(o)`：会 dispose 星体 glow 精灵的 `material.map` —— 那是全局共享的 `glowTex`（C1）
- `hotList()/paintHot()`：返回**全部选题**；点击走 `selectStar(id, true)`，星体不存在时 `if (!st) return;` 静默返回（B1）
- `selectStar(id, focusCam)`：星体卡渲染与三个按钮（学/读/导图）绑定处（B1 要加未习得降级卡）
- `applyEnv2(payload)`（在 `probeBackend` 内）：WS env 推送自动 `setWeather`（B2 手动优先改造点）
- `setWeather(key, silent)`：切天气 + 存 `rkUni6.weather` + 看山联动
- 阅读器：`rdOpen/rdPersist/rdPaintNotes/rdApply/rdDelNote`；恢复靠「段落 innerHTML 快照 + 段落数一致」比对（B5）
- `tick(ts)`：主循环；`overlayOpen` 判断可用 `#uniReader.on` / `#uniHotPanel.on` / `#uniKnowPanel.on` / `#uniMind.on`（B6）
- `bindCanvas()`：pointer 事件（C2 捏合/双击在这里加）
- `rebuildTopics()/buildEdges()`：E 组星体/链路质感升级点就位（**D2 分层也改这两个函数，E 必须在 D 之后做**，在 D2 的 scope 过滤基础上叠加质感升级）
- `U.enter` 末尾包装器（v7 模块）：进宇宙时 `bootKnow()` + `paintKnow()` + 空星海引导文案；**E3 诞生动画的补放钩子也挂这里**

### 2.3 运行与验证

- **主验证**：双击 `index（修改）.html`（file://）+ `node server.js`（端口 8787，先确认未被占用）两种模式都要验。
- 调试钩子：`?auto=uni`（1.2s 后自动进宇宙、3.2s 后切雨夜）、`?diag=1`（左下角诊断面板，`U.diag()` 返回 `{ready, ok, active, stars, edges, weather}`）。
- 历史做法：Playwright + 本机 Chrome（参考 `_verify_port.cjs`，已支持修改版文件名与全角括号），产出 `_uni_*.png` 截图作为证据。
- 截图前先置 `localStorage.rkIntro=1` 跳过新手引导；390px 移动布局用 iframe 模拟（外层 420px 窗口 + `--allow-file-access-from-files`）。
- 语法自检：`node --check "universe（修改）.js"`。

## 3. 任务清单

> 按 A→B→C→D→E 顺序分批做，**每批独立完成 + 独立验证 + 独立交付**，一批翻车不拖垮其他批。每批完成向我汇报并等我确认再进下一批（若我声明「一口气做完」则可连续）。

### A 组：Bug 修复

- **A1 流动光点泄漏**：模块级新增 `flowMesh` 引用；`buildEdges()` 开头若 `flowMesh` 存在则 `scene.remove + geometry/material.dispose`，再重建。验收：反复进出宇宙 5 次，`U.diag()` 场景内 Points 对象不累积（可用 `?diag=1` + 场景遍历计数），画面中无冻结光点残影。
- **A2 雾密度生效**：`applyEnv()` 中把 `c.fogD` 应用到 `scene.fog.density`（FogExp2）。注意 `fogD` 是 0.028–0.085 的密度值，直接赋即可；删除/吸收死变量 `fogNear`。验收：晴 vs 雨夜切换时远景淡出程度肉眼可辨。
- **A3 点亮口径统一为 learned-only**：`uniLearnableTopics()` 改为只看 `S().learned`；同步修改文件头第 33 行注释、`graphLayout` 内 `learned` 标记（保持只看 `learned` 即可，此刻两口径自然一致）；`openUniMind` 的 `records` 守卫保留（防御）。**连带文档**：全部任务完成后更新 `AGENTS.md` §2/§4 中「口径 S.learned ∪ S.records」的表述为 `S.learned`，并在 §2「刚完成」补一行本次优化记录。验收：只有 `records` 无 `learned` 的文章不出现在星海与「已习得」面板，`U.starPlan()` 结果一致；demo 数据全学成后星海 = 12 颗星。
- **A4 死代码与帧率耦合**：删雨水循环里未使用的 `var x`；`updateFlows` 改为接收 `dt`（`f.t += f.sp * dt`），`tick` 里传 `dt`。验收：高刷屏（120Hz）上光点流速与 60Hz 一致（肉眼看不出翻倍即可）。

### B 组：体验优化

- **B1 热榜未习得项降级卡**：`selectStar` 找不到星体时不再静默返回，改为渲染一张降级卡（复用 `#uniCard` 容器与样式，加 `uc-unlearned` 修饰类）：标题、🎯 核心、分类/答主/热度标签、按钮「⛏ 开始学这篇」（`U.exit()` + `window.enterFlow(id)`）与「📖 看原文 · 圈点」（`rdOpen(id)`）。卡片对自定义选题（🧪）同样适用。验收：清空进度的全新状态下点热榜任意条目都有反应，两个按钮均可走通。
- **B2 手动天气优先 + 跟随实时开关**：
  - `rkUni6` 新增子键 `followLive`（默认 `true`）。
  - 用户手动点天气按钮 → `storeSet('followLive', false)` + 一次性 toast「已切换为手动天气，点「🛰 跟随实时」可恢复自动」。
  - `applyEnv2` 收到推送且 `followLive===false` 且推送天气 ≠ 当前天气时：**不切**，只在 `#uniClockS` 行尾追加「 · 实时：🌧️ 雨夜」提示（每次进入宇宙最多提示一次，不刷 toast）。
  - 天气按钮区末尾注入小开关「🛰 跟随实时」（`.wbtn` 同款小按钮，`on` 态表激活）：点击 → `followLive=true`，若已知服务端天气则立即 `setWeather` 对齐。
  - 验收：连后端手动切晴后，服务端推雨夜不自动切、HUD 出现提示；点开关后恢复自动对齐。file:// 无后端时开关点击给出友好提示，不报错。
- **B3 空星海引导按钮化**：`U.enter` 包装器里的空星海文案处，追加一个可点按钮「📚 去挑一篇点亮它」（样式用新类 `.uni-cta`，白底金边药丸），点击 `showView('home')`。验收：全新本地存储进宇宙，空态引导出现按钮且可点回首页。
- **B4 搜索无结果引导**：`applySearch` 无匹配时，提示语后追加按钮「去收藏与选题搜搜看」，点击 `showView('home')`。有匹配时不出现。验收：搜 gibberish 出现按钮可点回首页。
- **B5 批注孤儿清理**：`rdOpen` 恢复时段落数不一致 → 除现有 `st.paras=null` 外，若 `st.notes.length>0` 则清空 notes 并 toast「原文结构有变化，已清理 N 条失效批注」。验收：手工改 `rkUniOrig` 里某篇的 paras 长度后打开阅读器，批注列表与计数一致、无悬空条目。
- **B6 覆盖层打开时 3D 降频**：`tick` 中检测阅读器/热榜/已习得面板/导图覆盖层任一打开 → 渲染降为约 12fps（帧计数取模跳过 `renderer.render`，其余轻量更新保留），全关恢复满帧；`projectFox` 在阅读器打开时跳过。验收：`?diag=1` 下开着阅读器时帧率显著下降（或 DevTools Performance 见 render 调用变稀），关阅读器恢复。

### C 组：性能与代码卫生

- **C1 共享纹理保护 + 标签纹理缓存**：`disposeObj` dispose `material.map` 时跳过全局共享的 `glowTex`/`softTex`；`makeLabelSprite` 加模块级缓存（key = 文案+颜色），`clearStars` 时不得 dispose 缓存中的标签纹理（改为统一在 `U.exit`/页面卸载时清）。验收：反复进出宇宙 10 次内存不明显上涨（DevTools Heap 粗看即可），标签显示正常无花屏。
- **C2 移动端手势与降分辨率**：`bindCanvas` 增加：① 双指捏合缩放（跟踪两个 pointer，按间距变化比例调 `camState.dist`，clamp 5–42，与滚轮同档）；② `dblclick` 命中星体则 `selectStar(id, true)` 聚焦；③ `setPixelRatio(Math.min(devicePixelRatio, 触屏?1.5:2))`（一次性判定即可）。验收：DevTools 移动模拟下捏合/双击可用；桌面行为不变。
- **C3 死代码清理**：删除 universe 内残留空分支（如 `if (window.S && S().view === 'uni') { }`、`if (window.ReckonUniverseUI ...) { }`、A 组修掉后的残余变量）。验收：`node --check` 通过 + file:// 全功能冒烟无回归。
- **C4（低优先，可做可不做）**：把 `_syntax.js` 复制改造为 `_syntax_port.cjs`，支持对修改版四件套做编译检查（解决 AGENTS.md 待办 #2）。验收：`node _syntax_port.cjs` 对四个修改版文件报 PASS。

### D 组：沉浸与规模

- **D1 天气氛围音**：`uniSfx` 扩展雨/雪两种轻噪声循环（`AudioBuffer` 白噪声 + 低通滤波 + 缓慢 gain 起伏，2–4s 无缝循环），切出该天气时淡出停止；尊重 `S().sound===false`（全局静音立即停）。音量克制（gain ≤ 0.04），晴朗/多云/极光无循环音。`?auto=uni` 自动演示时生效可关。验收：切雨夜 1s 内出现雨声、切晴 1s 内淡出；顶栏音效钮关闭时立即无声；file:// 正常。
- **D2 两级分层星海**（本批最大项，仔细做）：
  - **状态**：模块级 `scope`（`null`=概览，或某分类 id）；`rebuildTopics/buildEdges` 接受 scope 参数过滤 `uniLearnableTopics()`。
  - **概览层**：每个有已习得文章的分类渲染一个「星团节点」（分类色球体，半径 ∝ 数量开方，标签「图标 分类名 ×N」）；点击星团 → `focusStar` 飞行 + 重建为该分类平铺层；星团间不画链路（MVP）。
  - **分类层**：现有扇形布局改为该分类独占整球（方位均分、半径带 6–10 可调），链路只画分类内部；HUD 出现面包屑「← 全部星域」，点击或 `Esc` 回概览；`Esc` 优先级：导图覆盖层 > 阅读器 > 分类层 > 退出宇宙（与 boot 现有 Esc 链协调，boot（修改）.js 不动，用 universe 内 keydown 判断 `#uniShell.on` 且分类层打开时阻止冒泡到 boot 的监听）。
  - **搜索强制平铺**：搜索框非空 → 自动切平铺全量视图（scope 置 null + 全量星体），清空恢复概览。
  - **已习得面板「🎯 定位」**：概览层下先自动钻进对应分类再聚焦。
  - **兼容**：`U.starPlan()` 保持返回全量 learned id（诊断用，与视图层无关）；`U.diag()` 增加 `scope` 字段。
  - 验收（demo 数据 4 分类）：① 学成 ≥2 个分类后进宇宙看到的是 ≤4 个星团而非满天星；② 点星团飞行后展开该分类全部已习得星体；③ 面包屑与 Esc 返回正常；④ 搜索时直接出现全量星体；⑤ 已习得面板定位在概览层可用；⑥ 空星海引导逻辑在两层都正确（全空显示 B3 引导；某分类空时点击不进）。

### E 组：3D 建模优化 —— 「星糖罐」风

> **必须在 D2 完成后做**（与 D2 共用 `rebuildTopics/buildEdges`，在其 scope 过滤逻辑之上叠加质感升级）。风格基调：晚安糖系，柔、暖、 sleepy & cozy，贴看山打瞌睡的调性；性能优先（需求方明确「省性能」），一切效果以「集显老本 60fps」为底线。

- **E1 星体质感（星糖）**：
  - 材质从 `MeshStandardMaterial` 升级为自写 `ShaderMaterial`（一个共享 shader，per-star uniform：分类色、learned 标记、呼吸相位）：深蓝紫球体 + 柔菲涅尔边缘光（糖釉反光边）+ 表面极 subtle 的流云纹缓旋（fbm 噪声，色相差小到几乎只是「活」）；
  - 大气晕改为**两层**：内层紫金、外层淡蓝，透明度随天气 `starO/dustO` 联动（复用现有 ENV 通道）；
  - 已点亮星保留呼吸式明暗（升级现有 `glow.material.opacity` 逻辑，纳入 shader  uniform），未点亮 = 柔暗糖坯；
  - 自转：每星极慢自转（`rotation.y += dt * 0.05~0.12`，按 id hash 差异化）。
  - 验收：5 种天气下星体边缘光与晕层过渡自然；晴→雨夜切换时星体观感随场景变暗而不突兀；已点亮/未点亮一眼可辨；`?diag=1` 下帧率与改造前持平（±5% 以内）。
- **E2 链路光效（糖丝）**：
  - 链路从 `T.Line` 升级为 `TubeGeometry`（半径 ∝ 两端热度，clamp 0.02–0.06，管段数移动端减半）+ 共享流动 shader：管壁半透明深色，内壁是缓慢流动的极光渐变（两端分类色 → 中央暖白），流速沿用 `updateFlows` 的 dt 语义；
  - 双端已习得：管中央叠加一条**金丝**（shader 内分支，金 #ffd98a 高亮细带）——对应原「金线」语义；
  - 流动光点（现有 `flowGeo` 系统）保留但缩小变柔，作为糖丝上的「亮点」，融入新 shader 的亮度调制。
  - 验收：链路在概览层隐藏（沿用 D2）、分类层/平铺层正常；双端已习得链路可见金丝；天气切换链路色调跟随；移动端管段减半后无棱角感。
- **E3 新星诞生动画（噗噜升空）**：
  - **埋点（不改 app.js）**：宇宙侧轻量轮询——在 `tick` 或 `U.enter` 时对比 `S().learned` 与 `rkUni6.pendingBirth` 已放列表，发现新 learned id 且星海有该星 → 入队待放；播放完记入已放列表。（轮询成本低、零侵入，避免改 app（修改）.js）
  - **播放时机**：挂在 `U.enter` 包装器链尾（D2/E 完成后的最新一层）：进宇宙时若有待放队列，逐颗播放——炼金炉口「噗」地腾起暖光（复用炉火粒子做一次加强喷发）→ 小火苗球沿 **CatmullRom 曲线**（炉口 → 出射高点 → 目标轨道位）飞行 2.2–2.8s，撒一路细小光尘（Points 拖尾，用 `assets/tex/` 自制光尘 PNG 或程序化圆点）→ 落位瞬间目标星 `scale 0→1` 弹性胀开 + 一圈柔光晕扩散（sprite 动画）→ 该星纳入正常 tick 动画；队列多颗时间隔 0.8s 连放。
  - **与 D2 分层的关系**：若进入时是概览层且新星属于某分类，先保持概览（星团计数+n 的刷新用 `paintKnow`/标签更新），飞行目标点取**平铺层坐标系**——简单做法：诞生播放期间自动切平铺全量视图（与搜索同规则），放完用户可自行回概览。
  - **音效**：复用 `uniSfx` 加一个 `birth` 种类（两音上行泛音，轻柔），尊重静音开关。
  - 验收：模拟学完一篇后进入宇宙 → 看到诞生全流程且新星最终状态正常（可圈点、可导图）；连续学 3 篇后进入 → 连放 3 颗不重叠不串位；`?auto=uni` 演示路径下预埋 `pendingBirth` 也能播放；移动端粒子减半流畅。
- **E4 移动端与性能兜底**：E1 晕层减半、E2 管段减半、E3 光尘减半（触屏判定同 C2）；桌面端新增 `?fps=1` 调试角标（左上角小字 FPS，仅 query 开启）。验收：DevTools 6x CPU 降速下仍 ≥30fps；`?fps=1` 显示正常。

## 4. 验收清单（全部通过才算完成）

**全局（每批都要）**

1. 双击 `index（修改）.html`（file://）控制台无新增报错；`node server.js` 模式同样无新增报错。
2. `node --check "universe（修改）.js"` 通过。
3. 桌面 1440px + 移动 390px 两端截图（`_uni_desktop.png` / `_uni_mobile.png`）无破版、无横向溢出。
4. 现有功能冒烟：天气 5 连切、看山动作联动、点星体出卡、进学习流、阅读器圈点+批注+刷新恢复、已习得面板、导图覆盖层、热榜/搜索、（后端模式下）WS 实时徽标。
5. **E 组追加**：新增 `assets/tex/` 资产均在 workspace 内、file:// 直读可用、总新增体积 ≤ 500KB。

**分组附加**：A1–A4、B1–B6、C1–C3、D1–D2、E1–E4 各条目的「验收」小节。

## 5. 完成后汇报格式

逐批汇报：① 改了哪个文件的哪几个函数（前后对照要点）；② 该批验收清单逐项结果；③ 截图证据路径；④ 因架构约束未能实现/需要我决策的偏差。全部完成后：更新 `AGENTS.md`（口径变更 + 本次优化记录 + 备份文件登记 + `assets/tex/` 新增资产目录说明），并给出最终汇总。

## 6. 已知限制与风险（开始前必读）

- **修改版四件套无版本控制**：开工先做 §1.4 的手动备份；每批交付后把该批稳定版再备份一份（`*.bak-unifix-20260912-批次名`）。
- **行号会漂移**：§2.2 的行号是 2026-09-12 快照，一切以函数名搜索为准。
- **v7 末尾包装器**：改 `U.enter` 本体时记住文件末尾还有一层 `__enterBase` 包装（`bootKnow/paintKnow/空态引导`），不要绕开或重复实现它——B3 的空态按钮就改在包装器文案处；E3 诞生动画挂最新一层包装链尾。
- **index（修改）.html 尽量不动**：新 UI（跟随实时开关、空态按钮、面包屑、降级卡样式）优先用 JS 注入 DOM + 追加 CSS 类（与现有 `ensureKnowPanel` 的注入方式一致），CSS 追加在文件 `<style>` 末尾并加注释分区。
- **headless Chrome 最小窗口约 497px**：390px 移动验证用 iframe 模拟；双指捏合在 headless 下难自动化，C2/E4 手势允许真机人工补验，脚本验双击与 pixelRatio 即可。
- **demo 数据规模小**：D2 分层在 12 篇 demo 下星团很少，验收时允许用 `localStorage` 预置多篇已学状态或临时复制 data.js 数据来模拟 30+ 星体（只验证布局不提交 data.js 改动）。
- **E 组依赖 D2**：`rebuildTopics/buildEdges` 会被 D2 改成按 scope 过滤，E 组质感升级必须叠加在其后，顺序不可对调。
- **E3 埋点零侵入的代价**：轮询方案有最长约 1 个 tick 的延迟，且用户「学懂后永不进宇宙」则队列静默累积——`pendingBirth` 队列上限 20，超出丢弃最旧并记 `console.info`，避免无限增长。
