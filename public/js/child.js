/* child.js — 孩子端 4 页：首页 / 答题 / 组间休息 / 完成
 * 约束：不显示正确率；不调用 AI；判分全部由程序完成。 */
(function () {
  var SUBJECT_NAME = { math: '数学', english: '英语' };
  var GROUP_SIZE = 10;
  var GROUP_COUNT = 5;
  var CORRECT_MS = 1400;   /* 答对后 1.4 秒下一题 */
  var WRONG_MS = 2600;     /* 答错展示正确答案停留 */

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function $(id) { return document.getElementById(id); }
  function isCJK(t) { return /[\u4e00-\u9fff]/.test(String(t)); }

  /* ================= 语音 ================= */
  /* iOS 上 speechSynthesis 必须在用户手势后"预热"才能出声，且 cancel 后立即 speak
   * 会丢第一句（iOS 已知 bug），所以 cancel 后延迟 60ms 再播。 */
  var _voicesReady = false;
  function ensureVoices() {
    try {
      var s = window.speechSynthesis;
      if (!s) { return; }
      if (s.getVoices && s.getVoices().length) { _voicesReady = true; return; }
      s.onvoiceschanged = function () { _voicesReady = true; };
    } catch (e) {}
  }
  ensureVoices();
  function speak(text, lang, onend, retried) {
    try {
      var s = window.speechSynthesis;
      if (!s) { if (onend) { onend(); } return; }
      s.cancel();
      /* iOS：cancel 后立即 speak 会被吞，延迟一小会 */
      setTimeout(function () {
        try {
          var u = new SpeechSynthesisUtterance(text);
          u.lang = lang || 'zh-CN';
          /* 英语再慢一点（孩子跟读），中文保持 */
          u.rate = (u.lang.indexOf('en') === 0) ? 0.8 : 0.92;
          /* 明确选 voice：iOS 默认 voice 可能不支持中文，导致中文无声。
           * 中文优先 zh-CN，英文优先 en-US；精确匹配不到就按语言前缀找。 */
          try {
            var _vs = (s.getVoices && s.getVoices()) || [];
            if (_vs.length) {
              var _want = String(u.lang).toLowerCase(), _pick = null, _i, _v, _vl;
              for (_i = 0; _i < _vs.length; _i++) {
                _v = _vs[_i]; _vl = String(_v.lang || '').toLowerCase();
                if (_vl === _want) { _pick = _v; break; }
              }
              if (!_pick) {
                var _pre = _want.split('-')[0];
                for (_i = 0; _i < _vs.length; _i++) {
                  _v = _vs[_i]; _vl = String(_v.lang || '').toLowerCase();
                  if (_vl.indexOf(_pre) === 0) { _pick = _v; break; }
                }
              }
              if (_pick) { u.voice = _pick; }
              else { try { console.warn('[tts] no voice for ' + u.lang); } catch (e2) {} }
            }
          } catch (e2) {}
          var done = false;
          function fin() { if (!done) { done = true; if (onend) { onend(); } } }
          u.onend = fin;
          u.onerror = function () {
            /* 失败重试一次（延迟 400ms） */
            if (!retried) { setTimeout(function () { speak(text, lang, onend, true); }, 400); }
            else { fin(); }
          };
          s.speak(u);
          /* 兜底：如果 8 秒还没回调，强制继续流程 */
          setTimeout(fin, 8000);
        } catch (e) { if (onend) { onend(); } }
      }, 60);
    } catch (e) { if (onend) { onend(); } }
  }
  var _curAudio = null;
  function stopSpeak() {
    try { if (window.speechSynthesis) { window.speechSynthesis.cancel(); } } catch (e) {}
    try { if (_curAudio) { _curAudio.pause(); _curAudio = null; } } catch (e) {}
  }
  function speakLang(text, subject) {
    if (subject === 'english' && !isCJK(text)) { return 'en-US'; }
    return 'zh-CN';
  }

  /* ================= 音效（WebAudio 合成，无需音频文件） =================
   * iOS 要求在用户手势里创建/恢复 AudioContext，所以全局监听第一次触摸来解锁。
   * 注意：iPhone 静音拨片打开时，网页音效可能无声。 */
  var AC = window.AudioContext || window.webkitAudioContext, actx = null;
  function unlockAudio() {
    try {
      if (!AC) { return; }
      if (!actx) { actx = new AC(); }
      if (actx.state === 'suspended') { actx.resume(); }
    } catch (e) {}
  }
  document.addEventListener('touchstart', unlockAudio, { passive: true });
  document.addEventListener('pointerdown', unlockAudio);
  /* 在用户手势里主动预热：resume AudioContext + 空话语解锁 speechSynthesis。
   * iOS 上不预热，之后所有的 speak/sfx 都会被静默丢弃。 */
  var _warmed = false;
  function warmupAudio() {
    if (_warmed) { return; }
    _warmed = true;
    try { unlockAudio(); } catch (e) {}
    try {
      var s = window.speechSynthesis;
      if (s) {
        s.cancel();
        var u = new SpeechSynthesisUtterance(' ');
        u.lang = 'zh-CN';
        u.volume = 0.01;
        s.speak(u);
      }
    } catch (e) {}
    ensureVoices();
  }
  function tone(freq, t0, dur, vol, type) {
    if (!actx) { return; }
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  /* ok：上行三连音（清脆）；no：柔和的两个下行音（不刺耳、不吓人） */
  function sfx(kind) {
    try {
      unlockAudio();
      if (!actx) { return; }
      var t = actx.currentTime + 0.01;
      if (kind === 'ok') {
        tone(784, t, 0.14, 0.22, 'triangle');
        tone(988, t + 0.10, 0.14, 0.22, 'triangle');
        tone(1319, t + 0.20, 0.32, 0.22, 'triangle');
      } else {
        tone(392, t, 0.16, 0.16, 'sine');
        tone(330, t + 0.15, 0.32, 0.16, 'sine');
      }
    } catch (e) {}
  }

  /* ================= 答对星星动画：SVG + 只用 transform/opacity ================= */
  var STAR_PTS = (function () {
    var pts = [], i, a, r;
    for (i = 0; i < 10; i++) {
      a = -Math.PI / 2 + i * Math.PI / 5;
      r = i % 2 === 0 ? 46 : 20;
      pts.push((50 + Math.cos(a) * r).toFixed(1) + ',' + (53 + Math.sin(a) * r).toFixed(1));
    }
    return pts.join(' ');
  })();
  function starBurst(host) {
    if (!host) { return; }
    var wrap = document.createElement('div'), html, i, a;
    wrap.className = 'ch-star-burst';
    html = '<svg class="st" viewBox="0 0 100 100"><polygon points="' + STAR_PTS +
      '" fill="#FFC857" stroke="#E0A93A" stroke-width="5" stroke-linejoin="round"/></svg>';
    for (i = 0; i < 6; i++) {
      a = -Math.PI / 2 + 0.52 + i * Math.PI / 3;
      html += '<i class="sp" style="--dx:' + Math.round(Math.cos(a) * 88) + 'px;--dy:' + Math.round(Math.sin(a) * 88) + 'px"></i>';
    }
    wrap.innerHTML = html;
    host.appendChild(wrap);
    setTimeout(function () { if (wrap.parentNode) { wrap.parentNode.removeChild(wrap); } }, 950);
  }

  /* 飞星：题目中央生成一颗星，沿弧线飞到右上角计数器，计数器 +1 */
  function bumpStar() {
    S.starCount++;
    var el = document.getElementById('starCounter');
    if (el) {
      el.innerHTML = '⭐×<b>' + S.starCount + '</b>';
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }
  function flyStar() {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var counter = document.getElementById('starCounter');
    var anchor = document.getElementById('stem') || document.getElementById('qbody');
    if (reduced || !counter || !anchor) { bumpStar(); return; }
    var c = counter.getBoundingClientRect();
    var a = anchor.getBoundingClientRect();
    var sx = a.left + a.width / 2, sy = a.top + Math.min(a.height / 2, 120);
    var ex = c.left + c.width / 2, ey = c.top + c.height / 2;
    var dx = ex - sx, dy = ey - sy;
    var star = document.createElement('div');
    star.className = 'ch-fly-star';
    star.textContent = '⭐';
    star.style.left = Math.round(sx - 16) + 'px';
    star.style.top = Math.round(sy - 16) + 'px';
    document.body.appendChild(star);
    var done = false;
    function finish() {
      if (done) { return; }
      done = true;
      if (star.parentNode) { star.parentNode.removeChild(star); }
      bumpStar();
    }
    try {
      var anim = star.animate([
        { transform: 'translate(0px,0px) scale(1.1)', opacity: 1 },
        { transform: 'translate(' + Math.round(dx * 0.5) + 'px,' + Math.round(dy * 0.5 - 70) + 'px) scale(0.9)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px) scale(0.4)', opacity: 0.85 }
      ], { duration: 600, easing: 'cubic-bezier(0.4,0,0.3,1)', fill: 'forwards' });
      if (anim && anim.onfinish !== undefined) { anim.onfinish = finish; }
    } catch (e) { /* 无 WAAPI 时走兜底 */ }
    setTimeout(finish, 700);
  }

  /* ================= 题目配图（SVG）：竖式 / 点子图 / 尺子 / 线段图 / 平移 / 对称 ================= */
  function svgWrap(w, h, inner) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" role="img">' + inner + '</svg>';
  }
  function figVert(f) {
    var A = String(f.a), B = String(f.b), n = Math.max(A.length, B.length, f.len) + 1;
    var cw = 44, rh = 54, x0 = 8, W = n * cw + 16, H = rh * 3 + 24, s = '', i;
    function digits(str, row) {
      var k, col;
      for (k = 0; k < str.length; k++) {
        col = n - str.length + k;
        s += '<text x="' + (x0 + col * cw + cw / 2) + '" y="' + (row * rh + 40) + '" text-anchor="middle" font-size="42" font-weight="800" fill="currentColor">' + str.charAt(k) + '</text>';
      }
    }
    digits(A, 0);
    digits(B, 1);
    s += '<text x="' + (x0 + (n - B.length - 1) * cw + cw / 2) + '" y="' + (rh + 40) + '" text-anchor="middle" font-size="42" font-weight="800" fill="currentColor">' + f.op + '</text>';
    s += '<rect x="' + x0 + '" y="' + (rh * 2 + 6) + '" width="' + (n * cw) + '" height="4" rx="2" fill="currentColor"/>';
    for (i = 0; i < f.len; i++) {
      s += '<rect x="' + (x0 + (n - f.len + i) * cw + 5) + '" y="' + (rh * 2 + 16) + '" width="' + (cw - 10) + '" height="' + (rh - 12) +
        '" rx="8" fill="#fff" stroke="#E0A93A" stroke-width="3" stroke-dasharray="6 4"/>';
    }
    return svgWrap(W, H, s);
  }
  function figDots(f) {
    var gap = 34, W = f.c * gap + 12, H = f.r * gap + 12, s = '', i, j;
    for (i = 0; i < f.r; i++) {
      for (j = 0; j < f.c; j++) {
        s += '<circle cx="' + (6 + gap / 2 + j * gap) + '" cy="' + (6 + gap / 2 + i * gap) + '" r="12" fill="#F5A623" stroke="#E0A93A" stroke-width="2"/>';
      }
    }
    return svgWrap(W, H, s);
  }
  function figRuler(f) {
    var from = f.from || 0, to = f.to, W = 360, pad = 16, H = 132, step = (W - pad * 2) / (to - from), s = '', t, x, tall;
    function X(v) { return pad + (v - from) * step; }
    /* 物体 */
    s += '<rect x="' + X(f.start) + '" y="12" width="' + ((f.end - f.start) * step) + '" height="32" rx="8" fill="#FFC857" stroke="#E0A93A" stroke-width="3"/>';
    s += '<text x="' + ((X(f.start) + X(f.end)) / 2) + '" y="35" text-anchor="middle" font-size="18" font-weight="800" fill="#5b4306">' + f.label + '</text>';
    /* 尺身 */
    s += '<rect x="2" y="64" width="' + (W - 4) + '" height="64" rx="6" fill="#FFF3C4" stroke="#E0A93A" stroke-width="2"/>';
    if (f.broken) {
      s += '<polygon points="0,58 10,58 4,72 13,86 5,100 14,114 6,132 0,132" fill="#FFF8E1"/>';
    }
    /* 对齐虚线 */
    s += '<line x1="' + X(f.start) + '" y1="44" x2="' + X(f.start) + '" y2="64" stroke="#8D6E32" stroke-width="2" stroke-dasharray="4 3"/>';
    s += '<line x1="' + X(f.end) + '" y1="44" x2="' + X(f.end) + '" y2="64" stroke="#8D6E32" stroke-width="2" stroke-dasharray="4 3"/>';
    /* 刻度 */
    for (t = from; t <= to; t++) {
      x = X(t);
      tall = (t % 5 === 0) ? 24 : 15;
      s += '<line x1="' + x + '" y1="64" x2="' + x + '" y2="' + (64 + tall) + '" stroke="#48463D" stroke-width="2"/>';
      s += '<text x="' + x + '" y="116" text-anchor="middle" font-size="' + (step >= 20 ? 15 : 13) + '" font-weight="700" fill="#48463D">' + t + '</text>';
    }
    return svgWrap(W, H, s);
  }
  function figSeg(f) {
    var W = 340, s = '', y1 = 14, y2 = 74, h = 36, sc, ew, solid;
    /* 示意图：「多/少」那一段最窄 52px，保证文字放得下 */
    if (f.more) {
      ew = Math.max(52, 0); sc = (W - 20 - ew) / f.a; solid = f.a * sc;
    } else {
      sc = (W - 20) / f.a; ew = Math.max(52, f.b * sc); solid = f.a * sc - ew;
    }
    s += '<rect x="10" y="' + y1 + '" width="' + (f.a * sc) + '" height="' + h + '" rx="8" fill="#F28B82"/>';
    s += '<text x="18" y="' + (y1 + 25) + '" font-size="18" font-weight="800" fill="#fff">红条 ' + f.a + '</text>';
    s += '<rect x="10" y="' + y2 + '" width="' + solid + '" height="' + h + '" rx="8" fill="#7FB3F5"/>';
    s += '<text x="18" y="' + (y2 + 25) + '" font-size="18" font-weight="800" fill="#fff">蓝条 ?</text>';
    s += '<rect x="' + (10 + solid) + '" y="' + y2 + '" width="' + ew + '" height="' + h +
      '" rx="8" fill="#fff" stroke="#7FB3F5" stroke-width="3" stroke-dasharray="7 5"/>';
    s += '<text x="' + (10 + solid + ew / 2) + '" y="' + (y2 + 25) + '" text-anchor="middle" font-size="17" font-weight="800" fill="#48463D">' + (f.more ? '多' : '少') + ' ' + f.b + '</text>';
    return svgWrap(W, 124, s);
  }
  function figShift(f) {
    var cols = f.cols, cw = 42, W = cols * cw + 8, H = 96, s = '', i;
    for (i = 0; i < cols; i++) {
      s += '<rect x="' + (4 + i * cw) + '" y="10" width="' + cw + '" height="' + cw + '" fill="#fff" stroke="#E0C98B" stroke-width="2"/>';
    }
    s += '<text x="' + (4 + f.x0 * cw + cw / 2) + '" y="42" text-anchor="middle" font-size="32" opacity="0.35">⛵</text>';
    s += '<text x="' + (4 + f.x1 * cw + cw / 2) + '" y="42" text-anchor="middle" font-size="32">⛵</text>';
    s += '<text x="' + (4 + f.x0 * cw + cw / 2) + '" y="76" text-anchor="middle" font-size="16" fill="#8D6E32">原来</text>';
    s += '<text x="' + (4 + f.x1 * cw + cw / 2) + '" y="76" text-anchor="middle" font-size="16" fill="#8D6E32" font-weight="700">现在</text>';
    return svgWrap(W, H, s);
  }
  var SYM_SHAPES = {
    tri: 'M50,8 L92,88 L8,88 Z',
    house: 'M50,8 L92,42 L80,42 L80,92 L20,92 L20,42 L8,42 Z',
    star: (function () {
      var pts = [], i, a, r;
      for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; r = i % 2 === 0 ? 46 : 19; pts.push((50 + Math.cos(a) * r).toFixed(1) + ',' + (53 + Math.sin(a) * r).toFixed(1)); }
      return 'M' + pts.join(' L') + ' Z';
    })(),
    diamond: 'M50,6 L88,50 L50,94 L12,50 Z',
    heart: 'M50,90 C10,60 6,30 28,20 C40,15 50,24 50,32 C50,24 60,15 72,20 C94,30 90,60 50,90 Z',
    rtri: 'M15,10 L15,90 L85,90 Z',
    ell: 'M20,10 L45,10 L45,65 L85,65 L85,90 L20,90 Z',
    flag: 'M14,8 L82,26 L22,46 L22,94 L14,94 Z',
    para: 'M30,15 L95,15 L70,85 L5,85 Z'
  };
  function figSym(f) {
    return svgWrap(100, 100,
      '<path d="' + SYM_SHAPES[f.shape] + '" fill="#FFC857" stroke="#E0A93A" stroke-width="3" stroke-linejoin="round"/>' +
      '<line x1="50" y1="0" x2="50" y2="100" stroke="#48463D" stroke-width="2" stroke-dasharray="5 4"/>');
  }
  function figMirror(f) {
    var cw = 52, W = f.cols * cw + 8, s = '', i;
    for (i = 0; i < f.cols; i++) {
      s += '<rect x="' + (4 + i * cw) + '" y="6" width="' + cw + '" height="' + cw + '" fill="#fff" stroke="#E0C98B" stroke-width="2"/>';
      s += '<text x="' + (4 + i * cw + cw / 2) + '" y="' + (6 + cw + 26) + '" text-anchor="middle" font-size="20" font-weight="800" fill="#48463D">' + (i + 1) + '</text>';
    }
    s += '<circle cx="' + (4 + (f.at - 1) * cw + cw / 2) + '" cy="' + (6 + cw / 2) + '" r="14" fill="#F28B82"/>';
    s += '<line x1="' + (4 + f.cols / 2 * cw) + '" y1="0" x2="' + (4 + f.cols / 2 * cw) + '" y2="' + (cw + 12) + '" stroke="#48463D" stroke-width="3" stroke-dasharray="6 4"/>';
    return svgWrap(W, cw + 40, s);
  }
  /* 倍的认识互动图：圈一圈（点物品按每组 per 个圈起来） */
  function figBeiCircle(f) {
    var s = '<div class="bei-circle" data-per="' + f.per + '">', i;
    for (i = 0; i < f.total; i++) {
      s += '<button type="button" class="bei-it" data-i="' + i + '">' + f.emoji + '</button>';
    }
    s += '<div class="bei-count">已圈 <b>0</b> 圈</div></div>';
    return s;
  }
  /* 倍的认识互动图：线段拼（点“加一段”拼到和大线段一样长） */
  function figBeiSeg(f) {
    var unit = Math.max(34, Math.min(60, Math.floor(300 / f.n)));
    var s = '<div class="bei-seg" data-n="' + f.n + '" data-unit="' + unit + '">';
    s += '<div class="bei-lab">大线段</div>';
    s += '<div class="bei-big" style="width:' + (unit * f.n) + 'px"></div>';
    s += '<div class="bei-lab">我拼的（一段 = 1 份）</div>';
    s += '<div class="bei-build"></div>';
    s += '<div class="bei-btns"><button type="button" class="bei-add">＋ 加一段</button>' +
         '<button type="button" class="bei-del">－ 减一段</button></div>';
    s += '<div class="bei-count">已拼 <b>0</b> 段</div></div>';
    return s;
  }
  /* 倍的认识展示图：n 组、每组 per 个（求几倍是多少时先看图摆份） */
  function figBeiGroups(f) {
    var s = '<div class="bei-groups">', i, j;
    for (i = 0; i < f.groups; i++) {
      s += '<span class="bei-grp">';
      for (j = 0; j < f.per; j++) { s += f.emoji; }
      s += '</span>';
    }
    s += '</div>';
    return s;
  }
  /* 互动图接线：showQuestion 渲染后调用 */
  function wireBeiFig(f) {
    var root = window.App.el;
    if (f.t === 'bei_circle') {
      var box = root.querySelector('.bei-circle');
      if (!box) { return; }
      var per = parseInt(box.getAttribute('data-per'), 10);
      var items = box.querySelectorAll('.bei-it');
      var cnt = box.querySelector('.bei-count b');
      var gseq = 0;
      function recount() {
        var groups = {};
        for (var i = 0; i < items.length; i++) {
          var g = items[i].getAttribute('data-g');
          if (g) { groups[g] = 1; }
        }
        cnt.textContent = Object.keys(groups).length;
      }
      box.addEventListener('click', function (e) {
        var it = e.target.closest ? e.target.closest('.bei-it') : null;
        if (!it) { return; }
        var g = it.getAttribute('data-g');
        var i, el;
        if (g) { /* 点已圈的：整圈取消 */
          for (i = 0; i < items.length; i++) {
            if (items[i].getAttribute('data-g') === g) {
              items[i].removeAttribute('data-g');
              items[i].classList.remove('circled');
            }
          }
        } else { /* 点没圈的：把它和后面凑满 per 个没圈的圈成一圈 */
          gseq++;
          var need = per;
          for (i = 0; i < items.length && need > 0; i++) {
            el = items[i];
            if (!el.getAttribute('data-g')) {
              el.setAttribute('data-g', 'g' + gseq);
              el.classList.add('circled');
              need--;
            }
          }
        }
        recount();
      });
    } else if (f.t === 'bei_seg') {
      var seg = root.querySelector('.bei-seg');
      if (!seg) { return; }
      var n = parseInt(seg.getAttribute('data-n'), 10);
      var unit = parseInt(seg.getAttribute('data-unit'), 10);
      var build = seg.querySelector('.bei-build');
      var cnt2 = seg.querySelector('.bei-count');
      var count = 0;
      function refresh() {
        build.innerHTML = '';
        for (var i = 0; i < count; i++) {
          var d = document.createElement('div');
          d.className = 'bei-piece';
          d.style.width = unit + 'px';
          build.appendChild(d);
        }
        if (count === n) {
          build.classList.add('match');
          cnt2.innerHTML = '已拼 <b>' + count + '</b> 段，一样长啦！🎉';
        } else {
          build.classList.remove('match');
          cnt2.innerHTML = '已拼 <b>' + count + '</b> 段';
        }
      }
      seg.querySelector('.bei-add').addEventListener('click', function () {
        if (count < n + 2) { count++; refresh(); }
      });
      seg.querySelector('.bei-del').addEventListener('click', function () {
        if (count > 0) { count--; refresh(); }
      });
      refresh();
    }
  }
  function figHtml(f) {
    try {
      if (f.t === 'vert') { return figVert(f); }
      if (f.t === 'dots') { return figDots(f); }
      if (f.t === 'ruler') { return figRuler(f); }
      if (f.t === 'seg') { return figSeg(f); }
      if (f.t === 'shift') { return figShift(f); }
      if (f.t === 'sym') { return figSym(f); }
      if (f.t === 'mirror') { return figMirror(f); }
      if (f.t === 'bei_circle') { return figBeiCircle(f); }
      if (f.t === 'bei_seg') { return figBeiSeg(f); }
      if (f.t === 'bei_groups') { return figBeiGroups(f); }
    } catch (e) {}
    return '';
  }

  /* ================= 英语音频：manifest 优先，speechSynthesis 兜底 =================
   * manifest fetch 加 800ms 超时：超时不等了，直接按空表继续，保证点读 1 秒内出声。
   * 迟到的真数据仍会写入缓存，下次点读生效。 */
  var manifest = null, manifestWaiters = null;
  function loadManifest(cb) {
    if (manifest) { cb(manifest); return; }
    if (manifestWaiters) { manifestWaiters.push(cb); return; }
    manifestWaiters = [cb];
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) { return; }
      settled = true;
      manifest = {}; /* 占位：避免重复 fetch；迟到真数据仍会替换 */
      flush();
    }, 800);
    fetch('audio/manifest.json').then(function (r) {
      return r.ok ? r.json() : {};
    }).then(function (m) {
      if (m && typeof m === 'object' && Object.keys(m).length > 0) { manifest = m; }
      else if (manifest === null) { manifest = {}; }
      if (settled) { return; }
      settled = true; clearTimeout(timer); flush();
    }, function () {
      if (manifest === null) { manifest = {}; }
      if (settled) { return; }
      settled = true; clearTimeout(timer); flush();
    });
    function flush() {
      var w = manifestWaiters; manifestWaiters = null;
      for (var i = 0; i < w.length; i++) { w[i](manifest); }
    }
  }
  /* 播一个音频 URL：播不出来（报错/1.5s 还没开始）就快速降级到 fallback */
  function playUrlAudio(url, fallback, onend) {
    try {
      var a = new Audio(url);
      _curAudio = a;
      var done = false;
      function fin() { if (!done) { done = true; if (_curAudio === a) { _curAudio = null; } if (onend) { onend(); } } }
      function fail() { if (!done) { done = true; if (_curAudio === a) { _curAudio = null; } fallback(); } }
      a.onended = fin;
      a.onerror = fail;
      var t = setTimeout(function () { if (!done && a.paused) { fail(); } }, 1500);
      a.onplaying = function () { clearTimeout(t); };
      var p = a.play();
      if (p && p.catch) { p.catch(fail); }
      else if (p === undefined) { setTimeout(fin, 3000); /* 老浏览器无 promise，兜底 */ }
      return;
    } catch (e) { fallback(); }
  }
  /* 播一段英文：manifest 已就绪且有文件 → Audio；否则不等 fetch，直接 TTS。
   * 点"点读"后 1 秒内必须出声。 */
  function playEnglish(text, onend) {
    function viaTts() { speak(text, 'en-US', onend); }
    if (manifest) {
      var url = manifest[text];
      if (!url) { viaTts(); return; }
      playUrlAudio(url, viaTts, onend);
      return;
    }
    loadManifest(function () {}); /* 后台预热 manifest，下次点读就能用 Audio */
    viaTts();
  }
  /* 点读整题：q.audio 存在时尝试 Audio（1.5s 播不出就降级），否则走 TTS */
  /* 页面令牌：每次 showQuestion 递增，过期 setTimeout 不播，防止跳转后还在播 */
  var _pageToken = 0;
  function speakQuestion(q) {
    var tk = _pageToken;
    function guarded(fn) {
      return function () { if (tk === _pageToken) { fn(); } };
    }
    /* 句子音频（s_*.mp3）manifest 全错位，不可信，只用单词音频（w_*.mp3） */
    var useAudio = q.audio && q.audio.indexOf('/w_') >= 0;
    if (useAudio) {
      playUrlAudio(q.audio, guarded(function () {
        if (q.subject === 'english') { playEnglishContent(q); }
        else { speak(q.speak, 'zh-CN'); }
      }), guarded(function () {}));
      return;
    }
    if (q.subject === 'english') { playEnglishContent(q); }
    else { speak(q.speak, 'zh-CN'); }
  }
  /* 英语自动播：播英文内容（单词/句子），不播中文指令 */
  function playEnglishContent(q) {
    /* 从 values 里取英文（最准），取不到再从 answer 里取英文 */
    var enText = '';
    if (q.values) { enText = q.values.sentence || q.values.word || ''; }
    if (!enText && q.answer && !isCJK(q.answer)) { enText = q.answer; }
    if (enText) {
      speak(enText, 'en-US');
    }
    /* 取不到英文就不播，不播中文指令（听力题播中文指令没用） */
  }

  /* ================= 会话状态 ================= */
  var S = null; /* {subject, groups[5][], g, list, p, answered, wrong[{kp_id,type,group}], retried[5], qStart, session_id} */

  function newSessionId() {
    return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  /* ================= 1. 首页 ================= */
  function showHome() {
    stopSpeak();
    var app = window.App.el;
    app.innerHTML =
      '<div class="ch-home">' +
        '<button class="ch-parent-link" id="parentLink">家长</button>' +
        '<div class="ch-hello" id="chHello">今天也来闯关啦！</div>' +
        '<img class="ch-fox" src="img/fox.png" alt="狐狸">' +
        '<div class="ch-ready">准备好了吗？<div class="ch-ready-sub">完成今天的学习任务，收集星星！</div></div>' +
        '<div class="ch-cards" id="homeCards"><div class="ch-subcard"><div class="t"><span class="name">…</span></div></div></div>' +
        '<button class="btn btn-main" id="startBtn">开始今天的任务</button>' +
      '</div>';

    $('parentLink').addEventListener('click', function () {
      if (window.Parent && window.Parent.render) { window.Parent.render(window.App.el, window.API); }
    });

    /* 首页问候语：异步读孩子名字，读到后更新（不阻塞首屏） */
    (function () {
      var helloEl = $('chHello');
      if (!helloEl) return;
      function applyName(n) {
        n = (n || '').trim();
        if (n && helloEl) helloEl.textContent = n + '，今天也来闯关啦！';
      }
      if (window._chChildName) { applyName(window._chChildName); return; }
      window.API.get('/api/me').then(function (me) {
        var n = me && me.name ? String(me.name).trim() : '';
        if (n) { window._chChildName = n; applyName(n); }
      }, function () { /* 离线则保持默认问候语 */ });
    })();

    window.API.get('/api/progress?date=' + window.API.today()).then(function (p) {
      var math = (p && p.math) || { done: 0, total: 50, groups_done: 0 };
      var en = (p && p.english) || { done: 0, total: 50, groups_done: 0 };
      var cards = $('homeCards');
      cards.innerHTML = subCard('数学', math, 'math') + subCard('英语', en, 'english');
      /* 卡片可点击：自由选科目（做完的也能点进去复习/验证） */
      var cardEls = cards.querySelectorAll('.ch-subcard');
      for (var i = 0; i < cardEls.length; i++) {
        (function (el) {
          el.addEventListener('click', function () {
            warmupAudio();
            startSubject(el.getAttribute('data-sub'));
          });
        })(cardEls[i]);
      }
      var btn = $('startBtn');
      if (math.done >= 50 && en.done >= 50) {
        btn.textContent = '看看今天的收获';
        btn.onclick = function () { warmupAudio(); showDone(true); };
      } else {
        btn.onclick = function () {
          warmupAudio();
          var sub = math.done < 50 ? 'math' : 'english';
          startSubject(sub);
        };
      }
    }, function () {
      var cards = $('homeCards');
      cards.innerHTML = subCard('数学', { done: 0, total: 50, groups_done: 0 }, 'math') +
        subCard('英语', { done: 0, total: 50, groups_done: 0 }, 'english');
      var cardEls = cards.querySelectorAll('.ch-subcard');
      for (var j = 0; j < cardEls.length; j++) {
        (function (el) {
          el.addEventListener('click', function () {
            warmupAudio();
            startSubject(el.getAttribute('data-sub'));
          });
        })(cardEls[j]);
      }
      $('startBtn').onclick = function () { warmupAudio(); startSubject('math'); };
    });

    function subCard(name, d, sub) {
      var doneN = d.done || 0;
      var finished = doneN >= 50;
      var pct = Math.min(100, Math.round(doneN / 50 * 100));
      var groups = Math.min(5, d.groups_done || Math.floor(doneN / 10));
      var status = finished ? '已完成 ✅，点我再练一轮' : '已经完成 ' + groups + ' 组，继续加油！';
      return '<div class="ch-subcard" data-sub="' + sub + '" role="button" tabindex="0"><div class="t">' +
        '<span class="name">' + name + '</span>' +
        '<span class="num">' + doneN + '/50</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="grp">' + status + '</div></div>';
    }
  }

  /* ================= 做题流程 ================= */
  /* 英语新UI首页：课本轨道35题 + 追赶轨道15题 */
  function showEnHome() {
    stopSpeak();
    var app = window.App.el;
    window.API.get('/api/progress?date=' + window.API.today()).then(function (p) {
      var en = (p && p.english) || { done: 0 };
      renderEnHome(en.done || 0);
    }, function () { renderEnHome(0); });

    function renderEnHome(done) {
      var name = window._chChildName || '';
      if (!name) {
        window.API.get('/api/me').then(function (me) {
          name = (me && me.name) ? String(me.name).trim() : '';
          if (name) { window._chChildName = name; }
          paint();
        }, paint);
      } else { paint(); }
      function paint() {
        window.EnUI.home(app, {
          name: name, done: done, stars: 0,
          onTrack: function () {
            warmupAudio();
            startEnSession();
          },
          onBack: showHome
        });
      }
    }
  }
  /* 英语走新UI首页点轨道后，沿用原有出题流程 */
  function startEnSession() {
    loadManifest(function () {});
    var planP = window.API.get('/api/plan?subject=english&date=' + window.API.today());
    var pagesP = window.API.get('/api/pages');
    Promise.all([
      planP.then(function (plan) { return (plan && plan.slots) || []; }, function () { return []; }),
      pagesP.then(function (p) { return p || {}; }, function () { return {}; })
    ]).then(function (results) {
      beginSession('english', results[0], results[1]);
    });
  }

  function startSubject(subject) {
    stopSpeak();
    if (!window.ENGINE || !window.ENGINE.generate) {
      window.App.el.innerHTML = '<div class="ch-rest"><div class="sub">题目还在准备中，稍后再来</div>' +
        '<button class="btn btn-ghost" id="bk">返回首页</button></div>';
      $('bk').addEventListener('click', showHome);
      return;
    }
    /* 英语走新UI：先到铭希英语首页选轨道 */
    if (subject === 'english' && window.EnUI) {
      showEnHome();
      return;
    }
    loadManifest(function () {}); /* 预热音频清单 */
    /* 并行拉取 plan 和 pages（页码用于出题过滤）；任一失败用默认值兜底 */
    var planP = window.API.get('/api/plan?subject=' + subject + '&date=' + window.API.today());
    var pagesP = window.API.get('/api/pages');
    Promise.all([
      planP.then(function (plan) { return (plan && plan.slots) || []; }, function () { return []; }),
      pagesP.then(function (p) { return p || {}; }, function () { return {}; })
    ]).then(function (results) {
      beginSession(subject, results[0], results[1]);
    });
  }

  function beginSession(subject, slots, pages) {
    pages = pages || {};
    /* 范围未设置（全 0 或缺失）时视为全册 */
    function rng(v) { v = +v || 0; return v > 0 ? v : 0; }
    var math_from = rng(pages.math_from), math_to = rng(pages.math_to);
    var en_from = rng(pages.en_from), en_to = rng(pages.en_to);
    /* 向后兼容老单页字段 */
    if (!math_from && !math_to && (+pages.math_page > 0)) { math_from = 1; math_to = +pages.math_page; }
    if (!en_from && !en_to && (+pages.en_page > 0)) { en_from = 1; en_to = +pages.en_page; }
    var qs;
    try { qs = window.ENGINE.generate(subject, slots, { math_from: math_from, math_to: math_to, en_from: en_from, en_to: en_to }) || []; }
    catch (e) { qs = []; }
    if (!qs.length) {
      window.App.el.innerHTML = '<div class="ch-rest"><div class="sub">题目还在准备中，稍后再来</div>' +
        '<button class="btn btn-ghost" id="bk">返回首页</button></div>';
      $('bk').addEventListener('click', showHome);
      return;
    }
    var groups = [];
    for (var g = 0; g < GROUP_COUNT; g++) {
      groups.push(qs.slice(g * GROUP_SIZE, g * GROUP_SIZE + GROUP_SIZE));
    }
    S = {
      subject: subject, groups: groups, g: 0,
      list: groups[0], p: 0, answered: 0,
      wrong: [], retried: [false, false, false, false, false],
      qStart: 0, session_id: newSessionId(), starCount: 0,
      slots: slots, pages: { math_from: math_from, math_to: math_to, en_from: en_from, en_to: en_to }
    };
    showQuestion();
  }

  /* 每组开始前检查页码范围：变了就用新范围重出后面几组的题 */
  function checkPagesAndProceed(next) {
    window.API.get('/api/pages').then(function (p) {
      p = p || {};
      function rng(v) { v = +v || 0; return v > 0 ? v : 0; }
      var nmf = rng(p.math_from), nmt = rng(p.math_to);
      var nef = rng(p.en_from), net = rng(p.en_to);
      if (!nmf && !nmt && (+p.math_page > 0)) { nmf = 1; nmt = +p.math_page; }
      if (!nef && !net && (+p.en_page > 0)) { nef = 1; net = +p.en_page; }
      var sp = S.pages || {};
      var changed = (nmf !== (sp.math_from | 0)) || (nmt !== (sp.math_to | 0)) ||
                    (nef !== (sp.en_from | 0)) || (net !== (sp.en_to | 0));
      if (changed && window.ENGINE && window.ENGINE.generate && S.slots) {
        try {
          var remainingGroups = GROUP_COUNT - S.g - 1; /* S.g 还没+1，剩下没做的组数 */
          if (remainingGroups > 0) {
            var newQs = window.ENGINE.generate(S.subject, S.slots, {
              math_from: nmf, math_to: nmt, en_from: nef, en_to: net,
              total: remainingGroups * GROUP_SIZE
            }) || [];
            for (var i = 0; i < remainingGroups; i++) {
              S.groups[S.g + 1 + i] = newQs.slice(i * GROUP_SIZE, i * GROUP_SIZE + GROUP_SIZE);
            }
            S.pages = { math_from: nmf, math_to: nmt, en_from: nef, en_to: net };
          }
        } catch (e) { /* 重出失败就继续用旧题，不阻塞 */ }
      }
      next();
    }, function () { next(); }); /* 读失败就继续，不阻塞 */
  }

  /* ================= 2. 答题页 ================= */
  function showQuestion() {
    stopSpeak();
    _pageToken++; /* 新页面，旧语音全部作废 */
    var q = S.list[S.p];
    var app = window.App.el;
    S.qStart = Date.now();

    var groupLabel = S.p < GROUP_SIZE
      ? '本组 ' + (S.p + 1) + '/' + GROUP_SIZE
      : '加固练习';

    /* 英语走新UI外壳（暖黄主题/狐狸/背景/第N页/进度点），题目渲染函数复用 */
    if (S.subject === 'english' && window.EnUI) {
      app.innerHTML = window.EnUI.shell(q, {
        qno: S.answered + 1,
        groupLabel: groupLabel,
        starCount: S.starCount,
        dotsTotal: GROUP_SIZE,
        dotsDone: S.p
      });
      wireEnQuestion(q);
      return;
    }

    var figSvg = q.fig ? figHtml(q.fig) : '';
    var stemTxt = (q.fig && q.fig.title) ? q.fig.title : q.stem;
    var stemCls = 'ch-stem' + (figSvg ? ' has-fig' : '') + ((String(stemTxt).length > 12 || figSvg) ? ' small' : '');

    app.innerHTML =
      '<div class="ch-quiz">' +
        '<div class="ch-topbar">' +
          '<span class="qno">' + SUBJECT_NAME[S.subject] + '·第' + (S.answered + 1) + '题</span>' +
          '<span class="ch-grouptag">' + groupLabel + '</span>' +
          '<span class="sp"></span>' +
          '<span class="ch-star-counter" id="starCounter">⭐×<b>' + S.starCount + '</b></span>' +
          '<button class="ch-speak" id="speakBtn">🔊 点读</button>' +
          '<button class="ch-exit" id="exitBtn">✕</button>' +
        '</div>' +
        '<div class="' + stemCls + '" id="stem">' + esc(stemTxt) + '</div>' +
        (figSvg ? '<div class="ch-fig">' + figSvg + '</div>' : '') +
        '<div class="ch-body" id="qbody"></div>' +
        '<div class="ch-feedback" id="feedback"></div>' +
      '</div>';

    $('speakBtn').addEventListener('click', function () { speakQuestion(q); });
    $('exitBtn').addEventListener('click', function () { showHome(); }); /* 进度已实时上报，可续做 */

    if (q.type === 'recite') { renderRecite(q); }
    else if (q.type === 'spell') { renderSpell(q); }
    else if (q.type === 'order') { renderOrder(q); }
    else if (q.type === 'read_aloud') { renderReadAloud(q); }
    else if (q.options && q.options.length) { renderChoice(q); }
    else { renderInput(q); }

    /* 倍的认识互动图接线（圈一圈/线段拼） */
    if (q.fig && (q.fig.t === 'bei_circle' || q.fig.t === 'bei_seg')) { wireBeiFig(q.fig); }

    /* 自动朗读题干（iOS 需之前点"开始"时已预热，否则会被静默拦截） */
    (function (tk, qq) {
      setTimeout(function () { if (tk === _pageToken) { speakQuestion(qq); } }, 350);
    })(_pageToken, q);
  }

  /* 英语新UI：接线（点读/退出/大喇叭）+ 复用原有渲染函数 */
  function wireEnQuestion(q) {
    $('speakBtn').addEventListener('click', function () { speakQuestion(q); });
    $('exitBtn').addEventListener('click', function () { showHome(); });
    var ab = $('enAudioBtn');
    if (ab) { ab.addEventListener('click', function () { speakQuestion(q); }); }

    if (q.type === 'recite') { renderRecite(q); }
    else if (q.type === 'spell') { renderSpell(q); }
    else if (q.type === 'order') { renderOrder(q); }
    else if (q.type === 'read_aloud') { renderReadAloud(q); }
    else if (q.options && q.options.length) { renderChoice(q); }
    else { renderInput(q); }

    /* 自动朗读题干 */
    (function (tk, qq) {
      setTimeout(function () { if (tk === _pageToken) { speakQuestion(qq); } }, 350);
    })(_pageToken, q);
  }

  /* 选择题：点后先朗读该选项，读完再判分。
   * 英语新UI下用 enui- 样式类，否则用 ch- 样式类。 */
  function renderChoice(q) {
    var enNew = (S.subject === 'english' && window.EnUI);
    var optCls = enNew ? 'enui-opt' : 'ch-opt';
    var boxCls = enNew ? 'enui-options' : 'ch-options';
    var hintCls = enNew ? 'enui-hint' : 'ch-hint';
    var foxImg = enNew ? 'en/assets/fox/43.svg' : 'img/fox-think.svg';
    var body = $('qbody');
    /* 选项带 emoji 图时放大显示 */
    function optInner(t) {
      t = String(t);
      /* emoji 开头：把 emoji 包起来放大 */
      var m = t.match(/^(\uD83C[\uD800-\uDFFF]|\uD83D[\uD800-\uDFFF]|[\u2600-\u27BF\u2B00-\u2BFF\uFE0F]+)\s*(.*)$/);
      if (m && enNew) {
        return '<span class="em">' + esc(m[1]) + '</span><span>' + esc(m[2] || t) + '</span><span class="ck">✓</span>';
      }
      return esc(t) + (enNew ? '<span class="ck">✓</span>' : '');
    }
    var hint = '<div class="' + hintCls + '"><img src="' + foxImg + '" alt="">认真想一想，选出答案吧！</div>';
    var html = hint + '<div class="' + boxCls + '" id="opts">';
    for (var i = 0; i < q.options.length; i++) {
      html += '<button class="' + optCls + '" data-v="' + esc(q.options[i]) + '">' + optInner(q.options[i]) + '</button>';
    }
    body.innerHTML = html + '</div>';

    var btns = body.querySelectorAll('.' + optCls);
    function onPick(e) {
      var btn = e.target.closest ? e.target.closest('.' + optCls) : null;
      if (!btn || btn.disabled) { return; }
      for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; }
      var v = btn.getAttribute('data-v');
      speak(v, speakLang(v, q.subject), function () {
        judge(q, v, btn);
      });
    }
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', onPick);
    }
  }

  /* 计算/填空：底部数字键盘，高度锁死 220px，光标从右框起 */
  function renderInput(q) {
    var body = $('qbody');
    body.innerHTML =
      '<div class="ch-answerbox"><div class="ch-ansdisplay" id="ansDisplay"></div></div>' +
      '<div class="ch-hint"><img src="img/fox.png" alt="">算一算，点数字作答吧！</div>';
    var app = window.App.el;
    var kp = document.createElement('div');
    kp.className = 'ch-keypad';
    kp.id = 'keypad';
    kp.innerHTML =
      '<button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button data-k="back" class="k-fn">⌫</button>' +
      '<button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button data-k="0">0</button>' +
      '<button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button data-k="ok" class="k-ok">✓</button>';
    /* 键盘插在 feedback 之前，保证贴底 */
    var quiz = app.querySelector('.ch-quiz');
    quiz.insertBefore(kp, $('feedback'));

    var val = '';
    var disp = $('ansDisplay');
    kp.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || b.disabled) { return; }
      var k = b.getAttribute('data-k');
      if (k === 'back') { val = val.slice(0, -1); }
      else if (k === 'ok') {
        if (!val) { disp.classList.remove('shake'); void disp.offsetWidth; disp.classList.add('shake'); return; }
        var btns = kp.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; }
        judge(q, val, null);
        return;
      }
      else { if (val.length < 8) { val += k; } }
      disp.textContent = val; /* 右对齐＝光标从右框起 */
    });
  }

  /* 跟读：不判分，孩子自评"读了" */
  function renderRecite(q) {
    var enNew = (S.subject === 'english' && window.EnUI);
    var P = enNew ? 'enui-' : 'ch-';
    var foxImg = enNew ? 'en/assets/fox/30.svg' : 'img/fox.png';
    var body = $('qbody');
    body.innerHTML =
      '<div class="' + P + 'recite">' +
        '<button class="' + P + 'playbtn" id="playBtn">▶</button>' +
        '<div class="' + P + 'hint"><img src="' + foxImg + '" alt="">先听一遍，再大声跟读！</div>' +
        '<button class="btn btn-main" id="reciteDone" style="max-width:280px">我读好了</button>' +
      '</div>';
    function play() {
      /* 句子音频不可信，直接 TTS */
      playEnglish(q.speak);
    }
    $('playBtn').addEventListener('click', play);
    /* 自动播由 showQuestion 统一负责，这里不再立即播，避免重复 */
    $('reciteDone').addEventListener('click', function () {
      this.disabled = true;
      postAttempt(q, '读了', null);
      S.answered++;
      setTimeout(advance, 600);
    });
  }

  /* 拼块通用：spell（字母）/ order（词块）。点块拼出答案，点已选可撤销，拼满自动判分 */
  function renderBlocks(q, joiner, autoSpeakWord) {
    var enNew = (S.subject === 'english' && window.EnUI);
    var P = enNew ? 'enui-' : 'ch-'; /* 样式前缀 */
    var body = $('qbody');
    var blocks = q.blocks || [];
    body.innerHTML =
      '<div class="' + P + 'spellans" id="spellAns"></div>' +
      '<div class="' + P + 'hint"><img src="' + (enNew ? 'en/assets/fox/45.svg' : 'img/fox.png') + '" alt="">点一点，拼出来吧！</div>' +
      '<div class="' + P + 'blocks" id="spellBlocks"></div>';
    var ansEl = $('spellAns');
    var blkEl = $('spellBlocks');
    var picked = []; /* 存 blocks 下标，处理重复字母/单词 */
    var locked = false;

    for (var i = 0; i < blocks.length; i++) {
      var b = document.createElement('button');
      b.className = P + 'block';
      b.textContent = blocks[i];
      b.setAttribute('data-i', i);
      blkEl.appendChild(b);
    }

    function lockAll() {
      locked = true;
      var btns = blkEl.querySelectorAll('.' + P + 'block');
      for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; }
      var ans = ansEl.querySelectorAll('.' + P + 'block');
      for (var j = 0; j < ans.length; j++) { ans[j].disabled = true; }
    }

    function refresh() {
      ansEl.innerHTML = '';
      for (var k = 0; k < picked.length; k++) {
        var s = document.createElement('button');
        s.className = P + 'block picked';
        /* 答题槽用 slot 样式（英语新UI） */
        if (enNew) { s.className = 'enui-slot filled'; }
        s.textContent = blocks[picked[k]];
        s.setAttribute('data-k', k);
        ansEl.appendChild(s);
      }
      var btns = blkEl.querySelectorAll('.' + P + 'block');
      for (var j = 0; j < btns.length; j++) {
        btns[j].classList.toggle('used', picked.indexOf(j) >= 0);
      }
      if (picked.length === blocks.length && !locked) {
        lockAll();
        var given = picked.map(function (idx) { return blocks[idx]; }).join(joiner);
        setTimeout(function () { judge(q, given, null); }, 350);
      }
    }

    blkEl.addEventListener('click', function (e) {
      if (locked) { return; }
      var b = e.target.closest ? e.target.closest('.' + P + 'block') : null;
      if (!b || b.disabled) { return; }
      var i = parseInt(b.getAttribute('data-i'), 10);
      if (picked.indexOf(i) >= 0) { return; }
      picked.push(i);
      speak(blocks[i], 'en-US'); /* 点块读出字母/单词音 */
      refresh();
    });
    ansEl.addEventListener('click', function (e) {
      if (locked) { return; }
      var s = e.target.closest ? e.target.closest(enNew ? '.enui-slot' : '.' + P + 'block') : null;
      if (!s || s.disabled) { return; }
      var k = parseInt(s.getAttribute('data-k'), 10);
      picked.splice(k, 1); /* 点已选撤销 */
      refresh();
    });

    refresh();
    /* spell 的"听一听"由 showQuestion 的统一自动播负责，这里不再重复播 */
  }

  /* 拼单词：按顺序点字母 */
  function renderSpell(q) { renderBlocks(q, '', true); }

  /* 句子排序：按顺序点词块 */
  function renderOrder(q) { renderBlocks(q, ' ', false); }

  /* 英语跟读：播放句子＋"我读完了"，不判分 */
  function renderReadAloud(q) {
    var body = $('qbody');
    var canRecord = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var enNew = (S.subject === 'english' && window.EnUI);
    var P = enNew ? 'enui-' : 'ch-';
    var foxImg2 = enNew ? 'en/assets/fox/30.svg' : 'img/fox.png';
    body.innerHTML =
      '<div class="' + P + 'recite">' +
        '<button class="' + P + 'playbtn" id="playBtn">🔊</button>' +
        '<div class="' + P + 'hint"><img src="' + foxImg2 + '" alt="">听一听，跟着读一读吧！</div>' +
        '<button class="btn btn-ghost" id="recBtn" style="max-width:280px">🎤 录下我的朗读</button>' +
        '<div id="recPlay" style="display:none;margin-top:8px">' +
          '<button class="btn btn-ghost" id="playRecBtn" style="max-width:280px">▶ 回放我的录音</button>' +
        '</div>' +
        '<div class="ch-rec-result" id="recResult" style="min-height:24px;font-size:14px;color:var(--sub)"></div>' +
        '<button class="btn btn-main" id="raDone" style="max-width:280px">我读完了</button>' +
      '</div>';
    /* 包0：录音按钮始终显示。无 mediaDevices（HTTP 下的 iPhone Safari）时点按给说明，不再隐藏 */
    if (!canRecord) {
      $('recBtn').addEventListener('click', function () {
        $('recResult').textContent = '录音需要安全连接：请先按说明在 iPhone 上安装证书，再用 https:// 开头的地址打开。';
      });
    }
    function play() {
      /* 句子音频不可信，直接 TTS 英文句子 */
      var enText = (q.values && (q.values.sentence || q.values.word)) || q.answer || '';
      if (enText) { speak(enText, 'en-US'); }
    }
    $('playBtn').addEventListener('click', play);
    /* 自动播由 showQuestion 统一负责，这里不再立即播，避免重复 */

    /* 录音回放：MediaRecorder（iOS 可用），无语音转文字 */
    if (canRecord) {
      var recBtn = $('recBtn'), recResult = $('recResult'), recPlay = $('recPlay');
      var playRecBtn = $('playRecBtn');
      var mr = null, chunks = [], recing = false, audioUrl = null, stream = null;

      function cleanupStream() {
        try { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); } } catch (e) {}
        stream = null;
      }

      recBtn.addEventListener('click', function () {
        if (recing) {
          /* 停止录音 */
          try { mr.stop(); } catch (e) {}
          return;
        }
        /* 开始录音 */
        recResult.textContent = '正在请求麦克风…';
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
          stream = st;
          chunks = [];
          try {
            mr = new MediaRecorder(st);
          } catch (e) {
            recResult.textContent = '录音不可用';
            cleanupStream();
            return;
          }
          mr.ondataavailable = function (e) { if (e.data && e.data.size) { chunks.push(e.data); } };
          mr.onstop = function () {
            recing = false;
            cleanupStream();
            recBtn.textContent = '🎤 重新录';
            if (chunks.length) {
              try {
                if (audioUrl) { URL.revokeObjectURL(audioUrl); }
                var blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
                audioUrl = URL.createObjectURL(blob);
                recPlay.style.display = 'block';
                recResult.textContent = '录好了，点回放听听自己读得怎么样';
              } catch (e) {
                recResult.textContent = '录音保存失败';
              }
            } else {
              recResult.textContent = '没录到声音，再试一次';
            }
          };
          mr.onerror = function () {
            recing = false;
            cleanupStream();
            recBtn.textContent = '🎤 录下我的朗读';
            recResult.textContent = '录音出错了，再试一次';
          };
          try {
            mr.start();
            recing = true;
            recBtn.textContent = '⏹ 停止录音';
            recResult.textContent = '正在录音…大声读出来吧！';
            recPlay.style.display = 'none';
          } catch (e) {
            recResult.textContent = '录音启动失败';
            cleanupStream();
          }
        }, function () {
          recResult.textContent = '需要允许使用麦克风才能录音';
        });
      });

      playRecBtn.addEventListener('click', function () {
        if (audioUrl) {
          stopSpeak();
          playUrlAudio(audioUrl, function () {}, function () {});
        }
      });
    }

    $('raDone').addEventListener('click', function () {
      this.disabled = true;
      try { if (audioUrl) { URL.revokeObjectURL(audioUrl); } } catch (e) {}
      postAttempt(q, '读了', null);
      S.answered++;
      flyStar(); /* 每做完一道题＋1 星 */
      setTimeout(advance, 600);
    });
  }

  /* ================= 判分 ================= */
  function isCorrect(q, given) {
    if (given === q.answer) { return true; }
    if (q.accept && q.accept.indexOf(given) >= 0) { return true; }
    return false;
  }

  function postAttempt(q, given, correct) {
    var body = {
      instance_id: q.instance_id, template_id: q.template_id, template_version: q.template_version,
      kp_id: q.kp_id, subject: q.subject, type: q.type, difficulty: q.difficulty, kind: q.kind,
      stem: q.stem, answer: q.answer, given_answer: given, correct: correct,
      options: q.options || null, misconceptions: q.misconceptions || null,
      chosen_misconception: (q.misconceptions && q.misconceptions[given]) || null,
      solution: q.solution || null, values: q.values || null,
      time_ms: Date.now() - S.qStart, is_retry: !!q.is_retry, step: q.step || null,
      group_id: q.group_id, date: window.API.today(), session_id: S.session_id
    };
    window.API.post('/api/attempt', body).then(null, function () {});
  }

  function judge(q, given, btnEl) {
    var correct = isCorrect(q, given);
    postAttempt(q, given, correct);
    S.answered++;
    flyStar(); /* 每做完一道题：飞星到右上角计数器 +1（对错都加） */
    if (!correct && !q.is_retry) {
      S.wrong.push({ kp_id: q.kp_id, type: q.type, group: S.g });
    }

    var fb = $('feedback');
    var quiz = window.App.el.querySelector('.ch-quiz');
    if (correct) {
      if (btnEl) { btnEl.classList.add('right'); }
      sfx('ok');
      starBurst(quiz);
      setTimeout(advance, CORRECT_MS);
    } else {
      if (btnEl) { btnEl.classList.add('picked'); }
      sfx('no');
      var ansText = q.answer;
      fb.innerHTML =
        '<div class="ch-rightcard"><div class="lbl">正确答案是</div>' +
        '<div class="ans">' + esc(ansText) + '</div></div>';
      /* 温和朗读正确答案，不用红色；延后 420ms，先让音效播完 */
      setTimeout(function () {
        if (q.subject === 'english' && !isCJK(ansText)) {
          speak('正确答案是', 'zh-CN', function () { playEnglish(ansText); });
        } else {
          speak('正确答案是' + ansText, 'zh-CN');
        }
      }, 420);
      setTimeout(advance, WRONG_MS);
    }
  }

  function advance() {
    S.p++;
    if (S.p >= S.list.length) { finishGroupQuestions(); return; }
    showQuestion();
  }

  /* 组末：本组错题的 kp → generateRetry 同类新题（is_retry=true）插到组末重做 */
  function finishGroupQuestions() {
    var g = S.g;
    if (!S.retried[g] && window.ENGINE.generateRetry) {
      S.retried[g] = true;
      var seen = {}, retries = [];
      for (var i = 0; i < S.wrong.length; i++) {
        var w = S.wrong[i];
        if (w.group === g && !seen[w.kp_id]) {
          seen[w.kp_id] = true;
          try {
            var rq = window.ENGINE.generateRetry(w.kp_id, w.type);
            /* engine 返回数组（word2 返回 2 道），逐个标记 is_retry */
            var arr = Object.prototype.toString.call(rq) === '[object Array]' ? rq : (rq ? [rq] : []);
            for (var j = 0; j < arr.length; j++) { arr[j].is_retry = true; retries.push(arr[j]); }
          } catch (e) {}
        }
      }
      if (retries.length) {
        S.list = S.list.concat(retries);
        showQuestion();
        return;
      }
    }
    if (g >= GROUP_COUNT - 1) { showDone(false); }
    else { showRest(); }
  }

  /* ================= 3. 组间休息页 ================= */
  function showRest() {
    stopSpeak();
    var app = window.App.el;
    app.innerHTML =
      '<div class="ch-rest">' +
        '<img src="img/fox-cheer.svg" alt="狐狸">' +
        '<h1>这一关完成啦！</h1>' +
        '<div class="sub">你已经坚持完成了 10 道题</div>' +
        '<div class="ch-stars">⭐⭐⭐</div>' +
        '<button class="btn btn-main" id="nextGroup">继续下一组</button>' +
        '<button class="quit" id="quitBtn">退出，稍后再来</button>' +
      '</div>';
    speak('这一关完成啦！休息一下吧', 'zh-CN');
    $('nextGroup').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = '准备中…';
      checkPagesAndProceed(function () {
        S.g++;
        S.p = 0;
        S.starCount = 0; /* 新一组，星星计数器清零 */
        S.list = S.groups[S.g];
        showQuestion();
      });
    });
    $('quitBtn').addEventListener('click', showHome); /* 进度已实时上报，可续做 */
  }

  /* ================= 4. 完成页 ================= */
  function showDone(allDone) {
    stopSpeak();
    var app = window.App.el;
    app.innerHTML =
      '<div class="ch-done">' +
        '<img src="img/fox-cheer.svg" alt="狐狸">' +
        '<h1>今天的任务完成！</h1>' +
        '<div class="big">50 / 50</div>' +
        '<div class="row"><span>完成组数 <b>5 / 5 组</b></span></div>' +
        '<div class="ch-stars">⭐⭐⭐</div>' +
        '<div class="sub" id="doneExtra" style="font-size:16px;color:var(--sub)"></div>' +
        '<div class="tomorrow">明天再来继续冒险吧！</div>' +
        '<button class="btn btn-main" id="doneHome">回到首页</button>' +
      '</div>';
    speak('今天的任务完成！你真棒', 'zh-CN');
    $('doneHome').addEventListener('click', showHome);

    /* 两科都完成 → 显示总完成 */
    window.API.get('/api/progress?date=' + window.API.today()).then(function (p) {
      var m = (p && p.math && p.math.done) || 0;
      var e = (p && p.english && p.english.done) || 0;
      if (m >= 50 && e >= 50) {
        var ex = $('doneExtra');
        if (ex) { ex.innerHTML = '数学和英语都完成了，<br>今天一共做了 100 道题！'; }
      }
    }, function () {});

    /* 彩蛋：3 天正确率 ≥80% 奖励积木人 */
    checkEasterEgg();
  }

  /* 3 天正确率彩蛋 */
  function checkEasterEgg() {
    try {
      var lastReward = localStorage.getItem('egg_reward_date');
      var today = window.API.today();
      if (lastReward === today) { return; } /* 今天已领过 */
    } catch (e) { return; }

    function dateStr(offset) {
      var d = new Date();
      d.setDate(d.getDate() + offset);
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    }

    var dates = [dateStr(0), dateStr(-1), dateStr(-2)];
    var promises = dates.map(function (dt) {
      return window.API.get('/api/stats/today?date=' + dt).then(function (s) { return s; }, function () { return null; });
    });

    Promise.all(promises).then(function (results) {
      var correct = 0, total = 0;
      results.forEach(function (s) {
        if (!s) { return; }
        ['math', 'english'].forEach(function (sub) {
          var st = s[sub];
          if (st) {
            correct += st.correct || 0;
            total += st.total || 0;
          }
        });
      });
      /* 至少做 30 道才统计，避免样本太小 */
      if (total >= 30 && correct / total >= 0.8) {
        try { localStorage.setItem('egg_reward_date', window.API.today()); } catch (e) {}
        showEasterEgg(Math.round(correct / total * 100));
      }
    });
  }

  /* 彩蛋弹窗：积木人 */
  function showEasterEgg(rate) {
    var app = window.App.el;
    var overlay = document.createElement('div');
    overlay.id = 'eggOverlay';
    overlay.innerHTML =
      '<div class="egg-box">' +
        '<div class="egg-title">🎉 彩蛋奖励！</div>' +
        '<div class="egg-lego">' + legoSvg() + '</div>' +
        '<div class="egg-text">最近 3 天正确率达到 <b>' + rate + '%</b>！<br>奖励一个积木人，继续加油！</div>' +
        '<button class="btn btn-main" id="eggClose">太棒了！</button>' +
      '</div>';
    app.appendChild(overlay);
    sfx('ok');
    setTimeout(function () { sfx('ok'); }, 300);
    speak('哇！你获得了积木人奖励，太厉害了！', 'zh-CN');
    $('eggClose').addEventListener('click', function () {
      stopSpeak();
      if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
    });
  }

  /* 乐高小人 SVG */
  function legoSvg() {
    return '<svg viewBox="0 0 120 160" width="120" height="160">' +
      /* 头 */
      '<rect x="40" y="10" width="40" height="36" rx="6" fill="#FFC857" stroke="#E0A93A" stroke-width="3"/>' +
      /* 头顶凸点 */
      '<rect x="52" y="2" width="16" height="10" rx="3" fill="#E0A93A"/>' +
      /* 眼睛 */
      '<circle cx="52" cy="26" r="4" fill="#48463D"/>' +
      '<circle cx="68" cy="26" r="4" fill="#48463D"/>' +
      /* 笑嘴 */
      '<path d="M50 34 Q60 42 70 34" stroke="#48463D" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      /* 身体 */
      '<rect x="35" y="48" width="50" height="52" rx="4" fill="#7FB3F5" stroke="#5A8FD4" stroke-width="3"/>' +
      /* 身体印花 */
      '<rect x="50" y="60" width="20" height="14" rx="2" fill="#fff" opacity="0.6"/>' +
      /* 手臂 */
      '<rect x="20" y="52" width="14" height="40" rx="7" fill="#FFC857" stroke="#E0A93A" stroke-width="3"/>' +
      '<rect x="86" y="52" width="14" height="40" rx="7" fill="#FFC857" stroke="#E0A93A" stroke-width="3"/>' +
      /* 手 */
      '<circle cx="27" cy="96" r="9" fill="#FFC857" stroke="#E0A93A" stroke-width="3"/>' +
      '<circle cx="93" cy="96" r="9" fill="#FFC857" stroke="#E0A93A" stroke-width="3"/>' +
      /* 腿 */
      '<rect x="40" y="100" width="18" height="44" rx="3" fill="#5A8FD4" stroke="#3A6FA4" stroke-width="3"/>' +
      '<rect x="62" y="100" width="18" height="44" rx="3" fill="#5A8FD4" stroke="#3A6FA4" stroke-width="3"/>' +
      /* 脚 */
      '<rect x="36" y="142" width="26" height="10" rx="3" fill="#3A6FA4"/>' +
      '<rect x="62" y="142" width="26" height="10" rx="3" fill="#3A6FA4"/>' +
      /* 星星装饰 */
      '<text x="100" y="30" font-size="20">⭐</text>' +
      '<text x="12" y="40" font-size="16">✨</text>' +
    '</svg>';
  }

  /* ================= 对外接口 ================= */
  window.Child = {
    render: showHome,
    renderPage: function (name, params) {
      params = params || {};
      if (name === 'quiz' && params.subject) { startSubject(params.subject); return; }
      if (name === 'done') { showDone(true); return; }
      showHome();
    }
  };
})();
