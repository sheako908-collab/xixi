/* parent.js - 家长端 UI（parent-ui 负责）
 *
 * 对外接口：window.Parent.render(appEl, API)
 *   appEl: #app 容器元素，由 js/app.js 在 PIN 验证通过后调用本函数接管
 *   API:   可选。{get(url)->Promise, post(url,body)->Promise, exitParent()}。
 *          不传或缺少 get/post 时使用内置 fetch（同源，见 CONTRACT §3）。
 *          退出家长端：优先调 API.exitParent()，否则 location.reload() 回孩子端首页。
 * 数据源（CONTRACT §3）：
 *   今日：GET /api/pages → 页码范围预填 {math_from,math_to,en_from,en_to}；POST /api/pages → 保存页码范围
 *        POST /api/regenerate → 清空今天作答记录（"生成题目"）
 *        GET /api/stats/today?date= → 两科 done/正确率/新增错题/用时
 *        GET /api/progress?date= → 组完成数（groups_done/5）
 *        GET /api/summary/daily?date= → AI 日结卡（null 则显示"今晚 22:00 生成"）
 *   本周：GET /api/stats/week?date= → 7 天条形图
 *        GET /api/summary/weekly?date= → repeat_errors（优先）
 *        GET /api/errors?week=1&date= → 无周结时汇总重复错误＋证据题详情
 *   知识点地图：GET /api/kps?subject= → KP 格子
 *        GET /api/errors?week=1&date= → 点开 KP 的本周错题历史
 *   设置：POST /api/setup → 改孩子名 / 改家长 PIN
 *        GET /api/export?format=csv → 下载作答记录
 *
 * 约束：ES5 语法（var，无 import/export）；答题链路外也不调任何 AI；
 *       数字保留 1 位小数或整数；数据不足明确标注，不强行下结论。
 */
(function () {
'use strict';

/* ---------------- 工具 ---------------- */

function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayStr() {
  var d = new Date();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return d.getFullYear() + '-' +
    (m < 10 ? '0' + m : m) + '-' +
    (day < 10 ? '0' + day : day);
}

/* 数字保留 1 位小数或整数 */
function num1(n) {
  if (n === undefined || n === null || isNaN(Number(n))) return '—';
  var v = Math.round(Number(n) * 10) / 10;
  return String(v);
}

/* 正确率归一化为 0-100（兼容 0.92 与 92 两种返回；1 即 100%） */
function ratePct(r) {
  if (r === undefined || r === null || isNaN(Number(r))) return null;
  var v = Number(r);
  if (v > 0 && v <= 1) v = v * 100;
  return v;
}

function fmtMin(m) {
  if (m === undefined || m === null || isNaN(Number(m))) return '—';
  return Math.round(Number(m)) + '分钟';
}

function fmtSecs(ms) {
  if (ms === undefined || ms === null || isNaN(Number(ms))) return '—';
  var s = Number(ms) / 1000;
  return (s < 10 ? num1(s) : String(Math.round(s))) + '秒';
}

function weekdayShort(dateStr) {
  var names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var d = new Date(String(dateStr) + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return names[d.getDay()];
}

function mmdd(dateStr) {
  var p = String(dateStr || '').split('-');
  return p.length === 3 ? Number(p[1]) + '/' + Number(p[2]) : String(dateStr || '');
}

function whenStr(a) {
  return a.created_at || a.date || '';
}

/* ---------------- 网络（内置兜底） ---------------- */

function httpJson(method, url, body) {
  var opts = { method: method, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  return fetch(url, opts).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    return r.text().then(function (t) {
      if (!t) return null;
      try { return JSON.parse(t); } catch (e) { return null; }
    });
  });
}

var S = {
  tab: 'today',
  subject: 'math',
  api: null,
  weekErrors: null /* 本周错题缓存：证据详情＋KP 历史共用 */
};

function apiGet(url) {
  if (S.api && typeof S.api.get === 'function') return S.api.get(url);
  return httpJson('GET', url);
}
function apiPost(url, body) {
  if (S.api && typeof S.api.post === 'function') return S.api.post(url, body);
  return httpJson('POST', url, body);
}

/* ---------------- 通用片段 ---------------- */

var toastTimer = null;
function toast(msg) {
  var t = document.getElementById('pToast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'p-toast show';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.className = 'p-toast'; }, 2200);
}

function loadingHtml() {
  return '<div class="p-empty">加载中…</div>';
}
function failHtml(what) {
  return '<div class="p-errbox">' + esc(what) + '加载失败，请下拉刷新重试</div>';
}
function card(titleHtml, inner) {
  return '<section class="p-card"><div class="p-card-title">' + titleHtml + '</div>' + inner + '</section>';
}
function lowBadge() {
  return '<span class="p-badge p-badge-warn">数据不足</span>';
}

function iconToday() {
  return '<svg viewBox="0 0 48 48">' +
    '<rect x="6" y="10" width="36" height="32" rx="7" fill="#ffffff" stroke="#DCE9F7" stroke-width="2"/>' +
    '<path d="M6,17 a7,7 0 0 1 7,-7 h22 a7,7 0 0 1 7,7 v4 h-36 Z" fill="#2E9CF6"/>' +
    '<rect x="14" y="5" width="5" height="9" rx="2.5" fill="#EAF3FE" stroke="#2E9CF6" stroke-width="1.5"/>' +
    '<rect x="29" y="5" width="5" height="9" rx="2.5" fill="#EAF3FE" stroke="#2E9CF6" stroke-width="1.5"/>' +
    '<text id="pNavDate" x="24" y="37" text-anchor="middle" font-size="19" font-weight="700" fill="#3A4A5A" font-family="-apple-system,BlinkMacSystemFont,\'PingFang SC\',sans-serif">1</text>' +
  '</svg>';
}
function iconWeek() {
  return '<svg viewBox="0 0 48 48">' +
    '<rect x="5" y="5" width="38" height="38" rx="9" fill="#F1F6FC"/>' +
    '<rect x="11" y="28" width="7.5" height="10" rx="3.75" fill="#3E9BF0"/>' +
    '<rect x="20.25" y="22" width="7.5" height="16" rx="3.75" fill="#4FCB6D"/>' +
    '<rect x="29.5" y="14" width="7.5" height="24" rx="3.75" fill="#FF9F2E"/>' +
  '</svg>';
}
function iconMap() {
  return '<svg viewBox="0 0 48 48">' +
    '<rect x="5" y="9" width="38" height="30" rx="6" fill="#A9D6F5"/>' +
    '<path d="M18,9 v30 M31,9 v30" stroke="#E8F4FD" stroke-width="2.5"/>' +
    '<path d="M5,26 l13,-6 13,6 12,-5" stroke="#FFFFFF" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '<circle cx="12" cy="32" r="4" fill="#7ED321"/>' +
    '<circle cx="37" cy="31" r="3.4" fill="#7ED321"/>' +
    '<path d="M24,10 c-5.2,0 -8.5,3.6 -8.5,8.2 c0,6.2 8.5,14.8 8.5,14.8 s8.5,-8.6 8.5,-14.8 c0,-4.6 -3.3,-8.2 -8.5,-8.2 Z" fill="#F04438"/>' +
    '<circle cx="24" cy="18.4" r="3.2" fill="#fff"/>' +
  '</svg>';
}
function iconSettings() {
  var teeth = '';
  for (var i = 0; i < 8; i++) {
    teeth += '<rect x="21" y="3" width="6" height="11" rx="2.5" transform="rotate(' + (i * 45) + ' 24 24)"/>';
  }
  return '<svg viewBox="0 0 48 48">' +
    '<g fill="#9AA5B1">' + teeth + '<circle cx="24" cy="24" r="13"/></g>' +
    '<circle cx="24" cy="24" r="6.5" fill="#fff"/>' +
  '</svg>';
}
function shellHtml() {
  return '' +
  '<div class="p-app">' +
    '<div class="p-header"><div class="p-header-title">家长</div></div>' +
    '<div class="p-content" id="pContent"></div>' +
    '<nav class="p-nav">' +
      navBtn('today', iconToday(), '今日') +
      navBtn('week', iconWeek(), '本周') +
      navBtn('map', iconMap(), '知识点地图') +
      navBtn('settings', iconSettings(), '设置') +
    '</nav>' +
    '<div class="p-toast" id="pToast"></div>' +
  '</div>';
}
function navBtn(id, icon, label) {
  return '<button type="button" data-tab="' + id + '">' +
    '<span class="p-nav-ic">' + icon + '</span>' + esc(label) + '</button>';
}

/* ---------------- 今日 ---------------- */

function pagesCard(pages) {
  pages = pages || {};
  function v(k) {
    var x = pages[k];
    return (x !== undefined && x !== null && +x > 0) ? String(+x) : '';
  }
  /* 老单页字段兼容：from/to 都空且有老值时，老值填到 to */
  var mto = v('math_to') || v('math_page'), eto = v('en_to') || v('en_page');
  var mfrom = v('math_from'), efrom = v('en_from');
  return card('课本页码范围',
    '<div class="p-pagerow">' +
      '<label>数学从<input id="pMathFrom" class="p-input" type="number" min="1" max="102" value="' + esc(mfrom) + '" placeholder="1"></label>' +
      '<label>到<input id="pMathTo" class="p-input" type="number" min="1" max="102" value="' + esc(mto) + '" placeholder="102"></label>' +
    '</div>' +
    '<div class="p-pagerow">' +
      '<label>英语从<input id="pEnFrom" class="p-input" type="number" min="1" max="67" value="' + esc(efrom) + '" placeholder="1"></label>' +
      '<label>到<input id="pEnTo" class="p-input" type="number" min="1" max="67" value="' + esc(eto) + '" placeholder="67"></label>' +
    '</div>' +
    '<div class="p-hint" id="pPageHint">选择课本页码范围，题目按此范围出题；结束页留空表示到最后</div>' +
    '<button class="p-btn" id="pSavePages" type="button">保存页码</button> ' +
    '<button class="p-btn" id="pRegenQs" type="button">📝 生成题目</button>');
}

function wirePages() {
  var btn = document.getElementById('pSavePages');
  var regenBtn = document.getElementById('pRegenQs');
  function readRange(fromId, toId, max, name) {
    var f = document.getElementById(fromId).value.trim();
    var t = document.getElementById(toId).value.trim();
    var fn = f === '' ? 0 : parseInt(f, 10);
    var tn = t === '' ? 0 : parseInt(t, 10);
    if (isNaN(fn) || fn < 0 || fn > max) return { err: name + '起始页需在 1–' + max + ' 之间' };
    if (isNaN(tn) || tn < 0 || tn > max) return { err: name + '结束页需在 1–' + max + ' 之间' };
    if (tn > 0 && fn > tn) return { err: name + '起始页不能大于结束页' };
    if (fn === 0 && tn > 0) return { err: name + '起始页不能为空（结束页留空表示到最后）' };
    return { from: fn, to: tn };
  }
  function bad(msg) {
    var hint = document.getElementById('pPageHint');
    hint.textContent = msg; hint.className = 'p-hint p-hint-err';
  }
  function okMsg(msg) {
    var hint = document.getElementById('pPageHint');
    hint.textContent = msg; hint.className = 'p-hint';
  }
  if (btn) btn.addEventListener('click', function () {
    var m = readRange('pMathFrom', 'pMathTo', 102, '数学');
    if (m.err) { bad(m.err); return; }
    var e = readRange('pEnFrom', 'pEnTo', 67, '英语');
    if (e.err) { bad(e.err); return; }
    apiPost('/api/pages', { math_from: m.from, math_to: m.to, en_from: e.from, en_to: e.to }).then(function () {
      okMsg('已保存：数学 ' + (m.from || 1) + '–' + (m.to || '最后') + ' 页，英语 ' + (e.from || 1) + '–' + (e.to || '最后') + ' 页');
      toast('页码已保存');
    }).catch(function () { bad('保存失败，请检查网络后重试'); });
  });
  if (regenBtn) regenBtn.addEventListener('click', function () {
    var m = readRange('pMathFrom', 'pMathTo', 102, '数学');
    if (m.err) { bad(m.err); return; }
    var e = readRange('pEnFrom', 'pEnTo', 67, '英语');
    if (e.err) { bad(e.err); return; }
    regenBtn.disabled = true;
    regenBtn.textContent = '生成中…';
    apiPost('/api/pages', { math_from: m.from, math_to: m.to, en_from: e.from, en_to: e.to }).then(function () {
      return apiPost('/api/regenerate', {});
    }).then(function () {
      okMsg('题目已按新范围生成');
      toast('题目已按新范围生成');
    }).catch(function () { bad('生成失败，请检查网络后重试'); })
    .then(function () {
      regenBtn.disabled = false;
      regenBtn.textContent = '📝 生成题目';
    });
  });
}

function statCell(label, value) {
  return '<div><div class="p-stat-num">' + esc(value) + '</div>' +
    '<div class="p-stat-label">' + esc(label) + '</div></div>';
}

function subjectBlock(name, st, prog) {
  var done = st && st.done !== undefined && st.done !== null ? Number(st.done) : 0;
  var cr = ratePct(st && st.correct_rate);
  var errs = st && st.new_errors !== undefined && st.new_errors !== null ? Number(st.new_errors) : null;
  var gd = prog && prog.groups_done !== undefined && prog.groups_done !== null ? Number(prog.groups_done) : null;
  var w = Math.min(100, Math.max(0, done / 50 * 100));
  return '<div class="p-subj">' +
    '<div class="p-row p-between"><span class="p-subj-name">' + esc(name) + '</span>' +
    '<span class="p-subj-count">' + done + '/50 道' +
    (gd !== null ? ' · ' + gd + '/5 组' : '') + '</span></div>' +
    '<div class="p-bar"><i style="width:' + w + '%"></i></div>' +
    '<div class="p-stat3">' +
      statCell('正确率', cr === null ? '—' : num1(cr) + '%') +
      statCell('新增错题', errs === null ? '—' : errs + ' 道') +
      statCell('用时', fmtMin(st && st.minutes)) +
    '</div></div>';
}

function dailyCard(sum) {
  if (!sum) {
    return card('AI 日结', '<div class="p-empty">今日学习总结将于今晚 22:00 生成</div>');
  }
  var h = '';
  if (sum.confidence === 'low') h += lowBadge() + '<span class="p-hint">样本太少，结论仅供参考</span>';
  if (sum.daily_summary) h += '<p class="p-text">' + esc(sum.daily_summary) + '</p>';
  var list = sum.per_error || [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    h += '<div class="p-ev">' +
      '<div class="p-ev-q"><span class="p-tag">' + esc(it.cause_tag || '待归因') + '</span>' +
      (it.confidence === 'low' ? lowBadge() : '') + '</div>' +
      '<div class="p-text">' + esc(it.note || '') + '</div>' +
      (it.question_id !== undefined && it.question_id !== null
        ? '<div class="p-ev-row"><span>题号：' + esc(String(it.question_id)) + '</span></div>' : '') +
    '</div>';
  }
  if (!sum.daily_summary && !list.length) h += '<div class="p-empty">今日暂无总结内容</div>';
  return card('AI 日结', h);
}

function renderToday(content) {
  content.innerHTML = loadingHtml();
  var d = todayStr();
  Promise.all([
    apiGet('/api/pages'),
    apiGet('/api/stats/today?date=' + d),
    apiGet('/api/progress?date=' + d),
    apiGet('/api/summary/daily?date=' + d)
  ]).then(function (rs) {
    var pages = rs[0] || {};
    var stats = rs[1] || {};
    var prog = rs[2] || {};
    var sum = rs[3];
    content.innerHTML =
      pagesCard(pages) +
      card('今日完成情况',
        subjectBlock('数学', stats.math, prog.math) +
        subjectBlock('英语', stats.english, prog.english)) +
      dailyCard(sum);
    wirePages();
  }).catch(function () {
    content.innerHTML = failHtml('今日数据');
  });
}

/* ---------------- 本周 ---------------- */

function weekChart(days) {
  days = days || [];
  if (!days.length) return '<div class="p-empty">本周暂无学习数据</div>';
  var bars = '';
  for (var i = 0; i < days.length; i++) {
    var dy = days[i] || {};
    var m = Number(dy.math_done) || 0;
    var e = Number(dy.en_done) || 0;
    var tot = m + e;
    var hPct = Math.min(100, tot / 100 * 100);
    var mh = tot === 0 ? 0 : (m / tot) * 100;
    bars += '<div class="p-wday">' +
      '<div class="p-wbar" style="height:' + Math.max(hPct, tot > 0 ? 4 : 2) + '%">' +
        '<i class="p-wseg-math" style="height:' + mh + '%"></i>' +
        '<i class="p-wseg-en" style="height:' + (tot === 0 ? 0 : 100 - mh) + '%"></i>' +
      '</div>' +
      '<div class="p-wval">' + tot + '</div>' +
      '<div class="p-wlab">' + esc(weekdayShort(dy.date)) + '<br>' + esc(mmdd(dy.date)) + '</div>' +
    '</div>';
  }
  return '<div class="p-chart">' + bars + '</div>' +
    '<div class="p-legend"><span><i class="p-dot" style="background:#2E7CF6"></i>数学</span>' +
    '<span><i class="p-dot" style="background:#9CC2FA"></i>英语</span></div>';
}

/* 无周结时：按 kp_id 汇总本周错题（≥3 次才算重复），明确标数据不足 */
function aggregateErrors(weekErrors) {
  var byKp = {};
  var order = [];
  for (var i = 0; i < weekErrors.length; i++) {
    var a = weekErrors[i] || {};
    var k = a.kp_id || 'unknown';
    if (!byKp[k]) { byKp[k] = { kp_id: k, ids: [] }; order.push(k); }
    var id = a.id !== undefined && a.id !== null ? a.id : a.instance_id;
    if (id !== undefined && id !== null) byKp[k].ids.push(id);
  }
  var out = [];
  for (var j = 0; j < order.length; j++) {
    var g = byKp[order[j]];
    if (g.ids.length >= 3) {
      out.push({
        cause_tag: '待归因',
        kp_id: g.kp_id,
        note: '该知识点本周共错 ' + g.ids.length + ' 次（规则版暂未生成归因，等 AI 周结确认）',
        evidence_question_ids: g.ids,
        parent_action: '和孩子一起重做下面 ' + g.ids.length + ' 道错题，每题说出思路，连续做对 3 道后结束，约 10 分钟。',
        confidence: 'low'
      });
    }
  }
  return out;
}

function findErr(weekErrors, qid) {
  if (!weekErrors) return null;
  for (var i = 0; i < weekErrors.length; i++) {
    var e = weekErrors[i] || {};
    if (String(e.id) === String(qid) || String(e.instance_id) === String(qid)) return e;
  }
  return null;
}

function evidenceHtml(ids, weekErrors) {
  if (!ids || !ids.length) return '<div class="p-empty">暂无证据题目</div>';
  var h = '';
  for (var i = 0; i < ids.length; i++) {
    var e = findErr(weekErrors, ids[i]);
    if (!e) {
      h += '<div class="p-ev"><div class="p-ev-q">题号 ' + esc(String(ids[i])) + '</div>' +
        '<div class="p-text">作答记录未找到</div></div>';
      continue;
    }
    h += '<div class="p-ev">' +
      '<div class="p-ev-q">' + esc(e.stem || '(题干缺失)') + '</div>' +
      '<div class="p-ev-row"><span>标准答案：' + esc(e.answer === undefined || e.answer === null ? '—' : String(e.answer)) + '</span></div>' +
      '<div class="p-ev-row"><span>孩子答案：' + esc(e.given_answer === undefined || e.given_answer === null ? '—' : String(e.given_answer)) + '</span></div>' +
      '<div class="p-ev-row"><span class="' + (e.correct ? 'p-ev-ok' : 'p-ev-bad') + '">' +
        (e.correct ? '✓ 答对' : '✗ 答错') + '</span>' +
        '<span>用时 ' + fmtSecs(e.time_ms) + '</span></div>' +
    '</div>';
  }
  return h;
}

function repeatItemHtml(it, weekErrors) {
  it = it || {};
  var ids = it.evidence_question_ids || [];
  var low = it.confidence === 'low';
  var evList = ids.length ? ids.join('、') : '—';
  return '<div class="p-err">' +
    '<div class="p-err-head">' +
      '<span class="p-tag">' + esc(it.cause_tag || '待归因') + '</span>' +
      (low ? lowBadge() : '') +
      '<div class="p-err-note">' + esc(it.note || it.kp_id || '') + '</div>' +
      '<div class="p-err-ev">证据题号：' + esc(evList) + '　<span class="p-more">点开展开 ▾</span></div>' +
    '</div>' +
    '<div class="p-err-detail">' +
      evidenceHtml(ids, weekErrors) +
      '<div class="p-action"><div class="p-action-title">今晚可以这样做（约10分钟）</div>' +
      '<div class="p-text">' + esc(it.parent_action || '和孩子一起重做上面的错题，每题说出思路，做对 3 道后结束。') + '</div></div>' +
    '</div>' +
  '</div>';
}

function repeatErrorsHtml(weekly, weekErrors) {
  var items = (weekly && weekly.repeat_errors) || [];
  var title = '重复错误清单';
  if (!items.length && weekErrors && weekErrors.length) {
    items = aggregateErrors(weekErrors);
    if (items.length) title += lowBadge();
  }
  if ((weekly && weekly.confidence === 'low')) title += lowBadge();
  if (!items.length) {
    return card(title, '<div class="p-empty">本周暂无重复错误 🎉</div>');
  }
  var h = '';
  for (var i = 0; i < items.length; i++) h += repeatItemHtml(items[i], weekErrors);
  if (weekly && weekly.weekly_summary) {
    h += '<p class="p-text">' + esc(weekly.weekly_summary) + '</p>';
  }
  return card(title, h);
}

function wireExpandable(scope) {
  var heads = scope.querySelectorAll('.p-err-head');
  for (var i = 0; i < heads.length; i++) {
    (function (hd) {
      hd.addEventListener('click', function () {
        var box = hd.parentNode;
        if (box.className.indexOf('open') >= 0) {
          box.className = box.className.replace(' open', '');
        } else {
          box.className += ' open';
        }
      });
    })(heads[i]);
  }
}

function renderWeek(content) {
  content.innerHTML = loadingHtml();
  var d = todayStr();
  Promise.all([
    apiGet('/api/stats/week?date=' + d),
    apiGet('/api/summary/weekly?date=' + d),
    apiGet('/api/errors?week=1&date=' + d)
  ]).then(function (rs) {
    var week = rs[0] || {};
    var weekly = rs[1];
    var errors = rs[2] || [];
    S.weekErrors = errors;
    content.innerHTML =
      card('7 天学习概览', weekChart(week.days)) +
      repeatErrorsHtml(weekly, errors);
    wireExpandable(content);
  }).catch(function () {
    content.innerHTML = failHtml('本周数据');
  });
}

/* ---------------- 知识点地图 ---------------- */

/* 状态：未学灰 / 学习中蓝 / 掌握绿 / 待加强橙 / 巩固金（颜色＋图标双通道） */
function statusMeta(st) {
  var s = String(st === undefined || st === null ? '' : st).toLowerCase();
  if (s === 'mastered' || s === '已掌握' || s === '掌握') {
    return { label: '掌握', cls: 'st-mastered', icon: '✓' };
  }
  if (s === 'learning' || s === '学习中') {
    return { label: '学习中', cls: 'st-learning', icon: '◐' };
  }
  if (s === 'weak' || s === '待巩固' || s === '待加强' || s === '薄弱') {
    return { label: '待加强', cls: 'st-weak', icon: '!' };
  }
  if (s === 'review' || s === '巩固' || s === 'consolidated') {
    return { label: '巩固', cls: 'st-review', icon: '★' };
  }
  return { label: '未学', cls: 'st-new', icon: '○' };
}

function subjTabsHtml() {
  return '<div class="p-subjtabs">' +
    '<button type="button" data-subj="math" class="' + (S.subject === 'math' ? 'active' : '') + '">数学</button>' +
    '<button type="button" data-subj="english" class="' + (S.subject === 'english' ? 'active' : '') + '">英语</button>' +
  '</div>';
}

function mapHtml(kps) {
  kps = kps || [];
  if (!kps.length) return '<div class="p-empty">暂无知识点数据</div>';
  var units = [];
  var byUnit = {};
  for (var i = 0; i < kps.length; i++) {
    var u = kps[i].unit || '未分组';
    if (!byUnit[u]) { byUnit[u] = []; units.push(u); }
    byUnit[u].push(kps[i]);
  }
  var h = '';
  for (var j = 0; j < units.length; j++) {
    var list = byUnit[units[j]];
    var mastered = 0;
    for (var k = 0; k < list.length; k++) {
      if (statusMeta(list[k].status).cls === 'st-mastered') mastered++;
    }
    h += '<div class="p-unit"><div class="p-unit-head"><span>' + esc(units[j]) + '</span>' +
      '<span class="p-unit-count">' + mastered + '/' + list.length + ' 已掌握</span></div>';
    h += '<div class="p-kpgrid">';
    for (var n = 0; n < list.length; n++) {
      var kp = list[n];
      var m = statusMeta(kp.status);
      h += '<div class="p-kp ' + m.cls + '" data-kp="' + esc(kp.kp_id) + '">' +
        '<div class="p-kp-icon">' + m.icon + '</div>' +
        '<div class="p-kp-name">' + esc(kp.name || kp.kp_id) + '</div>' +
        '<div class="p-kp-status">' + m.label +
        (kp.pages ? ' · p' + esc(String(kp.pages)) : '') + '</div>' +
        '<div class="p-kp-detail"></div>' +
      '</div>';
    }
    h += '</div></div>';
  }
  return h;
}

function kpHistoryHtml(kpId) {
  var errs = [];
  var all = S.weekErrors || [];
  for (var i = 0; i < all.length; i++) {
    if ((all[i] || {}).kp_id === kpId) errs.push(all[i]);
  }
  if (!errs.length) {
    return '<div class="p-kp-hist-title">本周作答历史</div>' +
      '<div class="p-empty">本周该知识点暂无错题 ✓（仅收录错题记录）</div>';
  }
  var h = '<div class="p-kp-hist-title">本周错题（' + errs.length + ' 条，仅收录错题记录）</div>';
  for (var j = 0; j < errs.length; j++) {
    var e = errs[j] || {};
    h += '<div class="p-kp-hist">' +
      '<div>' + esc(e.stem || '(题干缺失)') + '</div>' +
      '<div>孩子答案：' + esc(e.given_answer === undefined || e.given_answer === null ? '—' : String(e.given_answer)) +
      '　<span class="p-ev-bad">✗ 答错</span></div>' +
      '<div>标准答案：' + esc(e.answer === undefined || e.answer === null ? '—' : String(e.answer)) +
      '　用时 ' + fmtSecs(e.time_ms) + (whenStr(e) ? '　' + esc(whenStr(e)) : '') + '</div>' +
    '</div>';
  }
  return h;
}

function wireKp(scope) {
  var cards = scope.querySelectorAll('.p-kp');
  for (var i = 0; i < cards.length; i++) {
    (function (el) {
      el.addEventListener('click', function () {
        var detail = el.querySelector('.p-kp-detail');
        var isOpen = el.className.indexOf('open') >= 0;
        if (isOpen) {
          el.className = el.className.replace(' open', '');
          return;
        }
        detail.innerHTML = kpHistoryHtml(el.getAttribute('data-kp'));
        el.className += ' open';
      });
    })(cards[i]);
  }
}

function loadMap(body) {
  body.innerHTML = loadingHtml();
  var d = todayStr();
  Promise.all([
    apiGet('/api/kps?subject=' + S.subject + '&date=' + d),
    apiGet('/api/errors?week=1&date=' + d)
  ]).then(function (rs) {
    S.weekErrors = rs[1] || [];
    body.innerHTML = mapHtml(rs[0]);
    wireKp(body);
  }).catch(function () {
    body.innerHTML = failHtml('知识点地图');
  });
}

function renderMap(content) {
  content.innerHTML = subjTabsHtml() + '<div id="pMapBody"></div>';
  var body = document.getElementById('pMapBody');
  var tabs = content.querySelectorAll('.p-subjtabs button');
  for (var i = 0; i < tabs.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        S.subject = b.getAttribute('data-subj');
        for (var j = 0; j < tabs.length; j++) {
          tabs[j].className = tabs[j].getAttribute('data-subj') === S.subject ? 'active' : '';
        }
        loadMap(body);
      });
    })(tabs[i]);
  }
  loadMap(body);
}

/* ---------------- 设置 ---------------- */

function setRow(icon, title, sub, action) {
  return '<div class="p-setrow" data-action="' + action + '">' +
    '<span class="p-set-ic">' + icon + '</span>' +
    '<span class="p-set-main"><span class="p-set-title">' + esc(title) + '</span>' +
    (sub ? '<div class="p-set-sub">' + esc(sub) + '</div>' : '') + '</span>' +
    '<span class="p-chev">›</span></div>';
}

function renderSettings(content) {
  content.innerHTML = loadingHtml();
  /* GET /api/setup 不在契约内，仅作尽力预填，失败则忽略 */
  apiGet('/api/setup').then(function (s) { return s; }, function () { return null; })
  .then(function (setup) {
    var name = (setup && setup.name) ? setup.name : '';
    content.innerHTML =
      card('孩子',
        '<div class="p-profile"><div class="p-avatar">🧒</div>' +
        '<div><div class="p-profile-name">' + (name ? esc(name) : '宝宝') + '</div>' +
        '<div class="p-profile-sub">单孩子模式</div></div></div>') +
      card('孩子名字',
        '<div class="p-formrow"><label>名字</label>' +
        '<input id="pChildName" class="p-input" type="text" maxlength="20" value="' + esc(name) + '" placeholder="如：铭希"></div>' +
        '<button class="p-btn" id="pSaveName" type="button">保存名字</button>') +
      card('声音',
        '<div class="p-set-sub">如果听不到题目朗读或答题音效，请检查手机侧面的<span style="font-weight:700">静音拨片</span>是否打开（iPhone 静音模式下网页音效无声）。</div>') +
      card('重新出题',
        '<div class="p-set-sub" style="margin-bottom:10px">清空今天的作答记录，孩子可以重新做一轮 50 道新题（用于验证题目内容）。</div>' +
        '<button class="p-btn p-btn-danger" id="pResetToday" type="button">🔄 重新出题</button>') +
      '<section class="p-card">' +
        setRow('🔔', '通知方式', '学习报告推送', 'notify') +
        setRow('📤', '数据导出', '下载全部作答记录（CSV）', 'export') +
        setRow('👨‍👩‍👧', '多孩子管理', '即将推出', 'kids') +
      '</section>' +
      '<section class="p-card">' +
        '<div class="p-setrow p-setrow-danger" data-action="exit">' +
          '<span class="p-set-ic">🚪</span>' +
          '<span class="p-set-main"><span class="p-set-title">退出家长端</span>' +
          '<div class="p-set-sub">返回孩子端</div></span>' +
          '<span class="p-chev">›</span></div>' +
      '</section>';
    wireSettings();
  });
}

function wireSettings() {
  var saveName = document.getElementById('pSaveName');
  if (saveName) {
    saveName.addEventListener('click', function () {
      var v = document.getElementById('pChildName').value.trim();
      if (!v) { toast('名字不能为空'); return; }
      apiPost('/api/setup', { name: v }).then(function () {
        try { window._chChildName = v; } catch (e) {}
        toast('名字已更新');
      }).catch(function () { toast('保存失败，请重试'); });
    });
  }
  /* 重新出题：清空今天记录 */
  var resetBtn = document.getElementById('pResetToday');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (!confirm('确定要清空今天的作答记录并重新出题吗？')) { return; }
      resetBtn.disabled = true;
      resetBtn.textContent = '清空中…';
      apiPost('/api/reset-today', {}).then(function (r) {
        toast('已清空 ' + (r.cleared || 0) + ' 条记录，可以重新做题了');
        resetBtn.disabled = false;
        resetBtn.textContent = '🔄 重新出题';
      }).catch(function () {
        toast('操作失败，请重试');
        resetBtn.disabled = false;
        resetBtn.textContent = '🔄 重新出题';
      });
    });
  }
  var rows = document.querySelectorAll('.p-setrow');
  for (var i = 0; i < rows.length; i++) {
    (function (row) {
      row.addEventListener('click', function () {
        var a = row.getAttribute('data-action');
        if (a === 'notify') toast('通知功能后续开通');
        else if (a === 'kids') toast('多孩子管理即将推出');
        else if (a === 'export') doExport();
        else if (a === 'exit') exitParent();
      });
    })(rows[i]);
  }
}

function doExport() {
  var a = document.createElement('a');
  a.href = '/api/export?format=csv';
  a.setAttribute('download', 'learn-records.csv');
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 500);
  toast('开始下载');
}

function exitParent() {
  if (S.api && typeof S.api.exitParent === 'function') {
    S.api.exitParent();
    return;
  }
  /* app.js 未提供 exitParent：重载回入口，默认路由为孩子端（CONTRACT §11） */
  window.location.reload();
}

/* ---------------- 入口 ---------------- */

function setTab(name) {
  S.tab = name;
  var btns = document.querySelectorAll('.p-nav button');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].getAttribute('data-tab') === name) {
      if (btns[i].className.indexOf('active') < 0) btns[i].className += ' active';
    } else {
      btns[i].className = btns[i].className.replace(' active', '');
    }
  }
  var content = document.getElementById('pContent');
  if (!content) return;
  if (name === 'today') renderToday(content);
  else if (name === 'week') renderWeek(content);
  else if (name === 'map') renderMap(content);
  else if (name === 'settings') renderSettings(content);
}

function render(appEl, API) {
  S.api = API || null;
  S.tab = 'today';
  S.subject = 'math';
  S.weekErrors = null;
  appEl.innerHTML = shellHtml();
  var dEl = document.getElementById('pNavDate');
  if (dEl) { dEl.textContent = new Date().getDate(); }
  var btns = appEl.querySelectorAll('.p-nav button');
  for (var i = 0; i < btns.length; i++) {
    (function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    })(btns[i]);
  }
  setTab('today');
}

window.Parent = { render: render };

})();
