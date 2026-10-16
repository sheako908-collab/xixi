'use strict';
/* server/db.js — 数据层
 * 优先使用 Node 22+ 内置 node:sqlite；若 require 失败则抛错（部署环境为 Node 22+，
 * 经 smoke test 验证可用，故不实现 JSON 降级；接口保持一致以便日后替换）。
 * 数据目录由环境变量 DATA_DIR 指定（默认 <app-v3>/data）。
 */
var path = require('path');
var fs = require('fs');

var DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  throw new Error('node:sqlite 不可用，且当前不提供 JSON 降级实现: ' + e.message);
}

var DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
var db = new DatabaseSync(path.join(DATA_DIR, 'learn-v3.sqlite'));

function nowISO() { return new Date().toISOString(); }

function todayLocal(d) {
  d = d || new Date();
  function p(n) { return String(n).padStart(2, '0'); }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function addDays(dateStr, n) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return todayLocal(d);
}

function daysBetween(a, b) { // 均为 YYYY-MM-DD
  return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000);
}

db.exec(
'CREATE TABLE IF NOT EXISTS children(' +
'  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
'  name TEXT NOT NULL DEFAULT \'宝宝\',' +
'  pin TEXT,' +
'  math_page INTEGER NOT NULL DEFAULT 0,' +
'  en_page INTEGER NOT NULL DEFAULT 0,' +
'  math_from INTEGER NOT NULL DEFAULT 0,' +
'  math_to INTEGER NOT NULL DEFAULT 0,' +
'  en_from INTEGER NOT NULL DEFAULT 0,' +
'  en_to INTEGER NOT NULL DEFAULT 0,' +
'  created_at TEXT NOT NULL' +
');' +
'CREATE TABLE IF NOT EXISTS attempts(' +
'  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
'  child_id INTEGER NOT NULL,' +
'  date TEXT NOT NULL,' +
'  session_id TEXT,' +
'  instance_id TEXT,' +
'  template_id TEXT,' +
'  template_version TEXT,' +
'  kp_id TEXT,' +
'  subject TEXT,' +
'  type TEXT,' +
'  difficulty INTEGER,' +
'  kind TEXT,' +
'  stem TEXT,' +
'  answer TEXT,' +
'  given_answer TEXT,' +
'  correct INTEGER NOT NULL DEFAULT 0,' +
'  time_ms INTEGER,' +
'  is_retry INTEGER NOT NULL DEFAULT 0,' +
'  step INTEGER,' +
'  group_id TEXT,' +
'  extra_json TEXT,' +
'  created_at TEXT NOT NULL' +
');' +
'CREATE INDEX IF NOT EXISTS idx_attempts_child_date ON attempts(child_id, date);' +
'CREATE INDEX IF NOT EXISTS idx_attempts_child_kp ON attempts(child_id, kp_id, id);' +
'CREATE TABLE IF NOT EXISTS summaries(' +
'  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
'  child_id INTEGER NOT NULL,' +
'  kind TEXT NOT NULL,' +
'  period TEXT NOT NULL,' +
'  content_json TEXT NOT NULL,' +
'  created_at TEXT NOT NULL,' +
'  UNIQUE(child_id, kind, period)' +
');' +
'CREATE TABLE IF NOT EXISTS mastery(' +
'  child_id INTEGER NOT NULL,' +
'  kp_id TEXT NOT NULL,' +
'  subject TEXT NOT NULL,' +
'  status TEXT NOT NULL,' +
'  mastered_date TEXT,' +
'  last_review_date TEXT,' +
'  review_stage INTEGER NOT NULL DEFAULT 0,' +
'  updated_at TEXT NOT NULL,' +
'  PRIMARY KEY(child_id, kp_id)' +
');' +
'CREATE TABLE IF NOT EXISTS plan_log(' +
'  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
'  child_id INTEGER NOT NULL,' +
'  date TEXT NOT NULL,' +
'  subject TEXT NOT NULL,' +
'  math_page INTEGER,' +
'  en_page INTEGER,' +
'  math_from INTEGER NOT NULL DEFAULT 0,' +
'  math_to INTEGER NOT NULL DEFAULT 0,' +
'  en_from INTEGER NOT NULL DEFAULT 0,' +
'  en_to INTEGER NOT NULL DEFAULT 0,' +
'  slots_json TEXT,' +
'  created_at TEXT NOT NULL,' +
'  UNIQUE(child_id, date, subject)' +
');'
);

/* ---------------- children ---------------- */

/* 老库兼容：plan_log 表加 4 个范围字段 */
try { db.exec('ALTER TABLE plan_log ADD COLUMN math_from INTEGER NOT NULL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE plan_log ADD COLUMN math_to INTEGER NOT NULL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE plan_log ADD COLUMN en_from INTEGER NOT NULL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE plan_log ADD COLUMN en_to INTEGER NOT NULL DEFAULT 0'); } catch (e) {}

/* 老库兼容：children 表加 4 个范围字段 */
try { db.exec('ALTER TABLE children ADD COLUMN math_from INTEGER NOT NULL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE children ADD COLUMN math_to INTEGER NOT NULL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE children ADD COLUMN en_from INTEGER NOT NULL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE children ADD COLUMN en_to INTEGER NOT NULL DEFAULT 0'); } catch (e) {}

function getChild(id) {
  return db.prepare('SELECT * FROM children WHERE id=?').get(id) || null;
}

function firstChild() {
  return db.prepare('SELECT * FROM children ORDER BY id LIMIT 1').get() || null;
}

function createChild(name) {
  var r = db.prepare('INSERT INTO children(name, created_at) VALUES(?,?)')
    .run(name || '宝宝', nowISO());
  return getChild(Number(r.lastInsertRowid));
}

function getDefaultChild() {
  return firstChild() || createChild('宝宝');
}

function setPin(id, pin) {
  db.prepare('UPDATE children SET pin=? WHERE id=?').run(pin == null ? '' : String(pin), id);
}

function setName(id, name) {
  db.prepare('UPDATE children SET name=? WHERE id=?').run(String(name), id);
}

function getPages(id) {
  var c = getChild(id);
  if (!c) return { math_from: 0, math_to: 0, en_from: 0, en_to: 0 };
  var p = {
    math_from: c.math_from | 0, math_to: c.math_to | 0,
    en_from: c.en_from | 0, en_to: c.en_to | 0
  };
  /* 向后兼容：老数据只有 math_page/en_page（单页），视为 from=1、to=老值 */
  if (!p.math_from && !p.math_to && (c.math_page | 0) > 0) {
    p.math_from = 1; p.math_to = c.math_page | 0;
  }
  if (!p.en_from && !p.en_to && (c.en_page | 0) > 0) {
    p.en_from = 1; p.en_to = c.en_page | 0;
  }
  return p;
}

function setPages(id, pages) {
  pages = pages || {};
  /* 同时把老 math_page/en_page 清零，避免 getPages 的兼容逻辑误判 */
  db.prepare('UPDATE children SET math_from=?, math_to=?, en_from=?, en_to=?, math_page=0, en_page=0 WHERE id=?')
    .run(pages.math_from | 0, pages.math_to | 0, pages.en_from | 0, pages.en_to | 0, id);
}

/* ---------------- attempts ---------------- */

var ATTEMPT_COLS = ['child_id', 'date', 'session_id', 'instance_id', 'template_id',
  'template_version', 'kp_id', 'subject', 'type', 'difficulty', 'kind', 'stem',
  'answer', 'given_answer', 'correct', 'time_ms', 'is_retry', 'step', 'group_id'];

function parseExtra(row) {
  var extra = {};
  if (row.extra_json) {
    try { extra = JSON.parse(row.extra_json); } catch (e) { extra = {}; }
  }
  row.extra = extra;
  return row;
}

function saveAttempt(a) {
  a = Object.assign({}, a);
  var extra = {};
  Object.keys(a).forEach(function (k) {
    if (ATTEMPT_COLS.indexOf(k) === -1 && k !== 'id' && k !== 'created_at' && k !== 'extra_json') {
      extra[k] = a[k];
    }
  });
  if (a.extra_json) {
    try { Object.assign(extra, JSON.parse(a.extra_json)); } catch (e) {}
  }
  var r = db.prepare(
    'INSERT INTO attempts(child_id,date,session_id,instance_id,template_id,template_version,' +
    'kp_id,subject,type,difficulty,kind,stem,answer,given_answer,correct,time_ms,is_retry,' +
    'step,group_id,extra_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    a.child_id | 0,
    a.date || todayLocal(),
    a.session_id || null,
    a.instance_id || null,
    a.template_id || null,
    a.template_version || null,
    a.kp_id || null,
    a.subject || null,
    a.type || null,
    a.difficulty == null ? null : +a.difficulty,
    a.kind || null,
    a.stem == null ? null : String(a.stem),
    a.answer == null ? null : String(a.answer),
    a.given_answer == null ? null : String(a.given_answer),
    a.correct ? 1 : 0,
    a.time_ms == null ? null : +a.time_ms,
    a.is_retry ? 1 : 0,
    a.step == null ? null : +a.step,
    a.group_id || null,
    Object.keys(extra).length ? JSON.stringify(extra) : null,
    nowISO()
  );
  return Number(r.lastInsertRowid);
}

/* filters: {child_id, date, dateFrom, dateTo, subject, kp_id, correct(0|1), kind,
 *           limit, orderBy('id'|'date'), desc(true|false)} */
function queryAttempts(filters) {
  filters = filters || {};
  var where = [];
  var args = [];
  function eq(col, v) { if (v !== undefined && v !== null) { where.push(col + '=?'); args.push(v); } }
  eq('child_id', filters.child_id);
  eq('date', filters.date);
  eq('subject', filters.subject);
  eq('kp_id', filters.kp_id);
  eq('kind', filters.kind);
  if (filters.correct !== undefined && filters.correct !== null) {
    where.push('correct=?'); args.push(filters.correct ? 1 : 0);
  }
  if (filters.dateFrom) { where.push('date>=?'); args.push(filters.dateFrom); }
  if (filters.dateTo) { where.push('date<=?'); args.push(filters.dateTo); }
  var orderBy = filters.orderBy === 'date' ? 'date' : 'id';
  var dir = filters.desc === false ? 'ASC' : 'DESC';
  var sql = 'SELECT * FROM attempts' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY ' + orderBy + ' ' + dir + ', id ' + dir;
  if (filters.limit) sql += ' LIMIT ' + (+filters.limit);
  var stmt = db.prepare(sql);
  return stmt.all.apply(stmt, args).map(parseExtra);
}

/* ---------------- summaries ---------------- */

/* 清空某孩子某天的作答记录（家长"重新出题"用） */
function clearAttempts(childId, date) {
  var stmt = db.prepare('DELETE FROM attempts WHERE child_id=? AND date=?');
  var r = stmt.run(childId, date);
  return r.changes || 0;
}

function saveSummary(childId, kind, period, content) {
  var json = JSON.stringify(content);
  db.prepare(
    'INSERT INTO summaries(child_id, kind, period, content_json, created_at) VALUES(?,?,?,?,?)' +
    ' ON CONFLICT(child_id, kind, period) DO UPDATE SET content_json=excluded.content_json, created_at=excluded.created_at'
  ).run(childId | 0, kind, period, json, nowISO());
}

function getSummary(childId, kind, period) {
  var row = db.prepare('SELECT content_json FROM summaries WHERE child_id=? AND kind=? AND period=?')
    .get(childId | 0, kind, period);
  if (!row) return null;
  try { return JSON.parse(row.content_json); } catch (e) { return null; }
}

/* ---------------- plan_log ---------------- */

function getPlan(childId, subject, date) {
  var row = db.prepare('SELECT slots_json FROM plan_log WHERE child_id=? AND subject=? AND date=?')
    .get(childId | 0, subject, date);
  if (!row) return null;
  try { return JSON.parse(row.slots_json); } catch (e) { return null; }
}

function getLastPlan(childId, subject, beforeDate) {
  return db.prepare(
    'SELECT * FROM plan_log WHERE child_id=? AND subject=? AND date<? ORDER BY date DESC LIMIT 1'
  ).get(childId | 0, subject, beforeDate) || null;
}

function savePlan(childId, subject, date, pages, slots) {
  pages = pages || {};
  db.prepare(
    'INSERT INTO plan_log(child_id, date, subject, math_from, math_to, en_from, en_to, slots_json, created_at)' +
    ' VALUES(?,?,?,?,?,?,?,?,?)' +
    ' ON CONFLICT(child_id, date, subject) DO UPDATE SET math_from=excluded.math_from,' +
    ' math_to=excluded.math_to, en_from=excluded.en_from, en_to=excluded.en_to,' +
    ' slots_json=excluded.slots_json, created_at=excluded.created_at'
  ).run(childId | 0, date, subject,
    pages.math_from | 0, pages.math_to | 0, pages.en_from | 0, pages.en_to | 0,
    JSON.stringify(slots), nowISO());
}

/* ---------------- mastery ----------------
 * 状态机（按 CONTRACT §3 / task 要求）：
 *   无作答 → 未学；有作答但近15次正确率<90% → 学习中；
 *   近15次正确率≥90% → 掌握；掌握后按 1/3/7/14 天复习期 → 巩固；
 *   巩固后有新的达标作答 → 回到掌握并推进复习阶段。
 * kpList: [{kp_id, name, unit}]；asOf: YYYY-MM-DD（默认今天）
 */
var REVIEW_INTERVALS = [1, 3, 7, 14];

function masteryFor(childId, subject, kpList, asOf) {
  asOf = asOf || todayLocal();
  var out = [];
  kpList.forEach(function (kp) {
    var rows = db.prepare(
      'SELECT id, correct, difficulty, date FROM attempts' +
      ' WHERE child_id=? AND kp_id=? AND date<=? ORDER BY id DESC LIMIT 15'
    ).all(childId | 0, kp.kp_id, asOf);
    var status, rate = null;
    if (rows.length === 0) {
      status = '未学';
    } else {
      var ok = rows.filter(function (r) { return r.correct; }).length;
      rate = Math.round(ok / rows.length * 100);
      if (rate < 90) {
        status = '学习中';
        db.prepare('DELETE FROM mastery WHERE child_id=? AND kp_id=?').run(childId | 0, kp.kp_id);
      } else {
        var m = db.prepare('SELECT * FROM mastery WHERE child_id=? AND kp_id=?')
          .get(childId | 0, kp.kp_id);
        var latestDate = rows[0].date;
        if (!m) {
          db.prepare('INSERT INTO mastery(child_id,kp_id,subject,status,mastered_date,' +
            'last_review_date,review_stage,updated_at) VALUES(?,?,?,?,?,?,?,?)')
            .run(childId | 0, kp.kp_id, subject, '掌握', asOf, asOf, 0, nowISO());
          status = '掌握';
        } else if (latestDate > m.last_review_date) {
          var stage = Math.min(m.review_stage + 1, 4);
          db.prepare('UPDATE mastery SET status=?, last_review_date=?, review_stage=?,' +
            ' updated_at=? WHERE child_id=? AND kp_id=?')
            .run('掌握', latestDate, stage, nowISO(), childId | 0, kp.kp_id);
          status = '掌握';
        } else {
          var due = REVIEW_INTERVALS[Math.min(m.review_stage, 3)];
          status = daysBetween(m.last_review_date, asOf) >= due ? '巩固' : '掌握';
          if (status !== m.status) {
            db.prepare('UPDATE mastery SET status=?, updated_at=? WHERE child_id=? AND kp_id=?')
              .run(status, nowISO(), childId | 0, kp.kp_id);
          }
        }
      }
    }
    out.push({ kp_id: kp.kp_id, name: kp.name, unit: kp.unit, status: status, rate: rate, attempts: rows.length });
  });
  return out;
}

/* ---------------- export ---------------- */

function exportAll(childId) {
  var child = getChild(childId) || firstChild();
  if (!child) return { child: null, attempts: [], summaries: [] };
  var attempts = db.prepare('SELECT * FROM attempts WHERE child_id=? ORDER BY id ASC')
    .all(child.id).map(parseExtra);
  var summaries = db.prepare('SELECT kind, period, content_json, created_at FROM summaries WHERE child_id=? ORDER BY id ASC')
    .all(child.id);
  return { child: child, attempts: attempts, summaries: summaries };
}

module.exports = {
  db: db,
  DATA_DIR: DATA_DIR,
  todayLocal: todayLocal,
  addDays: addDays,
  daysBetween: daysBetween,
  getChild: getChild,
  createChild: createChild,
  getDefaultChild: getDefaultChild,
  setPin: setPin,
  setName: setName,
  getPages: getPages,
  setPages: setPages,
  saveAttempt: saveAttempt,
  queryAttempts: queryAttempts,
  clearAttempts: clearAttempts,
  saveSummary: saveSummary,
  getSummary: getSummary,
  getPlan: getPlan,
  getLastPlan: getLastPlan,
  savePlan: savePlan,
  masteryFor: masteryFor,
  exportAll: exportAll
};
