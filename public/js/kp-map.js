/* app-v3 知识点映射（engine 负责）
 * 数学：u1 按 CONTRACT §5；u2–u8 按 upload-2.md §4，用《新版课本全书方法清单.md》校准新版页码
 * 英语：按《英语课本全量提取.md》第1节页码表（U1 p2–9 / U2 p10–17 / U3 p18–25 / U4 p26–33 / U5 p34–41）
 * ES5 语法，直接 <script> 引入
 */
window.KP_MAP = {
  math: { units: [
    { id: 'u1', name: '100以内加减(二)', pages: [2, 19], kps: [
      { id: 'math.u1.add_split',    name: '拆分法/凑整法口算', pages: [2, 3],  terms: ['拆分法', '凑整法'] },
      { id: 'math.u1.vert_add',     name: '竖式进位加',       pages: [4, 5],  terms: ['列竖式', '满十进1', '相同数位对齐', '从个位算起'] },
      { id: 'math.u1.sub_mental',   name: '退位减口算',       pages: [6, 7],  terms: ['退位减'] },
      { id: 'math.u1.vert_sub',     name: '竖式退位减',       pages: [8, 9],  terms: ['列竖式', '退1当十'] },
      { id: 'math.u1.line_compare', name: '线段图比多比少',   pages: [10, 11], terms: ['线段图', '比多', '比少'] },
      { id: 'math.u1.word_2step',   name: '两步应用',         pages: [13, 14], terms: [] },
      { id: 'math.u1.review',       name: '整理复习',         pages: [15, 15], terms: ['满十进1', '退1当十'] }
    ]},
    { id: 'u2', name: '测量（一）', pages: [20, 29], kps: [
      { id: 'math.u2.body_ruler',   name: '身体尺（非标准单位）', pages: [20, 20], terms: ['拃', '步'] },
      { id: 'math.u2.cm_read',      name: '用尺子量（厘米读数）', pages: [21, 23], terms: ['厘米', '0刻度对齐'] },
      { id: 'math.u2.m_cm',         name: '米厘米换算·选单位',   pages: [24, 27], terms: ['米', '厘米', '1米=100厘米'] },
      { id: 'math.u2.broken_ruler', name: '断尺读数',            pages: [28, 29], terms: [] }
    ]},
    { id: 'u3', name: '数一数与乘法', pages: [30, 42], kps: [
      { id: 'math.u3.skip_count',  name: '几个几个数',   pages: [30, 30], terms: ['几个几个数'] },
      { id: 'math.u3.add_to_mult', name: '加法改乘法',   pages: [31, 31], terms: ['几个几'] },
      { id: 'math.u3.mult_read',   name: '乘法认读',     pages: [32, 33], terms: ['乘数', '乘号', '积', '读作乘'] },
      { id: 'math.u3.dot_array',    name: '点子图',       pages: [34, 35], terms: ['点子图'] },
      { id: 'math.u3.pic_eq',       name: '图与算式互译', pages: [36, 37], terms: [] },
      { id: 'math.u3.times',        name: '倍的认识（乘法）', pages: [38, 40], terms: ['倍'] }
    ]},
    { id: 'u4', name: '乘法口诀（一）', pages: [43, 53], kps: [
      { id: 'math.u4.mult5',  name: '5的口诀',   pages: [43, 44], terms: ['口诀'] },
      { id: 'math.u4.mult2',  name: '2的口诀',   pages: [45, 46], terms: ['口诀'] },
      { id: 'math.u4.mult34', name: '3和4的口诀', pages: [47, 48], terms: ['口诀'] },
      { id: 'math.u4.mix',    name: '综合应用',   pages: [49, 50], terms: ['几个几'] }
    ]},
    { id: 'u5', name: '分一分与除法', pages: [57, 72], kps: [
      { id: 'math.u5.fair_share',    name: '平均分',          pages: [57, 57], terms: ['平均分', '每份同样多'] },
      { id: 'math.u5.two_divisions', name: '两种分法',        pages: [58, 59], terms: ['平均分', '包含除'] },
      { id: 'math.u5.div_eq',        name: '除法算式',        pages: [62, 63], terms: ['被除数', '除号', '除数', '商', '读作除以'] },
      { id: 'math.u5.quotient',      name: '用口诀求商',      pages: [64, 65], terms: ['口诀求商', '乘除互逆'] },
      { id: 'math.u5.times_div',     name: '倍的认识（巩固）', pages: [67, 68], terms: ['倍'] }
    ]},
    { id: 'u6', name: '图形的运动（一）', pages: [72, 76], kps: [
      { id: 'math.u6.symmetry',    name: '轴对称', pages: [72, 73], terms: ['对折', '完全重合'] },
      { id: 'math.u6.translation', name: '平移',  pages: [74, 76], terms: ['平移', '几格'] }
    ]},
    { id: 'u7', name: '乘法口诀（二）', pages: [77, 86], kps: [
      { id: 'math.u7.mult6',     name: '6的口诀',     pages: [77, 77], terms: ['口诀'] },
      { id: 'math.u7.mult789',   name: '7、8、9的口诀', pages: [79, 80], terms: ['口诀'] },
      { id: 'math.u7.dot_split', name: '点子图拆分',   pages: [82, 83], terms: ['点子图', '拆分'] }
    ]},
    { id: 'u8', name: '乘除法的应用（一）', pages: [87, 93], kps: [
      { id: 'math.u8.quotient_app', name: '口诀求商解实际问题', pages: [87, 87], terms: ['口诀求商'] },
      { id: 'math.u8.trial',        name: '试商（括号最大填几）', pages: [88, 88], terms: ['试商'] },
      { id: 'math.u8.ask',          name: '情境提问题',         pages: [90, 91], terms: [] }
    ]}
  ]},
  english: { units: [
    { id: 'en.u1', name: 'Unit 1 Fun numbers and letters', pages: [2, 9],
      kps: [{ id: 'en.u1', name: 'Unit 1', pages: [2, 9] }] },
    { id: 'en.u2', name: 'Unit 2 A great picture', pages: [10, 17],
      kps: [{ id: 'en.u2', name: 'Unit 2', pages: [10, 17] }] },
    { id: 'en.u3', name: 'Unit 3 Helpful hands', pages: [18, 25],
      kps: [{ id: 'en.u3', name: 'Unit 3', pages: [18, 25] }] },
    { id: 'en.u4', name: "Unit 4 I'm happy!", pages: [26, 33],
      kps: [{ id: 'en.u4', name: 'Unit 4', pages: [26, 33] }] },
    { id: 'en.u5', name: 'Unit 5 Work time', pages: [34, 41],
      kps: [{ id: 'en.u5', name: 'Unit 5', pages: [34, 41] }] }
  ]}
};
