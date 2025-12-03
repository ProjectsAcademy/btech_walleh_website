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
    const isProduction = productionDomains.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
    );

    // If on production, disable console methods
    if (isProduction) {
        // Store original console methods (optional, for debugging)
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
})();

