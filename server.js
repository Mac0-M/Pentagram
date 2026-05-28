// ==========================================
// 1. IMPORT & SETUP
// ==========================================
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

// เพิ่มส่วน Swagger
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
// ตรวจสอบให้แน่ใจว่าไฟล์ swagger.yaml อยู่ในโฟลเดอร์ ./docs/
const swaggerDocument = YAML.load('./docs/swagger.yaml');

const Post = require('./models/Post');

const app = express();
app.use(cors());
app.use(express.json());

// ตั้งค่า Swagger Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ==========================================
// 2. CONFIGURATION & MIDDLEWARE
// ==========================================
// 1. เชื่อมต่อ MongoDB
mongoose.connect('mongodb://localhost:27017/Pentagram')
    .then(() => console.log("Connected to MongoDB: Pentagram"))
    .catch(err => console.error("Could not connect", err));

// 3. ตั้งค่า Multer
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static('uploads'));

// ==========================================
// 3. API ENDPOINTS
// ==========================================

// --- โพสต์ ---
app.post('/api/posts', upload.array('files', 10), async (req, res) => {
    try {
        const newPost = new Post({
            userId: req.body.userId,
            caption: req.body.caption,
            mediaPaths: req.files.map(file => file.path.replace(/\\/g, '/'))
        });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/posts/:id', async (req, res) => {
    try {
        const post = await Post.findByIdAndDelete(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });

        post.mediaPaths.forEach(filePath => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        res.json({ message: "Post deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Likes & Comments ---
app.put('/api/posts/:id/like', async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const likeIndex = post.likes.findIndex(l => l.userId === userId);
        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1);
        } else {
            post.likes.push({ userId, likedAt: new Date() });
        }
        await post.save();
        res.json({ likes: post.likes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const { userId, text } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });

        post.comments.push({ userId, text });
        await post.save();
        res.status(201).json(post.comments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- รายงาน & Favorite ---
app.post('/api/posts/:id/report', async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const alreadyReported = post.reports.some(r => r.userId === userId);
        if (alreadyReported) {
            return res.status(400).json({ message: "คุณได้รายงานโพสต์นี้ไปแล้ว" });
        }

        post.reports.push({ userId });
        if (post.reports.length >= 3) {
            post.suspended = true;
        }

        await post.save();
        res.json({ message: "รายงานโพสต์สำเร็จ", suspended: post.suspended });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/posts/liked/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const posts = await Post.find({ 'likes.userId': userId });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Leaderboard ---
app.get('/api/get-friend-scores', (req, res) => {
    fs.readFile('./scores.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: "ไม่พบไฟล์ข้อมูล" });
        }
        const players = JSON.parse(data);
        players.sort((a, b) => b.score - a.score);
        res.json(players);
    });
});

// ==========================================
// 4. START SERVER
// ==========================================
app.listen(3000, () => console.log('Server running on port 3000'));