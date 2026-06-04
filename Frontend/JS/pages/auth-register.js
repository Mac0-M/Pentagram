// ============================================================
// Pentagram Registration — Frontend Validation & Sanitization
// Libraries used:
//   - DOMPurify (sanitize)  : https://github.com/cure53/DOMPurify
//   - validator.js (validate): https://github.com/validatorjs/validator.js
// ============================================================

// ── Sanitize: ใช้ DOMPurify ทำความสะอาด input ─────────────────────────────
// ALLOWED_TAGS/ATTR = [] หมายถึงไม่ยอมให้มี HTML ใดๆ → ได้ plain text ล้วนๆ
function sanitizeField(value) {
    return DOMPurify.sanitize(String(value).trim(), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

// ── Validate Username ──────────────────────────────────────────────────────
// validator.isLength   → ตรวจความยาว 4–20 ตัว
// validator.matches    → ตรวจ pattern ตัวพิมพ์เล็ก, เลข, _ และ . เท่านั้น
//   (หมายเหตุ: validator.matches() รับ pattern จากภายนอก ไม่ใช่เขียน sanitize regex เอง
//    นี่คือ validation regex ซึ่งต่างจาก sanitization)
function validateUsername(username) {
    if (!username) return 'Please enter a Username';

    if (!validator.isLength(username, { min: 4, max: 20 })) {
        return 'Username must be between 4 and 20 characters long';
    }

    if (!validator.matches(username, /^[a-z0-9_.]+$/)) {
        return 'Username can only contain lowercase letters (a-z), numbers (0-9), underscores (_), and periods (.)';
    }

    return null; // ผ่าน
}

// ── Validate Password ──────────────────────────────────────────────────────
// validator.isStrongPassword → ตรวจ complexity (ตัวเล็ก, ใหญ่, เลข, สัญลักษณ์)
// validator.isLength          → ตรวจความยาว 8–20 ตัว
function validatePassword(password) {
    if (!password) return 'Please enter a Password';

    if (/\s/.test(password)) {
        return 'Password must not contain spaces';
    }

    if (!validator.isLength(password, { min: 8, max: 20 })) {
        return 'Password must be between 8 and 20 characters long';
    }

    // isStrongPassword options ตรงกับข้อกำหนด:
    //   minLowercase: 1 → ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว
    //   minUppercase: 1 → ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว
    //   minNumbers: 1   → ต้องมีตัวเลขอย่างน้อย 1 ตัว
    //   minSymbols: 1   → ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว
    const isStrong = validator.isStrongPassword(password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
        returnScore: false
    });

    if (!isStrong) {
        return 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (e.g., !@#$%)';
    }

    return null; // ผ่าน
}

// ── UI Helper ─────────────────────────────────────────────────────────────
function showError(el, msg) {
    el.textContent = msg;
    el.style.color = '#ff3040';
}

// ============================================================
// Main: Register Form Handler
// ============================================================
const registerForm = document.getElementById('register-form');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const registerStatus = document.getElementById('register-status');
    const qrContainer    = document.getElementById('qr-container');
    const qrImage        = document.getElementById('qr-image');
    const loginNextBtn   = document.getElementById('login-next-btn');

    // Step 1: Sanitize ด้วย DOMPurify ก่อนทุกอย่าง (ยกเว้นรหัสผ่านที่จะไม่แอบ trim หรือดัดแปลงค่า เพื่อความแม่นยำในการตรวจจับ spacebar)
    const username        = sanitizeField(e.target.querySelector('input[name="username"]').value);
    const password        = e.target.querySelector('input[name="password"]').value;
    const confirmPassword = e.target.querySelector('input[name="confirmPassword"]').value;

    // Step 2: Validate Username ด้วย validator.js
    const usernameError = validateUsername(username);
    if (usernameError) { showError(registerStatus, usernameError); return; }

    // Step 3: Validate Password ด้วย validator.js
    const passwordError = validatePassword(password);
    if (passwordError) { showError(registerStatus, passwordError); return; }

    // Step 4: ตรวจ Confirm Password ตรงกัน
    if (password !== confirmPassword) {
        showError(registerStatus, 'Password and Confirm Password do not match');
        return;
    }

    // Step 5: ส่งข้อมูลที่ผ่านการ sanitize + validate แล้วไป Backend
    const API_BASE_URL = window.location.origin || 'http://localhost:3000';
    registerStatus.textContent = 'Registering account...';
    registerStatus.style.color = '';
    qrContainer.style.display = 'none';
    loginNextBtn.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        // ตรวจสอบสถานะการเชื่อมต่อและการตอบกลับจาก Server
        if (!res.ok) {
            // หากเกิดข้อผิดพลาด (เช่น ชื่อซ้ำ สเตตัส 400) จะโชว์ข้อความแจ้งเตือนที่ส่งมาจากเซิร์ฟเวอร์
            showError(registerStatus, data.error || 'Registration failed. Please try again.');
            return;
        }

        // กรณีสมัครสำเร็จ
        if (data.qrCode) {
            qrImage.src = data.qrCode;
            qrContainer.style.display = 'block';
            registerStatus.textContent = 'Registered successfully. Scan the QR with Google Authenticator, then go back to login. (The code refreshes every 30 seconds)';
            registerStatus.style.color = '#00e676';
            loginNextBtn.style.display = 'inline-block';
        } else {
            registerStatus.textContent = 'Account created, but no QR code was returned.';
        }
    } catch (err) {
        showError(registerStatus, 'Registration failed. Please try again.');
    }
});