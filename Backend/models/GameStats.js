const mongoose = require('mongoose');

const GameStatsSchema = new mongoose.Schema({
  username: { type: String, required: true },
  game: { type: String, enum: ['lol', 'dota2'], required: true },
  gameId: { type: String, required: true }, // lolId or dotaId
  playerData: { type: Object, default: {} }, // e.g. player_name, rank_tier, rank_point (MMR)
  topHeroes: { type: Array, default: [] }, // Dota heroes or LoL champion stats
  matches: { type: Array, default: [] }, // Array of match summaries
  matchDetails: { type: Map, of: Object, default: {} }, // Cache of details key by match ID
  latestMatchId: { type: String, default: '' },
  score: { type: Number, default: 0 }, // For ranking on Dashboard
  rankingLabel: { type: String, default: '' } // e.g., Gold, Master, Immortal, etc.
}, { timestamps: true });

// Make compound unique index to prevent duplicate records
GameStatsSchema.index({ username: 1, game: 1 }, { unique: true });

module.exports = mongoose.model('GameStats', GameStatsSchema);
