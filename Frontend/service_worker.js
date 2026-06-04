// ============================================================
// PENTAGRAM SERVICE WORKER (service_worker.js)
// ============================================================
// ไฟล์นี้ควบคุมการแคชสำหรับใช้งานแบบ Offline เต็มรูปแบบ (App Shell)
// และช่วยเพิ่มความเร็วในการดึงข้อมูลเกมผ่านกลยุทธ์แคชระดับ L2

const PRECACHE_NAME = 'pentagram-app-shell-v1';
const MATCH_CACHE_NAME = 'pentagram-match-cache';
const API_CACHE_NAME = 'pentagram-api-cache';
const METADATA_CACHE_NAME = 'pentagram-metadata';

// TTLs (อายุการเก็บข้อมูล API)
const MATCH_TTL = 24 * 60 * 60 * 1000; // 24 ชั่วโมง
const API_TTL = 60 * 1000;             // 1 นาที

// รายการไฟล์ของเว็บไซต์หลักที่ต้องแคชเพื่อให้ใช้งานแบบ Offline ได้สมบูรณ์ (App Shell)
const PRECACHE_URLS = [
    '/',
    '/HTML/index.html',
    '/HTML/login.html',
    '/HTML/register.html',
    '/HTML/dashboard.html',
    '/HTML/feeds.html',
    '/HTML/profile.html',
    '/HTML/share-profile.html',
    '/HTML/create-post.html',
    '/HTML/fav-post.html',
    '/HTML/gamedetail_dota2.html',
    '/HTML/gamedetail_lol.html',
    '/HTML/header.html',
    
    // CSS Stylesheets
    '/CSS/global-style.css',
    '/CSS/auth-landing-style.css',
    '/CSS/create-post-style.css',
    '/CSS/dashboard-style.css',
    '/CSS/fav-post-style.css',
    '/CSS/feeds-style.css',
    '/CSS/gamedetail-style.css',
    '/CSS/header-style.css',
    '/CSS/profile-style.css',
    
    // JavaScript Logic
    '/JS/components/header.js',
    '/JS/core/api_client.js',
    '/JS/pages/auth-login.js',
    '/JS/pages/auth-register.js',
    '/JS/pages/create-post.js',
    '/JS/pages/dashboard.js',
    '/JS/pages/fav-post.js',
    '/JS/pages/feeds.js',
    '/JS/pages/gamedetail_dota2.js',
    '/JS/pages/gamedetail_lol.js',
    '/JS/pages/profile.js',
    '/JS/pages/set-profile.js',
    '/JS/pages/profile/owner_ui.js',
    
    // Web Workers
    '/JS/workers/api_worker.js',
    '/JS/workers/profile-worker.js',
    '/JS/workers/consistency-worker.js',
    '/JS/workers/moba-score-worker.js',
    '/JS/workers/lol_handler.js',
    '/JS/workers/dota_handler.js',
    
    // Core Static Assets
    '/assets/logo.png',
    '/assets/dota2-logo.png',
    '/assets/dota2-rank.png',
    '/assets/lol-logo.png',
    '/assets/Rectangle_63.png',
    '/assets/image.png',
    '/assets/image2.png',
    '/assets/logo1.png',
    
    // CDN Resources (Fonts & Icons)
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// 1. ติดตั้ง Service Worker และพรีแคชข้อมูลหลัก
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(PRECACHE_NAME)
            .then((cache) => {
                console.log('Pentagram Service Worker: Pre-caching App Shell...');
                // ค่อยๆ โหลดทีละไฟล์ ป้องกันพังถ้าระบบอินเทอร์เน็ตไม่ดี
                return cache.addAll(PRECACHE_URLS).catch(err => {
                    console.warn('Pre-cache failed for some resources, trying fallback registration:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

// 2. เปิดใช้งาน Service Worker และคลีนแคชเก่า
self.addEventListener('activate', (event) => {
    const activeCaches = [PRECACHE_NAME, MATCH_CACHE_NAME, API_CACHE_NAME, METADATA_CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!activeCaches.includes(cacheName)) {
                        console.log('Pentagram Service Worker: Removing obsolete cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. ดักจับและควบคุม Fetch requests
self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    const request = event.request;

    // ข้ามการจัดการคำขอที่ไม่ใช่ GET หรือเป็น Endpoint อัปโหลดไฟล์
    if (request.method !== 'GET' || url.includes('/api/profile/media') || url.includes('/api/profile/upload-avatar')) {
        return;
    }

    // A. สำหรับการขอเปลี่ยนหน้าเว็บหลัก (Navigate/HTML Pages)
    // ใช้กลยุทธ์ Network-First, Cache-Fallback เพื่อความสดใหม่ของหน้าเว็บ
    const isHtmlPage = request.mode === 'navigate' || 
                       url.endsWith('.html') || 
                       url.includes('/HTML/') || 
                       new URL(url).pathname === '/';

    if (isHtmlPage) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // ถ้าดึงข้อมูลจากอินเทอร์เน็ตสำเร็จ ให้เก็บลงแคชด้วย
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(PRECACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // หากออฟไลน์ (Offline) ดึงจาก Cache มาแทน
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Fallback พิเศษสำหรับหน้าแรกสุด
                        if (new URL(url).pathname === '/') {
                            return caches.match('/HTML/index.html');
                        }
                        // ดึงไฟล์ HTML แบบจำกัดความผิดพลาด
                        const path = new URL(url).pathname;
                        return caches.match(path) || caches.match('/HTML/index.html');
                    });
                })
        );
        return;
    }

    // B. สำหรับไฟล์สไตล์ สคริปต์ โลโก้ และฟอนต์หลักหลัก (Static Resources)
    // ใช้กลยุทธ์ Stale-While-Revalidate เปิดเร็วก่อน อัปเดตพื้นหลังเงียบๆ
    const isStaticAsset = url.includes('/CSS/') || 
                          url.includes('/JS/') || 
                          url.includes('/assets/') || 
                          url.includes('fonts.googleapis.com') || 
                          url.includes('fonts.gstatic.com') || 
                          url.includes('cdnjs.cloudflare.com');

    if (isStaticAsset) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(PRECACHE_NAME).then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // ออฟไลน์ ไม่เป็นไร ใช้แคชเดิม
                    });

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // C. กลยุทธ์การแคชของ API (ระบบเดิมของ Pentagram)
    const isHomeFeedsApi = url.includes('/api/posts');
    const isDashboardApi = url.includes('/api/get-friend-scores');

    if (isHomeFeedsApi || isDashboardApi) {
        event.respondWith(handleProfileFetch(request, API_CACHE_NAME, API_TTL));
        return;
    }

    const isOpenDotaMatch = url.includes('/api/matches/') || (url.includes('/players/') && url.includes('/matches'));
    const isRiotMatch = url.includes('/lol/match/v5/matches/');
    const isOpenDotaPlayer = url.includes('/api/players/') && !url.includes('/matches') && !url.includes('/wl');
    const isRiotPlayer = url.includes('/lol/summoner/v4/') || url.includes('/lol/league/v4/entries/') || url.includes('/riot/account/v1/');
    const isProfileSync = url.includes('/api/profile/sync-matches') || url.includes('/api/public-profile/');

    if (isOpenDotaMatch || isRiotMatch) {
        event.respondWith(handleCachedFetch(request, MATCH_CACHE_NAME, MATCH_TTL));
    } else if (isProfileSync) {
        event.respondWith(handleProfileFetch(request, API_CACHE_NAME, API_TTL));
    } else if (isOpenDotaPlayer || isRiotPlayer) {
        event.respondWith(handleCachedFetch(request, API_CACHE_NAME, API_TTL));
    }
});

// ฟังก์ชันดึง/เก็บข้อมูลแคชตามลำดับความต้องการแบบดั้งเดิมของ Pentagram
async function handleCachedFetch(request, cacheName, ttl) {
    const cache = await caches.open(cacheName);
    const metadataCache = await caches.open(METADATA_CACHE_NAME);

    // ข้ามแคชหากเป็นคำขอ POST หรือส่งพารามิเตอร์ skipCache มาใน URL
    const isSkipCache = request.url.includes('skipCache=true') || request.method !== 'GET';

    if (!isSkipCache) {
        const cachedResponse = await cache.match(request);
        const metadata = await metadataCache.match(request.url);

        if (cachedResponse && metadata) {
            try {
                const timestamp = parseInt(await metadata.text());
                // ถ้าข้อมูลยังไม่หมดอายุ (ยังไม่เกิน TTL) ให้ส่งคืนแคชทันที
                if (Date.now() - timestamp < ttl) {
                    return cachedResponse;
                }
            } catch (e) { }
        }
    }

    // หากไม่มีแคช หรือหมดอายุแล้ว ให้ดึงข้อมูลผ่านอินเทอร์เน็ตจริง
    try {
        const networkResponse = await fetch(request);
        if (request.method === 'GET' && networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            await metadataCache.put(request.url, new Response(Date.now().toString()));
        }
        return networkResponse;
    } catch (err) {
        // กรณี Offline หรืออินเทอร์เน็ตหลุด ให้ส่งคืนข้อมูลล่าสุดที่มีในแคช (แม้จะหมดอายุก็ตาม)
        const fallbackResponse = await cache.match(request);
        if (fallbackResponse) return fallbackResponse;
        throw err;
    }
}

// กลยุทธ์ Network-first สำหรับหน้าโปรไฟล์ ป้องกันการดึงข้อมูลไม่อัปเดต
async function handleProfileFetch(request, cacheName, ttl) {
    const cache = await caches.open(cacheName);
    const metadataCache = await caches.open(METADATA_CACHE_NAME);

    try {
        const networkResponse = await fetch(request);
        if (request.method === 'GET' && networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            await metadataCache.put(request.url, new Response(Date.now().toString()));
        }
        return networkResponse;
    } catch (err) {
        // ออฟไลน์ ดึงข้อมูลล่าสุดในแคชแทน
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;
        throw err;
    }
}
