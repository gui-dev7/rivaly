#!/usr/bin/env sh
echo "Happy Game -> http://localhost:5500"
python3 -m http.server 5500 2>/dev/null || python -m http.server 5500
