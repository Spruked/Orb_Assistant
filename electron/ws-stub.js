// Lightweight WebSocket stub to make the orb UI show online state without CALI.
// Run from electron/: npm install && npm run ws:stub

const WebSocket = require('ws');

// Default to 9876 to avoid collisions; override with ORB_WS_PORT if needed.
const PORT = process.env.ORB_WS_PORT ? Number(process.env.ORB_WS_PORT) : 9876;
let wss;
try {
  wss = new WebSocket.Server({ port: PORT });
} catch (err) {
  if (err.code === 'EADDRINUSE') {
    console.error(`WS stub failed: port ${PORT} is in use. Free it (e.g., kill old node) and retry.`);
    process.exit(1);
  }
  throw err;
}

wss.on('listening', () => {
  console.log(`WS stub listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  // Immediately report healthy cognition
  ws.send(JSON.stringify({ type: 'cali_status', data: { health: 1.0 } }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'orb_status_request') {
        ws.send(JSON.stringify({ type: 'status_response', data: { health_score: 1.0 } }));
      } else if (msg.type === 'orb_query') {
        const text = msg.text || '';
        ws.send(
          JSON.stringify({
            type: 'query_result',
            data: { text: `Echo: ${text}`, confidence: 0.9 },
          })
        );
      }
    } catch (err) {
      console.error('Stub parse error:', err);
    }
  });
});

wss.on('error', (err) => {
  console.error('WS stub error:', err);
});
