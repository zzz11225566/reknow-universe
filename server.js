/* ============================================================
   炼知 ReKnow v7 · 后端服务（纯 Node，零依赖，Node ≥ 18）
   ------------------------------------------------------------
   一、静态托管整个「炼金宇宙」前端（默认 http://localhost:8787）
   二、知乎开放平台（developer.zhihu.com）真实数据接入
       · GET  /api/zhihu/search?q=&count=      知乎站内搜索（原文/摘要/作者/赞同）
       · GET  /api/zhihu/global?q=&count=      全网搜索
       · GET  /api/zhihu/hot?limit=            实时热榜（多人热点话题的数据源）
       · GET  /api/zhihu/answers?url=          某问题下的回答（摘要 + 原文链接）
       · GET  /api/zhihu/original?q=|url=      取"可用于批注的原文正文"（多级降级）
       · GET  /api/zhihu/collections?limit=    我的知乎收藏（真实收藏夹）
       · GET  /api/zhihu/favlists              我的收藏夹列表
       · GET  /api/zhihu/quota                 额度余量（含每日限免）
   三、AI 能力（提供商自动选择，密钥只留在服务端）
       · POST /api/ai/chat            {messages,...} → {provider, reply}
       · POST /api/ai/chat/stream     SSE 流式对话（text/event-stream）
       · POST /api/ai/debate          {topic,userText,intensity,history} → 贴合式抬杠
       · POST /api/ai/oppose          与 debate 同义（兼容旧调用）
   四、多人实时互动（WebSocket /ws）
       · 服务端下发：hello / heartbeat / hotlist / env / room / room:msg / room:left
       · 客户端上行：{type:'join'|'say'|'leave'|'typing', room, user, text}
       · 热点话题房间基于知乎真实热榜；房间内存最近 200 条消息
   五、其它
       · GET  /api/health  健康检查（报告各密钥是否就绪，不泄露密钥）
       · GET  /api/hotlist 兼容旧前端：热榜（真实知乎热榜优先，失败回落本地示例）
       · GET  /api/search?q= 兼容旧前端：本地演示搜索
       · GET  /api/env     环境快照（城市/天气/温度，按真实时间确定性变化）

   启动：node server.js   （前端自动探测，连上即点亮「实时」徽标）
   密钥：工作区根目录 env 文件（或 .env / 环境变量），仅服务端读取。
   ============================================================ */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const ROOT = __dirname

/* ============================================================
   0. 环境变量装载（零依赖，支持 env / .env，不覆盖已有 process.env）
   ============================================================ */
function loadEnvFile(file) {
  try {
    if (!fs.existsSync(file)) return false
    const txt = fs.readFileSync(file, 'utf8')
    txt.split(/\r?\n/).forEach(function (line) {
      const s = line.trim()
      if (!s || s[0] === '#') return
      const i = s.indexOf('=')
      if (i < 1) return
      const k = s.slice(0, i).trim().replace(/^export\s+/, '')
      let v = s.slice(i + 1).trim()
      if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) v = v.slice(1, -1)
      if (!k) return
      if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v
    })
    return true
  } catch (e) { return false }
}
const ENV_FILES = ['env', '.env', '.env.local']
const envLoaded = ENV_FILES.filter(function (f) { return loadEnvFile(path.join(ROOT, f)) })

const CFG = {
  deepseekKey: (process.env.DEEPSEEK_API_KEY || '').trim(),
  deepseekBase: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  deepseekModel: (process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim(),
  /* 抬杠要"更会抓漏洞"，允许单独指定更强的模型（不填就跟 chat 用同一个） */
  deepseekDebateModel: (process.env.DEEPSEEK_DEBATE_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim(),
  zhihuToken: (process.env.ZHIHU_ACCESS_TOKEN || process.env.ZHIHU_ACCESS_SECRET || '').trim(),
  zhihuBase: (process.env.ZHIHU_API_BASE || 'https://developer.zhihu.com').replace(/\/+$/, ''),
  zhidaFast: (process.env.ZHIHU_ZHIDA_MODEL || 'zhida-thinking-1p5').trim(),
  zhihuCookie: (process.env.ZHIHU_COOKIE || '').trim()
}
/* DeepSeek 官方 key 形态 sk- + 32 hex；形态不符时视为占位符，不必浪费一次请求 */
function deepseekKeyLooksValid(k) { return /^sk-[0-9a-fA-F]{32}$/.test(String(k || '').trim()) }
/* 推理型模型（deepseek-v4-pro / reasoner / r1 之类）会先花大量 token 写 reasoning_content，
   再输出很短的正文。实测 v4-pro 单轮思考就吃掉 ~400 token：
   若沿用 chat 的 max_tokens，正文会被截断成空串（表现为"模型返回为空"）。所以自动抬高预算。 */
function isReasoningModel(m) { return /(^|[-_.])(pro|reasoner|reasoning|r1|think)/i.test(String(m || '')) }
function budgetFor(model, want) {
  const n = Number(want) || 700
  return isReasoningModel(model) ? Math.max(n, 2600) : n
}
const DS_OK = deepseekKeyLooksValid(CFG.deepseekKey)
const ZH_OK = !!CFG.zhihuToken

/* ============================================================
   1. 小工具：TTL 缓存 / JSON 响应 / 请求体解析
   ============================================================ */
const cache = new Map() // key -> {exp, val}
function cacheGet(k) {
  const e = cache.get(k)
  if (!e) return null
  if (e.exp < Date.now()) { cache.delete(k); return null }
  return e.val
}
function cacheSet(k, val, ttlMs) {
  cache.set(k, { exp: Date.now() + ttlMs, val: val })
  if (cache.size > 400) { // 简单防膨胀
    const now = Date.now()
    for (const [key, v] of cache) if (v.exp < now) cache.delete(key)
  }
  return val
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}
function sendJSON(res, code, obj) {
  if (res.writableEnded) return
  cors(res)
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' })
  res.end(body)
}
function readBody(req, limitBytes) {
  return new Promise(function (resolve) {
    const cap = limitBytes || 512 * 1024
    let size = 0
    const chunks = []
    req.on('data', function (c) {
      size += c.length
      if (size > cap) { req.destroy(); resolve(null); return }
      chunks.push(c)
    })
    req.on('end', function () {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (e) { resolve({ __raw: raw }) }
    })
    req.on('error', function () { resolve(null) })
  })
}
async function fetchJSON(url, opts, timeoutMs) {
  const ac = new AbortController()
  const t = setTimeout(function () { ac.abort() }, timeoutMs || 20000)
  try {
    const r = await fetch(url, Object.assign({ signal: ac.signal }, opts || {}))
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch (e) { }
    return { status: r.status, ok: r.ok, json: json, text: text }
  } finally { clearTimeout(t) }
}

/* ============================================================
   2. 知乎开放平台客户端（developer.zhihu.com）
   ============================================================ */
function zhihuHeaders() {
  return {
    'Authorization': 'Bearer ' + CFG.zhihuToken,
    'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'reknow-universe/7.0 (+zhihu-open-platform)'
  }
}
async function zhihuGet(apiPath, params, timeoutMs) {
  if (!ZH_OK) return { ok: false, error: 'ZHIHU_ACCESS_TOKEN 未配置' }
  const qs = new URLSearchParams()
  Object.keys(params || {}).forEach(function (k) { if (params[k] !== undefined && params[k] !== null && params[k] !== '') qs.set(k, String(params[k])) })
  const url = CFG.zhihuBase + apiPath + (qs.toString() ? '?' + qs.toString() : '')
  try {
    const r = await fetchJSON(url, { headers: zhihuHeaders() }, timeoutMs || 20000)
    if (!r.json) return { ok: false, error: '知乎返回非 JSON（' + r.status + '）', raw: (r.text || '').slice(0, 300) }
    if (r.json.Code !== 0 && r.json.Code !== undefined) return { ok: false, error: r.json.Message || ('Code ' + r.json.Code), code: r.json.Code }
    return { ok: true, data: r.json.Data, raw: r.json }
  } catch (e) {
    return { ok: false, error: (e && e.name === 'AbortError') ? '知乎请求超时' : String((e && e.message) || e) }
  }
}
/* 知乎 URL 校验（复用官方 question_answers 的入参约定） */
function isZhihuQuestionUrl(u) { return /^https?:\/\/(www\.)?zhihu\.com\/question\/\d+/.test(String(u || '').trim()) }
function zhihuSearchUrl(q) { return 'https://www.zhihu.com/search?type=content&q=' + encodeURIComponent(String(q || '')) }

/* 站内搜索 → 归一化 */
function normSearchItems(items) {
  return (items || []).map(function (it, i) {
    const body = String(it.ContentText || it.Summary || '').replace(/<[^>]+>/g, '').replace(/\s+\n/g, '\n').trim()
    return {
      rank: i + 1,
      id: it.ContentID || it.ContentToken || ('zh' + i),
      title: it.Title || '(无标题)',
      url: it.Url || (it.ContentType === 'Answer' ? '' : ''),
      excerpt: body,
      type: it.ContentType || '',
      author: it.AuthorName || it.AuthorSignature || '',
      avatar: it.AuthorAvatar || '',
      votes: Number(it.VoteUpCount || 0),
      comments: Number(it.CommentCount || 0),
      editTime: Number(it.EditTime || 0),
      authority: it.AuthorityLevel || '',
      source: 'zhihu'
    }
  })
}
async function zhihuSearch(q, count) {
  const key = 'zs:' + q + ':' + count
  const hit = cacheGet(key); if (hit) return hit
  const r = await zhihuGet('/api/v1/content/zhihu_search', { Query: q, Count: Math.min(10, Math.max(1, count || 10)) })
  if (!r.ok) return r
  const items = normSearchItems(r.data && r.data.Items)
  return cacheSet(key, { ok: true, items: items, hasMore: !!(r.data && r.data.HasMore), empty: (r.data && r.data.EmptyReason) || '' }, 10 * 60 * 1000)
}
async function zhihuGlobal(q, count, filter) {
  const key = 'zg:' + q + ':' + count + ':' + (filter || '')
  const hit = cacheGet(key); if (hit) return hit
  const r = await zhihuGet('/api/v1/content/global_search', { Query: q, Count: Math.min(20, Math.max(1, count || 10)), Filter: filter || '', SearchDB: 'all' })
  if (!r.ok) return r
  const items = normSearchItems(r.data && r.data.Items)
  return cacheSet(key, { ok: true, items: items, hasMore: !!(r.data && r.data.HasMore) }, 10 * 60 * 1000)
}
async function zhihuHot(limit) {
  const key = 'zhot:' + limit
  const hit = cacheGet(key); if (hit) return hit
  const r = await zhihuGet('/api/v1/content/hot_list', { Limit: Math.min(30, Math.max(1, limit || 20)) })
  if (!r.ok) return r
  const items = (r.data && r.data.Items || []).map(function (it, i) {
    return {
      rank: i + 1, id: 'zh' + i, q: it.Title || '', url: it.Url || '',
      title: it.Title || '', summary: it.Summary || '', thumb: it.ThumbnailUrl || '',
      votes: 0, cat: 'hot', source: 'zhihu-hot', live: true
    }
  })
  return cacheSet(key, { ok: true, items: items, total: (r.data && r.data.Total) || items.length }, 30 * 60 * 1000)
}
async function zhihuAnswers(questionUrl, limit) {
  if (!isZhihuQuestionUrl(questionUrl)) return { ok: false, error: 'QuestionUrl 必须是知乎问题链接（https://www.zhihu.com/question/<数字>）' }
  const key = 'zans:' + questionUrl + ':' + limit
  const hit = cacheGet(key); if (hit) return hit
  const r = await zhihuGet('/api/v1/content/question_answers', { QuestionUrl: questionUrl, Limit: Math.min(10, Math.max(1, limit || 5)) }, 25000)
  if (!r.ok) return r
  const items = (r.data && (r.data.Items || r.data.items) || []).map(function (it, i) {
    return {
      rank: i + 1, type: it.ContentType || '', token: it.ContentToken || '',
      url: it.Url || '', excerpt: String(it.Summary || '').trim()
    }
  })
  return cacheSet(key, { ok: true, items: items }, 60 * 60 * 1000)
}
/* 「可用于批注的原文」：多级降级 —— 知乎搜索 → 问题回答 → 只有链接
   quota 说明：zhihu_search 每日 5000，question_answers 每日 100，故都对结果做长缓存 */
async function zhihuOriginal(q, questionUrl) {
  const key = 'zorig:' + q + ':' + questionUrl
  const hit = cacheGet(key); if (hit) return hit
  let title = '', url = questionUrl || '', paras = [], origin = ''
  if (questionUrl && isZhihuQuestionUrl(questionUrl)) {
    const a = await zhihuAnswers(questionUrl, 5)
    if (a.ok && a.items.length) {
      const withText = a.items.filter(function (x) { return (x.excerpt || '').length > 120 })
      const pick = withText[0] || a.items[0]
      title = q || ''
      url = pick.url || questionUrl
      paras = splitParas(pick.excerpt)
      origin = 'question_answers'
    }
  }
  if (!paras.length && q) {
    const s = await zhihuSearch(q, 6)
    if (s.ok && s.items.length) {
      /* 选摘要最长的一条（最接近"原文正文"） */
      const best = s.items.slice().sort(function (a, b) { return (b.excerpt || '').length - (a.excerpt || '').length })[0]
      title = best.title; url = best.url || zhihuSearchUrl(q)
      paras = splitParas(best.excerpt)
      origin = 'zhihu_search'
      if (best.title) {
        const a2 = await zhihuAnswers(url.match(/\/question\/\d+/) ? 'https://www.zhihu.com' + url.match(/\/question\/\d+/)[0] : '', 3)
        if (a2.ok && a2.items.length) {
          const w = a2.items.filter(function (x) { return (x.excerpt || '').length > (paras.join('').length) })
          if (w.length) { paras = splitParas(w[0].excerpt); url = w[0].url || url; origin = 'question_answers' }
        }
      }
    }
  }
  const out = {
    ok: !!paras.length, origin: origin, title: title, url: url || zhihuSearchUrl(q),
    paras: paras, chars: paras.join('').length,
    note: paras.length ? '' : '知乎开放平台未返回可用正文（可能额度用尽或该问题不开放回答），已改给搜索直达链接。'
  }
  return cacheSet(key, out, 30 * 60 * 1000)
}
/* 把一段长文本切成适合批注的段落 */
function splitParas(txt) {
  const s = String(txt || '').replace(/\r/g, '').replace(/<[^>]+>/g, '')
  const rough = s.split(/\n+/).map(function (x) { return x.trim() }).filter(Boolean)
  const out = []
  rough.forEach(function (p) {
    if (p.length <= 220) { out.push(p); return }
    /* 长段落再按句号切到 ~180 字 */
    const parts = p.split(/(?<=[。！？；])/)
    let buf = ''
    parts.forEach(function (x) {
      if ((buf + x).length > 180 && buf) { out.push(buf); buf = x }
      else buf += x
    })
    if (buf.trim()) out.push(buf.trim())
  })
  return out.slice(0, 60)
}
async function zhihuQuota() {
  const key = 'zq'
  const hit = cacheGet(key); if (hit) return hit
  const r = await zhihuGet('/api/v1/quota', {})
  if (!r.ok) return r
  return cacheSet(key, { ok: true, items: r.data || [] }, 5 * 60 * 1000)
}
async function zhihuCollections(limit) {
  const key = 'zcol:' + limit
  const hit = cacheGet(key); if (hit) return hit
  const r = await zhihuGet('/api/v1/user/collections', { Limit: Math.min(50, Math.max(1, limit || 20)) })
  if (!r.ok) return r
  const items = (r.data && r.data.Items || []).map(function (it, i) {
    return {
      rank: i + 1, type: it.ContentType || '', url: it.Url || '', title: it.Title || '',
      summary: it.Summary || '', votes: Number(it.LikeCount || 0), comments: Number(it.CommentCount || 0),
      favorites: Number(it.FavoriteCount || 0), createdAt: Number(it.CreatedAt || 0), favTime: Number(it.FavTime || 0),
      favlists: it.Favlists || [], author: (it.Author && it.Author.Name) || '', authorHeadline: (it.Author && it.Author.Headline) || ''
    }
  })
  return cacheSet(key, { ok: true, items: items }, 10 * 60 * 1000)
}
async function zhihuFavlists() {
  const key = 'zfl'
  const hit = cacheGet(key); if (hit) return hit
  const r = await zhihuGet('/api/v1/user/favlists', { Limit: 50 })
  if (!r.ok) return r
  return cacheSet(key, { ok: true, items: (r.data && r.data.Items) || [] }, 10 * 60 * 1000)
}

/* ============================================================
   3. LLM：DeepSeek 优先，知乎直答兜底（密钥只在服务端）
   ============================================================ */
const SYSTEM_UNIVERSE = [
  '你是「炼知 ReKnow」炼金宇宙里的 AI 学习伙伴，名字叫「小炼」。',
  '用户是知乎重度用户，正在把自己的收藏「炼」成自己的回答。',
  '回答要求：中文、口语化、短句为主、一次说清一件事；不要空泛鼓励；',
  '需要时给出可执行的下一步；可以引用用户当前正在看的那篇收藏。',
  '不要编造原文里没有的事实；不确定就说不确定。'
].join('\n')
const SYSTEM_DEBATE = [
  '你是「炼知 ReKnow」的 AI 反对派，任务是用抬杠帮用户把知识记牢。',
  '硬性要求：',
  '1) 必须紧扣用户上一句原话里的具体用词来反驳，先点出他原话里的一个词或一个判断，再反驳；',
  '2) 不许复述原文，不许说套话；不许每次都用同一句式；',
  '3) 指出他逻辑里的漏洞、边界条件、或者他回避的地方；',
  '4) 长度 2-3 句，60-120 字，语气按强度设定；',
  '5) 结尾留一个必须由他回答的问题（除了最后一轮）。'
].join('\n')

/* 分工（2026-09-13 按 owner 要求调整）：
   - AI 问答 / 房间讨论 → 知乎直答优先（zhida），DeepSeek 兜底
   - AI 抬杠          → DeepSeek 优先（deepseek），知乎直答兜底
   任一侧不可用时都会自动落到另一侧，最后还有本地兜底话术，功能不会中断。 */
function providerOrder(mode) {
  const preferZhida = (mode !== 'debate')
  const list = []
  const first = preferZhida ? 'zhida' : 'deepseek'
  const second = preferZhida ? 'deepseek' : 'zhida'
  if (first === 'deepseek' ? DS_OK : ZH_OK) list.push(first)
  if (second === 'deepseek' ? DS_OK : ZH_OK) list.push(second)
  if (!list.length) list.push('local')
  return list
}
function providerMeta() {
  /* 探针结果分两层：
     - 'ds:probe'：新鲜缓存（5 分钟），用于判断"现在能不能用"
     - 'ds:probeLast'：**永不过期的最近一次结果**，只用于"报告状态"
     否则 /api/health 在 5 分钟后会把 verified/models/balance 报成 null，
     看起来像"没验证过"，人肉排查时很容易误判。 */
  const fresh = cacheGet('ds:probe')
  const last = cacheGet('ds:probeLast')
  const probe = fresh || last
  return {
    order: providerOrder('chat'),          // 问答链（知乎直答优先）
    debateOrder: providerOrder('debate'),  // 抬杠链（DeepSeek 优先）
    chatProvider: providerOrder('chat')[0],
    debateProvider: providerOrder('debate')[0],
    deepseek: {
      configured: !!CFG.deepseekKey, keyLooksValid: DS_OK,
      model: CFG.deepseekModel, debateModel: CFG.deepseekDebateModel,
      verified: probe ? !!probe.ok : null,          // 真发过请求验证过吗
      models: probe && probe.models ? probe.models : null,
      balance: probe && probe.balance ? probe.balance : null,
      error: probe && !probe.ok ? probe.error : null,
      probedAt: probe ? new Date(probe.ts).toISOString() : null,
      stale: !!fresh ? false : (last ? true : null)  // true=数据来自最近一次探测（未重新探）
    },
    zhida: { configured: ZH_OK, model: CFG.zhidaFast },
    zhihu: { configured: ZH_OK, base: CFG.zhihuBase },
    envFiles: envLoaded
  }
}
/* ---------- DeepSeek 可用性探针（/models + /user/balance），5 分钟缓存 ---------- */
async function deepseekProbe(force) {
  if (!DS_OK) return { ok: false, error: 'DEEPSEEK_API_KEY 未配置或格式非法（应为 sk- + 32 位 hex）' }
  const hit = cacheGet('ds:probe')
  if (hit && !force) return hit
  const H = { 'Authorization': 'Bearer ' + CFG.deepseekKey, 'Accept': 'application/json' }
  const out = { ok: false, models: [], balance: null, error: null, ts: Date.now() }
  try {
    const m = await fetchJSON(CFG.deepseekBase + '/models', { headers: H }, 15000)
    if (m.status === 200 && m.json && Array.isArray(m.json.data)) {
      out.models = m.json.data.map(function (x) { return x.id }).filter(Boolean)
      out.ok = true
    } else {
      out.error = 'GET /models ' + m.status + '：' + ((m.json && m.json.error && m.json.error.message) || String(m.text).slice(0, 160))
    }
  } catch (e) { out.error = 'GET /models 连接失败：' + ((e && e.message) || e) }
  try {
    const b = await fetchJSON(CFG.deepseekBase + '/user/balance', { headers: H }, 15000)
    if (b.status === 200 && b.json) {
      const info = (b.json.balance_infos && b.json.balance_infos[0]) || {}
      out.balance = { available: !!b.json.is_available, total: info.total_balance != null ? String(info.total_balance) : null, currency: info.currency || 'CNY' }
      if (!out.ok && b.json.is_available) { out.ok = true; out.error = out.error ? (out.error + '（但余额接口正常，鉴权是有效的）') : null }
    }
  } catch (e) { /* 余额接口失败不影响判断 */ }
  cacheSet('ds:probeLast', out, 365 * 24 * 60 * 60 * 1000) // 最近一次结果：供状态展示，永不过期
  return cacheSet('ds:probe', out, 5 * 60 * 1000)
}
async function llmOnce(provider, messages, opts) {
  opts = opts || {}
  if (provider === 'deepseek') {
    if (!DS_OK) return { ok: false, error: 'DEEPSEEK_API_KEY 未配置或格式非法（应为 sk- + 32 位 hex，共 35 字符）' }
    const model = opts.deepseekModel || opts.model || CFG.deepseekModel
    const r = await fetchJSON(CFG.deepseekBase + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CFG.deepseekKey },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: opts.temperature != null ? opts.temperature : 0.9,
        max_tokens: budgetFor(model, opts.maxTokens),
        stream: false
      })
    }, opts.timeoutMs || (isReasoningModel(model) ? 90000 : 45000))
    if (r.status !== 200) {
      const msg = (r.json && r.json.error && r.json.error.message) || String(r.text).slice(0, 200)
      let hint = ''
      if (r.status === 401) hint = '（密钥无效或已被重置：去 platform.deepseek.com 重新生成）'
      else if (r.status === 402) hint = '（账户余额不足：去 platform.deepseek.com 充值）'
      else if (r.status === 429) hint = '（触发限流：稍后重试，或把 DEEPSEEK_MODEL 换成 deepseek-chat）'
      else if (r.status === 400 && /model/i.test(msg)) hint = '（模型名不被支持：可用 ' + ((cacheGet('ds:probe') || {}).models || ['deepseek-chat']).join(' / ') + '）'
      return { ok: false, error: 'DeepSeek ' + r.status + '：' + msg + hint }
    }
    const c = r.json && r.json.choices && r.json.choices[0]
    const reply = c && c.message && c.message.content
    const reasoning = (c && c.message && c.message.reasoning_content) || ''
    if (!reply) {
      if (reasoning) return { ok: false, error: 'DeepSeek(' + model + ') 只产出了思考过程、正文为空（推理模型 token 预算不足，已自动抬高仍未够；建议改用 deepseek-chat）' }
      return { ok: false, error: 'DeepSeek 返回为空' }
    }
    return {
      ok: true, provider: 'deepseek', model: (r.json && r.json.model) || model,
      reply: String(reply).trim(), usage: r.json && r.json.usage, reasoning: reasoning
    }
  }
  if (provider === 'zhida') {
    const r = await fetchJSON(CFG.zhihuBase + '/v1/chat/completions', {
      method: 'POST',
      headers: zhihuHeaders(),
      body: JSON.stringify({
        model: opts.model || CFG.zhidaFast,
        messages: messages,
        stream: false
      })
    }, opts.timeoutMs || 60000)
    if (r.status !== 200) return { ok: false, error: '知乎直答 ' + r.status + '：' + ((r.json && (r.json.error && r.json.error.message || r.json.Message)) || String(r.text).slice(0, 200)) }
    const c = r.json && r.json.choices && r.json.choices[0]
    const reply = c && c.message && c.message.content
    if (!reply) return { ok: false, error: '知乎直答返回为空' }
    return { ok: true, provider: 'zhida', model: (r.json && r.json.model) || CFG.zhidaFast, reply: String(reply).trim(), reasoning: c.message.reasoning_content || '' }
  }
  return { ok: false, error: '没有可用的模型提供商（DeepSeek key 未配置或格式非法，知乎 token 也未配置）' }
}
async function llmChat(messages, opts) {
  opts = opts || {}
  const order = opts.order || providerOrder('chat')
  const errs = []
  for (const p of order) {
    if (p === 'local') break
    const r = await llmOnce(p, messages, opts)
    if (r.ok) return r
    errs.push(p + ': ' + r.error)
  }
  return { ok: false, error: errs.join(' | ') || '无可用模型', provider: 'none' }
}
/* 本地兜底话术（没有任何模型可用时，前端仍不至于空白） */
function localFallback(mode, ctx) {
  const t = ctx && ctx.title ? ctx.title : '这篇'
  if (mode === 'debate') {
    return '「' + String((ctx && ctx.userText) || '').slice(0, 18) + '…」这句我先记下。不过我怀疑你把「懂了」和「记得住」当成一回事了 —— 你打算怎么证明自己真记住了？'
  }
  return '（当前没有可用的模型：DeepSeek 密钥未生效、知乎直答也不可用）我先把问题记下来：「' + t + '」。等后端密钥就绪我就能真正回答你了。'
}

/* ============================================================
   4. 静态热榜兜底（后端拿不到知乎数据时的演示数据）
   ============================================================ */
const HOT_POOL = [
  { id: 'llm', q: '大模型到底是什么？给非技术的人讲讲', cat: 'tech', votes: 15200, url: 'https://www.zhihu.com/question/599088771' },
  { id: 'coding', q: '零基础自学编程，应该先学什么？', cat: 'tech', votes: 9100, url: 'https://www.zhihu.com/question/20100372' },
  { id: 'feynman', q: '费曼学习法真的有用吗？', cat: 'study', votes: 8400, url: 'https://www.zhihu.com/question/20507133' },
  { id: 'interview', q: '秋招面试怎么准备才不慌？', cat: 'work', votes: 6800, url: 'https://www.zhihu.com/question/458969070' },
  { id: 'answer', q: '怎样写出让人读完的知乎回答？', cat: 'write', votes: 6300, url: 'https://www.zhihu.com/question/20364881' },
  { id: 'spaced', q: '为什么学了就忘？间隔重复真的有用吗', cat: 'study', votes: 5200, url: 'https://www.zhihu.com/question/305312423' },
  { id: 'logic', q: '一开口就乱，说话没逻辑怎么办？', cat: 'write', votes: 5200, url: 'https://www.zhihu.com/question/25917820' },
  { id: 'viewpoint', q: '写文章总是没观点，怎么办？', cat: 'write', votes: 4800, url: 'https://www.zhihu.com/question/28790022' },
  { id: 'recount', q: '年终总结怎么写，才不像流水账？', cat: 'work', votes: 4100, url: 'https://www.zhihu.com/question/360997571' },
  { id: 'notes', q: '读书笔记到底怎么做才有用？', cat: 'study', votes: 3600, url: 'https://www.zhihu.com/question/20181583' },
  { id: 'gpt', q: 'ChatGPT 到底该怎么用？', cat: 'tech', votes: 7200, url: 'https://www.zhihu.com/question/592297033' },
  { id: 'talk', q: '怎么向老板汇报工作，才不挨骂？', cat: 'work', votes: 3000, url: 'https://www.zhihu.com/question/329745799' }
]
function hotItemsLocal() {
  const hourSeed = Math.floor(Date.now() / 3600_000)
  return HOT_POOL.slice().sort(function (a, b) {
    const pa = (a.votes + ((hourSeed * 7 + a.id.length * 13) % 500))
    const pb = (b.votes + ((hourSeed * 7 + b.id.length * 13) % 500))
    return pb - pa
  }).map(function (it, i) { return Object.assign({}, it, { votes: it.votes + ((hourSeed * 3 + i * 11) % 300), rank: i + 1, summary: '', source: 'local' }) })
}
/* 对外统一热榜：真实知乎热榜优先 */
async function hotItems() {
  const z = await zhihuHot(20)
  if (z.ok && z.items && z.items.length) return { items: z.items, live: true, source: 'zhihu-hot', note: '' }
  return { items: hotItemsLocal(), live: false, source: 'local', note: z.error ? ('知乎热榜不可用：' + z.error) : '' }
}
function searchLocal(q) {
  const qs = String(q || '').trim().toLowerCase()
  if (!qs) return hotItemsLocal().slice(0, 6)
  return HOT_POOL.filter(function (it) { return (it.q + ' ' + it.id + ' ' + it.cat).toLowerCase().includes(qs) })
    .map(function (it, i) { return Object.assign({}, it, { rank: i + 1, summary: '', source: 'local' }) })
}

/* ============================================================
   5. 模拟实时环境（天气随时间确定性变化）
   ============================================================ */
const WEATHER_CYCLE = [
  { code: 'sunny', weather: 'sunny', name: '晴', temp: 22 },
  { code: 'cloudy', weather: 'cloudy', name: '多云', temp: 19 },
  { code: 'rain', weather: 'rain', name: '小雨', temp: 16 },
  { code: 'snow', weather: 'snow', name: '小雪', temp: -2 },
  { code: 'thunder', weather: 'thunder', name: '雷雨', temp: 14 },
  { code: 'aurora', weather: 'aurora', name: '极光', temp: -8 }
]
function envNow() {
  const d = new Date()
  const slot = Math.floor((d.getHours() * 60 + d.getMinutes()) / 72)
  const w = WEATHER_CYCLE[slot % WEATHER_CYCLE.length]
  return {
    city: '上海（演示）', weather: w.weather, name: w.name, temp: w.temp, code: w.code,
    hour: d.getHours(), ts: Date.now(),
    note: '演示环境数据；接入和风天气/OpenWeatherMap 后即为真实值'
  }
}

/* ============================================================
   6. WebSocket（手写实现，支持客户端上行帧 → 多人实时热点话题互动）
   ============================================================ */
const clients = new Set()
const rooms = new Map() // roomId -> { msgs:[], socks:Set }
function wsFrame(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8')
  let header
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length])
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2)
  } else {
    header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2)
  }
  return Buffer.concat([header, payload])
}
function wsSend(sock, obj) { try { sock.write(wsFrame(obj)) } catch (e) { } }
function roomOf(id) {
  if (!rooms.has(id)) rooms.set(id, { msgs: [], socks: new Set(), topic: null })
  return rooms.get(id)
}
function roomState(id) {
  const r = rooms.get(id)
  if (!r) return { room: id, users: 0, msgs: [] }
  const users = []
  r.socks.forEach(function (s) { if (s.__rkUser) users.push(s.__rkUser) })
  return { room: id, users: r.socks.size, usersList: users.slice(0, 40), msgs: r.msgs.slice(-60), topic: r.topic }
}
function roomBroadcast(id, obj, exceptSock) {
  const r = rooms.get(id); if (!r) return
  const frame = wsFrame(obj)
  r.socks.forEach(function (s) { if (s !== exceptSock) { try { s.write(frame) } catch (e) { r.socks.delete(s) } } })
}
function handleClientMsg(sock, msg) {
  if (!msg || typeof msg !== 'object') return
  const type = msg.type
  if (type === 'join' || type === 'room') {
    const rid = String(msg.room || msg.topicId || 'lobby')
    const r = roomOf(rid)
    if (sock.__rkRoom && sock.__rkRoom !== rid) leaveRoom(sock)
    sock.__rkRoom = rid
    sock.__rkUser = String(msg.user || sock.__rkUser || ('游客' + (sock.__rkId || '').slice(-3) || '游客'))
    r.socks.add(sock)
    if (msg.topic) r.topic = msg.topic
    wsSend(sock, { type: 'room', data: roomState(rid) })
    roomBroadcast(rid, { type: 'room:presence', data: { room: rid, users: r.socks.size, user: sock.__rkUser, action: 'join' } }, sock)
    /* 让房间里所有人都看到最新在线人数 */
    roomBroadcast(rid, { type: 'room', data: roomState(rid) })
    return
  }
  if (type === 'say') {
    const rid = String(msg.room || sock.__rkRoom || 'lobby')
    const text = String(msg.text || '').slice(0, 500).trim()
    if (!text) return
    const r = roomOf(rid)
    r.socks.add(sock); sock.__rkRoom = rid
    if (msg.user) sock.__rkUser = String(msg.user).slice(0, 24)
    const m = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user: sock.__rkUser || '游客', text: text, ts: Date.now(), kind: msg.kind || 'text' }
    r.msgs.push(m)
    if (r.msgs.length > 200) r.msgs.splice(0, r.msgs.length - 200)
    roomBroadcast(rid, { type: 'room:msg', data: { room: rid, msg: m, users: r.socks.size } })
    return
  }
  if (type === 'typing') {
    const rid = String(msg.room || sock.__rkRoom || 'lobby')
    roomBroadcast(rid, { type: 'room:typing', data: { room: rid, user: sock.__rkUser || '游客' } }, sock)
    return
  }
  if (type === 'leave') { leaveRoom(sock); return }
  if (type === 'ping') { wsSend(sock, { type: 'pong', ts: Date.now() }); return }
  if (type === 'ai') { handleRoomAi(sock, msg); return }
}
function leaveRoom(sock) {
  const rid = sock.__rkRoom
  if (!rid) return
  const r = rooms.get(rid)
  if (r) {
    r.socks.delete(sock)
    roomBroadcast(rid, { type: 'room:presence', data: { room: rid, users: r.socks.size, user: sock.__rkUser, action: 'leave' } })
  }
  sock.__rkRoom = null
}
/* 房间里 @AI：把当前话题 + 最近对话交给模型，回答广播给全房间（多人共见） */
async function handleRoomAi(sock, msg) {
  const rid = String(msg.room || sock.__rkRoom || 'lobby')
  const r = roomOf(rid)
  r.socks.add(sock)
  const q = String(msg.text || '').slice(0, 300).trim()
  if (!q) return
  const notice = { id: 'm' + Date.now().toString(36) + 'ai', user: '小炼', text: '正在思考…', ts: Date.now(), kind: 'ai' }
  r.msgs.push(notice); roomBroadcast(rid, { type: 'room:msg', data: { room: rid, msg: notice, users: r.socks.size } })
  const topic = r.topic || {}
  const recent = r.msgs.slice(-8).filter(function (m) { return m.id !== notice.id }).map(function (m) { return m.user + '：' + m.text }).join('\n')
  const res = await llmChat([
    {
      role: 'system', content: SYSTEM_UNIVERSE +
        '\n你现在在一个多人实时讨论房间里，和大家一起聊一个知乎热点。' +
        '\n输出要求：直接给出你的观点，不要复述问题、不要写标题、不要用 Markdown 标记、不要自我介绍；' +
        '\n80-160 字，能推进讨论（给新角度、新事实或一个值得讨论的追问）。'
    },
    { role: 'system', content: '当前话题：' + (topic.title || topic.q || '知乎热点') + '\n话题链接：' + (topic.url || '') + '\n房间里最近的讨论：\n' + (recent || '（暂无）') },
    { role: 'user', content: (sock.__rkUser || '有人') + ' 问：' + q }
  ], { maxTokens: 500, temperature: 0.9 })
  notice.text = String(res.ok ? res.reply : (localFallback('chat', { title: topic.title }) + '（' + res.error + '）'))
    .replace(/^#+\s*/gm, '').replace(/^\s*["「]|["」]\s*$/g, '').trim()
  notice.provider = res.provider || 'none'
  roomBroadcast(rid, { type: 'room:msg', data: { room: rid, msg: notice, users: r.socks.size, replace: notice.id } })
}
/* 说明：101 响应必须用原始 socket 直写。
   走 res.writeHead(101) 时 Node 不会把响应头 flush 到已 upgrade 的 socket 上，
   浏览器会因握手响应缺失而直接断开（历史 server.js 里的 WS 就是这么失效的）。 */
function handleWSSocket(req, sock, head) {
  const key = req.headers['sec-websocket-key']
  if (!key || !sock || sock.destroyed) { try { sock && sock.destroy() } catch (e) { } return }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
  try {
    sock.write('HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n')
  } catch (e) { try { sock.destroy() } catch (e2) { } return }
  sock.__rkId = crypto.randomBytes(4).toString('hex')
  sock.__rkUser = '游客' + sock.__rkId.slice(-3)
  sock.__rkRoom = null
  sock.__rkBuf = Buffer.alloc(0)
  clients.add(sock)
  wsSend(sock, { type: 'hello', ts: Date.now(), clients: clients.size, id: sock.__rkId, ai: providerOrder('chat'), debateOrder: providerOrder('debate'), zhihu: ZH_OK })
  hotItems().then(function (h) { wsSend(sock, { type: 'hotlist', data: { items: h.items, live: h.live, source: h.source } }) })
  wsSend(sock, { type: 'env', data: envNow() })
  sock.on('close', function () { clients.delete(sock); leaveRoom(sock) })
  sock.on('error', function () { clients.delete(sock); leaveRoom(sock) })
  sock.on('data', function (buf) { readFrames(sock, buf) })
  if (head && head.length) readFrames(sock, head) // upgrade 时可能已经带上首帧
}
/* 兼容：若请求走到 request 处理器（无 upgrade 监听时的路径），同样能用 */
function handleWS(req, res) {
  const sock = res.socket
  try { res.detachSocket && res.detachSocket(sock) } catch (e) { }
  handleWSSocket(req, sock, null)
}
/* 极简但正确的帧解析：支持文本/关闭/ping，处理分片与掩码 */
function readFrames(sock, buf) {
  sock.__rkBuf = Buffer.concat([sock.__rkBuf, buf])
  for (;;) {
    const b = sock.__rkBuf
    if (b.length < 2) return
    const fin = (b[0] & 0x80) !== 0
    const opcode = b[0] & 0x0f
    const masked = (b[1] & 0x80) !== 0
    let len = b[1] & 0x7f
    let off = 2
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4 }
    else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > 8n * 1024n * 1024n) { sock.destroy(); return } len = Number(big); off = 10 }
    let mask = null
    if (masked) { if (b.length < off + 4) return; mask = b.slice(off, off + 4); off += 4 }
    if (b.length < off + len) return
    let payload = b.slice(off, off + len)
    if (mask) { const p = Buffer.allocUnsafe(len); for (let i = 0; i < len; i++) p[i] = payload[i] ^ mask[i & 3]; payload = p }
    sock.__rkBuf = b.slice(off + len)
    if (opcode === 0x8) { // close
      try { sock.write(Buffer.from([0x88, 0x00])) } catch (e) { }
      sock.destroy(); return
    }
    if (opcode === 0x9) { // ping → pong
      const pl = Buffer.concat([Buffer.from([0x8a, payload.length]), payload])
      try { sock.write(pl) } catch (e) { }
      continue
    }
    if (opcode === 0x1 || opcode === 0x0) {
      if (!fin && opcode === 0x1) { // 分片：先拼进暂存
        sock.__rkFrag = payload
        continue
      }
      let text
      if (opcode === 0x0 && sock.__rkFrag) { text = Buffer.concat([sock.__rkFrag, payload]).toString('utf8'); sock.__rkFrag = null }
      else text = payload.toString('utf8')
      let msg = null
      try { msg = JSON.parse(text) } catch (e) { msg = null }
      if (msg) { try { handleClientMsg(sock, msg) } catch (e) { } }
      continue
    }
    /* 其它 opcode 忽略 */
  }
}
function broadcast(obj) {
  const frame = wsFrame(obj)
  for (const c of clients) { try { c.write(frame) } catch (e) { clients.delete(c) } }
}
setInterval(function () { broadcast({ type: 'heartbeat', ts: Date.now(), clients: clients.size }) }, 25000)
setInterval(function () { broadcast({ type: 'env', data: envNow() }) }, 72000)
setInterval(function () {
  hotItems().then(function (h) { broadcast({ type: 'hotlist', data: { items: h.items, live: h.live, source: h.source } }) })
}, 1800000)

/* ============================================================
   7. SSE 流式聊天（把上游 OpenAI 风格 SSE 归一成 {delta}）
   ============================================================ */
async function streamLLM(res, messages, opts) {
  opts = opts || {}
  const order = providerOrder(opts.mode || 'chat').filter(function (p) { return p !== 'local' })
  cors(res)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  function sse(obj) { try { res.write('data: ' + JSON.stringify(obj) + '\n\n') } catch (e) { } }
  if (!order.length) {
    sse({ type: 'error', error: '没有可用的模型提供商' })
    sse({ type: 'done' })
    return res.end()
  }
  for (const p of order) {
    let upstream = null
    const dsModel = p === 'deepseek' ? (opts.deepseekModel || opts.model || CFG.deepseekModel) : null
    const body = p === 'deepseek'
      ? {
        model: dsModel, messages: messages,
        temperature: opts.temperature != null ? opts.temperature : 0.9,
        max_tokens: budgetFor(dsModel, opts.maxTokens || 800), stream: true
      }
      : { model: CFG.zhidaFast, messages: messages, stream: true }
    const url = p === 'deepseek' ? CFG.deepseekBase + '/chat/completions' : CFG.zhihuBase + '/v1/chat/completions'
    const headers = p === 'deepseek'
      ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CFG.deepseekKey }
      : zhihuHeaders()
    try {
      upstream = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) })
      if (upstream.status !== 200) {
        const t = await upstream.text()
        sse({ type: 'warn', provider: p, error: p + ' ' + upstream.status + '：' + t.slice(0, 220) })
        upstream = null
        continue
      }
    } catch (e) {
      sse({ type: 'warn', provider: p, error: p + ' 连接失败：' + ((e && e.message) || e) })
      continue
    }
    sse({ type: 'start', provider: p, model: p === 'deepseek' ? dsModel : CFG.zhidaFast })
    const reader = upstream.body.getReader()
    const dec = new TextDecoder('utf-8')
    let buf = ''
    let acc = ''
    let sawReasoning = false
    for (;;) {
      const r = await reader.read()
      if (r.done) break
      buf += dec.decode(r.value, { stream: true })
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '')
        buf = buf.slice(i + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const j = JSON.parse(data)
          const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message)
          /* 推理型模型先吐一大段 reasoning_content（可能几秒没有正文）：
             给前端一个"深度思考中"的信号，避免界面看起来卡死 */
          if (d && d.reasoning_content && !sawReasoning) { sawReasoning = true; sse({ type: 'thinking' }) }
          const piece = d && d.content
          if (piece) { acc += piece; sse({ type: 'delta', text: piece }) }
        } catch (e) { }
      }
    }
    sse({ type: 'done', provider: p, text: acc })
    return res.end()
  }
  sse({ type: 'error', error: '所有模型提供商都失败了，请检查 env 里的密钥' })
  sse({ type: 'done' })
  return res.end()
}

/* ============================================================
   8. HTTP 路由
   ============================================================ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.map': 'application/json; charset=utf-8'
}

const server = http.createServer(async function (req, res) {
  let url
  try { url = new URL(req.url, 'http://x') } catch (e) { return sendJSON(res, 400, { ok: false, error: 'bad url' }) }
  const p = url.pathname
  const q = function (k, d) { const v = url.searchParams.get(k); return v === null ? d : v }
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end() }

  try {
    /* ---- 健康检查 ---- */
    if (p === '/api/health') {
      return sendJSON(res, 200, {
        ok: true, ts: Date.now(), service: 'reknow-v7',
        providers: providerMeta(),
        ws: '/ws', clients: clients.size, rooms: rooms.size
      })
    }
    /* ---- 兼容旧前端的接口 ---- */
    if (p === '/api/hotlist') {
      const h = await hotItems()
      return sendJSON(res, 200, { items: h.items, ts: Date.now(), live: h.live, source: h.source, note: h.note })
    }
    if (p === '/api/search') {
      const kw = q('q', '')
      /* 有知乎 token 时优先真实搜索，失败回落本地 */
      const z = await zhihuSearch(kw, 10)
      if (z.ok && z.items.length) return sendJSON(res, 200, { items: z.items, ts: Date.now(), source: 'zhihu' })
      return sendJSON(res, 200, { items: searchLocal(kw), ts: Date.now(), source: 'local', note: z.error || '' })
    }
    if (p === '/api/env') return sendJSON(res, 200, envNow())

    /* ---- 知乎开放平台 ---- */
    if (p === '/api/zhihu/search') {
      const r = await zhihuSearch(q('q', ''), Number(q('count', 10)) || 10)
      return sendJSON(res, r.ok ? 200 : 502, r.ok ? { ok: true, items: r.items, hasMore: r.hasMore, searchUrl: zhihuSearchUrl(q('q', '')) } : { ok: false, error: r.error })
    }
    if (p === '/api/zhihu/global') {
      const r = await zhihuGlobal(q('q', ''), Number(q('count', 10)) || 10, q('filter', ''))
      return sendJSON(res, r.ok ? 200 : 502, r.ok ? { ok: true, items: r.items, hasMore: r.hasMore } : { ok: false, error: r.error })
    }
    if (p === '/api/zhihu/hot') {
      const r = await zhihuHot(Number(q('limit', 20)) || 20)
      return sendJSON(res, r.ok ? 200 : 502, r.ok ? { ok: true, items: r.items, total: r.total } : { ok: false, error: r.error })
    }
    if (p === '/api/zhihu/answers') {
      const r = await zhihuAnswers(q('url', ''), Number(q('limit', 5)) || 5)
      return sendJSON(res, r.ok ? 200 : 502, r.ok ? { ok: true, items: r.items } : { ok: false, error: r.error })
    }
    if (p === '/api/zhihu/original') {
      const r = await zhihuOriginal(q('q', ''), q('url', ''))
      return sendJSON(res, r.ok ? 200 : 404, r)
    }
    if (p === '/api/zhihu/quota') {
      const r = await zhihuQuota()
      return sendJSON(res, r.ok ? 200 : 502, r.ok ? { ok: true, items: r.items } : { ok: false, error: r.error })
    }
    if (p === '/api/zhihu/collections') {
      const r = await zhihuCollections(Number(q('limit', 20)) || 20)
      return sendJSON(res, r.ok ? 200 : 502, r.ok ? { ok: true, items: r.items } : { ok: false, error: r.error })
    }
    if (p === '/api/zhihu/favlists') {
      const r = await zhihuFavlists()
      return sendJSON(res, r.ok ? 200 : 502, r.ok ? { ok: true, items: r.items } : { ok: false, error: r.error })
    }

    /* ---- AI ---- */
    if (p === '/api/ai/health' || p === '/api/ai/providers') {
      const pm = providerMeta()
      return sendJSON(res, 200, { ok: true, order: pm.order, deepseekReady: pm.deepseek.configured && pm.deepseek.keyLooksValid, zhidaReady: pm.zhida.configured, detail: pm })
    }
    /* 模型/额度状态：前端 AI 面板据此显示供应商与余额；?force=1 跳过缓存重新探一次 */
    if (p === '/api/ai/models') {
      const probe = await deepseekProbe(q('force', '') === '1')
      const pm = providerMeta()
      return sendJSON(res, 200, {
        ok: true, order: pm.order, debateOrder: pm.debateOrder,
        chatProvider: pm.chatProvider, debateProvider: pm.debateProvider,
        deepseek: pm.deepseek, zhida: pm.zhida,
        models: probe.models || [], balance: probe.balance || null, error: probe.error || null
      })
    }
    if (p === '/api/ai/chat/stream' && req.method === 'POST') {
      const b = await readBody(req)
      if (!b) return sendJSON(res, 400, { ok: false, error: 'body too large' })
      const msgs = []
      msgs.push({ role: 'system', content: b.system || SYSTEM_UNIVERSE })
      if (Array.isArray(b.context) && b.context.length) {
        msgs.push({ role: 'system', content: '用户当前上下文：\n' + b.context.slice(0, 12).map(function (c) { return '- ' + String(c).slice(0, 600) }).join('\n') })
      }
      ;(Array.isArray(b.messages) ? b.messages : []).slice(-14).forEach(function (m) {
        if (m && m.role && m.content) msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) })
      })
      return streamLLM(res, msgs, { temperature: b.temperature, maxTokens: b.maxTokens })
    }
    if ((p === '/api/ai/chat' || p === '/api/ai/ask') && req.method === 'POST') {
      const b = await readBody(req)
      if (!b) return sendJSON(res, 400, { ok: false, error: 'body too large' })
      const msgs = [{ role: 'system', content: b.system || SYSTEM_UNIVERSE }]
      if (Array.isArray(b.context) && b.context.length) {
        msgs.push({ role: 'system', content: '用户当前上下文：\n' + b.context.slice(0, 12).map(function (c) { return '- ' + String(c).slice(0, 600) }).join('\n') })
      }
      ;(Array.isArray(b.messages) ? b.messages : []).slice(-14).forEach(function (m) {
        if (m && m.role && m.content) msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) })
      })
      if (!msgs.some(function (m) { return m.role === 'user' })) return sendJSON(res, 400, { ok: false, error: '缺少用户消息' })
      const r = await llmChat(msgs, { temperature: 0.85, maxTokens: b.maxTokens || 800 })
      if (r.ok) return sendJSON(res, 200, { ok: true, provider: r.provider, model: r.model, reply: r.reply, usage: r.usage || null })
      return sendJSON(res, 200, { ok: false, provider: 'none', reply: localFallback('chat', { title: (b.context && b.context[0]) || '' }), error: r.error })
    }
    if ((p === '/api/ai/debate' || p === '/api/ai/oppose') && req.method === 'POST') {
      const b = await readBody(req)
      if (!b) return sendJSON(res, 400, { ok: false, error: 'body too large' })
      const topic = b.topic || {}
      const userText = String(b.userText || b.text || '').trim()
      if (!userText) return sendJSON(res, 400, { ok: false, error: '缺少 userText（用户的回答）' })
      const intensity = ({ mild: '温和：提醒式，语气友好但要点到痛处', mid: '适中：直接反驳，你来我往', hard: '激烈：质疑式，逼对方把逻辑补完整' })[b.intensity] || '适中：直接反驳'
      const round = Number(b.round || 1)
      const isLast = !!b.final || round >= 3
      const ctx = []
      if (topic.title || topic.q) ctx.push('原文标题：' + (topic.title || topic.q))
      if (topic.core) ctx.push('原文核心观点：' + topic.core)
      if (topic.trap) ctx.push('原文强调的边界/易踩坑：' + topic.trap)
      if (Array.isArray(topic.blocks) && topic.blocks.length) ctx.push('原文要点：' + topic.blocks.slice(0, 8).map(function (x) { return (x.tp ? x.tp + '：' : '') + (x.text || '') }).join(' / '))
      if (Array.isArray(b.history) && b.history.length) ctx.push('之前的交锋：\n' + b.history.slice(-6).map(function (m) { return (m.role === 'me' ? '用户' : 'AI') + '：' + String(m.text || '').slice(0, 300) }).join('\n'))
      const ask = [
        '辩论强度：' + intensity,
        '这是第 ' + round + ' 回合。',
        isLast ? '这是最后一轮：先给一句有分量的收束（点出他守住/没守住什么），不要再提问。' : '反驳完必须留一个具体问题逼他回答。',
        '',
        '用户刚才的原话（必须引用他原话里的具体词）：',
        '「' + userText + '」',
        '',
        '现在给出你的反驳（2-3 句，60-120 字，直接输出正文，不要任何前缀或标签）。'
      ].join('\n')
      const msgs = [
        { role: 'system', content: SYSTEM_DEBATE },
        { role: 'system', content: '本篇背景（供你判断他有没有踩坑，不要在回答里整段复述）：\n' + (ctx.join('\n') || '（无）') },
        { role: 'user', content: ask }
      ]
      /* 抬杠固定走 DeepSeek 优先链（问答走知乎直答，见 providerOrder） */
      const r = await llmChat(msgs, { temperature: 1.0, maxTokens: 400, deepseekModel: CFG.deepseekDebateModel, order: providerOrder('debate') })
      if (r.ok) return sendJSON(res, 200, { ok: true, provider: r.provider, model: r.model, reply: r.reply, round: round, final: isLast })
      return sendJSON(res, 200, { ok: false, provider: 'none', reply: localFallback('debate', { userText: userText, title: topic.title }), error: r.error })
    }

    /* ---- WebSocket ---- */
    if (p === '/ws') return handleWS(req, res)

    /* ---- 静态 ---- */
    let fp = decodeURIComponent(p === '/' ? '/index.html' : p)
    const target = path.normalize(path.join(ROOT, fp))
    if (!target.startsWith(ROOT)) return sendJSON(res, 403, { ok: false })
    fs.stat(target, function (err, st) {
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found') }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' })
      fs.createReadStream(target).pipe(res)
    })
  } catch (e) {
    try { sendJSON(res, 500, { ok: false, error: String((e && e.message) || e) }) } catch (e2) { }
  }
})

process.on('uncaughtException', function (e) { console.error('[uncaught]', (e && e.stack) || e) })
process.on('unhandledRejection', function (e) { console.error('[unhandledRejection]', (e && e.stack) || e) })

/* WebSocket 升级：走 Node 官方的 'upgrade' 事件（request 处理器不会收到 upgrade 请求） */
server.on('upgrade', function (req, socket, head) {
  let p = '/'
  try { p = new URL(req.url, 'http://x').pathname } catch (e) { }
  if (p !== '/ws') { try { socket.destroy() } catch (e) { } return }
  try { handleWSSocket(req, socket, head) } catch (e) { try { socket.destroy() } catch (e2) { } }
})

server.on('error', function (e) {
  if (e && e.code === 'EADDRINUSE') {
    console.error('[炼金宇宙 v7] 端口 ' + PORT + ' 已被占用：先关掉旧的 node server.js（或设置 PORT 换端口）。')
    process.exit(1)
  }
  console.error('[server error]', e)
})

server.listen(PORT, function () {
  const pm = providerMeta()
  console.log('[炼知 ReKnow v7] http://localhost:' + PORT)
  console.log('  · 主页面       http://localhost:' + PORT + '/')
  console.log('  · 知乎开放平台  ' + (ZH_OK ? '✅ token 已配置（' + CFG.zhihuBase + '）' : '❌ 未配置 ZHIHU_ACCESS_TOKEN'))
  console.log('  · 模型分工      AI 问答 ' + providerOrder('chat').join(' → ') + '   |   AI 抬杠 ' + providerOrder('debate').join(' → '))
  if (DS_OK) {
    console.log('  · DeepSeek     key 格式合法，正在验证…（聊天模型=' + CFG.deepseekModel + '，抬杠模型=' + CFG.deepseekDebateModel + '）')
  } else if (CFG.deepseekKey) {
    console.log('  · DeepSeek     ⚠️ key 格式非法（应为 sk- + 32 位 hex，共 35 字符），本次不会调用它')
  } else {
    console.log('  · DeepSeek     未配置 DEEPSEEK_API_KEY，走知乎直答')
  }
  console.log('  · REST         /api/zhihu/search|hot|answers|original|quota /api/ai/chat|chat/stream|debate|models /api/hotlist /api/env')
  console.log('  · WebSocket    ws://localhost:' + PORT + '/ws  （热榜 / 环境 / 多人热点话题房间）')
  console.log('  · 环境文件      ' + (envLoaded.length ? envLoaded.join(', ') : '未找到 env/.env'))
  /* 启动即验证一次密钥（不阻塞监听），把结果打到日志里，免得答辩当天才发现 key 失效 */
  deepseekProbe(true).then(function (p) {
    if (p.ok) {
      console.log('  · DeepSeek ✅ 鉴权通过 · 可用模型：' + (p.models.length ? p.models.join(' / ') : '(未列出)') +
        (p.balance ? ' · 余额 ' + p.balance.total + ' ' + p.balance.currency : ''))
    } else if (DS_OK) {
      console.log('  · DeepSeek ❌ 鉴权失败：' + p.error + '（AI 会自动改用知乎直答，功能不受影响）')
    }
  })
})
