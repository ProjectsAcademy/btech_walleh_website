// Judge0 API Configuration - Dual API System
// This system uses both public API and RapidAPI for up to 100 submissions
// It automatically falls back to RapidAPI if public API hits rate limits

// API Configurations - RapidAPI key will be loaded from serverless function
const API_CONFIGS = {
    public: {
        name: 'Public Judge0 API',
        submitUrl: 'https://ce.judge0.com/submissions?base64_encoded=false&wait=false',
        resultUrl: 'https://ce.judge0.com/submissions',
        headers: {
            'Content-Type': 'application/json'
        }
    },
    rapidapi: {
        name: 'RapidAPI Judge0',
        submitUrl: 'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=false',
        resultUrl: 'https://judge0-ce.p.rapidapi.com/submissions',
        headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': '', // Will be loaded from environment variables
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
        }
    }
};

// Flag to track if RapidAPI key is loaded
let rapidApiKeyLoaded = false;

// Track current active API (starts with public, falls back to rapidapi)
let currentAPI = 'public';
let apiSwitched = false; // Track if we've switched APIs

// Function to display current API status
function updateAPIStatus() {
    const apiConfig = API_CONFIGS[currentAPI];
    console.log(`Using: ${apiConfig.name}`);

    // Optional: You can add a visual indicator in the UI here
    // For example, update a status badge in the compiler interface
}

// Function to reset API state (useful when limits reset daily)
function resetAPIState() {
    currentAPI = 'public';
    apiSwitched = false;
    updateAPIStatus();
    console.log('API state reset. Back to using Public API.');
}

// Language IDs for Judge0
const LANGUAGE_IDS = {
    '50': 'C (GCC 9.2.0)',
    '54': 'C++ (GCC 9.2.0)'
};

// Example code templates
const EXAMPLE_CODE = {
    '50': `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    printf("Welcome to B.Tech Walleh Online Compiler\\n");
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    printf("Sum of %d and %d is: %d\\n", num1, num2, sum);
    
    return 0;
}`,
    '54': `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    cout << "Welcome to B.Tech Walleh Online Compiler" << endl;
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    cout << "Sum of " << num1 << " and " << num2 << " is: " << sum << endl;
    
    return 0;
}`
};

// Initialize CodeMirror editor
let editor;
let currentLanguage = '50';

// Load RapidAPI key from serverless function
async function loadRapidApiKey() {
    try {
        // Try to fetch from serverless function (production/Netlify)
        const response = await fetch('/.netlify/functions/get-credentials');

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.credentials && data.credentials.rapidApiKey) {
                API_CONFIGS.rapidapi.headers['X-RapidAPI-Key'] = data.credentials.rapidApiKey;
                rapidApiKeyLoaded = true;
                console.log('✓ RapidAPI key loaded from serverless function');
                return true;
            }
        }

        // Fallback: Check localStorage (for local development)
        const savedRapidApiKey = localStorage.getItem('rapidapi_key');
        if (savedRapidApiKey) {
            API_CONFIGS.rapidapi.headers['X-RapidAPI-Key'] = savedRapidApiKey;
            rapidApiKeyLoaded = true;
            console.log('✓ Using RapidAPI key from localStorage (development mode)');
            return true;
        }

        console.warn('⚠ RapidAPI key not found. Fallback to public API only.');
        return false;
    } catch (error) {
        console.error('Error loading RapidAPI key:', error);

        // Fallback to localStorage for local development
        const savedRapidApiKey = localStorage.getItem('rapidapi_key');
        if (savedRapidApiKey) {
            API_CONFIGS.rapidapi.headers['X-RapidAPI-Key'] = savedRapidApiKey;
            rapidApiKeyLoaded = true;
            console.log('✓ Using RapidAPI key from localStorage (fallback mode)');
            return true;
        }

        console.warn('⚠ RapidAPI key not found. Fallback to public API only.');
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    // Load RapidAPI key first
    await loadRapidApiKey();
    // Initialize CodeMirror
    editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
        lineNumbers: true,
        mode: 'text/x-csrc',
        theme: 'monokai',
        indentUnit: 4,
        indentWithTabs: false,
        lineWrapping: true,
        autofocus: true
    });

    // Expose editor globally for Drive manager
    window.editor = editor;

    // Set initial example code
    editor.setValue(EXAMPLE_CODE[currentLanguage]);

    // Language selector change
    document.getElementById('languageSelect').addEventListener('change', function (e) {
        currentLanguage = e.target.value;
        const mode = currentLanguage === '50' ? 'text/x-csrc' : 'text/x-c++src';
        editor.setOption('mode', mode);
        editor.setValue(EXAMPLE_CODE[currentLanguage]);
        clearOutput();
    });

    // Load example button
    document.getElementById('loadExampleBtn').addEventListener('click', function () {
        editor.setValue(EXAMPLE_CODE[currentLanguage]);
        clearOutput();
    });

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', function () {
        editor.setValue('');
        clearOutput();
    });

    // Run button
    document.getElementById('runBtn').addEventListener('click', function () {
        runCode();
    });

    // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to run
    // Ctrl+S or Cmd+S to save (if Drive is connected)
    editor.setOption('extraKeys', {
        'Ctrl-Enter': function () {
            runCode();
        },
        'Cmd-Enter': function () {
            runCode();
        },
        'Ctrl-S': function (cm) {
            if (window.saveFile && typeof window.saveFile === 'function') {
                cm.preventDefault();
                window.saveFile();
            }
        },
        'Cmd-S': function (cm) {
            if (window.saveFile && typeof window.saveFile === 'function') {
                cm.preventDefault();
                window.saveFile();
            }
        }
    });

    // Initialize API status
    updateAPIStatus();
    console.log('Dual API system initialized. Starting with Public API, will auto-switch to RapidAPI if needed.');

    // Initialize meme toggle button
    const memeToggleBtn = document.getElementById('memeToggleBtn');
    if (memeToggleBtn && typeof window.areMemesEnabled === 'function') {
        // Update button state based on saved preference
        const memesEnabled = window.areMemesEnabled();
        if (memesEnabled) {
            memeToggleBtn.classList.add('active');
            memeToggleBtn.setAttribute('aria-pressed', 'true');
        } else {
            memeToggleBtn.classList.remove('active');
            memeToggleBtn.setAttribute('aria-pressed', 'false');
        }

        // Add click handler
        memeToggleBtn.addEventListener('click', function () {
            if (typeof window.toggleMemes === 'function') {
                const newState = window.toggleMemes();
                if (newState) {
                    memeToggleBtn.classList.add('active');
                    memeToggleBtn.setAttribute('aria-pressed', 'true');
                } else {
                    memeToggleBtn.classList.remove('active');
                    memeToggleBtn.setAttribute('aria-pressed', 'false');
                }
            }
        });
    }
});

function clearOutput() {
    const outputContent = document.getElementById('outputContent');
    outputContent.className = 'output-content empty';
    outputContent.textContent = 'Output will appear here after running your code...';
}

function showLoading() {
    const runBtn = document.getElementById('runBtn');
    const runBtnText = document.getElementById('runBtnText');
    const runBtnSpinner = document.getElementById('runBtnSpinner');

    runBtn.disabled = true;
    runBtnText.textContent = 'Running...';
    runBtnSpinner.style.display = 'inline-block';

    const outputContent = document.getElementById('outputContent');
    outputContent.className = 'output-content running';
    outputContent.textContent = 'Compiling and running your code...\nPlease wait...';
}

function hideLoading() {
    const runBtn = document.getElementById('runBtn');
    const runBtnText = document.getElementById('runBtnText');
    const runBtnSpinner = document.getElementById('runBtnSpinner');

    runBtn.disabled = false;
    runBtnText.textContent = 'Run Code';
    runBtnSpinner.style.display = 'none';
}

async function runCode() {
    const code = editor.getValue().trim();

    if (!code) {
        // Show video for empty code
        const outputContent = document.getElementById('outputContent');
        outputContent.className = 'output-content error';
        outputContent.innerHTML = `
            <div class="gif-container">
                <video autoplay loop muted playsinline style="max-width: 100%; border-radius: 8px; display: block;">
                    <source src="../images/gifs/empty-code.mp4" type="video/mp4">
                </video>
            </div>
        `;
        return;
    }

    showLoading();

    try {
        // Submit code to Judge0 (with automatic fallback)
        const submission = await submitCode(code, currentLanguage);

        // Poll for result using the same API
        const result = await pollResult(submission.token);

        // Display result
        displayResult(result);
    } catch (error) {
        console.error('Error:', error);

        // If error and we haven't switched APIs yet, try switching
        if (!apiSwitched && currentAPI === 'public' && shouldSwitchAPI(error)) {
            console.log('⚠ Public API error detected, automatically switching to RapidAPI...');
            console.log('Error details:', error.message);
            currentAPI = 'rapidapi';
            apiSwitched = true;
            updateAPIStatus();

            // Show user-friendly message
            const outputContent = document.getElementById('outputContent');
            outputContent.className = 'output-content running';
            outputContent.textContent = 'Public API error detected. Switching to RapidAPI...\nRetrying submission...';

            // Retry with RapidAPI
            try {
                const submission = await submitCode(code, currentLanguage);
                const result = await pollResult(submission.token);
                displayResult(result);

                // Add note about API switch in successful result
                const successNote = '\n\n[✓ Using RapidAPI - You now have access to additional submissions]';
                const outputContent2 = document.getElementById('outputContent');
                outputContent2.textContent += successNote;
            } catch (retryError) {
                console.error('RapidAPI retry error:', retryError);
                // Check if this is a real API error or a valid Judge0 response that failed to parse
                // If the error message suggests it's a compilation/runtime error, show it
                if (retryError.message && (
                    retryError.message.includes('Compilation Error') ||
                    retryError.message.includes('Runtime Error') ||
                    retryError.message.includes('Wrong Answer')
                )) {
                    // This might be a valid error response, try to display it
                    showOutput(`Error: ${retryError.message}`, 'error');
                } else {
                    // Real API failure
                    showOutput(`Error: ${retryError.message}\n\nBoth APIs are currently unavailable. Please try again later.`, 'error');
                }
            }
        } else {
            // If we've already switched or error doesn't warrant switching, show error
            if (apiSwitched && currentAPI === 'rapidapi') {
                showOutput(`Error: ${error.message}\n\nNote: RapidAPI is also experiencing issues. Please try again later.`, 'error');
            } else {
                showOutput(`Error: ${error.message}\n\nNote: If errors persist, the API may be temporarily unavailable. Please try again later.`, 'error');
            }
        }
    } finally {
        hideLoading();
    }
}

// Check if error indicates we should switch APIs
// This includes rate limits, bad requests, server errors, and other API failures
// BUT NOT valid Judge0 responses (like compilation errors)
function shouldSwitchAPI(error) {
    const errorMessage = error.message.toLowerCase();

    // Don't switch if the error message suggests it's a valid Judge0 response
    // (e.g., if it contains compilation error details that were successfully parsed)
    if (errorMessage.includes('compilation error') &&
        (errorMessage.includes('status.id') || errorMessage.includes('status_id'))) {
        console.log('This appears to be a valid Judge0 compilation error, not an API failure');
        return false;
    }

    // First, check for specific status codes in the error message
    // Look for patterns like ": 400", "status: 400", or just "400"
    const statusCodePattern = /(?:status|code|error)[\s:]*(\d{3})|[\s:](\d{3})(?:\s|$|\)|,|\.|:)/i;
    const statusMatch = errorMessage.match(statusCodePattern);

    if (statusMatch) {
        // Extract the status code (could be in group 1 or 2)
        const statusCode = parseInt(statusMatch[1] || statusMatch[2]);
        if (!isNaN(statusCode)) {
            // Switch on 4xx and 5xx errors (except 404 which might be a different issue)
            // But be more careful - 400 during polling might be a valid response
            if (statusCode >= 500) {
                console.log(`✓ Detected ${statusCode} server error, will switch to RapidAPI`);
                return true;
            }
            // For 4xx errors, only switch if it's clearly an API issue (429 rate limit)
            // or if it's during submission (not polling, where 400 might be valid)
            if (statusCode === 429) {
                console.log(`✓ Detected ${statusCode} rate limit, will switch to RapidAPI`);
                return true;
            }
            // For other 4xx errors during polling, don't auto-switch (might be valid Judge0 response)
            if (statusCode >= 400 && statusCode < 500 && statusCode !== 404 &&
                errorMessage.includes('during polling')) {
                // Don't auto-switch for 400 during polling - might be valid response
                console.log(`⚠ ${statusCode} error during polling - might be valid Judge0 response, not switching`);
                return false;
            }
        }
    }

    // Check for specific error keywords (these should catch most cases)
    const keywordChecks = [
        '429', '500', '503', '502', '501', '504',
        'rate limit', 'too many requests', 'quota',
        'server error', 'service unavailable',
        'internal server error', 'gateway', 'timeout'
    ];

    for (const keyword of keywordChecks) {
        if (errorMessage.includes(keyword)) {
            console.log(`✓ Detected "${keyword}" in error, will switch to RapidAPI`);
            return true;
        }
    }

    return false;
}

async function submitCode(code, languageId) {
    const apiConfig = API_CONFIGS[currentAPI];

    const response = await fetch(apiConfig.submitUrl, {
        method: 'POST',
        headers: apiConfig.headers,
        body: JSON.stringify({
            source_code: code,
            language_id: parseInt(languageId),
            stdin: '',
            cpu_time_limit: 2,
            memory_limit: 128000
        })
    });

    if (!response.ok) {
        let errorText = '';
        try {
            errorText = await response.text();
            // Try to parse as JSON to get structured error
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error || errorJson.message) {
                    errorText = errorJson.error || errorJson.message;
                }
            } catch (e) {
                // Not JSON, use text as is
            }
        } catch (e) {
            errorText = 'Unknown error';
        }

        // If error and using public API, throw error with status code for fallback detection
        if (currentAPI === 'public' && !apiSwitched) {
            // Include status code in error message so shouldSwitchAPI can detect it
            throw new Error(`API error on ${apiConfig.name}. Status: ${response.status}. ${errorText.substring(0, 100)}`);
        }

        throw new Error(`Failed to submit code (${apiConfig.name}): ${response.status} ${errorText.substring(0, 100)}`);
    }

    const result = await response.json();

    // Log API switch if it happened
    if (apiSwitched && currentAPI === 'rapidapi') {
        console.log('✓ Successfully switched to RapidAPI');
    }

    return result;
}

// Helper function to check if a string is base64-encoded
function isBase64(str) {
    if (!str || typeof str !== 'string') return false;
    // Base64 strings are typically longer and contain only base64 characters
    // Check if string looks like base64 (length > 20, mostly alphanumeric + / =)
    if (str.length < 20) return false;
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    return base64Pattern.test(str) && str.length % 4 === 0;
}

// Helper function to decode base64 strings with proper UTF-8 handling
function decodeBase64(str) {
    if (!str) return str;
    try {
        // Decode base64 to binary string
        const binaryString = atob(str);
        // Convert binary string to UTF-8
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        // Decode UTF-8 bytes to string
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        // If decoding fails, try simple atob (for ASCII-only content)
        try {
            return atob(str);
        } catch (e2) {
            return str; // Return as-is if not valid base64
        }
    }
}

// Helper function to decode base64 fields in Judge0 result
function decodeResult(result) {
    if (!result) return result;

    const decoded = { ...result };

    // Decode base64-encoded fields if they exist
    if (decoded.stdout && typeof decoded.stdout === 'string') {
        decoded.stdout = decodeBase64(decoded.stdout);
    }
    if (decoded.stderr && typeof decoded.stderr === 'string') {
        decoded.stderr = decodeBase64(decoded.stderr);
    }
    if (decoded.compile_output && typeof decoded.compile_output === 'string') {
        decoded.compile_output = decodeBase64(decoded.compile_output);
    }
    if (decoded.message && typeof decoded.message === 'string') {
        decoded.message = decodeBase64(decoded.message);
    }

    return decoded;
}

async function pollResult(token, maxAttempts = 20, useBase64 = false) {
    const apiConfig = API_CONFIGS[currentAPI];
    const endpoint = `${apiConfig.resultUrl}/${token}?base64_encoded=${useBase64}`;

    // Get headers for GET request (without Content-Type)
    const headers = {};
    if (currentAPI === 'rapidapi') {
        headers['X-RapidAPI-Key'] = apiConfig.headers['X-RapidAPI-Key'];
        headers['X-RapidAPI-Host'] = apiConfig.headers['X-RapidAPI-Host'];
    }

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        // Try to parse response even if status is not ok
        // Sometimes Judge0 returns 400 but with valid JSON containing error details
        let result;
        let responseText = '';

        try {
            // First, get the response as text so we can inspect it
            responseText = await response.text();

            // Try to parse as JSON
            if (responseText.trim()) {
                result = JSON.parse(responseText);
            } else {
                // Empty response - treat as API error
                if (!response.ok) {
                    if (currentAPI === 'public' && !apiSwitched) {
                        throw new Error(`API error on ${apiConfig.name} during polling. Status: ${response.status} (empty response)`);
                    }
                    throw new Error(`Failed to get result (${apiConfig.name}): ${response.status} (empty response)`);
                }
                throw new Error('Empty response from API');
            }
        } catch (parseError) {
            // If we can't parse JSON, log what we got for debugging
            console.log('Response parsing error:', parseError);
            console.log('Response status:', response.status);
            console.log('Response text:', responseText.substring(0, 200));

            // If we got a non-ok response and can't parse it, it's a real API error
            if (!response.ok) {
                // If error during polling and using public API, throw error with status code for fallback
                if (currentAPI === 'public' && !apiSwitched) {
                    // Include status code in error message so shouldSwitchAPI can detect it
                    throw new Error(`API error on ${apiConfig.name} during polling. Status: ${response.status}`);
                }
                throw new Error(`Failed to get result (${apiConfig.name}): ${response.status}`);
            }
            throw parseError;
        }

        // If response is not ok but we got valid JSON, check if it's a valid Judge0 result
        if (!response.ok) {
            // Check if the JSON has a status field (indicating it's a valid Judge0 response)
            if (result && result.status && typeof result.status.id !== 'undefined') {
                // This is a valid Judge0 result (might be compilation error, etc.)
                console.log('Got valid Judge0 result with HTTP', response.status, '- Status ID:', result.status.id);
                // Status 1 = In Queue, 2 = Processing
                if (result.status.id <= 2) {
                    continue; // Still processing
                }
                // Return the result even though HTTP status was not ok
                return result;
            }

            // If it's not a valid Judge0 result structure, check if it contains error information
            // Sometimes Judge0 returns error details in a different format
            if (result) {
                // Check for common error message fields
                const errorMessage = result.error || result.message || result.detail ||
                    (result.status && result.status.description) || '';

                if (errorMessage) {
                    console.log('Got error message in 400 response:', errorMessage);

                    // Check if Judge0 is asking us to use base64_encoded=true
                    if (errorMessage.toLowerCase().includes('base64_encoded') &&
                        errorMessage.toLowerCase().includes('utf-8') &&
                        !useBase64) {
                        console.log('Judge0 requires base64 encoding, retrying with base64_encoded=true');
                        // Retry with base64 encoding
                        return await pollResult(token, maxAttempts - i, true);
                    }

                    // Try to construct a valid Judge0-like result structure
                    // If it's a compilation error or similar, we should still display it
                    if (errorMessage.toLowerCase().includes('compilation') ||
                        errorMessage.toLowerCase().includes('syntax') ||
                        errorMessage.toLowerCase().includes('error')) {
                        // Create a result structure that displayResult can handle
                        const errorResult = {
                            status: {
                                id: 6, // Compilation Error
                                description: 'Compilation Error'
                            },
                            stderr: errorMessage,
                            stdout: '',
                            compile_output: errorMessage
                        };
                        console.log('Constructed error result from 400 response');
                        return errorResult;
                    }
                }

                // Log what we got for debugging
                console.log('Non-ok response but not a valid Judge0 result structure:', result);
            }

            // If it's not a valid Judge0 result structure and no error message found, treat as API error
            if (currentAPI === 'public' && !apiSwitched) {
                throw new Error(`API error on ${apiConfig.name} during polling. Status: ${response.status}`);
            }
            throw new Error(`Failed to get result (${apiConfig.name}): ${response.status}`);
        }

        // Status 1 = In Queue, 2 = Processing
        if (result.status && result.status.id <= 2) {
            continue; // Still processing
        }

        // Decode base64 fields if we used base64 encoding
        // Also check if fields appear to be base64-encoded even if we didn't request it
        if (useBase64 || (result.stdout && isBase64(result.stdout)) ||
            (result.stderr && isBase64(result.stderr)) ||
            (result.compile_output && isBase64(result.compile_output))) {
            result = decodeResult(result);
        }

        return result;
    }

    throw new Error('Timeout: Code execution took too long');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to format and clean up compilation error messages with HTML styling
function formatCompilationError(errorText) {
    if (!errorText) return '<span style="color: #ffffff;">Unknown compilation error</span>';

    // Fix common character encoding issues
    let formatted = errorText
        // Fix garbled quotes and special characters (common UTF-8 encoding issues)
        .replace(/â€™/g, "'")      // Right single quotation mark
        .replace(/â€œ/g, '"')      // Left double quotation mark
        .replace(/â€/g, '"')       // Right double quotation mark
        .replace(/â€"/g, '—')      // Em dash
        .replace(/â€"/g, '–')      // En dash
        .replace(/â€¦/g, '...')    // Horizontal ellipsis
        .replace(/â€˜/g, "'")      // Left single quotation mark
        .replace(/â€"/g, '"')      // Left double quotation mark
        .replace(/â€"/g, '"')      // Right double quotation mark
        .replace(/â€™/g, "'")      // Apostrophe
        .replace(/â€"/g, '"')      // Quotation mark
        .replace(/â€"/g, '"')      // Quotation mark
        .replace(/â /g, ' ')       // Space after â
        .replace(/â/g, "'");        // Catch-all for remaining â characters

    // Split into lines for processing
    const lines = formatted.split('\n');
    const htmlLines = [];
    const seenErrors = new Set(); // Track unique errors to avoid duplicates
    let hasMainError = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip redundant informational notes
        if (line.toLowerCase().includes('note: each undeclared identifier is reported only once')) {
            continue;
        }

        // Extract and format error messages
        // Pattern: filename:line:column: error: message
        const errorMatch = line.match(/^([^:]+):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/);
        if (errorMatch) {
            const [, file, lineNum, col, type, message] = errorMatch;
            const cleanMessage = message.trim();

            // Create a cleaner, more readable format with HTML styling
            if (type === 'error') {
                // Main error lines in bright white with bold
                const escapedMessage = escapeHtml(cleanMessage);
                htmlLines.push(`<div style="color: #ffffff; font-weight: 600; margin: 4px 0;">Line ${lineNum}: ${escapedMessage}</div>`);
                hasMainError = true;
                seenErrors.add(`error_${lineNum}_${col}`);
            } else if (type === 'warning' && !hasMainError) {
                // Warnings in light grey
                const escapedMessage = escapeHtml(cleanMessage);
                htmlLines.push(`<div style="color: #b0b0b0; margin: 2px 0;">Line ${lineNum}: ${escapedMessage} (warning)</div>`);
            } else if (type === 'note') {
                // Notes in light grey (darker)
                const escapedMessage = escapeHtml(cleanMessage);
                htmlLines.push(`<div style="color: #888888; margin: 2px 0; font-size: 0.9em;">${escapedMessage}</div>`);
            }
        } else if (line.match(/^[^:]+: In function/)) {
            // Keep "In function" line only once at the start (in light grey)
            if (!seenErrors.has('in_function')) {
                const funcMatch = line.match(/In function ['"]([^'"]+)['"]/);
                if (funcMatch) {
                    htmlLines.push(`<div style="color: #b0b0b0; margin-bottom: 8px;">In function: ${escapeHtml(funcMatch[1])}</div>`);
                } else {
                    htmlLines.push(`<div style="color: #b0b0b0; margin-bottom: 8px;">Compilation errors:</div>`);
                }
                seenErrors.add('in_function');
            }
        } else if (line.length > 0 && !line.match(/^main\.c:/) && !line.match(/^\/tmp\//)) {
            // Other lines (file paths, etc.) in light grey - skip temp file paths
            htmlLines.push(`<div style="color: #888888; font-size: 0.85em; margin: 2px 0;">${escapeHtml(line)}</div>`);
        }
    }

    // If we cleaned up too much, return original with just encoding fixes
    if (htmlLines.length === 0) {
        // Return original with basic styling
        return `<div style="color: #ffffff;">${escapeHtml(formatted)}</div>`;
    }

    // Don't add header - keep it clean

    // Join and return HTML
    return htmlLines.join('');
}

// Removed Tenor embed functions - now using local MP4 videos

function displayResult(result) {
    const outputContent = document.getElementById('outputContent');
    let output = '';
    let className = 'output-content';

    // Status descriptions
    const statusDescriptions = {
        3: 'Accepted',
        4: 'Wrong Answer',
        5: 'Time Limit Exceeded',
        6: 'Compilation Error',
        7: 'Runtime Error (SIGSEGV)',
        8: 'Runtime Error (SIGXFSZ)',
        9: 'Runtime Error (SIGFPE)',
        10: 'Runtime Error (SIGABRT)',
        11: 'Runtime Error (NZEC)',
        12: 'Runtime Error (Other)',
        13: 'Internal Error',
        14: 'Exec Format Error'
    };

    const statusId = result.status.id;
    const statusName = result.status.description || statusDescriptions[statusId] || 'Unknown';

    // Check if memes are enabled and if this is an error
    const memesEnabled = typeof window.areMemesEnabled === 'function' ? window.areMemesEnabled() : false;
    const isError = statusId !== 3; // Not success

    if (statusId === 3) {
        // Success - show success GIF
        className += ' success';
        output = result.stdout || '(No output)';

        if (result.time) {
            output += `\n\n--- Execution Time: ${result.time}s ---`;
        }
        if (result.memory) {
            output += `\n--- Memory Used: ${(result.memory / 1024).toFixed(2)} KB ---`;
        }

        // Add success video
        const escapedOutput = escapeHtml(output);
        outputContent.className = className;
        outputContent.innerHTML = `
            <div class="gif-container">
                <video autoplay loop muted playsinline style="max-width: 100%; border-radius: 8px; display: block;">
                    <source src="../images/gifs/success.mp4" type="video/mp4">
                </video>
            </div>
            <div style="margin-top: 1rem; white-space: pre-wrap; font-family: 'Courier New', monospace; color: #4caf50;">${escapedOutput}</div>
        `;
        return;
    } else if (statusId === 6) {
        // Compilation Error - use HTML formatting with colors
        className += ' error';
        const errorText = result.compile_output || result.stderr || 'Unknown compilation error';
        let htmlOutput = formatCompilationError(errorText);

        // Add error video
        const errorVideo = `
            <div class="gif-container">
                <video autoplay loop muted playsinline style="max-width: 100%; border-radius: 8px; display: block;">
                    <source src="../images/gifs/error.mp4" type="video/mp4">
                </video>
            </div>
        `;

        // Add meme card if enabled
        if (memesEnabled && typeof window.displayMemeCard === 'function') {
            const errorType = typeof window.getErrorTypeFromStatus === 'function'
                ? window.getErrorTypeFromStatus(statusId)
                : 'compilation';
            const meme = typeof window.getMemeForError === 'function'
                ? window.getMemeForError(errorType)
                : null;
            const memeCard = window.displayMemeCard(statusId, meme);
            htmlOutput = `<div class="error-card-container">${errorVideo}${memeCard}${htmlOutput}</div>`;
        } else {
            htmlOutput = `<div class="error-card-container">${errorVideo}${htmlOutput}</div>`;
        }

        outputContent.className = className;
        outputContent.innerHTML = htmlOutput;
        return; // Early return since we set innerHTML directly
    } else {
        // Runtime Error or other errors
        className += ' error';
        output = ''; // Remove status name header

        if (result.stderr) {
            output += result.stderr;
        }

        if (result.stdout) {
            if (output) output += '\n\n';
            output += result.stdout;
        }

        if (result.message) {
            if (output) output += '\n\n';
            output += result.message;
        }

        if (!result.stderr && !result.stdout && !result.message) {
            output = ''; // Don't show "No additional information available"
        }

        // Add error video
        const errorVideo = `
            <div class="gif-container">
                <video autoplay loop muted playsinline style="max-width: 100%; border-radius: 8px; display: block;">
                    <source src="../images/gifs/error.mp4" type="video/mp4">
                </video>
            </div>
        `;

        const escapedOutput = escapeHtml(output);
        const outputDisplay = output ? `<div style="white-space: pre-wrap; font-family: 'Courier New', monospace;">${escapedOutput}</div>` : '';

        // Add meme card if enabled
        if (memesEnabled && typeof window.displayMemeCard === 'function') {
            const errorType = typeof window.getErrorTypeFromStatus === 'function'
                ? window.getErrorTypeFromStatus(statusId)
                : 'generic';
            const meme = typeof window.getMemeForError === 'function'
                ? window.getMemeForError(errorType)
                : null;
            const memeCard = window.displayMemeCard(statusId, meme);
            outputContent.className = className;
            outputContent.innerHTML = `<div class="error-card-container">${errorVideo}${memeCard}${outputDisplay}</div>`;
        } else {
            outputContent.className = className;
            outputContent.innerHTML = `<div class="error-card-container">${errorVideo}${outputDisplay}</div>`;
        }
        return; // Early return since we set innerHTML directly
    }

    outputContent.className = className;
    outputContent.textContent = output;
}

function showOutput(message, type = 'success') {
    const outputContent = document.getElementById('outputContent');
    outputContent.className = `output-content ${type}`;
    outputContent.textContent = message;
    hideLoading();
}


