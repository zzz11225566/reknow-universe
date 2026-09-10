/* ============================================================
   炼知 ReKnow v6.5 · 炼金宇宙（沉浸式 3D）
   - 知识星体（主题）/ 炼金链路 / 中央炼金炉 / 看山动画
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
    } catch (e) {}
  }

  /* ================================================================
     天气预设：数字目标（颜色=十六进制；lerp 逐帧趋近 → ~1.5s 过渡）
     ================================================================ */
  var WEATHERS = {
    sunny: {
      name: '晴天', ico: '☀️',
      skyTop: 0x1745a8, skyBot: 0x7ec3ff, fog: 0x2f66c4, fogD: 0.028,
      ambC: 0x9db8ff, ambI: 0.5, hemiI: 0.55,
      dirC: 0xffe3b0, dirI: 1.25, dirH: 0.75,
      glowC: 0xffc46a, glowI: 0.5,
      starO: 0.25, dustO: 0.8, dustS: 1.0, aurA: 0, aurSp: 0,
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
  function envFrame(dt) {
    var w = ENV.active.w || WEATHERS.sunny;
    var tod = todOfHour(currentHour());
    if (ENV.active.freezeTod) { } // 保留（预留手动时段，暂用真实时间）
    var k = tod.k;
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
    fogNear = c.fogD;
    if (scene.fog) scene.fog.color.setRGB(c.fogC[0], c.fogC[1], c.fogC[2]);
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
  var furnaceGroup, furnaceCore, furnaceWire, firePts, fireMat;
  var foxAnchor;
  var rings = [];
  var stars = [];   // {id, group, mesh, mat, glow, label, base:[x,y,z], r, data}
  var edges = [];   // {curve, line, flows:[{pos0,pos1,t,speed,seed}]}
  var flowGeo, flowMat, flowPtsArr, flowCount;
  var clock3 = null;
  var rafId = 0, active = false, disposed = false;

  var camState = { yaw: 0.7, pitch: 0.36, dist: 16.5, auto: true, idle: 0 };
  var drag = null; // {x,y,moved}
  var hoverStar = null, selId = null;
  var focus = null; // {p:THREE.Vector3, dist, done}
  var fogNear = 0.05;

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

  function makeLabelSprite(text, colorCss) {
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
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
    var k = 1.05 / h;
    sp.scale.set(cv.width * k, h * k, 1);
    sp.userData.w = cv.width;
    return sp;
  }
  function labelOf(t) {
    var th = themeOf(t.cat);
    return (t.custom ? '🧪' : th.icon) + '  ' + trimCJK(t.q, 12);
  }

  /* ---------- 布局：围绕中央炼金炉的「轨道星带」 ---------- */
  function graphLayout() {
    var ts = allTopics();
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
      var n = arr.length, spread = 0.85, half = Math.max(0, (n - 1) / 2) * spread;
      for (var i2 = 0; i2 < n; i2++) {
        var it = arr[i2];
        var az = baseA + (i2 * spread - half) + (Math.sin(i2 * 137.5 * Math.PI / 180) * 0.12);
        var polar = 1.35 + Math.sin(it.id.length * 3.7 + catIdx * 1.9) * 0.34; // 1.0..1.7
        polar = clamp(polar, 0.9, 1.8);
        var vf = clamp(Math.log(it.votes + 200) / Math.log(16000), 0.28, 1);
        var R = lerp(Rm, RM, vf);
        var x = R * Math.sin(polar) * Math.cos(az);
        var y = R * Math.cos(polar) * 0.86;
        var z = R * Math.sin(polar) * Math.sin(az);
        it.pos = [x, y + (it.id.charCodeAt(0) % 7) * 0.05, z];
        it.r = clamp(0.34 + vf * 0.5, 0.34, 0.92);
        it.vf = vf;
        out.push(it);
      }
    }
    return { list: out, cats: cats };
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

    // 中央炼金炉
    furnaceGroup = new T.Group();
    furnaceWire = new T.Mesh(
      new T.IcosahedronGeometry(1.05, 0),
      new T.MeshBasicMaterial({ color: 0xffb45e, wireframe: true, transparent: true, opacity: 0.32, blending: T.AdditiveBlending })
    );
    furnaceGroup.add(furnaceWire);
    furnaceCore = new T.Mesh(
      new T.SphereGeometry(0.42, 40, 40),
      new T.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xff8a1e, emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.1 })
    );
    furnaceGroup.add(furnaceCore);
    var halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffa64d, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
    halo.scale.set(6.5, 6.5, 1);
    furnaceGroup.add(halo);
    // 上升火星
    var fireN = 120;
    fireMat = new T.PointsMaterial({ color: 0xff9a3c, size: 0.09, map: softTex, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
    var fg2 = new T.BufferGeometry();
    var farr = new Float32Array(fireN * 3);
    fg2.setAttribute('position', new T.BufferAttribute(farr, 3));
    firePts = new T.Points(fg2, fireMat);
    firePts.userData = { n: fireN, seed: [] };
    for (var fi = 0; fi < fireN; fi++) firePts.userData.seed.push(Math.random() * 100);
    furnaceGroup.add(firePts);
    scene.add(furnaceGroup);

    // 看山锚点（DOM 投影用）
    foxAnchor = new T.Object3D();
    foxAnchor.position.set(2.9, -1.1, 1.6);
    scene.add(foxAnchor);

    // 星体 + 链路
    rebuildTopics();
    buildEdges();

    glowTex.dispose && undefined; // 复用
  }
  function furnaceExtra() {
    var xp = S().xp || 0;
    return 0.25 + clamp(xp / 2600, 0, 0.9);
  }

  function buildRain() {
    var n = 260, g = new T.BufferGeometry();
    var pos = new Float32Array(n * 2 * 3);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    var m = new T.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.5 });
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
        for (var i = 0; i < mats.length; i++) { if (mats[i].map) mats[i].map.dispose(); mats[i].dispose(); }
      }
    });
  }
  function rebuildTopics() {
    clearStars();
    var L = graphLayout();
    var dataMap = {};
    for (var i = 0; i < L.list.length; i++) dataMap[L.list[i].id] = L.list[i];
    var ids = Object.keys(dataMap);
    for (var j = 0; j < ids.length; j++) {
      var it = dataMap[ids[j]], t = it.t, th = themeOf(t.cat);
      var grp = new T.Group();
      grp.position.set(it.pos[0], it.pos[1], it.pos[2]);
      var mat = new T.MeshStandardMaterial({
        color: new T.Color(th.color), roughness: 0.32, metalness: 0.25,
        emissive: it.learned ? new T.Color(0xffd98a) : new T.Color(th.color),
        emissiveIntensity: it.learned ? 0.55 : 0.2
      });
      var mesh = new T.Mesh(new T.SphereGeometry(it.r, 42, 42), mat);
      mesh.userData.starIdx = stars.length;
      grp.add(mesh);
      var glow = new T.Sprite(new T.SpriteMaterial({
        map: glowTex, color: new T.Color(th.color), transparent: true,
        opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(it.r * 6.2, it.r * 6.2, 1);
      grp.add(glow);
      var lbl = makeLabelSprite(labelOf(t), it.learned ? '#ffd98a' : th.color);
      lbl.position.y = it.r + 0.85;
      grp.add(lbl);
      scene.add(grp);
      stars.push({ id: it.id, group: grp, mesh: mesh, mat: mat, glow: glow, label: lbl, base: it.pos.slice(), r: it.r, learned: it.learned, it: it });
    }
  }
  /* ---------- 链路：Bezier 光带 + 流动光点 ---------- */
  function buildEdges() {
    for (var i = 0; i < edges.length; i++) {
      scene.remove(edges[i].line);
      edges[i].line.geometry.dispose(); edges[i].line.material.dispose();
    }
    edges = [];
    var byIdMap = {}; for (var s = 0; s < stars.length; s++) byIdMap[stars[s].id] = stars[s];
    var pairs = {}, arr = allTopics();
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
      var linePts = curve.getPoints(26);
      var lg = new T.BufferGeometry().setFromPoints(linePts);
      var lc = new T.Color(byIdMap[ab[0]].it.learned && byIdMap[ab[1]].it.learned ? 0xffd98a : 0x8a97d8);
      var line = new T.Line(lg, new T.LineBasicMaterial({ color: lc, transparent: true, opacity: 0.34, blending: T.AdditiveBlending, depthWrite: false }));
      scene.add(line);
      var nFlow = 2;
      edges.push({ curve: curve, line: line, nFlow: nFlow, seed: Math.random() * 7 });
    }
    // 流动光点（合并为单个 Points）
    var total = 0; for (var e2 = 0; e2 < edges.length; e2++) total += edges[e2].nFlow;
    if (total) {
      flowCount = total;
      flowGeo = new T.BufferGeometry();
      var arr2 = new Float32Array(total * 3);
      flowGeo.setAttribute('position', new T.BufferAttribute(arr2, 3));
      flowMat = new T.PointsMaterial({ color: 0xffe08a, size: 0.16, map: softTex, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
      flowPtsArr = [];
      var fi = 0;
      for (var e3 = 0; e3 < edges.length; e3++) {
        for (var n2 = 0; n2 < edges[e3].nFlow; n2++) {
          flowPtsArr.push({ edge: e3, t: Math.random(), sp: 0.12 + Math.random() * 0.1, off: fi * 0.7 });
          fi++;
        }
      }
      var fpMesh = new T.Points(flowGeo, flowMat);
      scene.add(fpMesh);
    }
  }
  function updateFlows(t) {
    if (!flowGeo) return;
    var pos = flowGeo.attributes.position.array;
    for (var i = 0; i < flowPtsArr.length; i++) {
      var f = flowPtsArr[i], e = edges[f.edge];
      f.t = (f.t + f.sp * 0.016) % 1;
      var v = e.curve.getPoint(f.t);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    flowGeo.attributes.position.needsUpdate = true;
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
    if (!camTarget) camTarget = new T.Vector3(0, 0.2, 0);
    if (!focusP) focusP = new T.Vector3(0, 0.2, 0);
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
      b.className = 'wbtn' + (k2 === curWeather ? ' on' : '');
      b.setAttribute('data-w', k2);
      b.innerHTML = '<span class="we">' + w.ico + '</span>' + w.name;
      b.title = w.name + '：' + (k2 === 'sunny' ? '暖金直射光 · 粒子稀疏慢速' : k2 === 'cloudy' ? '柔光 · 看山托腮' : k2 === 'rain' ? '冷蓝紫 · 粒子密集下落' : k2 === 'snow' ? '冷白漫射 · 雪花飘落' : '绿紫极光带 · 看山仰望');
      box.appendChild(b);
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
      } else { st.paras = null; }
    }
    rdPaintNotes();
    byId('urQ').textContent = t.q;
    var th = themeOf(t.cat);
    byId('urMeta').innerHTML = '<span class="ava">' + (t.author || '答').slice(0, 1) + '</span><span>' + esc(t.author || '知乎答主') + ' · 高赞回答 · <span class="v">▲ ' + fmtV(t.votes) + '</span></span><span>' + esc(th.icon + ' ' + th.name) + '</span>';
    byId('urCnt').textContent = '';
    byId('uniReader').classList.add('on');
    if (window.ReckonUniverseUI && window.ReckonUniverseUI.onReader) { }
    // 若有星体卡开着，收起避免重叠
    closeCard();
    hideHot();
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
    byId('uniHotPanel').classList.add('on');
    byId('uniHotSrc').textContent = (curServer && curServer.live) ? '实时 · 后端推送' : '本地示例';
  }
  function hideHot() { byId('uniHotPanel').classList.remove('on'); }

  function applySearch(q) {
    q = (q || '').toLowerCase().trim();
    var any = false;
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i], t = topicById(st.id);
      var hay = (t ? t.q + ' ' + t.title + ' ' + t.author + ' ' + themeOf(t.cat).name + ' ' + ((t.red || []).join(' ')) : '').toLowerCase();
      var on = !q || hay.indexOf(q) >= 0;
      if (on) any = true;
      st.group.visible = on;
      st.mesh.userData.skipPick = !on;
    }
    byId('uniHints').innerHTML = q ? (any ? '' : '没有匹配「<b>' + esc(q) + '</b>」的星球，试试别的关键词 🔍') : '🖱 <b>拖拽</b>旋转 · <b>滚轮</b>缩放 · <b>点星体</b>查看 / 进入学习 · 星星大小 = 热度 · <b>看山</b>会随天气换动作';
  }

  /* ---------------- 星体选择卡 ---------------- */
  function closeCard() { var c = byId('uniCard'); c.classList.remove('on'); }
  function selectStar(id, focusCam) {
    var t = topicById(id); if (!t) return;
    selId = id;
    var st = null;
    for (var i = 0; i < stars.length; i++) if (stars[i].id === id) { st = stars[i]; break; }
    if (!st) return;
    if (focusCam) focusStar(st);
    var th = themeOf(t.cat), col = t.custom ? '#9aa4b2' : th.color;
    var learned = !!(S().learned && S().learned[id]);
    var card = byId('uniCard');
    card.innerHTML =
      '<button class="uc-close" id="ucClose">✕</button>' +
      '<div class="uc-head"><span class="uc-ico" style="background:' + col + '">' + (t.custom ? '🧪' : th.icon) + '</span><div class="uc-q">' + esc(t.q) + '</div></div>' +
      '<div class="uc-meta"><span class="tg" style="color:' + col + ';border-color:' + col + '55">' + esc(th.name) + '</span><span class="tg">' + esc(t.author || '') + '</span><span class="tg">▲ ' + fmtV(t.votes) + '</span>' + (learned ? '<span class="tg" style="background:rgba(31,161,95,.2);color:#5ad999">✓ 已学懂</span>' : '') + '</div>' +
      '<div class="uc-core">🎯 ' + esc(t.core || '') + '</div>' +
      '<div class="uc-acts"><button class="b1 learn" id="ucLearn">' + (learned ? '♻️ 再炼一遍' : '⛏ 开始学这篇') + '</button><button class="b1 read" id="ucRead">📖 看原文 · 圈点</button></div>';
    card.classList.add('on');
    byId('ucClose').addEventListener('click', function () { closeCard(); selId = null; });
    byId('ucLearn').addEventListener('click', function () {
      U.exit();
      if (window.enterFlow) window.enterFlow(id);
      else if (window.showView) window.showView('flow');
    });
    byId('ucRead').addEventListener('click', function () { rdOpen(id); });
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

  /* ---------------- 渲染主循环 ---------------- */
  var last = 0, eTime = 0;
  function tick(ts) {
    if (!active) return;
    rafId = requestAnimationFrame(tick);
    var dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    eTime += dt;
    envFrame(dt);
    applyEnv();
    // 星体微浮动 & 选中脉冲
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      if (!st.group.visible) continue;
      st.group.position.y = st.base[1] + Math.sin(eTime * 0.8 + i * 1.7) * 0.05;
      var scl = 1;
      if (st.id === selId) scl = 1.13 + Math.sin(eTime * 3) * 0.03;
      st.group.scale.setScalar(scl);
      if (st.learned && Math.floor(eTime * 0.7) % 2 === 0) st.glow.material.opacity = 0.5 + 0.25 * Math.sin(eTime * 2.4);
    }
    // 流动光点
    updateFlows(eTime);
    // 炉火
    var t3 = eTime;
    furnaceWire.rotation.y += dt * 0.35;
    furnaceWire.rotation.x += dt * 0.12;
    furnaceCore.material.emissiveIntensity = 1.0 + Math.sin(t3 * 5.2) * 0.5 + (S().xp > 0 ? 0.35 : 0);
    var fireArr = firePts.geometry.attributes.position.array, fN = firePts.userData.n;
    for (var fi = 0; fi < fN; fi++) {
      var seed = firePts.userData.seed[fi];
      var life = ((t3 * 0.9 + seed) % 1);
      fireArr[fi * 3] = Math.sin(seed * 7 + t3 * 1.4 + life * 6) * 0.32 * (1 - life * 0.4);
      fireArr[fi * 3 + 1] = 0.55 + life * 2.3;
      fireArr[fi * 3 + 2] = Math.cos(seed * 9 + t3 * 1.1) * 0.3 * (1 - life * 0.4);
    }
    firePts.geometry.attributes.position.needsUpdate = true;
    fireMat.opacity = clamp(0.5 + (S().xp || 0) / 4000, 0.4, 0.95) * (0.7 + 0.3 * ENV.cur.rainA);
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
    // 看山
    projectFox();
    if (Math.floor(t3) % 14 === 0 && foxTipTick !== Math.floor(t3 / 14)) { foxTipTick = Math.floor(t3 / 14); foxAutoTip(); }
    // 时钟
    paintClock();
    renderer.render(scene, camera);
  }
  var foxTipTick = -1;
  function updateRainSnow(dt, t3) {
    // 雨
    if (rainMesh.visible) {
      var ud = rainMesh.userData, p = ud.pos, n = ud.n;
      for (var i = 0; i < n; i++) {
        var s = ud.seed[i], spd = ud.speeds[i] * (0.5 + ENV.cur.dustS);
        var x = ((s * 13.7 + Math.floor((t3 * spd + s * 7) / 1) ) % 1) * 30 - 15 + s;
        // 简化：固定区间下落重生
        var life = ((t3 * spd + s) % 1);
        var px = (s * 31.7) % 24 - 12 + Math.sin(t3 * 2 + s * 9) * 0.6;
        var py = life * 26 - 13;
        var pz = (s * 17.3) % 22 - 11 + Math.cos(t3 * 1.7 + s * 5) * 0.5;
        p[i * 6] = px; p[i * 6 + 1] = py; p[i * 6 + 2] = pz;
        p[i * 6 + 3] = px + 0.03; p[i * 6 + 4] = py - 0.42; p[i * 6 + 5] = pz;
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
    byId('uniClockS').textContent = envS + tod.label + ' · ' + w.ico + ' ' + w.name;
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
        if (w2 && w2 !== curWeather) { setWeather(w2, true); }
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
              if (m.type === 'hello') { }
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
    bindReader();
    // 天气按钮点击
    var box = byId('uniWeather');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.wbtn');
      if (b) setWeather(b.getAttribute('data-w'), false);
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
        if (st) selectStar(st.id, false);
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
    el.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('pointermove', pointerMove);
    el.addEventListener('pointerup', pointerUp);
    el.addEventListener('pointerleave', function () { drag = null; });
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
    // 重建话题（自定义选题可能变化）
    rebuildTopics();
    buildEdges();
    applySearch((byId('uniSearch').value || '').trim());
    // 恢复上次天气
    var saved = storeGet(WEATHER_STORE_KEY, 'sunny');
    curWeather = null;
    setWeather(WEATHERS[saved] ? saved : 'sunny', true);
    // 热榜 & 后端探测（每次进入都快速探测一次）
    paintHot();
    probeBackend();
    focusStarFromNone();
    // 恢复当前选中
    if (window.S && S().view === 'uni') { }
    last = 0;
    rafId = requestAnimationFrame(tick);
    foxSay('<b>🦊 看山：</b>欢迎来到炼金宇宙！这里的每一颗星，都是你收藏夹里的一篇好回答 ✨', 5200);
  };
  function focusStarFromNone() {
    ensureCamVec();
    // 相机微调看向整体（居中）
    focusP.set(0, 0.2, 0);
  }
  U.exit = function () {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);
    byId('uniShell').classList.remove('on');
    byId('uniShell').setAttribute('aria-hidden', 'true');
    closeCard();
    hideHot();
    if (rd.topic) rdClose();
    if (U.__ws) { try { U.__ws.close(); } catch (e) {} U.__ws = null; }
  };
  U.setWeather = setWeather;
  U.openReader = rdOpen;
  U.currentWeather = function () { return curWeather; };
  U.applyWeatherToScene = setWeather;
  U.diag = function () {
    return { ready: ready, ok: ok, active: active, stars: stars.length, edges: edges.length, weather: curWeather || null, hasThree: !!window.THREE };
  };

  // 自动初始化（延迟，等 THREE 就绪由 boot 调用；这里只兜底）
  if (window.THREE) { setTimeout(function () { U.init(); }, 60); }
})();
