const { verifySocketToken } = require('../middleware/auth');

// roomId -> Map(socketId -> { userId, name })
// This is separate from collabHandler's presence map on purpose: video
// participation is opt-in (not everyone in a coding session wants their
// camera on), so who's "in the call" is tracked independently from who's
// just viewing/editing the room.
const roomCallParticipants = new Map();

function registerVideoHandlers(io) {
  io.on('connection', (socket) => {
    let joinedCallRoomId = null;

    // --- User clicks "Join Call" ---
    socket.on('video:join', async ({ roomId, token }) => {
      try {
        const user = await verifySocketToken(token);
        if (!roomCallParticipants.has(roomId)) roomCallParticipants.set(roomId, new Map());
        const participants = roomCallParticipants.get(roomId);

        // Tell the new joiner who's already in the call, so THEY initiate
        // an offer to each existing participant (avoids both sides racing
        // to send offers to each other at the same time).
        const existingPeers = Array.from(participants.entries()).map(([socketId, p]) => ({
          socketId,
          name: p.name,
        }));
        socket.emit('video:existing-peers', existingPeers);

        participants.set(socket.id, { userId: user._id, name: user.name });
        joinedCallRoomId = roomId;

        socket.to(roomId).emit('video:peer-joined', { socketId: socket.id, name: user.name });
      } catch (err) {
        socket.emit('video:error', { message: 'Authentication failed, please log in again' });
      }
    });

    // --- WebRTC signaling relay ---
    // None of these events carry actual audio/video - that travels directly
    // peer-to-peer once the connection is established. The server's only job
    // here is passing along the connection-negotiation messages.
    socket.on('video:offer', ({ to, offer }) => {
      io.to(to).emit('video:offer', { from: socket.id, offer });
    });

    socket.on('video:answer', ({ to, answer }) => {
      io.to(to).emit('video:answer', { from: socket.id, answer });
    });

    socket.on('video:ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('video:ice-candidate', { from: socket.id, candidate });
    });

    socket.on('video:leave', ({ roomId }) => {
      leaveCall(socket, roomId);
    });

    socket.on('disconnect', () => {
      if (joinedCallRoomId) leaveCall(socket, joinedCallRoomId);
    });

    function leaveCall(socket, roomId) {
      const participants = roomCallParticipants.get(roomId);
      if (!participants) return;
      participants.delete(socket.id);
      socket.to(roomId).emit('video:peer-left', { socketId: socket.id });
      if (participants.size === 0) roomCallParticipants.delete(roomId);
    }
  });
}

module.exports = registerVideoHandlers;
