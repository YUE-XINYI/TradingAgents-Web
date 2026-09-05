#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/yue/TradingAgents"
WEB_DIR="$PROJECT_DIR/web"

cd "$WEB_DIR"

conda run --no-capture-output -n tradingagents \
  uvicorn backend.app:app --host 127.0.0.1 --port 8000 &
API_PROCESS_ID=$!

npm run dev &
WEB_PROCESS_ID=$!

cleanup() {
  kill "$API_PROCESS_ID" "$WEB_PROCESS_ID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo ""
echo "认知交易舱正在启动："
echo "  Web: http://localhost:3000"
echo "  API: http://127.0.0.1:8000"
echo ""
echo "按 Ctrl+C 停止服务。"

wait "$WEB_PROCESS_ID"
