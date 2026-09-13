/* 第 1 步验收：账户系统 + 云端同步（需先起 node server.js）
   覆盖：注册 / 重名 409 / 弱密码 400 / 错密码 401 / 登录 / me / 数据上下行 / 键白名单 / 无令牌 401 / 健康检查含 auth */
const BASE = 'http://127.0.0.1:8787'
let pass = 0, fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ', name, extra ? ' ' + extra : '') }
  else { fail++; console.log('  FAIL ', name, extra ? ' ' + extra : '') }
}
async function api(p, method, body, token) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = 'Bearer ' + token
  const r = await fetch(BASE + p, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
  return { code: r.status, json: await r.json() }
}
const NAME = '测试员' + Math.floor(Math.random() * 9000 + 1000)

async function main() {
console.log('=== 健康检查含账户信息 ===')
{
  const h = await api('/api/health', 'GET')
  ok('health.auth 存在', h.json.auth && (h.json.auth.storage === 'sqlite' || h.json.auth.storage === 'json'), 'storage=' + (h.json.auth && h.json.auth.storage))
}

console.log('=== 注册 ===')
let TOKEN = null
{
  const bad = await api('/api/auth/register', 'POST', { name: NAME, password: '123' })
  ok('弱密码被拒', bad.code === 400)
  const r = await api('/api/auth/register', 'POST', { name: NAME, password: 'mima-666' })
  ok('注册成功', r.code === 200 && r.json.ok && !!r.json.token, 'name=' + (r.json && r.json.name))
  TOKEN = r.json.token
  const dup = await api('/api/auth/register', 'POST', { name: NAME, password: 'mima-666' })
  ok('重名注册 409', dup.code === 409)
}

console.log('=== 登录 ===')
{
  const wrong = await api('/api/auth/login', 'POST', { name: NAME, password: 'wrong-pass' })
  ok('错密码 401', wrong.code === 401)
  const r = await api('/api/auth/login', 'POST', { name: NAME, password: 'mima-666' })
  ok('登录成功', r.code === 200 && r.json.ok && !!r.json.token)
  TOKEN = r.json.token
  const me = await api('/api/auth/me', 'GET', null, TOKEN)
  ok('me 返回本人', me.code === 200 && me.json.name === NAME)
  const noTok = await api('/api/auth/me', 'GET')
  ok('无令牌 401', noTok.code === 401)
  const badTok = await api('/api/auth/me', 'GET', null, TOKEN.slice(0, -4) + 'ffff')
  ok('篡改令牌 401', badTok.code === 401)
}

console.log('=== 云端数据同步 ===')
{
  const put = await api('/api/me/data', 'POST', { data: { rkSave: { learned: { feynman: true }, xp: 42 }, rkRecipe: { depth: { level: 'deep' } }, hackerKey: { evil: 1 } } }, TOKEN)
  ok('上行保存', put.code === 200 && put.json.ok, 'saved=' + JSON.stringify(put.json.saved))
  ok('白名单拦截未知键', put.json.saved && put.json.saved.indexOf('hackerKey') < 0)
  const get = await api('/api/me/data', 'GET', null, TOKEN)
  ok('下行取回 rkSave', get.json.data && get.json.data.rkSave && get.json.data.rkSave.xp === 42)
  ok('下行取回 rkRecipe', get.json.data && get.json.data.rkRecipe && get.json.data.rkRecipe.depth.level === 'deep')
  ok('未知键未入库', !get.json.data || !get.json.data.hackerKey)
  /* 覆盖写：第二次上行同键应覆盖 */
  await api('/api/me/data', 'POST', { data: { rkSave: { learned: { feynman: true }, xp: 99 } } }, TOKEN)
  const get2 = await api('/api/me/data', 'GET', null, TOKEN)
  ok('同键覆盖写', get2.json.data.rkSave.xp === 99)
  /* 隔离性：另一个用户看不到我的数据 */
  const NAME2 = NAME + '乙'
  const r2 = await api('/api/auth/register', 'POST', { name: NAME2, password: 'mima-666' })
  const get3 = await api('/api/me/data', 'GET', null, r2.json.token)
  ok('用户间数据隔离', !get3.json.data || !get3.json.data.rkSave)
}

console.log('=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
}
main().catch(function (e) { console.log('TEST CRASH', e); process.exit(1) })
