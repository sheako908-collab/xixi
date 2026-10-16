/* app-v3 出题引擎（engine 负责）
 * window.ENGINE = { generate(subject, slots, opts), generateRetry(kp_id, type, opts) }
 * generate：按 slots [{kp_id, count, difficulty, kind}] 生成题目数组
 *   约束：同一 KP 一天 ≤8 道；题型打散（连续两道不同 type）；每组 10 道、组内前 2 道强制较易；
 *   7 天去重（values JSON 签名，模块内 Set）；instance_id 格式 YYYYMMDD-序号；
 *   word2 模板拆成两个 question（step 1/2，共享 group_id，先后相邻）。
 * generateRetry(kp_id, type, opts)：同 KP 同 type 换数字出新题（返回数组，word2 返回 2 道）。
 * ES5 语法，直接 <script> 引入
 */
(function () {
  var seen = {};          /* values 签名去重（7 天窗口由调用方定期清，这里只做内存 Set） */
  var seq = 0;            /* instance 序号计数器 */
  var EN_TYPES = ['listen_choice', 'listen_pic', 'pic_choice', 'spell',
                  'fill_letter', 'order', 'listen_meaning', 'read_aloud'];
  var EN_EASY = ['listen_pic', 'pic_choice']; /* 组内前 2 道用的较易题型 */

  function eng_rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function eng_pick(arr) { return arr[eng_rnd(0, arr.length - 1)]; }
  function eng_shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = eng_rnd(0, i), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function eng_pad4(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }
  function eng_today() {
    var d = new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function eng_sig(tid, values) { return tid + '|' + JSON.stringify(values); }

  /* 按 kp 取数学模板（按难度过滤，无匹配难度时退回全部并优先低难度） */
  function mathTemplates(kp_id, difficulty) {
    var all = (window.MATH_BANK && window.MATH_BANK[kp_id]) || [];
    var hit = all.filter(function (t) { return t.difficulty === difficulty; });
    if (hit.length) return hit;
    return all.slice().sort(function (a, b) { return a.difficulty - b.difficulty; });
  }
  /* 模板首题题型（用于打散判断；word2 首题为 choice） */
  function firstQType(t) {
    if (!t) return '';
    if (t.type === 'word2') return 'choice';
    return t.type;
  }

  /* 英语词句池：按 kp 的 unit 过滤，句子再按 [en_from, en_to] 页码范围截断。
     from/to 为 0 时视为全册。 */
  function enPool(kp_id, en_from, en_to) {
    var unit = kp_id.split('.')[1] || '';
    var words = [], sentences = [], i, w, s;
    for (i = 0; i < window.EN_DATA.words.length; i++) {
      w = window.EN_DATA.words[i];
      if (w.unit === unit) words.push(w);
    }
    for (i = 0; i < window.EN_DATA.sentences.length; i++) {
      s = window.EN_DATA.sentences[i];
      var inRange = true;
      if (en_from > 0 && s.page < en_from) inRange = false;
      if (en_to > 0 && s.page > en_to) inRange = false;
      if (s.unit === unit && inRange) sentences.push(s);
    }
    if (!words.length) words = window.EN_DATA.words;
    if (!sentences.length) sentences = window.EN_DATA.sentences;
    return { words: words, sentences: sentences };
  }

  function newId(datestr) { seq++; return datestr + '-' + eng_pad4(seq); }

  /* 数学按页码范围过滤 slots：只保留 KP 结束页在 [from, to] 内的知识点。
     from/to 为 0 时视为全册。无页码信息的 KP 保留（避免误杀）；
     过滤后为空、或过滤后的 KP 都没有模板时，返回原 slots 兜底，保证能出题。 */
  function filterMathSlotsByPage(slots, from, to) {
    if (!window.KP_MAP || !window.KP_MAP.math || !window.KP_MAP.math.units) return slots;
    if (!from && !to) return slots; /* 全册 */
    var kpPages = {};
    window.KP_MAP.math.units.forEach(function (u) {
      (u.kps || []).forEach(function (k) { kpPages[k.id] = k.pages; });
    });
    var filtered = slots.filter(function (sl) {
      var p = kpPages[sl.kp_id];
      if (!p) return true;
      var end = p[1];
      if (from > 0 && end < from) return false;
      if (to > 0 && end > to) return false;
      return true;
    });
    if (!filtered.length) return slots;
    var hasTpl = filtered.some(function (sl) {
      return window.MATH_BANK && window.MATH_BANK[sl.kp_id] && window.MATH_BANK[sl.kp_id].length;
    });
    if (!hasTpl) return slots;
    return filtered;
  }

  /* 生成一道数学题实例（模板已选好），返回 question 或 word2 的 [q1, q2] */
  function buildMath(t, kp_id, subject, kind, datestr, group_id, diffUsed) {
    var g, sig, tries = 0;
    do {
      g = t.gen();
      sig = eng_sig(t.id, g.values || {});
      tries++;
    } while (seen[sig] && tries < 40);
    seen[sig] = true;
    if (t.type === 'word2') {
      var gid = group_id || ('g' + datestr + '-' + eng_pad4(seq + 1));
      var q1 = { instance_id: newId(datestr), template_id: t.id, template_version: t.version || 1,
        kp_id: kp_id, subject: subject, type: 'choice', difficulty: diffUsed, kind: kind,
        stem: g.step1.stem, speak: g.step1.speak, options: g.step1.options, answer: g.step1.answer,
        accept: g.step1.accept, audio: null, misconceptions: g.step1.misconceptions,
        solution: g.step1.solution, values: g.values, fig: g.step1.fig || null, step: 1, group_id: gid };
      var q2 = { instance_id: newId(datestr), template_id: t.id, template_version: t.version || 1,
        kp_id: kp_id, subject: subject, type: 'input', difficulty: diffUsed, kind: kind,
        stem: g.step2.stem, speak: g.step2.speak, options: g.step2.options, answer: g.step2.answer,
        accept: g.step2.accept, audio: null, misconceptions: g.step2.misconceptions,
        solution: g.step2.solution, values: g.values, fig: g.step2.fig || null, step: 2, group_id: gid };
      return [q1, q2];
    }
    return [{ instance_id: newId(datestr), template_id: t.id, template_version: t.version || 1,
      kp_id: kp_id, subject: subject, type: t.type, difficulty: diffUsed, kind: kind,
      stem: g.stem, speak: g.speak, options: g.options, answer: g.answer,
      accept: g.accept, audio: null, misconceptions: g.misconceptions,
      solution: g.solution, values: g.values, fig: g.fig || null }];
  }

  /* 生成一道英语题实例 */
  function buildEn(typeKey, kp_id, kind, datestr, pool, diffUsed) {
    var tpl = window.EN_BANK[typeKey];
    var g = tpl.gen(pool);
    var sig = eng_sig(tpl.id, g.values || {});
    var tries = 0;
    while (seen[sig] && tries < 40) { g = tpl.gen(pool); sig = eng_sig(tpl.id, g.values || {}); tries++; }
    seen[sig] = true;
    return [{ instance_id: newId(datestr), template_id: tpl.id, template_version: 1,
      kp_id: kp_id, subject: 'english', type: tpl.type, difficulty: diffUsed, kind: kind,
      stem: g.stem, speak: g.speak, options: g.options, answer: g.answer,
      accept: g.accept, audio: g.audio, misconceptions: g.misconceptions,
      solution: g.solution, values: g.values, fig: g.fig || null, blocks: g.blocks || null,
      noScore: g.noScore || false }];
  }

  function generate(subject, slots, opts) {
    opts = opts || {};
    var date = opts.date || eng_today();
    var datestr = date.replace(/-/g, '');
    var total = opts.total || 50;
    var en_from = opts.en_from | 0, en_to = opts.en_to | 0;
    var math_from = opts.math_from | 0, math_to = opts.math_to | 0;

    /* 数学按页码范围过滤 slots；
       过滤后无可用 KP（或无模板）时兜底用全部 slots，避免出不了题 */
    if (subject === 'math') {
      slots = filterMathSlotsByPage(slots, math_from, math_to);
    }

    /* 1. 展开 slots 为 item 列表；同一 KP 一天 ≤8 道
       （KP 太少撑不满总数时自动放宽上限，保证能出满 total 道） */
    var kpCount = {}, items = [], i, s, c, n, _nk = {};
    slots.forEach(function (sl) { _nk[sl.kp_id] = 1; });
    var capPerKp = Math.max(8, Math.ceil(total / Math.max(1, Object.keys(_nk).length)));
    for (i = 0; i < slots.length; i++) {
      s = slots[i];
      n = Math.min(s.count, capPerKp - (kpCount[s.kp_id] || 0));
      for (c = 0; c < n; c++) {
        items.push({ kp_id: s.kp_id, difficulty: s.difficulty || 1, kind: s.kind || 'new' });
      }
      kpCount[s.kp_id] = (kpCount[s.kp_id] || 0) + n;
    }
    /* word2 占 2 道：先为每个 item 预选模板并算好占位，再从末尾裁剪，保证总数精确 */
    items.forEach(function (it) {
      if (subject === 'math') {
        var ts = mathTemplates(it.kp_id, it.difficulty);
        it._t = ts.length ? eng_pick(ts) : null;
      } else {
        it._t = eng_pick(EN_TYPES);
      }
      it._exp = (subject === 'math' && it._t && it._t.type === 'word2') ? 2 : 1;
    });
    /* 按 KP 轮询交错，避免同一 KP 连排（帮助题型打散） */
    (function interleave() {
      var buckets = {}, order = [], i, kid;
      items.forEach(function (it) {
        if (!buckets[it.kp_id]) { buckets[it.kp_id] = []; order.push(it.kp_id); }
        buckets[it.kp_id].push(it);
      });
      var out = [], more = true;
      while (more) {
        more = false;
        for (i = 0; i < order.length; i++) {
          kid = order[i];
          if (buckets[kid].length) { out.push(buckets[kid].shift()); more = true; }
        }
      }
      items.length = 0;
      for (i = 0; i < out.length; i++) items.push(out[i]);
    })();

    /* 2. 逐 item 生成；题型打散；word2 两步永不跨组 */
    var questions = [], lastType = '', pending = items.slice();
    var groupNo = 0, group_id = '', kpItems = {};
    function emitItem(item, tChoice, dChoice) {
      var p = questions.length % 10, gid = group_id;
      if (p === 0) { groupNo++; gid = 'g' + datestr + '-' + eng_pad4(groupNo); group_id = gid; }
      var qs = subject === 'math'
        ? buildMath(tChoice, item.kp_id, subject, item.kind, datestr, gid, dChoice)
        : buildEn(tChoice, item.kp_id, item.kind, datestr, enPool(item.kp_id, en_from, en_to), dChoice);
      for (var i = 0; i < qs.length; i++) questions.push(qs[i]);
      lastType = questions[questions.length - 1].type;
      kpItems[item.kp_id] = (kpItems[item.kp_id] || 0) + 1;
    }
    function pickTemplateMath(item, d, avoidType, mustExpand) {
      var cands = mathTemplates(item.kp_id, d);
      function filterExp(list) {
        if (typeof mustExpand === 'boolean') {
          return list.filter(function (x) { return (x.type === 'word2') === mustExpand; });
        }
        return list;
      }
      cands = filterExp(cands);
      if (!cands.length) return null;
      var alt = cands.filter(function (x) { return firstQType(x) !== avoidType; });
      if (alt.length) return eng_pick(alt);
      /* 同难度下无不同题型：退回该 KP 其他难度找不同题型的（取最易的） */
      var all = filterExp((window.MATH_BANK[item.kp_id] || []).slice().sort(function (a, b) {
        return a.difficulty - b.difficulty;
      }));
      var alt2 = all.filter(function (x) { return firstQType(x) !== avoidType; });
      if (alt2.length) return alt2[0];
      return eng_pick(cands);
    }
    while (pending.length) {
      var pos = questions.length % 10;
      /* 两遍扫描找"放得下"的 item：
         第1遍优先选与上一题不同题型的（题型打散），第2遍放宽；
         word2 占 2 道，不能从第 10 道开始（两步永不跨组） */
      var chosen = -1, chosenT = null, chosenD = 1, pass, k, it, t2;
      for (pass = 0; pass < 2 && chosen < 0; pass++) {
        for (k = 0; k < pending.length; k++) {
          it = pending[k];
          if (subject === 'math') {
            t2 = pickTemplateMath(it, 1, lastType, it._exp === 2);
            if (!t2) t2 = it._t;
          } else {
            var typeKeys = EN_TYPES.slice();
            var altT = typeKeys.filter(function (x) { return x !== lastType; });
            t2 = eng_pick(altT.length ? altT : typeKeys);
          }
          if (!t2) continue;
          if (pos + it._exp > 10) continue;
          if (pass === 0) {
            var ft = subject === 'math' ? firstQType(t2) : t2;
            if (ft === lastType) continue;
          }
          chosen = k; chosenT = t2; break;
        }
      }
      if (chosen < 0) { /* 极端情况（剩余全是 word2 且 pos=9）：允许跨组，不死循环 */
        chosen = 0; it = pending[0]; chosenD = it.difficulty;
        chosenT = subject === 'math' ? (pickTemplateMath(it, chosenD, lastType, it._exp === 2) || it._t) : eng_pick(EN_TYPES);
      } else {
        it = pending[chosen];
        chosenD = (pos < 2 || (it._exp === 2 && pos <= 2)) ? 1 : it.difficulty;
        if (subject === 'math' && chosenD !== 1) {
          /* 非首2道：按 item 难度重选模板（保持打散，且不改变占位类型） */
          chosenT = pickTemplateMath(it, chosenD, lastType, it._exp === 2) || chosenT;
        }
        if (subject !== 'math' && pos < 2) {
          var ek = EN_EASY.filter(function (x) { return x !== lastType; });
          chosenT = eng_pick(ek.length ? ek : EN_EASY);
        }
      }
      pending.splice(chosen, 1);
      if (!chosenT) continue;
      emitItem(it, chosenT, chosenD);
    }

    /* 3. 超量时从末尾整 item 裁掉（word2 两步是原子，不拆散） */
    while (questions.length > total) {
      var lq = questions[questions.length - 1];
      questions.pop();
      if (lq.step === 2 && questions.length && questions[questions.length - 1].step === 1) {
        questions.pop();
      }
    }
    /* 重算各 KP 已用 item 数；续上题型打散 */
    kpItems = {};
    questions.forEach(function (q) {
      if (q.step !== 2) kpItems[q.kp_id] = (kpItems[q.kp_id] || 0) + 1;
    });
    lastType = questions.length ? questions[questions.length - 1].type : '';

    /* 4. 补足到 total（word2 展开/裁剪后不足时，用单题复习模板补，保证总数精确） */
    function hasSingle(kp_id) {
      if (subject !== 'math') return true;
      var ts = window.MATH_BANK[kp_id] || [], i;
      for (i = 0; i < ts.length; i++) if (ts[i].type !== 'word2') return true;
      return false;
    }
    var fillerKps = slots.map(function (s) { return s.kp_id; });
    var guard = 0;
    while (questions.length < total && guard < 500) {
      guard++;
      var fkp = null, fi;
      for (fi = 0; fi < fillerKps.length; fi++) {
        if ((kpItems[fillerKps[fi]] || 0) < capPerKp && hasSingle(fillerKps[fi])) { fkp = fillerKps[fi]; break; }
      }
      if (!fkp) {
        /* 上限用满仍不足：放宽上限，选 item 数最少的 KP 继续补 */
        var bestN = 1e9;
        for (fi = 0; fi < fillerKps.length; fi++) {
          if (!hasSingle(fillerKps[fi])) continue;
          var nn = kpItems[fillerKps[fi]] || 0;
          if (nn < bestN) { bestN = nn; fkp = fillerKps[fi]; }
        }
      }
      if (!fkp) break;
      var fitem = { kp_id: fkp, difficulty: 1, kind: 'review' };
      var fpos = questions.length % 10, ft2;
      if (subject === 'math') {
        ft2 = pickTemplateMath(fitem, 1, lastType, false);
        if (!ft2) continue;
      } else {
        var fkeys = (fpos < 2 ? EN_EASY.slice() : EN_TYPES.slice()).filter(function (x) { return x !== lastType; });
        ft2 = eng_pick(fkeys.length ? fkeys : EN_TYPES);
      }
      emitItem(fitem, ft2, 1);
    }
    return questions;
  }

  function generateRetry(kp_id, type, opts) {
    opts = opts || {};
    var date = opts.date || eng_today();
    var datestr = date.replace(/-/g, '');
    if (kp_id.indexOf('en.') === 0) {
      var pool = opts.pool || enPool(kp_id, opts.en_from | 0, opts.en_to | 0);
      return buildEn(type, kp_id, opts.kind || 'review', datestr, pool, 1);
    }
    var cands = ((window.MATH_BANK && window.MATH_BANK[kp_id]) || []).filter(function (t) {
      return t.type === type;
    });
    if (!cands.length) return [];
    var t = eng_pick(cands);
    return buildMath(t, kp_id, 'math', opts.kind || 'review', datestr, null, t.difficulty);
  }

  window.ENGINE = {
    generate: generate,
    generateRetry: generateRetry,
    _seenSize: function () { return Object.keys(seen).length; },
    _reset: function () { seen = {}; seq = 0; }
  };
})();
