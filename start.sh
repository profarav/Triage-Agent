#!/bin/bash
set -e

# ── Zello Triage Agent — start script ─────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Check API key
if [ ! -f "$ROOT/backend/.env" ]; then
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo ""
    echo "  ERROR: No API key found."
    echo "  Create backend/.env with:  ANTHROPIC_API_KEY=your-key"
    echo "  Or export ANTHROPIC_API_KEY in your shell."
    echo ""
    exit 1
  fi
fi

echo ""
echo "  ⬡  Zello Support Triage"
echo "  ─────────────────────────"

# Start backend
echo "  → Starting backend (Flask)..."
cd "$ROOT/backend"
pip3 install --break-system-packages -q -r requirements.txt
python app.py &
BACKEND_PID=$!

# Start frontend
echo "  → Starting frontend (Vite)..."
cd "$ROOT/frontend"
npm install --silent
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  ✓  Backend  →  http://localhost:5001"
echo "  ✓  Frontend →  http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# Cleanup on exit
trap "echo ''; echo '  Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
