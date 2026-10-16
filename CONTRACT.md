# app-v3 集成契约（所有子代理必读，以此为准）

> 目标：按设计文档从零重做儿童学习软件，部署到阿里云 8081 端口。
> 设计文档：~/workspace/user/files/upload.md（总设计）、~/workspace/user/files/upload-2.md（内容与题库）
> UI：~/workspace/goals/goal-2/hidden_files/UI原型-高保真.jpg ＋ UI设计总纲.md
> 英语数据源：~/workspace/goals/goal-2/hidden_files/英语课本全量提取.md
> 数学骨架：~/workspace/goals/goal-2/hidden_files/新版课本全书方法清单.md

## 0. 铁律
- 新目录 `~/workspace/goals/goal-2/app-v3/`，绝不动 `app-v2/`。
- 答题链路**绝不调用 AI**。判分、统计全部由程序完成。
- 孩子端**不显示正确率/百分比**。
- 所有 JS 必须 `node --check` 通过。

## 1. 目录与分工（防冲突）

```
app-v3/
  CONTRACT.md
  package.json                      ← server 负责（express 依赖）
  public/
    index.html                      ← child-ui 负责（shell）
    css/base.css                    ← child-ui 负责（变量、reset、通用）
    css/child.css                   ← child-ui 负责
    css/parent.css                  ← parent-ui 负责
    js/app.js                       ← child-ui 负责（模式路由：child 默认；家长入口→PIN→parent）
    js/api.js                       ← child-ui 负责（fetch 封装，见 §3）
    js/child.js                     ← child-ui 负责（孩子端4页）
    js/parent.js                    ← parent-ui 负责（家长端4页）
    js/kp-map.js                    ← engine 负责（知识点映射，独立配置，见 §5）
    js/engine.js                    ← engine 负责（出题引擎，见 §6）
    js/math-bank.js                 ← engine 负责（数学题模板）
    js/en-data.js                   ← engine 负责（英语词句数据，见 §7）
    js/en-bank.js                   ← engine 负责（英语题模板）
    img/fox.png                     ← 协调人负责（吉祥物）
    img/fox-cheer.png / fox-think.png ← 协调人负责（可选）
    audio/en/*.mp3                  ← audio 负责
    audio/manifest.json             ← audio 负责（见 §8）
  server/
    server.js                       ← server 负责（Express，见 §3）
    db.js                           ← server 负责（sqlite，见 §4）
    summary.js                      ← server 负责（日结/周结 CLI，见 §9）
```

- `window.KP_MAP`（kp-map.js）、`window.ENGINE`（engine.js）、`window.MATH_BANK`、`window.EN_DATA`、`window.EN_BANK` 挂全局。
- 所有前端 JS 用 ES5 语法（var，无 import），直接 `<script>` 引入，保证 iPhone Safari 兼容。

## 2. 配色与字体（严格按原型）
- 主色 `#FFC857`，背景 `#FFF8E1`，文字 `#48463D`，次要文字 `#8D6E32`，成功 `#7ED321`
- 孩子端：暖黄主题，大圆角（≥16px），正文 ≥24px，按钮点击区 ≥56px
- 家长端：浅灰底 `#F5F5F4` 系＋蓝色数据色 `#2E7CF6` 系，字号 16px 起，卡片分区，条形图/进度条
- 错题反馈**不用红色**：用温和的橙色/灰色展示正确答案

## 3. API 契约（server 实现，前端按此调用，同源，无需 baseURL）

```
POST /api/setup        {pin} → {ok}                       # 首次设置家长 PIN（可为空）
POST /api/auth         {pin} → {ok, role}                  # role: parent|child；child 无需 PIN
GET  /api/pages        → {math_page, en_page}              # 家长输入的"学到第 N 页"
POST /api/pages        {math_page, en_page} → {ok}         # 家长端设置
GET  /api/plan?subject=math|english&date=YYYY-MM-DD
     → {slots:[{kp_id, count, difficulty, kind}]}          # kind: new|weak|review；共50个 slot
POST /api/attempt       body=attempt对象(§6) → {ok}
GET  /api/progress?date= → {math:{done,total:50,groups_done}, english:{...}}
GET  /api/stats/today?date= → {math:{done,correct_rate,new_errors,minutes}, english:{...}}
GET  /api/stats/week?date=  → {days:[{date, math_done, en_done, correct_rate}], ...}
GET  /api/mastery?subject=  → [{kp_id, name, unit, status, rate, attempts}]
GET  /api/kps?subject=      → [{kp_id, name, unit, pages, status}]   # 知识点地图用
GET  /api/errors?date=      → [{同 attempt ＋ stem 快照}]             # 今日错题
GET  /api/errors?week=1&date= → 本周错题
GET  /api/summary/daily?date=   → {per_error, daily_summary, repeat_errors} | null
GET  /api/summary/weekly?date=  → {...} | null
GET  /api/export?format=json|csv → 下载全部作答记录（家长设置页）
```

- 认证：localStorage 存 `v3_child_id`；server 首次访问自动创建 child（单孩子，名字默认"宝宝"，家长端可改）。
- date 格式统一 `YYYY-MM-DD`（客户端本地日期）。

## 4. 数据模型（server/sqlite）
表：`children(id, name, pin, math_page, en_page, created_at)`
表：`attempts(id, child_id, date, session_id, instance_id, template_id, template_version, kp_id, subject, type, difficulty, kind, stem, answer, given_answer, correct, time_ms, is_retry, step, group_id, created_at)`
表：`summaries(id, child_id, kind, period, content_json, created_at)` — kind: daily|weekly
- 优先用 `node:sqlite`（Node 22 内置）；若不可用，降级为 JSON 文件存储（接口不变）。

## 5. 知识点映射 kp-map.js（engine 负责，独立配置文件）
```js
window.KP_MAP = {
  math: { units: [ {id:'u1', name:'100以内加减(二)', pages:[2,19], kps:[
      {id:'math.u1.add_split', name:'拆分法/凑整法口算', pages:[2,3]},
      {id:'math.u1.vert_add', name:'竖式进位加', pages:[4,5]},
      {id:'math.u1.sub_mental', name:'退位减口算', pages:[6,7]},
      {id:'math.u1.vert_sub', name:'竖式退位减', pages:[8,9]},
      {id:'math.u1.line_compare', name:'线段图比多比少', pages:[10,11]},
      {id:'math.u1.word_2step', name:'两步应用', pages:[13,14]},
      {id:'math.u1.review', name:'整理复习', pages:[15,15]}
    ]}, ... u2-u8 按 upload-2.md §4 ＋方法清单.md ],
  english: { units:[ {id:'u1', name:'Unit 1', pages:[2,9]}, ... u2 p10-17, u3 p18-25, u4 p26-33, u5 p34-41 ] }
}
```
- 数学 u2–u8 的 KP 划分以 upload-2.md §4 表为准（页码用方法清单.md 的新版页码校准）。
- 英语 KP 以 Unit 为单位（en.u1…en.u5），题型见 §7。

## 6. 出题引擎 engine.js（engine 负责）
`ENGINE.generate(subject, slots, opts)` → question[]（共50道）。
- 每道题从对应 kp 的模板随机取数生成；**答案由程序计算**，不用手写。
- 同一 KP 一天 ≤8 道；题型打散（连续两道不相同题型）；每组 10 道开头 2 道较易。
- 7 天内 instance 不重复（用 values 签名去重，内存 Set 即可）。
- question 对象：
```js
{instance_id, template_id, template_version, kp_id, subject, type, difficulty, kind,
 stem, speak, options /*数组或null*/, answer /*字符串*/, accept /*等价答案数组*/,
 audio /*'audio/en/w_one.mp3'或null*/, misconceptions /*{选项值:错因标签}*/,
 solution /*家长端解题步骤*/, values, step /*两步应用题 1|2*/, group_id}
```
- attempt 对象 = question 快照子集 ＋ {given_answer, correct, time_ms, is_retry, date, session_id}。
- 应用题两步作答：step1 选算式（type:'choice'，含常见错误算式选项），step2 填答案（type:'input'）；两题共享 group_id，先后出现。
- 判分：精确比较；乘法交换律等价答案走 accept；用时只做诊断参考。

## 7. 英语数据 en-data.js（engine 负责）
- 从《英语课本全量提取.md》取：官方32词（带课本官方中文）＋正文36扩展词；句子取核心句（每单元对话/chant/song关键句＋Appendix 4 的10句官方表达）。
- **不要继承 en-units.js 的错误**：删 `I am big and fast.`/`We learn, read and say.`；`colour` 只用复数；中文只用课本官方中文，其余标"（图）"或不配中文。
- 格式：`window.EN_DATA = {words:[{en,cn,unit,pic}], sentences:[{en,unit,page,audio}], page2unit:{...}}`
- 8 题型（en-bank.js 实现）：听音选词 / 听音选图 / 看图选词·英选中·中选英 / 听音拼词 / 补字母 / 句子排序 / 听句选意思 / 跟读（自评"读了"，不判分）。

## 8. 音频（audio 负责）
- `public/audio/en/w_<word>.mp3`（单词，文件名用英文小写下划线），`s_<nnn>.mp3`（句子）。
- `manifest.json`：`{"<en文本>": "audio/en/w_one.mp3", ...}`，键为英文原文。
- 前端播放逻辑：先查 manifest 有文件就播 `<audio>`，没有才用 speechSynthesis 兜底。
- 发音人全书统一（tts 用同一个 voice）。

## 9. 日结/周结（server 负责）
- `node server/summary.js --date=YYYY-MM-DD` 生成日结 JSON 存 summaries 表；`--weekly` 生成周结。
- **今晚用规则版**：按固定错因清单（upload.md §4.5）做归因——优先用题目自带的 misconceptions 映射；启发式：用时极短+错→"粗心"；同一 KP 当天错 ≥2→ 记入候选重复错误。
- 输出结构（upload.md §9.3）：`{per_error:[{question_id,cause_tag,note,confidence}], daily_summary, repeat_errors:[{cause_tag,kp_id,evidence_question_ids,parent_action,next_day_drill_hint}], weekly_summary?}`。
- 重复错误判定由程序做：同一 cause_tag 一周 ≥3 次，或同一 KP 连续 2 天未达标。
- 预留以后换真 AI 的接口：summary.js 内 `function aiSummarize()` 桩，规则版叫 `ruleSummarize()`。

## 10. 孩子端页面（child-ui 负责，按原型图）
1. 首页：狐狸＋"今天也来闯关啦！""准备好了吗？"；数学/英语两个进度卡（各 x/50，组 0-5/5）；"开始今天的任务"→进入未完成科目答题。
2. 答题页：顶栏"数学·第13题"＋"本组 3/10"＋点读按钮；题干大字；选择题→大按钮（点即朗读该选项，读完判分）；计算/填空→底部数字键盘（**高度锁死**，1-9/0/退格/✓，光标从右框起）；答对 1.4s 自动下一题；答错→温和展示正确答案并朗读（不用红色），停留 2-3s 下一题。
3. 组间休息页：每 10 道后出现，"这一关完成啦！"＋星星；"继续下一组"／"退出，稍后再来"（进度保留）。
4. 完成页：单科 50 道完成后出现，"今天的任务完成！"50/50，5/5组，星星；两科都完成显示总完成。
- 一屏一题，iPhone SE（375×667）不滚动；键盘不遮挡题目。

## 11. 家长端页面（parent-ui 负责，按原型图＋总纲）
- 入口：孩子端首页角落"家长"→PIN 键盘→parent.js 接管 #app；底部 nav：今日/本周/知识点地图/设置。
- 今日：数学/英语页码输入（1-102 校验，英语 1-67）、完成情况、正确率、新增错题数、用时、AI 日结卡。
- 本周：7 天学习概览条形图、重复错误清单（错因标签＋一句话＋证据题号**点开展示原题/标准答案/孩子答案**＋"今晚可以这样做"10分钟动作）。
- 知识点地图：按单元分组，KP 格子状态（颜色＋图标：未学/学习中/掌握/巩固），点开看作答历史。
- 设置：孩子名字、PIN 修改、通知方式（占位）、数据导出（调 /api/export）、多孩子管理（占位"即将推出"）。

## 12. 验收标准
- `node --check` 全过；`curl` 每个页面/API 200；完整流程走通。
- iPhone SE 尺寸一屏不滚动。
- 部署后线上文件与本地 diff 一致；8080 旧服务不受影响。
