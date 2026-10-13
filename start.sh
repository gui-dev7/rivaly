#!/usr/bin/env sh
# RIVALY: servidor local.
# Com Node: usa o Vite (recomendado). Sem Node: cai para o servidor do Python,
# que serve as páginas mas não a pasta public/ (sitemap.xml, robots.txt e ícones).

if command -v npm >/dev/null 2>&1; then
    [ -d node_modules ] || npm install
    echo "RIVALY -> http://localhost:5173"
    npm run dev
else
    echo "Node não encontrado. Usando o Python (sem os arquivos de public/)."
    echo "RIVALY -> http://localhost:5500"
    python3 -m http.server 5500 2>/dev/null || python -m http.server 5500
fi
