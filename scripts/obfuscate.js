/**
 * JavaScript Obfuscation Script
 * Obfuscates all JS files in the js/ directory for production deployment
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Detect if we're on main branch (production)
// Netlify provides: CONTEXT (production/deploy-preview/branch-deploy), BRANCH, HEAD
// For local development, assume test branch (console.logs enabled)
const isMainBranch = process.env.CONTEXT === 'production' ||
    process.env.BRANCH === 'main' ||
    process.env.HEAD === 'main';

// Function to remove console.log statements from code
function removeConsoleLogs(code) {
    // Remove console.log, console.error, console.warn, console.info, console.debug, console.trace
    // Handle both single-line and multi-line console statements
    // Pattern 1: Simple console.log(...);
    let cleaned = code.replace(/console\.(log|error|warn|info|debug|trace)\s*\([^)]*\)\s*;?\s*/g, '');

    // Pattern 2: Multi-line console statements (with nested parentheses)
    // This handles cases like console.log('test', {obj: 'value'});
    cleaned = cleaned.replace(/console\.(log|error|warn|info|debug|trace)\s*\([^;]*?\)\s*;?\s*/gs, '');

    // Pattern 3: Remove any remaining console statements that might have been missed
    cleaned = cleaned.replace(/console\.(log|error|warn|info|debug|trace)\s*\([^)]*\)\s*;?/g, '');

    return cleaned;
}

// Configuration: Balanced Obfuscation (Option B)
// Disable console output on main branch, enable on test branches
const obfuscationOptions = {
    compact: true,                          // Remove whitespace
    controlFlowFlattening: true,            // Make control flow harder to follow
    controlFlowFlatteningThreshold: 0.75,   // 75% of nodes
    deadCodeInjection: true,                // Add dead code
    deadCodeInjectionThreshold: 0.4,        // 40% of nodes
    debugProtection: false,                 // Disable (can break DevTools)
    debugProtectionInterval: 0,             // Disable
    disableConsoleOutput: isMainBranch,     // Disable console on main branch, enable on test branches
    identifierNamesGenerator: 'hexadecimal', // Random hexadecimal names
    log: false,                             // No obfuscation logs
    numbersToExpressions: true,              // Convert numbers to expressions
    renameGlobals: false,                   // Keep global names (for compatibility)
    selfDefending: true,                    // Code that breaks if modified
    simplify: true,                         // Simplify code
    splitStrings: true,                     // Split strings
    splitStringsChunkLength: 10,            // Split into chunks of 10
    stringArray: true,                      // Encode strings
    stringArrayCallsTransform: true,        // Transform string array calls
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],        // Encode strings as base64
    stringArrayIndexShift: true,            // Shift string array indices
    stringArrayRotate: true,                // Rotate string array
    stringArrayShuffle: true,               // Shuffle string array
    stringArrayWrappersCount: 2,            // Number of wrappers
    stringArrayWrappersChainedCalls: true,  // Chain wrapper calls
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'function',   // Use function wrappers
    stringArrayThreshold: 0.75,            // 75% of strings
    transformObjectKeys: true,              // Transform object keys
    unicodeEscapeSequence: false            // Keep readable (for compatibility)
};

// Files to obfuscate
const jsFiles = [
    'js/compiler.js',
    'js/drive-manager.js',
    'js/callback-modal.js',
    'js/course-detail.js',
    'js/floating-contact.js',
    'js/meme-system.js'
];

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');

console.log('🔒 Starting JavaScript Obfuscation...');
console.log(`📦 Branch: ${process.env.BRANCH || process.env.HEAD || 'unknown'}`);
console.log(`🌍 Context: ${process.env.CONTEXT || 'unknown'}`);
console.log(`🔇 Console logs: ${isMainBranch ? 'DISABLED (main branch)' : 'ENABLED (test branch)'}\n`);

let successCount = 0;
let errorCount = 0;

// Process each file
jsFiles.forEach(filePath => {
    const fullPath = path.join(projectRoot, filePath);
    const fileName = path.basename(filePath);

    try {
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  Skipping ${fileName} - File not found`);
            return;
        }

        // Read the original file
        let originalCode = fs.readFileSync(fullPath, 'utf8');

        // Skip if file is empty
        if (!originalCode.trim()) {
            console.log(`⚠️  Skipping ${fileName} - File is empty`);
            return;
        }

        // Remove console.logs on main branch before obfuscation
        if (isMainBranch) {
            const beforeSize = originalCode.length;
            originalCode = removeConsoleLogs(originalCode);
            const removedCount = (beforeSize - originalCode.length) > 0;
            if (removedCount) {
                console.log(`   🧹 Removed console statements from ${fileName}`);
            }
        }

        // Obfuscate the code
        const obfuscationResult = JavaScriptObfuscator.obfuscate(originalCode, obfuscationOptions);
        const obfuscatedCode = obfuscationResult.getObfuscatedCode();

        // Write obfuscated code back to the file
        fs.writeFileSync(fullPath, obfuscatedCode, 'utf8');

        // Calculate size difference
        const originalSize = Buffer.byteLength(originalCode, 'utf8');
        const obfuscatedSize = Buffer.byteLength(obfuscatedCode, 'utf8');
        const sizeDiff = ((obfuscatedSize - originalSize) / originalSize * 100).toFixed(1);

        console.log(`✅ ${fileName}`);
        console.log(`   Original: ${(originalSize / 1024).toFixed(2)} KB`);
        console.log(`   Obfuscated: ${(obfuscatedSize / 1024).toFixed(2)} KB`);
        console.log(`   Size change: ${sizeDiff > 0 ? '+' : ''}${sizeDiff}%\n`);

        successCount++;
    } catch (error) {
        console.error(`❌ Error obfuscating ${fileName}:`, error.message);
        errorCount++;
    }
});

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Successfully obfuscated: ${successCount} file(s)`);
if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} file(s)`);
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (errorCount > 0) {
    process.exit(1);
} else {
    console.log('🎉 Obfuscation complete!');
}

