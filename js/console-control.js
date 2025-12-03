/**
 * Console Control Utility
 * Automatically disables console logs on production domain (btechwalleh.com)
 * Keeps console logs enabled on localhost and test domains
 * 
 * IMPORTANT: This script must run AFTER obfuscated scripts to restore console
 * methods that obfuscation may have disabled.
 */

(function () {
    'use strict';

    // Store original console methods IMMEDIATELY before anything can modify them
    // This must happen at the very start, even before checking hostname
    const originalConsole = {};
    if (typeof console !== 'undefined') {
        originalConsole.log = console.log;
        originalConsole.error = console.error;
        originalConsole.warn = console.warn;
        originalConsole.info = console.info;
        originalConsole.debug = console.debug;
        originalConsole.trace = console.trace;
        originalConsole.table = console.table;
        originalConsole.group = console.group;
        originalConsole.groupEnd = console.groupEnd;
        originalConsole.groupCollapsed = console.groupCollapsed;
        originalConsole.time = console.time;
        originalConsole.timeEnd = console.timeEnd;
        originalConsole.count = console.count;
        originalConsole.clear = console.clear;
    }

    // Get current hostname
    const hostname = window.location.hostname;

    // Production domains where console should be disabled
    const productionDomains = [
        'btechwalleh.com',
        'www.btechwalleh.com'
    ];

    // Check if we're on production domain
    // Only match exact domains, not subdomains (test.btechwalleh.com should NOT match)
    const isProduction = productionDomains.some(domain =>
        hostname === domain
    );

    // Function to restore original console methods
    function restoreConsole() {
        if (typeof console !== 'undefined' && originalConsole.log) {
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;
            console.debug = originalConsole.debug;
            console.trace = originalConsole.trace;
            console.table = originalConsole.table;
            console.group = originalConsole.group;
            console.groupEnd = originalConsole.groupEnd;
            console.groupCollapsed = originalConsole.groupCollapsed;
            console.time = originalConsole.time;
            console.timeEnd = originalConsole.timeEnd;
            console.count = originalConsole.count;
            console.clear = originalConsole.clear;
        }
    }

    // Function to disable console methods
    function disableConsole() {
        const noop = function () { };
        if (typeof console !== 'undefined') {
            console.log = noop;
            console.error = noop;
            console.warn = noop;
            console.info = noop;
            console.debug = noop;
            console.trace = noop;
            console.table = noop;
            console.group = noop;
            console.groupEnd = noop;
            console.groupCollapsed = noop;
            console.time = noop;
            console.timeEnd = noop;
            console.count = noop;
            console.clear = noop;
        }
    }

    // Use original console for initial logging
    if (originalConsole.log) {
        originalConsole.log('[Console Control] Hostname:', hostname);
        originalConsole.log('[Console Control] Is Production:', isProduction);
        originalConsole.log('[Console Control] Console will be', isProduction ? 'DISABLED' : 'ENABLED');
    }

    // Apply console control based on environment
    if (isProduction) {
        // On production: disable console
        disableConsole();
    } else {
        // On test/localhost: RESTORE console (in case obfuscation disabled it)
        // This ensures console works even if obfuscated scripts disabled it
        restoreConsole();

        // Also set up a monitor to continuously restore console in case
        // obfuscated code tries to disable it again (defensive approach)
        if (typeof window !== 'undefined') {
            // Run after a short delay to ensure all scripts have loaded
            setTimeout(() => {
                restoreConsole();
                if (originalConsole.log) {
                    originalConsole.log('[Console Control] Console methods restored for test environment');
                }
            }, 100);

            // Also restore on DOMContentLoaded in case scripts load later
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    restoreConsole();
                });
            }
        }
    }
})();

