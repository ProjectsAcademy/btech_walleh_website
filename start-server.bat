@echo off
echo ========================================
echo Starting Local Web Server for OAuth Testing
echo ========================================
echo.
echo This will start a web server on http://localhost:8000
echo.
echo After starting, open your browser and go to:
echo   http://localhost:8000/pages/compiler.html
echo.
echo Press Ctrl+C to stop the server when done.
echo.
echo ========================================
echo.

REM Try Python 3 first
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python...
    python -m http.server 8000
    goto :end
)

REM Try Python 3 explicitly
python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python 3...
    python3 -m http.server 8000
    goto :end
)

REM Try PHP
php --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using PHP...
    php -S localhost:8000
    goto :end
)

echo ERROR: No web server found!
echo.
echo Please install one of the following:
echo   1. Python (https://www.python.org/)
echo   2. PHP (https://www.php.net/)
echo   3. Node.js with http-server (npm install -g http-server)
echo.
echo Or use VS Code with Live Server extension.
echo.
pause

:end

