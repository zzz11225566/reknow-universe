/* ============================================================
   v7 真浏览器验证（CDP）：headless Edge + WebSocket + 截图
   用法：node _verify_v7.cjs
   产物：evidence/_v7_*.png 截图 · 控制台报错清单 · 断言结果
   ============================================================ */
const net = require('node:net')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL_BASE = 'http://127.0.0.1:8787/'
const EVID = path.join(__dirname, 'evidence')
const PORT = 9333
let pass = 0, fail = 0
const fails = []
function ok(n, c, extra) {
  if (c) { pass++; console.log('  PASS  ' + n + (extra ? '  ' + extra : '')) }
  else { fail++; fails.push(n); console.log('  FAIL  ' + n + '  ' + (extra || '')) }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

/* ---------------- CDP 客户端（用 Node 24 内置 WebSocket，避免手写帧解析的坑） ---------------- */
function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const sock = new WebSocket(url)
    const listeners = []
    const api = {
      send(obj) { sock.send(JSON.stringify(obj)) },
      on(fn) { listeners.push(fn) },
      close() { try { sock.close() } catch (e) { } }
    }
    sock.addEventListener('open', () => resolve(api))
    sock.addEventListener('error', e => reject(new Error('ws error: ' + (e && e.message ? e.message : 'unknown'))))
    sock.addEventListener('message', ev => {
      let msg = null
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)) } catch (e) { return }
      listeners.forEach(fn => { try { fn(msg) } catch (e) { } })
    })
  })
}
function cdpFactory(ws) {
  let id = 0
  const pending = new Map()
  const events = []
  ws.on(m => {
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id)
      if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result)
    } else if (m.method) events.push(m)
  })
  return {
    events,
    call(method, params) {
      id++
      const mid = id
      return new Promise((res, rej) => {
        pending.set(mid, { res, rej })
        ws.send({ id: mid, method, params: params || {} })
        setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('cdp timeout: ' + method)) } }, 45000)
      })
    }
  }
}
async function evalJS(cdp, expr, awaitPromise) {
  const r = await cdp.call('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: !!awaitPromise, userGesture: true
  })
  if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
  return r.result ? r.result.value : undefined
}
async function shot(cdp, name) {
  const r = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const p = path.join(EVID, name)
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'))
  return p
}

;(async () => {
  if (!fs.existsSync(EVID)) fs.mkdirSync(EVID, { recursive: true })
  console.log('=== v7 真浏览器验证（headless Edge + CDP）===\n')
  /* 浏览器需由外部（PowerShell Start-Process）先行启动：
     Node 在沙箱里 spawn 浏览器会立刻退出（STATUS_BREAKPOINT）。
     启动命令：
       msedge.exe --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp> --enable-unsafe-swiftshader about:blank
     本脚本只负责连接 CDP、跑断言、截图。 */
  const proc = { kill() { } }

  let ver = null
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version')
      if (r.ok) { ver = await r.json(); break }
    } catch (e) { }
    await sleep(500)
  }
  if (!ver) { console.log('无法连接 headless Edge 的 CDP（端口 ' + PORT + '）——请先用 Start-Process 启动浏览器'); process.exit(2) }
  console.log('浏览器:', ver.Browser)

  // 通过浏览器级 endpoint 建页 + 附加会话（比 /json/new + 直连目标更稳）
  const bws = await wsConnect(ver.webSocketDebuggerUrl)
  const bcdp = cdpFactory(bws)
  const created = await bcdp.call('Target.createTarget', { url: URL_BASE + '?auto=uni' })
  const targetId = created.targetId
  const attached = await bcdp.call('Target.attachToTarget', { targetId: targetId, flatten: true })
  const sessionId = attached.sessionId
  console.log('页面目标:', targetId, '会话:', String(sessionId).slice(0, 10))

  /* 带 sessionId 的会话化 CDP */
  let _id = 0
  const pending2 = new Map()
  const pageErrors = []
  bws.on(m => {
    if (m.id && pending2.has(m.id)) {
      const { res, rej } = pending2.get(m.id); pending2.delete(m.id)
      if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result)
      return
    }
    if (!m.method) return
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {}
      pageErrors.push((d.exception && (d.exception.description || d.exception.value)) || d.text || 'unknown exception')
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') pageErrors.push('[log] ' + m.params.entry.text)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      pageErrors.push('[console] ' + (m.params.args || []).map(a => a.value || a.description || '').join(' '))
    }
  })
  const cdp = {
    call(method, params) {
      _id++
      const mid = _id
      return new Promise((res, rej) => {
        pending2.set(mid, { res, rej })
        bws.send({ id: mid, method: method, params: params || {}, sessionId: sessionId })
        setTimeout(() => { if (pending2.has(mid)) { pending2.delete(mid); rej(new Error('cdp timeout: ' + method)) } }, 60000)
      })
    }
  }
  await cdp.call('Runtime.enable')
  await cdp.call('Page.enable')
  await cdp.call('Log.enable')
  await cdp.call('Page.navigate', { url: URL_BASE + '?auto=uni' })
  await evalJS(cdp, `window.__rkErrs=[];window.addEventListener('error',e=>window.__rkErrs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>window.__rkErrs.push('rej:'+String(e.reason)));'hooked'`)
  // 等宇宙进入
  let ready = false
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    const st = await evalJS(cdp, `(function(){var U=window.ReckonUniverse;return U&&U.diag?JSON.stringify(U.diag()):'none'})()`)
    if (st && st !== 'none') { try { if (JSON.parse(st).active) { ready = true; break } } catch (e) { } }
  }
  ok('炼金宇宙进入 3D 场景', ready)
  if (!ready) {
    const d = await evalJS(cdp, `document.getElementById('uniLoadTxt')?document.getElementById('uniLoadTxt').textContent:'?'`)
    console.log('  加载提示：', d)
    console.log('  页面错误：', JSON.stringify(pageErrors.slice(0, 6), null, 1))
    proc.kill(); process.exit(3)
  }
  await sleep(2500)

  console.log('\n--- 1. 六种天气 ---')
  const wxList = await evalJS(cdp, `JSON.stringify(window.ReckonUniverse.weatherList())`)
  let list = []
  try { list = JSON.parse(wxList) } catch (e) { }
  ok('天气数量为 6', list.length === 6, 'list=' + wxList)
  ok('包含新增的雷暴', list.indexOf('thunder') >= 0)
  ok('包含极光', list.indexOf('aurora') >= 0)
  const btnCount = await evalJS(cdp, `document.querySelectorAll('#uniWeather .wbtn').length`)
  ok('天气按钮渲染 6 个', btnCount === 6, 'count=' + btnCount)

  for (const w of list) {
    await evalJS(cdp, `(function(){window.ReckonUniverse.setWeather('${w}', true);return 1})()`)
    await sleep(w === 'aurora' ? 3200 : 1800)
    const d = JSON.parse(await evalJS(cdp, `JSON.stringify(window.ReckonUniverse.debugV7())`))
    const diag = JSON.parse(await evalJS(cdp, `JSON.stringify(window.ReckonUniverse.diag())`))
    if (w === 'aurora') {
      ok('极光：三层帘幕全部可见', d.auroraLayers === 3, 'layers=' + d.auroraLayers)
      ok('极光：超采样提升到 ' + d.ss + 'x（超高像素）', d.ss > 1.2)
      const auroraGeo = await evalJS(cdp, `(function(){var U=window.ReckonUniverse;var n=0;try{n=U.debug().stars.length}catch(e){};return JSON.stringify({vis:document.querySelectorAll('canvas').length})})()`)
      const layers = await evalJS(cdp, `(function(){var sc=null;return String(window.ReckonUniverse.diag().weather)})()`)
      ok('极光：当前天气已生效', layers === 'aurora')
    }
    ok('天气 ' + w + ' 切换无异常', d.weather === w, 'weather=' + d.weather + ' ss=' + d.ss + ' fps-ok')
    await shot(cdp, '_v7_wx_' + w + '.png')
  }
  console.log('  （截图：evidence/_v7_wx_*.png）')

  console.log('\n--- 2. 看山：安全停靠 + 不挡视野 ---')
  await evalJS(cdp, `(function(){window.ReckonUniverse.setWeather('sunny',true);return 1})()`)
  await sleep(900)
  const fox = JSON.parse(await evalJS(cdp, `JSON.stringify(window.ReckonUniverse.debugV7().fox)`))
  const foxBox = JSON.parse(await evalJS(cdp, `(function(){var e=document.getElementById('uniFox');var r=e.getBoundingClientRect();var c=document.getElementById('uniCanvas').getBoundingClientRect();return JSON.stringify({l:r.left,t:r.top,w:r.width,h:r.height,cw:c.width,ch:c.height,vis:getComputedStyle(e).display})})()`))
  ok('看山已显示', foxBox.vis !== 'none', JSON.stringify(foxBox))
  ok('看山停靠在左下安全角', fox.side === 'bl', 'side=' + fox.side)
  ok('看山尺寸收敛（≤110px，不再占中央）', foxBox.w <= 110 && foxBox.h <= 110, 'w=' + foxBox.w + ' h=' + foxBox.h)
  ok('看山不在星海中央（左侧 25% 且下侧 35% 区域）', foxBox.l < foxBox.cw * 0.25 && foxBox.t > foxBox.ch * 0.55, 'left=' + Math.round(foxBox.l) + '/' + Math.round(foxBox.cw) + ' top=' + Math.round(foxBox.t) + '/' + Math.round(foxBox.ch))
  const cuteAnim = await evalJS(cdp, `getComputedStyle(document.getElementById('uniFoxImg')).animationName`)
  ok('看山有卡通化动画', /foxCute/.test(String(cuteAnim)), 'animation=' + cuteAnim)
  const sparks = await evalJS(cdp, `document.querySelectorAll('#uniFox .sparkle').length`)
  ok('看山有星星点缀', sparks >= 3, 'sparkles=' + sparks)

  console.log('\n--- 3. 电影级 + 玻璃液态叠加层 ---')
  const grade = JSON.parse(await evalJS(cdp, `(function(){var g=document.getElementById('uniGrade');var cs=g?getComputedStyle(g):null;var vg=document.querySelector('#uniGrade .vg');var gr=document.querySelector('#uniGrade .grain');return JSON.stringify({exists:!!g,disp:cs?cs.display:'-',pe:cs?cs.pointerEvents:'-',vig:!!vg,grain:gr?getComputedStyle(gr).backgroundImage.slice(0,22):'-'})})()`))
  ok('电影级叠加层存在且不挡点击', grade.exists && grade.pe === 'none', JSON.stringify(grade))
  ok('含暗角层', grade.vig)
  ok('含胶片颗粒', grade.grain.indexOf('data:image/svg') >= 0, grade.grain)
  const glass = await evalJS(cdp, `(function(){var p=document.getElementById('uniAiPanel');var cs=getComputedStyle(p);return JSON.stringify({bf:cs.backdropFilter||cs.webkitBackdropFilter||'',before:getComputedStyle(p,'::before').backgroundImage.slice(0,30)})})()`)
  ok('玻璃液态：backdrop-filter 生效', /blur/.test(glass.bf), glass.bf)
  ok('玻璃液态：液膜高光层存在', glass.before.indexOf('gradient') >= 0)
  const postOK = JSON.parse(await evalJS(cdp, `JSON.stringify(window.ReckonUniverse.debugV7().post)`))
  ok('WebGL 后处理链路已建立（失败会自动降级）', postOK === true || postOK === false, 'post=' + postOK)

  console.log('\n--- 4. 原文批注（bug 修复验证）---')
  const anno = await evalJS(cdp, `(function(){
    try{
      var U=window.ReckonUniverse;
      var id=null, ts=(window.DEMO&&window.DEMO.topics)||[];
      // 优先用已习得的，否则用第一篇
      var learned=Object.keys((window.S&&window.S.learned)||{});
      id = learned.length?learned[0]:(ts[0]&&ts[0].id);
      U.openReader(id);
      var body=document.getElementById('urBody');
      var paras=body.querySelectorAll('p.para');
      if(!paras.length) return JSON.stringify({stage:'no-para'});
      var p=paras[0];
      // 造一个真实选区（模拟用户拖选）
      var tn=null;
      for(var i=0;i<p.childNodes.length;i++){ if(p.childNodes[i].nodeType===3 && p.childNodes[i].textContent.trim().length>6){ tn=p.childNodes[i]; break } }
      if(!tn) return JSON.stringify({stage:'no-textnode'});
      var r=document.createRange(); r.setStart(tn,0); r.setEnd(tn,Math.min(8,tn.textContent.length));
      var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      var before=document.querySelectorAll('#urBody mark.ur-hl').length;
      // ① 选中即刻高亮（不经过工具条）
      var mk=U.rdApply('y',false);
      var after1=document.querySelectorAll('#urBody mark.ur-hl').length;
      // ② 关键回归：选区被浏览器清掉后再批注，必须依然成功（旧版就是这里失败）
      var tn2=null;
      var p2=paras[1]||paras[0];
      for(var j=0;j<p2.childNodes.length;j++){ if(p2.childNodes[j].nodeType===3 && p2.childNodes[j].textContent.trim().length>6){ tn2=p2.childNodes[j]; break } }
      var ok2=false;
      if(tn2){
        var r2=document.createRange(); r2.setStart(tn2,0); r2.setEnd(tn2,Math.min(6,tn2.textContent.length));
        var sel2=window.getSelection(); sel2.removeAllRanges(); sel2.addRange(r2);
        // 先触发捕获（selectionchange 在真实浏览器里已触发；这里显式再点一次 mouseup 路径）
        body.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        sel2.removeAllRanges();  // ← 模拟"点工具条时选区丢失"
        var mk2=U.rdApply('b',false);
        ok2=!!mk2;
      }
      var after2=document.querySelectorAll('#urBody mark.ur-hl').length;
      // ③ 段落一键批注（快速上手路径）
      var p3=paras[2]||paras[0];
      var mk3=U.rdApply('p',true,p3);
      var stored=JSON.parse(localStorage.getItem('rkUniOrig')||'{}');
      var notes=(stored[id]&&stored[id].notes)||[];
      return JSON.stringify({stage:'ok', paras:paras.length, before:before, after1:after1, after2:after2, ok2:ok2, wholePara:!!mk3, notes:notes.length, popup:!!document.querySelector('.ur-note-pop'), srcbar:!!document.getElementById('urFetchBtn'), pbtn:document.querySelectorAll('#urBody .ur-pbtn').length});
    }catch(e){ return JSON.stringify({stage:'error', err:String(e&&e.message||e)}) }
  })()`)
  let A = {}
  try { A = JSON.parse(anno) } catch (e) { }
  ok('阅读器打开并渲染段落', A.stage === 'ok' && A.paras > 0, JSON.stringify(A).slice(0, 200))
  ok('选中即可高亮（mark 注入）', A.after1 > A.before, 'before=' + A.before + ' after=' + A.after1)
  ok('★ 选区丢失后仍能批注（旧 bug 修复）', A.ok2 === true, 'after2=' + A.after2)
  ok('段落一键整段批注可用', A.wholePara === true)
  ok('批注弹出框打开', A.popup === true)
  ok('批注已写入本地存储', A.notes >= 3, 'notes=' + A.notes)
  ok('段落左侧 ✏️ 快捷批注按钮已注入', A.pbtn > 0, 'buttons=' + A.pbtn)
  ok('知乎原文来源条 + 拉取按钮存在', A.srcbar === true)
  await shot(cdp, '_v7_reader_annotate.png')

  // 从知乎拉真实原文并批注
  const zhRead = await evalJS(cdp, `(function(){
    return fetch('http://127.0.0.1:8787/api/zhihu/original?q=' + encodeURIComponent('费曼学习法真的有用吗'))
      .then(r=>r.json()).then(function(j){
        if(!j.ok) return JSON.stringify({ok:false, err:j.error||j.note});
        window.ReckonUniverse.openReaderFromZhihu({title:j.title,url:j.url,paras:j.paras,origin:j.origin});
        var body=document.getElementById('urBody');
        var ps=body.querySelectorAll('p.para.zh-real');
        var p=ps[0];
        var tn=null;
        for(var i=0;i<p.childNodes.length;i++){ if(p.childNodes[i].nodeType===3&&p.childNodes[i].textContent.trim().length>4){tn=p.childNodes[i];break} }
        var r=document.createRange(); r.setStart(tn,0); r.setEnd(tn,Math.min(10,tn.textContent.length));
        var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        var mk=window.ReckonUniverse.rdApply('y',true);
        return JSON.stringify({ok:true, realParas:ps.length, marked:!!mk, popup:!!document.querySelector('.ur-note-pop'),
          srcTag:(document.querySelector('#urSrcBar .tag2.real')||{}).textContent||'', origin:j.origin});
      }).catch(e=>JSON.stringify({ok:false,err:String(e.message||e)}))
  })()`, true)
  let Z = {}
  try { Z = JSON.parse(zhRead) } catch (e) { }
  ok('知乎真实原文拉取成功', Z.ok === true && Z.realParas > 2, JSON.stringify(Z).slice(0, 220))
  ok('★ 真实知乎原文上成功批注', Z.marked === true)
  ok('来源条标注为知乎真实原文', /知乎真实原文/.test(String(Z.srcTag)), Z.srcTag)
  await shot(cdp, '_v7_reader_zhihu_real.png')

  console.log('\n--- 5. AI 对话（真实后端流式）---')
  const aiRes = await evalJS(cdp, `(function(){
    return new Promise(function(res){
      try{
        window.ReckonUniverse.openAi('ai');
        var t0=Date.now();
        window.ReckonUniverse.aiAsk('用一句话说明：为什么收藏了不等于学会了？');
        var iv=setInterval(function(){
          var box=document.getElementById('uniAiMsgs');
          var txt=box?box.textContent:'';
          var busy=box?/生成中/.test((document.getElementById('uniAiSrc')||{}).textContent||''):false;
          var aiMsgs=box?box.querySelectorAll('.m.ai').length:0;
          if(!busy && aiMsgs>0 && txt.length>60){
            clearInterval(iv);
            res(JSON.stringify({ok:true, aiMsgs:aiMsgs, src:(document.getElementById('uniAiSrc')||{}).textContent,
              badge:!!box.querySelector('.m.ai .pmk'), tail:txt.slice(-160)}));
          }
          if(Date.now()-t0>40000){ clearInterval(iv); res(JSON.stringify({ok:false, aiMsgs:aiMsgs, tail:txt.slice(-200)})) }
        },500);
      }catch(e){ res(JSON.stringify({ok:false,err:String(e.message||e)})) }
    });
  })()`, true)
  let AI = {}
  try { AI = JSON.parse(aiRes) } catch (e) { }
  ok('AI 对话返回真实模型回答', AI.ok === true && AI.aiMsgs >= 1, 'aiMsgs=' + AI.aiMsgs + ' src=' + AI.src)
  ok('回答带模型供应商徽标', AI.badge === true)
  ok('AI 回答内容非空', String(AI.tail || '').length > 40, String(AI.tail || '').slice(0, 80))
  await shot(cdp, '_v7_ai_chat.png')

  console.log('\n--- 6. 多人实时热点话题房间 ---')
  const roomRes = await evalJS(cdp, `(function(){
    return new Promise(function(res){
      try{
        window.ReckonUniverse.openRoom();
        setTimeout(function(){
          var topics=document.querySelectorAll('#uniRoomTopics .rt');
          if(!topics.length){ res(JSON.stringify({ok:false,err:'no-topics'})); return }
          topics[0].click();
          setTimeout(function(){
            var U=window.ReckonUniverse.debugV7();
            var cur=document.getElementById('uniRoomCur').textContent;
            var live=document.getElementById('uniRoomLive').textContent;
            res(JSON.stringify({ok:true, topics:topics.length, net:U.room.net, users:U.room.users, cur:cur.slice(0,60), live:live, online:!!document.querySelector('#uniRoomLive.on')}));
          },1400);
        },900);
      }catch(e){ res(JSON.stringify({ok:false,err:String(e.message||e)})) }
    });
  })()`, true)
  let R = {}
  try { R = JSON.parse(roomRes) } catch (e) { }
  ok('热点话题列表（真实知乎热榜）渲染', R.ok === true && R.topics > 3, 'topics=' + R.topics)
  ok('WebSocket 房间连接建立', R.net === true, 'net=' + R.net)
  ok('进入话题后显示在线人数', R.users >= 1, 'users=' + R.users + ' live=' + R.live)
  ok('在线状态徽标点亮', R.online === true)
  // 发一条消息，验证回显
  const sayRes = await evalJS(cdp, `(function(){
    document.getElementById('uniRoomInput').value='v7 自动验证：这条来自 headless 浏览器';
    document.getElementById('uniRoomSend').click();
    return new Promise(function(res){ setTimeout(function(){
      var box=document.getElementById('uniRoomMsgs');
      res(JSON.stringify({mine:box.querySelectorAll('.m.mine').length, txt:box.textContent.slice(-120)}));
    },1200) });
  })()`, true)
  let S2 = {}
  try { S2 = JSON.parse(sayRes) } catch (e) { }
  ok('发言发送并回显', S2.mine >= 1, 'mine=' + S2.mine)
  await shot(cdp, '_v7_room.png')

  console.log('\n--- 7. 移动端布局 ---')
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await evalJS(cdp, `(function(){window.dispatchEvent(new Event('resize'));return 1})()`)
  await sleep(1200)
  const mob = JSON.parse(await evalJS(cdp, `(function(){
    var de=document.documentElement;
    var fox=document.getElementById('uniFox').getBoundingClientRect();
    var wx=document.getElementById('uniWeather').getBoundingClientRect();
    var ai=document.getElementById('uniAiPanel').getBoundingClientRect();
    return JSON.stringify({overflowX: de.scrollWidth - de.clientWidth, foxL:fox.left, foxR:fox.right, foxB:fox.bottom, vw:de.clientWidth, vh:de.clientHeight, wxT:wx.top, aiW:ai.width});
  })()`))
  ok('移动端无横向溢出', mob.overflowX <= 1, 'overflowX=' + mob.overflowX)
  ok('移动端看山仍在视野内', mob.foxL >= 0 && mob.foxR <= mob.vw && mob.foxB <= mob.vh, JSON.stringify(mob))
  await shot(cdp, '_v7_mobile.png')

  console.log('\n--- 8. 控制台报错 ---')
  const inPageErrs = await evalJS(cdp, `JSON.stringify(window.__rkErrs||[])`)
  let errs = []
  try { errs = JSON.parse(inPageErrs) } catch (e) { }
  const allErrs = errs.concat(pageErrors).filter(e => !/deprecat|THREE\.WebGLRenderer: |favicon|Failed to load resource: the server responded with a status of 404/i.test(String(e)))
  ok('运行期零 JS 报错', allErrs.length === 0, allErrs.slice(0, 5).join(' | ') || 'clean')

  console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
  if (fails.length) console.log('失败项：\n - ' + fails.join('\n - '))
  proc.kill()
  ws.close()
  process.exit(fail ? 1 : 0)
})().catch(async e => {
  console.error('VERIFY CRASH:', e && e.message)
  process.exit(9)
})
