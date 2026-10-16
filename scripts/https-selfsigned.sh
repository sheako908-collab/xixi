#!/bin/bash
# ============================================================
# 学习软件 v3 自签 HTTPS 一键脚本（包0）
# 在阿里云服务器上以 root 身份执行：
#   bash /opt/learn-app-v3/scripts/https-selfsigned.sh
# 做完后重启服务：systemctl restart learn-app-v3
# iPhone 端安装步骤见 scripts/HTTPS-IPHONE-SETUP.md
# ============================================================
set -e

APP=/opt/learn-app-v3
TLS=$APP/tls
IP=8.162.12.71
HTTPS_PORT=8443
DL_PORT=8080

command -v openssl >/dev/null || { echo "缺少 openssl，请先 apt install openssl"; exit 1; }
command -v python3 >/dev/null || { echo "缺少 python3"; exit 1; }

mkdir -p "$TLS"
cd "$TLS"

echo "[1/5] 生成本地 CA…"
openssl genrsa -out ca.key 2048 2>/dev/null
openssl req -x509 -new -nodes -key ca.key -sha256 -days 825 \
  -subj "/CN=LearnApp-Local-CA" -out ca.crt

echo "[2/5] 生成服务器证书（含 IP SAN）…"
openssl genrsa -out server.key 2048 2>/dev/null
openssl req -new -key server.key -subj "/CN=$IP" -out server.csr
printf "subjectAltName=IP:%s\n" "$IP" > san.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 825 -sha256 -extfile san.ext -out server.crt
rm -f server.csr san.ext ca.srl
chmod 600 server.key ca.key

echo "[3/5] 生成 iPhone 描述文件 ca.mobileconfig…"
CA_B64=$(base64 -w0 ca.crt)
UUID1=$(cat /proc/sys/kernel/random/uuid)
UUID2=$(cat /proc/sys/kernel/random/uuid)
cat > ca.mobileconfig <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadCertificateFileName</key><string>LearnApp-CA.crt</string>
      <key>PayloadContent</key><data>$CA_B64</data>
      <key>PayloadDescription</key><string>学习软件自签 CA 证书（录音功能需要 HTTPS）</string>
      <key>PayloadDisplayName</key><string>LearnApp Local CA</string>
      <key>PayloadIdentifier</key><string>com.learnapp.ca</string>
      <key>PayloadType</key><string>com.apple.security.root</string>
      <key>PayloadUUID</key><string>$UUID1</string>
      <key>PayloadVersion</key><integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key><string>学习软件 HTTPS 证书（录音功能用）</string>
  <key>PayloadDisplayName</key><string>LearnApp 证书</string>
  <key>PayloadIdentifier</key><string>com.learnapp.profile</string>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>$UUID2</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
EOF

echo "[4/5] 校验证书…"
openssl x509 -in server.crt -noout -subject -ext subjectAltName

echo ""
echo "============================================================"
echo "证书已生成：$TLS/{ca.crt,server.crt,server.key,ca.mobileconfig}"
echo ""
echo "接下来的步骤（按顺序）："
echo " 1) 安全组放行 $HTTPS_PORT 和 $DL_PORT 端口（$DL_PORT 只是临时下载证书用）"
echo " 2) 重启服务：systemctl restart learn-app-v3"
echo "    看到 'HTTPS listening on :$HTTPS_PORT' 即成功"
echo " 3) 本脚本启动临时下载服务 10 分钟，供 iPhone 下载证书："
echo "    iPhone Safari 打开 http://$IP:$DL_PORT/ca.mobileconfig"
echo "    详细安装步骤见 scripts/HTTPS-IPHONE-SETUP.md"
echo " 4) 证书装好后，iPhone 用 https://$IP:$HTTPS_PORT 打开（首次点\"显示详细信息→访问此网站\"）"
echo " 5) 10 分钟后临时下载服务自动关闭；如需重新下载，单独跑："
echo "    cd $TLS && python3 -m http.server $DL_PORT"
echo "============================================================"
echo ""
echo "[5/5] 启动临时下载服务（10 分钟）…"
python3 -m http.server "$DL_PORT" --directory "$TLS" >/dev/null 2>&1 &
SRV=$!
echo "下载地址：http://$IP:$DL_PORT/ca.mobileconfig"
sleep 600
kill $SRV 2>/dev/null || true
echo "临时下载服务已关闭。"
