const os = require('os');
const path = require('path');
const fs = require('fs');
const pty = require('node-pty');
const { verifySocketToken } = require('../middleware/auth');

// roomId -> { ptyProcess, users: Set<socketId>, outputBuffer: string }
// Terminals are shared per-room (like a real pair-programming shell) so
// everyone who joins sees the same session and its history so far.
const roomTerminals = new Map();

const MAX_BUFFER_CHARS = 20000; // scrollback kept for new joiners
const SHELL = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

function getOrCreateTerminal(roomId) {
  if (roomTerminals.has(roomId)) return roomTerminals.get(roomId);

  // Give each room's shell its own starting directory instead of the
  // server's real working directory - limits (but does not eliminate,
  // since it's a real shell and `cd` still works) the blast radius of
  // an accidental `rm -rf` or similar. See README security notes.
  const roomDir = path.join(os.tmpdir(), `codesync-term-${roomId}`);
  fs.mkdirSync(roomDir, { recursive: true });

  const ptyProcess = pty.spawn(SHELL, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: roomDir,
    env: process.env,
  });

  const session = { ptyProcess, users: new Set(), outputBuffer: '' };
  roomTerminals.set(roomId, session);
  return session;
}

function destroyTerminal(roomId) {
  const session = roomTerminals.get(roomId);
  if (!session) return;
  session.ptyProcess.kill();
  roomTerminals.delete(roomId);
}

function registerTerminalHandlers(io) {
  io.on('connection', (socket) => {
    let joinedTerminalRoomId = null;

    socket.on('terminal:join', async ({ roomId, token }) => {
      try {
        await verifySocketToken(token); // reuse the same JWT check as the editor socket
        const session = getOrCreateTerminal(roomId);
        session.users.add(socket.id);
        joinedTerminalRoomId = roomId;

        // Catch the new joiner up on whatever's already happened in this shell
        if (session.outputBuffer) {
          socket.emit('terminal:output', session.outputBuffer);
        }

        // Stream this room's shell output to every socket that's joined its terminal.
        // We attach the listener once per pty (not per socket) to avoid duplicate output -
        // guarded by checking if a listener was already attached below.
        if (!session.ptyProcess.__hasListener) {
          session.ptyProcess.onData((data) => {
            session.outputBuffer = (session.outputBuffer + data).slice(-MAX_BUFFER_CHARS);
            for (const socketId of session.users) {
              io.to(socketId).emit('terminal:output', data);
            }
          });
          session.ptyProcess.__hasListener = true;
        }
      } catch (err) {
        socket.emit('terminal:error', { message: 'Authentication failed, please log in again' });
      }
    });

    socket.on('terminal:input', ({ roomId, data }) => {
      const session = roomTerminals.get(roomId);
      if (!session || !session.users.has(socket.id)) return;
      session.ptyProcess.write(data);
    });

    socket.on('terminal:resize', ({ roomId, cols, rows }) => {
      const session = roomTerminals.get(roomId);
      if (!session || !session.users.has(socket.id)) return;
      session.ptyProcess.resize(cols, rows);
    });

    socket.on('disconnect', () => {
      if (!joinedTerminalRoomId) return;
      const session = roomTerminals.get(joinedTerminalRoomId);
      if (!session) return;
      session.users.delete(socket.id);
      // Kill the shell once the last collaborator leaves - no point keeping
      // a process alive with nobody watching it.
      if (session.users.size === 0) destroyTerminal(joinedTerminalRoomId);
    });
  });
}

module.exports = registerTerminalHandlers;
