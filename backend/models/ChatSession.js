const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true, maxlength: 30000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const chatSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  title: { type: String, trim: true, maxlength: 120, default: 'New Chat' },
  messages: { type: [chatMessageSchema], default: [] },
  lastActivityAt: { type: Date, default: Date.now, index: true },
  archived: { type: Boolean, default: false }
}, { timestamps: true });

chatSessionSchema.index({ user: 1, lastActivityAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
