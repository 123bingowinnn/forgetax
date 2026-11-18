#!/bin/bash
# 用法: tools/shot.sh <相对路径或URL片段> <输出png> [宽=1280] [高=720] [虚拟时间ms=4000]
# 需要本地服务器: python3 -m http.server 8765 --bind 127.0.0.1 （lead 已在后台启动）
cd "$(dirname "$0")/.."
URL="$1"; OUT="$2"; W="${3:-1280}"; H="${4:-720}"; T="${5:-4000}"
case "$URL" in http*) ;; *) URL="http://127.0.0.1:8765/$URL";; esac
UD="$(mktemp -d "$PWD/.tmp/chrome.XXXXXX")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-sandbox \
  --disable-crash-reporter --disable-breakpad --no-first-run --user-data-dir="$UD" \
  --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
  --hide-scrollbars --window-size="$W,$H" --virtual-time-budget="$T" \
  --screenshot="$OUT" "$URL" >/dev/null 2>&1
rm -rf "$UD"
[ -f "$OUT" ] && echo "saved $OUT" || echo "FAILED"
