---
description: script.md — Debug Scripts & Runbook สำหรับ Pentagram
---

# script.md — Debug Scripts & Runbook สำหรับ Pentagram

## 0. Setup Environment

```bash
# Clone และ checkout branch
git clone https://github.com/Mac0-M/Pentagram.git
cd Pentagram
git checkout full-flow

# สร้าง .env จาก template
cp .env.example .env
# แล้วแก้ไข MONGO_URI, RIOT_API_KEY ให้ถูกต้อง
```

---

## 1. Start Services

### Terminal A — Backend
```bash
cd Backend
npm install
npm start
# Expected: "Server running on port 3000"
#           "MongoDB connected"
#           "DNS servers set to Google..."
```

### Terminal B — Frontend
```bash
cd Frontend
npx http-server -p 8080
# เปิด browser: http://localhost:8080/HTML/index.html
```

### Verify ทั้งสองทำงาน
```bash
# ตรวจ Backend health
curl http://localhost:3000/api-docs

# ตรวจ Frontend
curl -I http://localhost:8080/HTML/index.html
```

---

## 2. Script: ตรวจสอบ Environment Variables

```bash
# รันใน Backend/
node -e "
require('dotenv').config();
require('dotenv').config({ path: '../.env' });
const key = (process.env.RIOT_API_KEY || '').trim();
console.log('MONGO_URI set:', !!process.env.MONGO_URI);
console.log('PORT:', process.env.PORT || '3000 (default)');
console.log('RIOT_API_KEY starts with RGAPI:', key.startsWith('RGAPI'));
console.log('RIOT_API_KEY length:', key.length);
console.log('RIOT_REGION:', process.env.RIOT_REGION || 'sea (default)');
console.log('Has whitespace around key:', process.env.RIOT_API_KEY !== key);
"
```

**Expected output:**
```
MONGO_URI set: true
PORT: 3000 (default)
RIOT_API_KEY starts with RGAPI: true
RIOT_API_KEY length: 42
RIOT_REGION: sea
Has whitespace around key: false
```

---

## 3. Script: ทดสอบ MongoDB Connection

```bash
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    return mongoose.connection.db.listCollections().toArray();
  })
  .then(cols => {
    console.log('Collections:', cols.map(c => c.name).join(', ') || '(empty)');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });
"
```

---

## 4. Script: ทดสอบ Riot API Key

```bash
# แทนที่ YOUR_KEY ด้วย key จาก .env
RIOT_KEY="YOUR_KEY_HERE"
RIOT_REGION="sea"

# Test 1: Account v1 — หา PUUID จาก Riot ID
curl -s "https://${RIOT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Faker/T1" \
  -H "X-Riot-Token: ${RIOT_KEY}" | python3 -m json.tool

# Test 2: ถ้า region ไม่รองรับ — ลอง asia
curl -s "https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Faker/T1" \
  -H "X-Riot-Token: ${RIOT_KEY}" | python3 -m json.tool
```

**Diagnose จาก HTTP status:**
| Status | สาเหตุ | วิธีแก้ |
|--------|--------|---------|
| 200    | ✅ OK  | —       |
| 401    | Key หมดอายุ หรือมี whitespace | Refresh key ใน Riot Dev Portal; เช็ค `.trim()` |
| 403    | Key ไม่มีสิทธิ์เข้า endpoint นี้ | ใช้ Production key หรือ register app |
| 429    | Rate limit | รอ 1 นาที หรือใช้ Production key |

---

## 5. Script: ทดสอบ OpenDota API

```bash
# ตรวจ player โดย Steam32 ID (ตัวอย่าง: 87278757 = Dendi)
STEAM_ID=87278757
curl -s "https://api.opendota.com/api/players/${STEAM_ID}" | python3 -m json.tool | head -30

# ตรวจ matches
curl -s "https://api.opendota.com/api/players/${STEAM_ID}/matches?limit=5" | python3 -m json.tool | head -40
```

---

## 6. Script: ตรวจสอบ MOBA Score Calculation

```bash
# ตรวจ score ของ user ผ่าน Backend API
USERNAME="testuser"
TOKEN="YOUR_JWT_TOKEN"

# ดึง GameStats
curl -s "http://localhost:3000/api/gamestats/${USERNAME}" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool

# Force recalculate score (ถ้ามี endpoint นี้)
curl -s -X POST "http://localhost:3000/api/gamestats/${USERNAME}/sync" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool
```

---

## 7. Script: Debug Web Worker

เปิด browser console บนหน้าใดก็ได้ แล้วรัน:

```javascript
// ตรวจสอบว่า Worker ทำงานอยู่ไหม
// ใน Frontend/JS/core/api_client.js จะ spawn worker อัตโนมัติ

// ดู cache ที่ worker เก็บไว้
Object.keys(sessionStorage).forEach(key => {
  console.log(key, ':', sessionStorage.getItem(key)?.substring(0, 100));
});

// Clear worker cache ทั้งหมด (ใช้เมื่อ debug stale data)
sessionStorage.clear();
console.log('✅ Worker cache cleared');
```

---

## 8. Script: ตรวจสอบ JWT Token

```bash
# Decode JWT (อย่า verify — แค่ดู payload)
TOKEN="your.jwt.token.here"
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool

# หรือใช้ node
node -e "
const token = 'YOUR_TOKEN_HERE';
const parts = token.split('.');
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('Expires:', new Date(payload.exp * 1000).toISOString());
console.log('Expired:', Date.now() > payload.exp * 1000);
"
```

---

## 9. Script: ตรวจสอบ File Upload (Multer)

```bash
# ทดสอบ upload รูปภาพผ่าน multipart/form-data
curl -s -X POST "http://localhost:3000/api/upload-trophy" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "username=testuser" \
  -F "file=@/path/to/test-image.jpg" | python3 -m json.tool

# ตรวจไฟล์ใน uploads/
ls -la Backend/uploads/
```

---

## 10. Script: Run Database Seed

```bash
cd Backend
node seed.js
# Expected: สร้าง user จำลอง + profile + gamestats ลง MongoDB
```

**ถ้า seed ล้มเหลว:**
```bash
# Debug mode
node -e "
process.env.DEBUG = 'mongoose:*';
require('./seed.js');
"
```

---

## 11. Script: ตรวจสอบ Service Worker (PWA)

```javascript
// ใน browser console
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registered SWs:', regs.length);
  regs.forEach(r => console.log(' -', r.scope, r.active?.state));
});

// Unregister ทั้งหมด (เมื่อ debug SW issues)
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(r => r.unregister());
  console.log('✅ All service workers unregistered');
});
```

---

## 12. Common Debug Scenarios

### Scenario A: หน้าเว็บขาว / ไม่โหลด
```bash
# 1. ตรวจ Network tab ใน DevTools — หา 404/CORS error
# 2. ตรวจว่า http-server รันอยู่
curl -I http://localhost:8080/HTML/index.html

# 3. ตรวจ JS module import path (ต้องเป็น relative path ถูกต้อง)
grep -r "import " Frontend/JS/pages/ | grep -v "node_modules"
```

### Scenario B: 401 จาก Riot API
```bash
# 1. ตรวจ key ใน .env
grep RIOT_API_KEY .env

# 2. ตรวจ trim ใน server.js
grep "RIOT_API_KEY" Backend/server.js | head -5

# 3. ทดสอบ key โดยตรง (ดู Script 4)
```

### Scenario C: Score ไม่อัปเดต
```bash
# 1. ตรวจ GameStats ใน DB
node -e "
require('dotenv').config();
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const GameStats = require('./Backend/models/GameStats');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const stats = await GameStats.find({}).select('username game score updatedAt').lean();
  console.table(stats);
  process.exit(0);
});
"

# 2. ดู syncProfileScoreAndRank ใน routes/gameStats.js
grep -n "syncProfileScoreAndRank" Backend/routes/gameStats.js
```

### Scenario D: MFA / TOTP ไม่ทำงาน
```bash
# ตรวจ totp.js ทำงานถูกต้อง
node -e "
const { generateTotpSecret, verifyTotpToken, buildOtpAuthUri } = require('./Backend/utils/totp');
const secret = generateTotpSecret();
console.log('Secret:', secret);
console.log('OTP URI:', buildOtpAuthUri('testuser', secret));
// ต้องสแกน QR ด้วย Google Authenticator แล้วใส่ token ทดสอบ
"
```

---

## 13. Log Collection

```bash
# รัน backend พร้อม timestamp log
cd Backend && node server.js 2>&1 | ts '[%Y-%m-%d %H:%M:%S]' | tee /tmp/pentagram-backend.log

# ดู log แบบ real-time
tail -f /tmp/pentagram-backend.log | grep -E "(ERROR|WARN|RETRY|BUG)"
```
