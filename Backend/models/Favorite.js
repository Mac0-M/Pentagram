const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  createdAt: { type: Date, default: Date.now }
});

favoriteSchema.index({ userId: 1, postId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
