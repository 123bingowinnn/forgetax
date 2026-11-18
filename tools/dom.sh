#!/bin/bash
# 用法: tools/dom.sh <相对路径或URL> [虚拟时间ms=4000]  —— 输出页面 <html> 标签上的 data-* 与标题（含 JS 错误）
cd "$(dirname "$0")/.."
URL="$1"; T="${2:-4000}"
case "$URL" in http*) ;; *) URL="http://127.0.0.1:8765/$URL";; esac
UD="$(mktemp -d "$PWD/.tmp/chrome.XXXXXX")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-sandbox \
  --disable-crash-reporter --disable-breakpad --no-first-run --user-data-dir="$UD" \
  --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
  --window-size=1280,720 --virtual-time-budget="$T" --dump-dom "$URL" 2>/dev/null | grep -o '<html[^>]*>\|<title>[^<]*</title>' 
rm -rf "$UD"
