// Netlify serverless function to securely provide API credentials to frontend
// This prevents exposing credentials in client-side code

exports.handler = async (event, context) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // CORS headers for frontend access
    // Get origin from request or use environment variable for production
    const allowedOrigins = [
        'https://btechwalleh.com',
        'https://www.btechwalleh.com',
        'https://test.btechwalleh.com',
        'https://www.test.btechwalleh.com',
        'http://localhost:8000',
        'http://localhost:3000',
        'http://127.0.0.1:8000'
    ];

    // Add Netlify preview URLs if in preview mode
    if (process.env.CONTEXT === 'deploy-preview' || process.env.CONTEXT === 'branch-deploy') {
        const deployUrl = process.env.DEPLOY_PRIME_URL;
        if (deployUrl) {
            allowedOrigins.push(deployUrl);
        }
    }

    const origin = event.headers.origin || event.headers.Origin || '';
    const isAllowedOrigin = allowedOrigins.some(allowed => origin.includes(allowed)) || origin === '';

    const headers = {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin || '*' : allowedOrigins[0],
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // Get credentials from environment variables
        const credentials = {
            googleClientId: process.env.GOOGLE_CLIENT_ID || '',
            googleApiKey: process.env.GOOGLE_API_KEY || '',
            rapidApiKey: process.env.RAPIDAPI_KEY || ''
        };

        // Validate that credentials are set
        const missing = [];
        if (!credentials.googleClientId) missing.push('GOOGLE_CLIENT_ID');
        if (!credentials.googleApiKey) missing.push('GOOGLE_API_KEY');
        if (!credentials.rapidApiKey) missing.push('RAPIDAPI_KEY');

        if (missing.length > 0) {
            console.error('Missing environment variables:', missing.join(', '));
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Server configuration error',
                    message: 'Some credentials are not configured. Please contact the administrator.'
                })
            };
        }

        // Return credentials (they're safe to expose as they're public API keys)
        // Note: These are public keys meant for client-side use, not secrets
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                credentials: {
                    googleClientId: credentials.googleClientId,
                    googleApiKey: credentials.googleApiKey,
                    rapidApiKey: credentials.rapidApiKey
                }
            })
        };
    } catch (error) {
        console.error('Error in get-credentials function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: 'Failed to retrieve credentials'
            })
        };
    }
};

