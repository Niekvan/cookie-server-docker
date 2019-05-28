const webSocket = require('ws');
const server = require('http').createServer();
const app = require('./src/app');
const port = 8080;

// WEBSOCKET
const wss = new webSocket.Server({
  server
});

server.on('request', app);

wss.on('connection', ws => {
  console.log('new connection');
  ws.on('message', message => {
    console.log(message);
    ws.send('received');
  });
});

server.listen(port, () => {
  console.log('server listening on port: ' + port);
})
