const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:14444');

ws.on('open', function open() {
  console.log('Connected to WebSocket server');
  const fakeBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  ws.send(fakeBase64);
  console.log('Message sent');
  process.exit(0);
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
  process.exit(1);
});
