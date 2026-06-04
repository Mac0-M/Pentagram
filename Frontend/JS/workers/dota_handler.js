async function handleDota2(action, payload, config) {
    const baseUrl = 'https://api.opendota.com/api';
    const cdnBase = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react';

    const skipCache = config?.skipCache === true;
    const fetchJson = async (url) => {
        const finalUrl = url + (skipCache ? (url.includes('?') ? '&' : '?') + 'skipCache=true' : '');
        const res = await fetch(finalUrl);
        if (!res.ok) throw new Error(`Dota2 API Error: ${res.status} ${res.statusText}`);
        return res.json();
    };

    const fetchConstant = async (url) => {
        if (!self.dotaCache) self.dotaCache = {};
        if (!self.dotaCache[url]) {
            self.dotaCache[url] = fetch(url).then(async res => {
                if (!res.ok) throw new Error(`Dota2 Constant Error: ${res.status} ${res.statusText}`);
                return res.json();
            });
        }
        return self.dotaCache[url];
    };

    switch (action) {
        case 'getPlayerData': {
            const accountId = payload.accountId;
            const data = await fetchJson(`${baseUrl}/players/${accountId}`);

            let rankPoint = data.solo_competitive_rank || data.competitive_rank || data.mmr_estimate?.estimate || null;
            if (!rankPoint && data.rank_tier) {
                const badge = Math.floor(data.rank_tier / 10);
                const stars = data.rank_tier % 10;
                if (badge >= 1 && badge <= 7) {
                    rankPoint = (badge - 1) * 770 + (stars * 154);
                } else if (badge === 8) {
                    rankPoint = 5620;
                }
            }

            return {
                player_name: data.profile?.personaname,
                player_uid: data.profile?.account_id,
                rank_tier: data.rank_tier,
                rank_point: rankPoint
            };
        }

        case 'getHeroStats': {
            const accountId = payload.accountId;
            const data = await fetchJson(`${baseUrl}/players/${accountId}/heroes`);

            const top4HeroIds = data.sort((a, b) => b.games - a.games).slice(0, 4).map(h => h.hero_id);
            const heroTotalsMap = {};
            try {
                await Promise.all(top4HeroIds.map(async hid => {
                    const totals = await fetchJson(`${baseUrl}/players/${accountId}/totals?hero_id=${hid}`);
                    const killsObj = totals.find(t => t.field === 'kills') || { sum: 0 };
                    const deathsObj = totals.find(t => t.field === 'deaths') || { sum: 0 };
                    const assistsObj = totals.find(t => t.field === 'assists') || { sum: 0 };

                    heroTotalsMap[hid] = {
                        kills: killsObj.sum,
                        deaths: deathsObj.sum,
                        assists: assistsObj.sum
                    };
                }));
            } catch (err) {
                console.warn('Failed to fetch totals for top heroes:', err);
            }

            const heroesConstants = await fetchConstant(`${baseUrl}/constants/heroes`);

            return data.map(hero => {
                const heroInfo = heroesConstants[hero.hero_id] || {};
                const shortName = heroInfo.name ? heroInfo.name.replace('npc_dota_hero_', '') : '';

                const lifetime = heroTotalsMap[hero.hero_id];
                let kills = 0, deaths = 0, assists = 0;
                let avgKills = '0.0', avgDeaths = '0.0', avgAssists = '0.0';
                let kdaRatio = '0.00';

                if (lifetime) {
                    kills = lifetime.kills;
                    deaths = lifetime.deaths;
                    assists = lifetime.assists;
                    avgKills = hero.games > 0 ? (kills / hero.games).toFixed(1) : '0.0';
                    avgDeaths = hero.games > 0 ? (deaths / hero.games).toFixed(1) : '0.0';
                    avgAssists = hero.games > 0 ? (assists / hero.games).toFixed(1) : '0.0';
                    kdaRatio = hero.games > 0 ? ((kills + assists) / Math.max(deaths, 1)).toFixed(2) : '0.00';
                }

                return {
                    hero_key: hero.hero_id,
                    hero_name: heroInfo.localized_name || 'Unknown',
                    hero_icon: shortName ? `${cdnBase}/heroes/${shortName}.png` : '',
                    games: hero.games,
                    win: hero.win,
                    lose: hero.games - hero.win,
                    winrate: hero.games > 0 ? ((hero.win / hero.games) * 100).toFixed(2) : 0,
                    kda: kdaRatio,
                    kills: kills,
                    deaths: deaths,
                    assists: assists,
                    avg_kills: avgKills,
                    avg_deaths: avgDeaths,
                    avg_assists: avgAssists
                };
            });
        }

        case 'getWinLoss': {
            const accountId = payload.accountId;
            const data = await fetchJson(`${baseUrl}/players/${accountId}/wl`);
            const total = data.win + data.lose;
            return {
                win: data.win,
                lose: data.lose,
                winrate: total > 0 ? ((data.win / total) * 100).toFixed(2) : 0
            };
        }

        case 'getRecentMatches': {
            const accountId = payload.accountId;
            const data = await fetchJson(`${baseUrl}/players/${accountId}/recentMatches`);
            const heroesConstants = await fetchConstant(`${baseUrl}/constants/heroes`);

            return data.map(match => {
                const heroInfo = heroesConstants[match.hero_id] || {};
                const shortName = heroInfo.name ? heroInfo.name.replace('npc_dota_hero_', '') : '';

                return {
                    match_id: match.match_id,
                    game_mode: match.game_mode,
                    game_mode_text: match.game_mode === 23 ? 'Turbo' : (match.game_mode === 22 ? 'All Draft' : 'Ranked'),
                    duration: match.duration,
                    start_time: match.start_time,
                    win: match.radiant_win === (match.player_slot < 128),
                    hero_id: match.hero_id,
                    hero_icon: shortName ? `${cdnBase}/heroes/${shortName}.png` : '',
                    player_slot: match.player_slot,
                    kills: match.kills,
                    deaths: match.deaths,
                    assists: match.assists,
                    kda: ((match.kills + match.assists) / Math.max(match.deaths, 1)).toFixed(2)
                };
            });
        }

        case 'getMatchDetail': {
            const matchId = payload.matchId;
            const accountId = payload.accountId;
            const data = await fetchJson(`${baseUrl}/matches/${matchId}`);
            const player = data.players.find(p => p.account_id === parseInt(accountId) || p.account_id === accountId);
            if (!player) return null;

            const itemsConstants = await fetchConstant(`${baseUrl}/constants/items`);

            const resolveItemImg = (itemId) => {
                if (!itemId) return { img: null, name: '' };
                const itemKey = Object.keys(itemsConstants).find(k => itemsConstants[k].id === itemId);
                if (itemKey) {
                    const itemName = itemKey.replace('recipe_', '');
                    return { img: `${cdnBase}/items/${itemName}.png`, name: itemsConstants[itemKey].dname || itemKey };
                }
                return { img: null, name: '' };
            };

            const items = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5];
            const itemImages = items.map(id => resolveItemImg(id));
            const neutralItemImg = resolveItemImg(player.item_neutral);

            const heroesConstants = await fetchConstant(`${baseUrl}/constants/heroes`);
            const getHeroImg = (heroId) => {
                const heroInfo = heroesConstants[heroId] || {};
                const shortName = heroInfo.name ? heroInfo.name.replace('npc_dota_hero_', '') : '';
                return { img: shortName ? `${cdnBase}/heroes/${shortName}.png` : '', name: heroInfo.localized_name || shortName };
            };

            const isRadiant = player.player_slot < 128;
            const allyTeam = data.players.filter(p => (p.player_slot < 128) === isRadiant).map(p => getHeroImg(p.hero_id));
            const enemyTeam = data.players.filter(p => (p.player_slot < 128) !== isRadiant).map(p => getHeroImg(p.hero_id));

            return {
                deaths: player.deaths,
                assists: player.assists,
                item_json: items,
                item_images: itemImages,
                neutral_item_image: neutralItemImg,
                ally_team: allyTeam,
                enemy_team: enemyTeam,
                teamfight_participation: player.teamfight_participation ? (player.teamfight_participation * 100).toFixed(2) : 0
            };
        }

        default:
            throw new Error(`Unknown Dota2 action: ${action}`);
    }
}

self.handleDota2 = handleDota2;
