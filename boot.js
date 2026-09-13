/* ============================================================
   炼知 ReKnow v6.5 · boot.js（在 app.js 之后加载）
   - 把「🌌 炼金宇宙」接入原有视图系统：包一层 showView
   - 懒加载 vendor/three.min.js + universe.js（file:// 也可用）
   - 拆解页顶部注入「📖 原文圈点」入口
   - 天气变化时全局看山换动作
   ============================================================ */
(function () {
  'use strict';
  var THREE_READY = false;
  var UNI_READY = false;
  var pendingEnter = false;

  function loadScript(src, cb, fail) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { cb && cb(); };
    s.onerror = function () { fail && fail(); };
    document.head.appendChild(s);
  }
  function ensureReady(cb) {
    if (window.ReckonUniverse && UNI_READY) { cb && cb(); return; }
    if (THREE_READY) {
      loadScript('universe.js', function () {
        UNI_READY = true;
        try { window.ReckonUniverse.init(); } catch (e) {}
        cb && cb();
      }, function () {
        toastBoot('3D 引擎加载失败：universe.js', false);
        cb && cb();
      });
      return;
    }
    loadScript('vendor/three.min.js', function () {
      THREE_READY = true;
      ensureReady(cb);
    }, function () {
      toastBoot('找不到本地 3D 引擎（vendor/three.min.js）——宇宙视图无法启动，其余功能不受影响。', false);
      cb && cb();
    });
  }
  function toastBoot(msg, good) {
    var w = document.getElementById('toasts');
    if (!w) return;
    var d = document.createElement('div');
    d.style.cssText = 'background:#fff;border:1px solid ' + (good ? '#52c41a' : '#d8dade') + ';box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:12px;padding:9px 18px;font-size:.9rem;display:flex;gap:8px;align-items:center;animation:vin .3s';
    d.innerHTML = (good ? '✅ ' : '· ') + msg;
    w.appendChild(d);
    setTimeout(function () { d.style.transition = 'opacity .5s'; d.style.opacity = '0'; }, 2600);
    setTimeout(function () { d.remove(); }, 3200);
  }

  /* ---------- 1. 包裹 showView：支持 'uni' ---------- */
  var origShowView = window.showView;
  if (typeof origShowView === 'function') {
    window.showView = function (v) {
      var uniShell = document.getElementById('uniShell');
      var vBtnUni = document.getElementById('vBtnUni');
      if (v === 'uni') {
        if (window.S) window.S.view = 'uni';
        if (vBtnUni) {
          ['vBtnHome', 'vBtnMind', 'vBtnLib'].forEach(function (id) {
            var b = document.getElementById(id); if (b) b.classList.remove('on');
          });
          vBtnUni.classList.add('on');
        }
        document.getElementById('uniShell') && (function () {
          ensureReady(function () {
            if (window.ReckonUniverse) window.ReckonUniverse.enter();
          });
        })();
        return;
      }
      // 其他视图：退出宇宙
      if (window.ReckonUniverse) { try { window.ReckonUniverse.exit(); } catch (e) {} }
      if (vBtnUni) vBtnUni.classList.remove('on');
      origShowView(v);
    };
  }

  /* ---------- 2. 顶栏入口 ---------- */
  var vBtn = document.getElementById('vBtnUni');
  if (vBtn) {
    vBtn.addEventListener('click', function () { window.showView('uni'); });
  }
  // 兼容：如果别处直接调用了 enterFlow 但没经过 showView('flow')（不会发生），这里不处理。

  /* ---------- 3. 拆解页顶部：原文圈点入口 ---------- */
  var fhRow = document.querySelector('#view-flow .fh-row1');
  if (fhRow) {
    var btn = document.createElement('button');
    btn.className = 'backlink';
    btn.id = 'flowReadBtn';
    btn.style.cssText = 'margin-left:auto;color:var(--purple);border-color:rgba(124,92,255,.4)';
    btn.innerHTML = '📖 原文圈点';
    btn.title = '知乎问答样式原文 · 3 色高亮 · 旁注批注（自动保存）';
    fhRow.appendChild(btn);
    btn.addEventListener('click', function () {
      var id = window.S && window.S.topicId;
      if (!id) { toastBoot('先选一篇收藏再点开原文哦', false); return; }
      ensureReady(function () {
        if (window.ReckonUniverse) window.ReckonUniverse.openReader(id);
      });
    });
  }

  /* ---------- 4. 天气变化 → 全局看山换动作（v7：六种天气） ---------- */
  window.__rkOnWeather = function (key) {
    var map = { sunny: 'wave', cloudy: 'sway', rain: 'dozing', thunder: 'dribble', snow: 'pc', aurora: 'idle' };
    var img = document.querySelector('#foxBtn img');
    if (img) img.src = 'assets/' + (map[key] || 'idle') + '.gif';
  };

  /* ---------- 5. Esc 关闭宇宙（若阅读器开着则只关阅读器） ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var rd = document.getElementById('uniReader');
    if (rd && rd.classList.contains('on')) return; // reader 自己处理 Esc
    var shell = document.getElementById('uniShell');
    if (shell && shell.classList.contains('on') && window.showView) {
      window.showView('home');
    }
  });

  /* ---------- 6. 空闲预热 3D（让首次进入秒开） ---------- */
  function warmUp() {
    try { ensureReady(function () { /* 预热完成 */ }); } catch (e) {}
  }
  if (document.readyState === 'complete') setTimeout(warmUp, 700);
  else window.addEventListener('load', function () { setTimeout(warmUp, 700); });

  /* ---------- 7. 调试/演示钩子：?auto=uni 自动进宇宙 · ?diag=1 打诊断 ---------- */
  (function () {
    var qs = (location.search || '');
    var errs = [];
    if (qs.indexOf('diag=1') >= 0) {
      window.addEventListener('error', function (e) { errs.push((e && e.message || String(e)).slice(0, 180)); });
      window.addEventListener('unhandledrejection', function (e) { errs.push('rej:' + String(e && e.reason || e).slice(0, 180)); });
      var pre = document.createElement('pre');
      pre.id = 'rkDiag';
      pre.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:999999;color:#9f9;font:11px/1.5 Consolas,monospace;background:rgba(0,0,0,.88);padding:6px 8px;max-width:98vw;white-space:pre-wrap;pointer-events:none;margin:0';
      document.body.appendChild(pre);
      function paint() {
        var U2 = window.ReckonUniverse;
        var d = U2 && U2.diag ? U2.diag() : null;
        var shell = document.getElementById('uniShell');
        var loadT = document.getElementById('uniLoadTxt');
        var rd = document.getElementById('uniReader');
        pre.textContent = 'diag ' + JSON.stringify({
          d: d, shell: shell ? shell.className : '', three: !!window.THREE,
          view: window.S ? window.S.view : '', loadT: loadT ? loadT.textContent : '',
          rdOpen: rd ? rd.classList.contains('on') : false,
          errs: errs.slice(0, 8)
        });
      }
      setInterval(paint, 500); paint();
    }
    if (qs.indexOf('auto=uni') >= 0) {
      setTimeout(function () { if (window.showView) window.showView('uni'); }, 1200);
      /* 截图/取证用：自动切雨夜演示过渡。
         注意：若同时给了 ?wx=<天气>，则不要覆盖（v7：两者会打架，表现为 ?wx=aurora 被 3.2s 后的 rain 顶掉） */
      if (!/[?&]wx=/.test(qs)) {
        setTimeout(function () { if (window.ReckonUniverse && window.ReckonUniverse.setWeather) window.ReckonUniverse.setWeather('rain', true); }, 3200);
      }
    }
  })();
})();
