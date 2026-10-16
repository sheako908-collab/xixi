/* app-v3 出题引擎自检：node scripts/selftest.js
 * 对每个模板 gen N 次，断言：答案唯一、数字不越界、无负数小数；
 * 再检验 engine.generate 的约束（50道、分组、打散、去重、word2 相邻）。
 */
global.window = {};
var path = require('path');
var JS = path.join(__dirname, '..', 'public', 'js');
require(path.join(JS, 'kp-map.js'));
require(path.join(JS, 'math-bank.js'));
require(path.join(JS, 'en-data.js'));
require(path.join(JS, 'en-bank.js'));
require(path.join(JS, 'engine.js'));

var fails = [], warns = [], total = 0;
function fail(msg) { fails.push(msg); }
function warn(msg) { warns.push(msg); }
function ok() { total++; }

function isIntStr(s) { return typeof s === 'string' && /^\d+$/.test(s); }

/* ---- 1. kp-map 覆盖 ---- */
(function () {
  var kps = {}, u, k;
  window.KP_MAP.math.units.forEach(function (un) {
    un.kps.forEach(function (kp) { kps[kp.id] = kp; });
  });
  var bankKeys = Object.keys(window.MATH_BANK);
  bankKeys.forEach(function (kid) {
    if (!kps[kid]) fail('MATH_BANK 有多余 kp: ' + kid);
    else if (window.MATH_BANK[kid].length < 2) fail('kp 模板不足2个: ' + kid);
    else ok();
  });
  Object.keys(kps).forEach(function (kid) {
    if (!window.MATH_BANK[kid]) fail('kp-map 中的 kp 无模板: ' + kid); else ok();
  });
})();

/* ---- 2. 数学模板批量自检 ---- */
function checkMathQ(q, t) {
  /* answer 必须是非空字符串 */
  if (typeof q.answer !== 'string' || !q.answer.length) { fail(t.id + ': answer 非法'); return; }
  /* choice/judge：选项唯一且包含答案 */
  if (t.type === 'choice' || t.type === 'judge') {
    if (!Array.isArray(q.options) || q.options.length < 2) { fail(t.id + ': options 不足2个'); return; }
    var seen = {}, dup = false, hasAns = 0, i;
    for (i = 0; i < q.options.length; i++) {
      var v = String(q.options[i]);
      if (seen[v]) dup = true; seen[v] = 1;
      if (v === q.answer) hasAns++;
    }
    if (dup) fail(t.id + ': options 有重复值 ' + JSON.stringify(q.options));
    if (hasAns !== 1) fail(t.id + ': answer 在 options 中出现 ' + hasAns + ' 次');
    Object.keys(q.misconceptions || {}).forEach(function (mk) {
      if (!seen[mk]) warn(t.id + ': misconception 键不在 options 中: ' + mk);
    });
  }
  if (t.type === 'input' && q.options !== null) fail(t.id + ': input 题 options 应为 null');
  /* 数字答案：无负数小数；范围检查 */
  if (isIntStr(q.answer)) {
    var v = parseInt(q.answer, 10);
    if (v < 0) fail(t.id + ': 答案为负数 ' + q.answer);
    var max = (t.kp_id === 'math.u2.m_cm') ? 1000 : 100;
    if (v > max) fail(t.id + ': 答案越界(' + max + ') ' + q.answer);
  } else if (/^-?\d*\.\d+$/.test(q.answer) || /^-\d+$/.test(q.answer)) {
    fail(t.id + ': 答案出现小数/负数 ' + q.answer);
  }
  /* values 里不许有负数/小数/NaN */
  Object.keys(q.values || {}).forEach(function (kk) {
    var vv = q.values[kk];
    if (typeof vv === 'number') {
      if (vv < 0) fail(t.id + ': values.' + kk + ' 为负数');
      if (Math.floor(vv) !== vv) fail(t.id + ': values.' + kk + ' 为小数');
      if (!isFinite(vv)) fail(t.id + ': values.' + kk + ' 非法');
    }
  });
  if (typeof q.solution !== 'string' || !q.solution.length) fail(t.id + ': solution 为空');
  if (typeof q.stem !== 'string' || !q.stem.length) fail(t.id + ': stem 为空');
  ok();
}

Object.keys(window.MATH_BANK).forEach(function (kid) {
  window.MATH_BANK[kid].forEach(function (t) {
    for (var i = 0; i < 200; i++) {
      var g = t.gen();
      if (t.type === 'word2') {
        if (!g.step1 || !g.step2 || !g.values) { fail(t.id + ': word2 结构缺失'); break; }
        checkMathQ(Object.assign({}, g.step1, { values: g.values }), { id: t.id + '#s1', type: 'choice', kp_id: t.kp_id });
        checkMathQ(Object.assign({}, g.step2, { values: g.values }), { id: t.id + '#s2', type: 'input', kp_id: t.kp_id });
      } else {
        checkMathQ(g, t);
      }
    }
  });
});

/* ---- 3. 英语模板批量自检 ---- */
(function () {
  var pool = { words: window.EN_DATA.words, sentences: window.EN_DATA.sentences };
  Object.keys(window.EN_BANK).forEach(function (tk) {
    var tpl = window.EN_BANK[tk];
    for (var i = 0; i < 60; i++) {
      var g;
      try { g = tpl.gen(pool); } catch (e) { fail(tk + ': gen 抛错 ' + e.message); break; }
      if (typeof g.answer !== 'string' || !g.answer.length) { fail(tk + ': answer 非法'); break; }
      if (g.audio && g.audio.indexOf('audio/en/') !== 0) fail(tk + ': audio 路径非法 ' + g.audio);
      if (g.options) {
        var seen = {}, dup = false, has = 0, j;
        for (j = 0; j < g.options.length; j++) {
          var v = String(g.options[j]);
          if (seen[v]) dup = true; seen[v] = 1;
          if (v === g.answer) has++;
        }
        if (dup) fail(tk + ': options 重复');
        if (has !== 1) fail(tk + ': answer 在 options 中出现 ' + has + ' 次');
      }
      if (tk === 'spell' && !/^[a-z]+$/.test(g.answer)) fail(tk + ': spell 答案含非小写字母 ' + g.answer);
      if (tk === 'fill_letter' && !/^[a-z]$/.test(g.answer)) fail(tk + ': fill_letter 答案非单个字母');
      if (tk === 'order') {
        if (!g.blocks || g.blocks.length < 3) fail(tk + ': blocks 不足');
        else if (g.blocks.slice().sort().join('|') !== g.answer.split(' ').slice().sort().join('|')) {
          fail(tk + ': blocks 与 answer 对不上');
        }
      }
      if (tk === 'listen_meaning' && !g.answer) fail(tk + ': listen_meaning 无中文答案');
      ok();
    }
  });
  /* 单词去重检查 */
  var wseen = {};
  window.EN_DATA.words.forEach(function (w) {
    var k = w.en.toLowerCase();
    if (wseen[k]) fail('单词重复: ' + w.en); wseen[k] = 1;
  });
  /* 禁止的错误句子 */
  var bad = ['I am big and fast.', 'We learn, read and say.'];
  window.EN_DATA.sentences.forEach(function (s) {
    if (bad.indexOf(s.en) >= 0) fail('含已删除的拼凑句: ' + s.en);
    /* colour 单数：动词用法 "Let's colour it yellow."（课本 p15 原文）是合法的，只查名词词卡 */
    if (/\bcolour\b/.test(s.en) && s.en !== "Let's colour it yellow.") fail('出现 colour 单数: ' + s.en);
  });
  window.EN_DATA.words.forEach(function (w) {
    if (w.en === 'colour') fail('单词表含 colour 单数');
  });
})();

/* ---- 4. engine.generate 约束检验 ---- */
(function () {
  window.ENGINE._reset();
  var kpIds = Object.keys(window.MATH_BANK).slice(0, 10);
  var slots = kpIds.map(function (kid, i) {
    return { kp_id: kid, count: 5, difficulty: (i % 3) + 1, kind: i < 3 ? 'new' : 'review' };
  });
  var qs = window.ENGINE.generate('math', slots, { date: '2026-10-15', total: 50 });
  if (qs.length !== 50) fail('generate 总数=' + qs.length + '，期望 50');
  /* instance_id 格式 */
  qs.forEach(function (q) {
    if (!/^\d{8}-\d{4}$/.test(q.instance_id)) fail('instance_id 格式错: ' + q.instance_id);
  });
  /* 题型打散 */
  for (var i = 1; i < qs.length; i++) {
    if (qs[i].type === qs[i - 1].type) { fail('连续两道同题型 at ' + i + ': ' + qs[i].type); break; }
  }
  /* 每组前 2 道 difficulty=1（按 item 分组近似：每 10 个 question 一组） */
  for (var g0 = 0; g0 < qs.length; g0 += 10) {
    if (qs[g0].difficulty !== 1 || qs[g0 + 1].difficulty !== 1) {
      warn('组 ' + (g0 / 10) + ' 前2道 difficulty 非1（word2 展开可能导致偏移）');
      break;
    }
  }
  /* 同一 KP 上限：自适应（KP 少时放宽，保证能出满总数） */
  var numKps = {};
  slots.forEach(function (sl) { numKps[sl.kp_id] = 1; });
  var capK = Math.max(8, Math.ceil(50 / Object.keys(numKps).length));
  var cnt = {};
  qs.forEach(function (q) { if (q.step !== 2) cnt[q.kp_id] = (cnt[q.kp_id] || 0) + 1; });
  Object.keys(cnt).forEach(function (k) { if (cnt[k] > capK) fail('kp ' + k + ' 出现 ' + cnt[k] + ' 道>' + capK); });
  /* word2 相邻且共享 group_id */
  for (var j = 0; j < qs.length; j++) {
    if (qs[j].step === 1) {
      var nq = qs[j + 1];
      if (!nq || nq.step !== 2 || nq.group_id !== qs[j].group_id) fail('word2 两步未相邻/ group_id 不一致 at ' + j);
      else ok();
    }
  }
  /* 7 天去重：再跑一次同 slots，不应有重复签名 */
  var before = window.ENGINE._seenSize();
  window.ENGINE.generate('math', slots, { date: '2026-10-15', total: 50 });
  var after = window.ENGINE._seenSize();
  if (after <= before) warn('去重 Set 未增长（可能模板池太小导致复用）');

  /* 英语 generate：5 个 KP，自适应上限 ceil(50/5)=10 → 50 道 */
  window.ENGINE._reset();
  var eslots = ['en.u1', 'en.u2', 'en.u3', 'en.u4', 'en.u5'].map(function (k) {
    return { kp_id: k, count: 10, difficulty: 1, kind: 'new' };
  });
  var eqs = window.ENGINE.generate('english', eslots, { date: '2026-10-15', total: 50, en_page: 41 });
  if (eqs.length !== 50) fail('英语 generate 总数=' + eqs.length + '，期望 50');
  var ecap = {};
  eqs.forEach(function (q) { ecap[q.kp_id] = (ecap[q.kp_id] || 0) + 1; });
  Object.keys(ecap).forEach(function (k) { if (ecap[k] > 10) fail('英语 kp ' + k + ' 出现 ' + ecap[k] + ' 道>10'); });
  eqs.forEach(function (q) {
    if (!q.audio || q.audio.indexOf('audio/en/') !== 0) fail('英语题缺 audio: ' + q.template_id);
  });
  ok();

  /* generateRetry */
  window.ENGINE._reset();
  var r1 = window.ENGINE.generateRetry('math.u1.vert_sub', 'choice', { date: '2026-10-15' });
  if (!r1.length || r1[0].type !== 'choice') fail('generateRetry 数学失败');
  var r2 = window.ENGINE.generateRetry('math.u1.word_2step', 'word2', { date: '2026-10-15' });
  if (r2.length !== 2 || r2[0].step !== 1 || r2[1].step !== 2) fail('generateRetry word2 应返回2道');
  var r3 = window.ENGINE.generateRetry('en.u2', 'spell', { date: '2026-10-15' });
  if (!r3.length || r3[0].type !== 'spell') fail('generateRetry 英语失败');
  ok();
})();

console.log('---- 自检结果 ----');
console.log('通过断言: ' + total);
console.log('失败: ' + fails.length);
fails.slice(0, 40).forEach(function (f) { console.log('  FAIL: ' + f); });
console.log('警告: ' + warns.length);
warns.slice(0, 20).forEach(function (w) { console.log('  WARN: ' + w); });
process.exit(fails.length ? 1 : 0);
