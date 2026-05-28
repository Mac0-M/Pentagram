const mongoose = require('mongoose');
const Post = require('./models/Post'); // ตรวจสอบ path ให้ตรงกับโครงสร้างของคุณ

async function clearDatabase() {
    try {
        // เชื่อมต่อ MongoDB
        // แนะนำ: ใช้ process.env.MONGODB_URI ถ้ามี เพื่อความปลอดภัย
        await mongoose.connect('mongodb://localhost:27017/Pentagram');
        console.log("✅ Connected to MongoDB.");

        // ล้างโพสต์ทั้งหมดทิ้ง
        const result = await Post.deleteMany({});
        console.log(`🧹 Database cleared. Removed ${result.deletedCount} posts.`);

    } catch (err) {
        console.error("❌ Error clearing database:", err);
    } finally {
        // ปิดการเชื่อมต่อเมื่อทำงานเสร็จ
        await mongoose.disconnect();
        console.log("🔌 Database connection closed.");
    }
}

clearDatabase();