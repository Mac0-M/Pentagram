const express = require('express');
const router = express.Router();
const GameStats = require('../models/GameStats');
const Profile = require('../models/Profile');

const RIOT_API_KEY = (process.env.RIOT_API_KEY || '').trim();
const RIOT_REGION = (process.env.RIOT_REGION || 'sea').trim();
const OPEN_DOTA_BASE_URL = process.env.OPEN_DOTA_BASE_URL || 'https://api.opendota.com/api';

// Helper: HTTP Fetch with Timeout
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

// Helper: Fetch with Timeout & Auto-Retry
async function fetchJsonWithRetry(url, options = {}, timeoutMs = 8000, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fetchJson(url, options, timeoutMs);
        } catch (err) {
            lastError = err;
            console.warn(`[RETRY] Fetch failed for ${url} (Attempt ${attempt}/${maxRetries}): ${err.message}`);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    }
    throw lastError || new Error(`Request failed after ${maxRetries} attempts`);
}

let cachedLatestDDragonVersion = '14.10.1'; // Fallback
let lastDDragonVersionFetchTime = 0;

async function getLatestDDragonVersion() {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - lastDDragonVersionFetchTime < ONE_DAY && cachedLatestDDragonVersion !== '14.10.1') {
        return cachedLatestDDragonVersion;
    }
    try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        if (response.ok) {
            const versions = await response.json();
            if (Array.isArray(versions) && versions.length > 0) {
                cachedLatestDDragonVersion = versions[0];
                lastDDragonVersionFetchTime = Date.now();
                console.log(`[DDRAGON-VERSION] Dynamically resolved latest LoL version: ${cachedLatestDDragonVersion}`);
            }
        }
    } catch (err) {
        console.warn("[DDRAGON-VERSION] Failed to fetch latest LoL version, falling back to cached/default:", err.message);
    }
    return cachedLatestDDragonVersion;
}

// Helper: Sync Profile Moba score and ranking
async function syncProfileScoreAndRank(username) {
    // 💡 ปล่อยว่างไว้: คะแนน mobaScore และ rankTierLabel ของ Profile จะถูกคำนวณแบบเฉลี่ยถ่วงน้ำหนัก
    // ผ่าน Endpoint /api/profile/sync-matches เท่านั้น เพื่อไม่ให้มีสูตรคำนวณซ้ำซ้อนแยกกันในระบบ
}

// 9. LEADERBOARD FRIEND SCORES (FROM MongoDB GameStats & Profiles)
router.get('/get-friend-scores', async (req, res) => {
    try {
        const profiles = await Profile.find({});
        const friendScores = [];

        for (const profile of profiles) {
            if (!profile.verified) {
                continue;
            }

            const score = profile.mobaScore !== null && profile.mobaScore !== undefined ? profile.mobaScore : 300;
            const ranking = profile.rankTierLabel || 'Iron Vanguard';
            const avatar = profile.avatar || '';

            friendScores.push({
                username: profile.username,
                score: score,
                ranking: ranking,
                avatar: avatar
            });
        }

        friendScores.sort((a, b) => b.score - a.score);
        res.json(friendScores);
    } catch (error) {
        console.error("Leaderboard error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 10. GAME STATS ENDPOINTS (Dota 2 and LoL MongoDB Persisted Caches)

router.get('/game-stats/dota2/:accountId', async (req, res) => {
    const { accountId } = req.params;
    const username = req.query.username || 'TestPlayer';
    const isSilent = req.query.isSilent === 'true';

    try {
        let existingStats = await GameStats.findOne({ username, game: 'dota2' });

        if (isSilent && existingStats && existingStats.latestMatchId) {
            try {
                const checkMatches = await fetchJsonWithRetry(`${OPEN_DOTA_BASE_URL}/players/${encodeURIComponent(accountId)}/matches?lobby_type=7&limit=1`, {}, 12000, 3);
                if (checkMatches && checkMatches.length > 0 && existingStats.latestMatchId === String(checkMatches[0].match_id)) {
                    console.log("[DOTA2-DB-SYNC] No new matches detected. Skipping background update.");
                    return res.json({ hasUpdates: false });
                }
            } catch (err) {
                console.warn("[DOTA2-DB-SYNC] Silent check matches failed:", err.message);
            }
        }

        console.log(`[DOTA2-DB-SYNC] Fetching fresh data from OpenDota for ${username}...`);

        const [playerData, matches] = await Promise.all([
            fetchJsonWithRetry(`${OPEN_DOTA_BASE_URL}/players/${accountId}`, {}, 12000, 3),
            fetchJsonWithRetry(`${OPEN_DOTA_BASE_URL}/players/${accountId}/matches?lobby_type=7&limit=10`, {}, 12000, 3)
        ]);

        const heroesConstants = await fetchJsonWithRetry(`${OPEN_DOTA_BASE_URL}/constants/heroes`, {}, 12000, 3);

        const heroStats = {};
        matches.forEach(match => {
            const heroId = match.hero_id;
            const isWin = match.radiant_win === (match.player_slot < 128);
            if (!heroStats[heroId]) {
                heroStats[heroId] = {
                    hero_key: heroId,
                    games: 0,
                    win: 0,
                    lose: 0,
                    kills: 0,
                    deaths: 0,
                    assists: 0
                };
            }
            const hs = heroStats[heroId];
            hs.games += 1;
            if (isWin) hs.win += 1;
            else hs.lose += 1;
            hs.kills += match.kills || 0;
            hs.deaths += match.deaths || 0;
            hs.assists += match.assists || 0;
        });

        const topHeroes = Object.values(heroStats)
            .map(hs => {
                const heroInfo = heroesConstants[hs.hero_key] || {};
                const shortName = heroInfo.name ? heroInfo.name.replace('npc_dota_hero_', '') : '';
                const kda = hs.games > 0 ? ((hs.kills + hs.assists) / Math.max(hs.deaths, 1)).toFixed(2) : '0.00';
                const winrate = hs.games > 0 ? ((hs.win / hs.games) * 100).toFixed(2) : 0;

                return {
                    hero_key: hs.hero_key,
                    hero_name: heroInfo.localized_name || 'Unknown',
                    hero_icon: shortName ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${shortName}.png` : '',
                    games: hs.games,
                    win: hs.win,
                    lose: hs.lose,
                    winrate: winrate,
                    kda: kda,
                    kills: hs.kills,
                    deaths: hs.deaths,
                    assists: hs.assists
                };
            })
            .sort((a, b) => b.games - a.games)
            .slice(0, 4);

        const processedMatches = matches.map(match => {
            const heroInfo = heroesConstants[match.hero_id] || {};
            const shortName = heroInfo.name ? heroInfo.name.replace('npc_dota_hero_', '') : '';
            return {
                match_id: match.match_id,
                game_mode: match.game_mode,
                game_mode_text: match.game_mode === 23 ? "Turbo" : (match.game_mode === 22 ? "All Draft" : "Ranked"),
                duration: match.duration,
                start_time: match.start_time,
                win: match.radiant_win === (match.player_slot < 128),
                hero_id: match.hero_id,
                hero_icon: shortName ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${shortName}.png` : '',
                player_slot: match.player_slot,
                kills: match.kills,
                deaths: match.deaths,
                assists: match.assists,
                kda: ((match.kills + match.assists) / Math.max(match.deaths, 1)).toFixed(2)
            };
        });

        let badge = 0;
        let stars = 0;
        if (playerData?.rank_tier) {
            badge = Math.floor(playerData.rank_tier / 10);
            stars = playerData.rank_tier % 10;
        }
        const rankNames = ["", "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"];
        const rankingLabel = badge >= 8 ? "Immortal" : badge >= 1 ? `${rankNames[badge]} ${stars}` : "Unranked";

        let score = playerData?.mmr_estimate?.estimate || 300;
        if (badge >= 1 && badge <= 7) {
            score = (badge - 1) * 770 + (stars * 154);
        } else if (badge === 8) {
            score = 5620;
        }

        const latestMatchId = processedMatches.length > 0 ? String(processedMatches[0].match_id) : '';

        if (!existingStats) {
            existingStats = new GameStats({
                username, game: 'dota2', gameId: accountId
            });
        }

        existingStats.playerData = {
            player_name: playerData?.profile?.personaname || 'Unknown Player',
            player_uid: accountId,
            rank_tier: playerData?.rank_tier || null,
            rank_point: score
        };
        existingStats.topHeroes = topHeroes;
        existingStats.matches = processedMatches;
        existingStats.latestMatchId = latestMatchId;
        existingStats.score = score;
        existingStats.rankingLabel = rankingLabel;

        await existingStats.save();
        await syncProfileScoreAndRank(username);

        res.json({
            hasUpdates: true,
            playerData: existingStats.playerData,
            topHeroes: existingStats.topHeroes,
            matches: existingStats.matches
        });

    } catch (error) {
        console.error("[DOTA2-DB-SYNC] Error:", error.message);
        const cachedStats = await GameStats.findOne({ username, game: 'dota2' });
        if (cachedStats) {
            console.log("[DOTA2-DB-SYNC] Fallback to cached DB stats.");
            return res.json({
                hasUpdates: true,
                playerData: cachedStats.playerData,
                topHeroes: cachedStats.topHeroes,
                matches: cachedStats.matches,
                isCached: true,
                errorType: error.message.includes('429') ? 'RATE_LIMIT' : 'UPSTREAM_ERROR',
                errorMessage: error.message
            });
        }
        res.status(500).json({ 
            error: error.message, 
            errorType: error.message.includes('429') ? 'RATE_LIMIT' : 'UPSTREAM_ERROR' 
        });
    }
});

router.get('/game-stats/dota2/match/:matchId', async (req, res) => {
    const { matchId } = req.params;
    const accountId = req.query.accountId;
    const username = req.query.username || 'TestPlayer';

    try {
        let stats = await GameStats.findOne({ username, game: 'dota2' });
        if (stats && stats.matchDetails && stats.matchDetails.has(matchId)) {
            console.log(`[DOTA2-MATCH-DB] Return cached match detail for ${matchId}`);
            return res.json(stats.matchDetails.get(matchId));
        }

        console.log(`[DOTA2-MATCH-DB] Fetching fresh match detail from OpenDota for ${matchId}...`);
        const data = await fetchJsonWithRetry(`${OPEN_DOTA_BASE_URL}/matches/${matchId}`, {}, 12000, 3);
        const player = data.players.find(p => p.account_id === parseInt(accountId) || p.account_id === accountId);
        if (!player) return res.status(404).json({ error: 'Player not found in match' });

        const itemsConstants = await fetchJsonWithRetry(`${OPEN_DOTA_BASE_URL}/constants/items`, {}, 12000, 3);
        const resolveItemImg = (itemId) => {
            if (!itemId) return { img: null, name: '' };
            const itemKey = Object.keys(itemsConstants).find(k => itemsConstants[k].id === itemId);
            if (itemKey) {
                const itemName = itemKey.replace('recipe_', '');
                return { img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemName}.png`, name: itemsConstants[itemKey].dname || itemKey };
            }
            return { img: null, name: '' };
        };

        const items = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5];
        const itemImages = items.map(id => resolveItemImg(id));
        const neutralItemImg = resolveItemImg(player.item_neutral);

        const heroesConstants = await fetchJsonWithRetry(`${OPEN_DOTA_BASE_URL}/constants/heroes`, {}, 12000, 3);
        const getHeroImg = (heroId) => {
            const heroInfo = heroesConstants[heroId] || {};
            const shortName = heroInfo.name ? heroInfo.name.replace('npc_dota_hero_', '') : '';
            return { img: shortName ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${shortName}.png` : '', name: heroInfo.localized_name || shortName };
        };

        const isRadiant = player.player_slot < 128;
        const allyTeam = data.players.filter(p => (p.player_slot < 128) === isRadiant).map(p => getHeroImg(p.hero_id));
        const enemyTeam = data.players.filter(p => (p.player_slot < 128) !== isRadiant).map(p => getHeroImg(p.hero_id));

        const matchDetail = {
            deaths: player.deaths,
            assists: player.assists,
            item_json: items,
            item_images: itemImages,
            neutral_item_image: neutralItemImg,
            ally_team: allyTeam,
            enemy_team: enemyTeam,
            teamfight_participation: player.teamfight_participation ? (player.teamfight_participation * 100).toFixed(2) : 0
        };

        if (stats) {
            stats.matchDetails.set(matchId, matchDetail);
            await stats.save();
        }

        res.json(matchDetail);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/game-stats/lol/:riotId', async (req, res) => {
    const { riotId } = req.params;
    const decodedRiotId = decodeURIComponent(riotId);
    const username = req.query.username || 'TestPlayer';
    const isSilent = req.query.isSilent === 'true';

    try {
        let existingStats = await GameStats.findOne({ username, game: 'lol' });

        const [gameName, tagLine] = decodedRiotId.split('#');
        if (!gameName || !tagLine) throw new Error("Invalid Riot ID format");

        const accountData = await fetchJsonWithRetry(
            `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
            { headers: { 'X-Riot-Token': RIOT_API_KEY } },
            12000, 3
        );
        const puuid = accountData.puuid;

        // Silent check: ตรวจสอบว่ามีแมตช์ใหม่หรือไม่
        if (isSilent && existingStats && existingStats.latestMatchId) {
            try {
                const checkMatchIds = await fetchJsonWithRetry(
                    `https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&start=0&count=1`,
                    { headers: { 'X-Riot-Token': RIOT_API_KEY } },
                    12000, 3
                );
                if (checkMatchIds && checkMatchIds.length > 0 && existingStats.latestMatchId === String(checkMatchIds[0])) {
                    console.log("[LOL-DB-SYNC] No new matches. Skipping silent update.");
                    return res.json({ hasUpdates: false });
                }
            } catch (err) {
                console.warn("[LOL-DB-SYNC] Silent check failed:", err.message);
            }
        }

        console.log(`[LOL-DB-SYNC] Fetching fresh data from Riot for ${username}...`);

        const latestVersion = await getLatestDDragonVersion();
        const ddragonBase = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}`;

        const summonerData = await fetchJsonWithRetry(`https://sg2.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers: { 'X-Riot-Token': RIOT_API_KEY } }, 12000, 3);
        const rankData = await fetchJsonWithRetry(`https://sg2.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`, { headers: { 'X-Riot-Token': RIOT_API_KEY } }, 12000, 3);

        // ดึง 10 แมตช์ล่าสุด (Ranked เท่านั้น)
        const matchIds = await fetchJsonWithRetry(`https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&start=0&count=10`, { headers: { 'X-Riot-Token': RIOT_API_KEY } }, 12000, 3) || [];

        const soloQueue = rankData.find(q => q.queueType === 'RANKED_SOLO_5x5') || rankData[0];

        const playerData = {
            player_name: accountData.gameName,
            tag_line: accountData.tagLine,
            player_uid: puuid,
            summoner_id: summonerData.id,
            profile_icon: `${ddragonBase}/img/profileicon/${summonerData.profileIconId}.png`,
            summoner_level: summonerData.summonerLevel
        };

        let rankTier = 'UNRANKED';
        let lp = 0;
        if (soloQueue) {
            rankTier = soloQueue.tier ? soloQueue.tier.toUpperCase() : 'UNRANKED';
            lp = soloQueue.leaguePoints || 0;
        }

        const tierWeights = {
            'CHALLENGER': 1000, 'GRANDMASTER': 950, 'MASTER': 880,
            'DIAMOND': 750, 'EMERALD': 630, 'PLATINUM': 500,
            'GOLD': 380, 'SILVER': 250, 'BRONZE': 120, 'IRON': 50
        };
        const score = (tierWeights[rankTier] || 150) + Math.min(99, lp);
        const rankingLabel = soloQueue ? `${soloQueue.tier} ${soloQueue.rank}` : 'Unranked';

        const latestMatchId = matchIds.length > 0 ? String(matchIds[0]) : '';

        if (!existingStats) {
            existingStats = new GameStats({
                username, game: 'lol', gameId: decodedRiotId, matchDetails: new Map()
            });
        }

        existingStats.playerData = playerData;
        existingStats.matches = matchIds.map(id => ({ match_uid: id }));
        existingStats.latestMatchId = latestMatchId;
        existingStats.score = score;
        existingStats.rankingLabel = rankingLabel;

        // ดึงรายละเอียดทั้ง 10 แมตช์ (ใช้ cache จาก DB ถ้ามีอยู่แล้ว)
        const fetchedMatchDetails = [];
        let hasNewMatches = false;
        for (const matchId of matchIds) {
            if (!existingStats.matchDetails || !existingStats.matchDetails.has(matchId)) {
                hasNewMatches = true;
                break;
            }
        }

        let spells = [];
        let runesData = [];
        if (hasNewMatches) {
            try {
                const [spellData, fetchedRunes] = await Promise.all([
                    fetchJsonWithRetry(`${ddragonBase}/data/en_US/summoner.json`, {}, 12000, 3).catch(() => ({ data: {} })),
                    fetchJsonWithRetry(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/runesReforged.json`, {}, 12000, 3).catch(() => [])
                ]);
                spells = Object.values(spellData.data || {});
                runesData = fetchedRunes || [];
            } catch (e) {
                console.warn("[LOL-DB-SYNC] Failed to fetch ddragon assets for summoners/runes:", e.message);
            }
        }

        for (const matchId of matchIds) {
            // ตรวจสอบ cache ใน DB ก่อน
            if (existingStats.matchDetails && existingStats.matchDetails.has(matchId)) {
                fetchedMatchDetails.push(existingStats.matchDetails.get(matchId));
                continue;
            }

            try {
                console.log(`[LOL-DB-SYNC] Fetching match detail: ${matchId}`);
                const matchData = await fetchJsonWithRetry(`https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`, { headers: { 'X-Riot-Token': RIOT_API_KEY } }, 12000, 3);

                const info = matchData.info;
                const participant = info.participants.find(p => p.puuid === puuid);
                if (participant) {
                    const team = info.teams.find(t => t.teamId === participant.teamId);
                    const teamTotalKills = team ? team.objectives.champion.kills : info.participants.filter(p => p.teamId === participant.teamId).reduce((sum, p) => sum + p.kills, 0);
                    const participantsRatio = teamTotalKills > 0 ? ((participant.kills + participant.assists) / teamTotalKills) * 100 : 0;

                    const items = [
                        participant.item0, participant.item1, participant.item2,
                        participant.item3, participant.item4, participant.item5, participant.item6
                    ];

                    const itemImages = items.map(id => {
                        if (!id || id === 0) return { img: null, name: '' };
                        return { img: `${ddragonBase}/img/item/${id}.png`, name: `Item ${id}` };
                    });

                    const allyTeam = info.participants.filter(p => p.teamId === participant.teamId).map(p => ({
                        img: `${ddragonBase}/img/champion/${p.championName}.png`, name: p.championName
                    }));
                    const enemyTeam = info.participants.filter(p => p.teamId !== participant.teamId).map(p => ({
                        img: `${ddragonBase}/img/champion/${p.championName}.png`, name: p.championName
                    }));

                    const spell1Info = spells.find(s => parseInt(s.key) === participant.summoner1Id);
                    const spell2Info = spells.find(s => parseInt(s.key) === participant.summoner2Id);

                    let keystoneIcon = null;
                    let secondaryPathIcon = null;
                    try {
                        const styles = participant.perks?.styles || [];
                        const primaryStyle = styles.find(s => s.description === 'primaryStyle') || styles[0];
                        const subStyle = styles.find(s => s.description === 'subStyle') || styles[1];

                        if (primaryStyle) {
                            const keystoneId = primaryStyle.selections?.[0]?.perk;
                            const primaryTree = runesData.find(t => t.id === primaryStyle.style);
                            if (primaryTree) {
                                for (const slot of primaryTree.slots) {
                                    const found = slot.runes?.find(r => r.id === keystoneId);
                                    if (found) { keystoneIcon = `https://ddragon.leagueoflegends.com/cdn/img/${found.icon}`; break; }
                                }
                            }
                        }

                        if (subStyle) {
                            const secondaryTree = runesData.find(t => t.id === subStyle.style);
                            if (secondaryTree) {
                                secondaryPathIcon = `https://ddragon.leagueoflegends.com/cdn/img/${secondaryTree.icon}`;
                            }
                        }
                    } catch (e) { }

                    const matchDetail = {
                        match_id: matchId,
                        game_mode: info.gameMode,
                        duration: info.gameDuration,
                        start_time: info.gameStartTimestamp,
                        win: participant.win,
                        hero_id: participant.championId,
                        hero_name: participant.championName,
                        hero_icon: `${ddragonBase}/img/champion/${participant.championName}.png`,
                        team: participant.teamId,
                        kills: participant.kills,
                        deaths: participant.deaths,
                        assists: participant.assists,
                        kda: ((participant.kills + participant.assists) / Math.max(participant.deaths, 1)).toFixed(2),
                        item_json: items,
                        item_images: itemImages,
                        participants_ratio: participantsRatio.toFixed(2),
                        spell1_id: participant.summoner1Id,
                        spell1_icon: spell1Info ? { img: `${ddragonBase}/img/spell/${spell1Info.image.full}`, name: spell1Info.name } : { img: null, name: '' },
                        spell2_id: participant.summoner2Id,
                        spell2_icon: spell2Info ? { img: `${ddragonBase}/img/spell/${spell2Info.image.full}`, name: spell2Info.name } : { img: null, name: '' },
                        keystone_icon: keystoneIcon ? { img: keystoneIcon, name: 'Keystone Rune' } : null,
                        secondary_path_icon: secondaryPathIcon ? { img: secondaryPathIcon, name: 'Secondary Path' } : null,
                        ally_team: allyTeam,
                        enemy_team: enemyTeam,
                        gold_earned: participant.goldEarned,
                        total_damage: participant.totalDamageDealtToChampions,
                        creep_score: participant.totalMinionsKilled + participant.neutralMinionsKilled
                    };

                    existingStats.matchDetails.set(matchId, matchDetail);
                    fetchedMatchDetails.push(matchDetail);
                }
            } catch (err) {
                console.warn(`[LOL-DB-SYNC] Failed to fetch match ${matchId}:`, err.message);
            }
        }

        // คำนวณ Top Champions จาก 10 แมตช์ที่ดึงมา (เหมือน Dota 2)
        const heroStats = {};
        for (const matchDetail of fetchedMatchDetails) {
            const heroName = matchDetail.hero_name;
            if (!heroStats[heroName]) {
                heroStats[heroName] = {
                    hero_key: matchDetail.hero_id,
                    hero_name: matchDetail.hero_name,
                    hero_icon: matchDetail.hero_icon,
                    games: 0,
                    win: 0,
                    lose: 0,
                    kills: 0,
                    deaths: 0,
                    assists: 0
                };
            }
            const hs = heroStats[heroName];
            hs.games += 1;
            if (matchDetail.win) hs.win += 1;
            else hs.lose += 1;
            hs.kills += matchDetail.kills || 0;
            hs.deaths += matchDetail.deaths || 0;
            hs.assists += matchDetail.assists || 0;
        }

        const computedTopHeroes = Object.values(heroStats)
            .map(hs => {
                const kda = ((hs.kills + hs.assists) / Math.max(hs.deaths, 1)).toFixed(2);
                const winrate = ((hs.win / hs.games) * 100).toFixed(2);
                return {
                    hero_key: hs.hero_key,
                    hero_name: hs.hero_name,
                    hero_icon: hs.hero_icon,
                    games: hs.games,
                    win: hs.win,
                    lose: hs.lose,
                    winrate: winrate,
                    kda: kda,
                    kills: hs.kills,
                    deaths: hs.deaths,
                    assists: hs.assists
                };
            })
            .sort((a, b) => b.games - a.games)
            .slice(0, 4);

        existingStats.topHeroes = computedTopHeroes;

        await existingStats.save();
        await syncProfileScoreAndRank(username);

        res.json({
            hasUpdates: true,
            playerData: existingStats.playerData,
            rankData: soloQueue ? {
                rank_tier: soloQueue.tier,
                rank_division: soloQueue.rank,
                rank_point: soloQueue.leaguePoints,
                max_lp: ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(rankTier) ? Math.max(3000, soloQueue.leaguePoints) : 100
            } : null,
            matchIds: existingStats.matches.slice(0, 10),
            topHeroes: existingStats.topHeroes
        });

    } catch (error) {
        console.error("[LOL-DB-SYNC] Error:", error.message);
        const cachedStats = await GameStats.findOne({ username, game: 'lol' });
        if (cachedStats) {
            console.log("[LOL-DB-SYNC] Fallback to cached stats.");
            return res.json({
                hasUpdates: true,
                playerData: cachedStats.playerData,
                rankData: {
                    rank_tier: cachedStats.rankingLabel.split(' ')[0] || 'UNRANKED',
                    rank_division: cachedStats.rankingLabel.split(' ')[1] || '',
                    rank_point: cachedStats.score % 100,
                    max_lp: 100
                },
                matchIds: cachedStats.matches.slice(0, 10),
                topHeroes: cachedStats.topHeroes
            });
        }
        res.status(500).json({ error: error.message });
    }
});

router.get('/game-stats/lol/match/:matchId', async (req, res) => {
    const { matchId } = req.params;
    const puuid = req.query.puuid;
    const username = req.query.username || 'TestPlayer';

    try {
        let stats = await GameStats.findOne({ username, game: 'lol' });
        if (stats && stats.matchDetails && stats.matchDetails.has(matchId)) {
            console.log(`[LOL-MATCH-DB] Return cached match detail for ${matchId}`);
            return res.json(stats.matchDetails.get(matchId));
        }

        console.log(`[LOL-MATCH-DB] Fetching fresh match detail from Riot for ${matchId}...`);
        const data = await fetchJsonWithRetry(`https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`, { headers: { 'X-Riot-Token': RIOT_API_KEY } }, 12000, 3);
        const info = data.info;
        const participant = info.participants.find(p => p.puuid === puuid);
        if (!participant) return res.status(404).json({ error: 'Player not found in match' });

        const ddragonVersion = await getLatestDDragonVersion();
        const ddragonBase = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}`;

        const team = info.teams.find(t => t.teamId === participant.teamId);
        const teamTotalKills = team ? team.objectives.champion.kills : info.participants.filter(p => p.teamId === participant.teamId).reduce((sum, p) => sum + p.kills, 0);
        const participantsRatio = teamTotalKills > 0 ? ((participant.kills + participant.assists) / teamTotalKills) * 100 : 0;

        const items = [
            participant.item0, participant.item1, participant.item2,
            participant.item3, participant.item4, participant.item5, participant.item6
        ];

        const itemsData = await fetchJsonWithRetry(`${ddragonBase}/data/en_US/item.json`, {}, 12000, 3);
        const itemImages = items.map(id => {
            if (!id || id === 0) return { img: null, name: '' };
            return { img: `${ddragonBase}/img/item/${id}.png`, name: itemsData.data[id] ? itemsData.data[id].name : `Item ${id}` };
        });

        const spellData = await fetchJsonWithRetry(`${ddragonBase}/data/en_US/summoner.json`, {}, 12000, 3);
        const spells = Object.values(spellData.data);
        const spell1Info = spells.find(s => parseInt(s.key) === participant.summoner1Id);
        const spell2Info = spells.find(s => parseInt(s.key) === participant.summoner2Id);

        let keystoneIcon = null;
        let secondaryPathIcon = null;
        try {
            const runesData = await fetchJsonWithRetry(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/runesReforged.json`, {}, 12000, 3);
            const styles = participant.perks?.styles || [];
            const primaryStyle = styles.find(s => s.description === 'primaryStyle') || styles[0];
            const subStyle = styles.find(s => s.description === 'subStyle') || styles[1];

            if (primaryStyle) {
                const keystoneId = primaryStyle.selections?.[0]?.perk;
                const primaryTree = runesData.find(t => t.id === primaryStyle.style);
                if (primaryTree) {
                    for (const slot of primaryTree.slots) {
                        const found = slot.runes?.find(r => r.id === keystoneId);
                        if (found) { keystoneIcon = `https://ddragon.leagueoflegends.com/cdn/img/${found.icon}`; break; }
                    }
                }
            }

            if (subStyle) {
                const secondaryTree = runesData.find(t => t.id === subStyle.style);
                if (secondaryTree) {
                    secondaryPathIcon = `https://ddragon.leagueoflegends.com/cdn/img/${secondaryTree.icon}`;
                }
            }
        } catch (e) { }

        const allyTeam = info.participants.filter(p => p.teamId === participant.teamId).map(p => ({
            img: `${ddragonBase}/img/champion/${p.championName}.png`, name: p.championName
        }));
        const enemyTeam = info.participants.filter(p => p.teamId !== participant.teamId).map(p => ({
            img: `${ddragonBase}/img/champion/${p.championName}.png`, name: p.championName
        }));

        const matchDetail = {
            match_id: matchId,
            game_mode: info.gameMode,
            duration: info.gameDuration,
            start_time: info.gameStartTimestamp,
            win: participant.win,
            hero_id: participant.championId,
            hero_name: participant.championName,
            hero_icon: `${ddragonBase}/img/champion/${participant.championName}.png`,
            team: participant.teamId,
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            kda: ((participant.kills + participant.assists) / Math.max(participant.deaths, 1)).toFixed(2),
            item_json: items,
            item_images: itemImages,
            participants_ratio: participantsRatio.toFixed(2),
            spell1_id: participant.summoner1Id,
            spell1_icon: spell1Info ? { img: `${ddragonBase}/img/spell/${spell1Info.image.full}`, name: spell1Info.name } : { img: null, name: '' },
            spell2_id: participant.summoner2Id,
            spell2_icon: spell2Info ? { img: `${ddragonBase}/img/spell/${spell2Info.image.full}`, name: spell2Info.name } : { img: null, name: '' },
            keystone_icon: keystoneIcon ? { img: keystoneIcon, name: 'Keystone Rune' } : null,
            secondary_path_icon: secondaryPathIcon ? { img: secondaryPathIcon, name: 'Secondary Path' } : null,
            ally_team: allyTeam,
            enemy_team: enemyTeam,
            gold_earned: participant.goldEarned,
            total_damage: participant.totalDamageDealtToChampions,
            creep_score: participant.totalMinionsKilled + participant.neutralMinionsKilled
        };

        if (stats) {
            stats.matchDetails.set(matchId, matchDetail);
            if (!stats.topHeroes || stats.topHeroes.length < 4) {
                const exists = stats.topHeroes.some(h => h.hero_name === matchDetail.hero_name);
                if (!exists) {
                    stats.topHeroes.push({
                        hero_key: matchDetail.hero_id,
                        hero_name: matchDetail.hero_name,
                        hero_icon: matchDetail.hero_icon,
                        games: 1,
                        win: matchDetail.win ? 1 : 0,
                        lose: matchDetail.win ? 0 : 1,
                        winrate: matchDetail.win ? '100.00' : '0.00',
                        kda: matchDetail.kda,
                        kills: matchDetail.kills,
                        deaths: matchDetail.deaths,
                        assists: matchDetail.assists
                    });
                } else {
                    const idx = stats.topHeroes.findIndex(h => h.hero_name === matchDetail.hero_name);
                    const hero = stats.topHeroes[idx];
                    hero.games += 1;
                    if (matchDetail.win) hero.win += 1;
                    else hero.lose += 1;
                    hero.winrate = ((hero.win / hero.games) * 100).toFixed(2);
                    hero.kills += matchDetail.kills;
                    hero.deaths += matchDetail.deaths;
                    hero.assists += matchDetail.assists;
                    hero.kda = ((hero.kills + hero.assists) / Math.max(hero.deaths, 1)).toFixed(2);
                }
            }
            stats.markModified('topHeroes');
            stats.matchDetails.set(matchId, matchDetail);
            await stats.save();
        }

        res.json(matchDetail);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
