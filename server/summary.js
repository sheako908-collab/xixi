#!/usr/bin/env node
'use strict';
/* server/summary.js — 日结 / 周结 CLI
 *   node server/summary.js --date=YYYY-MM-DD          生成日结，存 summaries(kind=daily)
 *   node server/summary.js --weekly --date=YYYY-MM-DD  生成周结（截至该日的 7 天），存 summaries(kind=weekly)
 * 今晚用规则版 ruleSummarize()；aiSummarize() 为以后接真 AI 留的空桩。
 * 错因清单依据 upload.md §4.5（固定标签，便于按周统计同种错因次数）。
 */
var path = require('path');
var fs = require('fs');
var db = require('./db');

/* ---------- 参数 ---------- */
var args = process.argv.slice(2);
var WEEKLY = args.indexOf('--weekly') !== -1;
var DATE = db.todayLocal();
args.forEach(function (a) {
  var m = /^--date=(\d{4}-\d{2}-\d{2})$/.exec(a);
  if (m) DATE = m[1];
});

/* ---------- 知识点名（与 server.js 同源：优先 public/js/kp-map.js） ---------- */
var FALLBACK_KP = {
  'math.u1.add_split': '拆分法/凑整法口算', 'math.u1.vert_add': '竖式进位加',
  'math.u1.sub_mental': '退位减口算', 'math.u1.vert_sub': '竖式退位减',
  'math.u1.line_compare': '线段图比多比少', 'math.u1.word_2step': '两步应用',
  'math.u1.review': '整理复习',
  'en.u1': 'Unit 1', 'en.u2': 'Unit 2', 'en.u3': 'Unit 3', 'en.u4': 'Unit 4', 'en.u5': 'Unit 5'
};
function kpName(kpId) {
  try {
    var src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'kp-map.js'), 'utf8');
    var fakeWindow = {};
    (new Function('window', src))(fakeWindow);
    var map = fakeWindow.KP_MAP;
    if (map) {
      var found = null;
      (map.math.units || []).forEach(function (u) {
        (u.kps || []).forEach(function (k) { if (k.id === kpId) found = k.name; });
      });
      (map.english.units || []).forEach(function (u) {
        if ('en.' + u.id === kpId) found = u.name;
      });
      if (found) return found;
    }
  } catch (e) {}
  return FALLBACK_KP[kpId] || kpId;
}

/* ---------- 以后接真 AI 的桩 ---------- */
function aiSummarize() {
  // TODO: 接入真实 AI 后，用 AI 替换 ruleSummarize() 的归因与文案部分；
  // 输入输出结构保持 CONTRACT §9：{per_error, daily_summary|weekly_summary, repeat_errors}
  return null;
}

/* ---------- 规则版归因 ---------- */
/* 优先级：题目自带 misconceptions 映射（attempt.extra.misconceptions[given_answer]）
 *        → 用时<3秒且错 → 粗心 → 同一 KP 当天错≥2 → 知识未掌握
 *        → 数据不足，暂不下结论 */
function tagError(a, kpWrongCount) {
  var misc = a.extra && a.extra.misconceptions;
  if (misc && typeof misc === 'object') {
    var tag = misc[String(a.given_answer)];
    if (tag) return { cause_tag: tag, note: '孩子选的正是题目预设的典型误解选项', confidence: 'high' };
  }
  if (a.time_ms != null && +a.time_ms < 3000) {
    return { cause_tag: '粗心', note: '只用了 ' + (+a.time_ms / 1000).toFixed(1) + ' 秒就提交了', confidence: 'medium' };
  }
  if (kpWrongCount >= 2) {
    return { cause_tag: '知识未掌握', note: '今天「' + kpName(a.kp_id) + '」错了 ' + kpWrongCount + ' 道', confidence: 'medium' };
  }
  return { cause_tag: '数据不足，暂不下结论', note: '', confidence: 'low' };
}

/* 按 (date, kp) 统计当天错题数，供 tagError 用 */
function kpWrongByDay(wrongList) {
  var m = {};
  wrongList.forEach(function (a) {
    var k = a.date + '|' + a.kp_id;
    m[k] = (m[k] || 0) + 1;
  });
  return m;
}

function perErrorList(wrongList) {
  var kw = kpWrongByDay(wrongList);
  return wrongList.map(function (a) {
    var t = tagError(a, kw[a.date + '|' + a.kp_id] || 0);
    return { question_id: a.instance_id, cause_tag: t.cause_tag, note: t.note, confidence: t.confidence };
  });
}

function mostCommon(arr) {
  var c = {}, best = null, bestN = 0;
  arr.forEach(function (x) { c[x] = (c[x] || 0) + 1; if (c[x] > bestN) { bestN = c[x]; best = x; } });
  return best;
}

/* ---------- 重复错误判定（程序做，不靠 AI） ----------
 * 规则 1：同一 cause_tag 7 天内 ≥3 次
 * 规则 2：同一 KP 连续 2 天正确率 <60%（每天都有作答才算） */
function findRepeatErrors(childId, dateList) {
  var from = dateList[0], to = dateList[dateList.length - 1];
  var wrong = db.queryAttempts({ child_id: childId, dateFrom: from, dateTo: to, correct: 0, orderBy: 'date', desc: false });
  var perError = perErrorList(wrong);
  var repeats = [];
  var seen = {};

  // 规则 1：cause_tag 7 天 ≥3 次
  var tagCount = {}, tagQids = {}, tagKps = {};
  perError.forEach(function (e, i) {
    tagCount[e.cause_tag] = (tagCount[e.cause_tag] || 0) + 1;
    (tagQids[e.cause_tag] = tagQids[e.cause_tag] || []).push(e.question_id);
    var kp = wrong[i].kp_id;
    tagKps[e.cause_tag] = tagKps[e.cause_tag] || {};
    tagKps[e.cause_tag][kp] = (tagKps[e.cause_tag][kp] || 0) + 1;
  });
  Object.keys(tagCount).forEach(function (tag) {
    if (tag === '数据不足，暂不下结论' || tagCount[tag] < 3) return;
    var kpIds = Object.keys(tagKps[tag]);
    kpIds.sort(function (a, b) { return tagKps[tag][b] - tagKps[tag][a]; });
    var kpId = kpIds[0] || null;
    var key = 'tag|' + tag;
    if (seen[key]) return; seen[key] = 1;
    repeats.push({
      cause_tag: tag,
      kp_id: kpId,
      evidence_question_ids: tagQids[tag].slice(0, 10),
      parent_action: '今晚用 10 分钟练 5 道「' + (kpId ? kpName(kpId) : '相关') + '」的题，重点盯「' + tag + '」',
      next_day_drill_hint: '明天计划里给「' + (kpId ? kpName(kpId) : '相关') + '」加弱项巩固题'
    });
  });

  // 规则 2：同一 KP 连续 2 天正确率 <60%
  var byDayKp = {};
  db.queryAttempts({ child_id: childId, dateFrom: from, dateTo: to }).forEach(function (a) {
    var k = a.date + '|' + a.kp_id;
    var s = byDayKp[k] || (byDayKp[k] = { total: 0, ok: 0 });
    s.total++; if (a.correct) s.ok++;
  });
  var kpDays = {};
  Object.keys(byDayKp).forEach(function (k) {
    var parts = k.split('|');
    (kpDays[parts[1]] = kpDays[parts[1]] || {})[parts[0]] = byDayKp[k];
  });
  Object.keys(kpDays).forEach(function (kpId) {
    for (var i = 0; i + 1 < dateList.length; i++) {
      var d1 = dateList[i], d2 = dateList[i + 1];
      var s1 = kpDays[kpId][d1], s2 = kpDays[kpId][d2];
      if (!s1 || !s2 || s1.total === 0 || s2.total === 0) continue;
      var r1 = s1.ok / s1.total, r2 = s2.ok / s2.total;
      if (r1 < 0.6 && r2 < 0.6) {
        var key = 'kp|' + kpId;
        if (seen[key]) break; seen[key] = 1;
        var ev = wrong.filter(function (a) { return a.kp_id === kpId; })
          .map(function (a) { return a.instance_id; }).slice(0, 10);
        repeats.push({
          cause_tag: '知识未掌握',
          kp_id: kpId,
          evidence_question_ids: ev,
          parent_action: '今晚用 10 分钟练 5 道「' + kpName(kpId) + '」的题（已连续两天正确率不足 60%）',
          next_day_drill_hint: '明天计划里给「' + kpName(kpId) + '」加弱项巩固题'
        });
        break;
      }
    }
  });

  return repeats;
}

/* ---------- 日结 ---------- */
function ruleSummarizeDaily(child, dateStr) {
  var attempts = db.queryAttempts({ child_id: child.id, date: dateStr, orderBy: 'date', desc: false });
  var done = attempts.length;
  var ok = attempts.filter(function (a) { return a.correct; }).length;
  var wrong = attempts.filter(function (a) { return !a.correct; });
  var perError = perErrorList(wrong);
  var minutes = Math.round(attempts.reduce(function (s, a) { return s + (+a.time_ms || 0); }, 0) / 60000 * 10) / 10;

  var dailySummary;
  if (!done) {
    dailySummary = '今天还没有做题记录。';
  } else {
    var rate = Math.round(ok / done * 100);
    dailySummary = '今天共做了 ' + done + ' 道题，答对 ' + ok + ' 道，正确率 ' + rate + '%，用时约 ' + minutes + ' 分钟。';
    if (wrong.length) {
      var top = mostCommon(perError.map(function (e) { return e.cause_tag; }));
      dailySummary += '今天的主要错因是「' + top + '」（' + wrong.length + ' 道错题）。';
    } else {
      dailySummary += '全部答对，太棒了！';
    }
  }

  var repeatErrors = findRepeatErrors(child.id, [dateStr]);
  var content = { per_error: perError, daily_summary: dailySummary, repeat_errors: repeatErrors };
  db.saveSummary(child.id, 'daily', dateStr, content);
  return content;
}

/* ---------- 周结 ---------- */
function ruleSummarizeWeekly(child, endDate) {
  var dates = [];
  for (var i = 6; i >= 0; i--) dates.push(db.addDays(endDate, -i));
  var attempts = db.queryAttempts({ child_id: child.id, dateFrom: dates[0], dateTo: endDate, orderBy: 'date', desc: false });
  var done = attempts.length;
  var ok = attempts.filter(function (a) { return a.correct; }).length;
  var wrong = attempts.filter(function (a) { return !a.correct; });
  var perError = perErrorList(wrong);
  var activeDays = {};
  attempts.forEach(function (a) { activeDays[a.date] = 1; });

  var weeklySummary;
  if (!done) {
    weeklySummary = '本周还没有做题记录。';
  } else {
    var rate = Math.round(ok / done * 100);
    weeklySummary = '本周共学习 ' + Object.keys(activeDays).length + ' 天，做了 ' + done +
      ' 道题，平均正确率 ' + rate + '%。';
    if (wrong.length) {
      var top = mostCommon(perError.map(function (e) { return e.cause_tag; }));
      weeklySummary += '本周出现最多的错因是「' + top + '」。';
    }
  }

  var repeatErrors = findRepeatErrors(child.id, dates);
  if (repeatErrors.length) {
    weeklySummary += '需要重点关注的重复错误有 ' + repeatErrors.length + ' 项，详见 repeat_errors。';
  }
  var content = { per_error: perError, weekly_summary: weeklySummary, repeat_errors: repeatErrors };
  db.saveSummary(child.id, 'weekly', dates[0] + '~' + endDate, content);
  return content;
}

/* ---------- main ---------- */
function main() {
  var child = db.getDefaultChild();
  var content = WEEKLY ? ruleSummarizeWeekly(child, DATE) : ruleSummarizeDaily(child, DATE);
  console.log(JSON.stringify(content, null, 2));
}

if (require.main === module) main();

module.exports = { ruleSummarizeDaily: ruleSummarizeDaily, ruleSummarizeWeekly: ruleSummarizeWeekly, aiSummarize: aiSummarize, tagError: tagError, findRepeatErrors: findRepeatErrors };
