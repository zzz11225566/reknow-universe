/* 后端接口 + WebSocket 多人房间 自测（node _test_api.cjs） */
const B = 'http://127.0.0.1:8787'
let pass = 0, fail = 0
function ok(n, c, extra) { if (c) { pass++; console.log('  PASS  ' + n + (extra ? '  ' + extra : '')) } else { fail++; console.log('  FAIL  ' + n + '  ' + (extra || '')) } }
async function j(u, opt) {
  const r = await fetch(B + u, opt)
  const t = await r.text()
  try { return { s: r.status, j: JSON.parse(t) } } catch (e) { return { s: r.status, t: t } }
}
;(async () => {
  console.log('=== REST ===')
  let h = await j('/api/health')
  ok('health', h.s === 200 && h.j.ok, 'providers=' + (h.j.providers && h.j.providers.order.join(',')))
  ok('health 不含密钥明文', !/sk-|c08e87/.test(JSON.stringify(h.j)))

  let s = await j('/api/zhihu/search?q=' + encodeURIComponent('费曼学习法') + '&count=3')
  ok('zhihu/search', s.s === 200 && s.j.ok && s.j.items.length > 0, 'items=' + (s.j.items || []).length + ' 首条=' + ((s.j.items[0] || {}).title || '').slice(0, 26))
  ok('search 结果含原文链接', !!(s.j.items[0] || {}).url)
  ok('search 结果含长摘要(≥120字)', ((s.j.items[0] || {}).excerpt || '').length >= 120, 'len=' + ((s.j.items[0] || {}).excerpt || '').length)

  let ht = await j('/api/zhihu/hot?limit=5')
  ok('zhihu/hot', ht.s === 200 && ht.j.ok && ht.j.items.length > 0, 'items=' + (ht.j.items || []).length + ' 首条=' + ((ht.j.items[0] || {}).q || '').slice(0, 24))

  let ans = await j('/api/zhihu/answers?url=' + encodeURIComponent('https://www.zhihu.com/question/347179994') + '&limit=2')
  ok('zhihu/answers', ans.s === 200 && ans.j.ok && ans.j.items.length > 0, 'items=' + (ans.j.items || []).length)
  let bad = await j('/api/zhihu/answers?url=' + encodeURIComponent('https://example.com/x'))
  ok('answers 参数校验', bad.s === 502 && bad.j.ok === false, bad.j.error)

  let orig = await j('/api/zhihu/original?q=' + encodeURIComponent('费曼学习法真的有用吗'))
  ok('zhihu/original 正文', orig.s === 200 && orig.j.ok && orig.j.paras.length >= 2, 'origin=' + orig.j.origin + ' paras=' + (orig.j.paras || []).length + ' chars=' + orig.j.chars)
  ok('original 段落可直接批注(每条<300字)', (orig.j.paras || []).every(p => p.length <= 300))

  let q2 = await j('/api/zhihu/quota')
  ok('zhihu/quota', q2.s === 200 && q2.j.ok && q2.j.items.length > 0, 'zhihu_search 剩余=' + ((q2.j.items.find(x => x.APIID === 'zhihu_search') || {}).RemainingQuota))

  let col = await j('/api/zhihu/collections?limit=3')
  ok('zhihu/collections', col.s === 200 && col.j.ok, 'items=' + (col.j.items || []).length)

  let hl = await j('/api/hotlist')
  ok('hotlist 兼容旧前端', hl.s === 200 && hl.j.items.length > 0 && hl.j.live === true, 'source=' + hl.j.source)

  console.log('\n=== AI ===')
  let chat = await j('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: '一句话说明收藏不等于学会' }], context: ['正在看：费曼学习法真的有用吗？'] }) })
  ok('ai/chat', chat.s === 200 && chat.j.reply && chat.j.reply.length > 5, 'provider=' + chat.j.provider + ' reply=' + String(chat.j.reply).slice(0, 40))

  let db = await j('/api/ai/debate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: { title: '费曼学习法真的有用吗？', core: '能讲给外行听才算真的会', trap: '对程序性技能作用有限' }, userText: '我觉得费曼学习法就是把东西讲给别人听，讲一遍就记住了', intensity: 'hard', round: 1 }) })
  const reply = String(db.j.reply || '')
  ok('ai/debate 返回', db.s === 200 && reply.length > 10, 'provider=' + db.j.provider + ' len=' + reply.length)
  ok('抬杠贴合用户原话（引用其用词）', /讲给|讲一遍|别人听|记住|费曼/.test(reply), reply.slice(0, 60))
  ok('抬杠结尾留问题', /[？?]/.test(reply))

  let dbShort = await j('/api/ai/debate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userText: '' }) })
  ok('debate 空输入校验', dbShort.s === 400)

  // SSE 流式
  let deltas = 0, gotStart = false, gotDone = false, provider = ''
  const rs = await fetch(B + '/api/ai/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: '用两句话说明间隔重复' }] }) })
  ok('ai/chat/stream 是 SSE', (rs.headers.get('content-type') || '').includes('text/event-stream'))
  const rd = rs.body.getReader(); const dec = new TextDecoder(); let buf = ''
  for (;;) {
    const r = await rd.read(); if (r.done) break
    buf += dec.decode(r.value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2)
      const line = ev.split('\n').find(l => l.startsWith('data:'))
      if (!line) continue
      try { const o = JSON.parse(line.slice(5)); if (o.type === 'delta') deltas++; if (o.type === 'start') { gotStart = true; provider = o.provider } if (o.type === 'done') gotDone = true } catch (e) { }
    }
  }
  ok('SSE 流式增量', deltas > 0 && gotStart && gotDone, 'deltas=' + deltas + ' provider=' + provider)

  console.log('\n=== WebSocket 多人房间 ===')
  const net = require('node:net')
  const crypto = require('node:crypto')
  function mkClient(name) {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64')
      const sock = net.connect(8787, '127.0.0.1', () => {
        sock.write('GET /ws HTTP/1.1\r\nHost: 127.0.0.1:8787\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n')
      })
      let handshaked = false, buf = Buffer.alloc(0)
      const seen = []
      function send(obj) {
        const payload = Buffer.from(JSON.stringify(obj), 'utf8')
        const mask = crypto.randomBytes(4)
        const masked = Buffer.allocUnsafe(payload.length)
        for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i & 3]
        let head
        if (payload.length < 126) head = Buffer.from([0x81, 0x80 | payload.length])
        else { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0x80 | 126; head.writeUInt16BE(payload.length, 2) }
        sock.write(Buffer.concat([head, mask, masked]))
      }
      sock.on('data', d => {
        buf = Buffer.concat([buf, d])
        if (!handshaked) {
          const idx = buf.indexOf('\r\n\r\n')
          if (idx < 0) return
          const head = buf.slice(0, idx).toString()
          if (!/101/.test(head.split('\r\n')[0])) { reject(new Error('handshake failed: ' + head.split('\r\n')[0])); return }
          handshaked = true; buf = buf.slice(idx + 4)
        }
        for (;;) {
          if (buf.length < 2) return
          const len0 = buf[1] & 0x7f; let off = 2, len = len0
          if (len0 === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4 }
          else if (len0 === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10 }
          if (buf.length < off + len) return
          const payload = buf.slice(off, off + len).toString('utf8'); buf = buf.slice(off + len)
          try { seen.push(JSON.parse(payload)) } catch (e) { }
        }
      })
      sock.on('error', reject)
      setTimeout(() => resolve({ name, send, seen, sock, close: () => sock.destroy() }), 400)
    })
  }
  const A = await mkClient('A'), Bc = await mkClient('B')
  ok('握手 + hello', A.seen.some(m => m.type === 'hello'), 'ai order=' + JSON.stringify((A.seen.find(m => m.type === 'hello') || {}).ai))
  await new Promise(r => setTimeout(r, 900))
  ok('热榜推送（真实知乎）', A.seen.some(m => m.type === 'hotlist' && m.data && m.data.items && m.data.items.length), 'source=' + ((A.seen.find(m => m.type === 'hotlist') || {}).data || {}).source)

  A.send({ type: 'join', room: 'hot:test', user: '甲', topic: { title: '测试热点', url: 'https://www.zhihu.com/question/347179994' } })
  await new Promise(r => setTimeout(r, 300))
  Bc.send({ type: 'join', room: 'hot:test', user: '乙' })
  await new Promise(r => setTimeout(r, 400))
  const roomMsg = A.seen.filter(m => m.type === 'room').pop()
  ok('加入房间返回成员数', roomMsg && roomMsg.data.users >= 2, 'users=' + (roomMsg && roomMsg.data.users))
  ok('房间广播 presence', A.seen.some(m => m.type === 'room:presence' && m.data.action === 'join' && m.data.user === '乙'))

  A.send({ type: 'say', room: 'hot:test', text: '大家好，这条应该被乙收到' })
  await new Promise(r => setTimeout(r, 400))
  const gotB = Bc.seen.find(m => m.type === 'room:msg' && m.data.msg.text.includes('这条应该被乙收到'))
  ok('A 发言 → B 实时收到', !!gotB, gotB ? ('user=' + gotB.data.msg.user) : '未收到')
  ok('发言回显给 A 自己', A.seen.some(m => m.type === 'room:msg' && m.data.msg.text.includes('这条应该被乙收到')))

  Bc.send({ type: 'typing', room: 'hot:test' })
  await new Promise(r => setTimeout(r, 250))
  ok('typing 广播', A.seen.some(m => m.type === 'room:typing'))

  A.send({ type: 'ai', room: 'hot:test', text: '这个热点里最容易被忽略的反面是什么？' })
  await new Promise(r => setTimeout(r, 22000))
  const aiMsgs = A.seen.filter(m => m.type === 'room:msg' && m.data.msg.kind === 'ai')
  const finalAi = aiMsgs.map(m => m.data.msg).filter(m => m.text !== '正在思考…').pop()
  ok('房间 @AI 回答（广播全房间）', !!finalAi && finalAi.text.length > 5, finalAi ? ('provider=' + finalAi.provider + ' text=' + finalAi.text.slice(0, 40)) : '无')
  A.send({ type: 'leave', room: 'hot:test' })
  await new Promise(r => setTimeout(r, 300))
  ok('离开房间广播', Bc.seen.some(m => m.type === 'room:presence' && m.data.action === 'leave'))
  A.close(); Bc.close()

  console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('TEST CRASH', e); process.exit(2) })
