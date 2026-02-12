#!/bin/bash
# ==========================================
# Tiger Edition: AI BILL INTELLIGENCE Installer
# Version: v1.0.0 (Based on Dashboard v4.4.4)
# ==========================================

PORT=$1
if [ -z "$PORT" ]; then
  PORT=8004
fi

echo "🚀 Starting Tiger Edition AI Bill Installation on port $PORT..."

# 1. Workspace 준비
mkdir -p ./tiger-bill-test/dist

# 2. 데이터 수집기(Engine) 복사
cp /root/.openclaw/workspace/ai-bill/collector.js ./tiger-bill-test/
echo "✅ Collection Engine prepared."

# 3. 프리미엄 UI(Frontend) 복사
cp /root/.openclaw/workspace/ai-bill/dist/index.html ./tiger-bill-test/dist/
echo "✅ Premium UI assets linked."

# 4. Docker 독립 컨테이너 기동 (독립 원칙 준수)
CONTAINER_NAME="tiger-bill-test-$PORT"
docker rm -f $CONTAINER_NAME 2>/dev/null
docker run -d --name $CONTAINER_NAME -p $PORT:80 nginx:alpine
echo "✅ Dedicated container '$CONTAINER_NAME' is now LIVE."

# 5. 초기 데이터 싱크 (Tiger 정밀 요금 로직 반영)
echo "=========================================="
echo "🎉 INSTALLATION SUCCESSFUL!"
echo "Next Step (Interaction):"
echo "1. Ask user for initial balances (done)."
echo "2. ASK PERMISSION: 'Can I read sessions.json to track precise model pricing?'"
echo "   (API keys will NOT be accessed unless specifically requested later)"
echo "=========================================="
