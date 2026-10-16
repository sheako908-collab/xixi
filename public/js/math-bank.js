/* app-v3 数学题模板库（engine 负责）
 * window.MATH_BANK = { kp_id: [模板...] }
 * 模板 = {id, kp_id, type(choice/input/judge/word2), difficulty(1-3), version, gen()}
 * gen() 返回 {stem, speak, options, answer(字符串), accept, misconceptions, solution, values}
 * word2 模板 gen() 返回 {step1:{...}, step2:{...}, values}，由 engine 拆成两道题
 * 答案一律由代码计算；干扰项按常见误解设计。ES5 语法。
 */
window.MATH_BANK_VERSION = 1;

/* ---------- 工具函数 ---------- */
function mb_rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function mb_pick(arr) { return arr[mb_rnd(0, arr.length - 1)]; }
function mb_shuffle(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = mb_rnd(0, i), t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function mb_repeat(s, n) { var r = ''; for (var i = 0; i < n; i++) r += s; return r; }
/* 选择题构造：correct 为正确答案；cands 为 [[干扰值, 错因标签], ...]；只保留实际入选的 */
function mb_choice(correct, cands, n) {
  var c = String(correct), opts = [c], mis = {}, i, v;
  for (i = 0; i < cands.length && opts.length < n; i++) {
    v = String(cands[i][0]);
    if (opts.indexOf(v) < 0) { opts.push(v); mis[v] = cands[i][1]; }
  }
  return { options: mb_shuffle(opts), misconceptions: mis };
}
/* 数字转中文（一~九十九），用于口诀/读作 */
var MB_CN_D = '零一二三四五六七八九';
function mb_numCn(n) {
  if (n <= 10) return n === 10 ? '十' : MB_CN_D.charAt(n);
  if (n < 20) return '十' + MB_CN_D.charAt(n - 10);
  var t = Math.floor(n / 10), o = n % 10;
  return MB_CN_D.charAt(t) + '十' + (o ? MB_CN_D.charAt(o) : '');
}
/* 乘法口诀文本：小在前；积<10 时加"得"（二三得六），积=10 用"一十"（二五一十） */
function mb_koujue(a, b) {
  var x = Math.min(a, b), y = Math.max(a, b), p = x * y, tail;
  if (p < 10) tail = '得' + mb_numCn(p);
  else if (p === 10) tail = '一十';
  else tail = mb_numCn(p);
  return mb_numCn(x) + mb_numCn(y) + tail;
}
/* 竖式题干 */
function mb_vert(a, op, b) {
  var A = String(a), B = op + String(b);
  var w = Math.max(A.length, B.length) + 1;
  function pad(s) { while (s.length < w) s = ' ' + s; return s; }
  return pad(A) + '\n' + pad(B) + '\n' + mb_repeat('—', w) + '\n' + pad('□');
}
/* 点子图（文字版） */
function mb_dots(r, c) {
  var rows = [], i;
  for (i = 0; i < r; i++) rows.push(mb_repeat('●', c));
  return rows.join('\n');
}
/* 竖式配图：题干只写文字算式，竖式由 fig 画出（与 child.js figHtml 的 vert 类型对应） */
function mb_vertFig(a, op, b) {
  var res = op === '+' ? a + b : a - b;
  return { t: 'vert', a: a, op: op, b: b, len: String(res).length, title: '列竖式算：' };
}

window.MATH_BANK = {

/* ================= u1 100以内加减(二) ================= */
'math.u1.add_split': [
  { id: 'math.u1.add_split.t1', kp_id: 'math.u1.add_split', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(11, 95); b = mb_rnd(1, 9); } while (a % 10 + b <= 10 || a + b > 100);
      var ans = a + b;
      return { stem: a + ' + ' + b + ' = ?', speak: a + ' 加 ' + b + ' 等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' + ' + b + ' = ' + ans, values: { a: a, b: b } };
    } },
  { id: 'math.u1.add_split.t2', kp_id: 'math.u1.add_split', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(11, 95); b = mb_rnd(1, 9); } while (a % 10 + b <= 10 || a + b > 100);
      var ans = a + b;
      var ch = mb_choice(ans, [[ans - 10, '漏进1（个位满十没向十位进）'], [ans + 1, '口算进位多算'], [ans - 1, '口算少算']], 4);
      return { stem: '用凑整法算：' + a + ' + ' + b + ' = ?', speak: '用凑整法算，' + a + ' 加 ' + b + ' 等于几',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: a + ' + ' + b + ' = ' + ans, values: { a: a, b: b } };
    } },
  { id: 'math.u1.add_split.t3', kp_id: 'math.u1.add_split', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(11, 89); b = mb_rnd(11, 89); } while (a % 10 + b % 10 <= 10 || a + b > 100);
      var ans = a + b;
      var ch = mb_choice(ans, [[ans - 10, '漏进1（个位满十没向十位进）'], [ans + 1, '口算多算'], [ans - 11, '十位少算']], 4);
      return { stem: '用拆分法算：' + a + ' + ' + b + ' = ?', speak: '用拆分法算，' + a + ' 加 ' + b + ' 等于几',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: a + ' + ' + b + ' = ' + ans, values: { a: a, b: b } };
    } }
],
'math.u1.vert_add': [
  { id: 'math.u1.vert_add.t1', kp_id: 'math.u1.vert_add', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(11, 99); b = mb_rnd(1, 9); } while (a % 10 + b < 10 || a + b > 100);
      var ans = a + b;
      return { stem: '列竖式算：' + a + ' + ' + b + ' = ?', fig: mb_vertFig(a, '+', b), speak: '列竖式算，' + a + ' 加 ' + b + ' 等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' + ' + b + ' = ' + ans + '（个位满十向十位进1）', values: { a: a, b: b } };
    } },
  { id: 'math.u1.vert_add.t2', kp_id: 'math.u1.vert_add', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(11, 99); b = mb_rnd(11, 99); } while (a % 10 + b % 10 < 10 || a + b > 100);
      var ans = a + b;
      return { stem: '列竖式算：' + a + ' + ' + b + ' = ?', fig: mb_vertFig(a, '+', b), speak: '列竖式算，' + a + ' 加 ' + b + ' 等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' + ' + b + ' = ' + ans + '（个位满十向十位进1）', values: { a: a, b: b } };
    } },
  { id: 'math.u1.vert_add.t3', kp_id: 'math.u1.vert_add', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(11, 99); b = mb_rnd(11, 99); } while (a % 10 + b % 10 < 10 || a + b < 95 || a + b > 100);
      var ans = a + b;
      return { stem: '列竖式算：' + a + ' + ' + b + ' = ?', fig: mb_vertFig(a, '+', b), speak: '列竖式算，' + a + ' 加 ' + b + ' 等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' + ' + b + ' = ' + ans + '（个位满十向十位进1，十位也满十）', values: { a: a, b: b } };
    } }
],
'math.u1.sub_mental': [
  { id: 'math.u1.sub_mental.t1', kp_id: 'math.u1.sub_mental', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(21, 99); b = mb_rnd(2, 9); } while (a % 10 >= b || a - b <= 0);
      var ans = a - b;
      var ch = mb_choice(ans, [[ans + 10, '退位遗漏（忘记向十位借）'], [ans + 1, '口算多算'], [ans - 1, '口算少算']], 4);
      return { stem: a + ' − ' + b + ' = ?', speak: a + ' 减 ' + b + ' 等于几',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: a + ' − ' + b + ' = ' + ans, values: { a: a, b: b } };
    } },
  { id: 'math.u1.sub_mental.t2', kp_id: 'math.u1.sub_mental', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(30, 99); b = mb_rnd(11, 29); } while (a % 10 >= b % 10 || a - b <= 0);
      var ans = a - b;
      return { stem: a + ' − ' + b + ' = ?', speak: a + ' 减 ' + b + ' 等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' − ' + b + ' = ' + ans, values: { a: a, b: b } };
    } },
  { id: 'math.u1.sub_mental.t3', kp_id: 'math.u1.sub_mental', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_pick([30, 40, 50, 60, 70, 80, 90]), b;
      do { b = mb_rnd(11, 89); } while (b % 10 === 0 || b >= a);
      var ans = a - b;
      return { stem: a + ' − ' + b + ' = ?', speak: a + ' 减 ' + b + ' 等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' − ' + b + ' = ' + ans, values: { a: a, b: b } };
    } }
],
'math.u1.vert_sub': [
  { id: 'math.u1.vert_sub.t1', kp_id: 'math.u1.vert_sub', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(21, 99); b = mb_rnd(1, 9); } while (a % 10 >= b || a - b <= 0);
      var ans = a - b;
      var rev = Math.floor(a / 10) * 10 + (b - a % 10); /* 大数减小数 */
      var ch = mb_choice(ans, [[ans + 10, '退位遗漏（忘记向十位借）'], [rev, '大数减小数（个位颠倒相减）'], [ans - 1, '口算少算']], 4);
      return { stem: '列竖式算：' + a + ' − ' + b + ' = ?', fig: mb_vertFig(a, '−', b), speak: '列竖式算，' + a + ' 减 ' + b + ' 等于几',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: a + ' − ' + b + ' = ' + ans + '（个位不够减，从十位退1当十）', values: { a: a, b: b } };
    } },
  { id: 'math.u1.vert_sub.t2', kp_id: 'math.u1.vert_sub', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(30, 99); b = mb_rnd(11, 99); } while (b >= a || a % 10 >= b % 10);
      var ans = a - b;
      return { stem: '列竖式算：' + a + ' − ' + b + ' = ?', fig: mb_vertFig(a, '−', b), speak: '列竖式算，' + a + ' 减 ' + b + ' 等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' − ' + b + ' = ' + ans + '（个位不够减，从十位退1当十）', values: { a: a, b: b } };
    } },
  { id: 'math.u1.vert_sub.t3', kp_id: 'math.u1.vert_sub', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var b;
      do { b = mb_rnd(12, 98); } while (b % 10 === 0);
      var ans = 100 - b;
      return { stem: '列竖式算：' + 100 + ' − ' + b + ' = ?', fig: mb_vertFig(100, '−', b), speak: '列竖式算，100 减 ' + b + ' 等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '100 − ' + b + ' = ' + ans + '（连续退位）', values: { a: 100, b: b } };
    } }
],
'math.u1.line_compare': [
  { id: 'math.u1.line_compare.t1', kp_id: 'math.u1.line_compare', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(11, 80); b = mb_rnd(2, 19); } while (a + b > 100);
      var ans = a + b;
      var ch = mb_choice(ans, [[a - b, '加减混淆（求多用了减法）'], [ans + 1, '口算多算'], [ans - 1, '口算少算']], 4);
      return { stem: '🌹 红花 ' + a + ' 朵，黄花比红花多 ' + b + ' 朵。黄花有几朵？',
        speak: '红花' + a + '朵，黄花比红花多' + b + '朵，黄花有几朵',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: a + ' + ' + b + ' = ' + ans, values: { a: a, b: b } };
    } },
  { id: 'math.u1.line_compare.t2', kp_id: 'math.u1.line_compare', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a, b;
      do { a = mb_rnd(20, 99); b = mb_rnd(2, 19); } while (b >= a);
      var ans = a - b;
      var ch = mb_choice(ans, [[a + b, '加减混淆（求少用了加法）'], [ans + 1, '口算多算'], [ans - 1, '口算少算']], 4);
      return { stem: '🍎 苹果 ' + a + ' 个，梨比苹果少 ' + b + ' 个。梨有几个？',
        speak: '苹果' + a + '个，梨比苹果少' + b + '个，梨有几个',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: a + ' − ' + b + ' = ' + ans, values: { a: a, b: b } };
    } },
  { id: 'math.u1.line_compare.t3', kp_id: 'math.u1.line_compare', type: 'choice', difficulty: 3, version: 1,
    gen: function () {
      var a, b, more = Math.random() < 0.5;
      do { a = mb_rnd(15, 80); b = mb_rnd(2, 15); } while (more ? a + b > 100 : b >= a);
      var op = more ? '+' : '−', exp = a + op + b, ans = more ? a + b : a - b;
      var wrongOp = more ? '−' : '+';
      var ch = mb_choice(exp, [[a + wrongOp + b, '加减混淆（多/少看反了）'], [a + op + (b + 1), '数字抄错'], [(a + 1) + op + b, '数字抄错']], 4);
      var stem = more
        ? '线段图：红条 ' + a + ' 段，蓝条比红条多 ' + b + ' 段。求蓝条，选对算式。'
        : '线段图：红条 ' + a + ' 段，蓝条比红条少 ' + b + ' 段。求蓝条，选对算式。';
      return { stem: stem, fig: { t: 'seg', a: a, b: b, more: more }, speak: '看线段图，选出正确的算式',
        options: ch.options, answer: exp, accept: [exp], misconceptions: ch.misconceptions,
        solution: '正确算式：' + exp + ' = ' + ans, values: { a: a, b: b, more: more } };
    } }
],
'math.u1.word_2step': [
  { id: 'math.u1.word_2step.t1', kp_id: 'math.u1.word_2step', type: 'word2', difficulty: 2, version: 1,
    gen: function () {
      var a, b, c;
      do { a = mb_rnd(10, 50); b = mb_rnd(5, 30); c = mb_rnd(3, 20); } while (a + b > 100 || c >= a + b);
      var eq = a + '+' + b + '-' + c, ans = a + b - c;
      var ch = mb_choice(eq, [[a + '+' + b + '+' + c, '该减的加了（运算选择错）'], [a + '-' + b + '-' + c, '该加的减了（运算选择错）'], [a + '+' + c + '-' + b, '数字放错位置']], 4);
      return {
        step1: { stem: '🍎 果园里有 ' + a + ' 个苹果，又运来 ' + b + ' 个，卖掉了 ' + c + ' 个。先选对算式：',
          speak: '果园里有' + a + '个苹果，又运来' + b + '个，卖掉了' + c + '个，先选出正确的算式',
          options: ch.options, answer: eq, accept: [eq], misconceptions: ch.misconceptions,
          solution: '正确算式：' + eq + ' = ' + ans },
        step2: { stem: eq + ' = ?', speak: eq.replace(/\+/g, '加').replace(/-/g, '减') + '等于几',
          options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
          solution: eq + ' = ' + ans },
        values: { a: a, b: b, c: c } };
    } },
  { id: 'math.u1.word_2step.t2', kp_id: 'math.u1.word_2step', type: 'word2', difficulty: 2, version: 1,
    gen: function () {
      var a, b, c;
      do { a = mb_rnd(8, 40); b = mb_rnd(5, 30); c = mb_rnd(3, 25); } while (a + b + c > 100);
      var eq = a + '+' + b + '+' + c, ans = a + b + c;
      var ch = mb_choice(eq, [[a + '+' + b + '-' + c, '该加的减了（运算选择错）'], [a + '-' + b + '+' + c, '运算选择错'], [(a + b) + '+' + (c + 1), '数字抄错']], 4);
      return {
        step1: { stem: '🍬 小明有 ' + a + ' 颗糖，妈妈给 ' + b + ' 颗，奶奶又给 ' + c + ' 颗。现在一共有几颗？先选对算式：',
          speak: '小明有' + a + '颗糖，妈妈给' + b + '颗，奶奶又给' + c + '颗，先选出正确的算式',
          options: ch.options, answer: eq, accept: [eq], misconceptions: ch.misconceptions,
          solution: '正确算式：' + eq + ' = ' + ans },
        step2: { stem: eq + ' = ?', speak: eq.replace(/\+/g, '加') + '等于几',
          options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
          solution: eq + ' = ' + ans },
        values: { a: a, b: b, c: c } };
    } },
  { id: 'math.u1.word_2step.t3', kp_id: 'math.u1.word_2step', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var a, b, c;
      do { a = mb_rnd(30, 99); b = mb_rnd(5, 30); c = mb_rnd(3, 25); } while (b + c >= a);
      var eq = a + '-' + b + '-' + c, ans = a - b - c;
      var ch = mb_choice(eq, [[a + '-' + b + '+' + c, '该减的加了（运算选择错）'], [a + '+' + b + '-' + c, '该减的加了（运算选择错）'], [(a - 1) + '-' + b + '-' + c, '数字抄错']], 4);
      return {
        step1: { stem: '👦 班里有 ' + a + ' 个小朋友，走了 ' + b + ' 个，又走了 ' + c + ' 个。还剩几个？先选对算式：',
          speak: '班里有' + a + '个小朋友，走了' + b + '个，又走了' + c + '个，先选出正确的算式',
          options: ch.options, answer: eq, accept: [eq], misconceptions: ch.misconceptions,
          solution: '正确算式：' + eq + ' = ' + ans },
        step2: { stem: eq + ' = ?', speak: eq.replace(/-/g, '减') + '等于几',
          options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
          solution: eq + ' = ' + ans },
        values: { a: a, b: b, c: c } };
    } }
],
'math.u1.review': [
  { id: 'math.u1.review.t1', kp_id: 'math.u1.review', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a, b, sub = Math.random() < 0.5;
      if (sub) { do { a = mb_rnd(21, 99); b = mb_rnd(2, 19); } while (a % 10 >= b % 10 || a - b <= 0); }
      else { do { a = mb_rnd(11, 90); b = mb_rnd(2, 19); } while (a % 10 + b % 10 <= 10 || a + b > 100); }
      var ans = sub ? a - b : a + b;
      var op = sub ? '−' : '+';
      var ch = mb_choice(ans, [[sub ? ans + 10 : ans - 10, sub ? '退位遗漏' : '漏进1'], [ans + 1, '口算多算'], [ans - 1, '口算少算']], 4);
      return { stem: '口算：' + a + ' ' + op + ' ' + b + ' = ?', speak: '口算，' + a + (sub ? '减' : '加') + b + '等于几',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: a + ' ' + op + ' ' + b + ' = ' + ans, values: { a: a, b: b, sub: sub } };
    } },
  { id: 'math.u1.review.t2', kp_id: 'math.u1.review', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a, b, c;
      do { a = mb_rnd(11, 60); b = mb_rnd(5, 40); c = mb_rnd(5, 40); } while (a + b > 100 || c >= a + b);
      var ans = a + b - c;
      return { stem: a + ' + ' + b + ' − ' + c + ' = ?', speak: a + '加' + b + '减' + c + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' + ' + b + ' − ' + c + ' = ' + ans, values: { a: a, b: b, c: c } };
    } }
]
,
/* ================= u2 测量（一） ================= */
'math.u2.body_ruler': [
  { id: 'math.u2.body_ruler.t1', kp_id: 'math.u2.body_ruler', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(3, 8), bigFirst = Math.random() < 0.5;
      var q, ans;
      if (bigFirst) { q = '小明一拃量课桌，长 ' + n + ' 拃。小红的手比小明大，她量同一张课桌，会量出几拃？'; ans = '比' + n + '少'; }
      else { q = '小明一拃量课桌，长 ' + n + ' 拃。小刚的手比小明小，他量同一张课桌，会量出几拃？'; ans = '比' + n + '多'; }
      var other = bigFirst ? '比' + n + '多' : '比' + n + '少';
      var ch = mb_choice(ans, [[other, '身体尺长短与个数关系颠倒'], ['还是' + n, '没理解非标准单位']], 3);
      return { stem: q, speak: q,
        options: ch.options, answer: ans, accept: [ans], misconceptions: ch.misconceptions,
        solution: ans + '（手大，一拃长，用的个数就少）', values: { n: n, bigFirst: bigFirst } };
    } },
  { id: 'math.u2.body_ruler.t2', kp_id: 'math.u2.body_ruler', type: 'judge', difficulty: 2, version: 1,
    gen: function () {
      var truthy = Math.random() < 0.5;
      var stem = truthy ? '不同人的拃不一样长，所以量之前要说好用谁的拃。' : '每个人的拃都一样长，随便用谁的量都一样。';
      return { stem: stem + ' 对吗？', speak: stem + '，对吗',
        options: ['对', '错'], answer: truthy ? '对' : '错', accept: [truthy ? '对' : '错'],
        misconceptions: truthy ? {} : { '对': '没理解统一标准的必要' },
        solution: stem + (truthy ? '（对）' : '（错）'), values: { truthy: truthy } };
    } }
],
'math.u2.cm_read': [
  { id: 'math.u2.cm_read.t1', kp_id: 'math.u2.cm_read', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var k = mb_rnd(3, 15);
      var ch = mb_choice(k, [[k + 1, '读数多看一格'], [k - 1, '读数少看一格']], 3);
      return { stem: '铅笔长几厘米？', fig: { t: 'ruler', from: 0, to: k + 1, start: 0, end: k, label: '铅笔' },
        speak: '看尺子，铅笔长几厘米',
        options: ch.options, answer: String(k), accept: [String(k)], misconceptions: ch.misconceptions,
        solution: '铅笔长 ' + k + ' 厘米（0刻度对准一端，另一端对着几就是几厘米）', values: { k: k } };
    } },
  { id: 'math.u2.cm_read.t2', kp_id: 'math.u2.cm_read', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var k = mb_rnd(5, 15);
      return { stem: '橡皮长（ ）厘米。', fig: { t: 'ruler', from: 0, to: k + 1, start: 0, end: k, label: '橡皮' },
        speak: '看尺子，橡皮长几厘米',
        options: null, answer: String(k), accept: [String(k)], misconceptions: {},
        solution: '橡皮长 ' + k + ' 厘米', values: { k: k } };
    } },
  { id: 'math.u2.cm_read.t3', kp_id: 'math.u2.cm_read', type: 'judge', difficulty: 3, version: 1,
    gen: function () {
      var s = mb_rnd(1, 2), e = s + mb_rnd(3, 8), truthy = Math.random() < 0.5;
      var said = truthy ? (e - s) : e;
      var stem = '小明说小刀长 ' + said + ' 厘米。对吗？';
      return { stem: stem, fig: { t: 'ruler', from: 0, to: e + 1, start: s, end: e, label: '小刀' },
        speak: '看尺子，小明说小刀长' + said + '厘米，对吗',
        options: ['对', '错'], answer: truthy ? '对' : '错', accept: [truthy ? '对' : '错'],
        misconceptions: truthy ? {} : { '对': '0没对准却从1起读（错例）' },
        solution: '小刀长 ' + (e - s) + ' 厘米（' + (truthy ? '对' : '错') + '）', values: { s: s, e: e, said: said } };
    } }
],
'math.u2.m_cm': [
  { id: 'math.u2.m_cm.t1', kp_id: 'math.u2.m_cm', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      return { stem: '1 米 = （ ）厘米', speak: '1米等于几厘米',
        options: null, answer: '100', accept: ['100'], misconceptions: {},
        solution: '1 米 = 100 厘米', values: { a: 1 } };
    } },
  { id: 'math.u2.m_cm.t2', kp_id: 'math.u2.m_cm', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var items = [
        { n: 18, item: '一支铅笔长约', unit: '厘米' }, { n: 2, item: '教室的门高约', unit: '米' },
        { n: 4, item: '黑板长约', unit: '米' }, { n: 5, item: '一块橡皮长约', unit: '厘米' },
        { n: 1, item: '小朋友身高约', unit: '米' }, { n: 17, item: '数学课本长约', unit: '厘米' }
      ];
      var it = mb_pick(items);
      var ch = mb_choice(it.unit, [[it.unit === '米' ? '厘米' : '米', '单位选错（长短感觉颠倒）']], 2);
      return { stem: it.item + ' ' + it.n + '（ ）。选合适的单位。', speak: it.item + it.n + '，选米还是厘米',
        options: ch.options, answer: it.unit, accept: [it.unit], misconceptions: ch.misconceptions,
        solution: it.item + ' ' + it.n + it.unit + '（短用厘米，长用米）', values: { n: it.n, unit: it.unit } };
    } },
  { id: 'math.u2.m_cm.t3', kp_id: 'math.u2.m_cm', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_rnd(2, 9), ans = a * 100;
      return { stem: a + ' 米 = （ ）厘米', speak: a + '米等于几厘米',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + ' 米 = ' + ans + ' 厘米（1米=100厘米）', values: { a: a } };
    } }
],
'math.u2.broken_ruler': [
  { id: 'math.u2.broken_ruler.t1', kp_id: 'math.u2.broken_ruler', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var s = mb_rnd(1, 4), len = mb_rnd(2, 10), e = s + len;
      return { stem: '这段长（ ）厘米。', fig: { t: 'ruler', from: Math.max(1, s - 1), to: e + 1, start: s, end: e, label: '这段', broken: true },
        speak: '看断尺，这段长几厘米',
        options: null, answer: String(len), accept: [String(len)], misconceptions: {},
        solution: e + ' − ' + s + ' = ' + len + '（厘米）', values: { s: s, e: e } };
    } },
  { id: 'math.u2.broken_ruler.t2', kp_id: 'math.u2.broken_ruler', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var s = mb_rnd(2, 6), len = mb_rnd(3, 9), e = s + len;
      var ch = mb_choice(len, [[e, '直接读了末刻度（起点不为0）'], [len + 1, '读数多算']], 3);
      return { stem: '彩带长几厘米？', fig: { t: 'ruler', from: Math.max(1, s - 1), to: e + 1, start: s, end: e, label: '彩带', broken: true },
        speak: '看断尺，彩带长几厘米',
        options: ch.options, answer: String(len), accept: [String(len)], misconceptions: ch.misconceptions,
        solution: e + ' − ' + s + ' = ' + len + '（厘米）', values: { s: s, e: e } };
    } },
  { id: 'math.u2.broken_ruler.t3', kp_id: 'math.u2.broken_ruler', type: 'judge', difficulty: 3, version: 1,
    gen: function () {
      var s = mb_rnd(2, 5), e = s + mb_rnd(3, 7), truthy = Math.random() < 0.5;
      var said = truthy ? (e - s) : e;
      var stem = '小红说长 ' + said + ' 厘米。对吗？';
      return { stem: stem, fig: { t: 'ruler', from: Math.max(1, s - 1), to: e + 1, start: s, end: e, label: '线段', broken: true },
        speak: '看断尺，小红说长' + said + '厘米，对吗',
        options: ['对', '错'], answer: truthy ? '对' : '错', accept: [truthy ? '对' : '错'],
        misconceptions: truthy ? {} : { '对': '断尺读数直接读末刻度' },
        solution: '长 ' + (e - s) + ' 厘米（' + (truthy ? '对' : '错') + '）', values: { s: s, e: e, said: said } };
    } }
],

/* ================= u3 数一数与乘法 ================= */
'math.u3.skip_count': [
  { id: 'math.u3.skip_count.t1', kp_id: 'math.u3.skip_count', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var s = 2, seq = [s, 2 * s, 3 * s, 5 * s], ans = 4 * s;
      return { stem: '2个2个数：' + seq[0] + '，' + seq[1] + '，' + seq[2] + '，（ ），' + seq[3],
        speak: '2个2个数，2，4，6，几，10',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '2，4，6，' + ans + '，' + seq[3], values: { s: s } };
    } },
  { id: 'math.u3.skip_count.t2', kp_id: 'math.u3.skip_count', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var s = 5, seq = [s, 2 * s, 4 * s, 5 * s], ans = 3 * s;
      return { stem: '5个5个数：' + seq[0] + '，' + seq[1] + '，（ ），' + seq[2] + '，' + seq[3],
        speak: '5个5个数，5，10，几，20，25',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '5，10，' + ans + '，' + seq[2] + '，' + seq[3], values: { s: s } };
    } },
  { id: 'math.u3.skip_count.t3', kp_id: 'math.u3.skip_count', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var s = mb_pick([3, 4]), seq = [s, 2 * s, 4 * s], ans = 3 * s;
      return { stem: s + '个' + s + '个数：' + seq[0] + '，' + seq[1] + '，（ ），' + seq[2],
        speak: s + '个' + s + '个数，' + seq[0] + '，' + seq[1] + '，几，' + seq[2],
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: seq[0] + '，' + seq[1] + '，' + ans + '，' + seq[2], values: { s: s } };
    } }
],
'math.u3.add_to_mult': [
  { id: 'math.u3.add_to_mult.t1', kp_id: 'math.u3.add_to_mult', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 5), a = mb_rnd(2, 6);
      var add = mb_repeat(a + '+', n - 1) + a;
      var right = a + '×' + n, comm = n + '×' + a;
      var ch = mb_choice(right, [[a + '+' + n, '加乘混淆（把几个几写成加法）'], [a + '×' + (n + 1), '个数数错']], 4);
      if (comm !== right) { ch.options.push(comm); ch.options = mb_shuffle(ch.options); }
      return { stem: add + ' 可以改写成哪个乘法算式？', speak: add + '，可以改写成哪个乘法算式',
        options: ch.options, answer: right, accept: [right, comm], misconceptions: ch.misconceptions,
        solution: add + ' = ' + n + '个' + a + ' = ' + right, values: { n: n, a: a } };
    } },
  { id: 'math.u3.add_to_mult.t2', kp_id: 'math.u3.add_to_mult', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 6), a = mb_rnd(2, 6);
      var right = n + '×' + a, comm = a + '×' + n;
      var ch = mb_choice(right, [[n + '+' + a, '加乘混淆'], [n + '×' + (a + 1), '个数数错']], 4);
      if (comm !== right) { ch.options.push(comm); ch.options = mb_shuffle(ch.options); }
      return { stem: '“' + n + '个' + a + '相加”写成乘法算式是？', speak: n + '个' + a + '相加，写成乘法算式是几',
        options: ch.options, answer: right, accept: [right, comm], misconceptions: ch.misconceptions,
        solution: n + '个' + a + '相加 = ' + right, values: { n: n, a: a } };
    } },
  { id: 'math.u3.add_to_mult.t3', kp_id: 'math.u3.add_to_mult', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 6), a = mb_rnd(2, 6), ans = n * a;
      var add = mb_repeat(a + '+', n - 1) + a;
      return { stem: add + ' = ？（' + n + '个' + a + '）', speak: add + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: add + ' = ' + ans, values: { n: n, a: a } };
    } }
],
'math.u3.mult_read': [
  { id: 'math.u3.mult_read.t1', kp_id: 'math.u3.mult_read', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var a = mb_rnd(2, 6), b = mb_rnd(2, 6);
      var right = mb_numCn(a) + '乘' + mb_numCn(b);
      var ch = mb_choice(right, [[mb_numCn(b) + '乘' + mb_numCn(a), '乘数顺序读反'], [mb_numCn(a) + '加' + mb_numCn(b), '乘加混淆']], 3);
      return { stem: a + '×' + b + ' 读作什么？', speak: a + '乘' + b + '读作什么',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: a + '×' + b + ' 读作“' + right + '”', values: { a: a, b: b } };
    } },
  { id: 'math.u3.mult_read.t2', kp_id: 'math.u3.mult_read', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 6), a = mb_rnd(2, 6);
      var right = n + '×' + a, comm = a + '×' + n;
      var ch = mb_choice(right, [[n + '+' + a, '加乘混淆'], [n + '×' + n, '两个乘数写成一样']], 4);
      if (comm !== right) { ch.options.push(comm); ch.options = mb_shuffle(ch.options); }
      return { stem: '“' + n + '个' + a + '”写成乘法算式是？', speak: n + '个' + a + '，写成乘法算式是几',
        options: ch.options, answer: right, accept: [right, comm], misconceptions: ch.misconceptions,
        solution: '“' + n + '个' + a + '”= ' + right, values: { n: n, a: a } };
    } },
  { id: 'math.u3.mult_read.t3', kp_id: 'math.u3.mult_read', type: 'judge', difficulty: 1, version: 1,
    gen: function () {
      var a = mb_rnd(2, 6), b = mb_rnd(2, 6), truthy = Math.random() < 0.5;
      if (!truthy && a === b) b = a === 6 ? 5 : a + 1; /* 读反时两数必须不同 */
      var read = truthy ? mb_numCn(a) + '乘' + mb_numCn(b) : mb_numCn(b) + '乘' + mb_numCn(a);
      var stem = a + '×' + b + ' 读作“' + read + '”。对吗？';
      return { stem: stem, speak: a + '乘' + b + '读作' + read + '，对吗',
        options: ['对', '错'], answer: truthy ? '对' : '错', accept: [truthy ? '对' : '错'],
        misconceptions: truthy ? {} : { '对': '乘数顺序读反' },
        solution: stem + '（' + (truthy ? '对' : '错') + '）', values: { a: a, b: b, truthy: truthy } };
    } }
],
'math.u3.dot_array': [
  { id: 'math.u3.dot_array.t1', kp_id: 'math.u3.dot_array', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var r = mb_rnd(2, 4), c = mb_rnd(2, 5), ans = r * c;
      return { stem: '看点子图：' + r + '×' + c + ' = ?', fig: { t: 'dots', r: r, c: c },
        speak: '看点子图，' + r + '乘' + c + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: r + '×' + c + ' = ' + ans, values: { r: r, c: c } };
    } },
  { id: 'math.u3.dot_array.t2', kp_id: 'math.u3.dot_array', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var r = mb_rnd(3, 5), c = mb_rnd(3, 6), ans = r * c;
      var ch = mb_choice(ans, [[(r + 1) * c, '多算了一行'], [r * (c + 1), '多算了一列'], [ans - r, '少算了一行']], 4);
      return { stem: '一共有几个点？', fig: { t: 'dots', r: r, c: c },
        speak: '看点子图，一共有几个点',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: r + '×' + c + ' = ' + ans, values: { r: r, c: c } };
    } },
  { id: 'math.u3.dot_array.t3', kp_id: 'math.u3.dot_array', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 6), b = mb_rnd(2, 6);
      var right = b + '×' + a;
      var ch = mb_choice(right, [[a + '+' + b, '加乘混淆'], [a + '×' + (b - 1), '口诀少算']], 3);
      return { stem: a + '×' + b + ' 还可以写成哪个算式？（横着数、竖着数）', speak: a + '乘' + b + '还可以写成哪个算式',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: a + '×' + b + ' = ' + right + '（横看竖看）', values: { a: a, b: b } };
    } }
],
'math.u3.pic_eq': [
  { id: 'math.u3.pic_eq.t1', kp_id: 'math.u3.pic_eq', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 6), a = mb_rnd(2, 5);
      var right = n + '×' + a, comm = a + '×' + n;
      var ch = mb_choice(right, [[n + '+' + a, '加乘混淆'], [(n + 1) + '×' + a, '盘数数错']], 4);
      if (comm !== right) { ch.options.push(comm); ch.options = mb_shuffle(ch.options); }
      return { stem: '🍎 ' + n + '盘苹果，每盘' + a + '个。选对乘法算式。', speak: n + '盘苹果每盘' + a + '个，选出正确的乘法算式',
        options: ch.options, answer: right, accept: [right, comm], misconceptions: ch.misconceptions,
        solution: right + ' = ' + (n * a), values: { n: n, a: a } };
    } },
  { id: 'math.u3.pic_eq.t2', kp_id: 'math.u3.pic_eq', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 4), b = mb_rnd(3, 5);
      function grid(r, c) { var rows = [], i; for (i = 0; i < r; i++) rows.push(mb_repeat('🍎', c)); return rows.join('\n'); }
      var right = grid(a, b);
      var ch = mb_choice(right, [[grid(a + 1, b), '行数看错'], [grid(a, b - 1), '列数看错']], 3);
      return { stem: '算式 ' + a + '×' + b + ' 对应哪幅图？', speak: a + '乘' + b + '对应哪幅图',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: a + '×' + b + ' = ' + a + '行' + b + '列', values: { a: a, b: b } };
    } },
  { id: 'math.u3.pic_eq.t3', kp_id: 'math.u3.pic_eq', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), a = mb_rnd(2, 9), ans = n * a;
      return { stem: '“' + n + '个' + a + '”一共是（ ）', speak: n + '个' + a + '一共是几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: n + '×' + a + ' = ' + ans, values: { n: n, a: a } };
    } }
],
'math.u3.times': [
  { id: 'math.u3.times.t1', kp_id: 'math.u3.times', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 6), n = mb_rnd(2, 4), ans = a * n;
      return { stem: '🔴 红气球 ' + a + ' 个，黄气球是红气球的 ' + n + ' 倍。黄气球有（ ）个。',
        speak: '红气球' + a + '个，黄气球是红气球的' + n + '倍，黄气球有几个',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + '×' + n + ' = ' + ans, values: { a: a, n: n } };
    } },
  { id: 'math.u3.times.t2', kp_id: 'math.u3.times', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 6), n = mb_rnd(2, 4), ans = a * n;
      var ch = mb_choice(ans, [[ans + a, '多算了一份（倍数多算）'], [a + n, '加乘混淆（倍数用加法）']], 3);
      return { stem: '🐵 猴子 ' + a + ' 只，小兔是猴子的 ' + n + ' 倍。小兔有几只？',
        speak: '猴子' + a + '只，小兔是猴子的' + n + '倍，小兔有几只',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: a + '×' + n + ' = ' + ans, values: { a: a, n: n } };
    } },
  { id: 'math.u3.times.t3', kp_id: 'math.u3.times', type: 'choice', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_rnd(2, 5), n = mb_rnd(2, 4), b = a * n;
      var ch = mb_choice(n, [[n + 1, '倍数多算'], [n - 1, '倍数少算'], [b - a, '用减法求倍数']], 4);
      return { stem: '🔴 红花 ' + a + ' 朵，黄花 ' + b + ' 朵。黄花是红花的几倍？',
        speak: '红花' + a + '朵，黄花' + b + '朵，黄花是红花的几倍',
        options: ch.options, answer: String(n), accept: [String(n)], misconceptions: ch.misconceptions,
        solution: b + '÷' + a + ' = ' + n, values: { a: a, b: b, n: n } };
    } },
  { id: 'math.u3.times.t4', kp_id: 'math.u3.times', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 4), k = mb_rnd(2, 3), m = n * k;
      var ch = mb_choice(k, [[k + 1, '倍数多算'], [k - 1, '倍数少算']], 3);
      return { stem: '🐶 小狗' + n + '只：' + mb_repeat('🐶', n) + '\n🐱 小猫' + m + '只：' + mb_repeat('🐱', m) + '\n小猫是小狗的几倍？',
        speak: '小狗' + n + '只，小猫' + m + '只，小猫是小狗的几倍',
        options: ch.options, answer: String(k), accept: [String(k)], misconceptions: ch.misconceptions,
        solution: m + '÷' + n + ' = ' + k, values: { n: n, k: k, m: m } };
    } },
  { id: 'math.u3.times.t5', kp_id: 'math.u3.times', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 5), n = mb_rnd(2, 4), ans = a * n;
      return { stem: '🐰 白兔有 ' + a + ' 只，灰兔是白兔的 ' + n + ' 倍。灰兔有（ ）只。',
        speak: '白兔有' + a + '只，灰兔是白兔的' + n + '倍，灰兔有几只',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + '×' + n + ' = ' + ans, values: { a: a, n: n } };
    } },
  { id: 'math.u3.times.t6', kp_id: 'math.u3.times', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_rnd(2, 4), n = mb_rnd(2, 3), b = a * n, total = a + b;
      var ch = mb_choice(b, [[b + a, '多算了一份'], [a + n, '加乘混淆（倍数用加法）']], 3);
      return {
        step1: { stem: '🧱 红积木 ' + a + ' 块，蓝积木是红积木的 ' + n + ' 倍。蓝积木有几块？',
          speak: '红积木' + a + '块，蓝积木是红积木的' + n + '倍，蓝积木有几块',
          options: ch.options, answer: String(b), accept: [String(b)], misconceptions: ch.misconceptions,
          solution: '蓝积木：' + a + '×' + n + ' = ' + b },
        step2: { stem: '红积木和蓝积木一共有几块？',
          speak: '红积木和蓝积木一共有几块',
          options: null, answer: String(total), accept: [String(total)], misconceptions: {},
          solution: '一共：' + a + ' + ' + b + ' = ' + total },
        values: { a: a, n: n, b: b } };
    } }
]
,
/* ================= u4 乘法口诀（一） ================= */
'math.u4.mult5': [
  { id: 'math.u4.mult5.t1', kp_id: 'math.u4.mult5', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 5 * n;
      return { stem: '5 × ' + n + ' = ?', speak: '5乘' + n + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '5×' + n + ' = ' + ans + '（' + mb_koujue(5, n) + '）', values: { n: n } };
    } },
  { id: 'math.u4.mult5.t2', kp_id: 'math.u4.mult5', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), m = 5 * n;
      return { stem: '（ ）× 5 = ' + m, speak: '几乘5等于' + m,
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: n + '×5 = ' + m + '（' + mb_koujue(5, n) + '）', values: { n: n, m: m } };
    } },
  { id: 'math.u4.mult5.t3', kp_id: 'math.u4.mult5', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), kj = mb_koujue(5, n);
      var right = mb_numCn(5 * n);
      var ch = mb_choice(right, [[mb_numCn(5 * (n - 1)), '口诀混淆（用了相邻口诀）'], [mb_numCn(5 * (n + 1)), '口诀混淆（用了相邻口诀）']], 3);
      return { stem: '口诀补全：' + kj.slice(0, 2) + '（ ）', speak: '口诀补全，' + kj.slice(0, 2) + '几',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: '口诀：' + kj, values: { n: n } };
    } },
  { id: 'math.u4.mult5.t4', kp_id: 'math.u4.mult5', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), kj = mb_koujue(5, n), ans = 5 * n;
      var ch = mb_choice(ans, [[ans + 5, '多背了一句口诀'], [ans - 5, '少背了一句口诀']], 3);
      return { stem: '口诀“' + kj + '”的得数是？', speak: '口诀' + kj + '的得数是几',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: '口诀：' + kj + '，得数 ' + ans, values: { n: n } };
    } },
  { id: 'math.u4.mult5.t5', kp_id: 'math.u4.mult5', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 6), ans = 5 * n;
      return { stem: '🖐 每只手有 5 根手指，' + n + ' 只手一共有（ ）根手指。',
        speak: '每只手有5根手指，' + n + '只手一共有几根手指',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '5×' + n + ' = ' + ans + '（' + mb_koujue(5, n) + '）', values: { n: n } };
    } },
  { id: 'math.u4.mult5.t6', kp_id: 'math.u4.mult5', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var n = mb_rnd(3, 8), m = 5 * n;
      return { stem: '🍪 每袋装 5 块饼干。妈妈买了几袋，一共 ' + m + ' 块。妈妈买了（ ）袋。',
        speak: '每袋装5块饼干，妈妈买了几袋，一共' + m + '块，妈妈买了几袋',
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: m + '÷5 = ' + n + '（' + mb_koujue(5, n) + '）', values: { n: n, m: m } };
    } }
],
'math.u4.mult2': [
  { id: 'math.u4.mult2.t1', kp_id: 'math.u4.mult2', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 2 * n;
      return { stem: '2 × ' + n + ' = ?', speak: '2乘' + n + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '2×' + n + ' = ' + ans + '（' + mb_koujue(2, n) + '）', values: { n: n } };
    } },
  { id: 'math.u4.mult2.t2', kp_id: 'math.u4.mult2', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), m = 2 * n;
      return { stem: '（ ）× 2 = ' + m, speak: '几乘2等于' + m,
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: n + '×2 = ' + m + '（' + mb_koujue(2, n) + '）', values: { n: n, m: m } };
    } },
  { id: 'math.u4.mult2.t3', kp_id: 'math.u4.mult2', type: 'judge', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(3, 9), truthy = Math.random() < 0.5, kj;
      if (truthy) { kj = mb_koujue(2, n); }
      else {
        var wp = 2 * n - 2, tail = wp < 10 ? '得' + mb_numCn(wp) : mb_numCn(wp);
        kj = mb_numCn(2) + mb_numCn(n) + tail; /* 相邻口诀的积， plausible 错口诀 */
      }
      var stem = '“' + kj + '”这句口诀对吗？';
      return { stem: stem, speak: '口诀' + kj + '，对吗',
        options: ['对', '错'], answer: truthy ? '对' : '错', accept: [truthy ? '对' : '错'],
        misconceptions: truthy ? {} : { '对': '口诀记混（相邻口诀）' },
        solution: stem + '（' + (truthy ? '对' : '错') + '，应为' + mb_koujue(2, n) + '）', values: { n: n, truthy: truthy } };
    } },
  { id: 'math.u4.mult2.t4', kp_id: 'math.u4.mult2', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), kj = mb_koujue(2, n), ans = 2 * n;
      var ch = mb_choice(ans, [[2 * (n - 1), '口诀混淆（用了相邻口诀）'], [2 * (n + 1), '口诀混淆（用了相邻口诀）']], 3);
      return { stem: '口诀“' + kj + '”的得数是？', speak: '口诀' + kj + '的得数是几',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: '口诀：' + kj + '，得数 ' + ans, values: { n: n } };
    } },
  { id: 'math.u4.mult2.t5', kp_id: 'math.u4.mult2', type: 'word2', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 5), m = mb_rnd(1, 6), s1 = 2 * n, total = s1 + m;
      return {
        step1: { stem: '🍌 每串有 2 根香蕉，' + n + ' 串有几根？',
          speak: '每串有2根香蕉，' + n + '串有几根',
          options: null, answer: String(s1), accept: [String(s1)], misconceptions: {},
          solution: '2×' + n + ' = ' + s1 },
        step2: { stem: '再加上 ' + m + ' 根散装的香蕉，一共有几根？',
          speak: '再加上' + m + '根散装的香蕉，一共有几根',
          options: null, answer: String(total), accept: [String(total)], misconceptions: {},
          solution: s1 + ' + ' + m + ' = ' + total },
        values: { n: n, m: m } };
    } },
  { id: 'math.u4.mult2.t6', kp_id: 'math.u4.mult2', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var n = mb_rnd(3, 9), k = mb_rnd(2, 6), ans = 2 * n + k;
      return { stem: '2 × ' + n + ' + ' + k + ' = ?', speak: '2乘' + n + '再加' + k + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '先算 2×' + n + ' = ' + (2 * n) + '，再算 ' + (2 * n) + ' + ' + k + ' = ' + ans, values: { n: n, k: k } };
    } }
],
'math.u4.mult34': [
  { id: 'math.u4.mult34.t1', kp_id: 'math.u4.mult34', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 3 * n;
      return { stem: '3 × ' + n + ' = ?', speak: '3乘' + n + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '3×' + n + ' = ' + ans + '（' + mb_koujue(3, n) + '）', values: { n: n } };
    } },
  { id: 'math.u4.mult34.t2', kp_id: 'math.u4.mult34', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 4 * n;
      return { stem: '4 × ' + n + ' = ?', speak: '4乘' + n + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '4×' + n + ' = ' + ans + '（' + mb_koujue(4, n) + '）', values: { n: n } };
    } },
  { id: 'math.u4.mult34.t3', kp_id: 'math.u4.mult34', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_pick([3, 4]), n = mb_rnd(3, 8), m = a * n;
      var ch = mb_choice(n, [[n - 1, '口诀混淆（用了相邻口诀）'], [n + 1, '口诀混淆（用了相邻口诀）']], 3);
      return { stem: '（ ）× ' + a + ' = ' + m, speak: '几乘' + a + '等于' + m,
        options: ch.options, answer: String(n), accept: [String(n)], misconceptions: ch.misconceptions,
        solution: n + '×' + a + ' = ' + m + '（' + mb_koujue(a, n) + '）', values: { a: a, n: n } };
    } },
  { id: 'math.u4.mult34.t4', kp_id: 'math.u4.mult34', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 3 * n;
      return { stem: '🔺 每个三角形有 3 条边，' + n + ' 个三角形一共有（ ）条边。',
        speak: '每个三角形有3条边，' + n + '个三角形一共有几条边',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '3×' + n + ' = ' + ans + '（' + mb_koujue(3, n) + '）', values: { n: n } };
    } },
  { id: 'math.u4.mult34.t5', kp_id: 'math.u4.mult34', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 8), ans = 4 * n;
      var ch = mb_choice(ans, [[ans + 4, '多算了一张桌子'], [ans - 4, '少算了一张桌子']], 3);
      return { stem: '🪑 每张桌子有 4 条腿，' + n + ' 张桌子一共有几条腿？',
        speak: '每张桌子有4条腿，' + n + '张桌子一共有几条腿',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: '4×' + n + ' = ' + ans + '（' + mb_koujue(4, n) + '）', values: { n: n } };
    } },
  { id: 'math.u4.mult34.t6', kp_id: 'math.u4.mult34', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var n = mb_rnd(2, 4), m = mb_rnd(2, 4), s1 = 3 * n, total = s1 + 4 * m;
      return {
        step1: { stem: '🔺 ' + n + ' 个三角形一共有几条边？',
          speak: n + '个三角形一共有几条边',
          options: null, answer: String(s1), accept: [String(s1)], misconceptions: {},
          solution: '3×' + n + ' = ' + s1 },
        step2: { stem: '再加上 ' + m + ' 张桌子的腿（每张 4 条），一共有几条？',
          speak: '再加上' + m + '张桌子的腿，每张4条，一共有几条',
          options: null, answer: String(total), accept: [String(total)], misconceptions: {},
          solution: s1 + ' + 4×' + m + ' = ' + s1 + ' + ' + (4 * m) + ' = ' + total },
        values: { n: n, m: m } };
    } }
],
'math.u4.mix': [
  { id: 'math.u4.mix.t1', kp_id: 'math.u4.mix', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 5), b = mb_rnd(2, 5), ans = a * b;
      return { stem: a + ' × ' + b + ' = ?', speak: a + '乘' + b + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + '×' + b + ' = ' + ans + '（' + mb_koujue(a, b) + '）', values: { a: a, b: b } };
    } },
  { id: 'math.u4.mix.t2', kp_id: 'math.u4.mix', type: 'word2', difficulty: 2, version: 1,
    gen: function () {
      var m = mb_rnd(2, 5), n = mb_pick([2, 3, 4, 5]);
      var eq = m + '×' + n, comm = n + '×' + m, ans = m * n;
      var ch = mb_choice(eq, [[m + '+' + n, '该乘的加了（运算选择错）'], [m + '×' + (n + 1), '盒数数错']], 4);
      if (comm !== eq) { ch.options.push(comm); ch.options = mb_shuffle(ch.options); }
      return {
        step1: { stem: '🍬 每盒装 ' + m + ' 块糖，' + n + ' 盒一共装几块？先选对算式：',
          speak: '每盒装' + m + '块糖，' + n + '盒一共装几块，先选出正确的算式',
          options: ch.options, answer: eq, accept: [eq, comm], misconceptions: ch.misconceptions,
          solution: '正确算式：' + eq + ' = ' + ans },
        step2: { stem: eq + ' = ?', speak: m + '乘' + n + '等于几',
          options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
          solution: eq + ' = ' + ans + '（' + mb_koujue(m, n) + '）' },
        values: { m: m, n: n } };
    } },
  { id: 'math.u4.mix.t3', kp_id: 'math.u4.mix', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_pick([3, 4, 5]), n = mb_rnd(2, 9), m = a * n;
      return { stem: '（ ）× ' + a + ' = ' + m, speak: '几乘' + a + '等于' + m,
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: n + '×' + a + ' = ' + m + '（' + mb_koujue(a, n) + '）', values: { a: a, n: n } };
    } },
  { id: 'math.u4.mix.t4', kp_id: 'math.u4.mix', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 5), b = mb_pick([2, 3, 4, 5]);
      var eq = a + '×' + b, comm = b + '×' + a;
      var ch = mb_choice(eq, [[a + '+' + b, '该乘的加了（运算选择错）'], [(a + 1) + '×' + b, '数量数错']], 3);
      if (comm !== eq) { ch.options.push(comm); ch.options = mb_shuffle(ch.options); }
      return { stem: '🍞 每袋面包 ' + b + ' 元，买 ' + a + ' 袋，一共多少钱？先选对算式：',
        speak: '每袋面包' + b + '元，买' + a + '袋，一共多少钱，先选出正确的算式',
        options: ch.options, answer: eq, accept: [eq, comm], misconceptions: ch.misconceptions,
        solution: '正确算式：' + eq + ' = ' + (a * b), values: { a: a, b: b } };
    } },
  { id: 'math.u4.mix.t5', kp_id: 'math.u4.mix', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 4), b = mb_rnd(2, 5), c = mb_rnd(2, 9), ans = a * b + c;
      return { stem: '🍎 每盘 ' + b + ' 个苹果，' + a + ' 盘，再加上 ' + c + ' 个，一共有（ ）个。',
        speak: '每盘' + b + '个苹果，' + a + '盘，再加上' + c + '个，一共有几个',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + '×' + b + ' + ' + c + ' = ' + (a * b) + ' + ' + c + ' = ' + ans, values: { a: a, b: b, c: c } };
    } },
  { id: 'math.u4.mix.t6', kp_id: 'math.u4.mix', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var n = mb_rnd(3, 5), m = mb_rnd(3, 5), total = m * n, k = mb_rnd(2, total - 3), left = total - k;
      return {
        step1: { stem: '🍪 每盒 ' + n + ' 块饼干，' + m + ' 盒一共有几块？',
          speak: '每盒' + n + '块饼干，' + m + '盒一共有几块',
          options: null, answer: String(total), accept: [String(total)], misconceptions: {},
          solution: m + '×' + n + ' = ' + total },
        step2: { stem: '吃掉了 ' + k + ' 块，还剩几块？',
          speak: '吃掉了' + k + '块，还剩几块',
          options: null, answer: String(left), accept: [String(left)], misconceptions: {},
          solution: total + ' − ' + k + ' = ' + left },
        values: { n: n, m: m, k: k } };
    } }
],

/* ================= u5 分一分与除法 ================= */
'math.u5.fair_share': [
  { id: 'math.u5.fair_share.t1', kp_id: 'math.u5.fair_share', type: 'judge', difficulty: 1, version: 1,
    gen: function () {
      var truthy = Math.random() < 0.5, n = mb_rnd(2, 4), a = mb_rnd(2, 5);
      var desc;
      if (truthy) { desc = n + '个盘子，每盘' + a + '个苹果'; }
      else { desc = n + '个盘子，分别装了' + a + '个、' + (a + 1) + '个、' + (a - 1 > 0 ? a - 1 : 1) + '个苹果'; }
      var stem = '🍎 ' + desc + '。这是平均分吗？';
      return { stem: stem, speak: desc + '，这是平均分吗',
        options: ['是', '不是'], answer: truthy ? '是' : '不是', accept: [truthy ? '是' : '不是'],
        misconceptions: truthy ? {} : { '是': '平均分概念不清（每份不一样多也当平均分）' },
        solution: stem + '（' + (truthy ? '是' : '不是') + '，平均分要求每份同样多）', values: { truthy: truthy, n: n, a: a } };
    } },
  { id: 'math.u5.fair_share.t2', kp_id: 'math.u5.fair_share', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 4), n = mb_rnd(2, 3);
      var right = '每盘' + a + '个，共' + n + '盘';
      var ch = mb_choice(right, [['盘子里有' + a + '个、' + (a + 2) + '个', '平均分概念不清（每份不一样多也当平均分）'], ['有的盘' + a + '个，有的盘空着', '空盘也算一份']], 3);
      return { stem: '🍊 哪一种分法是平均分？', speak: '哪一种分法是平均分',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: '平均分：' + right + '（每份同样多）', values: { a: a, n: n } };
    } },
  { id: 'math.u5.fair_share.t3', kp_id: 'math.u5.fair_share', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var a = mb_rnd(2, 5), n = mb_rnd(2, 3);
      var right = '每人' + a + '颗';
      var ch = mb_choice(right, [['有的' + a + '颗，有的' + (a + 2) + '颗', '平均分概念不清（每份不一样多也当平均分）'], ['有的' + a + '颗，有的1颗', '平均分概念不清（每份不一样多也当平均分）']], 3);
      return { stem: '🍬 糖果平均分给' + n + '个小朋友，哪一种分法是平均分？', speak: '糖果平均分给' + n + '个小朋友，哪一种分法是平均分',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: '平均分：' + right + '（每份同样多）', values: { a: a, n: n } };
    } },
  { id: 'math.u5.fair_share.t4', kp_id: 'math.u5.fair_share', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 4), per = mb_rnd(2, 6), total = n * per;
      return { stem: '✏️ ' + total + '支铅笔平均分给' + n + '个小朋友，每人分到（ ）支。',
        speak: total + '支铅笔平均分给' + n + '个小朋友，每人分到几支',
        options: null, answer: String(per), accept: [String(per)], misconceptions: {},
        solution: total + '÷' + n + ' = ' + per, values: { n: n, per: per } };
    } },
  { id: 'math.u5.fair_share.t5', kp_id: 'math.u5.fair_share', type: 'judge', difficulty: 2, version: 1,
    gen: function () {
      var truthy = Math.random() < 0.5, n = 3, per = mb_rnd(2, 6);
      var desc = truthy ? n + '个小朋友，每人分到' + per + '个橘子'
        : n + '个小朋友，分别分到' + per + '个、' + per + '个、' + (per + 2) + '个橘子';
      var stem = '🍊 ' + desc + '。这是平均分吗？';
      return { stem: stem, speak: desc + '，这是平均分吗',
        options: ['是', '不是'], answer: truthy ? '是' : '不是', accept: [truthy ? '是' : '不是'],
        misconceptions: truthy ? {} : { '是': '平均分概念不清（每份不一样多也当平均分）' },
        solution: stem + '（' + (truthy ? '是' : '不是') + '，平均分要求每份同样多）', values: { truthy: truthy, per: per } };
    } },
  { id: 'math.u5.fair_share.t6', kp_id: 'math.u5.fair_share', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var total = mb_pick([10, 11, 13, 14, 16, 17]), per = Math.floor(total / 3), rem = total % 3;
      return { stem: '🍎 ' + total + '个苹果平均分给3个小朋友，每人分到' + per + '个，还剩（ ）个。',
        speak: total + '个苹果平均分给3个小朋友，每人分到' + per + '个，还剩几个',
        options: null, answer: String(rem), accept: [String(rem)], misconceptions: {},
        solution: total + '÷3 = ' + per + '……' + rem, values: { total: total, per: per, rem: rem } };
    } }
],
'math.u5.two_divisions': [
  { id: 'math.u5.two_divisions.t1', kp_id: 'math.u5.two_divisions', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 6), q = mb_rnd(2, 6), t = p * q;
      var right = t + '÷' + p;
      var ch = mb_choice(right, [[t + '÷' + q, '两种分法混淆（平均分/包含除弄反）'], [t + '−' + p, '除减混淆']], 3);
      return { stem: '🍎 ' + t + '个苹果，每盘装' + p + '个，可以装几盘？选对算式。',
        speak: t + '个苹果，每盘装' + p + '个，可以装几盘，选出正确的算式',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: right + ' = ' + q + '（盘）', values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.two_divisions.t2', kp_id: 'math.u5.two_divisions', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 6), q = mb_rnd(2, 6), t = p * q;
      return { stem: '🍊 ' + t + '个橘子，平均分给' + p + '个小朋友，每人（ ）个。',
        speak: t + '个橘子平均分给' + p + '个小朋友，每人几个',
        options: null, answer: String(q), accept: [String(q)], misconceptions: {},
        solution: t + '÷' + p + ' = ' + q, values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.two_divisions.t3', kp_id: 'math.u5.two_divisions', type: 'choice', difficulty: 3, version: 1,
    gen: function () {
      var p = mb_rnd(2, 6), q = mb_rnd(2, 6), t = p * q;
      var incl = Math.random() < 0.5;
      var right = t + '÷' + p;
      var stem = incl
        ? '🍐 ' + t + '个梨，每' + p + '个装一袋，可以装几袋？'
        : '🍐 ' + t + '个梨，平均分给' + p + '人，每人几个？';
      var ch = mb_choice(right, [[t + '−' + p, '除减混淆'], [p + '÷' + t, '被除数除数写反']], 3);
      return { stem: stem + ' 选对算式。', speak: stem + '，选出正确的算式',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: right + ' = ' + q, values: { t: t, p: p, q: q, incl: incl } };
    } },
  { id: 'math.u5.two_divisions.t4', kp_id: 'math.u5.two_divisions', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var items = [['🍬', '糖果', '颗', '盒'], ['✏️', '铅笔', '支', '捆'], ['🍪', '饼干', '块', '盘'], ['🍓', '草莓', '个', '篮']];
      var it = mb_pick(items);
      var p = mb_rnd(2, 6), q = mb_rnd(2, 6), t = p * q;
      return { stem: it[0] + ' ' + t + it[2] + it[1] + '，每 ' + p + it[2] + '装一' + it[3] + '，可以装（ ）' + it[3] + '。',
        speak: t + it[2] + it[1] + '，每' + p + it[2] + '装一' + it[3] + '，可以装几' + it[3],
        options: null, answer: String(q), accept: [String(q)], misconceptions: {},
        solution: t + '÷' + p + ' = ' + q + '（' + it[3] + '）', values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.two_divisions.t5', kp_id: 'math.u5.two_divisions', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 6), q = mb_rnd(2, 6), t = p * q;
      var isAvg = Math.random() < 0.5;
      var sc = isAvg
        ? mb_pick(['把 ' + t + ' 根胡萝卜平均分给 ' + p + ' 只小兔', '把 ' + t + ' 本书平均分给 ' + p + ' 个小组', '把 ' + t + ' 个苹果平均分给 ' + p + ' 个小朋友'])
        : mb_pick(['把 ' + t + ' 根香蕉，每 ' + p + ' 根装一袋', '把 ' + t + ' 个玩具，每 ' + p + ' 个装一盒', '把 ' + t + ' 个甜甜圈，每 ' + p + ' 个装一盘']);
      var right = isAvg ? '平均分' : '包含除';
      var ch = mb_choice(right, [[isAvg ? '包含除' : '平均分', '两种分法混淆（平均分/包含除分不清）'], ['两种分法都不是', '分法概念不清']], 3);
      return { stem: sc + '。这属于哪种分法？', speak: sc + '，这属于哪种分法',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: sc + ' → ' + right, values: { t: t, p: p, isAvg: isAvg } };
    } },
  { id: 'math.u5.two_divisions.t6', kp_id: 'math.u5.two_divisions', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var items = [['🍊', '橘子', '个', '袋'], ['🍎', '苹果', '个', '盒'], ['🍪', '饼干', '块', '盘']];
      var it = mb_pick(items);
      var p = mb_rnd(2, 4), r = mb_rnd(2, 4), q2 = mb_rnd(2, 4), q1 = r * q2, t = p * q1;
      return {
        step1: { stem: it[0] + ' 有 ' + t + it[2] + it[1] + '，平均分给 ' + p + ' 个小朋友，每人分到（ ）' + it[2] + '。',
          speak: '有' + t + it[2] + it[1] + '，平均分给' + p + '个小朋友，每人分到几个',
          options: null, answer: String(q1), accept: [String(q1)], misconceptions: {},
          solution: t + '÷' + p + ' = ' + q1 },
        step2: { stem: '小朋友把分到的 ' + q1 + it[2] + it[1] + '，每 ' + r + it[2] + '装一' + it[3] + '，可以装（ ）' + it[3] + '。',
          speak: '把分到的' + q1 + it[2] + it[1] + '，每' + r + it[2] + '装一' + it[3] + '，可以装几' + it[3],
          options: null, answer: String(q2), accept: [String(q2)], misconceptions: {},
          solution: q1 + '÷' + r + ' = ' + q2 },
        values: { t: t, p: p, r: r, q1: q1, q2: q2 } };
    } }
],
'math.u5.div_eq': [
  { id: 'math.u5.div_eq.t1', kp_id: 'math.u5.div_eq', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 9), t = p * q;
      return { stem: t + ' ÷ ' + p + ' = ?', speak: t + '除以' + p + '等于几',
        options: null, answer: String(q), accept: [String(q)], misconceptions: {},
        solution: t + '÷' + p + ' = ' + q, values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.div_eq.t2', kp_id: 'math.u5.div_eq', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 9), t = p * q;
      var right = mb_numCn(t) + '除以' + mb_numCn(p);
      var ch = mb_choice(right, [[mb_numCn(p) + '除以' + mb_numCn(t), '被除数除数读反'], [mb_numCn(t) + '乘' + mb_numCn(p), '除乘混淆']], 3);
      return { stem: t + '÷' + p + ' 读作什么？', speak: t + '除以' + p + '读作什么',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: t + '÷' + p + ' 读作“' + right + '”', values: { t: t, p: p } };
    } },
  { id: 'math.u5.div_eq.t3', kp_id: 'math.u5.div_eq', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 6), q = mb_rnd(2, 6), t = p * q;
      var right = t + '÷' + p + '=' + q;
      var ch = mb_choice(right, [[t + '−' + p + '=' + q, '除减混淆'], [p + '÷' + t + '=' + q, '被除数除数写反']], 3);
      return { stem: '“' + t + '平均分成' + p + '份，每份' + q + '个”写成除法算式是？',
        speak: t + '平均分成' + p + '份每份' + q + '个，写成除法算式是几',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: right, values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.div_eq.t4', kp_id: 'math.u5.div_eq', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var items = [['🍒', '樱桃'], ['🍇', '葡萄'], ['⭐', '星星'], ['🔵', '小珠子']];
      var it = mb_pick(items);
      var p = mb_rnd(2, 4), q = mb_rnd(2, 4), t = p * q, i, pic = '';
      for (i = 0; i < q; i++) { pic += mb_repeat(it[0], p) + '　'; }
      return { stem: pic + '\n上图有 ' + t + ' 个' + it[1] + '，每 ' + p + ' 个一份，分成了 ' + q + ' 份。写成除法算式：' + t + '÷' + p + ' =（ ）。',
        speak: '图中有' + t + '个' + it[1] + '，每' + p + '个一份，分成了' + q + '份，写成除法算式，' + t + '除以' + p + '等于几',
        options: null, answer: String(q), accept: [String(q)], misconceptions: {},
        solution: t + '÷' + p + ' = ' + q, values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.div_eq.t5', kp_id: 'math.u5.div_eq', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var p, q;
      do { p = mb_rnd(2, 9); q = mb_rnd(2, 9); } while (p === q);
      var t = p * q;
      var role = mb_pick(['被除数', '除数', '商']);
      var right = role === '被除数' ? t : role === '除数' ? p : q;
      var others = [t, p, q].filter(function (x) { return x !== right; });
      var cands = [[others[0], '除法各部分名称混淆']];
      if (others.length > 1) { cands.push([others[1], '除法各部分名称混淆']); }
      var ch = mb_choice(right, cands, 3);
      return { stem: '在 ' + t + '÷' + p + '=' + q + ' 中，' + role + '是（ ）？',
        speak: '在' + t + '除以' + p + '等于' + q + '中，' + role + '是几',
        options: ch.options, answer: String(right), accept: [String(right)], misconceptions: ch.misconceptions,
        solution: t + '÷' + p + '=' + q + ' 中，' + role + '是 ' + right, values: { t: t, p: p, q: q, role: role } };
    } },
  { id: 'math.u5.div_eq.t6', kp_id: 'math.u5.div_eq', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var p, q;
      do { p = mb_rnd(2, 9); q = mb_rnd(2, 9); } while (p === q);
      var t = p * q, kou = mb_koujue(p, q);
      var askDiv = Math.random() < 0.5 ? p : q;
      var ans = t / askDiv;
      return { stem: '口诀“' + kou + '”可以写出两道除法算式。请写出其中一道：' + t + ' ÷ ' + askDiv + ' =（ ）。',
        speak: '口诀' + kou + '可以写出两道除法算式，' + t + '除以' + askDiv + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '口诀“' + kou + '”→ ' + t + '÷' + p + '=' + q + '，' + t + '÷' + q + '=' + p, values: { t: t, p: p, q: q } };
    } }
],
'math.u5.quotient': [
  { id: 'math.u5.quotient.t1', kp_id: 'math.u5.quotient', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 9), t = p * q;
      return { stem: t + ' ÷ ' + p + ' = ？（想口诀）', speak: t + '除以' + p + '等于几，想一想口诀',
        options: null, answer: String(q), accept: [String(q)], misconceptions: {},
        solution: t + '÷' + p + ' = ' + q + '（口诀：' + mb_koujue(p, q) + '）', values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.quotient.t2', kp_id: 'math.u5.quotient', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 9), t = p * q;
      var right = mb_koujue(p, q);
      var qs = [];
      if (q > 2) qs.push(q - 1);
      if (q < 9) qs.push(q + 1);
      if (qs.length < 2) qs.push(q > 5 ? q - 2 : q + 2);
      var ch = mb_choice(right, [[mb_koujue(p, qs[0]), '口诀混淆（用了相邻口诀）'], [mb_koujue(p, qs[1]), '口诀混淆（用了相邻口诀）']], 3);
      return { stem: t + ' ÷ ' + p + ' = ' + q + '，用的是哪句口诀？', speak: t + '除以' + p + '等于' + q + '，用的是哪句口诀',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: '口诀：' + right, values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.quotient.t3', kp_id: 'math.u5.quotient', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 9), b = mb_rnd(2, 9), c = a * b;
      return { stem: a + '×' + b + ' = ' + c + '，那么 ' + c + ' ÷ ' + a + ' = （ ）。',
        speak: a + '乘' + b + '等于' + c + '，那么' + c + '除以' + a + '等于几',
        options: null, answer: String(b), accept: [String(b)], misconceptions: {},
        solution: c + '÷' + a + ' = ' + b + '（乘除互逆）', values: { a: a, b: b, c: c } };
    } },
  { id: 'math.u5.quotient.t4', kp_id: 'math.u5.quotient', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 9), t = p * q;
      var kou = mb_koujue(p, q);
      var cands = [[p, '把除数当成了商']];
      if (q > 2) { cands.push([q - 1, '口诀混淆（商少算）']); }
      if (q < 9) { cands.push([q + 1, '口诀混淆（商多算）']); }
      if (cands.length < 3) { cands.push([q > 5 ? q - 2 : q + 2, '口诀混淆']); }
      var ch = mb_choice(q, cands, 4);
      return { stem: '用口诀“' + kou + '”计算，' + t + ' ÷ ' + p + ' = ？',
        speak: '用口诀' + kou + '计算，' + t + '除以' + p + '等于几',
        options: ch.options, answer: String(q), accept: [String(q)], misconceptions: ch.misconceptions,
        solution: t + '÷' + p + ' = ' + q + '（口诀：' + kou + '）', values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u5.quotient.t5', kp_id: 'math.u5.quotient', type: 'word2', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 9), t = p * q, m;
      do { m = q + mb_rnd(-3, 3); } while (m === q || m < 1);
      var cmp = q > m ? '＞' : '＜';
      var mis = {};
      mis[cmp === '＞' ? '＜' : '＞'] = '大小比较反了';
      mis['='] = '商与比较数看错';
      return {
        step1: { stem: t + ' ÷ ' + p + ' = ？（先想口诀求出商）',
          speak: t + '除以' + p + '等于几，先想口诀求出商',
          options: null, answer: String(q), accept: [String(q)], misconceptions: {},
          solution: t + '÷' + p + ' = ' + q + '（口诀：' + mb_koujue(p, q) + '）' },
        step2: { stem: '第一步算出 ' + t + '÷' + p + ' = ' + q + '。' + q + ' ○ ' + m + '，圆圈里应填什么符号？',
          speak: '第一步算出' + t + '除以' + p + '等于' + q + '，' + q + '和' + m + '比，圆圈里填什么符号',
          options: ['＞', '＜', '='], answer: cmp, accept: [cmp], misconceptions: mis,
          solution: q + ' ' + cmp + ' ' + m },
        values: { t: t, p: p, q: q, m: m } };
    } },
  { id: 'math.u5.quotient.t6', kp_id: 'math.u5.quotient', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 9), t = p * q;
      return { stem: '（ ）÷ ' + p + ' = ' + q + '，括号里填几？',
        speak: '括号除以' + p + '等于' + q + '，括号里填几',
        options: null, answer: String(t), accept: [String(t)], misconceptions: {},
        solution: '（ ）÷' + p + ' = ' + q + ' → 括号 = ' + p + '×' + q + ' = ' + t, values: { t: t, p: p, q: q } };
    } }
],
'math.u5.times_div': [
  { id: 'math.u5.times_div.t1', kp_id: 'math.u5.times_div', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(2, 6), n = mb_rnd(2, 4), b = a * n;
      var ch = mb_choice(n, [[n + 1, '倍数多算'], [n - 1, '倍数少算'], [b - a, '用减法求倍数']], 4);
      return { stem: '🐱 小猫 ' + a + ' 只，大猫 ' + b + ' 只。大猫是小猫的几倍？',
        speak: '小猫' + a + '只，大猫' + b + '只，大猫是小猫的几倍',
        options: ch.options, answer: String(n), accept: [String(n)], misconceptions: ch.misconceptions,
        solution: b + '÷' + a + ' = ' + n, values: { a: a, b: b, n: n } };
    } },
  { id: 'math.u5.times_div.t2', kp_id: 'math.u5.times_div', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_rnd(2, 9), n = mb_rnd(2, 5), ans = a * n;
      return { stem: '🌷 红花 ' + a + ' 朵，黄花是红花的 ' + n + ' 倍。黄花有（ ）朵。',
        speak: '红花' + a + '朵，黄花是红花的' + n + '倍，黄花有几朵',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + '×' + n + ' = ' + ans, values: { a: a, n: n } };
    } },
  { id: 'math.u5.times_div.t3', kp_id: 'math.u5.times_div', type: 'choice', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_rnd(2, 6), n = mb_rnd(2, 4), b = a * n;
      var ch = mb_choice(a, [[a + 1, '口算多算'], [b, '没除以倍数'], [a - 1 > 0 ? a - 1 : 1, '口算少算']], 4);
      return { stem: '🍌 香蕉 ' + b + ' 根，是苹果的 ' + n + ' 倍。苹果有几根？',
        speak: '香蕉' + b + '根，是苹果的' + n + '倍，苹果有几根',
        options: ch.options, answer: String(a), accept: [String(a)], misconceptions: ch.misconceptions,
        solution: b + '÷' + n + ' = ' + a, values: { a: a, b: b, n: n } };
    } },
  { id: 'math.u5.times_div.t4', kp_id: 'math.u5.times_div', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var items = [['🐱', '小猫', '只', '🐶', '小狗', '只'], ['🐰', '小兔', '只', '🐥', '小鸡', '只'],
                   ['🍎', '苹果', '个', '🍐', '梨', '个'], ['✏️', '铅笔', '支', '📏', '尺子', '把']];
      var it = mb_pick(items);
      var a = mb_rnd(2, 9), n = mb_rnd(2, 5), b = a * n;
      return { stem: it[0] + it[1] + ' ' + a + ' ' + it[2] + '，' + it[3] + it[4] + ' ' + b + ' ' + it[5] + '。' + it[4] + '是' + it[1] + '的（ ）倍。',
        speak: it[1] + a + it[2] + '，' + it[4] + b + it[5] + '，' + it[4] + '是' + it[1] + '的几倍',
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: b + '÷' + a + ' = ' + n, values: { a: a, b: b, n: n } };
    } },
  { id: 'math.u5.times_div.t5', kp_id: 'math.u5.times_div', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var items = [['🐰', '小兔', '只'], ['🍓', '草莓', '个'], ['🧸', '玩具熊', '只'], ['📖', '图书', '本']];
      var it = mb_pick(items);
      var a = mb_rnd(2, 6), n = mb_rnd(2, 4), b = a * n;
      var right = b + '是' + a + '的' + n + '倍';
      var ch = mb_choice(right, [[b + '是' + a + '的' + (n + 1) + '倍', '倍数多算'],
        [a + '是' + b + '的' + n + '倍', '两数说反了（一倍数和倍数弄反）'],
        [b + '是' + n + '的' + a + '倍', '倍数和一倍数位置放反']], 4);
      return { stem: it[0] + '小明有' + it[1] + ' ' + a + ' ' + it[2] + '，小红有' + it[1] + ' ' + b + ' ' + it[2] + '。下面哪句话说得对？',
        speak: '小明有' + it[1] + a + it[2] + '，小红有' + it[1] + b + it[2] + '，下面哪句话说得对',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: b + '÷' + a + ' = ' + n + ' → ' + right, values: { a: a, b: b, n: n } };
    } },
  { id: 'math.u5.times_div.t6', kp_id: 'math.u5.times_div', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var items = [['🐱', '小猫', '只', '🐶', '小狗'], ['🍎', '苹果', '个', '🍌', '香蕉'], ['🌷', '红花', '朵', '🌻', '黄花']];
      var it = mb_pick(items);
      var a = mb_rnd(2, 6), n = mb_rnd(2, 4), b = a * n, sum = a + b;
      var cands = [[n + 1, '倍数多算']];
      if (n > 2) { cands.push([n - 1, '倍数少算']); } else { cands.push([n + 2, '倍数多算']); }
      var ch = mb_choice(n, cands, 3);
      return {
        step1: { stem: it[0] + it[1] + ' ' + a + ' ' + it[2] + '，' + it[3] + it[4] + ' ' + b + ' ' + it[2] + '。' + it[4] + '是' + it[1] + '的几倍？先选出来。',
          speak: it[1] + a + it[2] + '，' + it[4] + b + it[2] + '，' + it[4] + '是' + it[1] + '的几倍，先选出来',
          options: ch.options, answer: String(n), accept: [String(n)], misconceptions: ch.misconceptions,
          solution: b + '÷' + a + ' = ' + n },
        step2: { stem: it[4] + '是' + it[1] + '的 ' + n + ' 倍。' + it[1] + '和' + it[4] + '一共有（ ）' + it[2] + '。',
          speak: it[4] + '是' + it[1] + '的' + n + '倍，两种一共有几' + it[2],
          options: null, answer: String(sum), accept: [String(sum)], misconceptions: {},
          solution: a + '+' + b + ' = ' + sum },
        values: { a: a, b: b, n: n } };
    } }
]
,
/* ================= u6 图形的运动（一） ================= */
'math.u6.symmetry': [
  { id: 'math.u6.symmetry.t1', kp_id: 'math.u6.symmetry', type: 'judge', difficulty: 1, version: 2,
    gen: function () {
      var truthy = Math.random() < 0.5;
      var shape = truthy ? mb_pick(['tri', 'house', 'star', 'diamond', 'heart']) : mb_pick(['rtri', 'ell', 'flag', 'para']);
      var stem = '沿中间虚线对折，两边能完全重合吗？';
      return { stem: stem, fig: { t: 'sym', shape: shape }, speak: '沿中间虚线对折，两边能完全重合吗',
        options: ['能', '不能'], answer: truthy ? '能' : '不能', accept: [truthy ? '能' : '不能'],
        misconceptions: truthy ? {} : { '能': '轴对称判断错（不对称也当对称）' },
        solution: stem + '（' + (truthy ? '能' : '不能') + '）', values: { shape: shape, truthy: truthy } };
    } },
  { id: 'math.u6.symmetry.t2', kp_id: 'math.u6.symmetry', type: 'choice', difficulty: 2, version: 2,
    gen: function () {
      var c = mb_rnd(1, 3), right = 7 - c;
      var cands = [[c, '没有对折（选了原来的格）'], [right - 1, '对折后位置数错（少一格）']];
      if (right + 1 <= 6) { cands.push([right + 1, '对折后位置数错（多一格）']); }
      var ch = mb_choice(right, cands, 4);
      return { stem: '沿中间虚线对折，红点会和第几格重合？', fig: { t: 'mirror', cols: 6, at: c },
        speak: '沿中间虚线对折，红点会和第几格重合',
        options: ch.options, answer: String(right), accept: [String(right)], misconceptions: ch.misconceptions,
        solution: '红点在第 ' + c + ' 格，对折后和第 ' + right + ' 格重合', values: { at: c } };
    } },
  { id: 'math.u6.symmetry.t3', kp_id: 'math.u6.symmetry', type: 'judge', difficulty: 1, version: 1,
    gen: function () {
      var truthy = Math.random() < 0.5;
      var desc = truthy
        ? mb_pick(['🦋 这只蝴蝶，左右两边的翅膀一模一样', '🍃 这片树叶，左右两半一模一样', '🏆 这个奖杯，左右两边一模一样'])
        : mb_pick(['🍃 这片树叶被虫子咬掉了一块，左右两半不一样', '☕ 这个杯子的把手只在右边，左右两边不一样', '🦋 这只蝴蝶左边的翅膀缺了一块，左右两边不一样']);
      return { stem: desc + '。沿中间虚线对折，两边能完全重合吗？',
        speak: desc + '，沿中间虚线对折，两边能完全重合吗',
        options: ['能', '不能'], answer: truthy ? '能' : '不能', accept: [truthy ? '能' : '不能'],
        misconceptions: truthy ? {} : { '能': '轴对称判断错（不对称也当对称）' },
        solution: desc + ' → ' + (truthy ? '能' : '不能') + '重合', values: { truthy: truthy } };
    } },
  { id: 'math.u6.symmetry.t4', kp_id: 'math.u6.symmetry', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var syms = [['🦋 蝴蝶', '左右翅膀一模一样'], ['❤️ 爱心', '左右两半一模一样'], ['⭐ 五角星', '五个角一模一样']];
      var asyms = [['🍃 被虫咬过的树叶', '左半边缺了一块'], ['☕ 带把手的杯子', '把手只在右边'], ['🎏 小旗子', '一边长一边短'], ['🧦 袜子', '两只大小不一样']];
      var s = mb_pick(syms);
      var ds = mb_shuffle(asyms).slice(0, 3), cands = [], i;
      for (i = 0; i < ds.length; i++) { cands.push([ds[i][0], '轴对称判断错（不对称也当对称）']); }
      var ch = mb_choice(s[0], cands, 4);
      return { stem: '下面哪个是轴对称图形（沿中间对折，两边能完全重合）？',
        speak: '下面哪个是轴对称图形，沿中间对折两边能完全重合',
        options: ch.options, answer: s[0], accept: [s[0]], misconceptions: ch.misconceptions,
        solution: s[0] + '：' + s[1] + '，是轴对称图形', values: {} };
    } },
  { id: 'math.u6.symmetry.t5', kp_id: 'math.u6.symmetry', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var shapes = [['长方形', '2', ['2']], ['正方形', '4', ['4']], ['圆', '无数条', ['无数条', '无数']]];
      var s = mb_pick(shapes);
      return { stem: s[0] + '有（ ）条对称轴。',
        speak: s[0] + '有几条对称轴',
        options: null, answer: s[1], accept: s[2], misconceptions: {},
        solution: s[0] + '有' + s[1] + '条对称轴', values: { shape: s[0] } };
    } },
  { id: 'math.u6.symmetry.t6', kp_id: 'math.u6.symmetry', type: 'choice', difficulty: 3, version: 1,
    gen: function () {
      var wholes = [['❤️ 爱心', '半颗爱心'], ['🦋 蝴蝶', '半只蝴蝶'], ['🍎 苹果', '半个苹果'], ['⭐ 星星', '半颗星星']];
      var w = mb_pick(wholes), ds = [], i;
      for (i = 0; i < wholes.length; i++) { if (wholes[i][0] !== w[0]) { ds.push([wholes[i][0], '补全后形状想错']); } }
      var ch = mb_choice(w[0], ds, 4);
      return { stem: '左边只有' + w[1] + '，沿中间虚线补全另一半，完整的图形是？',
        speak: '左边只有' + w[1] + '，沿中间虚线补全另一半，完整的图形是哪个',
        options: ch.options, answer: w[0], accept: [w[0]], misconceptions: ch.misconceptions,
        solution: w[1] + '补全另一半 → ' + w[0], values: {} };
    } }
],
'math.u6.translation': [
  { id: 'math.u6.translation.t1', kp_id: 'math.u6.translation', type: 'input', difficulty: 2, version: 2,
    gen: function () {
      var n = mb_rnd(1, 6);
      var dir = mb_pick(['右', '左']);
      var x0, x1;
      if (dir === '右') { x0 = mb_rnd(0, 7 - n); x1 = x0 + n; } else { x0 = mb_rnd(n, 7); x1 = x0 - n; }
      return { stem: '淡色小船平移到深色位置，向' + dir + '平移了（ ）格。', fig: { t: 'shift', cols: 8, x0: x0, x1: x1 },
        speak: '小船从淡色位置平移到深色位置，向' + dir + '平移了几格',
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: '小船向' + dir + '平移了 ' + n + ' 格', values: { n: n, dir: dir, x0: x0, x1: x1 } };
    } },
  { id: 'math.u6.translation.t2', kp_id: 'math.u6.translation', type: 'judge', difficulty: 1, version: 1,
    gen: function () {
      var truthy = Math.random() < 0.5;
      var stem = truthy ? '华容道的棋子只能横着或竖着走，不能斜着走。' : '华容道的棋子可以斜着走，也可以翻个面走。';
      return { stem: stem + ' 对吗？', speak: stem + '，对吗',
        options: ['对', '错'], answer: truthy ? '对' : '错', accept: [truthy ? '对' : '错'],
        misconceptions: truthy ? {} : { '对': '平移规则不清（斜走/翻转也当平移）' },
        solution: stem + '（' + (truthy ? '对' : '错') + '，平移只能横/纵移动，不能斜走、不能翻转）', values: { truthy: truthy } };
    } },
  { id: 'math.u6.translation.t3', kp_id: 'math.u6.translation', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var goods = ['电梯上下运行', '推箱子向前走', '火车沿直线行驶', '拉抽屉'];
      var bads = [['荡秋千', '摆动不是平移'], ['转动的风车', '旋转不是平移'], ['转动的摩天轮', '旋转不是平移'], ['翻跟头', '翻转不是平移']];
      var right = mb_pick(goods);
      var ds = mb_shuffle(bads).slice(0, 3), cands = [], i;
      for (i = 0; i < ds.length; i++) { cands.push([ds[i][0], ds[i][1]]); }
      var ch = mb_choice(right, cands, 4);
      return { stem: '下面哪个是平移现象（位置变了，样子和方向都不变）？',
        speak: '下面哪个是平移现象，位置变了，样子和方向都不变',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: right + '是平移现象', values: {} };
    } },
  { id: 'math.u6.translation.t4', kp_id: 'math.u6.translation', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var dir = mb_pick(['右', '左', '上', '下']);
      var n = mb_rnd(2, 6), x0, x1, stem, speak;
      if (dir === '右' || dir === '左') {
        if (dir === '右') { x0 = mb_rnd(1, 8 - n); x1 = x0 + n; } else { x0 = mb_rnd(n + 1, 8); x1 = x0 - n; }
        stem = '⛵ 小船的船头原来对着第 ' + x0 + ' 条竖线，向' + dir + '平移后对着第 ' + x1 + ' 条竖线，平移了（ ）格。';
        speak = '小船的船头原来对着第' + x0 + '条竖线，向' + dir + '平移后对着第' + x1 + '条竖线，平移了几格';
      } else {
        if (dir === '下') { x0 = mb_rnd(1, 8 - n); x1 = x0 + n; } else { x0 = mb_rnd(n + 1, 8); x1 = x0 - n; }
        stem = '🐦 小鸟原来停在第 ' + x0 + ' 条横线处，向' + dir + '飞到第 ' + x1 + ' 条横线处，平移了（ ）格。';
        speak = '小鸟原来停在第' + x0 + '条横线处，向' + dir + '飞到第' + x1 + '条横线处，平移了几格';
      }
      return { stem: stem, speak: speak,
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: '向' + dir + '平移了 ' + n + ' 格', values: { n: n, dir: dir } };
    } },
  { id: 'math.u6.translation.t5', kp_id: 'math.u6.translation', type: 'judge', difficulty: 2, version: 1,
    gen: function () {
      var truthy = Math.random() < 0.5;
      var stem = truthy
        ? mb_pick(['小船向右平移3格，船的大小和方向都不变', '把小旗向上平移2格，小旗的样子一点没变', '小兔向左平移4格，小兔还是原来那只小兔'])
        : mb_pick(['小船向右平移3格，船变大了一圈', '把图形翻了个面，图形还是平移过来的', '小船向右平移3格，船头转了个方向']);
      return { stem: stem + '。对吗？', speak: stem + '，对吗',
        options: ['对', '错'], answer: truthy ? '对' : '错', accept: [truthy ? '对' : '错'],
        misconceptions: truthy ? {} : { '对': '平移变式判断错（大小/方向变了也当平移）' },
        solution: stem + '（' + (truthy ? '对' : '错') + '，平移不改变大小和方向）', values: { truthy: truthy } };
    } },
  { id: 'math.u6.translation.t6', kp_id: 'math.u6.translation', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var c0 = mb_rnd(1, 5), r0 = mb_rnd(1, 4), dc = mb_rnd(2, 4), dr = mb_rnd(2, 3);
      var c1 = c0 + dc, r1 = r0 + dr;
      var askCol = Math.random() < 0.5;
      var ans = askCol ? c1 : r1;
      var ask = askCol ? '列' : '行';
      return { stem: '🚩 方格纸上，小旗原来在第 ' + c0 + ' 列第 ' + r0 + ' 行。先向右平移 ' + dc + ' 格，再向下平移 ' + dr + ' 格。现在小旗在第（ ）' + ask + '。',
        speak: '小旗原来在第' + c0 + '列第' + r0 + '行，先向右平移' + dc + '格，再向下平移' + dr + '格，现在小旗在第几' + ask,
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '列：' + c0 + '+' + dc + ' = ' + c1 + '；行：' + r0 + '+' + dr + ' = ' + r1, values: { c0: c0, r0: r0, dc: dc, dr: dr } };
    } }
],

/* ================= u7 乘法口诀（二） ================= */
'math.u7.mult6': [
  { id: 'math.u7.mult6.t1', kp_id: 'math.u7.mult6', type: 'input', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 6 * n;
      return { stem: '6 × ' + n + ' = ?', speak: '6乘' + n + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '6×' + n + ' = ' + ans + '（' + mb_koujue(6, n) + '）', values: { n: n } };
    } },
  { id: 'math.u7.mult6.t2', kp_id: 'math.u7.mult6', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), m = 6 * n;
      return { stem: '（ ）× 6 = ' + m, speak: '几乘6等于' + m,
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: n + '×6 = ' + m + '（' + mb_koujue(6, n) + '）', values: { n: n, m: m } };
    } },
  { id: 'math.u7.mult6.t3', kp_id: 'math.u7.mult6', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), kj = mb_koujue(6, n);
      var right = mb_numCn(6 * n);
      var ch = mb_choice(right, [[mb_numCn(6 * (n < 9 ? n + 1 : n - 1)), '口诀混淆（用了相邻口诀）'], [mb_numCn(6 * (n > 2 ? n - 1 : n + 1)), '口诀混淆（用了相邻口诀）']], 3);
      return { stem: '口诀补全：' + kj.slice(0, 2) + '（ ）', speak: '口诀补全，' + kj.slice(0, 2) + '几',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: '口诀：' + kj, values: { n: n } };
    } },
  { id: 'math.u7.mult6.t4', kp_id: 'math.u7.mult6', type: 'choice', difficulty: 1, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), prod = mb_numCn(6 * n), right = mb_numCn(n);
      var cands = [];
      if (n > 2) cands.push([mb_numCn(n - 1), '口诀混淆（用了相邻口诀）']);
      if (n < 9) cands.push([mb_numCn(n + 1), '口诀混淆（用了相邻口诀）']);
      if (n !== 6) cands.push([mb_numCn(6), '把6当成了要填的因数']);
      var ch = mb_choice(right, cands, 3);
      return { stem: '口诀补全：六（ ）' + prod, speak: '口诀补全，六几' + prod,
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: '口诀：' + mb_koujue(6, n), values: { n: n } };
    } },
  { id: 'math.u7.mult6.t5', kp_id: 'math.u7.mult6', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(3, 8), ans = 6 * n;
      return { stem: '🐜 每只蚂蚁有6条腿，' + n + '只蚂蚁一共有（ ）条腿。',
        speak: '每只蚂蚁有6条腿，' + n + '只蚂蚁一共有几条腿',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '6×' + n + ' = ' + ans + '（' + mb_koujue(6, n) + '）', values: { n: n } };
    } },
  { id: 'math.u7.mult6.t6', kp_id: 'math.u7.mult6', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var n = mb_rnd(3, 6), total = 6 * n, eat = mb_rnd(2, 9), left = total - eat;
      return {
        step1: { stem: '🍬 每包糖果6块，买了' + n + '包。先算一共买了几块：6×' + n + ' = ?',
          speak: '每包糖果6块，买了' + n + '包，先算一共买了几块',
          options: null, answer: String(total), accept: [String(total)], misconceptions: {},
          solution: '6×' + n + ' = ' + total },
        step2: { stem: '吃掉了' + eat + '块，还剩几块？' + total + ' − ' + eat + ' = ?',
          speak: '吃掉了' + eat + '块，还剩几块',
          options: null, answer: String(left), accept: [String(left)], misconceptions: {},
          solution: total + '−' + eat + ' = ' + left + '（先乘后减）' },
        values: { n: n, eat: eat } };
    } }
],
'math.u7.mult789': [
  { id: 'math.u7.mult789.t1', kp_id: 'math.u7.mult789', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 7 * n;
      return { stem: '7 × ' + n + ' = ?', speak: '7乘' + n + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '7×' + n + ' = ' + ans + '（' + mb_koujue(7, n) + '）', values: { n: n } };
    } },
  { id: 'math.u7.mult789.t2', kp_id: 'math.u7.mult789', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 8 * n;
      return { stem: '8 × ' + n + ' = ?', speak: '8乘' + n + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: '8×' + n + ' = ' + ans + '（' + mb_koujue(8, n) + '）', values: { n: n } };
    } },
  { id: 'math.u7.mult789.t3', kp_id: 'math.u7.mult789', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_pick([7, 8, 9]), n = mb_rnd(2, 9), m = a * n;
      return { stem: '（ ）× ' + a + ' = ' + m, speak: '几乘' + a + '等于' + m,
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: n + '×' + a + ' = ' + m + '（' + mb_koujue(a, n) + '）', values: { a: a, n: n } };
    } },
  { id: 'math.u7.mult789.t4', kp_id: 'math.u7.mult789', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), ans = 7 * n;
      var ch = mb_choice(String(ans), [[String(7 * n + 7), '多算了一周'], [String(7 + n), '把乘法做成了加法']], 3);
      return { stem: '📅 一周有7天，' + n + '周一共有（ ）天。',
        speak: '一周有7天，' + n + '周一共有几天',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: '7×' + n + ' = ' + ans + '（' + mb_koujue(7, n) + '）', values: { n: n } };
    } },
  { id: 'math.u7.mult789.t5', kp_id: 'math.u7.mult789', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(2, 8), ans = 8 * n;
      var ch = mb_choice(String(ans), [[String(8 * n + 8), '多算了一只'], [String(8 * (n - 1)), '少算了一只']], 3);
      return { stem: '🕷️ 每只蜘蛛有8条腿，' + n + '只蜘蛛一共有（ ）条腿。',
        speak: '每只蜘蛛有8条腿，' + n + '只蜘蛛一共有几条腿',
        options: ch.options, answer: String(ans), accept: [String(ans)], misconceptions: ch.misconceptions,
        solution: '8×' + n + ' = ' + ans + '（' + mb_koujue(8, n) + '）', values: { n: n } };
    } },
  { id: 'math.u7.mult789.t6', kp_id: 'math.u7.mult789', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var n = mb_rnd(2, 9), m = 9 * n;
      return { stem: '（ ）× 9 = ' + m, speak: '几乘9等于' + m,
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: n + '×9 = ' + m + '（' + mb_koujue(9, n) + '）', values: { n: n, m: m } };
    } }
],
'math.u7.dot_split': [
  { id: 'math.u7.dot_split.t1', kp_id: 'math.u7.dot_split', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_pick([6, 7, 8, 9]), b = mb_rnd(5, 9), c = mb_rnd(2, b - 2), d = b - c;
      return { stem: '点子图拆分：' + a + '×' + b + ' = ' + a + '×' + c + ' + ' + a + '×（ ）。',
        speak: a + '乘' + b + '拆成' + a + '乘' + c + '加' + a + '乘几',
        options: null, answer: String(d), accept: [String(d)], misconceptions: {},
        solution: a + '×' + b + ' = ' + a + '×' + c + ' + ' + a + '×' + d, values: { a: a, b: b, c: c } };
    } },
  { id: 'math.u7.dot_split.t2', kp_id: 'math.u7.dot_split', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_pick([6, 7, 8]), b = mb_rnd(5, 9), c = mb_rnd(2, b - 2), d = b - c;
      var p1 = a * c, p2 = a * d, ans = a * b;
      return { stem: '分步算 ' + a + '×' + b + '：先算 ' + a + '×' + c + '=' + p1 + '，再算 ' + a + '×' + d + '=' + p2 + '，最后 ' + p1 + '+' + p2 + '=（ ）。',
        speak: '分步算' + a + '乘' + b + '，' + p1 + '加' + p2 + '等于几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + '×' + b + ' = ' + p1 + ' + ' + p2 + ' = ' + ans, values: { a: a, b: b, c: c } };
    } },
  { id: 'math.u7.dot_split.t3', kp_id: 'math.u7.dot_split', type: 'judge', difficulty: 2, version: 1,
    gen: function () {
      var a = 8, b = 8, c = 5, truthy = Math.random() < 0.5;
      var d = truthy ? 3 : 2;
      var stem = '8×8 = 8×5 + 8×' + d + '。对吗？';
      return { stem: stem, speak: '8乘8等于8乘5加8乘' + d + '，对吗',
        options: ['对', '错'], answer: truthy ? '对' : '错', accept: [truthy ? '对' : '错'],
        misconceptions: truthy ? {} : { '对': '拆分后两部分加起来不是8' },
        solution: '8×8 = 8×5 + 8×3（' + (truthy ? '对' : '错') + '）', values: { d: d, truthy: truthy } };
    } },
  { id: 'math.u7.dot_split.t4', kp_id: 'math.u7.dot_split', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_pick([6, 7, 8, 9]), b = mb_rnd(5, 9);
      return { stem: '点子图拆分：' + a + '×' + b + ' = 5×' + b + ' +（ ）×' + b + '，括号里填几？',
        speak: a + '乘' + b + '拆成5乘' + b + '加几乘' + b,
        options: null, answer: String(a - 5), accept: [String(a - 5)], misconceptions: {},
        solution: a + '×' + b + ' = 5×' + b + ' + ' + (a - 5) + '×' + b, values: { a: a, b: b } };
    } },
  { id: 'math.u7.dot_split.t5', kp_id: 'math.u7.dot_split', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_pick([6, 7]), b = mb_rnd(6, 9), c = 5, d = b - 5;
      var right = a + '×' + b + ' = ' + a + '×' + c + ' + ' + a + '×' + d;
      var ch = mb_choice(right,
        [[a + '×' + b + ' = ' + a + '×' + c + ' + ' + a + '×' + (d + 1), '拆分后两部分加起来不是' + b],
         [a + '×' + b + ' = ' + a + '×' + (c - 1) + ' + ' + a + '×' + d, '拆分后两部分加起来不是' + b]], 3);
      return { stem: '下面哪个拆分是正确的？',
        speak: '下面哪个拆分是正确的',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: '正确：' + right + '（' + c + '+' + d + ' = ' + b + '）', values: { a: a, b: b } };
    } },
  { id: 'math.u7.dot_split.t6', kp_id: 'math.u7.dot_split', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_pick([6, 7, 8]);
      return { stem: '三步拆分：' + a + '×9 = ' + a + '×3 + ' + a + '×4 + ' + a + '×（ ），括号里填几？',
        speak: a + '乘9拆成三部分，' + a + '乘3加' + a + '乘4加' + a + '乘几',
        options: null, answer: '2', accept: ['2'], misconceptions: {},
        solution: a + '×9 = ' + a + '×3 + ' + a + '×4 + ' + a + '×2（3+4+2=9）', values: { a: a } };
    } }
],

/* ================= u8 乘除法的应用（一） ================= */
'math.u8.quotient_app': [
  { id: 'math.u8.quotient_app.t1', kp_id: 'math.u8.quotient_app', type: 'word2', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 6), t = p * q;
      var eq = t + '÷' + p;
      var ch = mb_choice(eq, [[t + '×' + p, '该除的乘了（运算选择错）'], [t + '−' + p, '该除的减了（运算选择错）'], [(t + p) + '÷' + p, '总数算错']], 4);
      return {
        step1: { stem: '🍑 ' + t + '个桃子，每' + p + '个装一盘，可以装几盘？先选对算式：',
          speak: t + '个桃子，每' + p + '个装一盘，可以装几盘，先选出正确的算式',
          options: ch.options, answer: eq, accept: [eq], misconceptions: ch.misconceptions,
          solution: '正确算式：' + eq + ' = ' + q },
        step2: { stem: eq + ' = ?', speak: t + '除以' + p + '等于几',
          options: null, answer: String(q), accept: [String(q)], misconceptions: {},
          solution: eq + ' = ' + q + '（口诀：' + mb_koujue(p, q) + '）' },
        values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u8.quotient_app.t2', kp_id: 'math.u8.quotient_app', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 6), t = p * q;
      var eq = t + '÷' + p;
      var ch = mb_choice(eq, [[t + '×' + p, '该除的乘了（运算选择错）'], [t + '÷' + q, '两种分法混淆'], [t + '−' + p, '该除的减了']], 4);
      return {
        step1: { stem: '🍬 ' + t + '块糖，平均分给' + p + '个小朋友，每人几块？先选对算式：',
          speak: t + '块糖平均分给' + p + '个小朋友，每人几块，先选出正确的算式',
          options: ch.options, answer: eq, accept: [eq], misconceptions: ch.misconceptions,
          solution: '正确算式：' + eq + ' = ' + q },
        step2: { stem: eq + ' = ?', speak: t + '除以' + p + '等于几',
          options: null, answer: String(q), accept: [String(q)], misconceptions: {},
          solution: eq + ' = ' + q + '（口诀：' + mb_koujue(p, q) + '）' },
        values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u8.quotient_app.t3', kp_id: 'math.u8.quotient_app', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 6), t = p * q;
      return { stem: '📚 ' + t + '本书，每' + p + '本捆一捆，可以捆（ ）捆。',
        speak: t + '本书，每' + p + '本捆一捆，可以捆几捆',
        options: null, answer: String(q), accept: [String(q)], misconceptions: {},
        solution: t + '÷' + p + ' = ' + q + '（口诀：' + mb_koujue(p, q) + '）', values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u8.quotient_app.t4', kp_id: 'math.u8.quotient_app', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 6), t = p * q;
      return { stem: '🐇 ' + t + '只兔子，平均装进' + p + '个笼子，每个笼子（ ）只。',
        speak: t + '只兔子平均装进' + p + '个笼子，每个笼子几只',
        options: null, answer: String(q), accept: [String(q)], misconceptions: {},
        solution: t + '÷' + p + ' = ' + q + '（口诀：' + mb_koujue(p, q) + '）', values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u8.quotient_app.t5', kp_id: 'math.u8.quotient_app', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 6), t = p * q;
      var eq = t + '÷' + p;
      var ch = mb_choice(eq, [[t + '×' + p, '该除的乘了（运算选择错）'], [t + '−' + p, '该除的减了（运算选择错）']], 3);
      return { stem: '🎈 ' + t + '个气球，每' + p + '个扎成一束，可以扎几束？选出正确的算式：',
        speak: t + '个气球，每' + p + '个扎成一束，可以扎几束，选出正确的算式',
        options: ch.options, answer: eq, accept: [eq], misconceptions: ch.misconceptions,
        solution: '正确算式：' + eq + ' = ' + q, values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u8.quotient_app.t6', kp_id: 'math.u8.quotient_app', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var per = mb_rnd(3, 5), bags = mb_pick([2, 4, 6]), t = per * bags, cls = 2, perCls = bags / 2;
      var eq1 = t + '÷' + per;
      var ch = mb_choice(eq1, [[t + '÷' + cls, '第一步算错（还没装袋就分了）'], [t + '×' + per, '该除的乘了']], 3);
      return {
        step1: { stem: '🪁 ' + t + '个风车，每' + per + '个装一袋，平均分给' + cls + '个班。第一步先算一共装几袋，选出算式：',
          speak: t + '个风车，每' + per + '个装一袋，平均分给' + cls + '个班，先选出第一步的算式',
          options: ch.options, answer: eq1, accept: [eq1], misconceptions: ch.misconceptions,
          solution: '第一步：' + eq1 + ' = ' + bags + '（袋）' },
        step2: { stem: '第二步：' + bags + '÷' + cls + ' = ?', speak: bags + '除以' + cls + '等于几',
          options: null, answer: String(perCls), accept: [String(perCls)], misconceptions: {},
          solution: bags + '÷' + cls + ' = ' + perCls + '（每个班' + perCls + '袋）' },
        values: { t: t, per: per, bags: bags } };
    } }
],
'math.u8.trial': [
  { id: 'math.u8.trial.t1', kp_id: 'math.u8.trial', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_rnd(4, 9), q0 = mb_rnd(2, 9), hi = a * q0 + mb_rnd(1, a);
      var ans = Math.floor((hi - 1) / a);
      return { stem: '（ ）× ' + a + ' < ' + hi + '，括号里最大填几？', speak: '几乘' + a + '小于' + hi + '，最大填几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: ans + '×' + a + ' = ' + (ans * a) + ' < ' + hi, values: { a: a, hi: hi } };
    } },
  { id: 'math.u8.trial.t2', kp_id: 'math.u8.trial', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(3, 8), q0 = mb_rnd(2, 9), hi = a * q0 + mb_rnd(1, a);
      var ans = Math.floor((hi - 1) / a);
      return { stem: a + ' ×（ ）< ' + hi + '，括号里最大填几？', speak: a + '乘几小于' + hi + '，最大填几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + '×' + ans + ' = ' + (a * ans) + ' < ' + hi, values: { a: a, hi: hi } };
    } },
  { id: 'math.u8.trial.t3', kp_id: 'math.u8.trial', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var a = mb_rnd(3, 8), q0 = mb_rnd(2, 8), lo = a * q0 + mb_rnd(0, a - 1);
      var ans = Math.floor(lo / a) + 1;
      return { stem: a + ' ×（ ）> ' + lo + '，括号里最小填几？', speak: a + '乘几大于' + lo + '，最小填几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: a + '×' + ans + ' = ' + (a * ans) + ' > ' + lo, values: { a: a, lo: lo } };
    } },
  { id: 'math.u8.trial.t4', kp_id: 'math.u8.trial', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(3, 5), q0 = mb_rnd(2, 5), hi = a * q0 + mb_rnd(1, a);
      var ans = Math.floor((hi - 1) / a);
      return { stem: '（ ）× ' + a + ' < ' + hi + '，括号里最大填几？', speak: '几乘' + a + '小于' + hi + '，最大填几',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: ans + '×' + a + ' = ' + (ans * a) + ' < ' + hi, values: { a: a, hi: hi } };
    } },
  { id: 'math.u8.trial.t5', kp_id: 'math.u8.trial', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var a = mb_rnd(6, 9), q0 = mb_rnd(4, 7), hi = a * q0 + mb_rnd(1, a - 1);
      var ch = mb_choice(String(q0), [[String(q0 + 1), '试商太大（乘积会超过' + hi + '）'], [String(q0 - 1), '还能再大一点']], 3);
      return { stem: '算 ' + hi + '÷' + a + ' 时试商：想（ ）×' + a + ' < ' + hi + '，括号里最大是几？',
        speak: '算' + hi + '除以' + a + '时试商，几乘' + a + '小于' + hi + '，最大是几',
        options: ch.options, answer: String(q0), accept: [String(q0)], misconceptions: ch.misconceptions,
        solution: q0 + '×' + a + ' = ' + (q0 * a) + ' < ' + hi + '（最大是' + q0 + '）', values: { a: a, hi: hi } };
    } },
  { id: 'math.u8.trial.t6', kp_id: 'math.u8.trial', type: 'input', difficulty: 3, version: 1,
    gen: function () {
      var per = mb_rnd(6, 9), n = mb_rnd(3, 6), total = per * n + mb_rnd(1, per - 1), left = total - per * n;
      return { stem: '🍬 ' + total + '块糖，每' + per + '块装一包，最多能装（ ）包。',
        speak: total + '块糖，每' + per + '块装一包，最多能装几包',
        options: null, answer: String(n), accept: [String(n)], misconceptions: {},
        solution: per + '×' + n + ' = ' + (per * n) + '，' + total + '−' + (per * n) + ' = ' + left + '（装' + n + '包，还剩' + left + '块）', values: { total: total, per: per } };
    } }
],
'math.u8.ask': [
  { id: 'math.u8.ask.t1', kp_id: 'math.u8.ask', type: 'choice', difficulty: 2, version: 1,
    gen: function () {
      var p = mb_rnd(2, 6), q = mb_rnd(2, 6), t = p * q;
      var right = '可以装几袋？';
      var ch = mb_choice(right, [['一共用了几根绳子？', '问题与情境无关'], ['还剩几个苹果？', '问题缺少条件']], 3);
      return { stem: '🍎 有 ' + t + '个苹果，每' + p + '个装一袋。下面哪个问题可以提？',
        speak: '有' + t + '个苹果，每' + p + '个装一袋，哪个问题可以提',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: right + '（' + t + '÷' + p + ' = ' + q + '）', values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u8.ask.t2', kp_id: 'math.u8.ask', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var p = mb_rnd(2, 9), q = mb_rnd(2, 6), t = p * q;
      var eq = t + '÷' + p;
      var chq = mb_choice('每人分到几块？', [['一共买了几块糖？', '问题与除法情境不符'], ['每块糖几元钱？', '问题缺少条件']], 3);
      return {
        step1: { stem: '🍬 ' + t + '块糖，平均分给' + p + '人。先选出可以提的问题：',
          speak: t + '块糖平均分给' + p + '人，先选出可以提的问题',
          options: chq.options, answer: '每人分到几块？', accept: ['每人分到几块？'],
          misconceptions: chq.misconceptions, solution: '可以提：每人分到几块？' },
        step2: { stem: '选对算式并计算：' + eq + ' = ?', speak: t + '除以' + p + '等于几',
          options: null, answer: String(q), accept: [String(q)], misconceptions: {},
          solution: eq + ' = ' + q + '（口诀：' + mb_koujue(p, q) + '）' },
        values: { t: t, p: p, q: q } };
    } },
  { id: 'math.u8.ask.t3', kp_id: 'math.u8.ask', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var n = mb_rnd(4, 7), per = mb_pick([6, 7, 8]), ans = n * per;
      return { stem: '🌽 墙上挂了' + n + '串玉米，每串' + per + '根，一共有（ ）根。',
        speak: '墙上挂了' + n + '串玉米，每串' + per + '根，一共有几根',
        options: null, answer: String(ans), accept: [String(ans)], misconceptions: {},
        solution: n + '×' + per + ' = ' + ans + '（' + mb_koujue(n, per) + '）', values: { n: n, per: per } };
    } },
  { id: 'math.u8.ask.t4', kp_id: 'math.u8.ask', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var b = mb_rnd(2, 9), a = mb_rnd(2, 6), long = a * b;
      return { stem: '🫛 豇豆长' + long + 'cm，扁豆长' + b + 'cm。豇豆是扁豆的（ ）倍。',
        speak: '豇豆长' + long + '厘米，扁豆长' + b + '厘米，豇豆是扁豆的几倍',
        options: null, answer: String(a), accept: [String(a)], misconceptions: {},
        solution: long + '÷' + b + ' = ' + a + '（求倍数用除法）', values: { a: a, b: b } };
    } },
  { id: 'math.u8.ask.t5', kp_id: 'math.u8.ask', type: 'input', difficulty: 2, version: 1,
    gen: function () {
      var per = mb_rnd(2, 9), q = mb_rnd(2, 9), t = per * q;
      return { stem: '🧺 一共摘了' + t + '个柿子，每' + per + '个装一盒，可以装（ ）盒。',
        speak: '一共摘了' + t + '个柿子，每' + per + '个装一盒，可以装几盒',
        options: null, answer: String(q), accept: [String(q)], misconceptions: {},
        solution: t + '÷' + per + ' = ' + q + '（口诀：' + mb_koujue(per, q) + '）', values: { t: t, per: per, q: q } };
    } },
  { id: 'math.u8.ask.t6', kp_id: 'math.u8.ask', type: 'choice', difficulty: 3, version: 1,
    gen: function () {
      var items = [{ name: '本子', unit: '个', price: 3 }, { name: '剪刀', unit: '把', price: 4 }, { name: '毽子', unit: '个', price: 6 }, { name: '风车', unit: '个', price: 8 }];
      var i = mb_rnd(0, items.length - 1), it = items[i];
      var qty = mb_rnd(4, 8), total = it.price * qty;
      var it2 = items[(i + 2) % items.length];
      var right = qty + it.unit + it.name + '（每' + it.unit + it.price + '元）';
      var ch = mb_choice(right,
        [[(qty + 1) + it.unit + it.name + '（每' + it.unit + it.price + '元）', '没算总价（' + ((qty + 1) * it.price) + '元≠' + total + '元）'],
         [qty + it2.unit + it2.name + '（每' + it2.unit + it2.price + '元）', '没算总价（' + (qty * it2.price) + '元≠' + total + '元）'],
         [(qty - 1) + it.unit + it.name + '（每' + it.unit + it.price + '元）', '没算总价（' + ((qty - 1) * it.price) + '元≠' + total + '元）']], 4);
      return { stem: '🛒 文具店：本子3元/个，剪刀4元/把，毽子6元/个，风车8元/个。有' + total + '元，买同一种商品正好花完。下面哪种买法是对的？',
        speak: '有' + total + '元，买同一种商品正好花完，哪种买法是对的',
        options: ch.options, answer: right, accept: [right], misconceptions: ch.misconceptions,
        solution: '正确：' + right + '，' + qty + '×' + it.price + ' = ' + total + '（元）', values: { total: total } };
    } },
  { id: 'math.u8.ask.t7', kp_id: 'math.u8.ask', type: 'word2', difficulty: 3, version: 1,
    gen: function () {
      var per = mb_rnd(3, 9), q = mb_rnd(4, 9), total = per * q;
      var p1 = mb_rnd(6, total - 6), p2 = total - p1;
      var chq = mb_choice('一共装几盒？', [['每盒柿子卖几元？', '问题缺少条件（没说价格）'], ['一共摘了几筐？', '问题缺少条件（没说每筐几个）']], 3);
      return {
        step1: { stem: '🧺 摘了' + p1 + '个柿子，树上还有' + p2 + '个，每' + per + '个装一盒。先选出可以提的问题：',
          speak: '摘了' + p1 + '个柿子，树上还有' + p2 + '个，每' + per + '个装一盒，先选出可以提的问题',
          options: chq.options, answer: '一共装几盒？', accept: ['一共装几盒？'],
          misconceptions: chq.misconceptions, solution: '可以提：一共装几盒？' },
        step2: { stem: '再列式计算：（' + p1 + ' + ' + p2 + '）÷ ' + per + ' = ?',
          speak: p1 + '加' + p2 + '的和除以' + per + '等于几',
          options: null, answer: String(q), accept: [String(q)], misconceptions: {},
          solution: '（' + p1 + '+' + p2 + '）÷' + per + ' = ' + total + '÷' + per + ' = ' + q },
        values: { p1: p1, p2: p2, per: per, q: q } };
    } }
]
};


