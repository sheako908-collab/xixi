/* error-report.js — 前端报错收集
 * window.onerror / onunhandledrejection 捕获后 POST /api/client-error。
 * 同一 message 1 分钟内只报一次；上报失败不影响正常功能。
 * 注意：只上报错误本身（message/stack/url/行号），不收集敏感信息。
 */
(function () {
  var ENDPOINT = '/api/client-error';
  var CHILD_KEY = 'v3_child_id';

  /* 去重：message -> 上次上报时间戳 */
  var _seen = {};
  function deduped(msg) {
    var now = Date.now();
    var last = _seen[msg] || 0;
    if (now - last < 60000) { return true; }
    _seen[msg] = now;
    /* 防止内存无限增长，定期清理 */
    var keys = Object.keys(_seen);
    if (keys.length > 100) {
      keys.forEach(function (k) { if (now - _seen[k] > 60000) { delete _seen[k]; } });
    }
    return false;
  }

  function childId() {
    try { return localStorage.getItem(CHILD_KEY) || ''; } catch (e) { return ''; }
  }

  function report(kind, message, stack, line, col) {
    try {
      message = String(message || '').slice(0, 2000);
      if (!message || deduped(kind + ':' + message)) { return; }
      var body = {
        kind: kind,
        message: message,
        stack: String(stack || '').slice(0, 5000),
        url: String(location.href).slice(0, 500),
        line: line || 0,
        col: col || 0,
        userAgent: String(navigator.userAgent || '').slice(0, 500),
        child_id: childId(),
        timestamp: new Date().toISOString()
      };
      /* sendBeacon 优先（页面关闭时也能发出），降级 fetch */
      var payload = JSON.stringify(body);
      if (navigator.sendBeacon) {
        try {
          var blob = new Blob([payload], { type: 'application/json' });
          if (navigator.sendBeacon(ENDPOINT, blob)) { return; }
        } catch (e) { /* fall through */ }
      }
      if (window.fetch) {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) { /* 上报本身永不抛错 */ }
  }

  window.addEventListener('error', function (ev) {
    /* 资源加载错误（img/script/link）没有 message，过滤掉，只收 JS 运行时错误 */
    var msg = ev.message || '';
    if (!msg && ev.target && ev.target !== window) { return; }
    var stack = (ev.error && ev.error.stack) || '';
    report('error', msg || 'unknown error', stack, ev.lineno, ev.colno);
  });

  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev.reason;
    var msg, stack;
    if (reason instanceof Error) {
      msg = reason.message;
      stack = reason.stack;
    } else {
      try { msg = JSON.stringify(reason); } catch (e) { msg = String(reason); }
      stack = '';
    }
    report('rejection', msg || 'unhandled rejection', stack, 0, 0);
  });

  /* 对外暴露一个手动上报入口（调试用） */
  window.__reportError = function (msg) { report('manual', msg, '', 0, 0); };
})();
