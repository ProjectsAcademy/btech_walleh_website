/**
 * JavaScript Obfuscation Script
 * Obfuscates all JS files in the js/ directory for production deployment
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Configuration: Balanced Obfuscation (Option B)
const obfuscationOptions = {
    compact: true,                          // Remove whitespace
    controlFlowFlattening: true,            // Make control flow harder to follow
    controlFlowFlatteningThreshold: 0.75,   // 75% of nodes
    deadCodeInjection: true,                // Add dead code
    deadCodeInjectionThreshold: 0.4,        // 40% of nodes
    debugProtection: false,                 // Disable (can break DevTools)
    debugProtectionInterval: 0,             // Disable
    disableConsoleOutput: false,            // Keep console (for debugging)
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
    'js/floating-contact.js'
];

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');

console.log('🔒 Starting JavaScript Obfuscation...\n');

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
        const originalCode = fs.readFileSync(fullPath, 'utf8');
        
        // Skip if file is empty
        if (!originalCode.trim()) {
            console.log(`⚠️  Skipping ${fileName} - File is empty`);
            return;
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

