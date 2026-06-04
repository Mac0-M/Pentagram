const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  password: { type: String, required: true },
  mfaSecret: String
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
