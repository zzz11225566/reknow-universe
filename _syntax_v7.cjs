/* 四件套 + 后端语法自检
   app.js 是含两代代码的单体（同名函数靠后者声明覆盖前者），node --check 会误报重复声明，
   所以统一用 vm.Script 检查（与项目既有 _syntax_port.cjs 同规格）。
   server.js 是 ESM，用 node --check 单独检。
   用法：node _syntax_v7.cjs */
const fs = require('node:fs')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')

let bad = 0
for (const f of ['app.js', 'universe.js', 'boot.js', 'data.js']) {
  const src = fs.readFileSync(f, 'utf8')
  try { new vm.Script(src, { filename: f }); console.log('OK   ' + f + '  (' + src.length + ' chars)') }
  catch (e) { bad++; console.log('FAIL ' + f + ' :: ' + e.message) }
}
/* index.html：粗查标签闭合与 <script> 引用 */
try {
  const html = fs.readFileSync('index.html', 'utf8')
  const open = (html.match(/<div\b/g) || []).length
  const close = (html.match(/<\/div>/g) || []).length
  const styles = (html.match(/<style\b/g) || []).length === (html.match(/<\/style>/g) || []).length
  const scriptsOk = /src=["']app\.js["']/.test(html) && /src=["']boot\.js["']/.test(html) && /src=["']data\.js["']/.test(html)
  const ok = open === close && styles && scriptsOk
  if (!ok) bad++
  console.log((ok ? 'OK   ' : 'FAIL ') + 'index.html  (div ' + open + '/' + close + ', style 配对=' + styles + ', script 引用=' + scriptsOk + ')')
} catch (e) { bad++; console.log('FAIL index.html :: ' + e.message) }
/* server.js：ESM 语法。
   沙箱内不允许 spawn 带管道的子进程（EPERM），所以优先 node --check，
   失败就退回"剥掉 import/export 后用 vm.Script 检查函数体"的方式。 */
try {
  execFileSync(process.execPath, ['--check', 'server.js'], { stdio: 'pipe' })
  console.log('OK   server.js  (ESM, node --check)')
} catch (e) {
  const msg = String((e && (e.stderr || e.stdout)) || (e && e.message) || '')
  if (/EPERM/.test(msg)) {
    try {
      const src = fs.readFileSync('server.js', 'utf8')
      const body = src
        .replace(/^\s*import\s[^\n]*\n/gm, '')
        .replace(/^\s*export\s+/gm, '')
        .replace(/import\.meta/g, '({url:""})')
      new vm.Script(body, { filename: 'server.js(esm-body)' })
      const imports = (src.match(/^import\s/gm) || []).length
      console.log('OK   server.js  (ESM 函数体校验通过，import 语句 ' + imports + ' 条；本机沙箱禁止 spawn，未能跑 node --check)')
    } catch (e2) { bad++; console.log('FAIL server.js :: ' + e2.message) }
  } else {
    bad++
    console.log('FAIL server.js :: ' + msg.slice(0, 300))
  }
}
process.exit(bad ? 1 : 0)
