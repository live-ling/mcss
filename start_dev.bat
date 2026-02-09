@echo off

REM Start script for MCSS server
echo Starting MCSS server...

REM Check and install frontend dependencies
echo Checking frontend dependencies...
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
) else (
    echo Frontend dependencies already installed
)

REM Check and create backend virtual environment
echo Checking backend virtual environment...
if not exist "backend\venv" (
    echo Creating virtual environment for backend...
    python -m venv backend\venv
)

REM Install backend dependencies
echo Installing backend dependencies...
backend\venv\Scripts\pip.exe install -r backend\requirements.txt

REM Initialize database
echo Initializing database...
cd backend
python init_db.py
cd ..

REM Start backend service
echo Starting backend service...
cd backend
start "Backend Server" venv\Scripts\python.exe main.py
cd ..

REM Wait for 2 seconds
timeout /t 2 /nobreak >nul

REM Start frontend development server
echo Starting frontend development server...
npm run dev