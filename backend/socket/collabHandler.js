const Room = require('../models/Room');
const ChatMessage = require('../models/ChatMessage');
const { verifySocketToken } = require('../middleware/auth');

// In-memory presence tracking: roomId -> Map(socketId -> { userId, name, color, cursor })
// This is intentionally NOT stored in MongoDB - presence is ephemeral, per-connection
// state that should reset on disconnect, so keeping it in memory is the right call.
const roomPresence = new Map();

// A small fixed palette so each collaborator gets a distinct, consistent cursor color
const CURSOR_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0'];

const getRoomUsers = (roomId) => {
  const presenceMap = roomPresence.get(roomId);
  if (!presenceMap) return [];
  return Array.from(presenceMap.values());
};

// A short in-memory debounce so we don't hit MongoDB on every single keystroke.
// Each room gets its own timer; code is persisted ~1s after the last edit.
const saveTimers = new Map();
const scheduleSave = (roomId, code) => {
  if (saveTimers.has(roomId)) clearTimeout(saveTimers.get(roomId));
  const timer = setTimeout(async () => {
    try {
      await Room.findOneAndUpdate({ roomId }, { code });
    } catch (err) {
      console.error(`Failed to persist code for room ${roomId}:`, err.message);
    }
    saveTimers.delete(roomId);
  }, 1000);
  saveTimers.set(roomId, timer);
};

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Each socket tracks which room it's currently in, so we can clean up on disconnect
    let currentRoomId = null;

    // --- Join a coding session ---
    socket.on('join-room', async ({ roomId, token }) => {
      try {
        const user = await verifySocketToken(token);
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error-message', { message: 'Room not found' });
          return;
        }

        socket.join(roomId);
        currentRoomId = roomId;

        if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map());
        const presenceMap = roomPresence.get(roomId);
        const color = CURSOR_COLORS[presenceMap.size % CURSOR_COLORS.length];
        presenceMap.set(socket.id, { socketId: socket.id, userId: user._id, name: user.name, color });

        // Send the new joiner the current state (code + who's already here)
        socket.emit('room-state', { code: room.code, users: getRoomUsers(roomId) });

        // Tell everyone else in the room that someone new joined
        socket.to(roomId).emit('user-joined', { users: getRoomUsers(roomId) });
      } catch (err) {
        socket.emit('error-message', { message: 'Authentication failed, please log in again' });
      }
    });

    // --- A collaborator typed something in the editor ---
    socket.on('code-change', ({ roomId, code }) => {
      // Broadcast the new content to everyone else instantly...
      socket.to(roomId).emit('code-update', { code });
      // ...and persist it to MongoDB after a short debounce
      scheduleSave(roomId, code);
    });

    // --- A collaborator moved their cursor / text selection ---
    socket.on('cursor-change', ({ roomId, position }) => {
      const presenceMap = roomPresence.get(roomId);
      if (!presenceMap || !presenceMap.has(socket.id)) return;
      const user = presenceMap.get(socket.id);
      user.cursor = position;
      socket.to(roomId).emit('cursor-update', { socketId: socket.id, name: user.name, color: user.color, position });
    });

    // --- Chat message ---
    socket.on('send-message', async ({ roomId, text }) => {
      const presenceMap = roomPresence.get(roomId);
      const user = presenceMap?.get(socket.id);
      if (!user || !text?.trim()) return;

      try {
        const room = await Room.findOne({ roomId });
        const message = await ChatMessage.create({
          room: room._id,
          sender: user.userId,
          senderName: user.name,
          text: text.trim(),
        });

        io.to(roomId).emit('new-message', {
          senderName: message.senderName,
          text: message.text,
          createdAt: message.createdAt,
        });
      } catch (err) {
        console.error('Failed to save chat message:', err.message);
      }
    });

    // --- Someone ran the code (execution happens over REST; this just
    //     broadcasts the result to everyone else in the room so the whole
    //     team sees the output, not just whoever clicked Run) ---
    socket.on('broadcast-output', ({ roomId, output, ranBy }) => {
      socket.to(roomId).emit('run-output', { output, ranBy });
    });

    // --- Language change (e.g. switching from JavaScript to Python) ---
    socket.on('language-change', async ({ roomId, language }) => {
      socket.to(roomId).emit('language-update', { language });
      try {
        await Room.findOneAndUpdate({ roomId }, { language });
      } catch (err) {
        console.error('Failed to persist language change:', err.message);
      }
    });

    // --- Cleanup when a user leaves or disconnects ---
    socket.on('disconnect', () => {
      if (!currentRoomId) return;
      const presenceMap = roomPresence.get(currentRoomId);
      if (presenceMap) {
        presenceMap.delete(socket.id);
        socket.to(currentRoomId).emit('user-left', {
          socketId: socket.id,
          users: getRoomUsers(currentRoomId),
        });
        if (presenceMap.size === 0) roomPresence.delete(currentRoomId);
      }
    });
  });
}

module.exports = registerSocketHandlers;
