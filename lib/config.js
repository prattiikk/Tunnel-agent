import path from 'path';

export const config = {
    // Server URLs - hardcoded for simplicity since users can see the code anyway
    DEFAULT_AUTH_SERVER: 'http://localhost:3000',
    DEFAULT_TUNNEL_SERVER: 'ws://localhost:8080',
    
    // File paths
    TOKEN_PATH: path.join(process.env.HOME || process.env.USERPROFILE, '.ngrok_clone_token.json'),
    
    // Authentication settings
    TOKEN_MAX_AGE: 29 * 24 * 60 * 60 * 1000, // 29 days
    POLL_MAX_ATTEMPTS: 30,
    POLL_INTERVAL: 2000, // 2 seconds
    RATE_LIMIT_WAIT: 5000, // 5 seconds
    
    // Tunnel settings
    DEFAULT_DESCRIPTION: 'New tunnel created bro!',
    
    // Request settings
    REQUEST_TIMEOUT: 30000, // 30 seconds
    
    // Utils
    toHttpUrl: (url) => {
        if (url.startsWith('ws://')) {
            return url.replace('ws://', 'http://');
        }
        if (url.startsWith('wss://')) {
            return url.replace('wss://', 'https://');
        }
        return url;
    }
};