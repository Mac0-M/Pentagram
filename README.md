# 🔮 Pentagram

แพลตฟอร์มคอมมูนิตี้และเครื่องมือแสดงสถิติสำหรับเกมเมอร์แนว MOBA ยุคใหม่ ที่รองรับการเชื่อมต่อข้อมูลและประเมินผลคะแนน **Cross-Game MOBA Score (Weighted Multi-Game Performance Metric)** จากเกม **League of Legends (LoL)** และ **Dota 2** เข้าด้วยกันอย่างเป็นระบบ

---

## 🚀 ฟีเจอร์เด่นของระบบ (Key Features)

*   **ระบบยืนยันตัวตนและความปลอดภัย 2 ชั้น (JWT + MFA/2FA)**
    *   สมัครสมาชิกพร้อมระบบ Generate QR Code อัตโนมัติ เพื่อเชื่อมโยงกับ Google Authenticator
    *   เข้าสู่ระบบอย่างปลอดภัยโดยใช้ JSON Web Token (JWT) ร่วมกับการยืนยันตัวตนด้วยรหัสผ่านแบบใช้ครั้งเดียว (TOTP 6 หลัก)
*   **ระบบระบุตัวตนผู้เล่นข้ามเกม (Multi-Game Identifier Resolver)**
    *   เชื่อมต่อบัญชี Riot ID (สำหรับ League of Legends) และ Steam Account ID (สำหรับ Dota 2)
    *   ระบบตรวจสอบความถูกต้องและเช็คประวัติการใช้งานไอดีเกมเพื่อความโปร่งใส ป้องกันการแอบอ้างไอดีผู้อื่น
*   **ระบบคำนวณคะแนนประสิทธิภาพผู้เล่น (Cross-Game MOBA Score)**
    *   ดึงสถิติประวัติการเล่นย้อนหลัง 20-25 แมตช์ล่าสุดจาก Riot API (LoL) และ OpenDota API (Dota 2)
    *   ประเมินผลด้วยสูตรคำนวณถ่วงน้ำหนัก (Weighted Average) ครอบคลุม 4 มิติหลัก:
        1.  **Rank Skill** (ระดับแรงค์ปัจจุบัน)
        2.  **Win Efficiency** (ประสิทธิภาพการชนะ อ้างอิงจำนวนและเสถียรภาพ)
        3.  **Combat Performance** (สถิติการรบ KDA และการมีส่วนร่วมกับคิล - Kill Participation)
        4.  **Economy Skill** (การเงินและทรัพยากร GPM, XPM, Last Hits เฉลี่ย)
*   **สถาปัตยกรรมทำงานเบื้องหลังความเร็วสูง (Background Prefetching Worker)**
    *   ใช้ Web Workers ในการโหลดข้อมูลล่วงหน้าจาก API ต่างๆ และเก็บ Cache ลงใน SessionStorage ช่วยให้การเปลี่ยนหน้าเว็บลื่นไหล แสดงผลข้อมูลได้ทันทีโดยไม่มีการรอหมุนโหลด
*   **ระบบจัดการโปรไฟล์และเหรียญรางวัล (Profile & Media Management)**
    *   อัปโหลดภาพถ้วยรางวัล (Trophies) และบันทึกประวัติความสำเร็จ (Achievements) ของผู้เล่นพร้อมคำอธิบายแบบกำหนดเอง

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

### Frontend (หน้าบ้าน)
*   **Core**: HTML5, JavaScript (ES6 Modules)
*   **Styling**: Vanilla CSS (Premium Theme & Dark/Glassmorphism Design)
*   **Background Jobs**: Web Workers (api_worker.js, consistency-worker.js, moba-score-worker.js, profile-worker.js)
*   **Caching & State**: SessionStorage cache และ PWA Service Worker (sw.js)

### Backend (หลังบ้าน)
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: MongoDB (Mongoose ODM)
*   **Authentication**: JSON Web Tokens (JWT) & Speakeasy / OTPAuth (TOTP 2FA)
*   **Documentation**: Swagger UI & OpenAPI 3.0

---

## 📁 โครงสร้างโฟลเดอร์โปรเจกต์ (Project Structure)

```text
Pentagram/
├── .env                  # ไฟล์ตั้งค่า Environment Variables
├── .env.example          # ไฟล์ตัวอย่างการตั้งค่าสภาพแวดล้อม
├── HOW_TO_RUN.md         # คู่มือการติดตั้งและใช้งานระบบ (ต้นฉบับ)
├── README.md             # เอกสารแนะนำโครงการและคู่มือการเริ่มใช้งานนี้
├── Backend/
│   ├── server.js         # จุดเริ่มต้นระบบ Backend (Express app) และระบบ Auth
│   ├── seed.js           # สคริปต์จำลองสร้างข้อมูลเบื้องต้นลงฐานข้อมูล (Database Seeding)
│   ├── swagger.yaml      # เอกสาร API ตามมาตรฐาน OpenAPI 3.0
│   ├── models/           # โครงสร้างฐานข้อมูล MongoDB (User, Profile, GameStats, Post, etc.)
│   ├── routes/           # ตัวจัดการ API endpoints (เช่น API จัดการ Game Stats และ Profile)
│   ├── utils/            # เครื่องมือช่วยเหลือฝั่งหลังบ้าน (เช่น ระบบ TOTP/MFA)
│   └── uploads/          # พื้นที่เก็บรูปภาพรางวัลจากการอัปโหลด
└── Frontend/
    ├── HTML/             # หน้าจอ UI หลัก (index, login, register, profile, feeds, dashboard)
    ├── CSS/              # ระบบสไตล์ชีตหลักและธีมสีของแพลตฟอร์ม
    └── JS/
        ├── core/         # ตัวเรียกใช้ API หลัก (api_client.js โหลดบนทุกหน้าอัตโนมัติ)
        ├── pages/        # โค้ดควบคุมฟังก์ชันในหน้าต่างหลักแต่ละหน้า
        └── workers/      # background workers (เช่น moba-score-worker.js) ช่วยประมวลผลข้อมูลไม่ให้หน้าเว็บค้าง
```

---

## 🏁 ขั้นตอนการติดตั้งและการเริ่มใช้งานระบบ (How to Run)

### 1. สิ่งที่ต้องเตรียมก่อนเริ่มใช้งาน (Prerequisites)
*   **Node.js** (เวอร์ชัน 16 ขึ้นไป)
*   **MongoDB** (Local MongoDB Community Server หรือ MongoDB Atlas)
*   **Riot Games API Key** (สำหรับใช้งานดึงข้อมูลจากเกม League of Legends สมัครรับคีย์ได้ที่ [Riot Developer Portal](https://developer.riotgames.com/))
*   **OpenDota API** (สำหรับเกม Dota 2 ระบบจะเชื่อมต่อกับ API สาธารณะโดยอัตโนมัติ ไม่จำเป็นต้องใช้คีย์)

### 2. การตั้งค่า Environment Variables
สร้างไฟล์ `.env` ไว้ที่โฟลเดอร์หลัก (Root Directory) ของโปรเจกต์ โดยคัดลอกตัวอย่างจากไฟล์ `.env.example`:

```bash
cp .env.example .env
```

แก้ไขข้อมูลในไฟล์ `.env` ให้ตรงกับระบบของคุณ:
```env
# MongoDB Connection String (เชื่อมต่อฐานข้อมูล MongoDB)
MONGO_URI=mongodb://localhost:27017/pentagram

# Server Port (พอร์ตการทำงานของ Backend - แนะนำพอร์ต 3000)
PORT=3000

# Riot Games API Key (นำคีย์ที่ได้จากเว็บผู้พัฒนามาใส่ตรงนี้)
RIOT_API_KEY=RGAPI-xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Riot Games Region
RIOT_REGION=sea
```

> [!IMPORTANT]
> ตัวแปร `RIOT_API_KEY` จะถูกนำไป Trim ช่องว่างหน้า-หลังออกโดยอัตโนมัติในฝั่ง Backend เพื่อป้องกันข้อผิดพลาด 401 Unauthorized

### 3. การเริ่มต้นทำงานฝั่ง Backend (API Server)
ระบบ Backend ทำหน้าที่จัดการฐานข้อมูลและทำหน้าที่เป็น Secure API Proxy เพื่อป้องกันการติดบล็อกเรื่อง CORS จากเว็บบราวเซอร์

```bash
# 1. เข้าไปยังโฟลเดอร์ Backend
cd Backend

# 2. ติดตั้ง Dependencies
npm install

# 3. เริ่มต้นรันเซิร์ฟเวอร์
npm start
```

เมื่อ Backend เริ่มทำงานสำเร็จ:
*   เซิร์ฟเวอร์จะพร้อมให้บริการที่: `http://localhost:3000`
*   หน้าต่างเอกสารและทดสอบ API (Swagger UI) จะใช้งานได้ที่: `http://localhost:3000/api-docs`

#### 💡 การสร้างข้อมูลจำลองในฐานข้อมูล (Database Seeding) - ไม่บังคับ
หากต้องการสร้างบัญชีผู้ใช้จำลองและข้อมูลทดสอบสำหรับเข้าใช้งานทันที ให้รันคำสั่งนี้:
```bash
node seed.js
```

### 4. การเริ่มต้นทำงานฝั่ง Frontend
ส่วน Frontend ใช้สถาปัตยกรรมแบบ Single Page / Multi-Page ร่วมกับ Web Worker ในการช่วยทำงานเบื้องหลัง

เพื่อหลีกเลี่ยงปัญหาเรื่อง CORS ของเว็บบราวเซอร์ แนะนำให้เปิดด้วย Local Web Server แทนการดับเบิ้ลคลิกไฟล์ตรงๆ:

```bash
# 1. เข้าไปยังโฟลเดอร์ Frontend
cd Frontend

# 2. เปิดเว็บเซิร์ฟเวอร์จำลอง (แนะนำให้ใช้พอร์ตที่ไม่ชนกับ Backend เช่น พอร์ต 8080)
npx http-server -p 8080
```

เปิดเว็บบราวเซอร์แล้วเข้าไปยังลิงก์:
👉 **`http://localhost:8080/HTML/index.html`**

### 5. การติดตั้งบน Vercel (Cloud Deployment)
โปรเจกต์นี้ได้รับการปรับปรุงให้รองรับการ Deploy ทั้งระบบหน้าบ้าน (Frontend Static Content) และหลังบ้าน (Backend Serverless Functions) บนคลาวด์ Vercel พร้อมกันผ่านไฟล์ [vercel.json](file:///c:/Users/visar/Downloads/lab%20all/Pentagram/Pentagram/vercel.json) ที่อยู่ในโฟลเดอร์หลัก

#### ขั้นตอนการ Deploy:
1. **ติดตั้ง Vercel CLI (หากยังไม่มี)**:
   ```bash
   npm install -g vercel
   ```
2. **สั่งคำสั่ง Deploy ในโฟลเดอร์หลักของโปรเจกต์**:
   ```bash
   vercel
   ```
3. **ตั้งค่า Environment Variables ในหน้า Vercel Dashboard**:
   เมื่อสร้างโปรเจกต์สำเร็จ ให้เปิดแท็บ **Settings > Environment Variables** ในแดชบอร์ด Vercel แล้วกำหนดตัวแปรดังนี้:
   * `MONGO_URI`: ลิงก์สำหรับต่อฐานข้อมูล (แนะนำให้ใช้ MongoDB Atlas เนื่องจาก Vercel ไม่สามารถใช้ Local Host ได้)
   * `RIOT_API_KEY`: คีย์สำหรับดึงข้อมูล Riot Games API
   * `RIOT_REGION`: ภูมิภาคสำหรับค้นหาไอดีเกม (เช่น `sea`)
   * `JWT_SECRET`: คีย์ลับที่ใช้เข้ารหัส JWT Token

---

## 🛠️ การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

### ❌ ข้อผิดพลาด: Connection Refused (MongoDB)
*   **สาเหตุ:** บริการ MongoDB ในเครื่องหรือ Cloud ยังไม่ได้เปิด หรือค่า `MONGO_URI` ในไฟล์ `.env` ไม่ถูกต้อง
*   **วิธีแก้:** ตรวจสอบความถูกต้องของ Connection String และเช็คว่า Service MongoDB รันอยู่จริงหรือไม่

### ❌ ข้อผิดพลาด: 401 Unauthorized (ข้อมูล League of Legends)
*   **สาเหตุ:** `RIOT_API_KEY` หมดอายุ หรือพิมพ์ผิด
*   **วิธีแก้:** ตรวจสอบคีย์บนระบบ Riot Developer Portal (Development key ปกติมีอายุ 24 ชั่วโมง) และกด Refresh ใหม่ จากนั้นแก้ไขไฟล์ `.env` และ Restart Backend

### ❌ ปัญหาหน้าเว็บไม่แสดงผล หรือขึ้นข้อผิดพลาด CORS บนคอนโซลเบราเซอร์
*   **สาเหตุ:** การเปิดไฟล์ HTML โดยตรงผ่านโปรโตคอล `file://` (ดับเบิ้ลคลิกไฟล์) เบราเซอร์จะบล็อกการโหลดโมดูล JS และ Web Worker ด้วยเหตุผลด้านความปลอดภัย
*   **วิธีแก้:** รันผ่านโปรโตคอล `http://` เสมอ โดยการเปิดเครื่องมือรันจำลองเช่น `http-server` หรือ Live Server บน VS Code

---

## 🌐 สรุปรายการ API Endpoints (API Routes)

| Method | Path | หน้าที่ |
| :--- | :--- | :--- |
| **POST** | `/api/register` | สมัครสมาชิกใหม่ และสร้างคีย์ TOTP สำหรับความปลอดภัย 2 ชั้น |
| **POST** | `/api/login` | เข้าสู่ระบบด้วย username + password และตรวจสอบ TOTP Token -> ส่งคืน JWT |
| **GET** | `/api/profile/:username` | เรียกดูข้อมูลโปรไฟล์ผู้ใช้งาน |
| **PUT** | `/api/profile/:username` | อัปเดตข้อมูลรายละเอียดโปรไฟล์ |
| **POST** | `/api/link-game` | เชื่อมโยงบัญชี Riot ID (LoL) หรือ Steam ID (Dota 2) |
| **GET** | `/api/gamestats/:username` | แสดงสถิติการเล่นเกมและคะแนน MOBA Score ที่ได้รับการประเมิน |
| **POST** | `/api/gamestats/:username/sync` | บังคับดึงและซิงก์ข้อมูลจาก API ล่าสุดเพื่อปรับปรุงคะแนน |
| **POST** | `/api/posts` | สร้างโพสต์ใหม่บนหน้าฟีดคอมมูนิตี้ |
| **GET** | `/api/feeds` | ดึงข้อมูลรายการโพสต์บนหน้าคอมมูนิตี้ฟีด |
| **POST** | `/api/favorites` | เพิ่ม/ลบโพสต์เก็บไว้ในรายการโปรด |
| **POST** | `/api/upload-trophy` | อัปเดตรูปภาพเหรียญรางวัลและคำอธิบายรางวัล |

คุณสามารถเปิดดูและทดสอบแบบ Interactive ได้ที่: **`http://localhost:3000/api-docs`** หลังจาก Backend เริ่มต้นทำงานแล้ว
