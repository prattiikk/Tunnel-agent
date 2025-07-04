import fetch from 'node-fetch';
import fs from 'fs';
import { config } from './config.js';

/**
 * Request a device code from the server
 */
async function requestDeviceCode(serverUrl) {
    const apiUrl = config.toHttpUrl(serverUrl);
    const response = await fetch(`${apiUrl}/api/auth/request-device-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to request device code: ${response.status} ${error}`);
    }

    const data = await response.json();
    if (!data.code || !data.url) {
        throw new Error('Invalid response from server - missing code or url');
    }

    return data;
}

/**
 * Poll the server for authentication status
 */
async function pollForAuth(serverUrl, code, maxAttempts = config.POLL_MAX_ATTEMPTS) {
    const apiUrl = config.toHttpUrl(serverUrl);
    console.log('Waiting for authentication...');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, config.POLL_INTERVAL));

        try {
            const response = await fetch(`${apiUrl}/api/device/poll?code=${encodeURIComponent(code)}`, {
                method: 'GET'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    console.log('✅ Authentication successful!');
                    return data.token;
                }
            } else if (response.status === 404) {
                throw new Error('Device code not found or expired');
            } else if (response.status === 429) {
                console.log('⏳ Rate limited, waiting longer...');
                await new Promise(resolve => setTimeout(resolve, config.RATE_LIMIT_WAIT));
            }
        } catch (error) {
            if (attempt === maxAttempts - 1) {
                throw error;
            }
            console.log(`⚠️  Polling attempt ${attempt + 1} failed: ${error.message}`);
        }

        if (attempt % 5 === 0 && attempt > 0) {
            console.log(`⏳ Still waiting... (${attempt}/${maxAttempts})`);
        }
    }

    throw new Error('Authentication timed out. Please try again.');
}

/**
 * Complete authentication flow
 */
export async function authenticate(serverUrl) {
    console.log('🔐 Starting authentication...');
    console.log("Server:", serverUrl);

    const { code, url, expiresIn } = await requestDeviceCode(serverUrl);
    console.log(`🔁 Polling for code: ${code} on server: ${serverUrl}`);

    // Display instructions to user
    console.log('\n' + '='.repeat(60));
    console.log('🌐 AUTHENTICATION REQUIRED');
    console.log('='.repeat(60));
    console.log(`1. Open this URL in your browser:`);
    console.log(`   ${url}`);
    console.log(`\n2. Enter this code:`);
    console.log(`   ${code}`);
    console.log('='.repeat(60));
    console.log(`💡 Tip: The code will expire in ${Math.floor(expiresIn / 60)} minutes\n`);

    // Poll for authentication
    const token = await pollForAuth(serverUrl, code);

    // Store token securely
    const tokenData = {
        token,
        timestamp: Date.now(),
        serverUrl: config.toHttpUrl(serverUrl)
    };

    fs.writeFileSync(config.TOKEN_PATH, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
    console.log('💾 Token saved successfully!');
    return token;
}

/**
 * Get existing token or authenticate if needed
 */
export async function getToken(serverUrl) {
    try {
        if (fs.existsSync(config.TOKEN_PATH)) {
            const tokenData = JSON.parse(fs.readFileSync(config.TOKEN_PATH, 'utf8'));
            const tokenAge = Date.now() - (tokenData.timestamp || 0);

            if (tokenData.token && tokenAge < config.TOKEN_MAX_AGE) {
                console.log('✅ Using existing authentication token');
                return tokenData.token;
            } else {
                console.log('⚠️  Token expired, reauthenticating...');
            }
        } else {
            console.log('🔐 No token found, authenticating...');
        }
    } catch (error) {
        console.log('⚠️ Error reading token:', error.message);
    }

    return await authenticate(serverUrl);
}

/**
 * Clear stored authentication
 */
export function logout() {
    try {
        if (fs.existsSync(config.TOKEN_PATH)) {
            fs.unlinkSync(config.TOKEN_PATH);
            console.log('✅ Logged out successfully!');
        } else {
            console.log('ℹ️  No authentication token found');
        }
    } catch (error) {
        console.error('❌ Failed to logout:', error.message);
    }
}

/**
 * Show current authentication status
 */
export function showStatus() {
    try {
        if (fs.existsSync(config.TOKEN_PATH)) {
            const tokenData = JSON.parse(fs.readFileSync(config.TOKEN_PATH, 'utf8'));
            const tokenAge = Date.now() - (tokenData.timestamp || 0);
            const daysOld = Math.floor(tokenAge / (24 * 60 * 60 * 1000));

            console.log('✅ Authenticated');
            console.log(`   Server: ${tokenData.serverUrl || 'Unknown'}`);
            console.log(`   Token age: ${daysOld} days`);
            console.log(`   Expires: ${29 - daysOld} days remaining`);
        } else {
            console.log('❌ Not authenticated');
        }
    } catch (error) {
        console.log('⚠️  Authentication status unclear:', error.message);
    }
}