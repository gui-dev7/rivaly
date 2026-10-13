@echo off
title RIVALY - servidor local
echo.
echo   RIVALY - servidor local
echo   -----------------------
echo   Para parar: Ctrl+C nesta janela
echo.

where npm >nul 2>nul
if %errorlevel%==0 (
    if not exist node_modules call npm install
    echo   Abra: http://localhost:5173
    echo.
    start "" http://localhost:5173
    npm run dev
) else (
    echo   Node nao encontrado. Usando o Python, sem os arquivos de public/.
    echo   Abra: http://localhost:5500
    echo.
    start "" http://localhost:5500
    python -m http.server 5500
)
