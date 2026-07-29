const express = require('express');
const crypto = require('crypto');
const Room = require('../models/Room');
const ChatMessage = require('../models/ChatMessage');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Generates a short, URL-safe room code like "a1b2c3"
const generateRoomId = () => crypto.randomBytes(4).toString('hex');

// @route   POST /api/rooms
// @desc    Create a new collaborative coding session
router.post('/', async (req, res) => {
  try {
    const { title, language } = req.body;
    const room = await Room.create({
      roomId: generateRoomId(),
      title: title || 'Untitled Session',
      owner: req.user._id,
      language: language || 'javascript',
      code: '// Start coding together...\n',
    });
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create room', error: err.message });
  }
});

// @route   GET /api/rooms
// @desc    List rooms created by the logged-in user
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch rooms', error: err.message });
  }
});

// @route   GET /api/rooms/:roomId
// @desc    Get a single room's saved code + chat history by its shareable roomId.
//          Anyone with the link can join - that's the point of a shareable session.
router.get('/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const messages = await ChatMessage.find({ room: room._id })
      .sort({ createdAt: 1 })
      .limit(100); // cap history so old sessions don't send huge payloads

    res.json({ room, messages });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch room', error: err.message });
  }
});

module.exports = router;
