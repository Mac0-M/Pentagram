const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. โครงสร้าง User
const User = mongoose.model('User', new mongoose.Schema({ 
    username: String, 
    password: { type: String, required: true }, 
    mfaSecret: String 
}, { timestamps: true }));

// 2. อัปเดต Profile Schema ในฝั่ง Seed ให้มีฟิลด์ตรงกับระบบคำนวณจริงของ server.js
const MediaItemSchema = new mongoose.Schema({
    image: { type: String, default: '' },
    text: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const Profile = mongoose.model('Profile', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    avatar: String,
    verified: { type: Boolean, default: false },
    lolId: String,
    dotaId: String,
    skillTags: { type: [String], default: [] },
    trophies: { type: [MediaItemSchema], default: [] },
    achievements: { type: [MediaItemSchema], default: [] },
    activityData: { type: Map, of: Number, default: {} },
    
    //  เพิ่มกลุ่มฟิลด์เก็บคะแนน เพื่อสร้างคอลัมน์รอไว้ใน MongoDB Atlas ตั้งแต่เริ่มซีดข้อมูล
    mobaScore: { type: Number, default: null },
    rankTierLabel: { type: String, default: null },
    rankSkill: { type: Number, default: null },
    winEfficiency: { type: Number, default: null },
    combatPerformance: { type: Number, default: null },
    economySkill: { type: Number, default: null }
}, { timestamps: true }));

async function keepOnlyUserAndProfileCollections() {
    const allowedCollections = new Set(['users', 'profiles', 'posts', 'favorites', 'gamestats']);
    const collections = await mongoose.connection.db.listCollections().toArray();

    for (const collection of collections) {
        if (!allowedCollections.has(collection.name)) {
            await mongoose.connection.db.dropCollection(collection.name);
            console.log(`Dropped legacy collection ${collection.name}`);
        }
    }

    await Profile.createCollection();
}

async function seed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Cleaning database...");
        
        await keepOnlyUserAndProfileCollections();
        
        // ล้างข้อมูลเก่าออกให้หมดก่อน
        await User.deleteMany({});
        await Profile.deleteMany({});
        
        const password = "password123";
        const hashedPassword = await bcrypt.hash(password, 10);
        const testMfaSecret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
        
        console.log("Seeding TestPlayer with Cross-Game metrics...");
        await User.create({ 
            username: "TestPlayer", 
            password: hashedPassword,
            mfaSecret: testMfaSecret
        });

        await Profile.create({
            username: "TestPlayer",
            avatar: "",
            verified: false,
            lolId: "",
            dotaId: "",
            skillTags: [],
            trophies: [],
            achievements: [],
            activityData: {}
        });
        
        const testOtpAuthUri = `otpauth://totp/Pentagram:TestPlayer?secret=${testMfaSecret}&issuer=Pentagram&algorithm=SHA1&digits=6&period=30`;

        console.log("-----------------------------------------");
        console.log("Data Seeded Successfully!");
        console.log("Username: TestPlayer");
        console.log("Password: password123");
        console.log("MFA Secret (for test app):", testMfaSecret);
        console.log("OTP Auth URI (TestPlayer):", testOtpAuthUri);
        console.log("-----------------------------------------");
    } catch (err) {
        console.error("SEED ERROR:", err.message);
        if (err.name === 'MongooseServerSelectionError') {
            console.error("HINT: เช็ค IP Whitelist ใน MongoDB Atlas ด้วยครับ (IP อาจจะเปลี่ยน)");
        }
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}
seed();