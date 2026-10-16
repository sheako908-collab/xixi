'use strict';
/* server/server.js — Express 服务（CONTRACT §3 API 实现）
 * 端口: 环境变量 PORT（默认 8081）；数据目录: DATA_DIR（默认 <app-v3>/data）
 */
var path = require('path');
var fs = require('fs');
var express = require('express');
var db = require('./db');

var PORT = +(process.env.PORT || 8081);
var app = express();
app.use(express.json({ limit: '2mb' }));

/* ---------- 知识点映射 ---------- */
/* 优先读 engine 负责的 public/js/kp-map.js（window.KP_MAP），不存在则用内置兜底
 * （兜底内容取自 CONTRACT §5：数学 u1 的 7 个 KP＋英语 u1–u5 按 Unit）。 */
var FALLBACK_KP_MAP = {
  math: {
    units: [{
      id: 'u1', name: '100以内加减(二)', pages: [2, 19], kps: [
        { id: 'math.u1.add_split', name: '拆分法/凑整法口算', pages: [2, 3] },
        { id: 'math.u1.vert_add', name: '竖式进位加', pages: [4, 5] },
        { id: 'math.u1.sub_mental', name: '退位减口算', pages: [6, 7] },
        { id: 'math.u1.vert_sub', name: '竖式退位减', pages: [8, 9] },
        { id: 'math.u1.line_compare', name: '线段图比多比少', pages: [10, 11] },
        { id: 'math.u1.word_2step', name: '两步应用', pages: [13, 14] },
        { id: 'math.u1.review', name: '整理复习', pages: [15, 15] }
      ]
    }]
  },
  english: {
    units: [
      { id: 'u1', name: 'Unit 1', pages: [2, 9] },
      { id: 'u2', name: 'Unit 2', pages: [10, 17] },
      { id: 'u3', name: 'Unit 3', pages: [18, 25] },
      { id: 'u4', name: 'Unit 4', pages: [26, 33] },
      { id: 'u5', name: 'Unit 5', pages: [34, 41] }
    ]
  }
};

function loadKpMap() {
  try {
    var p = path.join(__dirname, '..', 'public', 'js', 'kp-map.js');
    var src = fs.readFileSync(p, 'utf8');
    var fakeWindow = {};
    (new Function('window', src))(fakeWindow); // 文件内为 window.KP_MAP = {...}
    if (fakeWindow.KP_MAP) return fakeWindow.KP_MAP;
  } catch (e) { /* 兜底 */ }
  return FALLBACK_KP_MAP;
}

/* 统一为 [{kp_id, name, unit, pages}]；英语 KP 以 Unit 为单位（en.u1…en.u5） */
function normalizeKps(subject) {
  var map = loadKpMap();
  var out = [];
  if (subject === 'math') {
    (map.math.units || []).forEach(function (u) {
      (u.kps || []).forEach(function (k) {
        out.push({ kp_id: k.id, name: k.name, unit: u.name, pages: k.pages });
      });
    });
  } else {
    (map.english.units || []).forEach(function (u) {
      var kid = (u.kps && u.kps[0] && u.kps[0].id) || u.id;
      out.push({ kp_id: kid, name: u.name || u.id, unit: u.name || u.id, pages: u.pages });
    });
  }
  return out;
}

/* ---------- child 解析：query/body 带 child_id 则用之，否则默认（自动创建） ---------- */
function resolveChild(req) {
  var id = (req.body && req.body.child_id) || req.query.child_id;
  if (id) {
    var c = db.getChild(Number(id));
    if (c) return c;
  }
  return db.getDefaultChild();
}

/* ---------- 出题编排 ---------- */
/* new 50%：KP 尾页落在 (上次计划页码, 当前页码]；weak 30%：学习中；review 20%：巩固。
 * 不足时按 new>weak>review 顺序补足 50 slot。
 * difficulty：new 从 1 起；weak 在近次难度上降一档（最低 1）；review 保持近次难度。 */
var PLAN_TOTAL = 50;
var PLAN_QUOTA = { 'new': 25, weak: 15, review: 10 };

function buildPlan(childId, subject, dateStr) {
  var cached = db.getPlan(childId, subject, dateStr);
  if (cached) return cached;

  var kps = normalizeKps(subject);
  var pages = db.getPages(childId);
  /* 页码范围：from/to 为 0 视为全册 */
  var curFrom = subject === 'math' ? (pages.math_from | 0) : (pages.en_from | 0);
  var curTo = subject === 'math' ? (pages.math_to | 0) : (pages.en_to | 0);
  var effFrom = curFrom > 0 ? curFrom : 1;
  var effTo = curTo > 0 ? curTo : 9999;

  var last = db.getLastPlan(childId, subject, dateStr);
  /* 老 plan_log 只有单页字段时兼容 */
  var prevTo = 0;
  if (last) {
    if (subject === 'math') { prevTo = (last.math_to | 0) || (last.math_page | 0); }
    else { prevTo = (last.en_to | 0) || (last.en_page | 0); }
  }
  var effPrev = Math.max(0, Math.min(prevTo, effTo));

  var mastery = db.masteryFor(childId, subject, kps, dateStr);
  var statusOf = {}, rateOf = {};
  mastery.forEach(function (m) { statusOf[m.kp_id] = m.status; rateOf[m.kp_id] = m.rate; });

  var lastDiff = {};
  kps.forEach(function (k) {
    var r = db.queryAttempts({ child_id: childId, kp_id: k.kp_id, limit: 1 });
    lastDiff[k.kp_id] = (r[0] && r[0].difficulty) || 2;
  });

  function inWindow(k) {
    /* KP 结束页落在 [max(effFrom, effPrev+1), effTo] 内 */
    var lo = Math.max(effFrom, effPrev + 1);
    return k.pages && k.pages[1] >= lo && k.pages[1] <= effTo && k.pages[0] <= effTo;
  }
  var weakPool = kps.filter(function (k) { return statusOf[k.kp_id] === '学习中'; });
  var reviewPool = kps.filter(function (k) { return statusOf[k.kp_id] === '巩固'; });
  var newPool = kps.filter(function (k) {
    var s = statusOf[k.kp_id];
    return s !== '学习中' && s !== '巩固' && inWindow(k);
  });
  newPool.sort(function (a, b) { return a.pages[0] - b.pages[0]; });
  weakPool.sort(function (a, b) { return (rateOf[a.kp_id] || 0) - (rateOf[b.kp_id] || 0); });

  var pools = { 'new': newPool, weak: weakPool, review: reviewPool };
  var quotas = { 'new': PLAN_QUOTA['new'], weak: PLAN_QUOTA.weak, review: PLAN_QUOTA.review };

  // 池为空时，把配额按 new>weak>review 优先级转给有 KP 的池
  ['new', 'weak', 'review'].forEach(function (kind) {
    if (pools[kind].length === 0 && quotas[kind] > 0) {
      var q = quotas[kind]; quotas[kind] = 0;
      var order = ['new', 'weak', 'review'];
      for (var i = 0; i < order.length; i++) {
        if (order[i] !== kind && pools[order[i]].length > 0) { quotas[order[i]] += q; break; }
      }
    }
  });

  function difficultyFor(kind, kpId) {
    var base = lastDiff[kpId] || 2;
    if (kind === 'new') return 1;
    if (kind === 'weak') return Math.max(1, base - 1);
    return base; // review 保持
  }

  function distribute(pool, quota, kind) {
    var slots = [];
    if (pool.length === 0 || quota <= 0) return slots;
    function mk(k, count) {
      return { kp_id: k.kp_id, count: count, difficulty: difficultyFor(kind, k.kp_id), kind: kind };
    }
    if (pool.length >= quota) {
      for (var i = 0; i < quota; i++) slots.push(mk(pool[i], 1));
    } else {
      var baseN = Math.floor(quota / pool.length);
      var rem = quota % pool.length;
      pool.forEach(function (k, i) { slots.push(mk(k, baseN + (i < rem ? 1 : 0))); });
    }
    return slots;
  }

  var slots = [].concat(
    distribute(pools['new'], quotas['new'], 'new'),
    distribute(pools.weak, quotas.weak, 'weak'),
    distribute(pools.review, quotas.review, 'review')
  );
  // 兜底：三池全空（页码为 0 或映射缺失）时，用全部 KP 均分 50
  if (slots.length === 0 && kps.length > 0) {
    slots = distribute(kps, PLAN_TOTAL, 'new');
  }

  db.savePlan(childId, subject, dateStr, pages, slots);
  return slots;
}

/* ---------- API ---------- */

app.get('/api/me', function (req, res) {
  var c = req.query.child_id ? db.getChild(Number(req.query.child_id)) : null;
  if (!c) c = db.getDefaultChild();
  res.json({ child_id: c.id, name: c.name });
});

app.post('/api/setup', function (req, res) {
  var c = resolveChild(req);
  var body = req.body || {};
  if (body.pin !== undefined) db.setPin(c.id, body.pin || '');
  if (body.name !== undefined && String(body.name).trim()) db.setName(c.id, String(body.name).trim());
  res.json({ ok: true });
});

/* 家长端设置页预填：返回当前孩子名字（供 apiGet('/api/setup') 用） */
app.get('/api/setup', function (req, res) {
  var c = resolveChild(req);
  res.json({ ok: true, name: c.name || '' });
});

app.post('/api/auth', function (req, res) {
  var c = resolveChild(req);
  var pin = (req.body && req.body.pin) || '';
  if (!c.pin || c.pin === String(pin)) return res.json({ ok: true, role: 'parent' });
  res.json({ ok: false, role: 'child' });
});

app.get('/api/pages', function (req, res) {
  res.json(db.getPages(resolveChild(req).id));
});

app.post('/api/pages', function (req, res) {
  var c = resolveChild(req);
  var b = req.body || {};
  var cur = db.getPages(c.id);
  function num(v, fallback) {
    if (v === undefined || v === null || v === '') return fallback;
    var n = +v;
    return Number.isInteger(n) ? n : fallback;
  }
  var mf = num(b.math_from, cur.math_from), mt = num(b.math_to, cur.math_to);
  var ef = num(b.en_from, cur.en_from), et = num(b.en_to, cur.en_to);
  function badRange(f, t, max, name) {
    if (f < 0 || t < 0 || f > max || t > max) return name + '页码须为 0–' + max + ' 整数';
    if (t > 0 && f > t) return name + '起始页不能大于结束页';
    if (f === 0 && t > 0) return name + '起始页不能为 0（to 为 0 表示到最后）';
    return null;
  }
  var err = badRange(mf, mt, 102, '数学') || badRange(ef, et, 67, '英语');
  if (err) return res.status(400).json({ ok: false, error: err });
  db.setPages(c.id, { math_from: mf, math_to: mt, en_from: ef, en_to: et });
  res.json({ ok: true });
});

/* "生成题目"：清空今天的作答记录，题目按新范围重新出 */
app.post('/api/regenerate', function (req, res) {
  var c = resolveChild(req);
  var dateStr = (req.body && req.body.date) || db.todayLocal();
  var n = db.clearAttempts(c.id, dateStr);
  res.json({ ok: true, cleared: n });
});

app.post('/api/child/name', function (req, res) { // 契约外小扩展：家长端改孩子名
  var c = resolveChild(req);
  if (!req.body || !req.body.name) return res.status(400).json({ ok: false });
  db.setName(c.id, String(req.body.name).slice(0, 20));
  res.json({ ok: true });
});

app.get('/api/plan', function (req, res) {
  var subject = req.query.subject || 'math';
  if (subject !== 'math' && subject !== 'english') {
    return res.status(400).json({ error: 'subject 须为 math|english' });
  }
  var dateStr = req.query.date || db.todayLocal();
  var c = resolveChild(req); // child 不存在时自动创建
  res.json({ slots: buildPlan(c.id, subject, dateStr) });
});

app.post('/api/attempt', function (req, res) {
  var c = resolveChild(req);
  var a = Object.assign({}, req.body, { child_id: c.id });
  var id = db.saveAttempt(a);
  res.json({ ok: true, id: id });
});

/* 家长"重新出题"：清空今天的作答记录，可重做 */
app.post('/api/reset-today', function (req, res) {
  var c = resolveChild(req);
  var dateStr = req.body.date || db.todayLocal();
  var n = db.clearAttempts(c.id, dateStr);
  res.json({ ok: true, cleared: n });
});

/* ---------- 前端报错收集 ---------- */
/* 日志目录：server/logs/，每天一个文件 client-errors-YYYY-MM-DD.log（JSON Lines） */
var ERR_LOG_DIR = path.join(__dirname, 'logs');
try { fs.mkdirSync(ERR_LOG_DIR, { recursive: true }); } catch (e) {}

/* 限流：同一 IP 1 分钟最多 30 条 */
var _errRate = {};
function errRateOk(ip) {
  var now = Date.now(), win = 60000, max = 30;
  var arr = _errRate[ip] || [];
  arr = arr.filter(function (t) { return now - t < win; });
  if (arr.length >= max) { _errRate[ip] = arr; return false; }
  arr.push(now);
  _errRate[ip] = arr;
  return true;
}

function truncStr(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) : s;
}

app.post('/api/client-error', function (req, res) {
  var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  if (!errRateOk(ip)) { return res.status(429).json({ ok: false, error: 'too many' }); }
  var b = req.body || {};
  /* 只收错误本身，不收敏感信息；字段截断防滥用 */
  var entry = {
    ts: new Date().toISOString(),
    ip: ip,
    message: truncStr(b.message, 2000),
    stack: truncStr(b.stack, 5000),
    url: truncStr(b.url, 500),
    line: +b.line || 0,
    col: +b.col || 0,
    userAgent: truncStr(b.userAgent, 500),
    child_id: truncStr(b.child_id, 64),
    kind: truncStr(b.kind, 32) /* 'error' | 'rejection' */
  };
  if (!entry.message) { return res.json({ ok: true }); } /* 空消息不记 */
  var d = new Date();
  var ds = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  var fp = path.join(ERR_LOG_DIR, 'client-errors-' + ds + '.log');
  fs.appendFile(fp, JSON.stringify(entry) + '\n', function (err) {
    if (err) { try { fs.mkdirSync(ERR_LOG_DIR, { recursive: true }); fs.appendFile(fp, JSON.stringify(entry) + '\n', function () {}); } catch (e) {} }
  });
  res.json({ ok: true });
});

function summarizeDay(rows) {
  var done = rows.length;
  var ok = rows.filter(function (r) { return r.correct; }).length;
  var newErrors = rows.filter(function (r) { return !r.correct && !r.is_retry; }).length;
  var ms = rows.reduce(function (s, r) { return s + (+r.time_ms || 0); }, 0);
  return {
    done: done,
    correct_rate: done ? Math.round(ok / done * 100) : 0,
    new_errors: newErrors,
    minutes: Math.round(ms / 60000 * 10) / 10
  };
}

app.get('/api/progress', function (req, res) {
  var c = resolveChild(req);
  var dateStr = req.query.date || db.todayLocal();
  function one(subject) {
    var rows = db.queryAttempts({ child_id: c.id, date: dateStr, subject: subject });
    var groups = {};
    rows.forEach(function (r) { if (r.group_id) groups[r.group_id] = (groups[r.group_id] || 0) + 1; });
    var gids = Object.keys(groups);
    var groupsDone = gids.length
      ? gids.filter(function (g) { return groups[g] >= 10; }).length
      : Math.floor(rows.length / 10);
    return { done: rows.length, total: 50, groups_done: groupsDone };
  }
  res.json({ math: one('math'), english: one('english') });
});

app.get('/api/stats/today', function (req, res) {
  var c = resolveChild(req);
  var dateStr = req.query.date || db.todayLocal();
  function one(subject) {
    return summarizeDay(db.queryAttempts({ child_id: c.id, date: dateStr, subject: subject }));
  }
  res.json({ math: one('math'), english: one('english') });
});

app.get('/api/stats/week', function (req, res) {
  var c = resolveChild(req);
  var end = req.query.date || db.todayLocal();
  var days = [];
  for (var i = 6; i >= 0; i--) {
    var d = db.addDays(end, -i);
    var rows = db.queryAttempts({ child_id: c.id, date: d });
    var s = summarizeDay(rows);
    days.push({
      date: d,
      math_done: rows.filter(function (r) { return r.subject === 'math'; }).length,
      en_done: rows.filter(function (r) { return r.subject === 'english'; }).length,
      correct_rate: s.correct_rate
    });
  }
  res.json({ days: days });
});

app.get('/api/mastery', function (req, res) {
  var subject = req.query.subject || 'math';
  if (subject !== 'math' && subject !== 'english') {
    return res.status(400).json({ error: 'subject 须为 math|english' });
  }
  var c = resolveChild(req);
  res.json(db.masteryFor(c.id, subject, normalizeKps(subject), req.query.date || db.todayLocal()));
});

app.get('/api/kps', function (req, res) {
  var subject = req.query.subject || 'math';
  if (subject !== 'math' && subject !== 'english') {
    return res.status(400).json({ error: 'subject 须为 math|english' });
  }
  var c = resolveChild(req);
  var kps = normalizeKps(subject);
  var mastery = db.masteryFor(c.id, subject, kps, req.query.date || db.todayLocal());
  var st = {};
  mastery.forEach(function (m) { st[m.kp_id] = m.status; });
  res.json(kps.map(function (k) {
    return { kp_id: k.kp_id, name: k.name, unit: k.unit, pages: k.pages, status: st[k.kp_id] || '未学' };
  }));
});

app.get('/api/errors', function (req, res) {
  var c = resolveChild(req);
  var end = req.query.date || db.todayLocal();
  var f = { child_id: c.id, correct: 0 };
  if (req.query.week) { f.dateFrom = db.addDays(end, -6); f.dateTo = end; }
  else { f.date = end; }
  res.json(db.queryAttempts(f).map(function (r) {
    var o = Object.assign({}, r);
    delete o.extra_json;
    return o; // 含 stem 快照＋ extra（misconceptions 等）
  }));
});

function weekPeriod(end) { return db.addDays(end, -6) + '~' + end; }

app.get('/api/summary/daily', function (req, res) {
  var c = resolveChild(req);
  var dateStr = req.query.date || db.todayLocal();
  res.json(db.getSummary(c.id, 'daily', dateStr));
});

app.get('/api/summary/weekly', function (req, res) {
  var c = resolveChild(req);
  var end = req.query.date || db.todayLocal();
  res.json(db.getSummary(c.id, 'weekly', weekPeriod(end)));
});

app.get('/api/export', function (req, res) {
  var c = resolveChild(req);
  var format = req.query.format || 'json';
  var data = db.exportAll(c.id);
  if (format === 'csv') {
    var cols = ['id', 'date', 'subject', 'kp_id', 'type', 'difficulty', 'kind', 'stem',
      'answer', 'given_answer', 'correct', 'time_ms', 'is_retry', 'step', 'group_id',
      'session_id', 'instance_id', 'created_at'];
    function esc(v) {
      v = v == null ? '' : String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    var lines = [cols.join(',')].concat(data.attempts.map(function (r) {
      return cols.map(function (k) { return esc(r[k]); }).join(',');
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="learn-v3-attempts.csv"');
    return res.send('\ufeff' + lines.join('\n'));
  }
  res.setHeader('Content-Disposition', 'attachment; filename="learn-v3-export.json"');
  res.json(data);
});

/* ---------- 静态托管 ---------- */
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, function () {
  console.log('learn-app-v3 listening on :' + PORT + ' (data: ' + db.DATA_DIR + ')');
});
