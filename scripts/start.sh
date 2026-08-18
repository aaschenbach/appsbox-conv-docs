#!/usr/bin/env bash
set -euo pipefail
ROOT=/mnt/dados/projetos/appsbox-conv-documentos
RUN="$ROOT/.run"
mkdir -p "$RUN"
if [[ -f "$RUN/counter.pid" ]]; then
  pid=$(cat "$RUN/counter.pid")
  if [[ "$pid" =~ ^[0-9]+$ ]] && [[ -r "/proc/$pid/cmdline" ]] && tr '\0' ' ' < "/proc/$pid/cmdline" | grep -Fq '/appsbox-conv-documentos/backend/counter.py'; then exit 0; fi
fi
setsid /usr/bin/python3 "$ROOT/backend/counter.py" > "$RUN/counter.log" 2>&1 < /dev/null &
echo "$!" > "$RUN/counter.pid"
sleep 1
curl --fail --silent http://127.0.0.1:9700/health >/dev/null
