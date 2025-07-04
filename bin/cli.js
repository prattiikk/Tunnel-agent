#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startAgent } from '../lib/agent.js';
import { authenticate, getToken, logout, showStatus } from '../lib/auth.js';
import { config } from '../lib/config.js';

// CLI Configuration
const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <command>')
    .command('expose', 'Expose your localhost', {
        port: { 
            describe: 'Local port to expose', 
            demandOption: true, 
            type: 'number', 
            alias: 'p' 
        },
        name: { 
            describe: 'Unique name/ID for your tunnel', 
            demandOption: true, 
            type: 'string', 
            alias: 'n' 
        },
        server: { 
            describe: 'Tunnel server URL', 
            type: 'string', 
            default: config.DEFAULT_TUNNEL_SERVER, 
            alias: 's' 
        },
        description: {
            describe: 'Description for your tunnel',
            type: 'string',
            default: 'Tunnel created via CLI',
            alias: 'd'
        }
    })
    .command('auth', 'Authenticate with the server', {
        server: { 
            describe: 'Server URL', 
            type: 'string', 
            default: config.DEFAULT_AUTH_SERVER, 
            alias: 's' 
        }
    })
    .command('logout', 'Clear authentication token')
    .command('status', 'Show authentication status')
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .demandCommand(1, 'You must specify a command')
    .argv;

// Command handlers
const command = argv._[0];

(async () => {
    try {
        switch (command) {
            case 'expose':
                console.log(`🚀 Starting tunnel: localhost:${argv.port} → ${argv.name}`);
                const token = await getToken(config.DEFAULT_AUTH_SERVER);
                console.log('🔗 Establishing tunnel connection...');
                await startAgent(argv.port, argv.name, token, argv.description);
                break;
                
            case 'auth':
                await authenticate(argv.server);
                console.log('🎉 Authentication complete!');
                break;
                
            case 'logout':
                logout();
                break;
                
            case 'status':
                showStatus();
                break;
                
            default:
                console.error('❌ Unknown command:', command);
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();