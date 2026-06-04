const path = require('path');
// โหลด .env จากทั้งไดเรกทอรีปัจจุบันและไดเรกทอรีหลัก (Parent) เพื่อให้รันได้ไม่ว่าจะอยู่ที่ไหน
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log("DNS servers set to Google (8.8.8.8) and Cloudflare (1.1.1.1) programmatically.");
} catch (dnsErr) {
    console.warn("Could not set custom DNS servers, using system default:", dnsErr.message);
}

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const qrcode = require('qrcode');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const sanitizeHtml = require('sanitize-html'); // Sanitize user input (Backend)
const validator    = require('validator');      // Validate user input (Backend)
const User = require('./models/User');
const Profile = require('./models/Profile');
const Post = require('./models/Post');
const Favorite = require('./models/Favorite');
const GameStats = require('./models/GameStats');
const gameStatsRouter = require('./routes/gameStats');
const {
    TOTP_PERIOD_SECONDS,
    TOTP_WINDOW_STEPS,
    generateTotpSecret,
    verifyTotpToken,
    buildOtpAuthUri
} = require('./utils/totp');

// BUG FIX 1: trim() กัน whitespace ใน .env ที่ทำให้ key ขึ้น 401
const RIOT_API_KEY = (process.env.RIOT_API_KEY || '').trim();
const RIOT_REGION = (process.env.RIOT_REGION || 'sea').trim();
const OPEN_DOTA_BASE_URL = process.env.OPEN_DOTA_BASE_URL || 'https://api.opendota.com/api';

// BUG FIX 2: เพิ่ม Account API routing สำหรับ SEA/Garena
// Account v1 ใช้ routing ต่างจาก Match v5
const ACCOUNT_ROUTING_REGIONS = ['sea', 'asia', 'americas', 'europe'];
// Match v5 และ League v4 ใช้ platform region (sg2, th2 ฯลฯ) หรือ routing region (sea)
const MATCH_ROUTING_REGION = RIOT_REGION; // sea ถูกต้องสำหรับ SEA match history

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use('/api', gameStatsRouter);

// Setup Swagger UI
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Serve Frontend static files
app.use(express.static(path.join(__dirname, '../Frontend')));

// Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, (req.body.username || 'unknown') + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
const memoryUpload = multer({ storage: multer.memoryStorage() });

async function cleanupLegacyIndexes() {
    try {
        await User.collection.dropIndex('email_1');
        console.log('Dropped legacy email_1 index');
    } catch (err) {
        if (err.codeName !== 'IndexNotFound' && err.code !== 27) {
            console.log('Legacy index cleanup skipped:', err.message);
        }
    }
}

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

async function fetchJson(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const text = await response.text();
        if (!response.ok) {
            throw new Error(text || `Upstream request failed with ${response.status}`);
        }
        return text ? JSON.parse(text) : {};
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchJsonWithRetry(url, options = {}, timeoutMs = 8000, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fetchJson(url, options, timeoutMs);
        } catch (err) {
            lastError = err;
            console.warn(`[RETRY] Fetch failed for ${url} (Attempt ${attempt}/${maxRetries}): ${err.message}`);
            if (attempt < maxRetries) {
                // Wait 1.5 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    }
    throw lastError || new Error(`Request failed after ${maxRetries} attempts`);
}


function getMobaTierLabel(score) {
    if (score >= 901) return "Grandmaster";
    if (score >= 751) return "Diamond";
    if (score >= 601) return "Platinum";
    if (score >= 451) return "Gold";
    if (score >= 301) return "Silver";
    if (score >= 151) return "Bronze";
    return "Iron Vanguard";
}

function parseRankToPercentile(game, rawRankData) {
    if (game === 'dota') {
        const tier = Number(rawRankData) || 10;
        return Math.min(100, Math.max(10, (tier / 85) * 100));
    }
    if (game === 'lol') {
        const tier = String(rawRankData || '').toUpperCase();
        const tierWeights = {
            'CHALLENGER': 100, 'GRANDMASTER': 95, 'MASTER': 88,
            'DIAMOND': 75, 'EMERALD': 63, 'PLATINUM': 50,
            'GOLD': 38, 'SILVER': 25, 'BRONZE': 12, 'IRON': 5
        };
        return tierWeights[tier] || 15;
    }
    return 0;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function calculateStatPercentile(metric, value) {
    const baselines = {
        kda: { low: 1.5, high: 4.5 },
        kp: { low: 25, high: 75 },
        dpm: { low: 250, high: 750 },
        farm: { low: 3.5, high: 9.0 },
        gold: { low: 300, high: 650 }
    };
    const set = baselines[metric];
    if (!set) return 50;
    const pct = ((value - set.low) / (set.high - set.low)) * 100;
    return clamp(Math.round(pct), 10, 100);
}

function buildEmptyVerificationResult(source) {
    return { source, status: 'unlinked', verified: false, displayName: '', sourceId: '', details: {}, error: null };
}

function normalizeMediaItems(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => ({ image: String(item?.image || '').trim(), text: String(item?.text || '').trim() }))
        .filter((item) => item.image || item.text)
        .slice(0, 10);
}

function getMediaFieldName(kind) { return kind === 'achievement' ? 'achievements' : 'trophies'; }
function getMediaLabel(kind) { return kind === 'achievement' ? 'Achievement' : 'Trophy'; }

function countWords(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return 0;
    return normalized.split(/\s+/).filter(Boolean).length;
}

function normalizeMediaCaption(text) { return String(text || '').trim(); }

function addActivityCount(activityMap, timestampMs, count = 1) {
    if (!timestampMs) return;
    const dateKey = new Date(timestampMs).toISOString().split('T')[0];
    const currentCount = activityMap.get(dateKey) || 0;
    activityMap.set(dateKey, currentCount + count);
}

async function fetchRiotActivityData(profile) {
    if (!RIOT_API_KEY || !profile?.lolId) return new Map();
    const riotResult = await resolveRiotProfile(profile.lolId || '');
    if (!riotResult.verified || !riotResult.sourceId) return new Map();

    const activityMap = new Map();
    try {
        const matchIds = await fetchJson(
            `https://${MATCH_ROUTING_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(riotResult.sourceId)}/ids?start=0&count=25`,
            { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        );
        if (!Array.isArray(matchIds) || matchIds.length === 0) return activityMap;
        for (const matchId of matchIds) {
            try {
                const matchData = await fetchJson(
                    `https://${MATCH_ROUTING_REGION}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
                    { headers: { 'X-Riot-Token': RIOT_API_KEY } }
                );
                const timestampMs = matchData?.info?.gameStartTimestamp || matchData?.info?.gameCreation || null;
                addActivityCount(activityMap, timestampMs, 1);
            } catch (_) { }
        }
    } catch (_) { }
    return activityMap;
}

async function fetchDotaActivityData(profile) {
    if (!profile?.dotaId) return new Map();
    const rawId = String(profile.dotaId || '').trim();
    if (!rawId) return new Map();
    const activityMap = new Map();
    try {
        const matches = await fetchJson(`${OPEN_DOTA_BASE_URL}/players/${encodeURIComponent(rawId)}/matches?limit=25`);
        if (!Array.isArray(matches) || matches.length === 0) return activityMap;
        for (const match of matches) {
            addActivityCount(activityMap, match?.start_time ? match.start_time * 1000 : null, 1);
        }
    } catch (_) { }
    return activityMap;
}

function mergeActivityMaps(...maps) {
    const merged = new Map();
    for (const sourceMap of maps) {
        if (!(sourceMap instanceof Map)) continue;
        for (const [dateKey, count] of sourceMap.entries()) {
            merged.set(dateKey, (merged.get(dateKey) || 0) + (Number(count) || 0));
        }
    }
    return merged;
}

// BUG FIX 4: resolveRiotProfile แยก Account routing (ลอง sea ก่อน) ออกจาก Match routing
async function resolveRiotProfile(lolId) {
    if (!lolId) return buildEmptyVerificationResult('riot');
    if (!RIOT_API_KEY) return { ...buildEmptyVerificationResult('riot'), status: 'unconfigured', error: 'RIOT_API_KEY is missing' };

    try {
        const decodedRiotId = decodeURIComponent(String(lolId || '').trim());
        const [gameName, tagLine] = decodedRiotId.split('#');
        if (!gameName || !tagLine) throw new Error("Invalid Riot ID format (use Name#Tag, e.g. Faker#KR1)");

        // ลอง sea ก่อน แล้วค่อย fallback ไปที่อื่น
        const routingRegions = Array.from(new Set([RIOT_REGION, ...ACCOUNT_ROUTING_REGIONS]));
        let accountData = null;
        let lastError = null;

        for (const region of routingRegions) {
            try {
                accountData = await fetchJson(
                    `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
                    { headers: { 'X-Riot-Token': RIOT_API_KEY } },
                    6000
                );
                if (accountData?.puuid) break;
            } catch (regionErr) {
                lastError = regionErr;
            }
        }

        if (!accountData || !accountData.puuid) {
            throw lastError || new Error('Riot ID not found in any region');
        }

        return {
            source: 'riot', status: 'verified', verified: true,
            displayName: `${accountData.gameName}#${accountData.tagLine}`,
            sourceId: accountData.puuid,
            details: { puuid: accountData.puuid },
            error: null
        };
    } catch (err) {
        return { ...buildEmptyVerificationResult('riot'), status: 'unverified', error: err.message };
    }
}

async function resolveDotaProfile(dotaId) {
    if (!dotaId) return buildEmptyVerificationResult('opendota');
    const rawId = String(dotaId).trim();
    try {
        const dotaProfile = await fetchJsonWithRetry(`${OPEN_DOTA_BASE_URL}/players/${encodeURIComponent(rawId)}`, {}, 12000, 3);
        const personaName = dotaProfile?.profile?.personaname || '';
        return {
            source: 'opendota',
            status: personaName ? 'verified' : 'unverified',
            verified: Boolean(personaName),
            displayName: personaName || rawId,
            sourceId: rawId,
            details: {
                avatar: dotaProfile?.profile?.avatarfull || null,
                rankTier: dotaProfile?.rank_tier ?? null,
                mmrEstimate: dotaProfile?.mmr_estimate?.estimate ?? null,
                personaname: personaName || null
            },
            error: personaName ? null : 'Player profile not found'
        };
    } catch (err) {
        return { ...buildEmptyVerificationResult('opendota'), status: 'unverified', error: err.message };
    }
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // ── Step 1: ตรวจว่ามีข้อมูลส่งมาไหม ──────────────────────────────────
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        if (/\s/.test(password)) {
            return res.status(400).json({ error: 'Password must not contain spaces' });
        }

        // ── Step 2: Sanitize ด้วย sanitize-html (ไม่เขียน regex เอง) ───────────
        // allowedTags/allowedAttributes: {} หมายถึงไม่ยอมให้มี HTML ใดๆ → ได้ plain text
        const sanitizeOptions = { allowedTags: [], allowedAttributes: {} };
        const cleanUsername = sanitizeHtml(String(username).trim(), sanitizeOptions);
        const cleanPassword = sanitizeHtml(String(password), sanitizeOptions);

        // ── Step 3: Validate Username ด้วย validator ──────────────────────────
        // validator.isLength   → ความยาว 4–20 ตัว
        // validator.matches    → pattern ตัวพิมพ์เล็ก, เลข, _ และ . เท่านั้น
        if (!validator.isLength(cleanUsername, { min: 4, max: 20 })) {
            return res.status(400).json({ error: 'Username must be between 4 and 20 characters long' });
        }
        if (!validator.matches(cleanUsername, /^[a-z0-9_.]+$/)) {
            return res.status(400).json({ error: 'Username can only contain lowercase letters (a-z), numbers (0-9), underscores (_), and periods (.)' });
        }

        // ── Step 4: Validate Password ด้วย validator ──────────────────────────
        // validator.isLength         → ความยาว 8–20 ตัว
        // validator.isStrongPassword → ต้องมีตัวเล็ก, ใหญ่, เลข, อักขระพิเศษ
        if (!validator.isLength(cleanPassword, { min: 8, max: 20 })) {
            return res.status(400).json({ error: 'Password must be between 8 and 20 characters long' });
        }
        if (!validator.isStrongPassword(cleanPassword, {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        })) {
            return res.status(400).json({ error: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (e.g., !@#$%)' });
        }

        // ── Step 5: ตรวจ Username ซ้ำในระบบ ───────────────────────────────────
        const existingUser = await User.findOne({ username: cleanUsername });
        if (existingUser) {
            return res.status(400).json({ error: 'This username is already taken. Please choose another one.' });
        }

        // ── Step 6: สร้าง Account ──────────────────────────────────────────────
        const hashedPassword = await bcrypt.hash(cleanPassword, 10);
        const mfaSecret = generateTotpSecret();

        await User.create({ username: cleanUsername, password: hashedPassword, mfaSecret });
        await Profile.findOneAndUpdate(
            { username: cleanUsername },
            { $setOnInsert: { username: cleanUsername, avatar: '', verified: false, lolId: '', dotaId: '', skillTags: [], trophies: [], achievements: [] } },
            { upsert: true, new: true }
        );

        const qr = await qrcode.toDataURL(buildOtpAuthUri(cleanUsername, mfaSecret));
        res.json({ message: "Registered", qrCode: qr });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login-step1', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (/\s/.test(password)) return res.status(400).json({ error: 'Password must not contain spaces' });
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).send("Invalid");
    const challengeToken = jwt.sign({ username: user.username }, process.env.JWT_SECRET || 'secret123', { expiresIn: '5m' });
    res.json({ require2FA: true, username: user.username, challengeToken });
});

app.post('/api/auth/login-step2', async (req, res) => {
    const { username, challengeToken, token2FA, token, code, otp } = req.body;
    const providedToken = token2FA || token || code || otp;
    if (!providedToken) return res.status(400).send('Missing 2FA token');

    let resolvedUsername = username;
    if (!resolvedUsername && challengeToken) {
        try {
            const payload = jwt.verify(challengeToken, process.env.JWT_SECRET || 'secret123');
            resolvedUsername = payload.username;
        } catch (err) {
            return res.status(401).send('Invalid login challenge');
        }
    }
    if (!resolvedUsername) return res.status(400).send('Missing username');

    const user = await User.findOne({ username: resolvedUsername });
    if (!user || !user.mfaSecret) return res.status(401).send('User not found');

    if (verifyTotpToken(user.mfaSecret, providedToken, { step: TOTP_PERIOD_SECONDS, window: TOTP_WINDOW_STEPS, digits: 6 })) {
        const tok = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'secret123', { expiresIn: '12h' });
        res.json({ token: tok });
    } else {
        res.status(403).send("Invalid 2FA");
    }
});

// ==================== USER SEARCH ====================

app.get('/api/users/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q) return res.json([]);

        // Escape regex special characters to prevent ReDoS and unexpected behavior
        const escapedQ = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        // Search usernames that contain the query (case-insensitive, max 20 results)
        const users = await User.find(
            { username: { $regex: escapedQ, $options: 'i' } },
            { username: 1, _id: 0 }
        ).limit(20);

        res.json(users.map(u => u.username));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== PUBLIC PROFILE ====================

app.get('/api/public-profile/:username', async (req, res) => {
    try {
        const username = req.params.username;
        console.log(`\n[GET /api/public-profile] ========== START ==========`);
        console.log(`[GET /api/public-profile] Fetching profile for username: "${username}"`);
        
        const profile = await Profile.findOne({ username });
        console.log(`[GET /api/public-profile] After findOne - profile exists:`, !!profile);
        
        if (!profile) {
            console.log(`[GET /api/public-profile] Profile not found for username: "${username}"`);
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Debug: Check exactly what's in the document
        console.log(`[GET /api/public-profile] Raw Mongoose document skillTags:`, {
            type: typeof profile.skillTags,
            constructor: profile.skillTags?.constructor?.name,
            isArray: Array.isArray(profile.skillTags),
            length: profile.skillTags?.length,
            value: profile.skillTags,
            raw: JSON.stringify(profile.skillTags)
        });
        
        // Try converting to array
        let skillTagsArray = Array.isArray(profile.skillTags) ? profile.skillTags : [];
        console.log(`[GET /api/public-profile] After conversion to Array:`, {
            length: skillTagsArray.length,
            value: skillTagsArray
        });

        // Safety fallback: sometimes Mongoose returns a truncated array compared to the raw MongoDB document.
        // Read the native MongoDB document and prefer its `skillTags` if it's longer.
        try {
            const rawDoc = await Profile.collection.findOne({ username });
            if (rawDoc && Array.isArray(rawDoc.skillTags) && rawDoc.skillTags.length > (skillTagsArray.length || 0)) {
                console.log('[GET /api/public-profile] Detected longer skillTags in raw MongoDB doc, using raw value to avoid truncation:', rawDoc.skillTags.length);
                skillTagsArray = rawDoc.skillTags;
            }
        } catch (rawErr) {
            console.warn('[GET /api/public-profile] Could not read raw MongoDB document for fallback:', rawErr.message);
        }

        // แปลง Mongoose Map ของ activityData ให้กลายเป็น Plain Object
        const combinedActivityData = profile.activityData instanceof Map
            ? Object.fromEntries(profile.activityData)
            : (profile.activityData || {});

        let crossGameStatus = {};
        if (profile.verified) {
            crossGameStatus = {
                mobaScore: profile.mobaScore ?? null,
                rank: profile.rankTierLabel ?? null,
                rankSkill: profile.rankSkill ?? null,
                winEfficiency: profile.winEfficiency ?? null,
                combatPerformance: profile.combatPerformance ?? null,
                economySkill: profile.economySkill ?? null
            };
        } else {
            crossGameStatus = {
                mobaScore: null,
                rank: null,
                rankSkill: null,
                winEfficiency: null,
                combatPerformance: null,
                economySkill: null
            };
        }

        // Self-heal: generate shareId for old profiles that don't have one yet
        if (!profile.shareId) {
            profile.shareId = require('crypto').randomBytes(16).toString('hex');
            await profile.save();
            console.log(`[GET /api/public-profile] Generated new shareId for profile: "${username}"`);
        }

        const responseData = {
            username: profile.username,
            shareId: profile.shareId,
            avatar: profile.avatar || '',
            verified: profile.verified,
            lolId: profile.lolId || '-',
            dotaId: profile.dotaId || '-',
            skillTags: skillTagsArray,
            trophies: normalizeMediaItems(profile.trophies),
            achievements: normalizeMediaItems(profile.achievements),
            activityData: combinedActivityData,
            crossGameStatus
        };
        
        console.log(`[GET /api/public-profile] Final response data:`, {
            skillTagsLength: responseData.skillTags.length,
            skillTags: responseData.skillTags,
            trophiesLength: responseData.trophies.length,
            achievementsLength: responseData.achievements.length
        });
        
        console.log(`[GET /api/public-profile] ========== END ==========\n`);
        res.json(responseData);

    } catch (err) {
        console.error('[GET /api/public-profile] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== SHARE TOKEN ENDPOINTS ====================

// GET by shareId — ใช้จากหน้า share-profile.html?t=<shareId>
app.get('/api/share/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;
        if (!shareId || shareId.length < 8) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const profile = await Profile.findOne({ shareId });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Reuse the same skillTags safety logic
        let skillTagsArray = Array.isArray(profile.skillTags) ? profile.skillTags : [];
        try {
            const rawDoc = await Profile.collection.findOne({ shareId });
            if (rawDoc && Array.isArray(rawDoc.skillTags) && rawDoc.skillTags.length > skillTagsArray.length) {
                skillTagsArray = rawDoc.skillTags;
            }
        } catch (_) {}

        const combinedActivityData = profile.activityData instanceof Map
            ? Object.fromEntries(profile.activityData)
            : (profile.activityData || {});

        const crossGameStatus = profile.verified ? {
            mobaScore: profile.mobaScore ?? null,
            rank: profile.rankTierLabel ?? null,
            rankSkill: profile.rankSkill ?? null,
            winEfficiency: profile.winEfficiency ?? null,
            combatPerformance: profile.combatPerformance ?? null,
            economySkill: profile.economySkill ?? null
        } : {
            mobaScore: null, rank: null, rankSkill: null,
            winEfficiency: null, combatPerformance: null, economySkill: null
        };

        res.json({
            username: profile.username,
            shareId: profile.shareId,
            avatar: profile.avatar || '',
            verified: profile.verified,
            lolId: profile.lolId || '-',
            dotaId: profile.dotaId || '-',
            skillTags: skillTagsArray,
            trophies: normalizeMediaItems(profile.trophies),
            achievements: normalizeMediaItems(profile.achievements),
            activityData: combinedActivityData,
            crossGameStatus
        });
    } catch (err) {
        console.error('[GET /api/share] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST regenerate shareId — ปุ่ม Share บนหน้า Profile ของเจ้าของ
// ล้าง link เก่าทันที — token ใหม่จะใช้ได้, token เก่าจะ 404 ทันที
app.post('/api/profile/regenerate-share', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const username = decoded.username;
        const newShareId = require('crypto').randomBytes(16).toString('hex');

        const profile = await Profile.findOneAndUpdate(
            { username },
            { shareId: newShareId },
            { new: true, upsert: false }
        );

        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        console.log(`[POST /api/profile/regenerate-share] New shareId for "${username}": ${newShareId}`);
        res.json({ shareId: newShareId });
    } catch (err) {
        console.error('[POST /api/profile/regenerate-share] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/debug/inspect-profile/:username', async (req, res) => {
    try {
        const username = req.params.username;
        console.log(`\n[DEBUG /inspect-profile] Directly reading from MongoDB for: "${username}"`);
        
        // Use native MongoDB driver to bypass any Mongoose processing
        const profile = await Profile.collection.findOne({ username });
        console.log(`[DEBUG /inspect-profile] Raw MongoDB document:`, {
            username: profile?.username,
            skillTagsType: typeof profile?.skillTags,
            skillTagsLength: profile?.skillTags?.length,
            skillTags: profile?.skillTags
        });
        
        // Also read through Mongoose
        const mongooseProfile = await Profile.findOne({ username });
        console.log(`[DEBUG /inspect-profile] Via Mongoose:`, {
            skillTagsType: typeof mongooseProfile?.skillTags,
            skillTagsLength: mongooseProfile?.skillTags?.length,
            skillTags: mongooseProfile?.skillTags
        });
        
        res.json({
            raw_mongodb: profile?.skillTags,
            mongoose: mongooseProfile?.skillTags,
            username
        });
    } catch (err) {
        console.error('[DEBUG /inspect-profile] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/debug/db-info', async (req, res) => {
    try {
        const users = await mongoose.model('User').find({});
        const profiles = await Profile.find({});
        res.json({
            connectionUri: mongoose.connection.client?.s?.url || "hidden",
            dbName: mongoose.connection.db.databaseName,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            usersInActiveDb: users.map(u => u.username),
            profilesInActiveDb: profiles.map(p => ({ username: p.username, skillTags: p.skillTags }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== PROFILE ROUTES ====================

app.post('/api/profile/verify-games', async (req, res) => {
    try {
        const { username, lolId, dotaId } = req.body;
        if (!username) return res.status(400).json({ error: 'User account information not found (Username)' });

        const currentProfile = await Profile.findOne({ username });
        if (!currentProfile) return res.status(404).json({ error: 'This profile was not found in the system' });

        if (lolId && lolId.trim() !== "" && lolId.trim() !== "-") {
            const existingLol = await Profile.findOne({ lolId: lolId.trim(), username: { $ne: username } });
            if (existingLol) return res.status(400).json({ error: `League of Legends ID (${lolId}) is already registered by another user` });
        }
        if (dotaId && dotaId.trim() !== "" && dotaId.trim() !== "-") {
            const existingDota = await Profile.findOne({ dotaId: dotaId.trim(), username: { $ne: username } });
            if (existingDota) return res.status(400).json({ error: `DOTA 2 ID (${dotaId}) is already registered by another user` });
        }

        const cleanedLolId = String(lolId || '').trim();
        const cleanedDotaId = String(dotaId || '').trim();

        const [lolVerification, dotaVerification] = await Promise.all([
            cleanedLolId && cleanedLolId !== '-'
                ? resolveRiotProfile(cleanedLolId)
                : Promise.resolve(buildEmptyVerificationResult('riot')),
            cleanedDotaId && cleanedDotaId !== '-'
                ? resolveDotaProfile(cleanedDotaId)
                : Promise.resolve(buildEmptyVerificationResult('opendota'))
        ]);

        const isLolValid = Boolean(lolVerification.verified);
        const isDotaValid = Boolean(dotaVerification.verified);

        const verificationErrors = [];
        if (cleanedLolId && cleanedLolId !== '-' && !isLolValid) {
            let errMsg = lolVerification.error || 'This Riot ID was not found. Please check the spelling.';
            try {
                const parsed = JSON.parse(errMsg);
                if (parsed.error) errMsg = parsed.error;
            } catch (_) {}
            verificationErrors.push(`League of Legends (LoL): ${errMsg}`);
        }
        if (cleanedDotaId && cleanedDotaId !== '-' && !isDotaValid) {
            let errMsg = dotaVerification.error || 'This DOTA 2 ID was not found in Steam.';
            try {
                const parsed = JSON.parse(errMsg);
                if (parsed.error) errMsg = parsed.error;
            } catch (_) {}
            if (errMsg.includes("rate limit exceeded")) {
                errMsg = "ความถี่ในการดึงข้อมูลเกินกำหนด (Rate Limit Exceeded) กรุณาลองใหม่อีกครั้งใน 1-2 นาที";
            }
            verificationErrors.push(`Dota 2: ${errMsg}`);
        }

        if (!isLolValid && !isDotaValid && verificationErrors.length > 0) {
            return res.status(400).json({ error: verificationErrors.join(' | ') });
        }

        if (cleanedLolId && cleanedLolId !== "-" && isLolValid) currentProfile.lolId = decodeURIComponent(cleanedLolId);
        if (cleanedDotaId && cleanedDotaId !== "-" && isDotaValid) currentProfile.dotaId = cleanedDotaId;
        if (isLolValid || isDotaValid) currentProfile.verified = true;

        await currentProfile.save();

        res.json({
            success: true,
            verified: currentProfile.verified,
            // BUG FIX 6: ส่ง input กลับถ้า DB ยังว่าง (lol ไม่ผ่านแต่ dota ผ่าน)
            lolId: currentProfile.lolId || cleanedLolId || '-',
            dotaId: currentProfile.dotaId || cleanedDotaId || '-',
            warnings: verificationErrors,
            message: verificationErrors.length > 0
                ? 'Partial verification succeeded: only the verified games were saved'
                : 'Verification and save completed successfully!'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/profile/update-skills (ประกาศครั้งเดียว ลบ duplicate ออก)
app.put('/api/profile/update-skills', async (req, res) => {
    console.log('--- update-skills API hit ---', { username: req.body.username, skillTags: req.body.skillTags });
    const { username, skillTags } = req.body;
    if (!username || !Array.isArray(skillTags)) {
        return res.status(400).json({ error: 'username and skillTags (array) are required' });
    }
    try {
        const normalizedSkillTags = skillTags.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
        console.log(`[UPDATE-SKILLS] Step 1: Normalized from ${skillTags.length} to ${normalizedSkillTags.length}:`, normalizedSkillTags);
        
        // Step 2: Before update - check current database state
        const beforeProfile = await Profile.findOne({ username });
        console.log(`[UPDATE-SKILLS] Step 2a: BEFORE update - DB has ${beforeProfile?.skillTags?.length || 0} skills:`, beforeProfile?.skillTags);
        
        // Step 3: Perform the update
        console.log(`[UPDATE-SKILLS] Step 3: Updating database with $set: { skillTags: [...] }`);
        const updatedProfile = await Profile.findOneAndUpdate(
            { username },
            { $set: { skillTags: normalizedSkillTags } },
            { new: true, upsert: true }
        );
        
        console.log(`[UPDATE-SKILLS] Step 4: After findOneAndUpdate (new: true), result has ${updatedProfile?.skillTags?.length || 0} skills:`, updatedProfile?.skillTags);
        
        // Step 5: Verify write was successful by reading directly
        const verifyProfile = await Profile.findOne({ username });
        console.log(`[UPDATE-SKILLS] Step 5: Verification read from DB: ${verifyProfile?.skillTags?.length || 0} skills:`, verifyProfile?.skillTags);
        
        // Step 6: Send response
        const responseSkills = updatedProfile?.skillTags || normalizedSkillTags;
        console.log(`[UPDATE-SKILLS] Step 6: Sending response with ${responseSkills.length} skills:`, responseSkills);
        
        res.json({ 
            success: true, 
            skillTags: responseSkills, 
            message: 'Skills saved successfully!',
            debug: {
                beforeCount: beforeProfile?.skillTags?.length || 0,
                afterCount: verifyProfile?.skillTags?.length || 0,
                responseCount: responseSkills.length
            }
        });
    } catch (err) {
        console.error('[UPDATE-SKILLS] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/profile/media', upload.single('image'), async (req, res) => {
    console.log('[POST /api/profile/media] Received request:', { username: req.body.username, kind: req.body.kind, hasFile: !!req.file });
    const { username, kind, text } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (!['trophy', 'achievement'].includes(kind)) return res.status(400).json({ error: 'Invalid media kind' });
    if (!req.file) return res.status(400).json({ error: 'Image is required' });
    const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
    if (!allowedMimeTypes.has(req.file.mimetype)) return res.status(400).json({ error: 'Only PNG, JPEG, GIF, or WEBP allowed' });
    const cleanedText = normalizeMediaCaption(text);
    if (!cleanedText) return res.status(400).json({ error: 'Caption is required' });
    if (countWords(cleanedText) > 100) return res.status(400).json({ error: 'Caption must be 100 words or fewer' });
    const mediaField = getMediaFieldName(kind);
    try {
        const profile = await Profile.findOne({ username });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        if (profile[mediaField].length >= 10) return res.status(400).json({ error: `${getMediaLabel(kind)} limit reached (10)` });
        
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        profile[mediaField].push({ image: imageUrl, text: cleanedText, createdAt: new Date() });
        console.log(`[POST /api/profile/media] Saving ${kind} to ${username}, total: ${profile[mediaField].length}`);
        await profile.save();
        console.log(`[POST /api/profile/media] Successfully saved, new count: ${profile[mediaField].length}`);
        
        res.status(201).json({ message: `${getMediaLabel(kind)} created`, [mediaField]: normalizeMediaItems(profile[mediaField]) });
    } catch (err) {
        console.error('[POST /api/profile/media] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/profile/media/:username/:index', upload.single('image'), async (req, res) => {
    const { username, index } = req.params;
    const { kind, text } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (!['trophy', 'achievement'].includes(kind)) return res.status(400).json({ error: 'Invalid media kind' });
    const cleanedText = normalizeMediaCaption(text);
    if (!cleanedText) return res.status(400).json({ error: 'Caption is required' });
    if (countWords(cleanedText) > 100) return res.status(400).json({ error: 'Caption must be 100 words or fewer' });
    const mediaField = getMediaFieldName(kind);
    const mediaIndex = Number.parseInt(index, 10);
    if (!Number.isInteger(mediaIndex) || mediaIndex < 0) return res.status(400).json({ error: 'Invalid media index' });
    try {
        const profile = await Profile.findOne({ username });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        if (mediaIndex >= profile[mediaField].length) return res.status(404).json({ error: 'Media item not found' });
        
        const currentItem = profile[mediaField][mediaIndex] || {};
        let imageUrl = currentItem.image || '';
        if (req.file) {
            const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
            if (!allowedMimeTypes.has(req.file.mimetype)) return res.status(400).json({ error: 'Only PNG, JPEG, GIF, or WEBP allowed' });
            imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }
        if (!imageUrl) return res.status(400).json({ error: 'Image is required' });
        
        profile[mediaField][mediaIndex].image = imageUrl;
        profile[mediaField][mediaIndex].text = cleanedText;
        profile.markModified(mediaField);
        await profile.save();
        
        res.json({ message: `${getMediaLabel(kind)} updated`, [mediaField]: normalizeMediaItems(profile[mediaField]) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/profile/media/:username/:index', async (req, res) => {
    const { username, index } = req.params;
    const kind = req.body?.kind || req.query?.kind || 'trophy';
    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (!['trophy', 'achievement'].includes(kind)) return res.status(400).json({ error: 'Invalid media kind' });
    const mediaField = getMediaFieldName(kind);
    const mediaIndex = Number.parseInt(index, 10);
    if (!Number.isInteger(mediaIndex) || mediaIndex < 0) return res.status(400).json({ error: 'Invalid media index' });
    try {
        const profile = await Profile.findOne({ username });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        if (mediaIndex >= profile[mediaField].length) return res.status(404).json({ error: 'Media item not found' });
        
        profile[mediaField].splice(mediaIndex, 1);
        profile.markModified(mediaField);
        await profile.save();
        
        res.json({ message: `${getMediaLabel(kind)} deleted`, [mediaField]: normalizeMediaItems(profile[mediaField]) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/profile/media/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const profile = await Profile.findOne({ username }).lean();
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json({
            username: profile.username,
            trophies: normalizeMediaItems(profile.trophies),
            achievements: normalizeMediaItems(profile.achievements)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/profile/upload-avatar', upload.single('avatar'), async (req, res) => {
    const { username } = req.body;
    if (!req.file || !username) return res.status(400).json({ error: 'Missing file or username' });
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    try {
        await Profile.findOneAndUpdate({ username }, { avatar: avatarUrl });
        res.json({ message: 'Avatar uploaded successfully', avatarUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ฟังก์ชันจัดช่วงแรงค์ประเมินรวม (7 ช่วงคะแนนสูงสุด 1000)
function getMobaRankLabel(score) {
    if (score <= 150) return "Iron Vanguard";
    if (score <= 300) return "Bronze Striker";
    if (score <= 450) return "Silver Tactician";
    if (score <= 600) return "Gold Challenger";
    if (score <= 750) return "Platinum Elite";
    if (score <= 900) return "Diamond Master";
    return "Mythic Immortal";
}

// ช่วยบังคับค่าให้อยู่ในช่วง min และ max (Clamp Function)
// const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

app.post('/api/profile/sync-matches', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    try {
        const profile = await Profile.findOne({ username });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const { lolId, dotaId } = profile;

        // ตัวแปรเก็บสถิติดิบแยกแต่ละเกม
        let dotaStats = { matches: 0, rankSkill: 0, winEff: 0, combat: 0, economy: 0 };
        let lolStats = { matches: 0, rankSkill: 0, winEff: 0, combat: 0, economy: 0 };
        let combinedActivity = {}; // สำหรับรวบรวมทำปฏิทินสะสมแมตช์

        // ==================== [ STEP 1: DOTA 2 FETCH & CALCULATE ] ====================
        if (dotaId && dotaId.trim() !== "" && dotaId !== "-") {
            try {
                // 1. ดึงข้อมูลผู้เล่นหลัก (ข้อมูลแรังค์)
                const playerData = await fetchJsonWithRetry(`https://api.opendota.com/api/players/${dotaId}`, {}, 12000, 3);
                const rankTier = playerData?.rank_tier || 10; // e.g., 11 - 85
                dotaStats.rankSkill = (rankTier / 85) * 100; // ทำให้อยู่ในสเกล 0-100 เพื่อนำไปคำนวณต่อ

                // 2. ดึงสถิติแพ้ชนะ
                const wlData = await fetchJsonWithRetry(`https://api.opendota.com/api/players/${dotaId}/wl`, {}, 12000, 3);
                const wins = wlData?.win || 0;
                const losses = wlData?.lose || 0;
                const totalDotaMatches = wins + losses;
                dotaStats.matches = totalDotaMatches;

                if (totalDotaMatches > 0) {
                    // คำนวณหมวด Win Efficiency ตามสูตรเป๊ะๆ
                    const winRate = (wins / totalDotaMatches) * 100;
                    const confidence = 100 * Math.min(1, Math.sqrt(totalDotaMatches) / 100);
                    const W = clamp(50 + 4 * (winRate - 50), 0, 100);
                    dotaStats.winEff = (0.7 * W) + (0.3 * confidence);
                }

                // 3. ดึงแมตช์ล่าสุด 20 แมตช์เพื่อหาค่า Combat และ Economy เฉลี่ย (ป้องกันการวน Loop ยิง 100 ครั้งจนติด Rate Limit)
                const recentMatches = await fetchJsonWithRetry(`https://api.opendota.com/api/players/${dotaId}/recentMatches`, {}, 12000, 3) || [];

                let totalKDA = 0, totalLH = 0, totalGPM = 0, totalXPM = 0;
                recentMatches.forEach(m => {
                    // คำนวณ Combat & Economy รายแมตช์
                    const k = m.kills || 0;
                    const d = m.deaths || 0;
                    const a = m.assists || 0;
                    totalKDA += (k + a) / Math.max(1, d);
                    totalLH += m.last_hits || 0;
                    totalGPM += m.gold_per_min || 0;
                    totalXPM += m.xp_per_min || 0;

                    // ป้อนข้อมูลวันลงปฏิทินสะสมแมตช์ (Dota 2 ใช้หน่วย timestamp เป็นวินาที)
                    if (m.start_time) {
                        const dateStr = new Date(m.start_time * 1000).toISOString().split('T')[0];
                        combinedActivity[dateStr] = (combinedActivity[dateStr] || 0) + 1;
                    }
                });

                if (recentMatches.length > 0) {
                    const avgKDA = totalKDA / recentMatches.length;
                    const avgGPM = totalGPM / recentMatches.length;
                    const avgXPM = totalXPM / recentMatches.length;

                    // ทำการ Normalize เป็นค่า Percentile สมมติ (ช่วงคะแนน 0-100)
                    dotaStats.combat = clamp(avgKDA * 20, 0, 100);
                    dotaStats.economy = clamp(((avgGPM + avgXPM) / 1200) * 100, 0, 100);
                }
            } catch (err) {
                console.error("Dota API Error:", err.message);
            }
        }

        // ==================== [ STEP 2: LOL FETCH & CALCULATE ] ====================
        if (lolId && lolId.trim() !== "" && lolId !== "-" && lolId.includes("#")) {
            try {
                const gameStats = await GameStats.findOne({ username, game: 'lol' });
                if (gameStats) {
                    const rankTier = gameStats.rankingLabel ? gameStats.rankingLabel.split(' ')[0] : 'UNRANKED';
                    const lp = gameStats.score % 100;

                    const tierMap = { "IRON": 10, "BRONZE": 25, "SILVER": 40, "GOLD": 55, "PLATINUM": 70, "EMERALD": 80, "DIAMOND": 90, "MASTER": 95, "GRANDMASTER": 98, "CHALLENGER": 100 };
                    lolStats.rankSkill = tierMap[rankTier.toUpperCase()] || 20;

                    lolStats.matches = gameStats.matches ? gameStats.matches.length : 0;

                    let totalKDA = 0, totalCSPM = 0;
                    let matchCount = 0;
                    let winCount = 0;

                    if (gameStats.matches && gameStats.matches.length > 0) {
                        for (const m of gameStats.matches) {
                            const mId = m.match_uid;
                            const mDetail = gameStats.matchDetails ? gameStats.matchDetails.get(mId) : null;
                            if (mDetail) {
                                totalKDA += parseFloat(mDetail.kda) || 0;
                                const durationMin = (mDetail.duration || 1200) / 60;
                                totalCSPM += (mDetail.creep_score || 0) / durationMin;
                                if (mDetail.win) winCount++;
                                matchCount++;

                                if (mDetail.start_time) {
                                    const dateStr = new Date(mDetail.start_time).toISOString().split('T')[0];
                                    combinedActivity[dateStr] = (combinedActivity[dateStr] || 0) + 1;
                                }
                            }
                        }
                    }

                    if (matchCount > 0) {
                        lolStats.combat = clamp((totalKDA / matchCount) * 20, 0, 100);
                        lolStats.economy = clamp((totalCSPM / matchCount) * 12, 0, 100);
                        
                        const winRate = (winCount / matchCount) * 100;
                        const confidence = 100 * Math.min(1, Math.sqrt(matchCount) / 100);
                        const W = clamp(50 + 4 * (winRate - 50), 0, 100);
                        lolStats.winEff = (0.7 * W) + (0.3 * confidence);
                    }
                }
            } catch (err) {
                console.error("LoL Stats Sync Error:", err.message);
            }
        }

        // ==================== [ STEP 3: WEIGHTED AVERAGE COMBINATION ] ====================
        // คำนวณค่าน้ำหนัก w_d และ w_l ตามสัดส่วนจำนวนเกมที่ระบุในสูตร
        const w_d = Math.min(1, dotaStats.matches / 100);
        const w_l = Math.min(1, lolStats.matches / 100);
        const totalWeight = w_d + w_l;

        // ค่า Default เผื่อกรณีผู้เล่นยังไม่มีแมตช์ประวัติการเล่นเลย
        let finalRankSkill = 30, finalWinEff = 50, finalCombat = 50, finalEconomy = 50;

        if (totalWeight > 0) {
            finalRankSkill = ((w_d * dotaStats.rankSkill) + (w_l * lolStats.rankSkill)) / totalWeight;
            finalWinEff = ((w_d * dotaStats.winEff) + (w_l * lolStats.winEff)) / totalWeight;
            finalCombat = ((w_d * dotaStats.combat) + (w_l * lolStats.combat)) / totalWeight;
            finalEconomy = ((w_d * dotaStats.economy) + (w_l * lolStats.economy)) / totalWeight;
        }

        // แปลงผลรวมทุกหมวดสถิติให้ออกมาเต็มก้อนคะแนนสูงสุด 1000 แต้มตามสเปกแดชบอร์ด
        // แต่ละหมวดเต็ม 100 พอคูณ 0.25 และบวกกัน 4 หมวดจะเต็ม 100 พอดี -> คูณ 10 เพื่อให้คะแนนเต็ม 1000 แต้ม
        const totalMobaScore = Math.round((0.25 * finalRankSkill + 0.25 * finalWinEff + 0.25 * finalCombat + 0.25 * finalEconomy) * 10);

        // ==================== [ STEP 4: WRITE TO MONGODB BASE ] ====================
        profile.mobaScore = totalMobaScore;
        profile.rankTierLabel = getMobaRankLabel(totalMobaScore);
        profile.rankSkill = Math.round(finalRankSkill * 10); // แปลงเต็ม 1000
        profile.winEfficiency = Math.round(finalWinEff * 10); // แปลงเต็ม 1000
        profile.combatPerformance = Math.round(finalCombat * 10); // แปลงเต็ม 1000
        profile.economySkill = Math.round(finalEconomy * 10); // แปลงเต็ม 1000
        profile.activityData = combinedActivity; // บันทึกลงตารางแมตช์จริงลงดาต้าเบส


        console.log("Dota Stats:", dotaStats);
        console.log("LoL Stats:", lolStats);
        console.log("Combined Activity:", combinedActivity);
        await profile.save();

        res.json({
            message: 'Matches and real MOBA statistics synchronized successfully',
            activityData: combinedActivity,
            mobaScore: totalMobaScore,
            rankTierLabel: profile.rankTierLabel
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Proxy endpoint for Riot API
// Request from frontend: /api/riot/asia.api.riotgames.com/riot/account/v1/...
app.get('/api/riot/:server/*', async (req, res) => {
    try {
        const server = req.params.server; // e.g. "asia.api.riotgames.com"
        const pathParam = req.params[0];       // e.g. "riot/account/v1/..."

        const targetUrl = `https://${server}/${pathParam}`;

        const response = await axios.get(targetUrl, {
            headers: {
                "X-Riot-Token": RIOT_API_KEY
            },
            params: req.query // pass any query params
        });

        res.json(response.data);
    } catch (error) {
        console.error("Riot API Proxy Error:", error.response?.status, error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
});

// Proxy endpoint for OpenDota
app.get('/api/dota2/*', async (req, res) => {
    try {
        const pathParam = req.params[0];
        const targetUrl = `https://api.opendota.com/api/${pathParam}`;

        const response = await axios.get(targetUrl, { params: req.query });
        res.json(response.data);
    } catch (error) {
        console.error("Dota2 API Proxy Error:", error.response?.status, error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
});

// --- Post API endpoints (branch punch) ย้ายจาก memoryUpload มาเป็นดิสก์ปกติ ---

app.post('/api/posts', upload.array('files', 10), async (req, res) => {
    try {
        const newPost = new Post({
            userId: req.body.userId,
            caption: req.body.caption,
            // แปลงเส้นทางตําแหน่งไฟล์บนดิสก์ให้กลายเป็นบัฟเฟอร์ เพื่อรักษาโครงสร้างโมเดลเดิมไว้โดยไม่แครช
            mediaData: (req.files || []).map(file => ({
                data: Buffer.from(`/uploads/${file.filename}`),
                contentType: file.mimetype
            }))
        });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. ดึงโพสต์ (ส่ง URL สำหรับเรียกรูปจาก Database) 
// ค้นหา API  ส่งอาร์เรย์ตรวจสอบประเภทไฟล์กลับไปด้วย
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        const profiles = await Profile.find({}, 'username avatar');
        const avatarMap = new Map(profiles.map(p => [p.username, p.avatar || '']));

        const postsWithImageUrls = posts.map(post => {
            const postObj = post.toObject();
            postObj.avatar = avatarMap.get(post.userId) || '';

            if (Array.isArray(postObj.comments)) {
                postObj.comments = postObj.comments.map(comment => ({
                    ...comment,
                    avatar: avatarMap.get(comment.userId) || ''
                }));
            }

            postObj.mediaPaths = Array.isArray(post.mediaData) ? post.mediaData.map((_, index) =>
                `/api/posts/${post._id}/image/${index}`
            ) : [];
            postObj.mediaTypes = Array.isArray(post.mediaData) ? post.mediaData.map(m => m.contentType || 'image/jpeg') : [];
            
            return postObj;
        });
        res.json(postsWithImageUrls);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== [แก้ไข] GET IMAGE ENDPOINT: รองรับการดึงไฟล์จากดิสก์ ====================
app.get('/api/posts/:postId/image/:index', async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).send("Post not found");
        const mediaData = Array.isArray(post.mediaData) ? post.mediaData : [];
        const image = mediaData[req.params.index];
        if (!image) return res.status(404).send("Image not found");

        // ตรวจสอบว่าบัฟเฟอร์นี้เก็บข้อมูล String เส้นทางไฟล์ดิสก์ไว้หรือไม่
        const dataStr = image.data.toString();
        if (dataStr.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, dataStr);
            if (fs.existsSync(filePath)) {
                res.contentType(image.contentType);
                return res.sendFile(filePath);
            }
        }

        // Fallback รองรับข้อมูลแบบไบนารีบัฟเฟอร์ดั้งเดิมในฐานข้อมูล
        res.contentType(image.contentType);
        res.send(image.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== [แก้ไข] GET LIKED POSTS ENDPOINT: ส่งประเภทไฟล์กลับด้วย ====================
app.get('/api/posts/liked/:userId', async (req, res) => {
    try {
        const favorites = await Favorite.find({ userId: req.params.userId }).populate('postId');
        const profiles = await Profile.find({}, 'username avatar');
        const avatarMap = new Map(profiles.map(p => [p.username, p.avatar || '']));

        const posts = favorites.map(fav => {
            const post = fav.postId;
            if (!post) return null;

            const postObj = post.toObject();
            postObj.avatar = avatarMap.get(post.userId) || '';

            if (Array.isArray(postObj.comments)) {
                postObj.comments = postObj.comments.map(comment => ({
                    ...comment,
                    avatar: avatarMap.get(comment.userId) || ''
                }));
            }

            postObj.mediaPaths = Array.isArray(post.mediaData) ? post.mediaData.map((_, index) =>
                `/api/posts/${post._id}/image/${index}`
            ) : [];
            postObj.mediaTypes = Array.isArray(post.mediaData) ? post.mediaData.map(m => m.contentType || 'image/jpeg') : [];
            return postObj;
        }).filter(post => post !== null);

        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. LIKE & FAVORITE
app.put('/api/posts/:id/like', async (req, res) => {
    try {
        const { userId } = req.body;
        const postId = req.params.id;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const likeIndex = post.likes.findIndex(l => l.userId === userId);
        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1);
            await Favorite.deleteOne({ userId, postId });
        } else {
            post.likes.push({ userId, likedAt: new Date() });
            const exists = await Favorite.findOne({ userId, postId });
            if (!exists) await new Favorite({ userId, postId }).save();
        }
        await post.save();
        res.json({ likes: post.likes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. COMMENTS
app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const { userId, text } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        post.comments.push({ userId, text });
        await post.save();

        const profiles = await Profile.find({}, 'username avatar');
        const avatarMap = new Map(profiles.map(p => [p.username, p.avatar || '']));

        const commentsWithAvatars = post.comments.map(c => {
            const cObj = c.toObject();
            cObj.avatar = avatarMap.get(c.userId) || '';
            return cObj;
        });

        res.status(201).json(commentsWithAvatars);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. LIKE A COMMENT
app.put('/api/posts/:postId/comments/:commentId/like', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { userId } = req.body;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: "Comment not found" });

        if (!comment.likes) comment.likes = [];
        const likeIndex = comment.likes.indexOf(userId);

        if (likeIndex > -1) {
            comment.likes.splice(likeIndex, 1);
        } else {
            comment.likes.push(userId);
        }

        await post.save();
        res.json({ likes: comment.likes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. GET LIKED POSTS FOR USER
app.get('/api/posts/liked/:userId', async (req, res) => {
    try {
        const favorites = await Favorite.find({ userId: req.params.userId }).populate('postId');
        const profiles = await Profile.find({}, 'username avatar');
        const avatarMap = new Map(profiles.map(p => [p.username, p.avatar || '']));

        const posts = favorites.map(fav => {
            const post = fav.postId;
            if (!post) return null;

            const postObj = post.toObject();
            postObj.avatar = avatarMap.get(post.userId) || '';

            if (Array.isArray(postObj.comments)) {
                postObj.comments = postObj.comments.map(comment => ({
                    ...comment,
                    avatar: avatarMap.get(comment.userId) || ''
                }));
            }

            postObj.mediaPaths = Array.isArray(post.mediaData) ? post.mediaData.map((_, index) =>
                `/api/posts/${post._id}/image/${index}`
            ) : [];
            postObj.mediaTypes = Array.isArray(post.mediaData) ? post.mediaData.map(m => m.contentType || 'image/jpeg') : [];
            return postObj;
        }).filter(post => post !== null);

        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. REPORT POST (SUSPEND IF REPORTS >= 3)
app.post('/api/posts/:postId/report', async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (!post.reports) post.reports = [];
        const exists = post.reports.some(r => r.userId === userId);
        if (!exists) {
            post.reports.push({ userId, timestamp: new Date() });
            if (post.reports.length >= 3) {
                post.suspended = true;
            }
            await post.save();
        }
        res.json({ reports: post.reports, suspended: post.suspended });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




// ==================== START SERVER ====================

const { exec } = require('child_process');

function openBrowser(url) {
    const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
    exec(`${startCmd} "${url}"`, (err) => {
        if (err) {
            console.warn("Could not automatically open browser:", err.message);
        }
    });
}

async function startServer() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('DB Connected');
    await cleanupLegacyIndexes();
    await keepOnlyUserAndProfileCollections();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Frontend UI: http://localhost:${PORT}/HTML/index.html`);
        console.log(`API Docs: http://localhost:${PORT}/api-docs`);

        // Automatically open the UI
        setTimeout(() => {
            openBrowser(`http://localhost:${PORT}/HTML/index.html`);
        }, 1000);
    });
}

// Export the app for Vercel Serverless Functions
module.exports = app;

if (!process.env.VERCEL) {
    startServer().catch((err) => {
        console.error('Server failed to start:', err);
        process.exit(1);
    });
} else {
    // In Vercel, connect to DB immediately when module is loaded
    mongoose.connect(process.env.MONGO_URI)
        .then(async () => {
            console.log('Serverless DB Connected');
            try {
                await cleanupLegacyIndexes();
                await keepOnlyUserAndProfileCollections();
            } catch (err) {
                console.warn('Post-connection cleanup failed:', err.message);
            }
        })
        .catch((err) => {
            console.error('Serverless DB connection failed:', err);
        });
}