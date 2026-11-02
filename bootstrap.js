(function (w, d) {
  'use strict';
  var started = Date.now(), timer = null, panel = null, probed = false;
  var state = { code: 'B00', stage: 'entry', message: '页面已打开，正在载入游戏脚本。', ui: false, engine: false, fatal: false, ready: false, webgl2: 'checking', modules: ('noModule' in d.createElement('script')), lastProgress: started, assets: [], world: null, events: [], expanded: true };
  function clean(value) { return String(value == null ? '' : value).replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1').slice(0, 500); }
  function add(code, message) {
    var entry = code + ' ' + clean(message), last = state.events[state.events.length - 1];
    if (!last || last.text !== entry) { state.events.push({ seconds: Math.round((Date.now() - started) / 1000), text: entry }); if (state.events.length > 12) state.events.shift(); }
  }
  function set(code, stage, message, fatal) {
    if (state.fatal && !fatal) return;
    state.code = code; state.stage = stage; state.message = clean(message); state.fatal = state.fatal || !!fatal;
    if (fatal) { state.ready = false; state.expanded = true; var buttons = d.querySelectorAll('[data-start]'), i; for (i = 0; i < buttons.length; i++) buttons[i].disabled = true; if (typeof w.inkUIError === 'function') { try { w.inkUIError(state.message); } catch (ignore) {} } }
    add(code, message); render();
  }
  function report() {
    var lines = ['墨刃加载反馈 compat-20261102-1', '简码: ' + state.code, '阶段: ' + state.stage, '页面: ' + (w.location.protocol === 'file:' ? '本地文件' : w.location.protocol + '//' + w.location.host + w.location.pathname), '等待秒数: ' + Math.max(0, Math.round((Date.now() - started) / 1000)), '界面初始化: ' + state.ui, '游戏就绪: ' + state.engine, '致命错误: ' + state.fatal, 'WebGL2: ' + state.webgl2, '模块支持: ' + state.modules, '浏览器: ' + clean(w.navigator.userAgent), '提示: ' + state.message];
    var i, a;
    if (state.world) lines.push('场景: ' + clean(state.world.current || '') + ' | ' + (Number(state.world.loaded) || 0) + '/' + (Number(state.world.total) || 0) + ' | 完整: ' + !!state.world.ready);
    for (i = 0; i < state.assets.length; i++) { a = state.assets[i]; lines.push('资源: ' + clean(a.name || a.url || 'asset') + ' | ' + clean(a.status || '') + ' | ' + (Number(a.loaded) || 0) + '/' + (Number(a.total) || 0)); }
    for (i = 0; i < state.events.length; i++) lines.push(state.events[i].seconds + 's ' + state.events[i].text);
    return lines.join('\n');
  }
  function copyFallback(text) {
    var field = d.getElementById('ink-boot-copy-field'), ok = false;
    field.value = text; field.hidden = false; field.style.display = 'block'; field.focus(); field.select();
    try { ok = d.execCommand('copy'); } catch (ignore) {}
    d.getElementById('ink-boot-copy-result').textContent = ok ? '已复制，可发来排查。' : '请复制下方已选中的文字。';
    if (ok) { field.hidden = true; field.style.display = 'none'; }
  }
  function copy() {
    var text = report(), clipboard = w.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      try { clipboard.writeText(text).then(function () { d.getElementById('ink-boot-copy-result').textContent = '已复制，可发来排查。'; }, function () { copyFallback(text); }); return; } catch (ignore) {}
    }
    copyFallback(text);
  }
  function ensurePanel() {
    if (panel || !d.body) return;
    panel = d.createElement('section'); panel.id = 'ink-boot-panel'; panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = '<div class="ink-boot-heading"><strong>加载信息</strong><span id="ink-boot-code"></span><button type="button" id="ink-boot-fold" aria-expanded="true">收起</button></div><div id="ink-boot-body"><p id="ink-boot-message"></p><p id="ink-boot-wait"></p><div class="ink-boot-actions"><button type="button" id="ink-boot-copy">复制加载信息</button><button type="button" id="ink-boot-reload">重新载入</button></div><p id="ink-boot-copy-result"></p><textarea id="ink-boot-copy-field" aria-label="可复制的加载信息" readonly hidden></textarea></div>';
    d.body.appendChild(panel);
    d.getElementById('ink-boot-copy').onclick = copy;
    d.getElementById('ink-boot-reload').onclick = function () { w.location.reload(); };
    d.getElementById('ink-boot-fold').onclick = function () { state.expanded = !state.expanded; render(); };
  }
  function render() {
    ensurePanel(); if (!panel) return;
    var elapsed = Math.max(0, Math.round((Date.now() - started) / 1000)), wait = '';
    panel.hidden = state.ready && !state.fatal; panel.style.display = panel.hidden ? 'none' : 'block';
    d.getElementById('ink-boot-code').textContent = state.code + ' · ' + elapsed + '秒';
    d.getElementById('ink-boot-message').textContent = state.message;
    if (!state.ready && !state.fatal && elapsed >= 30) wait = elapsed >= 60 ? '仍在等待资源完成。首次素材较大，可以继续等待；如长时间没有变化，请复制加载信息。' : '加载仍在进行，可以继续等待。等待提示不会阻止稍后完成加载。';
    d.getElementById('ink-boot-wait').textContent = wait;
    d.getElementById('ink-boot-body').style.display = state.expanded ? 'block' : 'none';
    d.getElementById('ink-boot-fold').textContent = state.expanded ? '收起' : '展开';
    d.getElementById('ink-boot-fold').setAttribute('aria-expanded', String(state.expanded));
  }
  function capability() {
    if (probed) return; probed = true;
    var probe = d.createElement('canvas'), gl = null, lose;
    probe.width = 1; probe.height = 1;
    try { gl = probe.getContext('webgl2', { antialias: false }); } catch (ignore) {}
    state.webgl2 = !!gl;
    if (gl) { lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
    if (!state.modules) set('E01', 'compatibility', '当前浏览器不支持游戏需要的模块功能。请使用较新的系统浏览器打开。', false);
    else if (!gl) set('E02', 'graphics', '当前浏览器未能建立 WebGL2 图形画面。请检查浏览器硬件加速或换用支持 WebGL2 的浏览器。', false);
    else add('B01', 'WebGL2 与模块能力检查完成');
  }
  function ready() {
    state.engine = true;
    if (state.fatal) { render(); return; }
    if (!state.ui) { set('E13', 'interface', '游戏资源已就绪，但操作界面未完成初始化。请复制加载信息。', false); return; }
    state.ready = true; state.code = 'R00'; state.stage = 'ready'; state.message = '场景与操作界面已就绪。'; add('R00', state.message); render();
    if (timer) { w.clearInterval(timer); timer = null; }
  }
  function moduleError(url) { set('E10', 'module', '游戏脚本或依赖未能加载：' + clean(url || 'game3d.js') + '。请复制加载信息。', true); }
  w.InkBoot = { isFatal: function () { return state.fatal; }, report: report, copy: copy, moduleError: moduleError, show: function () { state.expanded = true; state.ready = false; render(); }, uiReady: function () { state.ui = true; add('B10', '操作界面已初始化'); if (state.engine) ready(); else render(); } };
  w.addEventListener('error', function (event) {
    var target = event.target || event.srcElement, tag = target && target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'script') { moduleError(target.src || '内联界面脚本'); return; }
    if (tag === 'link') { add('W10', '样式资源未能加载：' + clean(target.href)); render(); return; }
    if (tag === 'img' || tag === 'audio') return;
    if (event.message) { set('E11', 'script', clean(event.message) + (event.filename ? ' [' + clean(event.filename) + ':' + (event.lineno || 0) + ']' : ''), false); }
  }, true);
  w.addEventListener('unhandledrejection', function (event) { var reason = event.reason; set('E12', 'promise', clean(reason && reason.message ? reason.message : reason || '异步加载未完成'), false); });
  w.addEventListener('inkload', function (event) {
    var detail = event.detail || {}, stage = detail.stage || 'loading';
    state.lastProgress = Date.now(); if (detail.world) state.world = detail.world; if (Array.isArray(detail.assets)) state.assets = detail.assets.slice(0, 12);
    if (detail.error) { set('E30', stage, detail.message || detail.error, true); return; }
    if (state.fatal) return;
    set(stage === 'compile' ? 'B30' : stage === 'world' ? 'B25' : stage === 'ready' ? 'B40' : 'B20', stage, detail.message || '游戏资源仍在加载。', false);
  });
  w.addEventListener('inkerror', function (event) { var detail = event.detail || {}; set('E31', 'engine', detail.message || detail || '游戏画面出现错误。', true); });
  d.addEventListener('webglcontextlost', function () { set('E32', 'graphics', 'WebGL2 画面连接已中断，请重新载入。', true); }, true);
  w.addEventListener('inkready', ready);
  w.addEventListener('inkstate', function (event) { if (event.detail && event.detail.ready && !state.fatal) ready(); });
  d.addEventListener('DOMContentLoaded', function () { ensurePanel(); capability(); render(); });
  timer = w.setInterval(function () { ensurePanel(); capability(); render(); }, 1000);
  add('B00', '独立加载诊断已启动');
}(window, document));
