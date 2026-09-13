/* 第 4 步验收：无边记白板（静态断言 + jsdom 交互冒烟 + 云端白名单）
   jsdom 无 Canvas 2D 上下文：画笔路径在 jsdom 下静默跳过属预期，仅断言便签与存取逻辑 */
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')
let pass = 0, fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ', name, extra ? ' ' + extra : '') }
  else { fail++; console.log('  FAIL ', name, extra ? ' ' + extra : '') }
}
async function main() {
  console.log('=== 静态断言 ===')
  {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
    ok('白板覆盖层与画布存在', html.indexOf('id="rkBoard"') >= 0 && html.indexOf('id="rkBoardCanvas"') >= 0)
    ok('入口按钮存在', html.indexOf('id="btnBoard"') >= 0)
    ok('board.js 已被引用', /src="board\.js"/.test(html))
    const srv = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8')
    ok('云端白名单含 rkBoard', /'rkBoard'/.test(srv))
    const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8')
    ok('前端同步键含 rkBoard', /"rkBoard"/.test(app))
    const js = fs.readFileSync(path.join(__dirname, 'board.js'), 'utf8')
    ok('平移/缩放/双击新建/画笔/清空齐备', ['wheel', 'dblclick', 'pointerdown', 'rkBoardClear', 'rkBoardPen'].every(function (k) { return js.indexOf(k) >= 0 }))
  }

  console.log('=== jsdom 交互冒烟 ===')
  {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
    const dom = new JSDOM(html, { url: 'http://localhost:8787/', runScripts: 'outside-only', pretendToBeVisual: true })
    const { window } = dom
    window.eval(fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8'))
    window.eval(fs.readFileSync(path.join(__dirname, 'board.js'), 'utf8'))
    await new Promise(function (r) { setTimeout(r, 50) })
    ok('RKBoard 已挂载', !!window.RKBoard)
    /* 新建便签 */
    const n = window.RKBoard.addNote(120, 80, '第一性原理：回到最基本的命题', '#c9e7ff')
    ok('便签入模', n && n.id === 'n1', 'id=' + (n && n.id))
    ok('便签已渲染到 DOM', !!window.document.querySelector('.rk-note'))
    /* 等待防抖保存后读 localStorage */
    await new Promise(function (r) { setTimeout(r, 800) })
    const saved = JSON.parse(window.localStorage.getItem('rkBoard') || 'null')
    ok('自动保存到 rkBoard', saved && saved.notes && saved.notes.length === 1, saved ? 'notes=' + saved.notes.length : '无')
    ok('便签内容持久化', saved && saved.notes[0].text.indexOf('第一性原理') >= 0)
    /* 打开/关闭 */
    window.RKBoard.open()
    ok('打开覆盖层', window.document.getElementById('rkBoard').classList.contains('on'))
    window.document.getElementById('rkBoardClose').dispatchEvent(new window.Event('click'))
    ok('关闭覆盖层', !window.document.getElementById('rkBoard').classList.contains('on'))
  }

  console.log('=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
  process.exit(fail ? 1 : 0)
}
main().catch(function (e) { console.log('TEST CRASH', e); process.exit(1) })
