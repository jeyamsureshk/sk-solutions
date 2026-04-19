const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*" } 
});

function checkProductionEfficiency(value) {
  if (value < 75) {
    io.emit('low_efficiency_alert', {
      message: '⚠️ WARNING: Team efficiency below 75%! Critical action needed.',
      value: value,
      timestamp: new Date().toLocaleTimeString()
    });
  }
}

io.on('connection', (socket) => {
  console.log('Supervisor App Connected:', socket.id);
  
  // Test alert: trigger 5 seconds after you open the app
  setTimeout(() => checkProductionEfficiency(70), 5000);
});

// Use 0.0.0.0 to listen on your network
server.listen(3000, '0.0.0.0', () => {
  console.log('Efficiency Tracker Server: http://10.88.164.98:3000');
});
