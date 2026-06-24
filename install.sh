#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/Mr-Mayank-Sharma/flowmind.git"
INSTALL_DIR="${FLOWMIND_DIR:-$HOME/.flowmind}"
NODE_MIN="22"
PG_VERSION="16"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
err()  { echo -e "  ${RED}✗${NC} $1"; exit 1; }
cmd()  { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "  ${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "  ${CYAN}║${NC}      FlowMind AI OS Installer       ${CYAN}║${NC}"
echo -e "  ${CYAN}║${NC}   One command to run AI everywhere   ${CYAN}║${NC}"
echo -e "  ${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Detect OS ──────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Linux)  OS="linux" ;;
  Darwin) OS="darwin" ;;
  *)      err "Unsupported OS: $OS" ;;
esac
log "Detected $OS ($ARCH)"

# ── Check prerequisites ─────────────────────────────────────────────
cmd "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  warn "Node.js not found. Installing via nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install "$NODE_MIN"
  nvm use "$NODE_MIN"
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt "$NODE_MIN" ]; then
  err "Node.js v$NODE_MIN+ required (found v$(node -v))"
fi
log "Node.js $(node -v)"

if ! command -v pnpm &>/dev/null; then
  cmd "Installing pnpm..."
  npm install -g pnpm@9
fi
log "pnpm $(pnpm -v)"

if ! command -v git &>/dev/null; then
  err "git is required. Install it first."
fi

# ── Install Ollama ──────────────────────────────────────────────────
if ! command -v ollama &>/dev/null; then
  cmd "Installing Ollama..."
  if [ "$OS" = "linux" ]; then
    curl -fsSL https://ollama.com/install.sh | sh
  elif [ "$OS" = "darwin" ]; then
    warn "Download Ollama from https://ollama.com/download"
  fi
fi

if command -v ollama &>/dev/null; then
  log "Ollama $(ollama --version 2>/dev/null || echo 'installed')"
  if ! pgrep -x ollama &>/dev/null; then
    cmd "Starting Ollama server..."
    ollama serve > /dev/null 2>&1 &
    disown
    sleep 2
  fi
fi

# ── Install PostgreSQL ──────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
  cmd "Installing PostgreSQL..."
  if [ "$OS" = "linux" ]; then
    if command -v apt-get &>/dev/null; then
      sudo apt-get update -qq && sudo apt-get install -y -qq postgresql postgresql-client
      sudo systemctl start postgresql
    elif command -v dnf &>/dev/null; then
      sudo dnf install -y postgresql-server postgresql-contrib
      sudo postgresql-setup --initdb
      sudo systemctl start postgresql
    fi
  fi
fi

if command -v psql &>/dev/null; then
  log "PostgreSQL $(psql --version | head -1)"
  sudo -u postgres psql -c "CREATE USER flowmind WITH PASSWORD 'flowmind' CREATEDB;" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE DATABASE flowmind OWNER flowmind;" 2>/dev/null || true
fi

# ── Clone / Update ──────────────────────────────────────────────────
if [ -d "$INSTALL_DIR" ]; then
  if [ -d "$INSTALL_DIR/.git" ]; then
    cmd "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --ff-only
  else
    warn "~/.flowmind exists but is not a git repo. Removing and re-cloning..."
    rm -rf "$INSTALL_DIR"
    cmd "Cloning FlowMind..."
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
else
  cmd "Cloning FlowMind..."
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── Install dependencies ────────────────────────────────────────────
cmd "Installing dependencies..."
pnpm install

# ── Clean stale caches ──────────────────────────────────────────────
cmd "Cleaning stale build caches..."
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true
rm -rf apps/web/.next 2>/dev/null || true

# ── Build packages ──────────────────────────────────────────────────
cmd "Building packages..."
pnpm db:generate
pnpm build

# ── Database setup ──────────────────────────────────────────────────
cmd "Setting up database..."
DATABASE_URL="postgresql://flowmind:flowmind@localhost:5432/flowmind"
export DATABASE_URL

pnpm db:migrate 2>/dev/null || warn "DB migration skipped (manual: pnpm db:migrate)"
pnpm db:seed 2>/dev/null || warn "DB seed skipped (manual: pnpm db:seed)"

# ── Build Next.js for standalone ────────────────────────────────────
cmd "Building Next.js standalone..."
pnpm --filter @flowmind/web build 2>/dev/null || warn "Web build skipped"

# ── CLI link ────────────────────────────────────────────────────────
cmd "Linking CLI..."
pnpm --filter @flowmind/cli build 2>/dev/null || true
npm link --silent 2>/dev/null || true
if command -v flowmind &>/dev/null; then
  log "CLI available: flowmind"
fi

# ── Desktop app (optional) ──────────────────────────────────────────
if command -v electron &>/dev/null; then
  cmd "Building desktop app..."
  cd "$INSTALL_DIR/apps/desktop"
  npm install --silent 2>/dev/null || true
  npx electron-builder --linux --config.extraMetadata.main=main.js 2>/dev/null || warn "Desktop build skipped (run: cd apps/desktop && npm run build)"
  log "Desktop app built"
fi

# ── Create desktop entry (Linux) ────────────────────────────────────
if [ "$OS" = "linux" ]; then
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/flowmind.desktop" << DESKTOP
[Desktop Entry]
Name=FlowMind AI OS
Comment=Open-source AI Operating System
Exec=$INSTALL_DIR/flowmind.sh
Icon=$INSTALL_DIR/apps/desktop/public/icon.svg
Terminal=false
Type=Application
Categories=Utility;Development;AI;
StartupWMClass=flowmind
DESKTOP
  chmod +x "$HOME/.local/share/applications/flowmind.desktop"
  log "Desktop shortcut created"
fi

# ── Python runtime ──────────────────────────────────────────────────
cmd "Setting up Python agent runtime..."
cd "$INSTALL_DIR/packages/agent-runtime"
pip3 install -e ".[all]" 2>/dev/null || pip3 install fastapi uvicorn sse-starlette httpx 2>/dev/null || warn "Python deps partial (check docs)"

# ── Create systemd services ─────────────────────────────────────────
if [ "$OS" = "linux" ] && command -v systemctl &>/dev/null; then
  cmd "Installing systemd services..."
  cd "$INSTALL_DIR"

  sudo tee /etc/systemd/system/flowmind-api.service > /dev/null <<SVC
[Unit]
Description=FlowMind AI API Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which pnpm) --filter @flowmind/api dev
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=DATABASE_URL=${DATABASE_URL}

[Install]
WantedBy=multi-user.target
SVC

  sudo tee /etc/systemd/system/flowmind-web.service > /dev/null <<SVC
[Unit]
Description=FlowMind AI Web UI
After=network.target flowmind-api.service
Wants=flowmind-api.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which pnpm) --filter @flowmind/web start --port 3000
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SVC

  sudo tee /etc/systemd/system/flowmind-runtime.service > /dev/null <<SVC
[Unit]
Description=FlowMind Python Agent Runtime
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${INSTALL_DIR}/packages/agent-runtime
ExecStart=$(which python3) -m uvicorn src.main:app --host 127.0.0.1 --port 8001
Restart=on-failure
RestartSec=5
Environment=PYTHONPATH=${INSTALL_DIR}/packages/agent-runtime

[Install]
WantedBy=multi-user.target
SVC

  sudo systemctl daemon-reload
  sudo systemctl enable flowmind-runtime.service 2>/dev/null || true
  log "systemd services installed"
fi

# ── Create handy launcher scripts ────────────────────────────────────
cat > "$INSTALL_DIR/flowmind.sh" << 'LAUNCHER'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       FlowMind AI OS Launcher        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check if desktop app is available
DESKTOP_APP="$DIR/apps/desktop/node_modules/.bin/electron"
if [ -f "$DESKTOP_APP" ] && command -v Xorg &>/dev/null; then
  echo "  Starting Desktop App..."
  nohup "$DESKTOP_APP" "$DIR/apps/desktop" > /tmp/flowmind-desktop.log 2>&1 &
  echo "  Desktop app launched. Look for FlowMind in your system tray."
  exit 0
fi

echo "  Starting web-based FlowMind..."
nohup pnpm --filter @flowmind/api dev > /tmp/flowmind-api.log 2>&1 &
echo "  API server starting on :3001"
nohup pnpm --filter @flowmind/web dev --port 3000 > /tmp/flowmind-web.log 2>&1 &
echo "  Web UI starting on :3000"
nohup python3 -m uvicorn src.main:app --host 127.0.0.1 --port 8001 > /tmp/flowmind-runtime.log 2>&1 &
echo "  Agent runtime starting on :8001"
echo ""
echo "  Open your browser to: http://localhost:3000"
echo "  Login: admin@flowmind.ai / admin123"
echo "  CLI:   flowmind"
echo ""
LAUNCHER
chmod +x "$INSTALL_DIR/flowmind.sh"

# ── Desktop App standalone launcher ──────────────────────────────────
cat > "$INSTALL_DIR/flowmind-desktop.sh" << 'DESKTOP_LAUNCHER'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON="$DIR/apps/desktop/node_modules/.bin/electron"
if [ -f "$ELECTRON" ]; then
  exec "$ELECTRON" "$DIR/apps/desktop"
else
  echo "Desktop app not built. Install deps first:"
  echo "  cd $DIR/apps/desktop && npm install"
  echo "Then run: flowmind-desktop.sh"
  exit 1
fi
DESKTOP_LAUNCHER
chmod +x "$INSTALL_DIR/flowmind-desktop.sh"

# ── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "  ${GREEN}║${NC}      FlowMind AI OS Installed!       ${GREEN}║${NC}"
echo -e "  ${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Access Points:${NC}"
echo -e "    Web UI:    ${CYAN}http://localhost:3000${NC}"
echo -e "    API:       ${CYAN}http://localhost:3001${NC}"
echo -e "    Runtime:   ${CYAN}http://localhost:8001${NC}"
echo -e "    CLI:       ${CYAN}flowmind${NC}"
echo ""
echo -e "  ${CYAN}Quick Start:${NC}"
echo -e "    ${YELLOW}1.${NC} Start services:  cd ~/.flowmind && bash flowmind.sh"
echo -e "    ${YELLOW}2.${NC} Open browser:    http://localhost:3000"
echo -e "    ${YELLOW}3.${NC} Login:           admin@flowmind.ai / admin123"
echo -e "    ${YELLOW}4.${NC} Use CLI:         flowmind chat start"
echo -e "    ${YELLOW}5.${NC} Manage models:   flowmind model list"
echo ""
echo -e "  ${YELLOW}Default login: admin@flowmind.ai / admin123${NC}"
echo ""
