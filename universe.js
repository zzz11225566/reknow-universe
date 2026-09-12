/* ============================================================
   炼知 ReKnow v6.5 · 炼金宇宙（沉浸式 3D）
   - 知识星体（主题）/ 炼金链路 / 底部 CSS 炉火（熔炉核心）/ 看山动画
   - 5 种天气一键切换，1.5s 平滑过渡（光影/雾/粒子/背景）
   - 真实时间 + （可选）后端实时天气 → 场景自动联动
   - 热榜面板 / 全站搜索 / 星体卡 → 进入学习流
   - 原文阅读器：知乎问答样式正文 + 3 色高亮 + 旁注批注 + 本地恢复
   依赖：vendor/three.min.js（经典 script，无构建、无 CDN、file:// 可跑）
   ============================================================ */
(function () {
  'use strict';
  var U = (window.ReckonUniverse = {});
  var T = (typeof window !== 'undefined' && window.THREE) || null; // THREE：加载时即捕获（boot 保证先加载 three），init 再兜底注入
  var ok = false; // WebGL 是否可用
  var ready = false;

  /* ---------------- 基础工具 ---------------- */
  function byId(id) { return document.getElementById(id); }
  function now() { return Date.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function S() { return window.S || {}; }
  function DEMO() { return window.DEMO || { themes: [], topics: [], custom: [] }; }
  function themeOf(cat) {
    var list = DEMO().themes || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === cat) return list[i];
    return list[0] || { id: 'x', name: '主题', icon: '📚', color: '#5b6ef5' };
  }
  function allTopics() {
    var d = DEMO();
    return (d.topics || []).concat(d.custom || []);
  }
  /* A3：点亮口径统一为 learned-only（只有 S.learned 才进星海/已习得；S.records 不再单独计入） */
  function uniLearnableTopics() {
    var s = S() || {}, L = s.learned || {};
    return allTopics().filter(function (t) { return !!L[t.id]; });
  }
  function topicById(id) {
    var list = allTopics();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function fmtV(n) {
    n = n || 0;
    return n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  }
  function trimCJK(s, n) {
    s = s || '';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function loadLS(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); if (v !== null && v !== undefined) return v; } catch (e) {} return fb; }
  function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function learnedCount() {
    var s = S();
    return s && s.learned ? Object.keys(s.learned).length : 0;
  }
  function storeGet(key, fb) { var u = loadLS('rkUni6', null); return (u && u[key] !== undefined) ? u[key] : fb; }
  function storeSet(key, val) { var u = loadLS('rkUni6', {}) || {}; u[key] = val; saveLS('rkUni6', u); }

  /* ---------------- 轻音效（不依赖 app 内部 sfx） ---------------- */
  var AC = null;
  function uniSfx(kind) {
    var s = S();
    if (s && s.sound === false) return;
    try {
      AC = AC || (window.AudioContext || window.webkitAudioContext) && new (window.AudioContext || window.webkitAudioContext)();
      if (!AC) return;
      var t0 = AC.currentTime;
      function tone(f, d, type, g, dt) {
        var o = AC.createOscillator(), gn = AC.createGain();
        o.type = type || 'sine';
        o.frequency.value = f;
        dt = dt || 0;
        gn.gain.setValueAtTime(0.0001, t0 + dt);
        gn.gain.exponentialRampToValueAtTime(g || 0.06, t0 + dt + 0.012);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + d);
        o.connect(gn); gn.connect(AC.destination);
        o.start(t0 + dt); o.stop(t0 + dt + d + 0.05);
      }
      if (kind === 'weather') { tone(520, 0.16, 'triangle', 0.05); tone(780, 0.22, 'triangle', 0.05, 0.09); }
      else if (kind === 'open') { tone(660, 0.12, 'sine', 0.045); tone(990, 0.16, 'sine', 0.04, 0.08); }
      else if (kind === 'close') { tone(500, 0.1, 'sine', 0.04); }
      else if (kind === 'pick') { tone(880, 0.09, 'triangle', 0.05); }
      else if (kind === 'note') { tone(760, 0.1, 'triangle', 0.05); tone(1140, 0.14, 'triangle', 0.04, 0.06); }
      else if (kind === 'birth') { tone(523, 0.18, 'sine', 0.05); tone(784, 0.24, 'sine', 0.045, 0.1); }
      else if (kind === 'land') { tone(1568, 0.22, 'triangle', 0.055); tone(2093, 0.34, 'sine', 0.028, 0.07); } // E3：落位「叮」+ 短混响尾音
    } catch (e) {}
  }

  /* ---------------- D1：天气氛围音（雨 / 雪轻噪声循环，AudioBuffer 白噪声 + 低通 + 缓慢 gain 起伏） ---------------- */
  var AMB = { rain: null, snow: null, muted: false, lastKey: null };
  function ambKindOf(key) { return key === 'rain' ? 'rain' : key === 'snow' ? 'snow' : null; }
  function ambEnsure(kind) {
    if (AMB[kind]) return AMB[kind];
    var ACc = AC || ((window.AudioContext || window.webkitAudioContext) && new (window.AudioContext || window.webkitAudioContext)());
    if (!ACc) return null;
    AC = ACc;
    var dur = 2.0, buf = ACc.createBuffer(1, ACc.sampleRate * dur, ACc.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var src = ACc.createBufferSource();
    src.buffer = buf; src.loop = true;
    var filt = ACc.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = kind === 'rain' ? 1600 : 750; // 雨偏清脆、雪偏闷
    var g = ACc.createGain();
    g.gain.value = 0.0001;
    // 缓慢 gain 起伏（0.07–0.13Hz 正弦轻调制，幅度克制）
    var lfo = ACc.createOscillator();
    lfo.frequency.value = kind === 'rain' ? 0.11 : 0.07;
    var lfoG = ACc.createGain();
    lfoG.gain.value = kind === 'rain' ? 0.008 : 0.006;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(filt); filt.connect(g); g.connect(ACc.destination);
    src.start(); lfo.start();
    AMB[kind] = { src: src, gain: g, target: 0.0001, max: kind === 'rain' ? 0.035 : 0.028 };
    return AMB[kind];
  }
  /* 音量变化统一走 setTargetAtTime 指向最终目标（幂等，不在每帧堆叠移动目标） */
  function ambApply(a, tau) {
    if (!a || !AC) return;
    var tgt = AMB.muted ? 0.0001 : a.target;
    try { a.gain.gain.setTargetAtTime(tgt, AC.currentTime, tau || 0.25); } catch (e) {}
  }
  function ambSetWeather(key) {
    AMB.lastKey = key;
    var want = ambKindOf(key);
    var kinds = ['rain', 'snow'];
    for (var i = 0; i < kinds.length; i++) {
      var k = kinds[i], a = ambEnsure(k);
      if (!a) continue;
      a.target = (k === want) ? a.max : 0.0001;
      ambApply(a, 0.25); // 淡入淡出 ~1s 量级
    }
    if (want && AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
  }
  /* 尊重全局静音开关：tick 里节流检查 S().sound === false → 立即无声 */
  var ambCheckT = 0;
  function ambTickCheck(t) {
    if (t - ambCheckT < 0.5) return;
    ambCheckT = t;
    var muted = !!(S() && S().sound === false);
    if (muted !== AMB.muted) {
      AMB.muted = muted;
      ambApply(AMB.rain, muted ? 0.03 : 0.25); // 静音立即停
      ambApply(AMB.snow, muted ? 0.03 : 0.25);
    }
  }

  /* ================================================================
     天气预设：数字目标（颜色=十六进制；lerp 逐帧趋近 → ~1.5s 过渡）
     ================================================================ */
  var WEATHERS = {
    sunny: {
      name: '晴天', ico: '☀️',
      skyTop: 0x0a1836, skyBot: 0x1a3358, fog: 0x101f3c, fogD: 0.03,
      ambC: 0x9db8ff, ambI: 0.5, hemiI: 0.55,
      dirC: 0xffe3b0, dirI: 1.25, dirH: 0.75,
      glowC: 0xffc46a, glowI: 0.5,
      starO: 0.55, dustO: 0.8, dustS: 1.0, aurA: 0, aurSp: 0,
      rainA: 0, snowA: 0, fox: 'wave', foxS: 1.0
    },
    cloudy: {
      name: '多云', ico: '🌤️',
      skyTop: 0x2b3a5e, skyBot: 0x8fa8c8, fog: 0x4a5b78, fogD: 0.05,
      ambC: 0xaebfd8, ambI: 0.42, hemiI: 0.5,
      dirC: 0xe8ecf5, dirI: 0.8, dirH: 0.6,
      glowC: 0xbfd4ff, glowI: 0.32,
      starO: 0.4, dustO: 0.6, dustS: 0.8, aurA: 0, aurSp: 0,
      rainA: 0, snowA: 0, fox: 'sway', foxS: 0.85
    },
    rain: {
      name: '雨夜', ico: '🌧️',
      skyTop: 0x0a1226, skyBot: 0x233a5e, fog: 0x12203c, fogD: 0.085,
      ambC: 0x5a7cff, ambI: 0.22, hemiI: 0.3,
      dirC: 0x7d9dff, dirI: 0.42, dirH: 0.2,
      glowC: 0x5b6ef5, glowI: 0.5,
      starO: 0.9, dustO: 0.45, dustS: 1.9, aurA: 0, aurSp: 0,
      rainA: 1, snowA: 0, fox: 'dozing', foxS: 0.55
    },
    snow: {
      name: '雪夜', ico: '❄️',
      skyTop: 0x10182e, skyBot: 0x4d6a8f, fog: 0x22344e, fogD: 0.06,
      ambC: 0xcfe0ff, ambI: 0.34, hemiI: 0.45,
      dirC: 0xdfeeff, dirI: 0.62, dirH: 0.4,
      glowC: 0xbfe3ff, glowI: 0.35,
      starO: 0.8, dustO: 0.55, dustS: 0.55, aurA: 0, aurSp: 0,
      rainA: 0, snowA: 1, fox: 'pc', foxS: 0.7
    },
    aurora: {
      name: '极光', ico: '🌌',
      skyTop: 0x061024, skyBot: 0x1d3a34, fog: 0x0d2030, fogD: 0.035,
      ambC: 0x86ffc8, ambI: 0.3, hemiI: 0.42,
      dirC: 0x9ef6d0, dirI: 0.45, dirH: 0.3,
      glowC: 0x56e0a0, glowI: 0.6,
      starO: 0.95, dustO: 0.7, dustS: 0.7, aurA: 1, aurSp: 1,
      rainA: 0, snowA: 0, fox: 'idle', foxS: 0.9
    }
  };
  var WEATHER_ORDER = ['sunny', 'cloudy', 'rain', 'snow', 'aurora'];
  var WEATHER_STORE_KEY = 'weather';
  /* B2：手动天气优先 —— followLive=true 时跟随后端 WS 推送；手动点过天气按钮后进入手动模式 */
  var followLive = storeGet('followLive', true);
  var liveHint = '', liveHintShown = false; // 手动模式下 WS 推送不同天气时的 HUD 一次性提示

  // 时段（真实时间驱动）
  function todOfHour(h) {
    if (h >= 5 && h < 8) return { k: 0.72, warm: 0x8f7a5a, label: '🌅 黎明' };
    if (h >= 8 && h < 17) return { k: 1.0, warm: 0xffffff, label: '☀️ 白昼' };
    if (h >= 17 && h < 20) return { k: 0.68, warm: 0xd9a066, label: '🌇 黄昏' };
    return { k: 0.42, warm: 0x7790c4, label: '🌙 深夜' };
  }
  function currentHour() {
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  /* ---------------- 运行时环境状态（tween 目标） ---------------- */
  var ENV = {
    active: {}, // 由 setWeather 生成 {weather, todK, warm, server}
    skyTop: null, skyBot: null, fogC: null, fogD: 0.05,
    ambC: null, ambI: 0, hemiI: 0, dirC: null, dirI: 0, dirH: 0,
    glowC: null, glowI: 0, starO: 0, dustO: 0, dustS: 1,
    aurA: 0, aurSp: 0, rainA: 0, snowA: 0,
    cur: null, foxGif: 'wave', foxS: 1
  };
  // 平滑因子：tau≈0.5 → ~1.5s 到 95%
  var lastTodKey = '';
  function envFrame(dt) {
    var w = ENV.active.w || WEATHERS.sunny;
    var tod = todOfHour(currentHour());
    if (ENV.active.freezeTod) { } // 保留（预留手动时段，暂用真实时间）
    var k = tod.k;
    // 昼夜适配（批次0·熔炉核心）：给 uniShell 挂 data-tod，HUD CSS 据此微调
    var todKey = (function () { var h = currentHour(); if (h >= 8 && h < 17) return 'day'; if (h >= 5 && h < 8 || h >= 17 && h < 20) return 'dusk'; return 'night'; })();
    if (todKey !== lastTodKey) {
      lastTodKey = todKey;
      var _sh0 = byId('uniShell');
      if (_sh0) _sh0.setAttribute('data-tod', todKey);
    }
    function hexC(h) {
      return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
    }
    function warmTint(c, warmH, wamt) {
      var wr = (warmH >> 16 & 255) / 255, wg = (warmH >> 8 & 255) / 255, wb = (warmH & 255) / 255;
      return [c[0] * (1 - wamt) + wr * wamt * (1 - 0.55 * (1 - k)), c[1] * (1 - wamt) + wg * wamt * (1 - 0.45 * (1 - k)), c[2] * (1 - wamt) + wb * wamt];
    }
    var skyT = warmTint(hexC(w.skyTop), tod.warm, 0.22);
    var skyB = warmTint(hexC(w.skyBot), tod.warm, 0.3);
    var mult = function (c, m) { return [c[0] * m, c[1] * m, c[2] * m]; };
    // 夜晚整体压暗 + 色调偏冷
    var dm = 0.55 + 0.45 * k;
    ENV.targ = {
      skyTop: mult(skyT, dm), skyBot: mult(skyB, dm),
      fogC: mult(hexC(w.fog), 0.7 + 0.3 * k),
      fogD: w.fogD * (0.9 + 0.2 * (1 - k)),
      ambC: hexC(w.ambC), ambI: w.ambI * (0.35 + 0.65 * k),
      hemiI: w.hemiI * (0.45 + 0.55 * k),
      dirC: mult(warmTint(hexC(w.dirC), tod.warm, 0.35), 0.5 + 0.5 * k),
      dirI: w.dirI * k,
      dirH: w.dirH,
      glowC: hexC(w.glowC), glowI: w.glowI,
      starO: clamp(w.starO * (k > 0.9 ? 1 : 2.2 - 1.2 * k), 0, 1),
      dustO: w.dustO, dustS: w.dustS,
      aurA: w.aurA, aurSp: w.aurSp, rainA: w.rainA, snowA: w.snowA
    };
    // 设计稿 v2：白天场景加深 —— 深紫金渐变保住宇宙感，星点/远景星补偿提亮
    if (todKey === 'day') {
      ENV.targ.skyTop = mult(ENV.targ.skyTop, 0.62);
      ENV.targ.skyBot = mult(ENV.targ.skyBot, 0.48);
      ENV.targ.fogC = mult(ENV.targ.fogC, 0.7);
      ENV.targ.starO = Math.min(1, ENV.targ.starO * 1.7);
    }
    var t = ENV.targ, c = ENV.cur;
    var sp = 1 - Math.exp(-dt / 0.5);
    function lv(a, b) { return a + (b - a) * sp; }
    function lc(name, tt) {
      var cc = c[name];
      for (var i = 0; i < 3; i++) cc[i] = lv(cc[i], tt[i]);
    }
    lc('skyTop', t.skyTop); lc('skyBot', t.skyBot); lc('fogC', t.fogC); lc('ambC', t.ambC); lc('dirC', t.dirC); lc('glowC', t.glowC);
    c.fogD = lv(c.fogD, t.fogD); c.ambI = lv(c.ambI, t.ambI); c.hemiI = lv(c.hemiI, t.hemiI);
    c.dirI = lv(c.dirI, t.dirI); c.dirH = lv(c.dirH, t.dirH);
    c.glowI = lv(c.glowI, t.glowI); c.starO = lv(c.starO, t.starO);
    c.dustO = lv(c.dustO, t.dustO); c.dustS = lv(c.dustS, t.dustS);
    c.aurA = lv(c.aurA, t.aurA); c.aurSp = lv(c.aurSp, t.aurSp);
    c.rainA = lv(c.rainA, t.rainA); c.snowA = lv(c.snowA, t.snowA);
  }
  function applyEnv() {
    var c = ENV.cur;
    function col(arr, out) { out.setRGB(arr[0], arr[1], arr[2]); }
    col(c.skyTop, scene.fog.color);
    scene.background && scene.background.setRGB(c.skyTop[0] * 0.35, c.skyTop[1] * 0.35, c.skyTop[2] * 0.45);
    skyMat.uniforms.uTop.value.setRGB(c.skyTop[0], c.skyTop[1], c.skyTop[2]);
    skyMat.uniforms.uBot.value.setRGB(c.skyBot[0], c.skyBot[1], c.skyBot[2]);
    if (scene.fog) { scene.fog.color.setRGB(c.fogC[0], c.fogC[1], c.fogC[2]); scene.fog.density = c.fogD; } // A2：fogD 真正写入 FogExp2 密度
    col(c.ambC, ambLight.color); ambLight.intensity = c.ambI;
    hemiLight.intensity = c.hemiI;
    col(c.dirC, dirLight.color); dirLight.intensity = c.dirI;
    var elev = c.dirH * 2 - 0.2; // -0.2..1.8 视觉高度
    dirLight.position.set(Math.sin(currentHour() / 24 * Math.PI * 2) * 6, Math.max(0.4, elev * 8), Math.cos(currentHour() / 24 * Math.PI * 2) * 6);
    glowLight.color.setRGB(c.glowC[0], c.glowC[1], c.glowC[2]); glowLight.intensity = c.glowI + furnaceExtra();
    dustMat.opacity = c.dustO;
    if (farStarsMat) farStarsMat.opacity = c.starO * 0.85;
    // 天气开关按阈值淡入
    var rOn = c.rainA > 0.03, sOn = c.snowA > 0.03, aOn = c.aurA > 0.03;
    if (rainMesh) rainMesh.visible = rOn;
    if (snowMesh) snowMesh.visible = sOn;
    if (auroraMesh) { auroraMesh.visible = aOn; if (aOn) auroraMesh.material.uniforms.uOp.value = c.aurA; }
  }

  /* ================================================================
     Three.js 场景
     ================================================================ */
  var scene, camera, renderer, skyMat, skyMesh;
  var ambLight, hemiLight, dirLight, glowLight;
  var dustGeo, dustMat, dustPts;
  var farStarsMat, farStars;
  var rainMesh, snowMesh, auroraMesh;
  var foxAnchor;
  var rings = [];
  var stars = [];   // {id, group, mesh, mat, glow, label, base:[x,y,z], r, data}
  var edges = [];   // {curve, line, flows:[{pos0,pos1,t,speed,seed}]}
  var flowGeo, flowMat, flowPtsArr, flowCount;
  var flowMesh = null; // A1：流动光点全局引用，buildEdges 重建前先清理，防泄漏
  var clock3 = null;
  var rafId = 0, active = false, disposed = false;

  var camState = { yaw: 0.7, pitch: 0.30, dist: 17.5, auto: true, idle: 0 };
  var drag = null; // {x,y,moved}
  var hoverStar = null, selId = null;
  var focus = null; // {p:THREE.Vector3, dist, done}
  var curWeather = null, curServer = null; // {weather,city,temp,ts}
  var foxGifTimer = 0, foxGifIdx = 0;
  var FOX_GIFS = ['idle', 'wave', 'sway', 'pc', 'dozing', 'dribble'];

  function makeGlowTex() {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var g = cv.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.7, 'rgba(255,255,255,.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var tx = new T.CanvasTexture(cv);
    if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
    return tx;
  }
  function makeParticleTex(soft) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d');
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(soft ? 0.6 : 0.35, soft ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(cv);
  }
  var glowTex = null, softTex = null;
  /* C1：标签纹理缓存（key = 文案+颜色）。标签种类有界（选题数 × 颜色数），会话期常驻、不淘汰；
     clearStars/disposeObj 不得 dispose 缓存纹理，避免反复进出宇宙时重复建 canvas */
  var labelTexCache = {};
  var IS_TOUCH = false; // C2/E4：触屏判定（buildScene 初始化时写入，全局一次性）
  function isSharedTex(tx) {
    if (!tx) return false;
    if (tx === glowTex || tx === softTex) return true;
    for (var k in labelTexCache) if (labelTexCache[k].tex === tx) return true;
    return false;
  }

  function makeLabelSprite(text, colorCss) {
    var key = text + '|' + colorCss;
    var ent = labelTexCache[key];
    if (!ent) {
      var f = '"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif';
      var cv = document.createElement('canvas');
      cv.width = 1024; cv.height = 132;
      var g = cv.getContext('2d');
      g.font = '600 58px ' + f;
      var tw = g.measureText(text).width;
      var pad = 62;
      var w = Math.min(1000, Math.ceil(tw + pad * 2));
      cv.width = Math.max(128, w);
      g = cv.getContext('2d');
      g.font = '600 58px ' + f;
      // 药丸底
      var h = 112, y = 10, rr = h / 2;
      g.beginPath();
      g.moveTo(y + rr, y);
      g.arcTo(cv.width - y, y, cv.width - y, y + h, rr);
      g.arcTo(cv.width - y, y + h, y, y + h, rr);
      g.arcTo(y, y + h, y, y, rr);
      g.arcTo(y, y, cv.width - y, y, rr);
      g.closePath();
      g.fillStyle = 'rgba(6,10,22,.82)';
      g.fill();
      g.strokeStyle = colorCss; g.lineWidth = 4;
      g.stroke();
      g.fillStyle = '#fff';
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      g.fillText(text, cv.width / 2, y + h / 2 + 2);
      var tx = new T.CanvasTexture(cv);
      if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
      ent = { tex: tx, w: cv.width, h: h };
      labelTexCache[key] = ent;
    }
    var sp = new T.Sprite(new T.SpriteMaterial({ map: ent.tex, transparent: true, depthWrite: false }));
    var k = 1.05 / ent.h;
    sp.scale.set(ent.w * k, ent.h * k, 1);
    sp.userData.w = ent.w;
    return sp;
  }
  function labelOf(t) {
    var th = themeOf(t.cat);
    return (t.custom ? '🧪' : th.icon) + '  ' + trimCJK(t.q, 12);
  }

  /* ---------- 布局：轨道星带（批次0·熔炉核心：整体抬升至底部炉火上空） ---------- */
  var GALAXY_LIFT = 3.6; // 群星在炉火（屏幕底部 CSS 熔炉）上空运转
  /* D2：两级分层状态 —— null=概览层（分类星团） | 分类 id=分类层 | '*'=全量平铺（搜索强制） */
  var scope = null;

  /* E1：星糖共享 shader —— 深蓝紫糖球 + 菲涅尔糖釉边 + fbm 流云缓旋 + 呼吸/选中高亮（per-star uniforms，程序按代码字符串共享） */
  var STAR_VERT = 'varying vec3 vN; varying vec3 vV; varying vec3 vP2;\n' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP2 = position; gl_Position = projectionMatrix * mv; }';
  var STAR_FRAG = [
    'uniform vec3 uBase; uniform float uLearned; uniform float uHi; uniform float uTime; uniform float uPhase; uniform float uDim;',
    'varying vec3 vN; varying vec3 vV; varying vec3 vP2;',
    'float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
    'float noise3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);',
    '  float a = hash(i), b = hash(i+vec3(1.,0.,0.)), c = hash(i+vec3(0.,1.,0.)), d = hash(i+vec3(1.,1.,0.));',
    '  float e = hash(i+vec3(0.,0.,1.)), g = hash(i+vec3(1.,0.,1.)), h = hash(i+vec3(0.,1.,1.)), k = hash(i+vec3(1.,1.,1.));',
    '  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,g,f.x),mix(h,k,f.x),f.y), f.z); }',
    'void main(){',
    '  float fres = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.2);',
    '  float ang = uTime * 0.05;',
    '  vec3 rp = vec3(vP2.x*cos(ang)-vP2.z*sin(ang), vP2.y, vP2.x*sin(ang)+vP2.z*cos(ang));',
    '  float cloud = 0.6*noise3(rp*2.3) + 0.3*noise3(rp*4.9) + 0.15*noise3(rp*9.7);',
    '  vec3 deep = mix(vec3(0.055,0.05,0.13), uBase*0.32, 0.55);',
    '  vec3 col = deep + cloud*0.075;',
    '  vec3 rim = mix(vec3(0.42,0.38,0.85), vec3(1.0,0.83,0.5), uLearned);',
    '  col += fres * rim * (0.5 + 0.55*uLearned);',
    '  float breath = 0.5 + 0.5*sin(uTime*1.5 + uPhase);',
    '  col *= 0.8 + 0.35*breath*uLearned;',
    '  col += uHi * vec3(0.32,0.27,0.16);',
    '  col *= uDim;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');
  function starHash(str) { var h = 0; for (var i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff; return h; }
  function makeStarMaterial(colorHex, learned, idStr) {
    return new T.ShaderMaterial({
      uniforms: {
        uBase: { value: new T.Color(colorHex) },
        uLearned: { value: learned ? 1 : 0 },
        uHi: { value: 0 },
        uTime: { value: 0 },
        uPhase: { value: (starHash(idStr) % 628) / 100 },
        uDim: { value: 1 } // E1：随天气昼夜明暗（tick 每帧写入）
      },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG
    });
  }
  /* E2：糖丝共享 shader —— 管壁深色半透明 + 内壁极光渐变流动（两端分类色 → 中央暖白）+ 双端已习得金丝 */
  var EDGE_VERT = 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  var EDGE_FRAG = [
    'uniform vec3 uA; uniform vec3 uB; uniform float uGold; uniform float uTime; uniform float uOp;',
    'varying vec2 vUv;',
    'void main(){',
    '  float x = vUv.x;',
    '  vec3 warm = vec3(1.0, 0.92, 0.75);',
    '  vec3 base = mix(uA, uB, x);',
    '  base = mix(base, warm, 0.5*(1.0 - abs(x-0.5)*2.0));',
    '  float flow = 0.5 + 0.5*sin(x*26.0 - uTime*1.7);',
    '  float a = (0.14 + 0.24*flow) * uOp;',
    '  vec3 col = base * (0.5 + 0.65*flow);',
    '  if (uGold > 0.5) {',
    '    float band = smoothstep(0.55, 0.8, flow);',
    '    col = mix(col, vec3(1.0, 0.85, 0.54), band*0.85);',
    '    a += band*0.28*uOp;',
    '  }',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');
  function makeEdgeMaterial(hexA, hexB, gold) {
    return new T.ShaderMaterial({
      uniforms: { uA: { value: new T.Color(hexA) }, uB: { value: new T.Color(hexB) }, uGold: { value: gold ? 1 : 0 }, uTime: { value: 0 }, uOp: { value: 1 } },
      vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
  }
  function graphLayout(scopeFilter) {
    var ts = uniLearnableTopics();
    if (scopeFilter && scopeFilter !== '*') ts = ts.filter(function (t) { return t.cat === scopeFilter; });
    var list = [];
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i];
      list.push({
        id: t.id, cat: t.cat, votes: t.votes || 1200,
        learned: !!(S().learned && S().learned[t.id]),
        custom: !!t.custom, t: t
      });
    }
    // 每分类扇形：分类数量>=1，占位角 60°
    var cats = {};
    for (var j = 0; j < list.length; j++) (cats[list[j].cat] = cats[list[j].cat] || []).push(list[j]);
    var catIdx = 0, total = Object.keys(cats).length;
    var Rm = 7.6, RM = 11.8;
    var out = [];
    for (var c in cats) {
      var arr = cats[c];
      var baseA = (catIdx / Math.max(1, total)) * Math.PI * 2;
      catIdx++;
      var n = arr.length, spread = total === 1 ? 0 : 0.85, half = Math.max(0, (n - 1) / 2) * spread;
      for (var i2 = 0; i2 < n; i2++) {
        var it = arr[i2];
        // D2 分类层独占整球：方位全圆均分；多层时沿用扇形
        var az = total === 1
          ? (i2 / Math.max(1, n)) * Math.PI * 2 + Math.sin(i2 * 137.5 * Math.PI / 180) * 0.1
          : baseA + (i2 * spread - half) + (Math.sin(i2 * 137.5 * Math.PI / 180) * 0.12);
        var polar = 1.35 + Math.sin(it.id.length * 3.7 + catIdx * 1.9) * 0.34; // 1.0..1.7
        polar = clamp(polar, 0.9, 1.8);
        var vf = clamp(Math.log(it.votes + 200) / Math.log(16000), 0.28, 1);
        var R = lerp(Rm, RM, vf);
        var x = R * Math.sin(polar) * Math.cos(az);
        var y = R * Math.cos(polar) * 0.86;
        var z = R * Math.sin(polar) * Math.sin(az);
        it.pos = [x, y + GALAXY_LIFT + (it.id.charCodeAt(0) % 7) * 0.05, z];
        it.r = clamp(0.34 + vf * 0.5, 0.34, 0.92);
        it.vf = vf;
        out.push(it);
      }
    }
    return { list: out, cats: cats };
  }
  /* D2 概览层：每个有已习得文章的分类 → 一个星团节点（半径 ∝ 数量开方） */
  function graphLayoutOverview() {
    var ts = uniLearnableTopics();
    var cats = {};
    for (var i = 0; i < ts.length; i++) (cats[ts[i].cat] = cats[ts[i].cat] || []).push(ts[i]);
    var ids = Object.keys(cats);
    var out = [];
    for (var j = 0; j < ids.length; j++) {
      var arr = cats[ids[j]], th = themeOf(ids[j]);
      var a = (j / Math.max(1, ids.length)) * Math.PI * 2 + 0.6;
      var R = 8.6, n = arr.length;
      var r = clamp(0.6 + 0.55 * Math.sqrt(n), 0.95, 2.1);
      out.push({
        cat: ids[j], count: n, th: th, r: r,
        pos: [R * Math.cos(a), GALAXY_LIFT + 0.4 + Math.sin(j * 2.3) * 0.5, R * Math.sin(a)]
      });
    }
    return out;
  }

  /* ---------- 构建场景 ---------- */
  function buildScene() {
    var el = byId('uniCanvas');
    var vw = el.clientWidth || window.innerWidth || 800;
    var vh = el.clientHeight || window.innerHeight || 600;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(55, vw / Math.max(1, vh), 0.1, 400);
    camera.position.set(6, 4.5, 15);
    renderer = new T.WebGLRenderer({ canvas: el, antialias: true, alpha: false, powerPreference: 'high-performance' });
    // C2/E4：触屏设备 pixelRatio 上限 1.5（省显存/省电），桌面保持 2；一次性判定
    IS_TOUCH = ('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
    renderer.setSize(vw, vh, false);
    scene.background = new T.Color(0x0a1226);
    scene.fog = new T.FogExp2(0x20305c, 0.035);

    // 天空穹顶（渐变）
    skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: { uTop: { value: new T.Color(0x1a3f92) }, uBot: { value: new T.Color(0x5f9ed8) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 uTop; uniform vec3 uBot; void main(){ float h = normalize(vP).y*0.5+0.5; vec3 c = mix(uBot,uTop,pow(h,0.85)); gl_FragColor = vec4(c,1.0); }'
    });
    skyMesh = new T.Mesh(new T.SphereGeometry(180, 24, 16), skyMat);
    scene.add(skyMesh);

    // 远空星点
    var fg = new T.BufferGeometry();
    var fp = [];
    for (var i = 0; i < 520; i++) {
      var u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 2 - 1);
      var r = 120 + Math.random() * 40;
      fp.push(r * Math.sin(v) * Math.cos(u), r * Math.cos(v) * 0.9, r * Math.sin(v) * Math.sin(u));
    }
    fg.setAttribute('position', new T.Float32BufferAttribute(fp, 3));
    farStarsMat = new T.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.8, map: glowTex, blending: T.AdditiveBlending, depthWrite: false });
    farStars = new T.Points(fg, farStarsMat);
    scene.add(farStars);

    // 灯光
    ambLight = new T.AmbientLight(0x9db8ff, 0.4);
    scene.add(ambLight);
    hemiLight = new T.HemisphereLight(0x8fb0ff, 0x141e30, 0.5);
    scene.add(hemiLight);
    dirLight = new T.DirectionalLight(0xffe3b0, 1.1);
    scene.add(dirLight);
    glowLight = new T.PointLight(0xffc46a, 0.5, 40);
    glowLight.position.set(0, -4.5, 0); // 批次0·熔炉核心：炉火挪到抬升星系的下方，从底部煨亮群星
    scene.add(glowLight);

    // 前景星尘（受天气影响：亮度/转速）
    dustGeo = new T.BufferGeometry();
    var dn = 620, dp = [];
    for (var d = 0; d < dn; d++) {
      var r2 = 20 + Math.random() * 55;
      var a = Math.random() * Math.PI * 2, b2 = Math.acos(Math.random() * 2 - 1) * 0.9;
      dp.push(Math.cos(a) * r2 * Math.sin(b2), Math.sin(b2 * 0.5) * r2 * 0.6 - 2, Math.sin(a) * r2 * Math.sin(b2));
    }
    dustGeo.setAttribute('position', new T.Float32BufferAttribute(dp, 3));
    dustMat = new T.PointsMaterial({ color: 0xbfd4ff, size: 0.09, map: softTex, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending });
    dustPts = new T.Points(dustGeo, dustMat);
    scene.add(dustPts);

    // 雨（短线）与雪（点）
    rainMesh = buildRain();
    snowMesh = buildSnow();
    auroraMesh = buildAurora();

    // 轨道环
    var ringColors = [0x7c5cff, 0x0f88eb, 0xff9a3c];
    for (var ri = 0; ri < 3; ri++) {
      var rr = 10 + ri * 2.1;
      var tg = new T.Mesh(
        new T.TorusGeometry(rr, 0.012, 6, 150),
        new T.MeshBasicMaterial({ color: ringColors[ri], transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false })
      );
      tg.rotation.x = 1.35 + ri * 0.22;
      tg.rotation.y = ri * 0.7;
      scene.add(tg);
      rings.push({ m: tg, sp: 0.02 + ri * 0.015 });
    }

    // 批次0·熔炉核心：中央 3D 炼金炉移除，炉火改为屏幕底部 CSS 熔炉（#uniHearth，JS 注入），群星在其上空运转

    // 看山锚点（DOM 投影用）
    foxAnchor = new T.Object3D();
    foxAnchor.position.set(3.1, 0.4, 1.8);
    scene.add(foxAnchor);

    // 星体 + 链路
    rebuildTopics();
    buildEdges();
  }
  function furnaceExtra() {
    var xp = S().xp || 0;
    return 0.25 + clamp(xp / 2600, 0, 0.9);
  }

  function buildRain() {
    var n = 380, g = new T.BufferGeometry();
    var pos = new Float32Array(n * 2 * 3);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    var m = new T.LineBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.8 });
    var mesh = new T.LineSegments(g, m);
    mesh.visible = false;
    mesh.userData = { n: n, pos: pos, seed: [], speeds: [] };
    for (var i = 0; i < n; i++) {
      mesh.userData.seed.push(Math.random() * 1000);
      mesh.userData.speeds.push(18 + Math.random() * 14);
    }
    scene.add(mesh);
    return mesh;
  }
  function buildSnow() {
    var n = 220, g = new T.BufferGeometry();
    var pos = new Float32Array(n * 3);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({ color: 0xeaf4ff, size: 0.1, map: softTex, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending });
    var mesh = new T.Points(g, m);
    mesh.visible = false;
    mesh.userData = { n: n, pos: pos, seed: [], speeds: [] };
    for (var i = 0; i < n; i++) {
      mesh.userData.seed.push(Math.random() * 1000);
      mesh.userData.speeds.push(1.4 + Math.random() * 1.4);
    }
    scene.add(mesh);
    return mesh;
  }
  function buildAurora() {
    var g = new T.PlaneGeometry(46, 15, 90, 26);
    g.rotateX(-Math.PI / 2.6);
    var m = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uOp: { value: 1 }, uT: { value: 0 } },
      vertexShader: [
        'uniform float uT; varying vec2 vUv; varying float vH;',
        'void main(){ vUv = uv; vec3 p = position; float w = sin(uv.x*6.2831+uT*0.9)*1.4 + sin(uv.x*3.1416*2.0+uT*1.7)*0.7;',
        'p.z += w*(0.5+0.5*sin(uv.y*3.1416)); p.y += sin(uv.x*3.1416*2.0+uT*0.5)*1.0;',
        'vH = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform float uOp; uniform float uT; varying vec2 vUv; varying float vH;',
        'void main(){ float band = sin(vUv.x*3.1416*7.0+uT*1.3)*0.5+0.5; float base = (1.0-vH)*0.85;',
        'vec3 g1 = vec3(0.18,1.0,0.55); vec3 g2 = vec3(0.45,0.4,1.0);',
        'vec3 c = mix(g1,g2,smoothstep(0.25,0.8,band)); c += vec3(0.2,0.7,0.5)*(band*0.4);',
        'float a = uOp*clamp(base*0.35 + band*0.4, 0.0, 1.0); gl_FragColor = vec4(c*a, a); }'
      ].join('\n')
    });
    var mesh = new T.Mesh(g, m);
    mesh.position.set(0, 6.5, -6);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  }

  /* ---------- 星体 ---------- */
  function clearStars() {
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      scene.remove(st.group);
      disposeObj(st.group);
    }
    stars = [];
  }
  function disposeObj(o) {
    o.traverse && o.traverse(function (c) {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        var mats = c.material.length !== undefined ? c.material : [c.material];
        // C1：全局共享纹理（glowTex/softTex）与标签缓存纹理不随星体销毁
        for (var i = 0; i < mats.length; i++) { if (mats[i].map && !isSharedTex(mats[i].map)) mats[i].map.dispose(); mats[i].dispose(); }
      }
    });
  }
  function rebuildTopics() {
    clearStars();
    if (scope === null) { buildClusters(); return; } // D2：概览层只渲染分类星团
    var L = graphLayout(scope);
    var dataMap = {};
    for (var i = 0; i < L.list.length; i++) dataMap[L.list[i].id] = L.list[i];
    var ids = Object.keys(dataMap);
    for (var j = 0; j < ids.length; j++) {
      var it = dataMap[ids[j]], t = it.t, th = themeOf(t.cat);
      var grp = new T.Group();
      grp.position.set(it.pos[0], it.pos[1], it.pos[2]);
      // E1：星糖质感 —— 共享 shader（分类色 / learned / 呼吸相位 per-star uniform）
      var mat = makeStarMaterial(th.color, it.learned, it.id);
      var seg = IS_TOUCH ? 30 : 42; // E4：移动端几何细分减半
      var mesh = new T.Mesh(new T.SphereGeometry(it.r, seg, seg), mat);
      mesh.userData.starIdx = stars.length;
      grp.add(mesh);
      // E1 双层大气晕：内层紫金 + 外层淡蓝（透明度随天气 starO/dustO 联动，见 tick）
      var glow = new T.Sprite(new T.SpriteMaterial({
        map: glowTex, color: new T.Color(0xffd98a), transparent: true,
        opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(it.r * 4.6, it.r * 4.6, 1);
      grp.add(glow);
      var halo = null;
      if (!IS_TOUCH) { // E4：移动端晕层减半（仅保留内层）
        halo = new T.Sprite(new T.SpriteMaterial({
          map: glowTex, color: new T.Color(0x86b8ff), transparent: true,
          opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false
        }));
        halo.scale.set(it.r * 7.6, it.r * 7.6, 1);
        grp.add(halo);
      }
      var lbl = makeLabelSprite(labelOf(t), it.learned ? '#ffd98a' : th.color);
      lbl.position.y = it.r + 0.85;
      grp.add(lbl);
      scene.add(grp);
      stars.push({ id: it.id, group: grp, mesh: mesh, mat: mat, glow: glow, halo: halo, label: lbl, base: it.pos.slice(), r: it.r, learned: it.learned, it: it, spin: 0.05 + (starHash(it.id) % 100) / 100 * 0.07, born: 0 });
    }
  }
  /* D2 概览层：分类星团节点（分类色球体 + 「图标 分类名 ×N」标签，点击钻进分类） */
  function buildClusters() {
    var cs = graphLayoutOverview();
    for (var j = 0; j < cs.length; j++) {
      var c = cs[j], th = c.th;
      var grp = new T.Group();
      grp.position.set(c.pos[0], c.pos[1], c.pos[2]);
      var mat = new T.MeshStandardMaterial({
        color: new T.Color(th.color), roughness: 0.3, metalness: 0.3,
        emissive: new T.Color(0xffd98a), emissiveIntensity: 0.35
      });
      var mesh = new T.Mesh(new T.SphereGeometry(c.r, 42, 42), mat);
      mesh.userData.starIdx = stars.length;
      mesh.userData.clusterId = c.cat;
      grp.add(mesh);
      var glow = new T.Sprite(new T.SpriteMaterial({
        map: glowTex, color: new T.Color(th.color), transparent: true,
        opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(c.r * 5.4, c.r * 5.4, 1);
      grp.add(glow);
      var lbl = makeLabelSprite(th.icon + ' ' + th.name + ' ×' + c.count, th.color);
      lbl.position.y = c.r + 0.85;
      grp.add(lbl);
      scene.add(grp);
      stars.push({ id: 'cat:' + c.cat, isCluster: true, cat: c.cat, count: c.count, group: grp, mesh: mesh, mat: mat, glow: glow, label: lbl, base: c.pos.slice(), r: c.r, learned: true, it: null });
    }
  }
  /* ---------- 链路：Bezier 光带 + 流动光点 ---------- */
  function buildEdges() {
    // A1：清理上一份流动光点（此前每次 U.enter 重建都会泄漏一个 Points）
    if (flowMesh) {
      scene.remove(flowMesh);
      if (flowGeo) flowGeo.dispose();
      if (flowMat) flowMat.dispose();
      flowMesh = null; flowGeo = null; flowMat = null; flowPtsArr = null;
    }
    for (var i = 0; i < edges.length; i++) {
      scene.remove(edges[i].line);
      edges[i].line.geometry.dispose(); edges[i].line.material.dispose();
    }
    edges = [];
    if (scope === null) return; // D2：概览层星团间不画链路（MVP）
    var byIdMap = {}; for (var s = 0; s < stars.length; s++) { if (!stars[s].isCluster) byIdMap[stars[s].id] = stars[s]; }
    var pairs = {}, arr = uniLearnableTopics();
    if (scope !== '*') arr = arr.filter(function (t) { return t.cat === scope; }); // D2：分类层只画内部链路
    for (var t = 0; t < arr.length; t++) {
      var lks = arr[t].links || [];
      for (var l = 0; l < lks.length; l++) {
        var a = arr[t].id, b = lks[l].id;
        if (!byIdMap[a] || !byIdMap[b]) continue;
        var key = a < b ? a + '|' + b : b + '|' + a;
        pairs[key] = 1;
      }
    }
    var pkeys = Object.keys(pairs);
    for (var k = 0; k < pkeys.length; k++) {
      var ab = pkeys[k].split('|');
      var sA = byIdMap[ab[0]], sB = byIdMap[ab[1]];
      var p0 = sA.base, p1 = sB.base;
      var mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, mz = (p0[2] + p1[2]) / 2;
      var dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
      var dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      var lift = 0.5 + dl * 0.22;
      var pts = [new T.Vector3(p0[0], p0[1], p0[2]),
      new T.Vector3(mx - dy * 0.12 + (Math.random() - 0.5), my + lift, mz + dx * 0.12 + (Math.random() - 0.5)),
      new T.Vector3(p1[0], p1[1], p1[2])];
      var curve = new T.CatmullRomCurve3(pts);
      // E2：糖丝 —— TubeGeometry 管道 + 流动 shader（两端分类色渐变，双端已习得泛金丝）
      var heat = clamp(((sA.it.votes || 1200) + (sB.it.votes || 1200)) / 2 / 6000, 0, 1);
      var tubeR = clamp(0.02 + heat * 0.04, 0.02, 0.06);
      var tg = new T.TubeGeometry(curve, IS_TOUCH ? 24 : 48, tubeR, IS_TOUCH ? 6 : 8, false);
      var gold = !!(byIdMap[ab[0]].it.learned && byIdMap[ab[1]].it.learned);
      var mat2 = makeEdgeMaterial(themeOf(sA.it.cat).color, themeOf(sB.it.cat).color, gold);
      var line = new T.Mesh(tg, mat2);
      scene.add(line);
      var nFlow = 2;
      edges.push({ curve: curve, line: line, mat2: mat2, nFlow: nFlow, seed: Math.random() * 7 });
    }
    // 流动光点（合并为单个 Points）
    var total = 0; for (var e2 = 0; e2 < edges.length; e2++) total += edges[e2].nFlow;
    if (total) {
      flowCount = total;
      flowGeo = new T.BufferGeometry();
      var arr2 = new Float32Array(total * 3);
      flowGeo.setAttribute('position', new T.BufferAttribute(arr2, 3));
      flowMat = new T.PointsMaterial({ color: 0xffe08a, size: 0.10, map: softTex, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
      flowPtsArr = [];
      var fi = 0;
      for (var e3 = 0; e3 < edges.length; e3++) {
        for (var n2 = 0; n2 < edges[e3].nFlow; n2++) {
          flowPtsArr.push({ edge: e3, t: Math.random(), sp: 0.12 + Math.random() * 0.1, off: fi * 0.7 });
          fi++;
        }
      }
      flowMesh = new T.Points(flowGeo, flowMat);
      scene.add(flowMesh);
    }
  }
  function updateFlows(dt) {
    if (!flowGeo) return;
    var pos = flowGeo.attributes.position.array;
    for (var i = 0; i < flowPtsArr.length; i++) {
      var f = flowPtsArr[i], e = edges[f.edge];
      f.t = (f.t + f.sp * dt) % 1; // A4：帧率解耦，高刷屏流速不再翻倍
      var v = e.curve.getPoint(f.t);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    flowGeo.attributes.position.needsUpdate = true;
  }

  /* ---------------- E3：新星诞生动画（炉火 → 星位的金色飞行 + 落位弹性胀开 + 双音提示） ---------------- */
  function elasticOut(k) { return k === 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI / 3)) + 1; }
  var birthFlying = {};   // id → true：飞行途中对应星体保持隐藏（tick 星体循环读取）
  var birthAnims = [];    // { id, st, t0, phase, fire, fireGlow, trail, trailGeo, ring }
  var birthPlaying = false; // E3：播放期间加锁，防止 tick 兜底轮询重复触发同一队列

  /* 轮询 S().learned，发现新习得且未播放过的星 → 记入 rkUni6.pendingBirth.list（上限 20） */
  function birthScan() {
    try {
      var pb = storeGet('pendingBirth', { list: [], played: [] });
      if (!pb || !pb.list) pb = { list: [], played: [] };
      var played = pb.played || (pb.played = []);
      var list = pb.list || (pb.list = []);
      var changed = false;
      var lv = (S().learned) || {};
      var ids = Object.keys(lv);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (list.indexOf(id) >= 0 || played.indexOf(id) >= 0) continue;
        if (list.length >= 20) { list.shift(); console.info('[uni] pendingBirth 队列已满，丢弃最旧一项'); }
        list.push(id);
        changed = true;
      }
      if (changed) storeSet('pendingBirth', pb);
      return pb;
    } catch (e) { return null; }
  }

  /* 流星雨：队列里的新星错峰 0.5s 一次性全部发射，相机缓动跟拍，全部落位后统一结算 played */
  function playBirthQueue(queue, pb) {
    if (!queue || !queue.length) return;
    if (birthPlaying) return; // 已在播放中（如 tick 兜底与进入触发撞车），跳过
    birthPlaying = true;
    if (!pb) pb = storeGet('pendingBirth', { list: [], played: [] });
    var pending = 0, done = 0;
    launchList.length = 0;
    function finishOne() {
      done++;
      if (done < pending) return;
      for (var k = 0; k < queue.length; k++) {
        var qid = queue[k];
        var li = pb.list.indexOf(qid); if (li >= 0) pb.list.splice(li, 1);
        if (pb.played.indexOf(qid) < 0) pb.played.push(qid);
      }
      storeSet('pendingBirth', pb);
      birthPlaying = false;
      camState.auto = true; // 恢复缓慢自转
    }
    for (var i = 0; i < queue.length; i++) {
      var id = queue[i];
      var st = null;
      for (var s = 0; s < stars.length; s++) { if (stars[s].id === id) { st = stars[s]; break; } }
      if (!st || st.isCluster) { // 找不到星体：立即结算
        var li2 = pb.list.indexOf(id); if (li2 >= 0) pb.list.splice(li2, 1);
        if (pb.played.indexOf(id) < 0) pb.played.push(id);
        storeSet('pendingBirth', pb);
        continue;
      }
      launchList.push(st);
    }
    pending = launchList.length;
    if (!pending) { birthPlaying = false; return; }
    for (var i2 = 0; i2 < launchList.length; i2++) {
      (function (st2, delay, finale) {
        setTimeout(function () {
          try { uniSfx('birth'); } catch (e) { }
          launchMeteor(st2, finishOne, finale);
        }, delay);
      })(launchList[i2], i2 * 500, i2 === launchList.length - 1); // 最后一颗压轴
    }
    camState.auto = false; camState.idle = 0; // 跟拍期间暂停自转
  }
  var launchList = []; // playBirthQueue 内复用（避免闭包数组每次新建）

  /* 单颗流星：炉火上空 → 星位的弧线，彗尾光带（相机朝向三角带）+ 金色头部，落位闪白+光环 */
  function launchMeteor(st, done, finale) {
    birthFlying[st.id] = true;
    try { st.label.material.opacity = 0; } catch (e) { } // 标签落位后弹出
    var h = starHash(st.id) % 100 / 100;
    var start = new T.Vector3(0, GALAXY_LIFT - 2.6, 4.0);
    var end = new T.Vector3(st.base[0], st.base[1], st.base[2]);
    var m1 = start.clone().lerp(end, 0.25); m1.y += 1.2 + h * 1.5;   // 起跑上扬
    var m2 = start.clone().lerp(end, 0.62); m2.y += 3.0 + h * 3.2;   // 顶弧（每颗不同）
    var curve = new T.CatmullRomCurve3([start, m1, m2, end]);
    var dur = 1.9 + h * 0.9;
    var head = new T.Mesh(new T.SphereGeometry(0.15, 16, 12), new T.MeshBasicMaterial({ color: 0xfff6dd, transparent: true }));
    var hglow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: new T.Color(0xffd98a), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }));
    hglow.scale.set(2.3, 2.3, 1);
    head.add(hglow);
    // 彗尾光带
    var SEG = IS_TOUCH ? 14 : 22;
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    geo.setAttribute('color', new T.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    var idx = [];
    for (var q = 0; q < SEG; q++) { var a2 = q * 2; idx.push(a2, a2 + 1, a2 + 2, a2 + 1, a2 + 3, a2 + 2); }
    geo.setIndex(idx);
    var tail = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, blending: T.AdditiveBlending, transparent: true, depthWrite: false, side: T.DoubleSide }));
    scene.add(head); scene.add(tail);
    birthAnims.push({ id: st.id, st: st, t0: eTime, dur: dur, curve: curve, head: head, tail: tail, geo: geo, seg: SEG, done: done, finale: !!finale, ring: null, ring2: null, beam: null, beamMat: null, lblY: st.r + 0.85 });
  }

  function stepBirthAnims(now) {
    var anyFly = false;
    var cx = 0, cy = 0, cz = 0, cn = 0, minx = 1e9, maxx = -1e9;
    for (var i = birthAnims.length - 1; i >= 0; i--) {
      var a = birthAnims[i];
      if (now < a.t0) continue;
      var k = (now - a.t0) / a.dur;
      if (a.phase !== 'land' && a.phase !== 'tail' && k < 1) {
        anyFly = true;
        var p = a.curve.getPoint(k);
        a.head.position.copy(p);
        var hb = 1 + Math.sin(now * 14) * 0.08;
        a.head.scale.setScalar(hb);
        // 彗尾：沿曲线回溯，宽度/亮度递减，朝向相机展开
        var pa = a.geo.attributes.position.array, ca = a.geo.attributes.color.array;
        var camDir = camera.position.clone().sub(p).normalize();
        for (var j = 0; j <= a.seg; j++) {
          var tj = Math.max(0, k - (j / a.seg) * 0.22);
          var pj = a.curve.getPoint(tj);
          var tan = a.curve.getPoint(Math.min(1, tj + 0.012)).sub(pj).normalize();
          var perp = new T.Vector3().crossVectors(tan, camDir).normalize();
          var w = 0.05 + 0.13 * (1 - j / a.seg);
          var o = j * 6;
          pa[o] = pj.x + perp.x * w; pa[o + 1] = pj.y + perp.y * w; pa[o + 2] = pj.z + perp.z * w;
          pa[o + 3] = pj.x - perp.x * w; pa[o + 4] = pj.y - perp.y * w; pa[o + 5] = pj.z - perp.z * w;
          var f = 1 - j / a.seg; f = f * f;
          ca[o] = f; ca[o + 1] = f * 0.87; ca[o + 2] = f * 0.55;
          ca[o + 3] = f; ca[o + 4] = f * 0.87; ca[o + 5] = f * 0.55;
        }
        a.geo.attributes.position.needsUpdate = true;
        a.geo.attributes.color.needsUpdate = true;
        cx += p.x; cy += p.y; cz += p.z; cn++;
        if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
      } else if (a.phase !== 'land' && a.phase !== 'tail') {
        /* 落位核心（0.8s 轻快）：闪白胚核 + 双光环 + 标签弹出 + 归属光柱 + 「叮」 */
        a.phase = 'land'; a.t0 = now;
        a.st.born = now;
        a.st.flashAt = now;
        try { uniSfx('land'); } catch (e) { }
        // 流星头凝成贴星胚核（0.18s 内缩小隐去）
        a.head.material.opacity = 1; a.head.scale.setScalar(1.6);
        // 彗尾即刻回收
        scene.remove(a.tail);
        if (a.geo) a.geo.dispose();
        if (a.tail.material) a.tail.material.dispose();
        a.tail = null;
        // 双层光环：内金外分类色（外层错 0.12s）
        a.ring = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: new T.Color(0xffe2a8), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
        a.ring.scale.set(0.4, 0.4, 1);
        a.st.group.add(a.ring);
        a.ring2 = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: new T.Color(themeOf(a.st.it.cat).color), transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false }));
        a.ring2.scale.set(0.3, 0.3, 1);
        a.ring2.material.opacity = 0; // 前 0.12s 保持隐藏
        a.st.group.add(a.ring2);
        // 归属光柱：星体 → 炉火（本地坐标，顶点色上金下黑，additive 淡出即隐）
        var bgeo = new T.BufferGeometry();
        bgeo.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0.1, 0, -(a.st.base[0]), (GALAXY_LIFT - 2.6) - a.st.base[1], 4.0 - a.st.base[2]]), 3));
        bgeo.setAttribute('color', new T.BufferAttribute(new Float32Array([1, 0.82, 0.45, 0, 0, 0]), 3));
        a.beamMat = new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
        a.beam = new T.Line(bgeo, a.beamMat);
        a.st.group.add(a.beam);
      } else if (a.phase === 'land') {
        var lk = Math.min(1, (now - a.t0) / 0.8);
        // 胚核缩小隐去（0.18s）
        if (a.head) {
          var hk = Math.min(1, (now - a.t0) / 0.18);
          a.head.scale.setScalar(1.6 - hk * 1.35);
          a.head.material.opacity = 1 - hk;
          if (hk >= 1) {
            scene.remove(a.head);
            if (a.head.geometry) a.head.geometry.dispose();
            if (a.head.material) a.head.material.dispose();
            a.head = null;
          }
        }
        if (a.ring) {
          var rs = 0.4 + lk * 2.4;
          a.ring.scale.set(rs, rs, 1);
          a.ring.material.opacity = 0.9 * (1 - lk);
        }
        if (a.ring2 && now - a.t0 > 0.12) {
          var l2 = Math.min(1, (now - a.t0 - 0.12) / 0.68);
          var rs2 = 0.3 + l2 * (a.finale ? 4.6 : 3.4);
          a.ring2.scale.set(rs2, rs2, 1);
          a.ring2.material.opacity = 0.6 * (1 - l2);
        }
        if (a.beamMat) a.beamMat.opacity = Math.min(0.85, lk * 2.2); // 光柱淡入
        // 标签弹出：自星体内上浮 + 回弹
        try {
          a.st.label.material.opacity = Math.min(1, lk * 2.2);
          var lek = elasticOut(Math.min(1, lk * 1.3));
          a.st.label.position.y = a.lblY + (1 - lek) * 0.6;
        } catch (e) { }
        if (lk >= 1) {
          if (a.ring) { a.st.group.remove(a.ring); a.ring.material.dispose(); a.ring = null; }
          if (a.ring2) { a.st.group.remove(a.ring2); a.ring2.material.dispose(); a.ring2 = null; }
          a.phase = 'tail'; a.t0 = now;
          if (a.finale) { // 压轴：看山欢呼
            try {
              foxGif('wave');
              foxSay('<b>🦊 看山：</b>看，新星星落进来了 ✨ 这颗是你刚从炉火里炼出来的！', 3600);
              setTimeout(function () { foxGif(WEATHERS[curWeather || 'sunny'].fox); }, 3800);
            } catch (e) { }
          }
        }
      } else { // tail：光柱驻留后淡出（压轴更久）
        var tk = Math.min(1, (now - a.t0) / (a.finale ? 2.4 : 1.2));
        if (a.beamMat) a.beamMat.opacity = 0.85 * (1 - tk * tk);
        try { a.st.label.position.y = a.lblY; } catch (e) { }
        if (tk >= 1) {
          if (a.beam) {
            a.st.group.remove(a.beam);
            if (a.beam.geometry) a.beam.geometry.dispose();
            if (a.beamMat) a.beamMat.dispose();
            a.beam = null; a.beamMat = null;
          }
          delete birthFlying[a.id];
          birthAnims.splice(i, 1);
          try { if (a.done) a.done(); } catch (e) { }
        }
      }
    }
    // 相机跟拍：视线缓动到飞行中的流星 centroid，距离按散布自适应；用户拖拽时让位
    if (anyFly && cn > 0 && !drag) {
      ensureCamVec();
      var spF = 0.045;
      focusP.x += (cx / cn - focusP.x) * spF;
      focusP.y += (cy / cn - focusP.y) * spF;
      focusP.z += (cz / cn - focusP.z) * spF;
      var spread = Math.max(2, maxx - minx);
      var want = clamp(7.5 + spread * 0.9, 9, 15);
      camState.dist += (want - camState.dist) * spF;
    }
  }

  /* ---------------- 控件：自制轨道（拖拽旋转/滚轮缩放/缓动） ---------------- */
  function camPos() {
    var y = camState.pitch;
    return new T.Vector3(
      Math.cos(yawNow()) * Math.sin(Math.PI / 2 - y) * camState.dist,
      Math.cos(y) * camState.dist,
      Math.sin(yawNow()) * Math.sin(Math.PI / 2 - y) * camState.dist
    );
  }
  var _yawAdd = 0;
  function yawNow() { return camState.yaw + _yawAdd; }
  function orbitUpdate(dt, t) {
    ensureCamVec();
    var sp = 1 - Math.exp(-dt * 12);
    if (!drag && !focus && camState.auto) { camState.yaw += dt * 0.045; }
    if (focus) {
      camTarget.lerp(focus.p, sp * 2.2);
      var dd = camera.position.distanceTo(camTarget);
      var nd = lerp(dd, focus.dist, sp * 2.2);
      if (dd < 0.02 && Math.abs(nd - focus.dist) < 0.05) { focus = null; camState.dist = nd; }
      // 方向保持
      var dir = camera.position.clone().sub(camTarget).normalize();
      camera.position.copy(camTarget).add(dir.multiplyScalar(nd));
    } else {
      camTarget.lerp(focusP, sp * 3);
    }
    var want = camPos().add(camTarget);
    camera.position.lerp(want, sp * 4);
    camera.lookAt(camTarget);
  }
  var camTarget = null, focusP = null; // 惰性创建（见 ensureCamVec，避免脚本加载期依赖 T）
  function ensureCamVec() {
    if (!camTarget) camTarget = new T.Vector3(0, 2.6, 0); // 批次0：视线对准抬升后的星带
    if (!focusP) focusP = new T.Vector3(0, 2.6, 0);
  }

  /* ---------------- DOM 看山投影 ---------------- */
  function projectFox() {
    var el = byId('uniFox'); if (!el || !active) return;
    var v = new T.Vector3();
    foxAnchor.getWorldPosition(v);
    v.project(camera);
    if (v.z > 1) { el.style.display = 'none'; return; }
    var elC = byId('uniCanvas');
    var x = (v.x * 0.5 + 0.5) * elC.clientWidth;
    var y = (-v.y * 0.5 + 0.5) * elC.clientHeight;
    el.style.display = 'block';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    // 兜底：太靠屏幕下方则贴地
    if (y > elC.clientHeight - 70) el.style.top = (elC.clientHeight - 70) + 'px';
  }
  function foxGif(name) {
    var img = byId('uniFoxImg');
    if (img && img.getAttribute('data-g') !== name) {
      img.src = 'assets/' + (name || 'idle') + '.gif';
      img.setAttribute('data-g', name || 'idle');
    }
  }
  function foxSay(html, ms) {
    var b = byId('uniFoxBubble');
    if (!b) return;
    b.innerHTML = html;
    b.classList.add('show');
    byId('uniFox').classList.add('big');
    if (ms) { clearTimeout(foxSayT); foxSayT = setTimeout(function () { b.classList.remove('show'); byId('uniFox').classList.remove('big'); }, ms); }
  }
  var foxSayT = 0;
  function foxAutoTip() {
    var arr = [
      '把<b>收藏</b>拖进这里，会自己长成星球 ✨',
      '雨夜别怕，<b>炉火</b>会把知识点慢慢煨熟～',
      '点星体上的<b>看原文</b>，还能圈圈画画批注 📝',
      '想学哪颗星？点它，我就带你进拆解炉 🔥',
      '天气不同，我的姿势也不同——你发现了吗？',
      '热榜第一那颗星，今天最亮 🏆'
    ];
    foxSay('<b>🦊 看山：</b>' + arr[(Math.random() * arr.length) | 0], 4200);
  }

  /* ---------------- HUD：天气按钮 ---------------- */
  function paintWeatherBtns() {
    var box = byId('uniWeather'); if (!box) return;
    box.innerHTML = '';
    for (var i = 0; i < WEATHER_ORDER.length; i++) {
      var k2 = WEATHER_ORDER[i], w = WEATHERS[k2];
      var b = document.createElement('button');
      // 设计稿 v2 单高亮：手动模式下仅当前天气亮；跟随实时时不亮任何天气（高亮归组尾小开关）
      b.className = 'wbtn' + (!followLive && k2 === curWeather ? ' on' : '');
      b.setAttribute('data-w', k2);
      b.innerHTML = '<span class="we">' + w.ico + '</span>' + w.name;
      b.title = w.name + '：' + (k2 === 'sunny' ? '暖金直射光 · 粒子稀疏慢速' : k2 === 'cloudy' ? '柔光 · 看山托腮' : k2 === 'rain' ? '冷蓝紫 · 粒子密集下落' : k2 === 'snow' ? '冷白漫射 · 雪花飘落' : '绿紫极光带 · 看山仰望');
      box.appendChild(b);
    }
    // B2：「跟随实时」开关（手动模式出口）——设计稿 v2：组尾小胶囊，绿点=推送中
    var lb = document.createElement('button');
    lb.className = 'wbtn-live' + (followLive ? ' on' : '');
    lb.setAttribute('data-live', '1');
    lb.innerHTML = '<span class="dot"></span>跟随实时';
    lb.title = followLive ? '正在跟随后端实时天气推送（点击改为手动）' : '当前为手动天气（点击恢复跟随后端推送）';
    box.appendChild(lb);
  }
  function toggleFollowLive() {
    followLive = true;
    storeSet('followLive', true);
    paintWeatherBtns();
    if (curServer && curServer.weather && WEATHERS[curServer.weather]) {
      if (curServer.weather !== curWeather) setWeather(curServer.weather, true);
      toastU('已恢复跟随实时天气 🛰', 1);
    } else {
      toastU('已开启「跟随实时」：连上 node server 后端后，天气会自动跟随推送 🛰', 0);
    }
  }

  /* ================================================================
     原文阅读器（知乎问答样式 + 3 色高亮 + 旁注批注 + 本地恢复）
     ================================================================ */
  var rd = { topic: null, color: 'y', store: {} };
  function rdLoadStore() { rd.store = loadLS('rkUniOrig', {}) || {}; }
  function rdSave() { saveLS('rkUniOrig', rd.store); }
  function rdStoreOf(id) {
    if (!rd.store[id]) rd.store[id] = { paras: null, notes: [] };
    return rd.store[id];
  }
  function rdBuildArticle(t) {
    var th = themeOf(t.cat);
    var h = [];
    h.push('<div class="zh-q">' + esc(t.q) + '</div>');
    h.push('<div class="zh-a"><div class="ava2">' + (t.author || '答').slice(0, 1) + '</div><div class="who"><b>' + esc(t.author || '知乎答主') + (t.authorDesc ? ' · ' + esc(t.authorDesc) : '') + '</b>回答于知乎 · 赞同 ' + fmtV(t.votes) + ' · ' + esc(t.time || '') + '</div></div>');
    h.push('<p class="para"><span class="para-tag">结论</span>' + esc(t.core || '') + '</p>');
    var blocks = t.blocks || [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      h.push('<p class="para"><span class="para-tag">' + esc(b.tp || '观点') + '</span>' + esc(b.text || '') + '</p>');
    }
    if (t.fun) h.push('<p class="para">' + esc(t.fun) + '</p>');
    h.push('<p class="para" style="font-size:.8em;color:#a89f8a">—— 演示原文由炼知按收藏内容整理（问答样式），接入知乎开放平台后展示对应问题/回答全文。</p>');
    return h.join('');
  }
  function rdOpen(id) {
    var t = topicById(id);
    if (!t) return;
    rdLoadStore();
    rd.topic = t;
    var body = byId('urBody');
    var st = rdStoreOf(t.id);
    if (!st.paras || !st.paras.length) {
      body.innerHTML = rdBuildArticle(t);
      st.paras = null;
    } else {
      // 恢复已圈点内容：段落顺序一致时回填
      body.innerHTML = rdBuildArticle(t);
      var ps = body.querySelectorAll('p.para');
      if (ps.length === st.paras.length) {
        for (var i = 0; i < ps.length; i++) ps[i].innerHTML = st.paras[i];
      } else {
        st.paras = null;
        // B5：原文结构变化 → 圈点快照作废，连带清掉失效批注，避免悬空条目
        if (st.notes && st.notes.length) {
          var n = st.notes.length;
          st.notes = [];
          rdSave();
          setTimeout(function () { toastU('原文结构有变化，已清理 ' + n + ' 条失效批注', 0); }, 80);
        }
      }
    }
    rdPaintNotes();
    byId('urQ').textContent = t.q;
    var th = themeOf(t.cat);
    byId('urMeta').innerHTML = '<span class="ava">' + (t.author || '答').slice(0, 1) + '</span><span>' + esc(t.author || '知乎答主') + ' · 高赞回答 · <span class="v">▲ ' + fmtV(t.votes) + '</span></span><span>' + esc(th.icon + ' ' + th.name) + '</span>';
    byId('urCnt').textContent = '';
    byId('uniReader').classList.add('on');
    // 若有星体卡/面板开着，收起避免重叠（阅读器全覆盖右侧）
    closeCard();
    hideHot();
    hideKnow();
    rdPaintNotes();
    uniSfx('open');
    setTimeout(function () { body.focus(); }, 60);
  }
  function rdClose() {
    if (!rd.topic) return;
    rdPersist();
    rd.topic = null;
    byId('uniReader').classList.remove('on');
    hideSelMenu();
  }
  function rdPersist() {
    if (!rd.topic) return;
    var st = rdStoreOf(rd.topic.id);
    var body = byId('urBody');
    var ps = body.querySelectorAll('p.para');
    var arr = [];
    for (var i = 0; i < ps.length; i++) arr.push(ps[i].innerHTML);
    st.paras = arr;
    rdSave();
  }
  function rdCurNotes() {
    var st = rd.topic ? rdStoreOf(rd.topic.id) : null;
    return st ? st.notes : [];
  }
  function rdPaintNotes() {
    var list = byId('urList');
    var notes = rdCurNotes();
    var html = '';
    if (!notes.length) html = '<div class="u-empty">还没有批注 · 选中原文文字 → 点色块高亮，或点 📝 加旁注</div>';
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var c = n.color || 'y';
      var cname = c === 'y' ? '#ffd342' : c === 'b' ? '#60a9ff' : '#ff8ec4';
      html += '<div class="u-n" data-nid="' + n.id + '"><span class="mark-dot" style="background:' + cname + '"></span><div class="txt"><div class="q">' + esc(n.text) + '</div>' + (n.note ? '<div>📝 ' + esc(n.note) + '</div>' : '<div style="color:#c0b9a4">（仅高亮，未写批注）</div>') + '</div><span class="rm" title="删除这条圈点与批注">✕</span></div>';
    }
    list.innerHTML = html;
    var marks = byId('urBody').querySelectorAll('mark.ur-note');
    byId('urCnt').textContent = '高亮 ' + (byId('urBody').querySelectorAll('mark.ur-hl').length) + ' 处 · 批注 ' + notes.length + ' 条';
    // 绑定
    var self = list;
    Array.prototype.forEach.call(list.querySelectorAll('.u-n'), function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.classList.contains('rm')) {
          rdDelNote(row.getAttribute('data-nid'));
          return;
        }
        var mk = byId('urBody').querySelector('mark[data-nid="' + row.getAttribute('data-nid') + '"]');
        if (mk) { mk.scrollIntoView({ behavior: 'smooth', block: 'center' }); flashMark(mk); }
      });
    });
  }
  function flashMark(mk) {
    mk.style.outline = '2px solid rgba(224,90,90,.9)';
    setTimeout(function () { mk.style.outline = ''; }, 900);
  }
  function rdNewId() { return 'n' + now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function rdApply(color, withNote) {
    var body = byId('urBody');
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    var r = sel.getRangeAt(0);
    if (!body.contains(r.commonAncestorContainer)) return null;
    // 只允许在单段原文内圈点，避免跨段造成结构错乱
    var aP = (sel.anchorNode && sel.anchorNode.parentElement) ? sel.anchorNode.parentElement.closest('.para') : null;
    var fP = (sel.focusNode && sel.focusNode.parentElement) ? sel.focusNode.parentElement.closest('.para') : null;
    if (!aP || aP !== fP) { toastU('请在一段原文内选择文字', 0); return null; }
    var frag = r.extractContents();
    var mk = document.createElement('mark');
    mk.className = 'ur-hl ur-' + color;
    if (withNote) { mk.classList.add('ur-note'); }
    mk.appendChild(frag);
    r.insertNode(mk);
    var text = mk.textContent || '';
    // 记录
    var st = rdStoreOf(rd.topic.id);
    var id = rdNewId();
    if (withNote) {
      mk.setAttribute('data-nid', id);
      st.notes.push({ id: id, color: color, text: trimCJK(text, 42), note: '' });
    } else {
      mk.setAttribute('data-nid', id);
      st.notes.push({ id: id, color: color, text: trimCJK(text, 42), note: null });
    }
    rdPersist();
    sel.removeAllRanges();
    hideSelMenu();
    rdPaintNotes();
    if (withNote) openNotePop(mk, id);
    else uniSfx('pick');
    return mk;
  }
  function openNotePop(mk, nid) {
    var st = rdStoreOf(rd.topic.id);
    var note = null;
    for (var i = 0; i < st.notes.length; i++) if (st.notes[i].id === nid) { note = st.notes[i]; break; }
    if (!note) return;
    hideNotePop();
    var pop = document.createElement('div');
    pop.className = 'ur-note-pop';
    pop.innerHTML = '<div style="font-weight:700;font-size:.84rem;margin-bottom:6px">📝 给这段加旁注</div><textarea placeholder="写下你的理解 / 联想 / 问题…">' + esc(note.note || '') + '</textarea><div class="row"><button class="del">删除</button><button class="ok">保存</button></div>';
    document.body.appendChild(pop);
    var mkR = mk.getBoundingClientRect();
    var left = clamp(mkR.left + mkR.width / 2 - 115, 8, document.documentElement.clientWidth - 240);
    var top = mkR.top - pop.offsetHeight - 8;
    if (top < 60) top = mkR.bottom + 8;
    pop.style.left = left + 'px';
    pop.style.top = Math.max(6, top) + 'px';
    var ta = pop.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    function commit(remove) {
      if (remove) {
        rdDelNote(nid);
      } else {
        note.note = ta.value.trim();
        rdPersist();
        rdPaintNotes();
        uniSfx('note');
      }
      pop.remove();
      flashMark(mk);
    }
    pop.querySelector('.ok').addEventListener('click', function () { commit(false); });
    pop.querySelector('.del').addEventListener('click', function () { commit(true); });
    document.addEventListener('mousedown', function esc2(e) { if (!pop.contains(e.target) && e.target !== mk && !mk.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', esc2); } });
  }
  function hideNotePop() { var p = document.querySelector('.ur-note-pop'); if (p) p.remove(); }
  function rdDelNote(nid) {
    var st = rdStoreOf(rd.topic.id);
    st.notes = st.notes.filter(function (n) { return n.id !== nid; });
    var mk = byId('urBody').querySelector('mark[data-nid="' + nid + '"]');
    if (mk) {
      // 删除高亮本身：还原为纯文本
      var frag = document.createDocumentFragment();
      while (mk.firstChild) frag.appendChild(mk.firstChild);
      mk.replaceWith(frag);
    }
    rdPersist();
    rdPaintNotes();
    uniSfx('close');
  }
  function selMenuShow(x, y) {
    var m = byId('urSelMenu');
    m.classList.add('on');
    var w = m.offsetWidth || 190;
    m.style.left = clamp(x, w / 2 + 6, document.documentElement.clientWidth - w / 2 - 6) + 'px';
    m.style.top = clamp(y - 14, 70, document.documentElement.clientHeight - 60) + 'px';
  }
  function hideSelMenu() { var m = byId('urSelMenu'); if (m) m.classList.remove('on'); }
  function bindReader() {
    var body = byId('urBody');
    byId('urClose').addEventListener('click', rdClose);
    // 选中文字 → 浮动工具条
    body.addEventListener('mouseup', function (e) {
      setTimeout(function () {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed) { return; }
        if (!body.contains(sel.anchorNode) || !body.contains(sel.focusNode)) return;
        var txt = sel.toString().trim();
        if (txt.length < 1 || txt.length > 260) { hideSelMenu(); return; }
        var aP = (sel.anchorNode && sel.anchorNode.parentElement) ? sel.anchorNode.parentElement.closest('.para') : null;
        var fP = (sel.focusNode && sel.focusNode.parentElement) ? sel.focusNode.parentElement.closest('.para') : null;
        if (!aP || aP !== fP) { hideSelMenu(); return; }
        selMenuShow(e.clientX, e.clientY);
      }, 10);
    });
    body.addEventListener('mousedown', function () { setTimeout(hideSelMenu, 60); });
    document.addEventListener('mousedown', function (e) {
      if (!byId('urSelMenu').contains(e.target)) hideSelMenu();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideSelMenu(); hideNotePop(); if (rd.topic) rdClose(); } });
    // 工具条颜色
    var chips = byId('urTools').querySelectorAll('.hl-chip');
    chips[0] && chips[0].classList.add('on');
    Array.prototype.forEach.call(chips, function (c) {
      c.addEventListener('click', function () {
        rd.color = c.getAttribute('data-c');
        Array.prototype.forEach.call(chips, function (x) { x.classList.toggle('on', x === c); });
        uniSfx('pick');
      });
    });
    var sms = byId('urSelMenu').querySelectorAll('.sm');
    Array.prototype.forEach.call(sms, function (c) {
      c.addEventListener('click', function () {
        var kind = c.getAttribute('data-c');
        if (c.id === 'urSmNote') { rdApply(rd.color, true); }
        else { rdApply(kind || rd.color, false); }
      });
    });
    byId('urNoteBtn').addEventListener('click', function () {
      // 无选区时给"当前颜色"一个快速批注占位：直接提示
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) { toastU('请先在正文里选中一段文字', 0); return; }
      rdApply(rd.color, true);
    });
    body.addEventListener('click', function (e) {
      var mk = e.target.closest ? e.target.closest('mark.ur-note') : null;
      if (mk) {
        var nid = mk.getAttribute('data-nid');
        openNotePop(mk, nid);
      }
    });
  }
  function toastU(msg, good) {
    var w = byId('toasts');
    if (!w) return;
    var d = document.createElement('div');
    d.style.cssText = 'background:#fff;border:1px solid ' + (good ? '#52c41a' : '#d8dade') + ';box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:12px;padding:9px 18px;font-size:.9rem;display:flex;gap:8px;align-items:center;animation:vin .3s';
    d.innerHTML = (good ? '✅ ' : '· ') + esc(msg);
    w.appendChild(d);
    setTimeout(function () { d.style.transition = 'opacity .5s'; d.style.opacity = '0'; }, 2600);
    setTimeout(function () { d.remove(); }, 3200);
  }

  /* ---------------- 热榜 & 搜索 ---------------- */
  function hotList() {
    // 后端优先（实时），否则本地示例：按热度排序内置选题
    if (curServer && curServer.hot && curServer.hot.length) return curServer.hot;
    var ts = allTopics().slice().sort(function (a, b) { return (b.votes || 0) - (a.votes || 0); });
    return ts.map(function (t, i) {
      return { rank: i + 1, id: t.id, q: t.q, cat: t.cat, votes: t.votes || 0, custom: !!t.custom, link: t.zhLink || '' };
    });
  }
  function paintHot() {
    var list = byId('uniHotList'); if (!list) return;
    var items = hotList();
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var th = themeOf(it.cat);
      html += '<div class="hot-item" data-id="' + it.id + '"><span class="rank">' + it.rank + '</span><div class="hi-m"><div class="hi-q">' + esc(it.q) + '</div><div class="hi-s"><b>' + th.icon + ' ' + th.name + '</b><span>' + (it.custom ? '🧪 我的' : '') + '</span></div></div><div class="hi-v">▲ ' + fmtV(it.votes) + '</div></div>';
    }
    list.innerHTML = html;
    Array.prototype.forEach.call(list.querySelectorAll('.hot-item'), function (row) {
      row.addEventListener('click', function () {
        selectStar(row.getAttribute('data-id'), true);
      });
    });
  }
  function showHot() {
    /* 与 showKnow 对称：打开热榜时收起已习得面板与星体卡，避免同位置叠加 */
    hideKnow(); closeCard();
    byId('uniHotPanel').classList.add('on');
    byId('uniHotSrc').textContent = (curServer && curServer.live) ? '实时 · 后端推送' : '本地示例';
  }
  function hideHot() { byId('uniHotPanel').classList.remove('on'); }

  function applySearch(q) {
    q = (q || '').toLowerCase().trim();
    // D2：搜索框非空 → 强制全量平铺；清空 → 恢复概览
    if (q && scope !== '*') { setScope('*', true); return; }
    if (!q && scope === '*') { setScope(null, true); return; }
    applySearchInner(q);
  }
  function applySearchInner(q) {
    q = (q || '').toLowerCase().trim();
    var any = false;
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i], t = st.isCluster ? null : topicById(st.id);
      var hay = (t ? t.q + ' ' + t.title + ' ' + t.author + ' ' + themeOf(t.cat).name + ' ' + ((t.red || []).join(' ')) : '').toLowerCase();
      var on = !q || hay.indexOf(q) >= 0;
      if (on) any = true;
      st.group.visible = on;
      st.mesh.userData.skipPick = !on;
    }
    if (q && !any) {
      // B4：无匹配 → 给一条可点的回首页引导
      byId('uniHints').innerHTML = '没有匹配「<b>' + esc(q) + '</b>」的星球，试试别的关键词 🔍<br>' +
        '<button class="uni-cta" id="uniSearchCta">去收藏与选题搜搜看</button>';
      var sc = byId('uniSearchCta');
      if (sc) sc.addEventListener('click', function () { if (window.showView) window.showView('home'); });
    } else {
      byId('uniHints').innerHTML = q ? '' : '🖱 <b>拖拽</b>旋转 · <b>滚轮</b>缩放 · <b>点星体</b>查看 / 进入学习 · 星星大小 = 热度 · <b>看山</b>会随天气换动作';
    }
  }

  /* ---------------- 星体选择卡 ---------------- */
  function closeCard() { var c = byId('uniCard'); c.classList.remove('on'); c.classList.remove('uc-unlearned'); }
  /* B1：未习得选题的降级卡（星海里没有这颗星时的点击反馈） */
  function renderUnlearnedCard(t, id) {
    var th = themeOf(t.cat), col = t.custom ? '#9aa4b2' : th.color;
    var card = byId('uniCard');
    card.innerHTML =
      '<button class="uc-close" id="ucClose">✕</button>' +
      '<div class="uc-head"><span class="uc-ico" style="background:' + (t.custom ? 'linear-gradient(135deg,#9aa4b2,#5f6b7a)' : 'linear-gradient(135deg,' + col + ',#7c5cff)') + '">' + (t.custom ? '🧪' : th.icon) + '</span><div class="uc-q">' + esc(t.q) + '</div></div>' +
      '<div class="uc-meta"><span class="tg">' + esc(th.name) + '</span><span class="tg">' + fmtV(t.votes) + ' 赞同</span>' + (t.time ? '<span class="tg">' + esc(t.time) + '</span>' : '') + '</div>' +
      '<div class="uc-core">核心观点：' + esc(t.core || '') + '</div>' +
      '<div class="uc-dim">✨ 这颗星还没被点亮 —— 学完（点「学懂」）它就会挂进星海</div>' +
      '<div class="uc-acts"><button class="b1 learn" id="ucLearn">进入学习</button><button class="b1 read" id="ucRead">读原文</button></div>';
    card.classList.add('on');
    card.classList.add('uc-unlearned');
    byId('ucClose').addEventListener('click', function () { closeCard(); selId = null; });
    byId('ucLearn').addEventListener('click', function () {
      U.exit();
      if (window.enterFlow) window.enterFlow(id);
      else if (window.showView) window.showView('flow');
    });
    byId('ucRead').addEventListener('click', function () { rdOpen(id); });
    foxSay('<b>🦊 看山：</b>这篇还在收藏夹里睡觉 😴 点「开始学」，炼完它就是一颗新星！', 5200);
    uniSfx('pick');
  }
  function selectStar(id, focusCam) {
    var t = topicById(id); if (!t) return;
    selId = id;
    var st = findStar(id);
    // D2：已习得但不在当前层（概览/其他分类）→ 自动切全量平铺再定位
    if (!st && S().learned && S().learned[id] && scope !== '*') { setScope('*', true); st = findStar(id); }
    if (!st) { renderUnlearnedCard(t, id); return; } // B1：未习得 → 降级卡，不再静默无反应
    if (focusCam) focusStar(st);
    var th = themeOf(t.cat), col = t.custom ? '#9aa4b2' : th.color;
    var learned = !!(S().learned && S().learned[id]);
    var progSteps = learned ? 5 : ((S().records && S().records[id]) ? 4 : 0); // 批次0：炉温冶炼进度
    var progXp = S().xp || 0;
    var card = byId('uniCard');
    card.innerHTML =
      '<button class="uc-close" id="ucClose">✕</button>' +
      '<div class="uc-head"><span class="uc-ico" style="background:' + (t.custom ? 'linear-gradient(135deg,#9aa4b2,#5f6b7a)' : 'linear-gradient(135deg,' + col + ',#7c5cff)') + '">' + (t.custom ? '🧪' : th.icon) + '</span><div class="uc-q">' + esc(t.q) + '</div></div>' +
      '<div class="uc-meta"><span class="tg">' + esc(th.name) + '</span><span class="tg">' + fmtV(t.votes) + ' 赞同</span>' + (t.time ? '<span class="tg">' + esc(t.time) + '</span>' : '') + (learned ? '<span class="tg tg-learned">✓ 已学懂</span>' : '') + '</div>' +
      '<div class="uc-core">核心观点：' + esc(t.core || '') + '</div>' +
      '<div class="uc-prog"><div class="uc-prog-t"><span>冶炼进度 · ' + progSteps + '/5 步</span><span class="uc-prog-xp">🔥 炉温 ' + progXp + '</span></div><div class="uc-bar"><i style="width:' + (progSteps * 20) + '%"></i></div></div>' +
      '<div class="uc-acts"><button class="b1 learn" id="ucLearn">' + (learned ? '再炼一遍' : '进入学习') + '</button><button class="b1 read" id="ucRead">读原文</button><button class="b1 mind" id="ucMind">思维导图</button></div>';
    card.classList.add('on');
    byId('ucClose').addEventListener('click', function () { closeCard(); selId = null; });
    byId('ucLearn').addEventListener('click', function () {
      U.exit();
      if (window.enterFlow) window.enterFlow(id);
      else if (window.showView) window.showView('flow');
    });
    byId('ucRead').addEventListener('click', function () { rdOpen(id); });
    var _ucm = byId('ucMind'); if (_ucm) _ucm.addEventListener('click', function () { openUniMind(id); });
    foxSay('<b>🦊 看山：</b>' + (learned ? '这颗你已经炼过啦，再点「开始学」可以二刷巩固～' : '选它没错，点「开始学」，我把炉火给你点上 🔥'), 5200);
    uniSfx('pick');
    // 高亮匹配星体
    for (var j = 0; j < stars.length; j++) {
      var s2 = stars[j];
      var is = s2.id === id;
      s2.mesh.material.emissiveIntensity = is ? 0.9 : (s2.learned ? 0.55 : 0.2);
    }
  }
  function focusStar(st) {
    focus = { p: new T.Vector3(st.base[0] * 0.45, st.base[1] * 0.45, st.base[2] * 0.45), dist: st.r * 9 + 4.2 };
    camState.auto = false;
  }

  /* ---------------- D2：分层切换（概览 ⇄ 分类 ⇄ 全量平铺） ---------------- */
  function ensureCrumb() {
    if (byId('uniCrumb')) return true;
    var top = document.querySelector('.uni-top');
    var acts = top && top.querySelector('.uni-actions');
    if (!acts) return false;
    var b = document.createElement('button');
    b.id = 'uniCrumb'; b.className = 'uni-crumb'; b.textContent = '← 全部星域';
    b.title = '返回概览星团';
    b.addEventListener('click', function () { setScope(null); });
    top.insertBefore(b, acts); // 顶栏安放：天气组与右侧功能区之间，避免与时钟/提示重叠
    return true;
  }
  function paintCrumb() {
    var b = byId('uniCrumb'); if (!b) return;
    b.classList.toggle('on', !!scope && scope !== '*');
  }
  function setScope(s, silent) {
    scope = s;
    rebuildTopics();
    buildEdges();
    ensureCrumb(); paintCrumb();
    closeCard(); selId = null;
    if (s === null) {
      focus = null; camState.auto = true; ensureCamVec(); focusP.set(0, 2.6, 0);
    }
    if (!silent) {
      if (s && s !== '*') {
        var th = themeOf(s);
        foxSay('<b>🦊 看山：</b>钻进「' + th.icon + ' ' + th.name + '」星域啦，这里的星都属于这一类 ✨', 3600);
      } else if (s === null && stars.length) {
        foxSay('<b>🦊 看山：</b>回到全览星域～', 2600);
      }
    }
    applySearchInner((byId('uniSearch').value || '').toLowerCase().trim());
  }
  /* 点击星团 → 镜头飞行后重建为该分类平铺层 */
  function drillCluster(st) {
    if (!st.count) return; // 空分类不进（概览层本就不渲染空分类，双保险）
    focus = { p: new T.Vector3(st.base[0] * 0.45, st.base[1] * 0.45, st.base[2] * 0.45), dist: st.r * 6.5 + 4.5 };
    camState.auto = false; camState.idle = 0;
    uniSfx('open');
    var cat = st.cat;
    setTimeout(function () { if (active && scope === null) setScope(cat); }, 700);
  }
  function findStar(id) {
    for (var i = 0; i < stars.length; i++) if (stars[i].id === id && !stars[i].isCluster) return stars[i];
    return null;
  }

  /* ---------------- 渲染主循环 ---------------- */
  /* B6：阅读器/热榜/已习得面板/导图覆盖层任一打开 → 3D 渲染降频至约 12fps，轻量更新保留 */
  var frameNo = 0;
  function overlayOpen() {
    return byId('uniReader').classList.contains('on')
      || byId('uniHotPanel').classList.contains('on')
      || (byId('uniKnowPanel') && byId('uniKnowPanel').classList.contains('on'))
      || (byId('uniMind') && byId('uniMind').classList.contains('on'));
  }
  var last = 0, eTime = 0, lastBirthScan = 0;
  /* E4：?fps=1 帧率角标（左上角，每秒刷新） */
  var fpsBadge = null, fpsFrames = 0, fpsLastT = 0;
  if (location.search.indexOf('fps=1') >= 0) {
    fpsBadge = document.createElement('div');
    fpsBadge.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:rgba(0,0,0,.55);color:#7CFFB2;font:12px/1.6 monospace;padding:2px 8px;border-radius:6px;pointer-events:none;';
    fpsBadge.textContent = 'fps --';
    if (document.body) document.body.appendChild(fpsBadge);
    else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(fpsBadge); });
  }
  function fpsTick() {
    if (!fpsBadge) return;
    fpsFrames++;
    if (!fpsLastT) { fpsLastT = eTime; return; }
    if (eTime - fpsLastT >= 1) {
      fpsBadge.textContent = 'fps ' + Math.round(fpsFrames / (eTime - fpsLastT));
      fpsFrames = 0; fpsLastT = eTime;
    }
  }
  function tick(ts) {
    if (!active) return;
    rafId = requestAnimationFrame(tick);
    var dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    eTime += dt;
    envFrame(dt);
    applyEnv();
    fpsTick();
    try { ambTickCheck(eTime); } catch (e) {} // D1：氛围音静音检查（音量走 setTargetAtTime 直达目标）
    // 星体微浮动 & 选中脉冲 & E1 星糖质感驱动
    var dimBase = 0.62 + 0.38 * clamp((ENV.cur.dirI || 0) / 1.1, 0, 1); // 星体随天气明暗（晴亮雨暗）
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      if (!st.group.visible) continue;
      st.group.position.y = st.base[1] + Math.sin(eTime * 0.8 + i * 1.7) * 0.05;
      var scl = 1;
      if (birthFlying[st.id]) scl = 0.001; // E3：诞生飞行途中目标星保持隐藏
      else if (st.born) { // E3：落位弹性胀开
        var bk = Math.min(1, (eTime - st.born) / 0.7);
        scl *= elasticOut(bk);
        if (bk >= 1) st.born = 0;
      }
      if (st.id === selId) scl = 1.13 + Math.sin(eTime * 3) * 0.03;
      st.group.scale.setScalar(scl);
      if (!st.isCluster) {
        st.mesh.rotation.y += dt * st.spin; // E1：每星极慢自转（按 id hash 差异化）
        if (st.mat.uniforms) {
          st.mat.uniforms.uTime.value = eTime;
          st.mat.uniforms.uDim.value = dimBase;
          if (st.flashAt) { // E3：诞生落位闪白衰减（1.3 倍峰值）
            var fk = (eTime - st.flashAt) / 0.8;
            st.mat.uniforms.uHi.value = fk >= 1 ? 0 : (1 - fk) * 1.3;
            if (fk >= 1) st.flashAt = 0;
          }
        }
      }
      if (st.learned) { // E1：呼吸式发光纳入天气通道 starO/dustO
        st.glow.material.opacity = (ENV.cur.starO != null ? ENV.cur.starO : 0.8) * (0.42 + 0.2 * Math.sin(eTime * 2.4 + i));
        if (st.halo) st.halo.material.opacity = (ENV.cur.dustO != null ? ENV.cur.dustO : 0.7) * (0.14 + 0.05 * Math.sin(eTime * 1.7 + i * 2.1));
      }
    }
    // E2：糖丝流动 shader 时间推进
    for (var eI = 0; eI < edges.length; eI++) {
      if (edges[eI].mat2 && edges[eI].mat2.uniforms) edges[eI].mat2.uniforms.uTime.value = eTime;
    }
    // E3：新星诞生动画推进
    stepBirthAnims(eTime);
    // E3：宇宙内学新篇的兜底轮询（每 2s 一次，队列空时几乎零成本）
    if (eTime - lastBirthScan > 2) { lastBirthScan = eTime; try { playPendingBirth(); } catch (e) { } }
    // 流动光点
    updateFlows(dt);
    // 炉火（批次0：3D 炉体已移除，火星动画随之删除；底部 CSS 熔炉接管）
    var t3 = eTime;
    // 轨道环旋转
    for (var rI = 0; rI < rings.length; rI++) {
      rings[rI].m.rotation.z += dt * rings[rI].sp;
    }
    // 雨 / 雪粒子
    updateRainSnow(dt, t3);
    // 极光流动
    if (auroraMesh.visible) { auroraMesh.material.uniforms.uT.value = t3 * (0.25 + 0.4 * ENV.cur.aurSp); auroraMesh.rotation.y = t3 * 0.02; }
    // 星尘自转
    dustPts.rotation.y += dt * 0.012 * ENV.cur.dustS;
    dustPts.rotation.x = 0.14;
    farStars.rotation.y += dt * 0.002;
    // 相机（含：拖拽停止 9s 后恢复自转）
    if (camState.auto === false && !drag && !focus) {
      camState.idle = (camState.idle || 0) + dt;
      if (camState.idle > 9) { camState.auto = true; camState.idle = 0; }
    } else if (drag || focus) { camState.idle = 0; }
    orbitUpdate(dt, t3);
    // 看山（B6：阅读器打开时跳过投影，省一次矩阵开销）
    if (!byId('uniReader').classList.contains('on')) projectFox();
    if (Math.floor(t3) % 14 === 0 && foxTipTick !== Math.floor(t3 / 14)) { foxTipTick = Math.floor(t3 / 14); if (!overlayOpen()) foxAutoTip(); }
    // 时钟
    paintClock();
    // B6：覆盖层打开时仅每 5 帧渲染一次（≈12fps），其余逻辑照常
    frameNo++;
    if (!overlayOpen() || frameNo % 5 === 0) { renderer.render(scene, camera); U.renders = (U.renders || 0) + 1; } // U.renders：B6 验收计数
  }
  var foxTipTick = -1;
  function updateRainSnow(dt, t3) {
    // 雨
    if (rainMesh.visible) {
      var ud = rainMesh.userData, p = ud.pos, n = ud.n;
      for (var i = 0; i < n; i++) {
        var s = ud.seed[i], spd = ud.speeds[i] * (0.5 + ENV.cur.dustS);
        // 简化：固定区间下落重生
        var life = ((t3 * spd + s) % 1);
        var px = (s * 31.7) % 24 - 12 + Math.sin(t3 * 2 + s * 9) * 0.6;
        var py = life * 26 - 13;
        var pz = (s * 17.3) % 22 - 11 + Math.cos(t3 * 1.7 + s * 5) * 0.5;
        p[i * 6] = px; p[i * 6 + 1] = py; p[i * 6 + 2] = pz;
        p[i * 6 + 3] = px + 0.03; p[i * 6 + 4] = py - 0.62; p[i * 6 + 5] = pz;
      }
      rainMesh.geometry.attributes.position.needsUpdate = true;
    }
    if (snowMesh.visible) {
      var ud2 = snowMesh.userData, p2 = ud2.pos, n2 = ud2.n;
      for (var j = 0; j < n2; j++) {
        var s2 = ud2.seed[j], spd2 = ud2.speeds[j];
        var life2 = ((t3 * 0.3 + s2) % 1);
        p2[j * 3] = ((s2 * 23.1) % 26) - 13 + Math.sin(t3 * 0.6 + s2 * 8) * 2.2;
        p2[j * 3 + 1] = life2 * 24 - 12;
        p2[j * 3 + 2] = ((s2 * 11.9) % 20) - 10 + Math.cos(t3 * 0.5 + s2 * 6) * 1.6;
      }
      snowMesh.geometry.attributes.position.needsUpdate = true;
    }
  }
  var lastClock = 0;
  function paintClock() {
    if (now() - lastClock < 900) return;
    lastClock = now();
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2), ss = ('0' + d.getSeconds()).slice(-2);
    byId('uniClockT').textContent = hh + ':' + mm + ':' + ss;
    var wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    byId('uniClockD').textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + wd;
    var tod = todOfHour(currentHour());
    var w = WEATHERS[curWeather || 'sunny'];
    var envS = '';
    if (curServer && curServer.live) envS = (curServer.city ? curServer.city + ' · ' : '') + (curServer.weatherName ? curServer.weatherName + (curServer.temp != null ? ' ' + curServer.temp + '°C' : '') : '') + ' · ';
    byId('uniClockS').textContent = envS + tod.label + ' · ' + w.ico + ' ' + w.name + (liveHint || '');
  }

  /* ---------------- 后端探测（WebSocket / REST，可选） ---------------- */
  function probeBackend() {
    // 环境文本默认
    byId('uniEnvTxt').textContent = '本地演示数据';
    byId('uniEnv').classList.remove('live');
    // 同源（node server 托管）优先
    var isHttp = /^https?:/.test(location.protocol || '');
    var base = isHttp ? location.origin : 'http://127.0.0.1:8787';
    function applyHot(payload) {
      if (!payload || !payload.items || !payload.items.length) return;
      curServer = curServer || {};
      curServer.hot = payload.items.map(function (it, i) { return { rank: i + 1, id: it.id || it.key, q: it.q || it.title, cat: it.cat || 'work', votes: it.votes || 0, custom: false, link: it.url || '' }; });
      curServer.live = true;
      paintHot();
    }
    function applyEnv2(payload) {
      if (!payload) return;
      var cur = payload.weather || payload.env || {};
      if (cur.weather || cur.code) {
        var map = { sunny: 'sunny', clear: 'sunny', cloudy: 'cloudy', overcast: 'cloudy', rain: 'rain', snow: 'snow', aurora: 'aurora' };
        var w2 = map[cur.weather] || map[cur.code] || null;
        if (w2 && w2 !== curWeather) {
          if (followLive) { setWeather(w2, true); }
          else if (!liveHintShown) {
            // B2：手动模式 —— 不自动切，只在时钟行尾追加一次性提示
            liveHintShown = true;
            liveHint = ' · 实时：' + WEATHERS[w2].ico + ' ' + WEATHERS[w2].name;
            lastClock = 0; paintClock();
          }
        }
        curServer = curServer || {};
        curServer.city = cur.city || null;
        curServer.temp = cur.temp != null ? cur.temp : null;
        curServer.weatherName = cur.name || cur.text || WEATHERS[w2 || 'sunny'].name;
        curServer.live = true;
        curServer.weather = w2;
      }
      byId('uniEnvTxt').textContent = (curServer && curServer.live) ? ((curServer.city ? curServer.city + ' · ' : '') + (curServer.weatherName || '') + (curServer.temp != null ? ' ' + curServer.temp + '°C' : '') + ' · 实时推送') : '本地演示数据';
      byId('uniEnv').classList.toggle('live', !!(curServer && curServer.live));
    }
    function fetchJSON(url, cb, fail) {
      try {
        var x = new XMLHttpRequest();
        x.open('GET', url, true);
        x.timeout = 1600;
        x.onload = function () { try { cb(JSON.parse(x.responseText)); } catch (e) { fail && fail(); } };
        x.onerror = function () { fail && fail(); };
        x.ontimeout = function () { fail && fail(); };
        x.send();
      } catch (e) { fail && fail(); }
    }
    // 先探测本机后端 8787（离线演示时的官方配套服务）
    fetchJSON(base + '/api/health', function (h) {
      if (h && h.ok) {
        try {
          var ws = new WebSocket((isHttp ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host : 'ws://127.0.0.1:8787') + '/ws');
          ws.onmessage = function (ev) {
            try {
              var m = JSON.parse(ev.data);
              if (m.type === 'hotlist') applyHot(m.data || m);
              if (m.type === 'env') applyEnv2(m.data || m);
            } catch (e) {}
          };
          ws.onerror = function () { ws.close(); };
          if (window.ReckonUniverse) window.ReckonUniverse.__ws = ws;
        } catch (e) {}
        fetchJSON(base + '/api/hotlist', function (d) { applyHot(d); showHot(); });
        fetchJSON(base + '/api/env', function (d) { applyEnv2(d); });
      }
    }, function () {
      // 无后端：本地兜底（示例热榜照常显示，环境用本地时间）
    });
  }

  /* ---------------- 天气 API ---------------- */
  function setWeather(key, silent) {
    if (!WEATHERS[key]) key = 'sunny';
    curWeather = key;
    storeSet(WEATHER_STORE_KEY, key);
    ENV.active.w = WEATHERS[key];
    paintWeatherBtns();
    foxGif(WEATHERS[key].fox);
    foxGifIdx = 0;
    try { ambSetWeather(key); } catch (e) {} // D1：雨/雪氛围音随天气切换
    if (!silent) {
      uniSfx('weather');
      foxSay('<b>🦊 看山：</b>' + (key === 'sunny' ? '晴天！晒晒知识，粒子都懒洋洋的 ☀️' : key === 'cloudy' ? '多云天，适合托腮想一想 🌤️' : key === 'rain' ? '下雨了，快缩到炉边躲躲 🌧️' : key === 'snow' ? '下雪啦，看山搓搓手 ❄️' : '看，极光！知识也在发光 🌌'), 4200);
    }
    if (window.__rkOnWeather) { try { window.__rkOnWeather(key); } catch (e) {} }
  }

  /* ---------------- 初始化 / 进入 / 退出 ---------------- */
  function checkWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  /* 批次0·熔炉核心：底部 CSS 熔炉（替代已移除的 3D 中央炼金炉），JS 注入、幂等 */
  function injectHearth() {
    var shell = byId('uniShell');
    if (!shell || byId('uniHearth')) return;
    var hz = document.createElement('div');
    hz.id = 'uniHearth';
    hz.setAttribute('aria-hidden', 'true');
    hz.innerHTML = '<div class="uh-ticks"></div><div class="uh-ring"></div><div class="uh-glow"></div>' +
      '<div class="uh-embers"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
    shell.appendChild(hz);
    // 设计稿 v2：悬停熔炉浮出「炉温·等级」浮标（真实数据；mouseenter 判定，不加 pointer-events 以免挡画布拖拽）
    var lv = document.createElement('div');
    lv.className = 'uh-lv'; lv.id = 'uniHearthLv';
    hz.appendChild(lv);
    shell.addEventListener('mousemove', function (e) {
      var r = hz.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside && !lv.classList.contains('on')) { fillHearthLv(lv); lv.classList.add('on'); }
      else if (!inside && lv.classList.contains('on')) lv.classList.remove('on');
    });
  }
  function fillHearthLv(el) {
    var xp = 0, name = '炼金学徒', pct = 0, streak = 0;
    try {
      if (window.S) { xp = window.S.xp || 0; streak = window.S.streak || 0; }
      if (typeof window.levelInfo === 'function') { var li = levelInfo(); name = li.lv.name; pct = li.pct; }
    } catch (e) {}
    el.innerHTML = '🔥 炉温 ' + xp + ' · ' + name +
      ' <span class="xpb"><i style="width:' + Math.round(pct) + '%"></i></span>' +
      ' <span style="color:rgba(255,220,160,.72);font-weight:400">连炼 ' + streak + ' 篇</span>';
  }
  U.init = function () {
    if (ready) return;
    T = window.THREE;
    if (!T) { return; }
    if (!checkWebGL()) {
      byId('uniLoadTxt').textContent = '当前浏览器不支持 WebGL，无法开启沉浸式 3D（其余功能不受影响）。';
      byId('uniLoad').classList.add('on');
      byId('uniLoad').classList.add('err');
      ready = true; // 避免反复尝试
      return;
    }
    glowTex = makeGlowTex();
    softTex = makeParticleTex(true);
    try {
      buildScene();
    } catch (e) {
      byId('uniLoadTxt').textContent = '3D 启动失败：' + (e && e.message ? e.message : e);
      byId('uniLoad').classList.add('on');
      byId('uniLoad').classList.add('err');
      ready = true;
      return;
    }
    // 初始化环境色
    ENV.cur = {
      skyTop: [0.1, 0.22, 0.55], skyBot: [0.37, 0.62, 0.85], fogC: [0.12, 0.2, 0.4], fogD: 0.05,
      ambC: [0.62, 0.72, 1], ambI: 0.4, hemiI: 0.5, dirC: [1, 0.89, 0.69], dirI: 1.0, dirH: 0.75,
      glowC: [1, 0.77, 0.42], glowI: 0.5, starO: 0.8, dustO: 0.7, dustS: 1,
      aurA: 0, aurSp: 0, rainA: 0, snowA: 0
    };
    ok = true;
    ready = true;
    ensureCamVec();
    paintWeatherBtns();
    injectHearth();
    bindReader();
    // 天气按钮点击（B2：手动点天气 → 进入手动模式并一次性提示；🛰 为跟随实时开关）
    var box = byId('uniWeather');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.wbtn') || e.target.closest('.wbtn-live');
      if (!b) return;
      if (b.hasAttribute('data-live')) { toggleFollowLive(); return; }
      if (followLive) {
        followLive = false;
        storeSet('followLive', false);
        paintWeatherBtns();
        toastU('已切换为手动天气，点「跟随实时」可恢复自动', 0);
      }
      setWeather(b.getAttribute('data-w'), false);
    });
    // 搜索
    var si = byId('uniSearch');
    si.addEventListener('input', function () { applySearch(si.value); });
    si.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
    // 热榜开关
    byId('uniHotBtn').addEventListener('click', function () {
      if (byId('uniHotPanel').classList.contains('on')) hideHot();
      else { paintHot(); showHot(); }
    });
    byId('uniHotClose').addEventListener('click', hideHot);
    // 返回按钮
    byId('uniBack').addEventListener('click', function () { U.exit(); if (window.showView) window.showView('home'); });
    // 看山点击 → 玩一下
    byId('uniFox').addEventListener('click', function () {
      if (foxSayT) clearTimeout(foxSayT);
      foxGifIdx = (foxGifIdx + 1) % FOX_GIFS.length;
      foxGif(FOX_GIFS[foxGifIdx]);
      foxSay('<b>🦊 看山：</b>' + '嘿！我在呢～点顶部天气按钮，我会换动作哦 😉', 3500);
      setTimeout(function () { foxGif(WEATHERS[curWeather || 'sunny'].fox); }, 3600);
    });
    // 画布交互
    bindCanvas();
    // D1：浏览器自动播放策略 —— 首次手势后 resume 音频上下文并补齐氛围音
    document.addEventListener('pointerdown', function __ambResume() {
      document.removeEventListener('pointerdown', __ambResume);
      try {
        if (AC && AC.state === 'suspended') AC.resume();
        if (active) ambSetWeather(curWeather || 'sunny');
      } catch (e) {}
    });
    // 时钟初始化
    paintClock();
    ready = true;
  };
  function bindCanvas() {
    var el = byId('uniCanvas');
    var down = null;
    function pickAt(e) {
      var rect = el.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      var y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      var rc = new T.Raycaster();
      rc.setFromCamera(new T.Vector2(x, y), camera);
      var meshes = [];
      for (var i = 0; i < stars.length; i++) {
        if (stars[i].group.visible && !stars[i].mesh.userData.skipPick) meshes.push(stars[i].mesh);
      }
      var hits = rc.intersectObjects(meshes, false);
      return hits.length ? stars[hits[0].object.userData.starIdx] : null;
    }
    function pointerUp(e) {
      if (drag && drag.moved < 6) {
        var st = pickAt(e);
        if (st) { if (st.isCluster) drillCluster(st); else selectStar(st.id, false); }
      }
      drag = null;
      el.classList.remove('grab2');
    }
    function pointerMove(e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        var moved = Math.sqrt(dx * dx + dy * dy);
        if (moved > 2.5) drag.moved = moved;
        if (drag.moved > 4) {
          camState.yaw -= dx * 0.0055;
          camState.pitch = clamp(camState.pitch + dy * 0.0042, 0.12, 1.45);
          camState.auto = false;
          camState.idle = 0;
          drag.x = e.clientX; drag.y = e.clientY;
          focus = null;
        }
      } else {
        var st2 = pickAt(e);
        el.style.cursor = st2 ? 'pointer' : 'grab';
        hoverStar = st2;
      }
    }
    /* C2：双指捏合缩放 —— 跟踪多 pointer，按间距比例调 camState.dist（与滚轮同档 5–42） */
    var pts = {}, pinch = null;
    function twoPts() {
      var ids = Object.keys(pts);
      if (ids.length < 2) return null;
      var a = pts[ids[0]], b = pts[ids[1]];
      var dx = a.x - b.x, dy = a.y - b.y;
      return { a: a, b: b, d: Math.sqrt(dx * dx + dy * dy) };
    }
    el.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (twoPts()) {
        pinch = { d: twoPts().d };
        drag = null; // 捏合优先于拖拽旋转
        el.classList.remove('grab2');
      } else {
        drag = { x: e.clientX, y: e.clientY, moved: 0 };
      }
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId]) { pts[e.pointerId].x = e.clientX; pts[e.pointerId].y = e.clientY; }
      if (pinch) {
        var tp = twoPts();
        if (tp && tp.d > 1) {
          camState.dist = clamp(camState.dist * (pinch.d / tp.d), 5, 42);
          camState.auto = false; camState.idle = 0;
          pinch.d = tp.d;
        }
        return;
      }
      pointerMove(e);
    });
    function dropPtr(e) {
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) pinch = null;
      if (e.type === 'pointerup') pointerUp(e);
      if (e.type === 'pointercancel' || e.type === 'pointerleave') { drag = null; el.classList.remove('grab2'); }
    }
    el.addEventListener('pointerup', dropPtr);
    el.addEventListener('pointercancel', dropPtr);
    el.addEventListener('pointerleave', function () { drag = null; });
    // C2/D2：双击命中星体 → 聚焦并出卡；命中星团 → 钻进分类
    el.addEventListener('dblclick', function (e) {
      var st = pickAt(e);
      if (st) { if (st.isCluster) drillCluster(st); else selectStar(st.id, true); }
    });
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      camState.dist = clamp(camState.dist * (1 + e.deltaY * 0.0011), 5, 42);
    }, { passive: false });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('resize', function () {
      if (!active) return;
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight, false);
    });
  }
  U.enter = function () {
    if (!ready) { U.init(); }
    if (!ready || !ok) {
      // 初始化失败也要给出可见反馈（原因已写入 #uniLoadTxt），避免“点了没反应”
      byId('uniShell').classList.add('on');
      byId('uniShell').setAttribute('aria-hidden', 'false');
      byId('uniLoad').classList.add('on');
      if (window.__rkOnUniverseFail) { try { window.__rkOnUniverseFail(); } catch (e) {} }
      return;
    }
    active = true;
    byId('uniShell').classList.add('on');
    byId('uniShell').setAttribute('aria-hidden', 'false');
    byId('uniLoad').classList.remove('on');
    byId('uniLoad').classList.remove('err');
    // 尺寸（可能刚从 display:none 显示）
    var el = byId('uniCanvas');
    var w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
    if (w && h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    // 重建话题（自定义选题可能变化）—— D2：每次进入回到概览层，有搜索词则自动平铺
    scope = null;
    rebuildTopics();
    buildEdges();
    ensureCrumb(); paintCrumb();
    applySearch((byId('uniSearch').value || '').trim());
    // 恢复上次天气
    var saved = storeGet(WEATHER_STORE_KEY, 'sunny');
    curWeather = null;
    setWeather(WEATHERS[saved] ? saved : 'sunny', true);
    try { ambSetWeather(curWeather); } catch (e) {} // D1：重进宇宙恢复氛围音
    // 热榜 & 后端探测（每次进入都快速探测一次）
    paintHot();
    probeBackend();
    focusStarFromNone();
    last = 0;
    rafId = requestAnimationFrame(tick);
    foxSay('<b>🦊 看山：</b>欢迎来到炼金宇宙！这里的每一颗星，都是你收藏夹里的一篇好回答 ✨', 5200);
  };
  function focusStarFromNone() {
    ensureCamVec();
    // 相机微调看向整体（居中）——对准批次0抬升后的星带
    focusP.set(0, 2.6, 0);
  }
  U.exit = function () {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);
    byId('uniShell').classList.remove('on');
    byId('uniShell').setAttribute('aria-hidden', 'true');
    closeCard();
    hideHot();
    hideKnow(); // 退出时一并收起，避免重进宇宙时面板还挂着
    try { closeUniMind(); } catch (e) {}
    try { if (AMB.rain) AMB.rain.target = 0.0001; if (AMB.snow) AMB.snow.target = 0.0001; } catch (e) {} // D1：退出宇宙氛围音淡出
    if (rd.topic) rdClose();
    if (U.__ws) { try { U.__ws.close(); } catch (e) {} U.__ws = null; }
  };
  U.setWeather = setWeather;
  U.openReader = rdOpen;
  U.currentWeather = function () { return curWeather; };
  U.applyWeatherToScene = setWeather;
  U.diag = function () {
    var pts = 0;
    if (scene) scene.traverse(function (o) { if (o.isPoints) pts++; }); // A1 验收用：场景内 Points 计数
    return { ready: ready, ok: ok, active: active, stars: stars.length, edges: edges.length, points: pts, fogD: scene && scene.fog ? scene.fog.density : null, weather: curWeather || null, renders: U.renders || 0, followLive: followLive, scope: scope, pr: renderer ? renderer.getPixelRatio() : null, labelTex: Object.keys(labelTexCache).length, hasThree: !!window.THREE };
  };
  /* C1/C2/D1 验收用只读调试句柄（相机/星体/轨道状态引用，外部勿改） */
  U.debug = function () {
    return {
      camState: camState, camera: camera, stars: stars, renderer: renderer, labelTexCache: labelTexCache, edges: edges,
      amb: { rain: AMB.rain ? +AMB.rain.gain.gain.value.toFixed(4) : null, snow: AMB.snow ? +AMB.snow.gain.gain.value.toFixed(4) : null, rainT: AMB.rain ? AMB.rain.target : null, snowT: AMB.snow ? AMB.snow.target : null, muted: AMB.muted }
    };
  };

/* ============================================================
   v7 · 宇宙侧整合模块（IIFE 内部，末尾）
   1) 星体只放"已标注为习得"的文章（配合 graphLayout / buildEdges 的改动）
   2) 新增「📚 已习得」面板：整合原「思维图谱」与「知识库」的全部内容
   3) 每篇已习得文章附带「🧠 绘制思维导图」小工具（复用 app.js 的完整 DIY 编辑器）
   ============================================================ */

  /* ---------- 已习得清单（与 graphLayout 同一口径） ---------- */

  /* ---------- 思维导图覆盖层 ---------- */
  function ensureMindOverlay() {
    if (byId('uniMind')) return;
    var ov = document.createElement('div');
    ov.className = 'uni-mind';
    ov.id = 'uniMind';
    ov.innerHTML =
      '<div class="um-box">' +
      '<div class="um-head"><b>🧠 绘制思维导图</b><span id="umTitle"></span>' +
      '<button class="x" id="umClose">✕ 收起</button></div>' +
      '<div class="um-body" id="umHost"></div></div>';
    document.body.appendChild(ov);
    byId('umClose').addEventListener('click', closeUniMind);
  }
  function openUniMind(id) {
    var t = topicById(id); if (!t) return;
    if (!(window.S && window.S.records && window.S.records[id])) {
      toastU('这篇还没有学完 —— 学完才会有图谱可以画哦', 0); return;
    }
    if (!window.renderMindMap || !window.bindMindMap) { toastU('编辑器未就绪', 0); return; }
    ensureMindOverlay();
    /* 关键：学习流程页里可能还留着第 4 步的编辑器 DOM，先清掉，
       否则 #mmSvg / #mmZoom / .mm-node 等选择器会撞到那边去 */
    var fb = document.getElementById('flowBody'); if (fb) fb.innerHTML = '';
    byId('umTitle').textContent = t.q;
    byId('uniMind').classList.add('on');
    var host = byId('umHost');
    host.innerHTML = window.renderMindMap(t, 'umHost');
    window.bindMindMap(t, 'umHost');
    uniSfx('open');
  }
  function closeUniMind() {
    var ov = byId('uniMind'); if (ov) ov.classList.remove('on');
    uniSfx('close');
  }

  /* ---------- 「📚 已习得」面板 ---------- */
  function ensureKnowPanel() {
    if (byId('uniKnowPanel')) return;
    var shell = byId('uniShell'); if (!shell) return;
    var hud = shell.querySelector('.uni-hud') || shell;
    var btn = document.createElement('button');
    btn.className = 'uni-btn';
    btn.id = 'uniKnowBtn';
    btn.title = '只收录已标注为习得的文章 · 整合思维图谱 + 知识库';
    btn.innerHTML = '📚 已习得';
    var hotBtn = byId('uniHotBtn');
    if (hotBtn && hotBtn.parentNode) hotBtn.parentNode.insertBefore(btn, hotBtn);
    else (shell.querySelector('.uni-actions') || hud).appendChild(btn);

    var panel = document.createElement('div');
    panel.className = 'uni-panel';
    panel.id = 'uniKnowPanel';
    panel.innerHTML =
      '<div class="up-head"><b>📚 已习得知识</b><span class="src" id="uniKnowSrc"></span>' +
      '<button class="x" id="uniKnowClose" title="收起">✕</button></div>' +
      '<div class="uni-hot" id="uniKnowList"></div>';
    hud.appendChild(panel);

    btn.addEventListener('click', function () {
      if (byId('uniKnowPanel').classList.contains('on')) { hideKnow(); return; }
      paintKnow(); showKnow();
    });
    byId('uniKnowClose').addEventListener('click', hideKnow);
  }
  function showKnow() { hideHot(); closeCard(); byId('uniKnowPanel').classList.add('on'); }
  function hideKnow() { var p = byId('uniKnowPanel'); if (p) p.classList.remove('on'); }

  function paintKnow() {
    var list = byId('uniKnowList'); if (!list) return;
    var ts = uniLearnableTopics();
    var src = byId('uniKnowSrc');
    if (src) src.textContent = ts.length ? (ts.length + ' 篇已习得') : '还没有已习得';
    if (!ts.length) {
      list.innerHTML = '<div class="u-empty">炼金宇宙现在还是空的 ✨<br><br>' +
        '去「📚 收藏与选题」学完一篇：它就会作为一颗星出现在星海里，' +
        '并且自带一个「🧠 绘制思维导图」小工具；<br>' +
        '原「思维图谱」「知识库」的内容也都并到了这里。</div>';
      return;
    }
    var ls = {}; ts.forEach(function (t) { ls[t.id] = 1; });
    var pairs = window.crossPairs ? window.crossPairs() : [];
    var h = '';
    h += '<div class="uk-stat"><div><b>' + ts.length + '</b><span>已习得</span></div>' +
      '<div><b>' + pairs.length + '</b><span>共同概念</span></div>' +
      '<div><b>' + (window.levelInfo ? window.levelInfo().lv.name : '—') + '</b><span>段位 🔥</span></div></div>';
    h += '<div class="uk-sec">🗂 星海里的文章（只收录已习得）</div>';
    ts.forEach(function (t) {
      var th = themeOf(t.cat), col = t.custom ? '#9aa4b2' : th.color;
      var mm = window.mmState ? window.mmState(t) : null;
      var n = mm ? Object.keys(mm.nodes).length : 0;
      h += '<div class="uk-item">' +
        '<div class="uk-q"><span class="uk-ico" style="background:' + col + '">' + (t.custom ? '🧪' : th.icon) + '</span>' + esc(t.q) + '</div>' +
        '<div class="uk-meta"><span class="tg" style="color:' + col + ';border-color:' + col + '55">' + esc(th.name) + '</span>' +
        '<span class="tg">🕸 ' + n + ' 节点</span></div>' +
        '<div class="uk-acts">' +
        '<button class="uk-b" data-kfocus="' + t.id + '">🎯 定位</button>' +
        '<button class="uk-b gold" data-kmind="' + t.id + '">🧠 绘制思维导图</button>' +
        '<button class="uk-b" data-kread="' + t.id + '">📖 原文</button>' +
        '</div></div>';
    });
    if (pairs.length) {
      h += '<div class="uk-sec">🧬 交叉分析（原思维图谱内容）</div>';
      pairs.forEach(function (p) {
        h += '<div class="uk-cross">「<b>' + esc(trimCJK(p.a.q, 14)) + '</b>」×「<b>' + esc(trimCJK(p.b.q, 14)) +
          '</b>」都讲到了 <b style="color:#e6a23c">' + esc(p.shared.join('、')) + '</b></div>';
      });
      if (window.styleInsight) h += '<div class="uk-insight"><b>🔎 学习风格：</b>' + window.styleInsight() + '</div>';
    }
    h += '<div class="uk-sec">🧰 知识库（词条只列已习得）</div>';
    var libs = S().libs || [];
    libs.forEach(function (l) {
      var kept = (l.entries || []).filter(function (id) { return ls[id] && topicById(id); });
      var hidden = (l.entries || []).length - kept.length;
      h += '<div class="uk-lib" style="border-color:' + (l.color || '#888') + '55">' +
        '<div class="uk-libhead"><span class="li" style="background:' + (l.color || '#888') + '">' + l.icon + '</span>' +
        '<b>' + esc(l.name) + '</b><span class="dim">' + esc(l.type || '') + ' · 已习得 ' + kept.length +
        (hidden > 0 ? '（另隐藏 ' + hidden + ' 条未习得）' : '') + '</span></div>';
      kept.forEach(function (id) {
        var t = topicById(id);
        h += '<div class="uk-entry"><span>' + (t.custom ? '🧪' : themeOf(t.cat).icon) + '</span>' +
          '<span class="q">' + esc(trimCJK(t.q, 20)) + '</span>' +
          '<span class="uk-x" data-krm="' + id + '" data-klib="' + l.id + '" title="从该库移除">✕</span></div>';
      });
      if (!kept.length) h += '<div class="uk-empty2">这个库还没有已习得的词条</div>';
      (l.notes || []).forEach(function (nt) {
        h += '<div class="uk-note"><span>' + esc(nt.text) + '</span><span class="tm">' + esc(nt.tm || '') + '</span>' +
          '<span class="uk-x" data-knrm="' + nt.id + '" data-klib="' + l.id + '" title="删除">✕</span></div>';
      });
      h += '<div class="uk-noteadd"><input class="uk-in" data-knote="' + l.id + '" placeholder="记一句语录 / 心得…">' +
        '<button class="uk-b" data-kaddnote="' + l.id + '">记一条</button></div>';
      h += '</div>';
    });
    h += '<div class="uk-newlib"><input class="uk-in" id="ukLibName" placeholder="新知识库名称">' +
      '<input class="uk-in" id="ukLibType" placeholder="类型（可空）">' +
      '<button class="uk-b gold" id="ukLibCreate">＋ 新建知识库</button></div>';
    list.innerHTML = h;
    bindKnow();
  }

  function bindKnow() {
    var box = byId('uniKnowList'); if (!box) return;
    function on(sel, fn) { Array.prototype.forEach.call(box.querySelectorAll(sel), fn); }
    on('[data-kfocus]', function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-kfocus');
        var t = topicById(id);
        hideKnow();
        if (t && scope === null) setScope(t.cat); // D2：概览层下先钻进对应分类再聚焦
        selectStar(id, true);
      });
    });
    on('[data-kmind]', function (el) {
      el.addEventListener('click', function () { openUniMind(el.getAttribute('data-kmind')); });
    });
    on('[data-kread]', function (el) {
      el.addEventListener('click', function () { hideKnow(); rdOpen(el.getAttribute('data-kread')); });
    });
    on('[data-krm]', function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-krm'), lid = el.getAttribute('data-klib');
        var lib = (S().libs || []).filter(function (x) { return x.id === lid; })[0];
        if (!lib) return;
        lib.entries = (lib.entries || []).filter(function (x) { return x !== id; });
        if (window.save) window.save();
        paintKnow(); uniSfx('note');
      });
    });
    on('[data-knrm]', function (el) {
      el.addEventListener('click', function () {
        var nid = el.getAttribute('data-knrm'), lid = el.getAttribute('data-klib');
        var lib = (S().libs || []).filter(function (x) { return x.id === lid; })[0];
        if (!lib) return;
        lib.notes = (lib.notes || []).filter(function (x) { return x.id !== nid; });
        if (window.save) window.save();
        paintKnow();
      });
    });
    on('[data-kaddnote]', function (el) {
      el.addEventListener('click', function () {
        var lid = el.getAttribute('data-kaddnote');
        var inp = box.querySelector('[data-knote="' + lid + '"]');
        var v = ((inp && inp.value) || '').trim();
        if (!v) { toastU('先写一句再记', 0); return; }
        var lib = (S().libs || []).filter(function (x) { return x.id === lid; })[0];
        if (!lib) return;
        lib.notes = lib.notes || [];
        lib.notes.push({ id: 'n' + (Date.now() + Math.random()), text: v, tm: new Date().toLocaleDateString('zh-CN') });
        if (window.save) window.save();
        uniSfx('note'); toastU('已记下', 1); paintKnow();
      });
    });
    var crt = box.querySelector('#ukLibCreate');
    if (crt) crt.addEventListener('click', function () {
      var nm = ((box.querySelector('#ukLibName') || {}).value || '').trim();
      var tp = ((box.querySelector('#ukLibType') || {}).value || '').trim() || '综合';
      if (!nm) { toastU('给知识库起个名字', 0); return; }
      var ICONS = ['🧰', '📚', '💼', '💻', '✍️', '🎨', '🧠', '📒'];
      S().libs = S().libs || [];
      S().libs.push({
        id: 'lib' + (Date.now()), name: nm, type: tp,
        icon: ICONS[S().libs.length % ICONS.length],
        color: ['#e6862e', '#0f88eb', '#1fa15f', '#e05a8a', '#5b6ef5'][S().libs.length % 5],
        entries: [], notes: []
      });
      if (window.save) window.save();
      uniSfx('win'); toastU('知识库「' + nm + '」已创建', 1); paintKnow();
    });
  }

  /* ---------- 暴露与钩子 ---------- */
  U.learnableTopics = uniLearnableTopics;
  U.paintKnow = paintKnow;
  U.openMind = openUniMind;
  U.closeMind = closeUniMind;
  /* 诊断钩子：直接返回"这一轮会在星海里出现哪些文章"（与 rebuildTopics 用同一份布局结果） */
  U.starPlan = function () {
    return graphLayout().list.map(function (it) { return it.id; });
  };

  /* 面板/覆盖层注入 + 每次进入宇宙刷新一次 */
  function bootKnow() {
    try { ensureKnowPanel(); ensureMindOverlay(); ensureCrumb(); } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootKnow);
  else bootKnow();

  /* E3：扫一遍待播诞生队列；有则自动切全量平铺视图并逐颗播放 */
  function playPendingBirth() {
    var pb = birthScan();
    if (!pb || !pb.list || !pb.list.length) return;
    try { if (scope !== '*') setScope('*', true); } catch (e) { }
    playBirthQueue(pb.list.slice(), pb);
  }

  var __enterBase = U.enter;
  U.enter = function () {
    __enterBase.apply(null, arguments);
    try { bootKnow(); if (byId('uniKnowPanel')) paintKnow(); } catch (e) { }
    /* B2：每次进入宇宙重置「实时提示」（手动模式下最多提示一次） */
    try { liveHint = ''; liveHintShown = false; } catch (e) { }
    /* 星海为空时给一句引导 + B3：可点的「去挑一篇」按钮，避免空态被误认为"坏了" */
    try {
      if (stars.length === 0) {
        byId('uniHints').innerHTML = '🌌 <b>星海还是空的</b> ✨ 去「📚 收藏与选题」学完一篇（走完 拆解 → 学懂 → 回流 存进成果），它就会作为一颗星出现在这里，并自带「🧠 绘制思维导图」小工具<br>' +
          '<button class="uni-cta" id="uniEmptyCta">📚 去挑一篇点亮它</button>';
        var cta = byId('uniEmptyCta');
        if (cta) cta.addEventListener('click', function () { if (window.showView) window.showView('home'); });
      }
    } catch (e) { }
    /* E3：进入宇宙时检查待播诞生队列（诞生播放期间自动切全量平铺视图） */
    try { playPendingBirth(); } catch (e) { }
  };
  /* D2：Esc 分层返回 —— 捕获期执行，先于 boot 的「退出宇宙」监听。
     优先级：导图覆盖层 > 阅读器（其自身冒泡监听处理） > 热榜/已习得面板 > 分类层 > 退出宇宙 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var m = byId('uniMind');
    if (m && m.classList.contains('on')) { closeUniMind(); e.stopPropagation(); e.preventDefault(); return; }
    var shell = byId('uniShell');
    if (!shell || !shell.classList.contains('on')) return;
    if (byId('uniReader').classList.contains('on')) return; // 让阅读器自己的 Esc 处理
    if (byId('uniHotPanel').classList.contains('on')) { hideHot(); e.stopPropagation(); e.preventDefault(); return; }
    if (byId('uniKnowPanel') && byId('uniKnowPanel').classList.contains('on')) { hideKnow(); e.stopPropagation(); e.preventDefault(); return; }
    if (scope && scope !== '*') { setScope(null); e.stopPropagation(); }
  }, true);

  // 自动初始化（延迟，等 THREE 就绪由 boot 调用；这里只兜底）
  if (window.THREE) { setTimeout(function () { U.init(); }, 60); }
})();
