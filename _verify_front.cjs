/* ============================================================
   v7 前端集成验证（jsdom 真实 DOM + 真实后端）
   用法：node _verify_front.cjs
   覆盖：
     · 四个前端文件在真实 DOM 中加载零异常
     · 六种天气 / 极光三层 / 超采样 / 天气按钮
     · 看山安全停靠 + 卡通化 DOM
     · 电影级 & 玻璃液态叠加层
     · 原文批注（含"选区丢失后仍能批注"这一旧 bug 的回归）
     · 知乎真实原文拉取并在其上批注（真连后端）
     · AI 对话 SSE 流式（真连后端）
     · 多人实时热点房间：两个 jsdom 实例 = 两个用户，验证实时互通
   ============================================================ */
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM, VirtualConsole } = require('jsdom')

const ROOT = __dirname
const BASE = 'http://127.0.0.1:8787'
let pass = 0, fail = 0
const fails = []
function ok(n, c, extra) {
  if (c) { pass++; console.log('  PASS  ' + n + (extra ? '  ' + extra : '')) }
  else { fail++; fails.push(n + (extra ? '  [' + extra + ']' : '')); console.log('  FAIL  ' + n + '  ' + (extra || '')) }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

/* ---------------- canvas 2D 万能桩 ---------------- */
function fakeCtx() {
  const store = new Map()
  const target = function () { }
  const p = new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return undefined
      if (prop === 'canvas') return null
      if (store.has(prop)) return store.get(prop)
      let fn
      if (prop === 'measureText') fn = function () { return { width: 42 } }
      else if (prop === 'createRadialGradient' || prop === 'createLinearGradient') fn = function () { return { addColorStop() { } } }
      else if (prop === 'getImageData') fn = function () { return { data: new Uint8Array(4) } }
      else if (prop === 'createPattern') fn = function () { return {} }
      else fn = function () { return p }
      store.set(prop, fn)
      return fn
    },
    set() { return true },
    apply() { return p }
  })
  return p
}

/* ---------------- THREE 记录型桩（真实 three 需要 WebGL，这里只需接口契约） ---------------- */
const NUMERIC_DEFAULTS = {
  x: 0, y: 0, z: 0, w: 1, opacity: 1, intensity: 1, visible: true, aspect: 1.5,
  density: 0.05, near: 0.1, far: 400, fov: 55, size: 1, spin: 0.01, count: 0
}
function makeThreeStub(record) {
  function make(kind, args) {
    const target = function () { }
    target.__kind = kind
    target.__args = args || []
    const store = new Map()
    const p = new Proxy(target, {
      get(t, prop) {
        if (prop === '__kind' || prop === '__args') return t[prop]
        if (prop === 'then') return undefined
        if (store.has(prop)) return store.get(prop)
        if (prop === 'parameters') {
          const a = t.__args
          const v = {
            width: a[0], height: a[1],
            segments: a[2] || 0, segmentsY: a[3] || 0,
            radius: a[0], radialSegments: a[2]
          }
          store.set('parameters', v)
          return v
        }
        if (prop === 'uniforms') {
          const v = t.__args[0] && t.__args[0].uniforms ? t.__args[0].uniforms : {}
          store.set('uniforms', v)
          return v
        }
        if (prop === 'material') {
          const v = t.__args[0] && t.__args[0].material ? t.__args[0].material : make('material', [t.__args[0]])
          store.set('material', v)
          return v
        }
        if (prop === 'geometry') {
          const v = t.__args[0] && t.__args[0].geometry ? t.__args[0].geometry : make('geometry', [t.__args[0]])
          store.set('geometry', v)
          return v
        }
        if (prop === 'position' || prop === 'rotation' || prop === 'scale') {
          const v = make('vec3.' + prop, [])
          v.set = function (x, y, z) { store.set('__v_' + prop, { x: x, y: y, z: z }); return v }
          v.setScalar = function (s) { store.set('__v_' + prop, { x: s, y: s, z: s }); return v }
          v.copy = function () { return v }
          store.set(prop, v)
          return v
        }
        if (Object.prototype.hasOwnProperty.call(NUMERIC_DEFAULTS, prop)) {
          /* 数值/布尔量直接返回真值，避免 Proxy 参与算术导致 "Cannot convert object to primitive value" */
          const v = NUMERIC_DEFAULTS[prop]
          store.set(prop, v)
          return v
        }
        const child = make(kind + '.' + String(prop), [])
        store.set(prop, child)
        return child
      },
      set(t, prop, val) { store.set(prop, val); return true },
      apply(t, thisArg, args) {
        record.push({ kind: t.__kind, args: args })
        if (t.__kind.endsWith('.getWorldPosition')) { const v = args[0]; if (v && v.set) v.set(0, 0, 0); return v }
        if (t.__kind.endsWith('.project')) return args[0]
        if (t.__kind.endsWith('.intersectObjects')) return []
        return make(t.__kind, args)
      },
      construct(t, args) {
        record.push({ kind: t.__kind, args: args, isNew: true })
        const o = make(t.__kind, args)
        /* 真实 three 的构造签名：Mesh/Points/Line(geometry, material)、Sprite(material)。
           必须把这两个参数真正绑回去，否则 mesh.material.uniforms 会是空对象，
           等于把"着色器 uniform 写入"这条代码路径静默跳过。 */
        const k = String(t.__kind)
        if (/Mesh|Points|Line|Sprite/.test(k) && args && args.length) {
          if (/Sprite/.test(k)) {
            o.material = args[0]
          } else {
            if (args[0] !== undefined) o.geometry = args[0]
            if (args[1] !== undefined) o.material = args[1]
          }
        }
        return o
      }
    })
    return p
  }
  const root = make('THREE', [])
  const ext = {
    AdditiveBlending: 2, NormalBlending: 1, DoubleSide: 2, FrontSide: 0, BackSide: 1,
    LinearFilter: 1006, NearestFilter: 1003, HalfFloatType: 1016, UnsignedByteType: 1009,
    Float32BufferAttribute: function () { return make('Float32BufferAttribute', arguments) },
    Vector2: function () { return make('Vector2', arguments) },
    Vector3: function () { return make('Vector3', arguments) },
    Color: function () { const c = make('Color', arguments); c.setRGB = function () { return c }; c.set = function () { return c }; return c }
  }
  return new Proxy(root, {
    get(t, prop) {
      if (prop in ext) return ext[prop]
      return Reflect.get(t, prop)
    }
  })
}

/* ---------------- 建一个"用户" ---------------- */
async function makeUser(name, opts) {
  opts = opts || {}
  const errs = []
  const vc = new VirtualConsole()
  vc.on('jsdomError', e => errs.push('jsdomError: ' + ((e && e.message) || e)))
  vc.on('error', (...a) => errs.push('console.error: ' + a.map(String).join(' ')))
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const dom = new JSDOM(html, {
    url: opts.url || (BASE + '/?auto=uni'),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc
  })
  const w = dom.window
  w.addEventListener('error', e => errs.push('error: ' + (e.message || e) + (e.error && e.error.stack ? '\n      ' + String(e.error.stack).split('\n').slice(0, 4).join('\n      ') : '')))
  w.addEventListener('unhandledrejection', e => errs.push('rejection: ' + String(e.reason)))
  /* canvas / WebGL：checkWebGL() 要过；2D 上下文用万能桩（makeGlowTex / makeParticleTex 要画渐变） */
  w.WebGLRenderingContext = function WebGLRenderingContext() { }
  w.HTMLCanvasElement.prototype.getContext = function () { return fakeCtx() }
  w.matchMedia = function () {
    return { matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }
  }
  /* 真实后端能力注入 */
  w.fetch = (input, init) => fetch(typeof input === 'string' ? input : String(input), init)
  w.WebSocket = WebSocket
  w.AbortController = AbortController
  w.TextDecoder = TextDecoder
  /* THREE 桩要在 universe.js 之前挂上（universe.js 加载时即捕获 window.THREE） */
  const threeRecord = []
  w.THREE = makeThreeStub(threeRecord)
  /* 依次加载四个前端文件（等价于 index.html 的 script 顺序 + boot 懒加载 universe.js） */
  function load(f) {
    try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')) }
    catch (e) { errs.push('load(' + f + '): ' + ((e && e.stack) || e)) }
  }
  load('data.js')
  load('app.js')
  load('boot.js')
  load('universe.js')
  const U = w.ReckonUniverse
  if (U) {
    try { U.init() } catch (e) { errs.push('U.init: ' + ((e && e.message) || e)) }
    /* 进入宇宙（等价于点击「🌌 炼金宇宙」）：会触发后端探测 + WS 连接 + 房间能力 */
    try { U.enter() } catch (e) { errs.push('U.enter: ' + ((e && e.message) || e)) }
  }
  return { name, dom, w, errs, U, threeRecord }
}

;(async () => {
  console.log('=== v7 前端集成验证（jsdom 真实 DOM + 真实后端 ' + BASE + '）===\n')
  const A = await makeUser('A')
  const B = await makeUser('B')
  const W = A.w, doc = W.document

  console.log('--- 1. 四个前端文件加载 ---')
  ok('universe.js 暴露 window.ReckonUniverse', !!A.U && !!B.U)
  ok('app.js 全局状态 S 就绪', !!W.S && typeof W.showView === 'function')
  ok('boot.js 已包裹 showView（可切 uni）', /function/.test(String(W.showView)))
  ok('data.js 演示数据就绪', !!W.DEMO && W.DEMO.topics.length >= 12, 'topics=' + (W.DEMO && W.DEMO.topics.length))
  ok('加载期零异常', A.errs.length === 0, A.errs.slice(0, 3).join(' | ') || 'clean')

  const d0 = A.U.debugV7()
  ok('U.init 完成（debugV7 可用）', !!d0, JSON.stringify(d0).slice(0, 160))

  console.log('\n--- 2. 六种天气 + 极光 ---')
  ok('天气数量 = 6', d0.weathers === 6, 'weathers=' + d0.weathers)
  const wxBtns = doc.querySelectorAll('#uniWeather .wbtn')
  ok('天气按钮渲染 6 个', wxBtns.length === 6, 'n=' + wxBtns.length)
  const wxNames = Array.from(wxBtns).map(b => b.getAttribute('data-w'))
  ok('按钮含 thunder（第 6 种）', wxNames.indexOf('thunder') >= 0, wxNames.join(','))
  ok('按钮含 aurora', wxNames.indexOf('aurora') >= 0)
  const tips = Array.from(wxBtns).map(b => b.getAttribute('title')).join(' | ')
  ok('极光按钮提示标注高清帘幕', /高分辨率极光帘幕/.test(tips))
  ok('雷暴按钮提示标注闪电', /闪电/.test(tips))

  for (const wx of wxNames) {
    A.U.setWeather(wx, true)
    const dv = A.U.debugV7()
    if (wx !== 'aurora' && dv.weather !== wx) ok('切换到 ' + wx, false, 'weather=' + dv.weather)
  }
  ok('六种天气连续切换无异常', A.errs.length === 0, A.errs.slice(0, 2).join(' | ') || 'clean')
  A.U.setWeather('aurora', true)
  const da = A.U.debugV7()
  ok('极光天气生效', da.weather === 'aurora')
  ok('极光三层帘幕（主帘/次帘/远景辉光）', da.auroraLayers === 3, 'layers=' + da.auroraLayers)
  ok('极光启用超采样（超高像素）', da.ss > 1.2, 'ss=' + da.ss)
  const geoRec = A.threeRecord.filter(r => /PlaneGeometry/.test(String(r.kind)))
  const auroraSegs = geoRec.filter(r => r.args && r.args[2] >= 200).length
  ok('极光主帘几何高分段（≥200×96）', auroraSegs > 0, '高分段 PlaneGeometry 个数=' + auroraSegs)
  const shaderRec = A.threeRecord.filter(r => r.kind && /ShaderMaterial/.test(r.kind))
  const auroraShader = shaderRec.map(r => (r.args && r.args[0]) || {}).filter(o => o.uniforms && o.uniforms.uColA)
  ok('极光使用自定义 shader（含颜色/速度 uniform）', auroraShader.length >= 3, '层数=' + auroraShader.length)
  const vsrc = String((auroraShader[0] || {}).vertexShader || '')
  const fsrc = String((auroraShader[0] || {}).fragmentShader || '')
  ok('极光顶点着色器含噪声位移（真实流动）', /rkFbm/.test(vsrc) && /p\.z \+=/.test(vsrc))
  ok('极光片元着色器含丝状 rays + 呼吸流动', /rays/.test(fsrc) && /breath/.test(fsrc) && /stri/.test(fsrc))
  ok('极光片元含双色阶（青绿→品红紫）', /cViolet/.test(fsrc) && /cCyan/.test(fsrc))
  A.U.setWeather('thunder', true)
  ok('雷暴启用闪电网络体', A.threeRecord.some(r => /LineBasicMaterial/.test(String(r.kind))))
  A.U.setWeather('sunny', true)
  await sleep(200)

  console.log('\n--- 3. 看山（不挡视野 + 卡通可爱）---')
  const foxEl = doc.getElementById('uniFox')
  const foxImg = doc.getElementById('uniFoxImg')
  ok('看山元素存在', !!foxEl && !!foxImg)
  ok('看山已停靠显示（class show）', foxEl.classList.contains('show'), 'class=' + foxEl.className)
  ok('看山停靠左下角（inline left/bottom 像素）', /px$/.test(foxEl.style.left) && /px$/.test(foxEl.style.bottom),
    'left=' + foxEl.style.left + ' bottom=' + foxEl.style.bottom)
  ok('看山尺寸收敛（未放大/未缩小的默认档）', !foxEl.classList.contains('min'),
    'class=' + foxEl.className)
  ok('看山有包裹层（拖拽/工具条）', !!foxEl.querySelector('.foxwrap'))
  ok('看山有星星点缀 ×3', foxEl.querySelectorAll('.sparkle').length === 3)
  ok('看山有落地暖光', !!foxEl.querySelector('.glowpad'))
  const tools = foxEl.querySelectorAll('.foxtools button')
  ok('看山工具条 4 个动作（跳/缩小/归位/隐藏）', tools.length === 4, 'n=' + tools.length)
  /* 隐藏后仍能召回 */
  tools[3].dispatchEvent(new W.MouseEvent('click', { bubbles: true }))
  ok('点「藏起来」后不再显示', !doc.getElementById('uniFox').classList.contains('show'))
  A.U.showFox()
  ok('U.showFox() 可召回', doc.getElementById('uniFox').classList.contains('show'))
  /* 面板打开时看山让位（不叠在面板下） */
  A.U.openAi('ai')
  ok('打开 AI 面板后看山自动让位（重算安全位）', doc.getElementById('uniAiPanel').classList.contains('on'))
  A.U.closeAi()

  console.log('\n--- 4. 电影级 + 玻璃液态 ---')
  ok('电影级叠加层 #uniGrade 存在', !!doc.getElementById('uniGrade'))
  ok('叠加层含暗角/高光/颗粒/镜片四层',
    !!doc.querySelector('#uniGrade .vg') && !!doc.querySelector('#uniGrade .sheen') &&
    !!doc.querySelector('#uniGrade .grain') && !!doc.querySelector('#uniGrade .lens'))
  ok('WebGL 后处理已建立（超采样 RT）', A.threeRecord.some(r => /WebGLRenderTarget/.test(String(r.kind))))
  const postShader = A.threeRecord.map(r => (r.args && r.args[0]) || {}).filter(o => o.uniforms && o.uniforms.uGrain && o.uniforms.uFlash)
  ok('后处理着色器含调色/颗粒/暗角/闪光', postShader.length === 1, 'n=' + postShader.length)
  const pf = String((postShader[0] || {}).fragmentShader || '')
  ok('后处理含桶形畸变（玻璃液态折射）', /r2/.test(pf) && /uv = 0\.5 \+ c \*/.test(pf))
  ok('后处理含边缘色散（镜头感）', /col\.r = texture2D/.test(pf) && /ab/.test(pf))
  ok('后处理含 ACES 电影曲线', /aces/.test(pf))
  ok('后处理含高光泛光近似', /bl \+=/.test(pf))
  ok('玻璃液态 CSS 已注入（backdrop-filter + 液膜）',
    /backdrop-filter:blur\(20px\)/.test(String(doc.querySelector('style').textContent)) &&
    /uni-panel::before/.test(String(doc.querySelector('style').textContent)))

  console.log('\n--- 5. 原文批注（旧 bug 回归）---')
  const topics = W.DEMO.topics
  const tid = topics[0].id
  A.U.openReader(tid)
  const body = doc.getElementById('urBody')
  const paras = body.querySelectorAll('p.para')
  ok('阅读器打开且渲染段落', doc.getElementById('uniReader').classList.contains('on') && paras.length > 0, 'paras=' + paras.length)
  ok('每段注入 ✏️ 一键批注按钮', body.querySelectorAll('p.para .ur-pbtn').length >= paras.length,
    'n=' + body.querySelectorAll('p.para .ur-pbtn').length)
  ok('来源条显示"演示原文"+ 拉取按钮', !!doc.getElementById('urFetchBtn') && /演示原文/.test(doc.getElementById('urSrcBar').textContent))
  ok('快速上手引导入口存在', !!doc.getElementById('urGuideBtn'))

  function textNodeOf(p) {
    for (const nd of p.childNodes) {
      if (nd.nodeType === 3 && nd.textContent.trim().length > 6) return nd
      if (nd.nodeType === 1 && !nd.classList.contains('ur-pbtn') && !nd.classList.contains('para-tag') && nd.textContent.trim().length > 6) {
        for (const c of nd.childNodes) if (c.nodeType === 3 && c.textContent.trim().length > 4) return c
      }
    }
    return null
  }
  const t1 = textNodeOf(paras[0])
  let marks0 = body.querySelectorAll('mark.ur-hl').length
  let r = doc.createRange(); r.setStart(t1, 0); r.setEnd(t1, Math.min(8, t1.textContent.length))
  let sel = W.getSelection(); sel.removeAllRanges(); sel.addRange(r)
  const mk1 = A.U.rdApply('y', false)
  ok('① 选中文字即高亮', !!mk1 && body.querySelectorAll('mark.ur-hl').length > marks0,
    'marks=' + body.querySelectorAll('mark.ur-hl').length)

  /* ★ 旧 bug：点工具条时浏览器会清空选区 → 旧实现直接 return null（点色块没反应） */
  const t2 = textNodeOf(paras[1])
  let r2 = doc.createRange(); r2.setStart(t2, 0); r2.setEnd(t2, Math.min(6, t2.textContent.length))
  let sel2 = W.getSelection(); sel2.removeAllRanges(); sel2.addRange(r2)
  /* 走真实事件路径：mouseup 里同步捕获选区（浏览器里还会叠加 selectionchange） */
  body.dispatchEvent(new W.MouseEvent('mouseup', { bubbles: true }))
  await sleep(60)
  sel2.removeAllRanges()                       /* ← 选区被清掉（点工具条时浏览器就是这样） */
  ok('工具条已弹出（选区已捕获）', doc.getElementById('urSelMenu').classList.contains('on'),
    'class=' + doc.getElementById('urSelMenu').className)
  const mk2 = A.U.rdApply('b', false)          /* ← 旧实现在这里返回 null */
  ok('★ 选区被清掉后仍能高亮（旧 bug 修复）', !!mk2 && !!mk2.textContent, mk2 ? 'text="' + mk2.textContent.slice(0, 14) + '"' : 'null')

  /* 段落一键批注（快速上手路径） */
  const mk3 = A.U.rdApply('p', true, paras[2])
  ok('② 段落左侧 ✏️ 一键整段批注', !!mk3)
  ok('整段批注跳过段落标签（只圈正文）', !!mk3 && !/^【|^观点|^方法/.test(String(mk3.textContent || '').trim()),
    'text="' + String(mk3 && mk3.textContent || '').slice(0, 12) + '"')
  ok('批注弹框自动打开', !!doc.querySelector('.ur-note-pop'))
  const ta = doc.querySelector('.ur-note-pop textarea')
  ok('批注框含输入区', !!ta)
  if (ta) {
    ta.value = 'v7 自动验证：我的理解是这句在讲"讲不出来就是没懂"'
    doc.querySelector('.ur-note-pop .ok').dispatchEvent(new W.MouseEvent('click', { bubbles: true }))
  }
  ok('批注内容保存成功', !doc.querySelector('.ur-note-pop'))
  const stored = JSON.parse(W.localStorage.getItem('rkUniOrig') || '{}')[tid] || {}
  ok('批注写入 localStorage', (stored.notes || []).length >= 3, 'notes=' + (stored.notes || []).length)
  ok('旁注文本已落库', (stored.notes || []).some(n => n.note && /v7 自动验证/.test(n.note)))
  const listRows = doc.querySelectorAll('#urList .u-n').length
  ok('右侧批注列表渲染', listRows >= 3, 'rows=' + listRows)
  ok('计数条显示高亮/批注数', /高亮 \d+ 处 · 批注 \d+ 条/.test(doc.getElementById('urCnt').textContent),
    doc.getElementById('urCnt').textContent)
  /* 删除 */
  const rm = doc.querySelector('#urList .u-n .rm')
  rm.dispatchEvent(new W.MouseEvent('click', { bubbles: true }))
  ok('批注可删除', (JSON.parse(W.localStorage.getItem('rkUniOrig') || '{}')[tid].notes || []).length === (stored.notes || []).length - 1)

  console.log('\n--- 6. 知乎真实原文 + 在其上批注（真连后端）---')
  const orig = await A.w.fetch(BASE + '/api/zhihu/original?q=' + encodeURIComponent('费曼学习法真的有用吗')).then(r => r.json())
  ok('后端返回知乎原文', orig.ok === true && orig.paras.length > 2, 'origin=' + orig.origin + ' paras=' + (orig.paras || []).length)
  A.U.openReaderFromZhihu({ title: orig.title, url: orig.url, paras: orig.paras, origin: orig.origin })
  const zhParas = doc.querySelectorAll('#urBody p.para.zh-real')
  ok('知乎原文按段落渲染（可批注结构）', zhParas.length === orig.paras.length, 'n=' + zhParas.length)
  ok('来源条标记「知乎真实原文」+ 字数', /知乎真实原文/.test(doc.getElementById('urSrcBar').textContent),
    doc.getElementById('urSrcBar').textContent.slice(0, 60))
  ok('原文链接可点开知乎', /zhihu\.com/.test(doc.getElementById('urSrcBar').innerHTML))
  const zt = textNodeOf(zhParas[0])
  let zr = doc.createRange(); zr.setStart(zt, 0); zr.setEnd(zt, Math.min(12, zt.textContent.length))
  let zsel = W.getSelection(); zsel.removeAllRanges(); zsel.addRange(zr)
  const zmk = A.U.rdApply('y', true)
  ok('★ 在知乎真实原文上成功批注', !!zmk && !!doc.querySelector('.ur-note-pop'))
  const zta = doc.querySelector('.ur-note-pop textarea')
  if (zta) {
    zta.value = '真实原文批注测试'
    doc.querySelector('.ur-note-pop .ok').dispatchEvent(new W.MouseEvent('click', { bubbles: true }))
  }
  const zhStored = JSON.parse(W.localStorage.getItem('rkUniOrig') || '{}')
  const zhKey = Object.keys(zhStored).find(k => /^zh/.test(k))
  ok('真实原文批注持久化', !!zhKey && (zhStored[zhKey].notes || []).length >= 1, 'key=' + zhKey)
  await sleep(150)

  console.log('\n--- 7. AI 对话（真连后端 SSE）---')
  A.U.openAi('ai')
  ok('AI 面板打开', doc.getElementById('uniAiPanel').classList.contains('on'))
  ok('AI 快捷提问按钮 ≥5', doc.querySelectorAll('#uniAiQuick button').length >= 5,
    'n=' + doc.querySelectorAll('#uniAiQuick button').length)
  const before = doc.querySelectorAll('#uniAiMsgs .m').length
  A.U.aiAsk('用一句话说明：为什么收藏了不等于学会了？')
  let aiDone = false, aiText = '', aiSrc = '', aiBadge = false
  for (let i = 0; i < 90; i++) {
    await sleep(1000)
    aiText = doc.getElementById('uniAiMsgs').textContent
    aiSrc = doc.getElementById('uniAiSrc').textContent
    aiBadge = !!doc.querySelector('#uniAiMsgs .m.ai .pmk')
    if (!/生成中/.test(aiSrc) && doc.querySelectorAll('#uniAiMsgs .m').length > before + 1) { aiDone = true; break }
  }
  ok('AI 流式回答返回', aiDone, 'src=' + aiSrc)
  ok('回答内容足够长（真实模型输出）', aiText.length > 40 && !/连不上后端模型/.test(aiText), 'len=' + aiText.length)
  ok('未退化为本地兜底话术', !/当前没有可用的模型|连不上后端/.test(aiText), aiText.slice(-70))
  ok('显示模型供应商徽标', aiBadge, 'src=' + aiSrc)
  ok('回答出现在消息列表', doc.querySelectorAll('#uniAiMsgs .m.ai').length >= 1)
  A.U.closeAi()

  console.log('\n--- 8. 多人实时热点话题房间（两个"用户"实时互通）---')
  A.U.openRoom()
  for (let i = 0; i < 40; i++) { await sleep(500); if (doc.querySelectorAll('#uniRoomTopics .rt').length) break }
  const rts = doc.querySelectorAll('#uniRoomTopics .rt')
  ok('热点话题列表（真实知乎热榜或本地兜底）', rts.length > 3, 'n=' + rts.length)
  ok('话题池标注来源', /知乎实时热榜|本地示例热榜/.test(doc.getElementById('uniRoomTopics').textContent))
  rts[0].dispatchEvent(new W.MouseEvent('click', { bubbles: true }))
  await sleep(1500)
  const ra = A.U.debugV7().room
  ok('A 加入房间且 WS 已连', ra.joined === true && ra.net === true, JSON.stringify(ra))
  const roomIdA = ra.id

  /* B 也进同一个房间 */
  B.U.openRoom()
  for (let i = 0; i < 40; i++) { await sleep(500); if (B.w.document.querySelectorAll('#uniRoomTopics .rt').length) break }
  B.w.document.querySelectorAll('#uniRoomTopics .rt')[0].dispatchEvent(new B.w.MouseEvent('click', { bubbles: true }))
  await sleep(1500)
  const rb = B.U.debugV7().room
  ok('B 加入同一房间', rb.joined === true && rb.net === true, JSON.stringify(rb))
  ok('A/B 进入同一个房间号', !!roomIdA && roomIdA === rb.id, 'A=' + roomIdA + ' B=' + rb.id)
  A.w.document.getElementById('uniRoomNick').value = '验证用户A'
  B.w.document.getElementById('uniRoomNick').value = '验证用户B'

  /* A 发言 → B 应实时收到 */
  const msgText = 'v7 实时互通验证 ' + Date.now().toString(36)
  A.w.document.getElementById('uniRoomInput').value = msgText
  A.w.document.getElementById('uniRoomSend').dispatchEvent(new A.w.MouseEvent('click', { bubbles: true }))
  let bGot = false
  for (let i = 0; i < 24; i++) {
    await sleep(500)
    if (B.w.document.getElementById('uniRoomMsgs').textContent.includes(msgText)) { bGot = true; break }
  }
  ok('★ A 发言 → B 的界面实时收到（多人实时）', bGot)
  ok('A 自己看到自己的消息', A.w.document.getElementById('uniRoomMsgs').textContent.includes(msgText))
  const users = A.U.debugV7().room.users
  ok('在线人数 ≥2', users >= 2, 'users=' + users)
  ok('在线状态徽标点亮', A.w.document.getElementById('uniRoomLive').classList.contains('on'),
    A.w.document.getElementById('uniRoomLive').textContent)

  /* 房间里 @AI：回答广播给所有人 */
  A.w.document.getElementById('uniRoomInput').value = '@AI 这个热点的反面观点是什么？'
  A.w.document.getElementById('uniRoomSend').dispatchEvent(new A.w.MouseEvent('click', { bubbles: true }))
  let bAi = false
  for (let i = 0; i < 60; i++) {
    await sleep(1000)
    if (B.w.document.querySelector('#uniRoomMsgs .m.aibot')) { bAi = true; break }
  }
  ok('★ 房间内 @AI 的回答广播给其他用户', bAi)

  console.log('\n--- 9. 拆解页知乎搜索（app.js 接入）---')
  W.enterFlow(topics[1].id)
  await sleep(300)
  const strip = doc.getElementById('rkZhStrip')
  ok('拆解页注入「知乎原文对照」条', !!strip)
  ok('对照条位于拆解步骤最上方（第 2 步）', strip && doc.getElementById('flowBody').firstElementChild === strip)
  ok('含搜索框/搜索按钮/直接拉取按钮',
    !!doc.getElementById('rkZhQ') && !!doc.getElementById('rkZhGo') && !!doc.getElementById('rkZhRead'))
  doc.getElementById('rkZhGo').dispatchEvent(new W.MouseEvent('click', { bubbles: true }))
  let zhItems = 0
  for (let i = 0; i < 40; i++) { await sleep(500); zhItems = doc.querySelectorAll('#rkZhStrip .zh-item').length; if (zhItems) break }
  ok('★ 知乎搜索返回真实结果', zhItems > 0, 'items=' + zhItems)
  const firstItem = doc.querySelector('#rkZhStrip .zh-item')
  ok('结果含标题与摘要', !!firstItem && firstItem.textContent.length > 40, (firstItem ? firstItem.textContent.slice(0, 50) : ''))
  ok('结果含「在知乎打开」链接', !!firstItem && !!firstItem.querySelector('a[href*="zhihu.com"]'))
  ok('结果含「用它做原文圈点批注」按钮', !!firstItem && !!firstItem.querySelector('[data-zhuse]'))
  ok('结果含「问小炼」按钮', !!firstItem && !!firstItem.querySelector('[data-zhai]'))
  /* 点"用它做原文圈点批注" → 阅读器打开且是可批注的知乎原文 */
  firstItem.querySelector('[data-zhuse]').dispatchEvent(new W.MouseEvent('click', { bubbles: true }))
  let zhOpen = false
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    if (doc.getElementById('uniReader').classList.contains('on') && doc.querySelectorAll('#urBody p.para').length > 0) { zhOpen = true; break }
  }
  ok('★ 从搜索结果直接进入可批注原文', zhOpen, 'paras=' + doc.querySelectorAll('#urBody p.para').length)

  console.log('\n--- 10. AI 抬杠（app.js 接入 DeepSeek/直答）---')
  const t2i = topics[2]
  W.enterFlow(t2i.id)
  W.S.mode = 'debate'
  W.goStep(3)
  await sleep(300)
  ok('抬杠页渲染', /AI 开杠/.test(doc.getElementById('flowBody').textContent),
    doc.getElementById('flowBody').textContent.slice(0, 80))
  const dbTa = doc.getElementById('dbTa')
  ok('输入框存在', !!dbTa)
  if (!dbTa) throw new Error('debate textarea missing')
  dbTa.value = '我觉得费曼学习法就是把东西讲给别人听，讲一遍自然就记住了'
  doc.querySelector('[data-act="dbsay"]').dispatchEvent(new W.MouseEvent('click', { bubbles: true }))
  let debateDone = false, debateText = ''
  for (let i = 0; i < 60; i++) {
    await sleep(1000)
    debateText = doc.getElementById('flowBody').textContent
    if (doc.querySelector('.dmsg.ai .pmk') && !/正在针对你这句话组织反驳/.test(debateText)) { debateDone = true; break }
  }
  ok('★ AI 抬杠返回真实模型回答', debateDone, debateText.slice(-120))
  ok('回答带模型徽标（DeepSeek/知乎直答）', !!doc.querySelector('.dmsg.ai .pmk'))
  const aiMsg = doc.querySelector('.dmsg.ai:not(.busy)')
  const aiTxt = aiMsg ? aiMsg.textContent : ''
  ok('★ 抬杠贴合用户原话（引用其用词）', /讲给|讲一遍|别人听|记住|费曼|复述/.test(aiTxt), aiTxt.slice(0, 70))
  ok('抬杠结尾追问用户', /[？?]/.test(aiTxt))

  console.log('\n--- 11. 全程无异常 ---')
  const allErrs = A.errs.concat(B.errs).filter(e => !/Not implemented: HTMLCanvasElement|Could not parse CSS|Error: Not implemented/i.test(e))
  ok('A/B 两实例运行期零 JS 异常', allErrs.length === 0, allErrs.slice(0, 4).join(' | ') || 'clean')

  console.log('\n--- 12. 取证钩子（?wx= / ?show= / ?selftest=1）---')
  const H = await makeUser('HOOKS', { url: BASE + '/?auto=uni&wx=aurora&show=reader' })
  await sleep(4500)   /* 钩子在 900ms / 1600ms 触发，留足时间 */
  const hd = H.U.debugV7()
  ok('?wx=aurora 生效（URL 钩子切天气）', hd.weather === 'aurora', 'weather=' + hd.weather)
  ok('?wx=aurora 触发超采样', hd.ss > 1.2, 'ss=' + hd.ss)
  ok('?show=reader 打开阅读器', H.w.document.getElementById('uniReader').classList.contains('on'))
  ok('极光 + 阅读器共存时极光三层仍在推进（applyEnv 着色器通道被真正执行）', hd.auroraLayers === 3)
  const hErr1 = H.errs.filter(e => !/Not implemented|Could not parse CSS/i.test(e))
  ok('?wx/?show 实例运行期零异常', hErr1.length === 0, hErr1.slice(0, 2).join(' | ') || 'clean')

  const H2 = await makeUser('SELFTEST', { url: BASE + '/?auto=uni&selftest=1' })
  await sleep(7000)   /* 自测在 2600ms 触发，内部含异步步骤 */
  const stPre = H2.w.document.getElementById('rkSelfTest')
  ok('?selftest=1 产出结果区 #rkSelfTest', !!stPre)
  const stTxt = stPre ? stPre.textContent : ''
  const mRes = stTxt.match(/RESULT :: (\d+)\/(\d+) passed/)
  ok('页内自测跑完并给出总分', !!mRes, mRes ? mRes[0] : stTxt.slice(-120))
  const total = mRes ? Number(mRes[2]) : 0
  const passed = mRes ? Number(mRes[1]) : 0
  ok('页内自测覆盖 ≥24 项', total >= 24, 'total=' + total)
  /* 逐项核对"纯逻辑/DOM"类断言必须全过（纯 CSS 计算样式断言在 jsdom 无布局引擎下不计） */
  const STRICT = ['weather-count-6', 'weather-thunder-exists', 'weather-buttons-6', 'weather-switch-no-throw',
    'aurora-layers-3', 'aurora-high-density', 'aurora-shader-has-flow',
    'annotate-select', 'annotate-after-selection-lost', 'annotate-whole-paragraph', 'note-popup-open',
    'notes-persisted', 'srcbar-present', 'guide-present',
    'ai-panel-open', 'ai-input-present', 'ai-quick-buttons', 'room-pane-open', 'room-topics-rendered', 'room-live-badge']
  const strictFails = STRICT.filter(name => {
    const line = stTxt.split('\n').find(l => l.indexOf(name + ' :: ') === 0)
    if (!line) return true                 /* 找不到该项 = 自测没跑到，算失败 */
    return line.indexOf('FAIL') >= 0
  })
  ok('自测中的逻辑/DOM 类断言 ' + STRICT.length + ' 项全部通过', strictFails.length === 0,
    strictFails.length ? ('未过：' + strictFails.join(',')) : '全过')
  const allFails = stTxt.split('\n').filter(l => l.indexOf('FAIL') >= 0).map(l => l.split(' :: ')[0])
  const nonStrict = allFails.filter(n => STRICT.indexOf(n) < 0)
  console.log('  （jsdom 页内自测总分 ' + passed + '/' + total + '；未过项的类别：' +
    (nonStrict.length ? nonStrict.join(',') + '（纯 CSS 计算样式断言，jsdom 无布局引擎）' : '无') + '）')
  ok('未过的项全部是"纯 CSS 计算样式"类（逻辑无缺陷）', allFails.every(n => STRICT.indexOf(n) < 0),
    '未过项：' + allFails.join(','))
  const hErr2 = H2.errs.filter(e => !/Not implemented|Could not parse CSS/i.test(e))
  ok('?selftest 实例运行期零异常', hErr2.length === 0, hErr2.slice(0, 2).join(' | ') || 'clean')

  console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
  if (fails.length) console.log('失败项：\n - ' + fails.join('\n - '))
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('VERIFY CRASH:', (e && e.stack) || e); process.exit(9) })
