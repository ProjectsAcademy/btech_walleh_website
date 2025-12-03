/**
 * Console Control Utility
 * Automatically disables console logs on production domain (btechwalleh.com)
 * Keeps console logs enabled on localhost and test domains
 */

(function () {
    'use strict';

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

    // Debug: Log the detection (using original console before any changes)
    console.log('[Console Control] Hostname:', hostname);
    console.log('[Console Control] Is Production:', isProduction);
    console.log('[Console Control] Console will be', isProduction ? 'DISABLED' : 'ENABLED');

    // If on production, disable console methods
    if (isProduction) {
        const noop = function () { };

        // Override console methods with no-op functions
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
    // On localhost or test domains, console works normally (no changes needed)
    // The obfuscation script should have disableConsoleOutput: false on test branches
})();

