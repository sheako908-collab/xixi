#!/usr/bin/env bash
# server/selftest.sh — 服务端自检：curl 走完 CONTRACT §3 关键链路
# 用法：bash server/selftest.sh
set -e
cd "$(dirname "$0")/.."

export PORT=18081
export DATA_DIR=/tmp/v3-selftest-data
rm -rf "$DATA_DIR"

node server/server.js > /tmp/v3-selftest-server.log 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 1.5

BASE=http://127.0.0.1:$PORT
TODAY=$(date +%F)
YESTERDAY=$(date -d "yesterday" +%F)

pass(){ echo "PASS: $1"; }
fail(){ echo "FAIL: $1"; kill $SRV 2>/dev/null; exit 1; }

echo "=== 1. GET /api/me（无 child 自动创建）==="
ME=$(curl -s "$BASE/api/me")
echo "$ME"
CHILD_ID=$(node -e "console.log(JSON.parse(process.argv[1]).child_id)" "$ME")
[ -n "$CHILD_ID" ] || fail "/api/me 未返回 child_id"
pass "/api/me child_id=$CHILD_ID"

echo "=== 2. POST /api/pages（math=30, en=9）==="
curl -s -X POST "$BASE/api/pages" -H 'Content-Type: application/json' \
  -d "{\"child_id\":$CHILD_ID,\"math_page\":30,\"en_page\":9}"
echo
PAGES=$(curl -s "$BASE/api/pages?child_id=$CHILD_ID")
echo "$PAGES"
echo "$PAGES" | grep -q '"math_page":30' || fail "pages 未生效"
pass "pages 生效"

echo "=== 3. GET /api/plan（math / english，各 50 slot）==="
for SUBJ in math english; do
  PLAN=$(curl -s "$BASE/api/plan?subject=$SUBJ&date=$TODAY&child_id=$CHILD_ID")
  N=$(node -e "const p=JSON.parse(process.argv[1]); console.log(p.slots.reduce((s,x)=>s+x.count,0))" "$PLAN")
  KINDS=$(node -e "const p=JSON.parse(process.argv[1]); const c={}; p.slots.forEach(s=>c[s.kind]=(c[s.kind]||0)+s.count); console.log(JSON.stringify(c))" "$PLAN")
  DIFFS=$(node -e "const p=JSON.parse(process.argv[1]); const d={}; p.slots.forEach(s=>{const k=s.kind+':'+s.difficulty; d[k]=(d[k]||0)+1;}); console.log(JSON.stringify(d))" "$PLAN")
  echo "$SUBJ: slots=$N kinds(count加权)=$KINDS kind:difficulty(slot数)=$DIFFS"
  [ "$N" = "50" ] || fail "$SUBJ plan slot 数=$N（期望 50）"
done
pass "plan 各 50 slot"

echo "=== 4. POST /api/attempt（批量写入：对/错/粗心/misconceptions/两天数据）==="
post_attempt(){
  curl -s -X POST "$BASE/api/attempt" -H 'Content-Type: application/json' -d "$1" > /dev/null
}
# math.u1.vert_add：10 道全对 → 应进入"掌握"
for i in $(seq 1 10); do
  post_attempt "{\"child_id\":$CHILD_ID,\"date\":\"$TODAY\",\"session_id\":\"s1\",\"instance_id\":\"m-add-$i\",\"kp_id\":\"math.u1.vert_add\",\"subject\":\"math\",\"type\":\"input\",\"difficulty\":2,\"kind\":\"new\",\"stem\":\"34+28=?\",\"answer\":\"62\",\"given_answer\":\"62\",\"correct\":true,\"time_ms\":8000,\"group_id\":\"g1\"}"
done
# math.u1.add_split：3 道错带 misconceptions 映射（进位遗漏）＋ 2 道错用时<3s（粗心）
for i in 1 2 3; do
  post_attempt "{\"child_id\":$CHILD_ID,\"date\":\"$TODAY\",\"session_id\":\"s1\",\"instance_id\":\"m-split-err-$i\",\"kp_id\":\"math.u1.add_split\",\"subject\":\"math\",\"type\":\"choice\",\"difficulty\":1,\"kind\":\"new\",\"stem\":\"47+8=?\",\"answer\":\"55\",\"given_answer\":\"54\",\"correct\":false,\"time_ms\":12000,\"group_id\":\"g1\",\"misconceptions\":{\"54\":\"进位遗漏\",\"53\":\"凑整出错（拆分法、凑整法）\"}}"
done
for i in 4 5; do
  post_attempt "{\"child_id\":$CHILD_ID,\"date\":\"$TODAY\",\"session_id\":\"s1\",\"instance_id\":\"m-split-fast-$i\",\"kp_id\":\"math.u1.add_split\",\"subject\":\"math\",\"type\":\"choice\",\"difficulty\":1,\"kind\":\"new\",\"stem\":\"36+7=?\",\"answer\":\"43\",\"given_answer\":\"42\",\"correct\":false,\"time_ms\":1800,\"group_id\":\"g1\"}"
done
# math.u1.add_split 再补 5 道对（共10道：5对5错 → 学习中，正确率50%）
for i in 6 7 8 9 10; do
  post_attempt "{\"child_id\":$CHILD_ID,\"date\":\"$TODAY\",\"session_id\":\"s1\",\"instance_id\":\"m-split-ok-$i\",\"kp_id\":\"math.u1.add_split\",\"subject\":\"math\",\"type\":\"choice\",\"difficulty\":1,\"kind\":\"new\",\"stem\":\"36+7=?\",\"answer\":\"43\",\"given_answer\":\"43\",\"correct\":true,\"time_ms\":6000,\"group_id\":\"g1\"}"
done
# math.u1.sub_mental：昨天 5 道 1 对（20%），今天 5 道 2 对（40%）→ 连续两天<60% → 重复错误
for i in 1 2 3 4 5; do
  C=false; [ "$i" = "1" ] && C=true
  post_attempt "{\"child_id\":$CHILD_ID,\"date\":\"$YESTERDAY\",\"session_id\":\"s0\",\"instance_id\":\"m-sub-y-$i\",\"kp_id\":\"math.u1.sub_mental\",\"subject\":\"math\",\"type\":\"input\",\"difficulty\":1,\"kind\":\"new\",\"stem\":\"52-7=?\",\"answer\":\"45\",\"given_answer\":\"45\",\"correct\":$C,\"time_ms\":9000,\"group_id\":\"g0\"}"
done
for i in 1 2 3 4 5; do
  C=false; [ "$i" -le 2 ] && C=true
  post_attempt "{\"child_id\":$CHILD_ID,\"date\":\"$TODAY\",\"session_id\":\"s1\",\"instance_id\":\"m-sub-t-$i\",\"kp_id\":\"math.u1.sub_mental\",\"subject\":\"math\",\"type\":\"input\",\"difficulty\":1,\"kind\":\"new\",\"stem\":\"52-7=?\",\"answer\":\"45\",\"given_answer\":\"45\",\"correct\":$C,\"time_ms\":9000,\"group_id\":\"g1\"}"
done
# english：5 道 4 对
for i in 1 2 3 4 5; do
  C=true; [ "$i" = "5" ] && C=false
  post_attempt "{\"child_id\":$CHILD_ID,\"date\":\"$TODAY\",\"session_id\":\"s2\",\"instance_id\":\"e-$i\",\"kp_id\":\"en.u1\",\"subject\":\"english\",\"type\":\"choice\",\"difficulty\":1,\"kind\":\"new\",\"stem\":\"hear: cat\",\"answer\":\"cat\",\"given_answer\":\"cat\",\"correct\":$C,\"time_ms\":5000,\"group_id\":\"ge1\"}"
done
pass "attempt 写入完成"

echo "=== 5. GET /api/mastery?subject=math ==="
curl -s "$BASE/api/mastery?subject=math&child_id=$CHILD_ID&date=$TODAY" | node -e "
const m=JSON.parse(require('fs').readFileSync(0,'utf8'));
m.forEach(x=>console.log(x.kp_id, x.status, 'rate='+x.rate, 'n='+x.attempts));"

echo "=== 6. GET /api/stats/today & /api/progress ==="
curl -s "$BASE/api/stats/today?date=$TODAY&child_id=$CHILD_ID"; echo
curl -s "$BASE/api/progress?date=$TODAY&child_id=$CHILD_ID"; echo

echo "=== 7. GET /api/errors（今日错题）==="
curl -s "$BASE/api/errors?date=$TODAY&child_id=$CHILD_ID" | node -e "
const e=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('今日错题数='+e.length);
console.log('示例:', JSON.stringify(e[0], null, 1).slice(0, 400));"

echo "=== 8. node server/summary.js --date=$TODAY ==="
node server/summary.js --date="$TODAY"

echo "=== 9. GET /api/summary/daily（应与 CLI 输出一致）==="
curl -s "$BASE/api/summary/daily?date=$TODAY&child_id=$CHILD_ID" | node -e "
const s=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('daily_summary:', s.daily_summary);
console.log('per_error 数:', s.per_error.length);
console.log('repeat_errors:', JSON.stringify(s.repeat_errors, null, 1));"

echo "=== 10. 周结：summary.js --weekly & /api/summary/weekly ==="
node server/summary.js --weekly --date="$TODAY" | node -e "
const s=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('weekly_summary:', s.weekly_summary);
console.log('repeat_errors 数:', s.repeat_errors.length);"
curl -s "$BASE/api/summary/weekly?date=$TODAY&child_id=$CHILD_ID" | node -e "
const s=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('API weekly ok:', !!s.weekly_summary);"

echo "=== 11. /api/export（json/csv 头）==="
curl -s "$BASE/api/export?format=json&child_id=$CHILD_ID" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('export attempts:', d.attempts.length, 'summaries:', d.summaries.length);"
curl -s "$BASE/api/export?format=csv&child_id=$CHILD_ID" | head -2

echo
echo "ALL SELFTEST DONE"
