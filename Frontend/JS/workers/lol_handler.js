async function handleLol(action, payload, config) {
    const apiKey = config?.apiKey || '';
    const region = config?.region || 'th2';
    const routingRegion = config?.routingRegion || 'sea';
    const ddragonVersion = config?.ddragonVersion || '16.10.1';

    const baseUrl = `https://${region}.api.riotgames.com`;
    const routingUrl = `https://${routingRegion}.api.riotgames.com`;
    const ddragonBase = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}`;

    const skipCache = config?.skipCache === true;
    const fetchJson = async (url) => {
        const targetUrl = url.replace('https://', '');
        const finalUrl = `${self.location.origin}/api/riot/${targetUrl}` + (skipCache ? (targetUrl.includes('?') ? '&' : '?') + 'skipCache=true' : '');
        const res = await fetch(finalUrl);
        if (!res.ok) throw new Error(`LoL API Error: ${res.status} ${res.statusText}`);
        return res.json();
    };

    const fetchDdragon = async (url) => {
        if (!self.ddragonCache) self.ddragonCache = {};
        if (!self.ddragonCache[url]) {
            self.ddragonCache[url] = fetch(url).then(async res => {
                if (!res.ok) throw new Error(`DataDragon Error: ${res.status} ${res.statusText}`);
                return res.json();
            });
        }
        return self.ddragonCache[url];
    };

    switch (action) {
        case 'getPlayerData': {
            const riotId = payload.riotId;
            if (!riotId || !riotId.includes('#')) {
                throw new Error("รูปแบบ Riot ID ไม่ถูกต้อง กรุณาใส่แบบ GameName#TagLine (เช่น Faker#KR1)");
            }

            const [gameName, tagLine] = riotId.split('#');
            const accountCluster = (routingRegion === 'sea') ? 'asia' : routingRegion;
            const accountData = await fetchJson(`https://${accountCluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
            const puuid = accountData.puuid;
            const summonerData = await fetchJson(`${baseUrl}/lol/summoner/v4/summoners/by-puuid/${puuid}`);

            return {
                player_name: accountData.gameName,
                tag_line: accountData.tagLine,
                player_uid: puuid,
                summoner_id: summonerData.id,
                profile_icon: `${ddragonBase}/img/profileicon/${summonerData.profileIconId}.png`,
                summoner_level: summonerData.summonerLevel
            };
        }

        case 'getRank': {
            const puuid = payload.puuid;
            const data = await fetchJson(`${baseUrl}/lol/league/v4/entries/by-puuid/${puuid}`);
            const soloQueue = data.find(q => q.queueType === 'RANKED_SOLO_5x5') || data[0];
            if (!soloQueue) return null;

            const tier = soloQueue.tier ? soloQueue.tier.toUpperCase() : '';
            const isHighRank = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier);
            const maxLP = isHighRank ? Math.max(3000, soloQueue.leaguePoints) : 100;

            return {
                rank_tier: soloQueue.tier,
                rank_division: soloQueue.rank,
                rank_point: soloQueue.leaguePoints,
                max_lp: maxLP
            };
        }

        case 'getHeroIcon': {
            const championName = payload.championName;
            return {
                hero_icon: `${ddragonBase}/img/champion/${championName}.png`
            };
        }

        case 'getChampionMastery': {
            const puuid = payload.puuid;
            const data = await fetchJson(`${baseUrl}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`);
            const championDataRes = await fetchDdragon(`${ddragonBase}/data/en_US/champion.json`);
            const champions = Object.values(championDataRes.data);

            return data.map(mastery => {
                const champInfo = champions.find(c => parseInt(c.key) === mastery.championId) || {};

                return {
                    hero_key: mastery.championId,
                    hero_name: champInfo.name || `Unknown (${mastery.championId})`,
                    hero_icon: champInfo.id ? `${ddragonBase}/img/champion/${champInfo.id}.png` : '',
                    champion_level: mastery.championLevel,
                    champion_points: mastery.championPoints
                };
            });
        }

        case 'getMatchIds': {
            const puuid = payload.puuid;
            const count = payload.count || 10;
            const data = await fetchJson(`${routingUrl}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}`);
            return data.map(id => ({ match_uid: id }));
        }

        case 'getMatchDetail': {
            const matchId = payload.matchId;
            const puuid = payload.puuid;
            const data = await fetchJson(`${routingUrl}/lol/match/v5/matches/${matchId}`);

            const info = data.info;
            const participant = info.participants.find(p => p.puuid === puuid);
            if (!participant) return null;

            const team = info.teams.find(t => t.teamId === participant.teamId);
            const teamTotalKills = team ? team.objectives.champion.kills : info.participants.filter(p => p.teamId === participant.teamId).reduce((sum, p) => sum + p.kills, 0);
            const participantsRatio = teamTotalKills > 0 ? ((participant.kills + participant.assists) / teamTotalKills) * 100 : 0;

            const items = [
                participant.item0, participant.item1, participant.item2,
                participant.item3, participant.item4, participant.item5, participant.item6
            ];

            const itemsDataRes = await fetchDdragon(`${ddragonBase}/data/en_US/item.json`);
            const itemsData = itemsDataRes.data;

            const itemImages = items.map(id => {
                if (!id || id === 0) return { img: null, name: '' };
                return { img: `${ddragonBase}/img/item/${id}.png`, name: itemsData[id] ? itemsData[id].name : `Item ${id}` };
            });

            const spellDataRes = await fetchDdragon(`${ddragonBase}/data/en_US/summoner.json`);
            const spells = Object.values(spellDataRes.data);
            const spell1Info = spells.find(s => parseInt(s.key) === participant.summoner1Id);
            const spell2Info = spells.find(s => parseInt(s.key) === participant.summoner2Id);

            let keystoneIcon = null;
            let secondaryPathIcon = null;
            try {
                const runesDataRes = await fetchDdragon(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/runesReforged.json`);
                const styles = participant.perks?.styles || [];
                const primaryStyle = styles.find(s => s.description === 'primaryStyle') || styles[0];
                const subStyle = styles.find(s => s.description === 'subStyle') || styles[1];

                if (primaryStyle) {
                    const keystoneId = primaryStyle.selections?.[0]?.perk;
                    const primaryTree = runesDataRes.find(t => t.id === primaryStyle.style);
                    if (primaryTree) {
                        for (const slot of primaryTree.slots) {
                            const found = slot.runes?.find(r => r.id === keystoneId);
                            if (found) { keystoneIcon = `https://ddragon.leagueoflegends.com/cdn/img/${found.icon}`; break; }
                        }
                    }
                }

                if (subStyle) {
                    const secondaryTree = runesDataRes.find(t => t.id === subStyle.style);
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

            return {
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
        }

        case 'getChampionStats': {
            const matchDetails = payload.matchDetails;
            const stats = {};

            matchDetails.forEach(match => {
                const heroId = match.hero_id;
                if (!stats[heroId]) {
                    stats[heroId] = {
                        kills: 0, deaths: 0, assists: 0, wins: 0, loses: 0, totalMatches: 0,
                        hero_name: match.hero_name, hero_icon: match.hero_icon
                    };
                }

                stats[heroId].kills += match.kills;
                stats[heroId].deaths += match.deaths;
                stats[heroId].assists += match.assists;
                stats[heroId].totalMatches += 1;
                if (match.win) {
                    stats[heroId].wins += 1;
                } else {
                    stats[heroId].loses += 1;
                }
            });

            const result = [];
            for (const [heroId, stat] of Object.entries(stats)) {
                const kda = (stat.kills + stat.assists) / Math.max(stat.deaths, 1);
                const winRate = (stat.wins / stat.totalMatches) * 100;
                const avgKills = (stat.kills / stat.totalMatches).toFixed(1);
                const avgDeaths = (stat.deaths / stat.totalMatches).toFixed(1);
                const avgAssists = (stat.assists / stat.totalMatches).toFixed(1);

                result.push({
                    hero_id: heroId,
                    hero_name: stat.hero_name,
                    hero_icon: stat.hero_icon,
                    kills: stat.kills,
                    deaths: stat.deaths,
                    assists: stat.assists,
                    avg_kills: avgKills,
                    avg_deaths: avgDeaths,
                    avg_assists: avgAssists,
                    total_win: stat.wins,
                    total_loses: stat.loses,
                    total_matches: stat.totalMatches,
                    kda: kda.toFixed(2),
                    win_rate: winRate.toFixed(2)
                });
            }
            return result.sort((a, b) => b.total_matches - a.total_matches);
        }

        case 'getSpellsImages': {
            const spellIds = payload.spellIds;
            const spellData = await fetchDdragon(`${ddragonBase}/data/en_US/summoner.json`);
            const spells = Object.values(spellData.data);

            const images = spellIds.map(id => {
                const spell = spells.find(s => parseInt(s.key) === id);
                return spell ? `${ddragonBase}/img/spell/${spell.image.full}` : null;
            });

            return { images };
        }

        default:
            throw new Error(`Unknown LoL action: ${action}`);
    }
}

self.handleLol = handleLol;
