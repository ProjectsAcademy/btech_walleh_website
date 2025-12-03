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

    // Function to disable console methods (only if writable)
    function disableConsole() {
        const noop = function () { };
        if (typeof console !== 'undefined') {
            // Check if properties are writable before trying to assign
            const consoleMethods = ['log', 'error', 'warn', 'info', 'debug', 'trace', 'table', 'group', 'groupEnd', 'groupCollapsed', 'time', 'timeEnd', 'count', 'clear'];
            consoleMethods.forEach(method => {
                try {
                    const descriptor = Object.getOwnPropertyDescriptor(console, method);
                    // Only assign if property is writable or doesn't exist
                    if (!descriptor || descriptor.writable !== false) {
                        console[method] = noop;
                    }
                } catch (e) {
                    // If we can't check or assign, ignore
                }
            });
        }
    }

    // Apply console control based on environment
    if (isProduction) {
        // On production: disable console IMMEDIATELY and make it read-only

        // Step 1: First disable console methods (if writable)
        disableConsole();

        // Step 2: Make console methods read-only using Object.defineProperty
        // This prevents obfuscated code from restoring console
        const noop = function () { };
        const consoleMethods = ['log', 'error', 'warn', 'info', 'debug', 'trace', 'table', 'group', 'groupEnd', 'groupCollapsed', 'time', 'timeEnd', 'count', 'clear'];

        consoleMethods.forEach(method => {
            try {
                Object.defineProperty(console, method, {
                    value: noop,
                    writable: false,
                    configurable: false,
                    enumerable: true
                });
            } catch (e) {
                // If defineProperty fails for this method, continue with others
            }
        });

        // Step 3: Use Proxy to intercept any attempts to modify console methods (if supported)
        // This must be done BEFORE making properties read-only, so we'll skip it if already read-only
        try {
            const consoleProxy = new Proxy(console, {
                set: function (target, prop, value) {
                    // Block any attempts to restore console methods
                    if (consoleMethods.includes(prop)) {
                        // Don't try to assign if property is read-only
                        try {
                            const descriptor = Object.getOwnPropertyDescriptor(target, prop);
                            if (descriptor && descriptor.writable === false) {
                                // Property is read-only, just return true (assignment blocked)
                                return true;
                            }
                            // If writable, set to noop
                            const noop = function () { };
                            target[prop] = noop;
                        } catch (e) {
                            // If assignment fails, that's fine - property is protected
                        }
                        return true;
                    }
                    // For other properties, allow assignment
                    try {
                        target[prop] = value;
                    } catch (e) {
                        // If assignment fails, ignore
                    }
                    return true;
                }
            });
            // Try to replace window.console with proxy (only if console is still configurable)
            try {
                const consoleDescriptor = Object.getOwnPropertyDescriptor(window, 'console');
                if (!consoleDescriptor || consoleDescriptor.configurable !== false) {
                    Object.defineProperty(window, 'console', {
                        value: consoleProxy,
                        writable: false,
                        configurable: false
                    });
                }
            } catch (e) {
                // If we can't replace, that's okay - properties are already read-only
            }
        } catch (e) {
            // If Proxy is not available, that's okay - properties are already read-only
        }

        // Step 4: Monitor for any attempts to restore console (but don't try to assign to read-only properties)
        // Check every 500ms to see if console methods have been restored (shouldn't happen if read-only)
        const productionMonitorInterval = setInterval(() => {
            // Just verify they're still disabled, don't try to assign if read-only
            consoleMethods.forEach(method => {
                try {
                    const descriptor = Object.getOwnPropertyDescriptor(console, method);
                    // If property is writable and not a noop, disable it
                    if (descriptor && descriptor.writable !== false) {
                        console[method] = noop;
                        // Try to make it read-only again
                        try {
                            Object.defineProperty(console, method, {
                                value: noop,
                                writable: false,
                                configurable: false
                            });
                        } catch (e) {
                            // If we can't make it read-only, that's okay
                        }
                    }
                } catch (e) {
                    // Ignore errors
                }
            });
        }, 500); // Check every 500ms

        // Also verify on page events (but don't try to assign to read-only properties)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // Just verify, don't assign if read-only
                consoleMethods.forEach(method => {
                    try {
                        const descriptor = Object.getOwnPropertyDescriptor(console, method);
                        if (descriptor && descriptor.writable !== false) {
                            console[method] = noop;
                        }
                    } catch (e) {
                        // Ignore
                    }
                });
            });
        }

        if (window.addEventListener) {
            window.addEventListener('load', () => {
                // Just verify, don't assign if read-only
                consoleMethods.forEach(method => {
                    try {
                        const descriptor = Object.getOwnPropertyDescriptor(console, method);
                        if (descriptor && descriptor.writable !== false) {
                            console[method] = noop;
                        }
                    } catch (e) {
                        // Ignore
                    }
                });
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

