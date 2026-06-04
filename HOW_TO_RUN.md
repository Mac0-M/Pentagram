# Pentagram - คู่มือวิธีการติดตั้งและใช้งานระบบ

แพลตฟอร์มคอมมูนิตี้สำหรับเกมเมอร์แนว MOBA ที่รองรับการเชื่อมต่อข้อมูลและประเมินผลคะแนน (Weighted Multi-Game Performance Metric) จากเกม **League of Legends (LoL)** และ **Dota 2** เข้าด้วยกันอย่างเป็นระบบ

---

## สิ่งที่ต้องเตรียมก่อนเริ่มใช้งาน (Prerequisites)

- **Node.js** (เวอร์ชัน 16 ขึ้นไป)
- **MongoDB** (สามารถใช้แบบ Local MongoDB Community Server หรือ MongoDB Atlas บนคลาวด์ก็ได้)
- **Riot Games API Key** (สำหรับใช้งานดึงข้อมูลจากเกม League of Legends สมัครรับคีย์ได้ที่ [Riot Developer Portal](https://developer.riotgames.com/))
- **OpenDota API** (สำหรับเกม Dota 2 ระบบจะเชื่อมต่อกับ API สาธารณะโดยอัตโนมัติ ไม่จำเป็นต้องใช้คีย์)

---

## ขั้นตอนการติดตั้งและการเริ่มใช้งานระบบ

### 1. การตั้งค่า Environment Variables (ไฟล์ `.env`)

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

---

### 2. การเริ่มต้นทำงานฝั่ง Backend (API Server)

ระบบ Backend พัฒนาด้วย Node.js, Express และ Mongoose ทำหน้าที่จัดการฐานข้อมูลและเป็น Secure API Proxy ในการเชื่อมต่อ API ของเกมต่างๆ เพื่อแก้ไขปัญหาเรื่อง CORS บล็อกการเข้าถึงจากเว็บเบราว์เซอร์

```bash
# 1. เข้าไปยังโฟลเดอร์ Backend
cd Backend

# 2. ติดตั้ง Dependencies ทั้งหมด
npm install

# 3. เริ่มต้นรันเซิร์ฟเวอร์
npm start
```

เมื่อ Backend ทำงานสำเร็จ:
- เซิร์ฟเวอร์จะเปิดใช้งานที่: `http://localhost:3000`
- เอกสารคู่มือ API (Swagger UI) จะพร้อมใช้งานที่: `http://localhost:3000/api-docs`

#### การสร้างข้อมูลจำลองในฐานข้อมูล (Database Seeding) - ไม่บังคับ
หากต้องการสร้างบัญชีผู้ใช้จำลองและข้อมูลทดสอบลงฐานข้อมูล ให้รันคำสั่งนี้:
```bash
node seed.js
```

---

### 3. การเริ่มต้นทำงานฝั่ง Frontend

ส่วนหน้าบ้านของ Pentagram ใช้โครงสร้าง HTML5, Vanilla CSS และ JavaScript ร่วมกับระบบ Web Worker ในการช่วยคำนวณข้อมูลหลังบ้านล่วงหน้า (Background Prefetching) ทำให้การสลับหน้าเป็นไปอย่างรวดเร็วและหน้าจอไม่กระตุก

เพื่อป้องกันปัญหาเรื่อง CORS ในเบราว์เซอร์ แนะนำให้รันส่วนของ Frontend ผ่านตัวจำลองเว็บเซิร์ฟเวอร์ (เช่น พอร์ต 8000 หรือ 8080):

```bash
# 1. เข้าไปยังโฟลเดอร์ Frontend
cd Frontend

# 2. เปิดเซิร์ฟเวอร์จำลอง (แนะนำให้ใช้พอร์ตที่ไม่ชนกับ Backend เช่น พอร์ต 8080)
npx http-server -p 8080
```

เปิดเว็บเบราว์เซอร์ของคุณแล้วเข้าลิงก์:
👉 **`http://localhost:8080/HTML/index.html`**

---

## สถาปัตยกรรมและฟีเจอร์หลัก (Core Features)

1. **ระบบสมัครสมาชิกและการล็อกอิน 2 ชั้น (JWT + MFA)**
   - สมัครใช้งานระบบ พร้อมหน้าลงทะเบียนรับ QR Code เพื่อสแกนใช้กับ Google Authenticator
   - ยืนยันความปลอดภัยขั้นสูง (Two-Factor Authentication: 2FA) ทุกครั้งที่มีการล็อกอิน
2. **ระบบการเชื่อมโยงและยืนยันไอดีเกม (Multi-Game Identifier Resolver)**
   - ยืนยันบัญชี Riot ID (LoL) และ Steam Account ID (Dota 2)
   - มีระบบตรวจสอบความถูกต้องและเช็คประวัติการใช้งานไอดีเกมเพื่อความโปร่งใส ป้องกันไม่ให้แอบอ้างไอดีผู้อื่น
3. **ระบบการคำนวณคะแนน MOBA ประเมินความสามารถระดับสูง (Cross-Game MOBA Score)**
   - ดึงแมตช์ประวัติการเล่นล่าสุด 20-25 แมตช์จาก API ของ Riot และ OpenDota
   - นำค่าสถิติจริงมาผ่านกระบวนการวิเคราะห์ประสิทธิภาพการเล่น (Weighted Average) ครอบคลุมด้าน:
     - **Rank Skill** (ความสามารถระดับแรงค์ปัจจุบัน)
     - **Win Efficiency** (ประสิทธิภาพการเก็บชัยชนะ อ้างอิงจำนวนแมตช์และความเสถียร)
     - **Combat Performance** (สถิติการต่อสู้ KDA เฉลี่ย และอัตรา Kill Participation)
     - **Economy Skill** (การเก็บเงิน GPM, XP/min และ Last Hits เฉลี่ย)
4. **ระบบการทำงานเบื้องหลังลื่นไหล (Background Prefetching)**
   - มีการดึงข้อมูลและเก็บลง Cache (SessionStorage) ล่วงหน้าตั้งแต่ผู้ใช้อยู่หน้า Landing หรือหน้าล็อกอิน ทำให้เมื่อสลับไปยังหน้าข้อมูลต่างๆ ข้อมูลจะปรากฏขึ้นทันทีโดยไม่มีการรอโหลดซ้ำ
5. **ระบบการจัดการรางวัลและความสำเร็จในโปรไฟล์ (Media Management)**
   - อัปโหลดไอคอนภาพรางวัล (Trophies) และประวัติผลงาน (Achievements) 
   - สามารถระบุคำบรรยายประกอบผลงาน จำกัดความยาวไม่เกิน 100 คำ

---

## โครงสร้างโฟลเดอร์โปรเจกต์ (Project Directory Structure)

```text
Pentagram/
├── .env                  # การตั้งค่าแอปพลิเคชัน
├── .env.example          # ไฟล์ตัวอย่างการตั้งค่า
├── Backend/
│   ├── server.js         # เซิร์ฟเวอร์หลักของแอปพลิเคชัน Express
│   ├── seed.js           # สคริปต์สร้างข้อมูลตัวอย่างในฐานข้อมูล
│   ├── swagger.yaml      # สเปกคู่มือ API ตามมาตรฐาน OpenAPI 3.0
│   └── uploads/          # โฟลเดอร์เก็บไฟล์รูปภาพอัปโหลด
└── Frontend/
    ├── HTML/             # ไฟล์เอกสารหน้าเว็บ (index, login, register, profile, feeds)
    ├── CSS/              # ระบบสไตล์ชีตและงานดีไซน์
    └── JS/
        ├── components/   # ส่วนย่อยของ UI เช่นเมนูนำทางและส่วนแสดงผลคะแนน
        ├── core/         # ส่วนประมวลผลหลัก (api_client.js โหลดอัตโนมัติ)
        ├── pages/        # โค้ดควบคุมฟังก์ชันในหน้าต่างหลักแต่ละหน้า
        └── workers/      # background threads (api_worker.js) ช่วยทำงานดึงข้อมูลไม่ให้หน้าเว็บค้าง
```

---

## การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

### ❌ ข้อผิดพลาด: Connection Refused (MongoDB)
- ตรวจสอบว่าบริการ MongoDB ในเครื่องทำงานอยู่จริง หรือตรวจสอบตัวแปร `MONGO_URI` ในไฟล์ `.env` ว่าระบุรหัสผ่านและเซิร์ฟเวอร์ถูกต้อง

### ❌ ข้อผิดพลาด: 401 Unauthorized (เมื่อทดสอบดึงข้อมูล League of Legends)
- ตรวจสอบ `RIOT_API_KEY` ใน `.env` ว่ายังไม่หมดอายุ (โดยปกติ Development Key จะมีอายุการทำงาน 24 ชั่วโมงหลังจากสร้าง และจำเป็นต้องกด Refresh เสมอ)

### ❌ ปัญหาหน้าเว็บไม่แสดงผล หรือขึ้นข้อผิดพลาด CORS
- หลีกเลี่ยงการเปิดไฟล์ด้วยการดับเบิ้ลคลิกไฟล์ HTML ตรงๆ (`file://`) เพราะเบราว์เซอร์จะบล็อกการโหลดโมดูลและ Web Worker เนื่องจากปัญหาความปลอดภัย
- ให้เริ่มรันด้วย Local Web Server เสมอ (เช่น `npx http-server`) ตามขั้นตอนการติดตั้ง

---

## การเชื่อมโยงและเอกสารทดสอบ API

คุณสามารถเข้าถึง Swagger API Interactive Playground ได้หลังจากรันส่วน Backend สำเร็จ:
🌐 **`http://localhost:3000/api-docs`**

ระบบนี้ออกแบบมาเพื่อให้นักพัฒนามืออาชีพสามารถตรวจสอบประสิทธิภาพและทดสอบยิง API ทุกรายการได้อย่างง่ายดายผ่านหน้าเว็บโดยตรง
