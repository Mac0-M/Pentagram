const mongoose = require('mongoose');
const crypto = require('crypto');

const MediaItemSchema = new mongoose.Schema({
  image: { type: String, default: '' },
  text: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const profileSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  shareId: {
    type: String,
    unique: true,
    sparse: true,
    default: () => crypto.randomBytes(16).toString('hex')
  },
  avatar: String,
  verified: { type: Boolean, default: false },
  lolId: String,
  dotaId: String,
  skillTags: { type: [String], default: [] },
  trophies: {
    type: [MediaItemSchema],
    default: [],
    validate: {
      validator: (items) => Array.isArray(items) && items.length <= 10,
      message: 'Trophies can have at most 10 items'
    }
  },
  achievements: {
    type: [MediaItemSchema],
    default: [],
    validate: {
      validator: (items) => Array.isArray(items) && items.length <= 10,
      message: 'Achievements can have at most 10 items'
    }
  },
  activityData: { type: Map, of: Number, default: {} },
  mobaScore: { type: Number, default: null },
  rankTierLabel: { type: String, default: null },
  rankSkill: { type: Number, default: null },
  winEfficiency: { type: Number, default: null },
  combatPerformance: { type: Number, default: null },
  economySkill: { type: Number, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
