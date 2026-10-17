#!/usr/bin/env bash
set -euo pipefail

PORT=8765

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$ROOT_DIR/site"
STATE_DIR="$ROOT_DIR/.server"
PID_FILE="$STATE_DIR/http.pid"
LOG_FILE="$STATE_DIR/http.log"
URL="http://localhost:$PORT/"

usage() {
  cat <<EOF
Usage:
  ./serve.sh                 Start server in foreground on $URL
  ./serve.sh start           Start server in foreground on $URL
  ./serve.sh start --bg      Start server in background
  ./serve.sh bg              Start server in background
  ./serve.sh stop            Stop background/managed server
  ./serve.sh restart         Restart in foreground
  ./serve.sh restart --bg    Restart in background
EOF
}

read_pid() {
  if [[ -f "$PID_FILE" ]]; then
    cat "$PID_FILE"
  fi
}

is_running() {
  local pid
  pid="$(read_pid || true)"
  [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null
}

port_owner() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

ensure_free() {
  local pid
  if is_running; then
    echo "Server already running at $URL (PID $(read_pid))"
    exit 0
  fi

  rm -f "$PID_FILE"
  pid="$(port_owner)"
  if [[ -n "$pid" ]]; then
    echo "Port $PORT is already in use by PID $pid"
    exit 1
  fi
}

start_bg() {
  ensure_free
  mkdir -p "$STATE_DIR"

  local pid
  pid="$(
    python3 - "$PORT" "$SITE_DIR" "$LOG_FILE" <<'PY'
import subprocess
import sys

port, site_dir, log_file = sys.argv[1:4]
with open(log_file, 'ab', buffering=0) as log:
    proc = subprocess.Popen(
        [sys.executable, '-m', 'http.server', port, '-d', site_dir],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )
print(proc.pid)
PY
  )"
  echo "$pid" >"$PID_FILE"
  sleep 0.5

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Failed to start server. Log:"
    cat "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi

  echo "Serving $SITE_DIR at $URL"
  echo "PID: $pid"
  echo "Log: $LOG_FILE"
}

start_foreground() {
  ensure_free
  mkdir -p "$STATE_DIR"

  python3 -m http.server "$PORT" -d "$SITE_DIR" &
  local pid=$!
  echo "$pid" >"$PID_FILE"

  cleanup() {
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  }
  trap cleanup EXIT INT TERM

  echo "Serving $SITE_DIR at $URL"
  echo "Press Ctrl-C to stop."
  wait "$pid"
}

stop_server() {
  local pid
  pid="$(read_pid || true)"

  if [[ -z "${pid:-}" ]]; then
    echo "No managed server is running."
    return 0
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Removed stale PID file."
    return 0
  fi

  kill "$pid"
  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "Stopped server on $URL"
      return 0
    fi
    sleep 0.1
  done

  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Stopped server on $URL"
}

command="${1:-start}"
background="false"

case "$command" in
  bg)
    command="start"
    background="true"
    ;;
  start|restart)
    if [[ "${2:-}" == "--bg" || "${2:-}" == "bg" ]]; then
      background="true"
    elif [[ -n "${2:-}" ]]; then
      usage
      exit 1
    fi
    ;;
  stop)
    if [[ -n "${2:-}" ]]; then
      usage
      exit 1
    fi
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    usage
    exit 1
    ;;
esac

case "$command" in
  start)
    if [[ "$background" == "true" ]]; then
      start_bg
    else
      start_foreground
    fi
    ;;
  stop)
    stop_server
    ;;
  restart)
    stop_server
    if [[ "$background" == "true" ]]; then
      start_bg
    else
      start_foreground
    fi
    ;;
esac
