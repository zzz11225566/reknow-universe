/* 第 2.5 步验收：炼金配方系统（需先起 node server.js）
   覆盖：LEVELS 递增曲线 / RKRecipe 模块存在性 / 深挖档注入 debate / BYOK 消毒（SSRF 拦截）/ BYOK 缺参回落默认链 */
const fs = require('fs')
const BASE = 'http://127.0.0.1:8787'
let pass = 0, fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ', name, extra ? ' ' + extra : '') }
  else { fail++; console.log('  FAIL ', name, extra ? ' ' + extra : '') }
}
async function api(p, method, body) {
  const r = await fetch(BASE + p, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return { code: r.status, json: await r.json() }
}
async function main() {
  console.log('=== 前端静态断言 ===')
  {
    const src = fs.readFileSync(__dirname + '/app.js', 'utf8')
    ok('RKRecipe 模块存在', /var RKRecipe = \(function/.test(src))
    ok('配方五维度齐全', ['intake', 'depth', 'pipeline', 'review'].every(function (k) { return src.indexOf(k) >= 0 }) && /ai:\s*\{\s*provider/.test(src))
    ok('流程软关闭包裹存在', /__paintStepsV85/.test(src) && /__renderFlowV85/.test(src))
    ok('本篇小齿轮存在', /rkTopicGear/.test(src))
    ok('复习间隔架存在', /rkReviewDue/.test(src) && /1, 3, 7, 15, 30/.test(src))
    ok('BYOK 注入包裹存在', /__rkPostV85/.test(src))
    /* LEVELS 递增 */
    const m = src.match(/var LEVELS=(\[[^\]]+\])/)
    const LEVELS = eval(m[1])
    let mono = true
    for (let i = 1; i < LEVELS.length; i++) if (LEVELS[i].need <= LEVELS[i - 1].need) mono = false
    ok('LEVELS 严格递增（升级越来越难）', mono && LEVELS.length >= 6, 'needs=' + LEVELS.map(function (l) { return l.need }).join(','))
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8')
    ok('设置页覆盖层存在', html.indexOf('id="ovRecipe"') >= 0 && html.indexOf('id="rcpPipeline"') >= 0)
    ok('配方五区齐全', ['rcpManual', 'rcpDepth', 'rcpPipeline', 'rcpAiProvider', 'rcpReview'].every(function (id) { return html.indexOf(id) >= 0 }))
    ok('导入导出按钮存在', html.indexOf('rcpExport') >= 0 && html.indexOf('rcpImport') >= 0)
  }

  console.log('=== 服务端 ===')
  {
    const d = await api('/api/ai/debate', 'POST', { userText: '讲一遍自然就记住了', topic: { title: '费曼学习法' }, intensity: 'mid', round: 1, depth: 'deep' })
    ok('深挖档 debate 正常返回', d.code === 200 && typeof d.json.reply === 'string' && d.json.reply.length > 10, 'provider=' + (d.json && d.json.provider))
    /* BYOK 消毒：内网地址必须被拦截（回落默认链，provider 不应为 custom） */
    const ssrf = await api('/api/ai/chat', 'POST', { messages: [{ role: 'user', content: 'hi' }], ai: { baseUrl: 'http://127.0.0.1:9/x', key: 'sk-test', model: 'x' } })
    ok('SSRF 内网地址被拦截', ssrf.code === 200 && ssrf.json.provider !== 'custom', 'provider=' + (ssrf.json && ssrf.json.provider))
    /* BYOK 缺 baseUrl：同样回落默认链 */
    const noBase = await api('/api/ai/chat', 'POST', { messages: [{ role: 'user', content: 'hi' }], ai: { key: 'sk-test' } })
    ok('缺 baseUrl 回落默认链', noBase.code === 200 && noBase.json.provider !== 'custom')
  }

  console.log('=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
  process.exit(fail ? 1 : 0)
}
main().catch(function (e) { console.log('TEST CRASH', e); process.exit(1) })
