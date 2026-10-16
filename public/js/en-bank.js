/* app-v3 英语题模板库（engine 负责）
 * window.EN_BANK：8 题型，每题型一个模板对象 {id, type, gen(pool)}
 * pool = {words:[...], sentences:[...]}（engine 按 kp/页码过滤后传入）
 * gen 返回 {stem, speak, options, answer(字符串), accept, audio, misconceptions, solution, values, blocks?}
 * audio 路径规则：单词 'audio/en/w_<小写下划线>.mp3'，句子用 EN_DATA 里配好的 s_编号
 * （manifest 由 audio 负责人生成；这里只按规则拼路径）
 * ES5 语法，直接 <script> 引入
 */
function en_rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function en_pick(arr) { return arr[en_rnd(0, arr.length - 1)]; }
function en_shuffle(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = en_rnd(0, i), t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function en_slug(en) {
  return en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
/* 编辑距离（Levenshtein）：听音选词干扰项按拼写相近度挑选 */
function en_lev(a, b) {
  var m = a.length, n = b.length, d = [], i, j;
  for (i = 0; i <= m; i++) { d[i] = [i]; }
  for (j = 1; j <= n; j++) { d[0][j] = j; }
  for (i = 1; i <= m; i++) {
    for (j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    }
  }
  return d[m][n];
}
function en_audio_word(w) { return 'audio/en/w_' + en_slug(w.en) + '.mp3'; }
function en_pool(pool) {
  if (pool && pool.words && pool.words.length && pool.sentences && pool.sentences.length) return pool;
  return { words: window.EN_DATA.words, sentences: window.EN_DATA.sentences };
}
/* 选择题构造（与 math-bank 同规则，独立实现避免耦合） */
function en_choice(correct, cands, n) {
  var c = String(correct), opts = [c], mis = {}, i, v;
  for (i = 0; i < cands.length && opts.length < n; i++) {
    v = String(cands[i][0]);
    if (opts.indexOf(v) < 0) { opts.push(v); mis[v] = cands[i][1]; }
  }
  return { options: en_shuffle(opts), misconceptions: mis };
}

window.EN_BANK = {

/* 1. 听音选词：干扰项用最小对立（首字母相同/长度相近优先） */
listen_choice: { id: 'en.listen_choice', type: 'listen_choice',
  gen: function (pool) {
    var p = en_pool(pool);
    var target = en_pick(p.words);
    function score(w) {
      if (w.en === target.en) return -1;
      var s = 0;
      if (w.en.charAt(0).toLowerCase() === target.en.charAt(0).toLowerCase()) s += 2;
      if (Math.abs(w.en.length - target.en.length) <= 1) s += 1;
      s += Math.max(0, 4 - en_lev(w.en.toLowerCase(), target.en.toLowerCase())) * 2; /* 拼写越接近越优先（发音相近的近似） */
      return s;
    }
    var cands = p.words.slice().sort(function (x, y) { return score(y) - score(x); });
    var ds = [], i;
    for (i = 0; i < cands.length && ds.length < 3; i++) {
      if (cands[i].en !== target.en) ds.push([cands[i].en, '辨音混淆（发音/拼写相近的词）']);
    }
    var ch = en_choice(target.en, ds, 4);
    return { stem: '🔊 听一听，选出你听到的单词', speak: '听一听，选出你听到的单词',
      options: ch.options, answer: target.en, accept: [target.en],
      audio: en_audio_word(target), misconceptions: ch.misconceptions,
      solution: '听到的单词是 ' + target.en, values: { word: target.en } };
  } },

/* 2. 听音选图：emoji 作图 */
listen_pic: { id: 'en.listen_pic', type: 'listen_pic',
  gen: function (pool) {
    var p = en_pool(pool);
    var cands = p.words.filter(function (w) { return !!w.pic; });
    if (!cands.length) cands = window.EN_DATA.words.filter(function (w) { return !!w.pic; });
    var target = en_pick(cands), ds = [], i, w;
    var others = en_shuffle(cands.filter(function (x) { return x.en !== target.en; }));
    for (i = 0; i < others.length && ds.length < 2; i++) {
      w = others[i];
      if (ds.indexOf(w.pic) < 0) ds.push([w.pic, '音义对应错（听错了词）']);
    }
    var ch = en_choice(target.pic, ds, 3);
    return { stem: '🔊 听一听，选出对应的图', speak: '听一听，选出对应的图片',
      options: ch.options, answer: target.pic, accept: [target.pic],
      audio: en_audio_word(target), misconceptions: ch.misconceptions,
      solution: '听到的单词是 ' + target.en + ' ' + target.pic, values: { word: target.en } };
  } },

/* 3. 看图选词 / 英选中 / 中选英 */
pic_choice: { id: 'en.pic_choice', type: 'pic_choice',
  gen: function (pool) {
    var p = en_pool(pool);
    var withPic = p.words.filter(function (w) { return !!w.pic; });
    var withCn = p.words.filter(function (w) { return !!w.cn; });
    var kind = Math.random() < 0.5 ? 'pic_en' : 'en_cn';
    if (kind === 'pic_en' && !withPic.length) kind = 'en_cn';
    if (kind === 'en_cn' && !withCn.length) kind = 'pic_en';
    if (kind === 'pic_en') {
      var target = en_pick(withPic.length ? withPic : p.words);
      var ds = [], others = en_shuffle(p.words.filter(function (x) { return x.en !== target.en; })), i;
      for (i = 0; i < others.length && ds.length < 3; i++) ds.push([others[i].en, '词义混淆']);
      var ch = en_choice(target.en, ds, 4);
      return { stem: (target.pic || '🖼️') + ' 这个单词是？', speak: '看图，选出正确的单词',
        options: ch.options, answer: target.en, accept: [target.en],
        audio: en_audio_word(target), misconceptions: ch.misconceptions,
        solution: (target.pic || '') + ' = ' + target.en, values: { word: target.en, kind: 'pic_en' } };
    }
    var t2 = en_pick(withCn.length ? withCn : p.words);
    var ds2 = [], o2 = en_shuffle(p.words.filter(function (x) { return x.en !== t2.en && x.cn; })), j;
    for (j = 0; j < o2.length && ds2.length < 3; j++) ds2.push([o2[j].cn, '词义混淆']);
    var ch2 = en_choice(t2.cn || t2.en, ds2, 4);
    return { stem: t2.en + ' 的中文意思是？', speak: t2.en + '的中文意思是',
      options: ch2.options, answer: t2.cn || t2.en, accept: [t2.cn || t2.en],
      audio: en_audio_word(t2), misconceptions: ch2.misconceptions,
      solution: t2.en + ' = ' + (t2.cn || '（图）'), values: { word: t2.en, kind: 'en_cn' } };
  } },

/* 4. 听音拼词：点字母块（字母打乱） */
spell: { id: 'en.spell', type: 'spell',
  gen: function (pool) {
    var p = en_pool(pool);
    var cands = p.words.filter(function (w) { return /^[a-z]{3,7}$/.test(w.en); });
    if (!cands.length) cands = window.EN_DATA.words.filter(function (w) { return /^[a-z]{3,7}$/.test(w.en); });
    var target = en_pick(cands);
    return { stem: '🔊 听一听，按顺序点出字母，拼出单词', speak: '听一听，按顺序点出字母拼出单词',
      options: null, blocks: en_shuffle(target.en.split('')),
      answer: target.en, accept: [target.en],
      audio: en_audio_word(target), misconceptions: {},
      solution: '拼写：' + target.en.split('').join(' '), values: { word: target.en } };
  } },

/* 5. 补字母：优先挖拼读重点（元音优先），干扰用易混字母 */
fill_letter: { id: 'en.fill_letter', type: 'fill_letter',
  gen: function (pool) {
    var p = en_pool(pool);
    var cands = p.words.filter(function (w) { return /^[a-z]{3,}$/.test(w.en); });
    if (!cands.length) cands = window.EN_DATA.words.filter(function (w) { return /^[a-z]{3,}$/.test(w.en); });
    var target = en_pick(cands), word = target.en, idx = -1, i;
    for (i = 0; i < word.length; i++) {
      if ('aeiou'.indexOf(word.charAt(i)) >= 0) { idx = i; break; }
    }
    if (idx < 0) idx = en_rnd(0, word.length - 1);
    var letter = word.charAt(idx);
    var conf = [];
    if ('aeiou'.indexOf(letter) >= 0) conf = ['a', 'e', 'i', 'o', 'u'];
    else if (letter === 'b') conf = ['d', 'p', 'b'];
    else if (letter === 'd') conf = ['b', 'p', 'd'];
    else if (letter === 'p') conf = ['q', 'b', 'p'];
    else if (letter === 'q') conf = ['p', 'g', 'q'];
    else if (letter === 'm') conf = ['n', 'm'];
    else if (letter === 'n') conf = ['m', 'n'];
    else conf = ['e', 'a', 'i', 'o', 's', 't', 'r'];
    var ds = [], k;
    for (k = 0; k < conf.length && ds.length < 3; k++) {
      if (conf[k] !== letter && ds.indexOf(conf[k]) < 0) {
        ds.push([conf[k], 'aeiou'.indexOf(letter) >= 0 ? '元音混淆（元音字母拼错）'
          : ('bdpq'.indexOf(letter) >= 0 ? '字母方向混淆（b/d、p/q）' : '辅音混淆')]);
      }
    }
    var ch = en_choice(letter, ds, 4);
    var display = word.slice(0, idx) + '_' + word.slice(idx + 1);
    return { stem: '补上缺的字母：' + display, speak: '补上单词里缺的字母',
      options: ch.options, answer: letter, accept: [letter],
      audio: en_audio_word(target), misconceptions: ch.misconceptions,
      solution: '完整单词：' + word, values: { word: word, missing: idx } };
  } },

/* 6. 句子排序：点词块 */
order: { id: 'en.order', type: 'order',
  gen: function (pool) {
    var p = en_pool(pool);
    var cands = p.sentences.filter(function (s) {
      var n = s.en.split(' ').length; return n >= 3 && n <= 8;
    });
    if (!cands.length) cands = window.EN_DATA.sentences.filter(function (s) {
      var n = s.en.split(' ').length; return n >= 3 && n <= 8;
    });
    var target = en_pick(cands), words = target.en.split(' ');
    return { stem: '把词块点成正确的句子', speak: '把词块点成正确的句子',
      options: null, blocks: en_shuffle(words),
      answer: target.en, accept: [target.en],
      audio: target.audio, misconceptions: {},
      solution: '正确句子：' + target.en, values: { sentence: target.en } };
  } },

/* 7. 听句选意思：只用带官方中文的句子（Appendix 4） */
listen_meaning: { id: 'en.listen_meaning', type: 'listen_meaning',
  gen: function (pool) {
    var p = en_pool(pool);
    var cands = p.sentences.filter(function (s) { return !!s.cn; });
    if (!cands.length) cands = window.EN_DATA.sentences.filter(function (s) { return !!s.cn; });
    var target = en_pick(cands);
    var ds = [], others = en_shuffle(cands.filter(function (x) { return x.en !== target.en; })), i;
    for (i = 0; i < others.length && ds.length < 2; i++) ds.push([others[i].cn, '听力理解偏差']);
    var ch = en_choice(target.cn, ds, 3);
    return { stem: '🔊 听一听，选出句子的意思', speak: '听一听，选出句子的意思',
      options: ch.options, answer: target.cn, accept: [target.cn],
      audio: target.audio, misconceptions: ch.misconceptions,
      solution: target.en + ' = ' + target.cn, values: { sentence: target.en } };
  } },

/* 8. 跟读：显示句子＋"我读完了"，不判分 */
read_aloud: { id: 'en.read_aloud', type: 'read_aloud',
  gen: function (pool) {
    var p = en_pool(pool);
    var target = en_pick(p.sentences);
    return { stem: '🔊 先听，再跟读：\n' + target.en, speak: '先听一遍，再跟我读一读',
      options: null, answer: target.en, accept: [target.en],
      audio: target.audio, misconceptions: {},
      solution: '跟读：' + target.en, values: { sentence: target.en }, noScore: true };
  } }
};
