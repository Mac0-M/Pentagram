// models/Post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    caption: String,
    mediaPaths: [String],
    likes: [{ 
        userId: String, 
        likedAt: { type: Date, default: Date.now } 
    }], 
    comments: [{
        userId: String,
        text: String,
        createdAt: { type: Date, default: Date.now }
    }],
    reports: [{
        userId: String,
        timestamp: { type: Date, default: Date.now }
    }],
    suspended: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);