// Judge0 API Configuration - Dual API System
// This system uses both public API and RapidAPI for up to 100 submissions
// It automatically falls back to RapidAPI if public API hits rate limits

// API Configurations
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
            'X-RapidAPI-Key': '77dbed1517msh37a97ee00e5ab78p1bc351jsn9d103bd60c7d',
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
        }
    }
};

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

document.addEventListener('DOMContentLoaded', function () {
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
    editor.setOption('extraKeys', {
        'Ctrl-Enter': function () {
            runCode();
        },
        'Cmd-Enter': function () {
            runCode();
        }
    });

    // Initialize API status
    updateAPIStatus();
    console.log('Dual API system initialized. Starting with Public API, will auto-switch to RapidAPI if needed.');
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
        showOutput('Error: Please write some code before running.', 'error');
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
        if (!apiSwitched && currentAPI === 'public' && isRateLimitError(error)) {
            console.log('⚠ Public API rate limit reached, automatically switching to RapidAPI...');
            currentAPI = 'rapidapi';
            apiSwitched = true;
            updateAPIStatus();

            // Show user-friendly message
            const outputContent = document.getElementById('outputContent');
            outputContent.className = 'output-content running';
            outputContent.textContent = 'Public API limit reached. Switching to RapidAPI...\nRetrying submission...';

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
                showOutput(`Error: ${retryError.message}\n\nBoth APIs are currently unavailable. Please try again later.`, 'error');
            }
        } else {
            showOutput(`Error: ${error.message}\n\nNote: If you see rate limit errors, both APIs may have reached their limits.`, 'error');
        }
    } finally {
        hideLoading();
    }
}

// Check if error is a rate limit error
function isRateLimitError(error) {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('429') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('quota');
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
        const errorText = await response.text();

        // If rate limit error and using public API, throw special error for fallback
        if (response.status === 429 && currentAPI === 'public') {
            throw new Error(`Rate limit reached on ${apiConfig.name}. Status: ${response.status}`);
        }

        throw new Error(`Failed to submit code (${apiConfig.name}): ${response.status} ${errorText}`);
    }

    const result = await response.json();

    // Log API switch if it happened
    if (apiSwitched && currentAPI === 'rapidapi') {
        console.log('✓ Successfully switched to RapidAPI');
    }

    return result;
}

async function pollResult(token, maxAttempts = 20) {
    const apiConfig = API_CONFIGS[currentAPI];
    const endpoint = `${apiConfig.resultUrl}/${token}?base64_encoded=false`;

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

        if (!response.ok) {
            // If rate limit during polling, try to switch APIs
            if (response.status === 429 && currentAPI === 'public' && !apiSwitched) {
                throw new Error(`Rate limit reached on ${apiConfig.name} during polling`);
            }
            throw new Error(`Failed to get result (${apiConfig.name}): ${response.status}`);
        }

        const result = await response.json();

        // Status 1 = In Queue, 2 = Processing
        if (result.status.id <= 2) {
            continue; // Still processing
        }

        return result;
    }

    throw new Error('Timeout: Code execution took too long');
}

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

    if (statusId === 3) {
        // Success
        className += ' success';
        output = result.stdout || '(No output)';

        if (result.time) {
            output += `\n\n--- Execution Time: ${result.time}s ---`;
        }
        if (result.memory) {
            output += `\n--- Memory Used: ${(result.memory / 1024).toFixed(2)} KB ---`;
        }
    } else if (statusId === 6) {
        // Compilation Error
        className += ' error';
        output = `Compilation Error:\n${result.compile_output || result.stderr || 'Unknown compilation error'}`;
    } else {
        // Runtime Error or other errors
        className += ' error';
        output = `${statusName}\n\n`;

        if (result.stderr) {
            output += `Error Output:\n${result.stderr}\n\n`;
        }

        if (result.stdout) {
            output += `Output:\n${result.stdout}\n\n`;
        }

        if (result.message) {
            output += `Message: ${result.message}`;
        }

        if (!result.stderr && !result.stdout && !result.message) {
            output += 'No additional information available.';
        }
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

