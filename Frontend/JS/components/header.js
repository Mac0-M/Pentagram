const pagePath = window.location.pathname.toLowerCase();
const pageQuery = new URLSearchParams(window.location.search);
const loggedInUsername = localStorage.getItem("username") || "";
const authToken = localStorage.getItem("token") || "";
const profileUsername = pageQuery.get("username") || loggedInUsername || "";
const isAuthPage = pagePath.includes("login.html") || pagePath.includes("register.html");
const isProfilePage = pagePath.includes("profile.html");
const isOwnerProfile = isProfilePage && Boolean(authToken) && loggedInUsername === profileUsername;

// Register Service Worker for Persistent L2 Caching & Offline Support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service_worker.js')
            .then(reg => console.log('Pentagram Service Worker registered successfully via Header on scope:', reg.scope))
            .catch(err => console.warn('Pentagram Service Worker registration failed via Header:', err));
    });
}

function decodeJwtPayload(token) {
    try {
        const payloadPart = token.split(".")[1];
        if (!payloadPart) {
            return null;
        }

        const normalizedPayload = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
        return JSON.parse(atob(paddedPayload));
    } catch (error) {
        return null;
    }
}

function isTokenExpired(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) {
        return true;
    }

    return Date.now() >= payload.exp * 1000;
}

function clearAuthAndRedirect() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.replace("login.html");
}

window.PentagramPageContext = {
    pagePath,
    profileUsername,
    loggedInUsername,
    authToken,
    isAuthPage,
    isProfilePage,
    isOwnerProfile,
};

if ((!authToken || isTokenExpired(authToken)) && !isAuthPage) {
    clearAuthAndRedirect();
}

if (authToken && !isTokenExpired(authToken) && isAuthPage) {
    window.location.replace("feeds.html");
}

async function loadCurrentUserAvatar() {
    if (!loggedInUsername) return;
    
    let cachedAvatar = sessionStorage.getItem("currentUserAvatar");
    if (!cachedAvatar) {
        try {
            const baseUrl = window.location.origin || "http://localhost:3000";
            const res = await fetch(`${baseUrl}/api/public-profile/${loggedInUsername}`);
            if (res.ok) {
                const data = await res.json();
                cachedAvatar = data.avatar || "../assets/logo.png";
                sessionStorage.setItem("currentUserAvatar", cachedAvatar);
            }
        } catch (err) {
            console.warn("Failed to fetch current user avatar:", err);
        }
    }
    
    if (cachedAvatar) {
        // อัปเดตรูปช่องพิมพ์คอมเมนต์ในทุกหน้า
        document.querySelectorAll(".my-avatar").forEach(img => {
            img.src = cachedAvatar;
        });

        // อัปเดตรูปผู้เขียนในหน้า create-post.html
        document.querySelectorAll(".user-info-post img.avatar").forEach(img => {
            img.src = cachedAvatar;
        });
    }
}
window.loadPentagramCurrentUserAvatar = loadCurrentUserAvatar;

document.addEventListener("DOMContentLoaded", function() {
    // โหลดรูปโปรไฟล์ของผู้ใช้ปัจจุบัน
    loadCurrentUserAvatar();

    const placeholder = document.getElementById("navigation-placeholder");

    if (!placeholder) {
        return;
    }

    fetch("../HTML/header.html")
        .then(response => response.text())
        .then(data => {
            placeholder.innerHTML = data;
            highlightActive();
        });
});

function highlightActive() {
    const page = window.location.pathname.toLowerCase();
    const items = [
        { file: 'feeds.html', ids: ['nav-home-d', 'nav-home-m'] },
        { file: 'dashboard.html', ids: ['nav-dash-d', 'nav-dash-m'] },
        { file: 'create-post.html', ids: ['nav-create-d', 'nav-create-m'] },
        { file: 'profile.html', ids: ['nav-profile-d', 'nav-profile-m'] }
    ];

    if (page.includes('favorite') || page.includes('fav-post')) {
        ['nav-stats-d', 'nav-stats-m', 'nav-fav-post-d', 'nav-favpost-m'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
        });
        return;
    }

    items.forEach(item => {
        if (page.includes(item.file)) {
            item.ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add("active");
            });
        }
    });
}