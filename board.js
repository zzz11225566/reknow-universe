/* ================================================================
   无边记白板（路线图第 4 步）· 零依赖自制 · file:// 可跑
   - 无限画布：拖空白平移 / 滚轮缩放（0.2x–3x）
   - 元素：彩色便签（双击空白新建、拖动、直接打字、换色、删除）+ 自由画笔
   - 存档：整板序列化为 JSON 存 localStorage「rkBoard」，登录后随 RKAuth 云端同步
   - 入口：顶栏「📋 白板」；Esc 或右上角关闭
   ================================================================ */
(function () {
  "use strict";
  var KEY = "rkBoard";
  var NOTE_COLORS = ["#fff7ae", "#ffd6e0", "#c9e7ff", "#d3f5d3", "#ead9ff"];
  var board = { pan: { x: 0, y: 0 }, zoom: 1, notes: [], strokes: [], seq: 1 };
  var els = {};
  var drawing = null; /* 进行中的笔画 */
  var saveTimer = null;

  function $(id) { return document.getElementById(id); }
  function load() {
    try {
      var j = JSON.parse(localStorage.getItem(KEY));
      if (j && j.notes) board = j;
    } catch (e) { }
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(board)); } catch (e) { }
      try { if (window.RKAuth) RKAuth.schedulePush(); } catch (e) { }
    }, 600);
  }

  /* ---- 视口变换：所有内容在 #rkBoardWorld 里，用 transform 平移缩放 ---- */
  function applyView() {
    els.world.style.transform = "translate(" + board.pan.x + "px," + board.pan.y + "px) scale(" + board.zoom + ")";
    var dot = $("rkBoardZoom"); if (dot) dot.textContent = Math.round(board.zoom * 100) + "%";
  }
  function toWorld(cx, cy) { /* 屏幕坐标 → 画布坐标 */
    var r = els.viewport.getBoundingClientRect();
    return { x: (cx - r.left - board.pan.x) / board.zoom, y: (cy - r.top - board.pan.y) / board.zoom };
  }

  /* ---- 便签 ---- */
  function addNote(x, y, text, color) {
    var n = { id: "n" + (board.seq++), x: x, y: y, w: 200, text: text || "", color: color || NOTE_COLORS[board.notes.length % NOTE_COLORS.length] };
    board.notes.push(n);
    paintNote(n); save();
    return n;
  }
  function paintNote(n) {
    var d = document.createElement("div");
    d.className = "rk-note"; d.id = n.id;
    d.style.cssText = "left:" + n.x + "px;top:" + n.y + "px;width:" + n.w + "px;background:" + n.color;
    d.innerHTML = '<div class="rk-note-bar"><span class="rk-note-colors">' +
      NOTE_COLORS.map(function (c) { return '<i data-c="' + c + '" style="background:' + c + '"></i>'; }).join("") +
      '</span><span class="rk-note-del" title="删除">×</span></div>' +
      '<div class="rk-note-text" contenteditable="true" spellcheck="false"></div>';
    d.querySelector(".rk-note-text").innerText = n.text;
    els.world.appendChild(d);

    /* 拖动（捏住顶栏） */
    var bar = d.querySelector(".rk-note-bar"), sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
    bar.addEventListener("pointerdown", function (e) {
      if (e.target.classList.contains("rk-note-del") || e.target.dataset.c) return;
      sx = e.clientX; sy = e.clientY; ox = n.x; oy = n.y; moved = true;
      bar.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
    });
    bar.addEventListener("pointermove", function (e) {
      if (!moved) return;
      n.x = ox + (e.clientX - sx) / board.zoom; n.y = oy + (e.clientY - sy) / board.zoom;
      d.style.left = n.x + "px"; d.style.top = n.y + "px";
    });
    bar.addEventListener("pointerup", function () { if (moved) { moved = false; save(); } });
    /* 文本与颜色与删除 */
    d.querySelector(".rk-note-text").addEventListener("input", function () { n.text = this.innerText; save(); });
    d.querySelector(".rk-note-text").addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    d.querySelectorAll(".rk-note-colors i").forEach(function (dot) {
      dot.addEventListener("click", function () { n.color = dot.dataset.c; d.style.background = n.color; save(); });
    });
    d.querySelector(".rk-note-del").addEventListener("click", function () {
      board.notes = board.notes.filter(function (x) { return x.id !== n.id; });
      d.remove(); save();
    });
  }

  /* ---- 画笔 ---- */
  var ctx = null;
  function ensureCanvas() {
    var c = els.canvas;
    var r = els.viewport.getBoundingClientRect();
    if (c.width !== r.width || c.height !== r.height) { c.width = r.width; c.height = r.height; ctx = null; }
    if (!ctx && c.getContext) ctx = c.getContext("2d");
    redrawStrokes();
  }
  function redrawStrokes() {
    if (!ctx) return;
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#5a3800";
    board.strokes.forEach(function (s) { drawStroke(s); });
    if (drawing) drawStroke(drawing);
  }
  function drawStroke(s) {
    if (s.pts.length < 2) return;
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x * board.zoom + board.pan.x, s.pts[0].y * board.zoom + board.pan.y);
    for (var i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x * board.zoom + board.pan.x, s.pts[i].y * board.zoom + board.pan.y);
    ctx.stroke();
  }

  /* ---- 交互绑定 ---- */
  var panning = null, penOn = false;
  function bind() {
    els.viewport.addEventListener("pointerdown", function (e) {
      if (e.target !== els.viewport && e.target !== els.canvas && e.target !== els.world) return;
      if (penOn) { drawing = { pts: [toWorld(e.clientX, e.clientY)], w: 3 }; return; }
      panning = { sx: e.clientX, sy: e.clientY, ox: board.pan.x, oy: board.pan.y };
      els.viewport.setPointerCapture(e.pointerId);
    });
    els.viewport.addEventListener("pointermove", function (e) {
      if (drawing) { drawing.pts.push(toWorld(e.clientX, e.clientY)); redrawStrokes(); return; }
      if (!panning) return;
      board.pan.x = panning.ox + e.clientX - panning.sx;
      board.pan.y = panning.oy + e.clientY - panning.sy;
      applyView(); redrawStrokes();
    });
    els.viewport.addEventListener("pointerup", function () {
      if (drawing) { if (drawing.pts.length > 1) board.strokes.push(drawing); drawing = null; save(); redrawStrokes(); return; }
      if (panning) { panning = null; save(); }
    });
    els.viewport.addEventListener("wheel", function (e) {
      e.preventDefault();
      var before = toWorld(e.clientX, e.clientY);
      board.zoom = Math.min(3, Math.max(0.2, board.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      var r = els.viewport.getBoundingClientRect();
      board.pan.x = e.clientX - r.left - before.x * board.zoom;
      board.pan.y = e.clientY - r.top - before.y * board.zoom;
      applyView(); redrawStrokes(); save();
    }, { passive: false });
    els.viewport.addEventListener("dblclick", function (e) {
      if (e.target !== els.viewport && e.target !== els.canvas && e.target !== els.world) return;
      var w = toWorld(e.clientX, e.clientY);
      var n = addNote(w.x - 100, w.y - 10, "");
      var d = $(n.id); if (d) d.querySelector(".rk-note-text").focus();
    });
    $("rkBoardPen").addEventListener("click", function () {
      penOn = !penOn;
      this.classList.toggle("on", penOn);
      els.viewport.style.cursor = penOn ? "crosshair" : "grab";
    });
    $("rkBoardClear").addEventListener("click", function () {
      if (!confirm("清空整块白板？便签和笔画都会被删除。")) return;
      board.notes = []; board.strokes = [];
      els.world.querySelectorAll(".rk-note").forEach(function (d) { d.remove(); });
      redrawStrokes(); save();
    });
    $("rkBoardClose").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && els.overlay.classList.contains("on")) close();
    });
    window.addEventListener("resize", ensureCanvas);
  }

  function open() {
    els.overlay.classList.add("on");
    ensureCanvas(); applyView();
  }
  function close() { els.overlay.classList.remove("on"); save(); }

  function boot() {
    els.overlay = $("rkBoard"); els.viewport = $("rkBoardView");
    els.world = $("rkBoardWorld"); els.canvas = $("rkBoardCanvas");
    if (!els.overlay) return;
    load();
    board.notes.forEach(paintNote);
    bind(); applyView();
    var btn = $("btnBoard");
    if (btn) btn.addEventListener("click", open);
    window.RKBoard = { open: open, addNote: addNote, dump: function () { return board; } };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
