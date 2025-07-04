import WebSocket from 'ws';
import axios from 'axios';
import chalk from 'chalk';
import { config } from './config.js';

/**
 * Connects to tunnel server and handles forwarding logic
 * @param {number} port - The local service port to expose
 * @param {string} agentId - Unique ID or name of the agent
 * @param {string} token - Authentication token
 * @param {string} description - Description for the tunnel
 */
export function startAgent(port, agentId, token, description = config.DEFAULT_DESCRIPTION) {
    return new Promise((resolve, reject) => {
        const tunnelServerUrl = config.DEFAULT_TUNNEL_SERVER;
        console.log("Creating tunnel to server:", tunnelServerUrl);
        
        const ws = new WebSocket(tunnelServerUrl);
        let isConnected = false;

        ws.on('open', () => {
            console.log(chalk.green(`[✓] Connected to tunnel server at ${tunnelServerUrl}`));
            const cleanToken = token.trim();
            
            ws.send(JSON.stringify({
                type: 'register',
                name: agentId,
                token: cleanToken,
                port,
                description
            }));

            console.log(chalk.blue(`[~] Registering as: ${agentId}`));
        });

        ws.on('message', async (data) => {
            let msg;
            try {
                msg = JSON.parse(data);
            } catch (err) {
                console.error(chalk.red(`[x] Failed to parse message: ${err.message}`));
                return;
            }

            await handleMessage(msg, ws, port, agentId);
            
            // Resolve promise once registered successfully
            if (msg.type === "registered" && !isConnected) {
                isConnected = true;
                resolve();
            }
        });

        ws.on('close', (code, reason) => {
            console.log(chalk.yellow(`[!] Disconnected from tunnel server (${code}: ${reason})`));
            if (!isConnected) {
                reject(new Error(`Connection closed before registration: ${code} ${reason}`));
            }
        });

        ws.on('error', (err) => {
            console.error(chalk.red(`[x] WebSocket error: ${err.message}`));
            if (!isConnected) {
                reject(err);
            }
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\n[!] Shutting down tunnel...'));
            ws.close();
            process.exit(0);
        });
    });
}

/**
 * Handle incoming messages from tunnel server
 */
async function handleMessage(msg, ws, port, agentId) {
    switch (msg.type) {
        case 'registered':
            handleRegistered(msg);
            break;
        case 'error':
            handleError(msg);
            break;
        case 'request':
            await handleRequest(msg, ws, port);
            break;
        default:
            console.log(chalk.gray(`[i] Unknown message type: ${msg.type}`));
    }
}

/**
 * Handle successful registration
 */
function handleRegistered(msg) {
    const { tunnel } = msg;
    console.log(chalk.green('[✓] Tunnel registered successfully!'));
    console.log(chalk.cyan(`[→] Public URL: ${tunnel.url || 'Not provided'}`));
    console.log(chalk.cyan(`[→] Tunnel ID: ${tunnel.id || 'Not provided'}`));
    console.log(chalk.gray('[i] Tunnel is ready to receive requests'));
}

/**
 * Handle error messages
 */
function handleError(msg) {
    console.error(chalk.red(`[x] Server error: ${msg.message || 'Unknown error'}`));
    if (msg.fatal) {
        process.exit(1);
    }
}

/**
 * Handle incoming HTTP requests
 */
async function handleRequest(msg, ws, port) {
    const { id, method, headers, path, body } = msg;
    
    console.log(chalk.blue(`[→] ${method} ${path}`));
    
    try {
        const response = await axios({
            url: `http://localhost:${port}${path}`,
            method,
            headers: cleanHeaders(headers),
            data: body,
            validateStatus: () => true, // Don't throw on HTTP error status
            timeout: 30000, // 30 second timeout
        });

        ws.send(JSON.stringify({
            type: 'response',
            id,
            statusCode: response.status,
            headers: response.headers,
            body: response.data,
        }));
        
        console.log(chalk.green(`[✓] ${response.status} ${response.statusText}`));
    } catch (err) {
        console.error(chalk.red(`[x] Request error: ${err.message}`));
        
        ws.send(JSON.stringify({
            type: 'response',
            id,
            statusCode: 500,
            headers: { 'content-type': 'text/plain' },
            body: `Tunnel Error: ${err.message}`,
        }));
    }
}

/**
 * Clean headers for axios request
 */
function cleanHeaders(headers) {
    if (!headers) return {};
    
    // Remove headers that might cause issues
    const cleanedHeaders = { ...headers };
    delete cleanedHeaders['host'];
    delete cleanedHeaders['connection'];
    delete cleanedHeaders['upgrade'];
    
    return cleanedHeaders;
}