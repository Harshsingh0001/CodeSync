const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true }, // short shareable code, e.g. "a1b2c3"
    title: { type: String, default: 'Untitled Session' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    language: { type: String, default: 'javascript' },
    code: { type: String, default: '' }, // last saved editor content, so users can rejoin later
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
