const form = document.getElementById('auth-form');
let currentUsername = "";
let currentChallengeToken = "";
const API_BASE_URL = window.location.origin || 'http://localhost:3000';

// Step 1: Check Credentials
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (document.getElementById('step-2').style.display === 'block') {
        const token2FA = document.getElementById('token2fa').value;
        const payload = {
            username: currentUsername,
            token2FA
        };

        if (currentChallengeToken) {
            payload.challengeToken = currentChallengeToken;
        }

        const res = await fetch(`${API_BASE_URL}/api/auth/login-step2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.token); // เก็บ Token ไว้ใช้ต่อ
            localStorage.setItem('username', currentUsername);
            window.location.href = "feeds.html"; // Redirect ไปหน้า 
        } else {
            alert("Invalid 2FA Token");
        }

        return;
    }

    currentUsername = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (/\s/.test(password)) {
        alert("Password must not contain spaces");
        return;
    }

    const res = await fetch(`${API_BASE_URL}/api/auth/login-step1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername, password })
    });

    if (res.ok) {
        const data = await res.json();
        currentChallengeToken = data.challengeToken || "";
        document.getElementById('step-1').style.display = 'none';
        document.getElementById('step-2').style.display = 'block';
    } else {
        alert("Invalid login");
    }
});