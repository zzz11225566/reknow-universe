/* ============================================================
   炼知 ReKnow v6.5 · 可选后端（纯 Node，零依赖，无需 npm install）
   - 静态托管整个「炼金宇宙」演示目录（http://localhost:8787）
   - GET /api/health        健康检查
   - GET /api/hotlist       知识热榜（模拟知乎学习话题热度，供前端热榜面板）
   - GET /api/search?q=..   全站搜索（题目 / 答主 / 分类 / 关键词）
   - GET /api/env           环境快照（城市 / 天气 / 温度，按真实时间确定性变化）
   - WS   /ws               实时推送：hello → heartbeat / hotlist / env
   启动：node server.js     （前端自动探测，连上即点亮「实时」）
   说明：赛事演示用模拟数据；真实接入时在此处替换为知乎开放平台与天气 API。
   ============================================================ */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const ROOT = __dirname

/* ---------- 模拟热榜（id 与本地 DEMO 选题一一对应 → 点热榜可直接聚焦/进入学习） ---------- */
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
function hotItems() {
  // 每小时重排一次，制造「榜单在动」的实时感
  const hourSeed = Math.floor(Date.now() / 3600_000)
  return HOT_POOL.slice().sort((a, b) => {
    const pa = (a.votes + ((hourSeed * 7 + a.id.length * 13) % 500))
    const pb = (b.votes + ((hourSeed * 7 + b.id.length * 13) % 500))
    return pb - pa
  }).map((it, i) => ({ ...it, votes: it.votes + ((hourSeed * 3 + i * 11) % 300), rank: i + 1 }))
}
function search(q) {
  const qs = String(q || '').trim().toLowerCase()
  if (!qs) return hotItems().slice(0, 6)
  return HOT_POOL.filter(it =>
    (it.q + ' ' + it.id + ' ' + it.cat).toLowerCase().includes(qs)
  ).map((it, i) => ({ ...it, rank: i + 1 }))
}

/* ---------- 模拟实时环境（天气随时间确定性变化） ---------- */
const WEATHER_CYCLE = [
  { code: 'sunny', weather: 'sunny', name: '晴', temp: 22 },
  { code: 'cloudy', weather: 'cloudy', name: '多云', temp: 19 },
  { code: 'rain', weather: 'rain', name: '小雨', temp: 16 },
  { code: 'snow', weather: 'snow', name: '小雪', temp: -2 },
  { code: 'aurora', weather: 'aurora', name: '极光（演示）', temp: -8 }
]
function envNow() {
  const d = new Date()
  const slot = Math.floor((d.getHours() * 60 + d.getMinutes()) / 72) // 每 72 分钟换一档
  const w = WEATHER_CYCLE[slot % WEATHER_CYCLE.length]
  return {
    city: '上海（演示）',
    weather: w.weather,
    name: w.name,
    temp: w.temp,
    code: w.code,
    hour: d.getHours(),
    ts: Date.now(),
    note: '赛事演示环境数据；接入和风天气/OpenWeatherMap 后即为真实值'
  }
}

/* ---------- 静态文件服务 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp', '.woff2': 'font/woff2'
}
function cors(res) { res.setHeader('Access-Control-Allow-Origin', '*') }
function sendJSON(res, code, obj) {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  if (p === '/api/health') return sendJSON(res, 200, { ok: true, ts: Date.now(), service: 'recknow-v6' })
  if (p === '/api/hotlist') return sendJSON(res, 200, { items: hotItems(), ts: Date.now() })
  if (p === '/api/search') return sendJSON(res, 200, { items: search(url.searchParams.get('q')), ts: Date.now() })
  if (p === '/api/env') return sendJSON(res, 200, envNow())
  if (p === '/ws') return handleWS(req, res)
  // 静态
  let fp = decodeURIComponent(p === '/' ? '/index.html' : p)
  const target = path.normalize(path.join(ROOT, fp))
  if (!target.startsWith(ROOT)) return sendJSON(res, 403, { ok: false })
  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found') }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    fs.createReadStream(target).pipe(res)
  })
})

/* ---------- WebSocket（极简实现，仅服务端下发文本帧） ---------- */
const clients = new Set()
function handleWS(req, res) {
  const key = req.headers['sec-websocket-key']
  if (!key) { res.writeHead(400); return res.end('bad request') }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
  res.writeHead(101, {
    'Upgrade': 'websocket', 'Connection': 'Upgrade',
    'Sec-WebSocket-Accept': accept
  })
  const sock = res.socket
  clients.add(sock)
  const send = (obj) => {
    const payload = Buffer.from(JSON.stringify(obj), 'utf8')
    let header
    if (payload.length < 126) {
      header = Buffer.from([0x81, 0x80 | payload.length])
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126
      header.writeUInt16BE(payload.length, 2)
    } else {
      header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127
      header.writeBigUInt64BE(BigInt(payload.length), 2)
    }
    try { sock.write(Buffer.concat([header, payload])) } catch (_) {}
  }
  send({ type: 'hello', ts: Date.now(), clients: clients.size })
  send({ type: 'hotlist', data: { items: hotItems(), live: true } })
  send({ type: 'env', data: envNow() })
  sock.on('close', () => clients.delete(sock))
  sock.on('error', () => clients.delete(sock))
  // 客户端可能发来 ping/文本（无需解析，读走即可防止积压）
  sock.on('data', () => {})
}
function broadcast(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8')
  let header
  if (payload.length < 126) header = Buffer.from([0x81, payload.length])
  else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2) }
  const frame = Buffer.concat([header, payload])
  for (const c of clients) { try { c.write(frame) } catch (_) { clients.delete(c) } }
}
setInterval(() => {
  broadcast({ type: 'heartbeat', ts: Date.now(), clients: clients.size })
}, 25000)
setInterval(() => {
  broadcast({ type: 'env', data: envNow() })
}, 72000)
setInterval(() => {
  broadcast({ type: 'hotlist', data: { items: hotItems(), live: true } })
}, 300000)

server.listen(PORT, () => {
  console.log(`[炼金宇宙 v6.5] http://localhost:${PORT}`)
  console.log(`  · 主页面       http://localhost:${PORT}/`)
  console.log(`  · API          /api/health  /api/hotlist  /api/search?q=费曼  /api/env`)
  console.log(`  · WebSocket    ws://localhost:${PORT}/ws  （heartbeat / hotlist / env 实时推送）`)
})
