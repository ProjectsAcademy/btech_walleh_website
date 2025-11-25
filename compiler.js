// Judge0 API Configuration
// Note: For production, you should set up your own Judge0 instance
// or use a paid API service. The free public API has rate limits.
const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = ''; // Add your RapidAPI key here if using RapidAPI
// Alternative: Use the public Judge0 API (may have rate limits)
const USE_PUBLIC_API = true; // Set to false if using RapidAPI

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

document.addEventListener('DOMContentLoaded', function() {
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
    document.getElementById('languageSelect').addEventListener('change', function(e) {
        currentLanguage = e.target.value;
        const mode = currentLanguage === '50' ? 'text/x-csrc' : 'text/x-c++src';
        editor.setOption('mode', mode);
        editor.setValue(EXAMPLE_CODE[currentLanguage]);
        clearOutput();
    });

    // Load example button
    document.getElementById('loadExampleBtn').addEventListener('click', function() {
        editor.setValue(EXAMPLE_CODE[currentLanguage]);
        clearOutput();
    });

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', function() {
        editor.setValue('');
        clearOutput();
    });

    // Run button
    document.getElementById('runBtn').addEventListener('click', function() {
        runCode();
    });

    // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to run
    editor.setOption('extraKeys', {
        'Ctrl-Enter': function() {
            runCode();
        },
        'Cmd-Enter': function() {
            runCode();
        }
    });
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
        // Submit code to Judge0
        const submission = await submitCode(code, currentLanguage);
        
        // Poll for result
        const result = await pollResult(submission.token);
        
        // Display result
        displayResult(result);
    } catch (error) {
        console.error('Error:', error);
        showOutput(`Error: ${error.message}\n\nNote: If you see rate limit errors, you may need to set up your own Judge0 API instance.`, 'error');
    } finally {
        hideLoading();
    }
}

async function submitCode(code, languageId) {
    const endpoint = USE_PUBLIC_API 
        ? 'https://ce.judge0.com/submissions?base64_encoded=false&wait=false'
        : `${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=false`;

    const headers = {
        'Content-Type': 'application/json',
    };

    if (!USE_PUBLIC_API && JUDGE0_API_KEY) {
        headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
        headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
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
        throw new Error(`Failed to submit code: ${response.status} ${errorText}`);
    }

    return await response.json();
}

async function pollResult(token, maxAttempts = 20) {
    const endpoint = USE_PUBLIC_API
        ? `https://ce.judge0.com/submissions/${token}?base64_encoded=false`
        : `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=false`;

    const headers = {};

    if (!USE_PUBLIC_API && JUDGE0_API_KEY) {
        headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
        headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    }

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Failed to get result: ${response.status}`);
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

