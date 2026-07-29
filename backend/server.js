require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const executeRoutes = require('./routes/execute');
const registerSocketHandlers = require('./socket/collabHandler');
const registerTerminalHandlers = require('./socket/terminalHandler');
const registerVideoHandlers = require('./socket/videoHandler');

const app = express();
connectDB();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'CodeSync API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/execute', executeRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

// Socket.io needs to attach to the raw HTTP server, not the Express app directly,
// so both REST (Express) and WebSocket (Socket.io) traffic can share one port.
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] },
});

registerSocketHandlers(io);
registerTerminalHandlers(io);
registerVideoHandlers(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`CodeSync server running on port ${PORT}`));
