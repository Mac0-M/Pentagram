// ============================================================
// Pentagram API Client & Common Utilities
// ============================================================

// Register Service Worker for Persistent L2 Caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service_worker.js')
            .then(reg => console.log('Pentagram Service Worker registered successfully on scope:', reg.scope))
            .catch(err => console.warn('Pentagram Service Worker registration failed:', err));
    });
}

const worker = new Worker('../JS/workers/api_worker.js');
let nextRequestId = 1;

/**
 * ส่งงานให้ Web Worker รันข้อมูลของเกมต่างๆ แบบ Asynchronous พร้อมระบบ Cache ข้ามหน้าเว็บ
 * @param {string} game - ชื่อเกม ('lol' หรือ 'dota2')
 * @param {string} action - คำสั่งที่ต้องการเรียก (เช่น 'getMatchDetail', 'getPlayerData')
 * @param {object} payload - พารามิเตอร์ที่ใช้ดึงข้อมูล
 * @param {object} config - การตั้งค่าเสริม
 * @returns {Promise<any>}
 */
function runWorkerTask(game, action, payload, config = {}) {
    // สร้าง Key สำหรับ Session Storage
    const cacheKey = `pentagram_cache_${game}_${action}_${JSON.stringify(payload)}`;

    // ถ้าบังคับให้ข้ามแคช (เช่นตอนทำ Auto-update)
    const skipCache = config.skipCache === true;

    if (!skipCache) {
        const cachedItem = sessionStorage.getItem(cacheKey);
        if (cachedItem) {
            try {
                const parsed = JSON.parse(cachedItem);
                // ดึงจากแคชถ้าอายุไม่เกินกำหนด (แมตช์เก่าดึงแคชยาว 2 ชม. ส่วนข้อมูลทั่วไปแคช 1 นาที) เพื่อความเร็วสูงสุด
                const cacheDuration = (action === 'getMatchDetail') ? 7200000 : 60000;
                if (Date.now() - parsed.timestamp < cacheDuration) {
                    return Promise.resolve(parsed.data);
                }
            } catch (e) { }
        }
    }

    const requestId = nextRequestId++;
    return new Promise((resolve, reject) => {
        const onMessage = (e) => {
            const { success, data, error, requestId: resRequestId } = e.data;
            if (resRequestId === requestId) {
                worker.removeEventListener('message', onMessage);
                if (success) {
                    // บันทึกผลลัพธ์ลง Cache เพื่อให้หน้าอื่นเรียกใช้ได้ทันที
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
                    } catch (e) { }
                    resolve(data);
                } else {
                    reject(error);
                }
            }
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({ game, action, payload, config, requestId });
    });
}

// ============================================================
// Dynamic Identifier Resolver (ระบบหา ID เกมแบบไดนามิก ไม่ฮาร์ดโค้ด)
// ============================================================
window.getActiveGameIds = function () {
    // 1. ดึงจาก URL query string (เช่น ?accountId=... หรือ ?riotId=...)
    const urlParams = new URLSearchParams(window.location.search);
    const urlDota = urlParams.get('accountId') || urlParams.get('dotaId') || urlParams.get('id');
    const urlLol = urlParams.get('riotId') || urlParams.get('lolId');

    // 2. ดึงจาก sessionStorage (ที่อาจบันทึกไว้ตอนเปลี่ยนค่าหรือล็อกอิน)
    const sessionDota = sessionStorage.getItem('pentagram_active_dota_id');
    const sessionLol = sessionStorage.getItem('pentagram_active_lol_id');

    // 3. ดึงจากตัวแปรแวดล้อมจำลอง (เช่น profileData ในหน้าโปรไฟล์)
    const pageDota = window.profileData?.dotaId;
    const pageLol = window.profileData?.lolId;

    // กรอง ID ปลอม/ตัวอย่างออก เพื่อไม่ให้ยิง API ผิดพลาด (เช่น mock ID ขึ้นต้นด้วย ACS)
    const isValidId = (id) => id && id.trim() !== "" && !id.startsWith("ACS");

    return {
        dotaId: isValidId(urlDota) ? urlDota : (isValidId(sessionDota) ? sessionDota : (isValidId(pageDota) ? pageDota : null)),
        lolId: isValidId(urlLol) ? urlLol : (isValidId(sessionLol) ? sessionLol : (isValidId(pageLol) ? pageLol : null))
    };
};

// ============================================================
// Global Prefetcher (โหลดข้อมูลล่วงหน้าระหว่างผู้ใช้อยู่หน้าอื่น)
// ============================================================
window.prefetchGameData = async function (targetGame = 'all') {
    const { dotaId, lolId } = window.getActiveGameIds();
    console.log(`Prefetching game data in background (target: ${targetGame}, DotaID: ${dotaId}, LoLID: ${lolId})...`);

    // โหลด Dota 2 แบบเบื้องหลัง (ไม่บล็อกการทำงานอื่น)
    const prefetchDota2 = async () => {
        try {
            console.log("Prefetching Dota 2 data...");
            runWorkerTask('dota2', 'getPlayerData', { accountId: dotaId });
            runWorkerTask('dota2', 'getHeroStats', { accountId: dotaId });
            const dotaMatches = await runWorkerTask('dota2', 'getRecentMatches', { accountId: dotaId });
            if (dotaMatches && dotaMatches.length > 0) {
                // ดึง 10 แมตช์รอล่วงหน้าทั้งหมดเลย
                dotaMatches.slice(0, 10).forEach(m => {
                    runWorkerTask('dota2', 'getMatchDetail', { matchId: m.match_id, accountId: dotaId });
                });
            }
            console.log("Dota 2 prefetch initiated.");
        } catch (e) {
            console.warn("Dota 2 prefetch failed:", e);
        }
    };

    // โหลด LoL แบบเบื้องหลัง (ไม่บล็อกการทำงานอื่น)
    const prefetchLol = async () => {
        try {
            console.log("Prefetching League of Legends data...");
            const configLoL = { routingRegion: 'sea', region: 'sg2' };
            const lolPlayer = await runWorkerTask('lol', 'getPlayerData', { riotId: lolId }, configLoL);
            runWorkerTask('lol', 'getRank', { puuid: lolPlayer.player_uid }, configLoL);
            const lolMatches = await runWorkerTask('lol', 'getMatchIds', { puuid: lolPlayer.player_uid, count: 10 }, configLoL);
            if (lolMatches && lolMatches.length > 0) {
                // ดึง 10 แมตช์รอล่วงหน้าทั้งหมดเลย
                lolMatches.slice(0, 10).forEach(m => {
                    runWorkerTask('lol', 'getMatchDetail', { matchId: m.match_uid, puuid: lolPlayer.player_uid }, configLoL);
                });
            }
            console.log("LoL prefetch initiated.");
        } catch (e) {
            console.warn("LoL prefetch failed:", e);
        }
    };

    // แยกการทำงานออกเป็นขนานกัน
    if (targetGame === 'all' || targetGame === 'dota2') {
        prefetchDota2();
    }
    if (targetGame === 'all' || targetGame === 'lol') {
        prefetchLol();
    }
};

// ============================================================
// Shared Render Helpers & Utilities
// ============================================================

const emptyPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * ฟังก์ชันช่วยสร้าง HTML Tag สำหรับรูปภาพ พร้อมจัดการ fallback กรณีโหลดรูปเฟล
 */
const renderImg = (src, extraClass = "", title = "") => {
    const imgSrc = typeof src === 'object' && src !== null ? src.img : src;
    const imgTitle = typeof src === 'object' && src !== null ? src.name : title;
    return `<img src="${imgSrc || emptyPixel}" title="${imgTitle || ''}" class="bg-[#182641] object-cover shrink-0 ${extraClass}" alt="${imgTitle || ''}" onerror="this.src='${emptyPixel}'" loading="lazy">`;
};

/**
 * จัดรูปแบบวินาทีให้อยู่ในฟอร์แมต "Xm Ys"
 */
function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

/**
 * คำนวณระยะเวลาของแมตช์ย้อนหลัง (เช่น "3h ago", "15m ago")
 */
function timeAgo(timestamp) {
    const isSeconds = timestamp < 10000000000;
    const timeMs = isSeconds ? timestamp * 1000 : timestamp;
    const seconds = Math.floor((new Date() - timeMs) / 1000);
    const hours = seconds / 3600;
    
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = Math.floor(hours % 24);
        return remainingHours > 0 ? `${days}d ${remainingHours}h ago` : `${days}d ago`;
    }
    if (hours >= 1) {
        return Math.floor(hours) + "h ago";
    }
    const minutes = seconds / 60;
    return Math.floor(minutes) + "m ago";
}

// ============================================================
// Game Selector – ปุ่มเลือกเกม (Dota 2 / LoL)
// ============================================================
function setupGameSelector(activePage) {
    const btnDota = document.getElementById('btn-dota2');
    const btnLol = document.getElementById('btn-lol');
    if (!btnDota || !btnLol) return;

    const activeClasses = ['bg-[#104245]', 'text-white', 'border', 'border-[#238c8f]'];
    const inactiveClasses = ['bg-[#181f3b]', 'text-[#8b8c98]', 'border', 'border-white/10'];

    if (activePage === 'dota2') {
        btnDota.classList.remove(...inactiveClasses);
        btnDota.classList.add(...activeClasses);
        btnLol.classList.remove(...activeClasses);
        btnLol.classList.add(...inactiveClasses);
    } else if (activePage === 'lol') {
        btnLol.classList.remove(...inactiveClasses);
        btnLol.classList.add(...activeClasses);
        btnDota.classList.remove(...activeClasses);
        btnDota.classList.add(...inactiveClasses);
    }
}

// ============================================================
// Header Initialization
// ============================================================
function initHeader(options = {}) {
    const { activePage } = options;
    if (activePage) setupGameSelector(activePage);
}

// ============================================================
// Core Unified Data Layer & Optimization Helpers (Logic separation)
// ============================================================

/**
 * ดึงข้อมูลโปรไฟล์ Dota 2 รวบยอดจาก Backend (เก็บใน MongoDB)
 */
window.getDota2Profile = async function (accountId, isSilent = false) {
    const username = localStorage.getItem("username") || "";
    const res = await fetch(`/api/game-stats/dota2/${accountId}?username=${encodeURIComponent(username)}&isSilent=${isSilent}`);
    if (!res.ok) {
        let errMessage = `Failed to fetch Dota 2 profile: ${res.status}`;
        try {
            const errJson = await res.json();
            if (errJson && errJson.error) {
                errMessage = errJson.error;
            }
        } catch (_) {}
        throw new Error(errMessage);
    }
    return res.json();
};

/**
 * ดึงรายละเอียดแมตช์ Dota 2 จาก Backend (เก็บใน MongoDB)
 */
window.getDota2MatchDetail = async function (matchId, accountId, isSilent = false) {
    const username = localStorage.getItem("username") || "";
    const res = await fetch(`/api/game-stats/dota2/match/${matchId}?accountId=${accountId}&username=${encodeURIComponent(username)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch Dota 2 match details: ${res.status}`);
    }
    return res.json();
};

/**
 * ดึงข้อมูลโปรไฟล์ LoL รวบยอดจาก Backend (เก็บใน MongoDB)
 */
window.getLolProfile = async function (riotId, isSilent = false) {
    const username = localStorage.getItem("username") || "";
    const res = await fetch(`/api/game-stats/lol/${encodeURIComponent(riotId)}?username=${encodeURIComponent(username)}&isSilent=${isSilent}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch LoL profile: ${res.status}`);
    }
    return res.json();
};

/**
 * ดึงรายละเอียดแมตช์ LoL จาก Backend (เก็บใน MongoDB)
 */
window.getLolMatchDetail = async function (matchId, puuid, isSilent = false) {
    const username = localStorage.getItem("username") || "";
    const res = await fetch(`/api/game-stats/lol/match/${matchId}?puuid=${puuid}&username=${encodeURIComponent(username)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch LoL match details: ${res.status}`);
    }
    return res.json();
};

/**
 * คำนวณความชำนาญแชมเปี้ยน LoL
 */
window.calculateLolChampionStats = function (matchDetails, isSilent = false) {
    const config = { routingRegion: 'sea', region: 'sg2', skipCache: isSilent === true };
    return runWorkerTask('lol', 'getChampionStats', { matchDetails }, config);
};

// Auto-run background prefetch on DOM load
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        if (typeof window.prefetchGameData === 'function') {
            window.prefetchGameData();
        }
    }, 500);
});

