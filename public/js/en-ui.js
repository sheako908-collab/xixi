/* en-ui.js — 铭希英语新UI渲染模块
 * window.EnUI = {
 *   home(el, opts): 首页（课本轨道35题 + 追赶轨道15题）
 *   shell(q, meta): 答题页外壳 HTML（暖黄主题/狐狸/背景/第N页/进度点）
 *   foxFor(type): 题型→狐狸编号
 *   bgFor(type): 题型→背景名
 *   pageFor(q): 题目→页码标签文字（找不到返回空）
 * }
 * 与 child.js 现有渲染函数兼容：外壳保留 id="qbody/stem/feedback/speakBtn/exitBtn/starCounter"，
 * child.js 的 renderChoice/renderSpell/renderOrder/renderReadAloud 可直接填入 #qbody。
 * ES5 语法。
 */
(function () {
  var FOX = {
    listen_choice: '05', listen_pic: '05', listen_meaning: '05',
    pic_choice: '43',
    spell: '45', fill_letter: '45',
    order: '04',
    read_aloud: '30',
    recite: '30'
  };
  var BG = {
    listen_choice: 'listen', listen_pic: 'listen', listen_meaning: 'listen',
    pic_choice: 'match',
    spell: 'spell', fill_letter: 'spell',
    order: 'passage',
    read_aloud: 'readalong',
    recite: 'readalong'
  };
  var FOX_SPEECH = {
    listen_choice: '听清楚了吗？再听一次试试！',
    listen_pic: '仔细听，找出对应的图！',
    listen_meaning: '听听这句话是什么意思？',
    pic_choice: '仔细看看，选出正确的！',
    spell: '你来试试！把字母排好队。',
    fill_letter: '哪个字母不见了？想一想！',
    order: '把词块排成正确的句子！',
    read_aloud: '听一遍范读，再大声跟读！',
    recite: '先听一遍，再大声跟读！'
  };
  /* unit → 大致页码（EN_PAGE2UNIT：u1:2-9 u2:10-17 u3:18-25 u4:26-33 u5:34-41） */
  var UNIT_PAGE = { u1: '2-9', u2: '10-17', u3: '18-25', u4: '26-33', u5: '34-41' };

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function foxFor(type) { return FOX[type] || '01'; }
  function bgFor(type) { return BG[type] || 'home'; }

  /* 从 EN_DATA 反查页码：句子有 page；单词用 unit 映射 */
  function pageFor(q) {
    try {
      var v = q.values || {};
      var D = window.EN_DATA || {};
      if (v.sentence && D.sentences) {
        for (var i = 0; i < D.sentences.length; i++) {
          if (D.sentences[i].en === v.sentence && D.sentences[i].page) {
            return '第 ' + D.sentences[i].page + ' 页';
          }
        }
      }
      if (v.word && D.sentences) {
        /* 单词没有页码，尝试从同 unit 句子推断 */
        var unit = null, j;
        if (D.words) {
          for (j = 0; j < D.words.length; j++) {
            if (D.words[j].en === v.word) { unit = D.words[j].unit; break; }
          }
        }
        if (unit && UNIT_PAGE[unit]) { return '第 ' + UNIT_PAGE[unit] + ' 页'; }
      }
    } catch (e) {}
    return '';
  }

  /* 答题页外壳。meta: {qno, groupLabel, starCount, dotsTotal, dotsDone} */
  function shell(q, meta) {
    meta = meta || {};
    var type = q.type || '';
    var fox = foxFor(type), bg = bgFor(type);
    var pageTag = pageFor(q);
    var speech = FOX_SPEECH[type] || '加油，你可以的！';
    var dots = '';
    var total = meta.dotsTotal || 10, done = meta.dotsDone || 0, i;
    for (i = 0; i < total; i++) {
      dots += '<span class="' + (i < done ? 'on' : '') + '"></span>';
    }
    /* 听力题在题干区放一个大喇叭 */
    var isListen = type.indexOf('listen') === 0;
    var stemHtml;
    if (isListen) {
      stemHtml = '<div class="enui-audio"><button class="enui-audiobtn" id="enAudioBtn">🔊</button>' +
        '<span>' + esc(q.stem || '').replace(/\n/g, '<br>') + '</span></div>';
    } else {
      stemHtml = '<div class="enui-stem" id="stem">' + esc(q.stem || '').replace(/\n/g, '<br>') + '</div>';
    }

    return '<div class="enui" style="--enbg:url(\'en/assets/bg/' + bg + '.png\')">' +
      '<div class="enui-quiz">' +
        '<div class="enui-topbar">' +
          '<span class="enui-qno">英语·第' + (meta.qno || 1) + '题</span>' +
          '<span class="enui-grouptag">' + esc(meta.groupLabel || '') + '</span>' +
          (pageTag ? '<span class="enui-pagetag">' + esc(pageTag) + '</span>' : '<span></span>') +
          '<span class="enui-starcnt" id="starCounter">⭐×<b>' + (meta.starCount || 0) + '</b></span>' +
          '<button class="enui-speak" id="speakBtn" aria-label="点读">🔊</button>' +
          '<button class="enui-exit" id="exitBtn" aria-label="退出">✕</button>' +
        '</div>' +
        '<div class="enui-dots">' + dots + '</div>' +
        stemHtml +
        '<div id="qbody"></div>' +
        '<div class="enui-feedback" id="feedback"></div>' +
        '<div class="enui-foxline">' +
          '<div class="enui-speech">' + esc(speech) + '</div>' +
          '<img src="en/assets/fox/' + fox + '.svg" alt="小狐狸">' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* 首页：课本轨道35题 + 追赶轨道15题 */
  function home(el, opts) {
    opts = opts || {};
    var name = opts.name || '';
    var done = opts.done || 0;
    var stars = opts.stars || 0;
    var pct = Math.min(100, Math.round(done / 50 * 100));
    el.innerHTML =
      '<div class="enui" style="--enbg:url(\'en/assets/bg/home.png\')">' +
      '<div class="enui-home">' +
        '<div class="enui-profile">' +
          '<div class="enui-avatar"><img src="en/assets/fox/01.svg" alt="头像"></div>' +
          '<div><div class="nm">' + esc(name || '铭希') + '</div><span class="gr">2年级</span></div>' +
          '<div class="enui-stars">⭐ <span>' + stars + '</span></div>' +
        '</div>' +
        '<div class="enui-secttl">今日学习</div>' +
        '<div style="font-size:13px;font-weight:900">⭐ ' + done + ' / 50 <span style="color:#8a6b08;font-weight:700">题</span></div>' +
        '<div class="enui-progressline"><span style="width:' + pct + '%"></span></div>' +
        '<button class="enui-track blue" data-track="textbook">' +
          '<img src="en/assets/fox/04.svg" alt="">' +
          '<span><strong>课本轨道</strong><small>掌握课本内容</small><b>35 <small style="display:inline">题</small></b></span>' +
          '<span class="arr">›</span>' +
        '</button>' +
        '<button class="enui-track green" data-track="catchup">' +
          '<img src="en/assets/fox/30.svg" alt="">' +
          '<span><strong>追赶轨道</strong><small>提升综合能力</small><b>15 <small style="display:inline">题</small></b></span>' +
          '<span class="arr">›</span>' +
        '</button>' +
        '<div class="enui-foxfoot">' +
          '<div class="enui-speech">每天进步一点点！你真棒！</div>' +
          '<img src="en/assets/fox/01.svg" alt="小狐狸打招呼">' +
        '</div>' +
        '<button class="enui-backlink" id="enHomeBack">‹ 返回首页</button>' +
      '</div></div>';

    var tracks = el.querySelectorAll('[data-track]');
    for (var i = 0; i < tracks.length; i++) {
      (function (t) {
        t.addEventListener('click', function () {
          if (opts.onTrack) { opts.onTrack(t.getAttribute('data-track')); }
        });
      })(tracks[i]);
    }
    var back = el.querySelector('#enHomeBack');
    if (back) {
      back.addEventListener('click', function () { if (opts.onBack) { opts.onBack(); } });
    }
  }

  window.EnUI = {
    home: home,
    shell: shell,
    foxFor: foxFor,
    bgFor: bgFor,
    pageFor: pageFor
  };
})();
