import WebSocket from 'ws';
import axios from 'axios';
import chalk from 'chalk';

/**
 * Connects to tunnel server and handles forwarding logic
 * @param {number} port - The local service port to expose
 * @param {string} agentId - Unique ID or name of the agent (e.g., "pratik050403")
 */


const tunnelServerUrl = "http://localhost:8080"


export function startAgent(port, agentId, token, description = "new default tunnel") {
  console.log("creating tunnel to server : ", tunnelServerUrl)
  const ws = new WebSocket(tunnelServerUrl);

  ws.on('open', () => {
    console.log(chalk.green(`[✓] Connected to tunnel server at ${tunnelServerUrl}`));
    const cleanToken = token.trim();
    console.log("token is :", cleanToken);



    ws.send(JSON.stringify({
      type: 'register',
      name: agentId,
      token: cleanToken,
      port,
      description
    }));

    console.log(chalk.blue(`[~] Registered as: ${agentId}`));
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (err) {
      console.error(chalk.red(`[x] Failed to parse message: ${err.message}`));
      return;
    }

    // if tunnel is registered then console log the response from the server
    if (msg.type === "registered") {
      const { tunnel } = msg;
      console.log("tunnel registered : ", tunnel);
    }
    if (msg.type === "error") {
      console.error("error occured!")
    }



    if (msg.type === 'request') {
      const { id, method, headers, path, body } = msg;

      try {
        const response = await axios({
          url: `http://localhost:${port}${path}`,
          method,
          headers,
          data: body,
          validateStatus: () => true,
        });

        ws.send(JSON.stringify({
          type: 'response',
          id,
          statusCode: response.status,
          headers: response.headers,
          body: response.data,
        }));
      } catch (err) {
        console.error(chalk.red(`[x] Request error: ${err.message}`));
        ws.send(JSON.stringify({
          type: 'response',
          id,
          statusCode: 500,
          headers: {},
          body: err.message,
        }));
      }
    }
  });

  ws.on('close', () => {
    console.log(chalk.yellow('[!] Disconnected from tunnel server'));
  });

  ws.on('error', (err) => {
    console.error(chalk.red(`[x] WebSocket error: ${err.message}`));
  });
}