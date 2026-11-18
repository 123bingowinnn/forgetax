#!/bin/bash
# 双击运行：启动本地服务器并在浏览器中打开《铸剑大师》
cd "$(dirname "$0")"
PORT=8765
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html"; then
  python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
  sleep 1
fi
open "http://127.0.0.1:$PORT/index.html"
