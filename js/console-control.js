/**
 * Console Control Utility
 * Automatically disables console logs on production domain (btechwalleh.com)
 * Keeps console logs enabled on localhost and test domains
 * 
 * IMPORTANT: Original console methods are captured in HEAD by inline script
 * This script runs AFTER obfuscated scripts to restore console methods
 */

(function () {
    'use strict';

    // Get original console methods from window (captured in HEAD)
    const originalConsole = window.__ORIGINAL_CONSOLE__ || {};

    // If original console wasn't captured, try to get from current console
    // (fallback for pages without the HEAD script)
    if (!originalConsole.log && typeof console !== 'undefined') {
        // Try to restore from native console if available
        try {
            const nativeConsole = console.constructor.prototype;
            if (nativeConsole && nativeConsole.log) {
                originalConsole.log = nativeConsole.log;
                originalConsole.error = nativeConsole.error;
                originalConsole.warn = nativeConsole.warn;
                originalConsole.info = nativeConsole.info;
                originalConsole.debug = nativeConsole.debug;
            }
        } catch (e) {
            // If we can't get native console, we'll use what we have
        }
    }

    // Get current hostname (normalize to lowercase for comparison)
    const hostname = (window.location.hostname || '').toLowerCase();

    // Production domains where console should be disabled
    const productionDomains = [
        'btechwalleh.com',
        'www.btechwalleh.com'
    ];

    // Check if we're on production domain
    // Only match exact domains, not subdomains (test.btechwalleh.com should NOT match)
    const isProduction = productionDomains.some(domain =>
        hostname === domain.toLowerCase()
    );

    // Function to restore original console methods
    function restoreConsole() {
        if (typeof console !== 'undefined' && originalConsole.log) {
            try {
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
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
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

    // Apply console control based on environment
    if (isProduction) {
        // On production: disable console IMMEDIATELY and keep it disabled
        disableConsole();

        // Continuous monitoring: keep console disabled even if something tries to restore it
        // Check every 500ms for first 30 seconds to ensure console stays disabled
        let productionMonitorCount = 0;
        const productionMonitorInterval = setInterval(() => {
            disableConsole();
            productionMonitorCount++;
            if (productionMonitorCount >= 60) { // 60 * 500ms = 30 seconds
                clearInterval(productionMonitorInterval);
            }
        }, 500);

        // Also disable on any future events
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                disableConsole();
            });
        }

        if (window.addEventListener) {
            window.addEventListener('load', () => {
                disableConsole();
            });
        }
    } else {
        // On test/localhost: RESTORE console immediately
        restoreConsole();

        // Use original console for logging (if available)
        if (originalConsole.log) {
            originalConsole.log('[Console Control] Hostname:', hostname);
            originalConsole.log('[Console Control] Is Production: false');
            originalConsole.log('[Console Control] Console ENABLED for test environment');
        }

        // Aggressive restoration: restore console multiple times to ensure it works
        // This handles cases where obfuscated code tries to disable console after we restore it

        // Immediate restoration
        restoreConsole();

        // Restore after a short delay
        setTimeout(() => {
            restoreConsole();
            if (originalConsole.log) {
                originalConsole.log('[Console Control] Console restored (100ms delay)');
            }
        }, 100);

        // Restore after longer delay (for async scripts)
        setTimeout(() => {
            restoreConsole();
        }, 500);

        // Restore on DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                restoreConsole();
                if (originalConsole.log) {
                    originalConsole.log('[Console Control] Console restored (DOMContentLoaded)');
                }
            });
        }

        // Restore on window load
        if (window.addEventListener) {
            window.addEventListener('load', () => {
                restoreConsole();
            });
        }

        // Continuous monitoring: restore console every 2 seconds for first 10 seconds
        // This ensures console stays enabled even if obfuscated code keeps disabling it
        let monitorCount = 0;
        const monitorInterval = setInterval(() => {
            restoreConsole();
            monitorCount++;
            if (monitorCount >= 5) { // 5 * 2 seconds = 10 seconds
                clearInterval(monitorInterval);
            }
        }, 2000);
    }
})();

