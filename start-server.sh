#!/bin/bash

echo "========================================"
echo "Starting Local Web Server for OAuth Testing"
echo "========================================"
echo ""
echo "This will start a web server on http://localhost:8000"
echo ""
echo "After starting, open your browser and go to:"
echo "  http://localhost:8000/compiler.html"
echo ""
echo "Press Ctrl+C to stop the server when done."
echo ""
echo "========================================"
echo ""

# Try Python 3 first
if command -v python3 &> /dev/null; then
    echo "Using Python 3..."
    python3 -m http.server 8000
    exit 0
fi

# Try Python 2
if command -v python &> /dev/null; then
    echo "Using Python..."
    python -m http.server 8000
    exit 0
fi

# Try PHP
if command -v php &> /dev/null; then
    echo "Using PHP..."
    php -S localhost:8000
    exit 0
fi

# Try Node.js http-server
if command -v http-server &> /dev/null; then
    echo "Using http-server..."
    http-server -p 8000
    exit 0
fi

echo "ERROR: No web server found!"
echo ""
echo "Please install one of the following:"
echo "  1. Python (python3 -m http.server 8000)"
echo "  2. PHP (php -S localhost:8000)"
echo "  3. Node.js with http-server (npm install -g http-server)"
echo ""
echo "Or use VS Code with Live Server extension."
echo ""

