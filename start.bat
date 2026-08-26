@echo off
title Happy Game - local server
echo.
echo   HAPPY GAME - starting local server
echo   ---------------------------------
echo   Open:  http://localhost:5500
echo   Stop:  press Ctrl+C in this window
echo.
start "" http://localhost:5500
python -m http.server 5500
