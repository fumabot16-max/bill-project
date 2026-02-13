#!/bin/bash

# AI Bill Intelligence - One-line Installer
# Usage: curl -fsSL [URL] | bash

set -e

echo "🤖 AI Bill Intelligence Installer"
echo "=================================="
echo ""

# 1. Create directory
SKILL_DIR="$HOME/.openclaw/skills/ai-bill-intelligence"
mkdir -p "$SKILL_DIR"
cd "$SKILL_DIR"

# 2. Download from GitHub
echo "📥 Downloading..."
if command -v wget &> /dev/null; then
    wget -q https://github.com/fumabot16-max/project-bill/archive/refs/heads/master.zip -O master.zip
elif command -v curl &> /dev/null; then
    curl -fsSL https://github.com/fumabot16-max/project-bill/archive/refs/heads/master.zip -o master.zip
else
    echo "❌ Error: wget or curl required"
    exit 1
fi

# 3. Extract
echo "📦 Extracting..."
unzip -q master.zip
mv project-bill-master/* .
mv project-bill-master/.* . 2>/dev/null || true
rm -rf project-bill-master master.zip

# 4. Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# 5. Run setup
echo ""
echo "⚙️  Configuration"
echo "----------------"
node setup.js

# 6. Setup systemd services
echo ""
echo "🚀 Setting up services..."
if command -v systemctl &> /dev/null; then
    sudo cp systemd/*.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable ai-bill ai-bill-collector
    sudo systemctl start ai-bill ai-bill-collector
    echo "✅ Services started!"
else
    echo "⚠️  systemctl not found. Please start manually:"
    echo "   node server.js &"
    echo "   node collector.js &"
fi

echo ""
echo "=================================="
echo "✅ Installation Complete!"
echo "=================================="
echo ""
echo "🌐 Dashboard: http://localhost:8003"
echo ""
echo "Check status:"
echo "   systemctl status ai-bill ai-bill-collector"
echo ""
echo "View logs:"
echo "   journalctl -u ai-bill-collector -f"
echo ""
