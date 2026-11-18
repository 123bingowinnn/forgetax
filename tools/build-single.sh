#!/bin/bash
# 打包成单个 HTML（双击即可游玩，无需服务器/联网）
# 用法：tools/build-single.sh   → 输出 dist/铸剑大师.html 和 index.html（单文件发布版）
set -e
cd "$(dirname "$0")/.."
ESB=.build/node_modules/.bin/esbuild
if [ ! -x "$ESB" ]; then
  mkdir -p .build && (cd .build && npm_config_cache="$PWD/.npm-cache" npm init -y >/dev/null && npm_config_cache="$PWD/.npm-cache" npm install esbuild@0.24.0 --no-audit --no-fund >/dev/null)
fi
mkdir -p dist
"$ESB" src/main.js --bundle --format=iife --minify --target=es2020 \
  --alias:three=./vendor/three/three.module.js \
  --alias:three/addons=./vendor/three/addons \
  --external:../tools/scenarios.js \
  --legal-comments=none --outfile=.build/bundle.js --log-level=warning
python3 - <<'EOF'
import re
html = open('dev.html', encoding='utf-8').read()
css = open('css/style.css', encoding='utf-8').read()
js = open('.build/bundle.js', encoding='utf-8').read().replace('</script', '<\\/script')
html = html.replace('<link rel="stylesheet" href="css/style.css" />', '<style>\n' + css + '\n</style>')
html = re.sub(r'\s*<script type="importmap">.*?</script>', '', html, flags=re.S)
html = html.replace('<script type="module" src="src/main.js"></script>', '<script>\n' + js + '\n</script>')
assert 'src/main.js' not in html and 'importmap' not in html
open('dist/铸剑大师.html', 'w', encoding='utf-8').write(html)
open('index.html', 'w', encoding='utf-8').write(html)
print('dist/铸剑大师.html', round(len(html.encode()) / 1024), 'KB')
EOF
