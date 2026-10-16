/* api.js — fetch 封装，同源 API 调用 */
(function () {
  var CHILD_KEY = 'v3_child_id';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function req(method, path, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    /* 自动带上 child_id，保证服务端 resolve 到同一个孩子 */
    var cid = null;
    try { cid = localStorage.getItem(CHILD_KEY); } catch (e) {}
    if (method === 'GET') {
      if (cid && path.indexOf('child_id=') < 0) {
        path += (path.indexOf('?') < 0 ? '?' : '&') + 'child_id=' + encodeURIComponent(cid);
      }
    } else {
      body = body || {};
      if (cid && !body.child_id) { body.child_id = cid; }
    }
    if (body !== undefined) { opts.body = JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status + ' ' + path); }
      return r.json();
    });
  }

  window.API = {
    get: function (path) { return req('GET', path); },
    post: function (path, body) { return req('POST', path, body); },
    today: today,
    /* 启动时拿 child_id，存 localStorage */
    boot: function () {
      return req('GET', '/api/me').then(function (me) {
        if (me && me.child_id) {
          try { localStorage.setItem(CHILD_KEY, me.child_id); } catch (e) {}
        }
        return me;
      }, function () { return null; });
    },
    childId: function () {
      try { return localStorage.getItem(CHILD_KEY); } catch (e) { return null; }
    }
  };
})();
