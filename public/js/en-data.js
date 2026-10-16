/* app-v3 英语词句数据（engine 负责）
 * 唯一数据源：《英语课本全量提取.md》（2026-10-14）
 * 单词：官方32生词（Appendix 3，带课本官方中文）＋ 正文扩展词（课本无中文，cn 留空）
 * 句子：英文一字不差；中文只用 Appendix 4 的10句官方中文，其余 cn 留空
 * 已剔除 en-units.js 的错误：无 "I am big and fast." / "We learn, read and say."；
 * colour 只收录复数 colours；EN_PAGE2UNIT 用 p2-9/10-17/18-25/26-33/34-41
 * ES5 语法，直接 <script> 引入
 */
window.EN_DATA = {
  words: [
    /* ---- U1 官方生词（p52-53） ---- */
    { en: 'one', cn: '一', unit: 'u1' }, { en: 'two', cn: '二', unit: 'u1' },
    { en: 'three', cn: '三', unit: 'u1' }, { en: 'four', cn: '四', unit: 'u1' },
    { en: 'five', cn: '五', unit: 'u1' }, { en: 'six', cn: '六', unit: 'u1' },
    { en: 'seven', cn: '七', unit: 'u1' }, { en: 'eight', cn: '八', unit: 'u1' },
    { en: 'nine', cn: '九', unit: 'u1' }, { en: 'ten', cn: '十', unit: 'u1' },
    /* ---- U2 官方生词（p54-55） ---- */
    { en: 'red', cn: '红色的', unit: 'u2', pic: '🔴' }, { en: 'green', cn: '绿色的', unit: 'u2', pic: '🟢' },
    { en: 'blue', cn: '蓝色的', unit: 'u2', pic: '🔵' }, { en: 'yellow', cn: '黄色的', unit: 'u2', pic: '🟡' },
    { en: 'orange', cn: '橙红色的', unit: 'u2', pic: '🟠' }, { en: 'white', cn: '白色的', unit: 'u2', pic: '⚪' },
    { en: 'brown', cn: '棕色的', unit: 'u2', pic: '🟤' },
    /* ---- U3 官方生词（p56） ---- */
    { en: 'clean', cn: '打扫', unit: 'u3' }, { en: 'floor', cn: '地面', unit: 'u3' },
    { en: 'table', cn: '桌子', unit: 'u3' }, { en: 'feed', cn: '喂养', unit: 'u3' },
    { en: 'help', cn: '帮助', unit: 'u3' },
    /* ---- U4 官方生词（p57） ---- */
    { en: 'happy', cn: '高兴的', unit: 'u4', pic: '😊' }, { en: 'sad', cn: '难过的', unit: 'u4', pic: '😢' },
    { en: 'angry', cn: '生气的', unit: 'u4', pic: '😠' }, { en: 'hungry', cn: '饿的', unit: 'u4', pic: '🍽️' },
    { en: 'tired', cn: '疲劳的', unit: 'u4', pic: '😴' },
    /* ---- U5 官方生词（p58） ---- */
    { en: 'toy', cn: '玩具', unit: 'u5', pic: '🧸' }, { en: 'car', cn: '小汽车', unit: 'u5', pic: '🚗' },
    { en: 'doll', cn: '玩偶', unit: 'u5', pic: '🪆' }, { en: 'ball', cn: '球', unit: 'u5', pic: '⚽' },
    { en: 'boat', cn: '小船', unit: 'u5', pic: '⛵' },
    /* ---- 正文扩展词（非官方生词，课本无中文，cn 留空；跨单元去重，unit 取首次出现） ---- */
    { en: 'I', cn: '', unit: 'u1' }, { en: 'am', cn: '', unit: 'u1' },
    { en: 'big', cn: '', unit: 'u1' }, { en: 'and', cn: '', unit: 'u1' },
    { en: 'fast', cn: '', unit: 'u1' }, { en: 'We', cn: '', unit: 'u1' },
    { en: 'learn', cn: '', unit: 'u1' }, { en: 'read', cn: '', unit: 'u1' },
    { en: 'say', cn: '', unit: 'u1' },
    { en: 'apple', cn: '', unit: 'u2', pic: '🍎' }, { en: 'pencil', cn: '', unit: 'u2', pic: '✏️' },
    { en: 'flower', cn: '', unit: 'u2', pic: '🌸' }, { en: 'tree', cn: '', unit: 'u2', pic: '🌳' },
    { en: 'rabbit', cn: '', unit: 'u2', pic: '🐰' }, { en: 'dog', cn: '', unit: 'u2', pic: '🐶' },
    { en: 'cat', cn: '', unit: 'u2', pic: '🐱' }, { en: 'bird', cn: '', unit: 'u2', pic: '🐦' },
    { en: 'fish', cn: '', unit: 'u2', pic: '🐟' }, { en: 'carrot', cn: '', unit: 'u2', pic: '🥕' },
    { en: 'picture', cn: '', unit: 'u2', pic: '🖼️' }, { en: 'hand', cn: '', unit: 'u2', pic: '✋' },
    { en: 'sun', cn: '', unit: 'u2', pic: '☀️' }, { en: 'sea', cn: '', unit: 'u2', pic: '🌊' },
    { en: 'colours', cn: '', unit: 'u2', pic: '🎨' },
    { en: 'pet', cn: '', unit: 'u3', pic: '🐾' }, { en: 'mum', cn: '', unit: 'u3', pic: '👩' },
    { en: 'dad', cn: '', unit: 'u3', pic: '👨' }, { en: 'brother', cn: '', unit: 'u3', pic: '👦' },
    { en: 'sister', cn: '', unit: 'u3', pic: '👧' }, { en: 'now', cn: '', unit: 'u3' },
    { en: 'home', cn: '', unit: 'u3', pic: '🏠' }, { en: 'water', cn: '', unit: 'u3', pic: '💧' },
    { en: 'plants', cn: '', unit: 'u3', pic: '🌱' }, { en: 'every day', cn: '', unit: 'u3' },
    { en: 'feel', cn: '', unit: 'u4' },
    { en: 'book', cn: '', unit: 'u5', pic: '📖' }, { en: 'homework', cn: '', unit: 'u5', pic: '📚' },
    { en: 'new', cn: '', unit: 'u5' }, { en: 'some', cn: '', unit: 'u5' },
    { en: 'play', cn: '', unit: 'u5' }, { en: 'work', cn: '', unit: 'u5' },
    { en: 'study', cn: '', unit: 'u5' }
  ],
  /* 核心句 60 条：每单元关键句 10 条 ＋ Appendix 4 官方表达 10 条（带官方中文） */
  sentences: [
    /* U1 */
    { en: "Let's count!", cn: '', unit: 'u1', page: 3, audio: 'audio/en/s_001.mp3' },
    { en: 'One, two, three, four, five, six, seven, eight, nine, ten.', cn: '', unit: 'u1', page: 4, audio: 'audio/en/s_002.mp3' },
    { en: 'I see "two".', cn: '', unit: 'u1', page: 5, audio: 'audio/en/s_003.mp3' },
    { en: 'I see number 3.', cn: '', unit: 'u1', page: 5, audio: 'audio/en/s_004.mp3' },
    { en: 'I see two letters.', cn: '', unit: 'u1', page: 5, audio: 'audio/en/s_005.mp3' },
    { en: 'I love letters!', cn: '', unit: 'u1', page: 9, audio: 'audio/en/s_006.mp3' },
    { en: 'I can count up to 5.', cn: '', unit: 'u1', page: 48, audio: 'audio/en/s_007.mp3' },
    { en: "Let's count up to 10 again.", cn: '', unit: 'u1', page: 48, audio: 'audio/en/s_008.mp3' },
    { en: 'I see a lot of fruit.', cn: '', unit: 'u1', page: 48, audio: 'audio/en/s_009.mp3' },
    { en: 'Apples, oranges and bananas too.', cn: '', unit: 'u1', page: 48, audio: 'audio/en/s_010.mp3' },
    /* U2 */
    { en: 'This pencil is red.', cn: '', unit: 'u2', page: 11, audio: 'audio/en/s_011.mp3' },
    { en: 'Roses are red!', cn: '', unit: 'u2', page: 11, audio: 'audio/en/s_012.mp3' },
    { en: 'The apple is red.', cn: '', unit: 'u2', page: 12, audio: 'audio/en/s_013.mp3' },
    { en: 'I like colours.', cn: '', unit: 'u2', page: 12, audio: 'audio/en/s_014.mp3' },
    { en: "Let's draw a red apple.", cn: '', unit: 'u2', page: 13, audio: 'audio/en/s_015.mp3' },
    { en: 'OK.', cn: '', unit: 'u2', page: 13, audio: 'audio/en/s_016.mp3' },
    { en: "It's a fish.", cn: '', unit: 'u2', page: 15, audio: 'audio/en/s_017.mp3' },
    { en: "Let's colour it yellow.", cn: '', unit: 'u2', page: 15, audio: 'audio/en/s_018.mp3' },
    { en: 'We have a great picture!', cn: '', unit: 'u2', page: 17, audio: 'audio/en/s_019.mp3' },
    { en: 'The sun is yellow.', cn: '', unit: 'u2', page: 48, audio: 'audio/en/s_020.mp3' },
    /* U3 */
    { en: 'I can help.', cn: '', unit: 'u3', page: 19, audio: 'audio/en/s_021.mp3' },
    { en: 'I can feed the dog.', cn: '', unit: 'u3', page: 19, audio: 'audio/en/s_022.mp3' },
    { en: 'Can you feed the dog?', cn: '', unit: 'u3', page: 21, audio: 'audio/en/s_023.mp3' },
    { en: 'Yes, I can.', cn: '', unit: 'u3', page: 21, audio: 'audio/en/s_024.mp3' },
    { en: 'I can clean the floor.', cn: '', unit: 'u3', page: 20, audio: 'audio/en/s_025.mp3' },
    { en: 'I can clean the table.', cn: '', unit: 'u3', page: 20, audio: 'audio/en/s_026.mp3' },
    { en: 'Can you help?', cn: '', unit: 'u3', page: 22, audio: 'audio/en/s_027.mp3' },
    { en: 'Thank you!', cn: '', unit: 'u3', page: 25, audio: 'audio/en/s_028.mp3' },
    { en: 'I can help my mum.', cn: '', unit: 'u3', page: 19, audio: 'audio/en/s_029.mp3' },
    { en: 'I am big now.', cn: '', unit: 'u3', page: 19, audio: 'audio/en/s_030.mp3' },
    /* U4 */
    { en: "I'm happy! I'm happy!", cn: '', unit: 'u4', page: 27, audio: 'audio/en/s_031.mp3' },
    { en: "I'm sad.", cn: '', unit: 'u4', page: 27, audio: 'audio/en/s_032.mp3' },
    { en: "I'm tired.", cn: '', unit: 'u4', page: 27, audio: 'audio/en/s_033.mp3' },
    { en: "I'm angry.", cn: '', unit: 'u4', page: 27, audio: 'audio/en/s_034.mp3' },
    { en: "I'm hungry.", cn: '', unit: 'u4', page: 27, audio: 'audio/en/s_035.mp3' },
    { en: "Let's make her happy!", cn: '', unit: 'u4', page: 27, audio: 'audio/en/s_036.mp3' },
    { en: 'How do you feel?', cn: '', unit: 'u4', page: 28, audio: 'audio/en/s_037.mp3' },
    { en: "I'm happy.", cn: '', unit: 'u4', page: 28, audio: 'audio/en/s_038.mp3' },
    { en: "They're tired.", cn: '', unit: 'u4', page: 29, audio: 'audio/en/s_039.mp3' },
    { en: "We're happy.", cn: '', unit: 'u4', page: 29, audio: 'audio/en/s_040.mp3' },
    /* U5 */
    { en: 'I have a blue toy car.', cn: '', unit: 'u5', page: 35, audio: 'audio/en/s_041.mp3' },
    { en: 'I have a red toy boat.', cn: '', unit: 'u5', page: 35, audio: 'audio/en/s_042.mp3' },
    { en: "It's time to play.", cn: '', unit: 'u5', page: 35, audio: 'audio/en/s_043.mp3' },
    { en: "It's time to work.", cn: '', unit: 'u5', page: 35, audio: 'audio/en/s_044.mp3' },
    { en: 'I put them away!', cn: '', unit: 'u5', page: 35, audio: 'audio/en/s_045.mp3' },
    { en: "I have a car. It's red.", cn: '', unit: 'u5', page: 36, audio: 'audio/en/s_046.mp3' },
    { en: "I have a doll. It's orange.", cn: '', unit: 'u5', page: 36, audio: 'audio/en/s_047.mp3' },
    { en: 'I have a ball. I put it away.', cn: '', unit: 'u5', page: 36, audio: 'audio/en/s_048.mp3' },
    { en: "Let's put the doll away.", cn: '', unit: 'u5', page: 37, audio: 'audio/en/s_049.mp3' },
    { en: "Shh! It's my study time!", cn: '', unit: 'u5', page: 40, audio: 'audio/en/s_050.mp3' },
    /* Appendix 4 官方表达（p59，带官方中文） */
    { en: 'I see "two".', cn: '我看到了"two"。', unit: 'u1', page: 59, audio: 'audio/en/s_051.mp3' },
    { en: 'I see number 3.', cn: '我看到了数字3。', unit: 'u1', page: 59, audio: 'audio/en/s_052.mp3' },
    { en: 'The apple is red.', cn: '苹果是红色的。', unit: 'u2', page: 59, audio: 'audio/en/s_053.mp3' },
    { en: "Let's draw a red apple.", cn: '让我们画一个红色的苹果吧。', unit: 'u2', page: 59, audio: 'audio/en/s_054.mp3' },
    { en: 'I can clean the floor.', cn: '我可以扫地。', unit: 'u3', page: 59, audio: 'audio/en/s_055.mp3' },
    { en: 'Can you feed the dog?', cn: '你可以喂狗吗？', unit: 'u3', page: 59, audio: 'audio/en/s_056.mp3' },
    { en: "I'm happy.", cn: '我很高兴。', unit: 'u4', page: 59, audio: 'audio/en/s_057.mp3' },
    { en: "They're tired.", cn: '他们很疲劳。', unit: 'u4', page: 59, audio: 'audio/en/s_058.mp3' },
    { en: "I have a car. It's red.", cn: '我有一辆小汽车。它是红色的。', unit: 'u5', page: 59, audio: 'audio/en/s_059.mp3' },
    { en: 'I put my doll and ball away.', cn: '我把我的玩偶和球收起来。', unit: 'u5', page: 59, audio: 'audio/en/s_060.mp3' }
  ]
};
