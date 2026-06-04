# rule.md — กฎและข้อจำกัดของ Pentagram Debug/Fix Agent

## 1. ขอบเขตโปรเจค (Project Scope)

Agent ทำงานบน repository **Mac0-M/Pentagram** branch `full-flow` เท่านั้น  
Stack หลัก:

| Layer     | เทคโนโลยี                                                           |
|-----------|----------------------------------------------------------------------|
| Backend   | Node.js, Express, Mongoose (MongoDB), JWT, bcryptjs, multer, qrcode, sanitize-html, validator, swagger-ui-express |
| Frontend  | HTML5, Vanilla CSS, Vanilla JavaScript (ES Modules), Web Workers, Service Worker |
| External  | Riot Games API (v4/v5), OpenDota API, Data Dragon CDN               |
| DevOps    | dotenv, .env file config, `npm start` / `npx http-server`           |

---

## 2. กฎที่ต้องปฏิบัติตามเสมอ (Mandatory Rules)

### 2.1 Scope Rules — อย่าแตะนอกขอบเขต
- **ห้าม** เพิ่ม dependency ใหม่โดยไม่ระบุเหตุผลและ version ที่ชัดเจน
- **ห้าม** เปลี่ยน database schema ใน `Backend/models/*.js` โดยไม่มี migration plan
- **ห้าม** แก้ไข `swagger.yaml` เว้นแต่ endpoint มีการเปลี่ยน signature จริง
- **ห้าม** refactor โค้ดที่ไม่เกี่ยวกับ bug ในขณะเดียวกัน (1 PR = 1 bug)
- **ห้าม** เปลี่ยน authentication flow (JWT + TOTP/MFA) โดยไม่ได้รับการยืนยันจาก owner

### 2.2 Security Rules — ความปลอดภัยสูงสุด
- **ห้าม** commit ค่าจริงของ `RIOT_API_KEY`, `MONGO_URI`, `JWT_SECRET` หรือ secret ใดๆ ลง codebase
- **ต้อง** ใช้ `process.env.*` เสมอสำหรับ secret ทุกตัว
- **ต้อง** คง `sanitize-html` และ `validator` ไว้ในทุก user-input endpoint
- **ห้าม** ปิดหรือ bypass CORS middleware (`cors({ origin: "*" })` คือ intentional สำหรับ dev)
- **ต้อง** คง `.trim()` บน `RIOT_API_KEY` ไว้ (Bug Fix #1 ที่ถูก document แล้ว)

### 2.3 Compatibility Rules — ความเข้ากันได้
- Backend ต้องรันได้บน **Node.js ≥ 16** (ใช้ native `fetch` ที่มีใน Node 18+, ถ้า Node 16 ต้อง polyfill)
- Frontend ห้ามใช้ build tool (ไม่มี Webpack/Vite) — ทุกอย่างต้องเป็น vanilla ES module
- Frontend ต้อง serve ผ่าน HTTP server (ห้ามเปิดจาก `file://` protocol)
- `Web Worker` และ `Service Worker` ต้องใช้งานได้บน Chrome, Firefox, Edge รุ่นล่าสุด

### 2.4 API Contract Rules — สัญญา API
- Riot API endpoint ที่ใช้: `account-v1`, `summoner-v4`, `league-v4`, `match-v5` — อย่าเปลี่ยน version โดยไม่ตรวจสอบ
- OpenDota endpoint ที่ใช้: `/players/{account_id}`, `/players/{account_id}/matches`, `/players/{account_id}/heroes` — ใช้ตาม official docs
- Data Dragon CDN: version ต้องดึงจาก `https://ddragon.leagueoflegends.com/api/versions.json` แบบ dynamic (มี fallback hardcode อยู่แล้ว)
- **ห้าม** เปิด Riot API key ตรงๆ ใน Frontend — ต้องผ่าน Backend proxy เสมอ

### 2.5 Error Handling Rules
- ทุก async function ใน Backend **ต้องมี** `try/catch` หรือ `.catch()` ครอบอยู่
- HTTP error response **ต้องส่ง** `{ error: "..." }` พร้อม HTTP status code ที่ถูกต้อง
- **ห้าม** ส่ง stack trace หรือ internal path กลับไปยัง client ใน production
- Timeout ของ external API call: ใช้ `AbortController` ที่ 8000ms (มีอยู่แล้ว — ห้ามลด)
- Retry logic: `fetchJsonWithRetry` ใช้ 3 attempts / 1500ms delay — อย่า aggressive เกินนี้

### 2.6 Testing Rules
- ก่อน propose fix ต้อง **reproduce** bug ด้วย `curl`, Swagger UI (`http://localhost:3000/api-docs`), หรือ browser devtools
- ทุก fix ต้องมี **test case** อธิบายว่า: "ก่อน fix ทำอะไรแล้วเกิดอะไร / หลัง fix ทำอะไรแล้วได้ผลอะไร"
- Database seeding (`node seed.js`) ต้องทำงานได้หลัง fix เสมอ

---

## 3. กฎ Workflow ของ Agent

```
รับ bug report
     │
     ▼
[DIAGNOSE] ระบุ file + line ที่เป็นต้นเหตุ
     │
     ▼
[PLAN] เขียน plan แก้ไขก่อนลงมือ (อย่าแก้แบบ trial-and-error)
     │
     ▼
[FIX] แก้ไขเฉพาะจุด — minimal diff
     │
     ▼
[VERIFY] ทดสอบตาม test case
     │
     ▼
[DOCUMENT] อัปเดต comment หรือ CHANGELOG ถ้าจำเป็น
```

### Priority ของ Bug
| ระดับ   | คำอธิบาย                                                      | SLA     |
|---------|---------------------------------------------------------------|---------|
| P0      | ระบบ crash / ไม่สามารถ login ได้ / data loss                   | ทันที   |
| P1      | Feature หลักพัง (score ไม่คำนวณ, game ID link ล้มเหลว)        | < 1 ชั่วโมง |
| P2      | Feature รอง / UI แสดงผลผิด                                    | < 1 วัน |
| P3      | Performance / UX / minor visual                               | backlog |

---

## 4. ไฟล์ที่ห้ามแก้โดยไม่ได้รับอนุญาต (Protected Files)

- `Backend/utils/totp.js` — TOTP/MFA core logic
- `Backend/models/User.js` — User schema (schema change = migration needed)
- `.env.example` — ต้องไม่มี secret จริง
- `Frontend/JS/workers/moba-score-worker.js` — scoring algorithm (ต้องทดสอบ regression ก่อนแก้)

---

## 5. สิ่งที่ Agent ต้องรายงานในทุก Fix

1. **Root Cause** — สาเหตุที่แท้จริงคืออะไร
2. **Files Changed** — ระบุ path + บรรทัดที่แก้
3. **Risk Assessment** — แก้แล้วอาจกระทบอะไรบ้าง
4. **Rollback Plan** — ถ้า fix พัง จะ rollback อย่างไร
