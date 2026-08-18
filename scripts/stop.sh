#!/usr/bin/env bash
set -euo pipefail
PID_FILE=/mnt/dados/projetos/appsbox-conv-documentos/.run/counter.pid
if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")
  if [[ "$pid" =~ ^[0-9]+$ ]] && [[ -r "/proc/$pid/cmdline" ]] && tr '\0' ' ' < "/proc/$pid/cmdline" | grep -Fq '/appsbox-conv-documentos/backend/counter.py'; then kill "$pid" || true; fi
  rm -f "$PID_FILE"
fi
