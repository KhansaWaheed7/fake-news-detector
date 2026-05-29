@echo off
echo ===================================
echo   VerifyAI - Fake News Detector
echo ===================================
echo.
echo [1] Installing backend dependencies...
cd backend
pip install flask flask-cors --quiet
echo.
echo [2] Starting Flask backend on port 5000...
start cmd /k python app.py
cd ..
echo.
echo [3] Opening frontend in browser...
timeout /t 2 >nul
start frontend\index.html
echo.
echo Done! App is running.
echo Backend: http://localhost:5000
echo Frontend: frontend/index.html
pause
