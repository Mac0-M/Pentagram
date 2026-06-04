// ============================================================
// Utilities & Render Helpers are inherited from api_client.js
// ============================================================

function getDotaRankName(tier) {
    if (!tier) return "Unranked";
    const badge = Math.floor(tier / 10);
    const stars = tier % 10;
    const names = ["", "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"];
    if (badge === 8 || badge > 8) return "Immortal";
    return `${names[badge]} ${stars}`;
}

// ============================================================
// Main Logic - Dota 2 (Frontend Rendering Only)
// ============================================================

async function fetchAndRenderDotaPage(accountId, isSilent = false) {
    try {
        // ดึงข้อมูลรวบยอดจากส่วนกลาง (api_client.js) ที่มีการคุมแคชและ rate limit ไว้แล้ว
        const profile = await getDota2Profile(accountId, isSilent);

        // จัดการแบนเนอร์แจ้งเตือน Rate Limit / Cached Data
        const rateLimitBanner = document.getElementById('rate-limit-banner');
        const rateLimitBannerMsg = document.getElementById('rate-limit-banner-msg');
        if (rateLimitBanner && rateLimitBannerMsg) {
            if (profile.isCached) {
                rateLimitBannerMsg.innerText = profile.errorMessage && profile.errorMessage.includes('429')
                    ? "ขณะนี้ API สาธารณะของ OpenDota ติดข้อจำกัดความถี่ในการเรียกข้อมูล (Rate Limit - 429) ระบบจึงแสดงข้อมูลล่าสุดที่เก็บไว้ในฐานข้อมูล (Cached Data) แทนการดึงข้อมูลสด"
                    : `ระบบดึงข้อมูลสดไม่สำเร็จ (${profile.errorMessage || 'Unknown Error'}) กำลังแสดงผลข้อมูลสำรองจากฐานข้อมูล (Cached Data)`;
                rateLimitBanner.classList.remove('hidden');
            } else {
                rateLimitBanner.classList.add('hidden');
            }
        }

        // หากเช็คแล้วไม่มีประวัติแมตช์อัปเดตใหม่ ให้หยุดทำงานทันทีเพื่อประหยัด rate limit
        if (!profile.hasUpdates) return;

        const { playerData, topHeroes, matches } = profile;

        // อัปเดตข้อมูลผู้เล่นและ Rank บนหน้าเว็บ
        document.querySelector('.info-banner h1').innerText = playerData.player_name || "Unknown Player";
        document.querySelector('.info-banner p span').innerText = playerData.player_uid;
        document.querySelector('.rank-name').innerText = getDotaRankName(playerData.rank_tier);

        const rankPoint = playerData.rank_point;
        document.querySelector('.rank-mmr').innerText = rankPoint ? `${rankPoint} MMR` : "TBD";

        // อัปเดตรูปภาพแรงค์และดาวของ Dota 2
        const rankImage = document.querySelector('.rank-image');
        const starOverlay = document.getElementById('dota-star-overlay');
        const emptyPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

        if (playerData.rank_tier) {
            const badge = Math.floor(playerData.rank_tier / 10);
            const stars = playerData.rank_tier % 10;

            if (badge >= 1 && badge <= 8) {
                rankImage.src = `https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_${badge}.png`;
                if (stars >= 1 && stars <= 5 && badge < 8) {
                    starOverlay.src = `https://www.opendota.com/assets/images/dota2/rank_icons/rank_star_${stars}.png`;
                    starOverlay.style.display = 'block';
                } else {
                    starOverlay.src = emptyPixel;
                    starOverlay.style.display = 'none';
                }
            }
        } else {
            rankImage.src = "https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_0.png";
            starOverlay.src = emptyPixel;
            starOverlay.style.display = 'none';
        }

        // วงแหวนของ Dota (เป้าหมายสูงสุดที่ 8,000 MMR)
        updateRankProgress(rankPoint || 0, 8000);

        // อัปเดตฮีโร่ยอดฮิต (เอาเฉพาะ 4 ตัวแรกที่เล่นบ่อยสุด)
        const champGrid = document.getElementById('dota2-heroes-grid');
        const sortedHeroes = topHeroes.sort((a, b) => b.games - a.games).slice(0, 4);

        champGrid.innerHTML = sortedHeroes.map(c => `
      <div class="bg-card-bg/50 border-[2px] border-card-bg rounded-xl overflow-hidden">
        <img 
          src="${c.hero_icon || emptyPixel}" 
          class="w-full bg-[#182641]" 
          style="object-fit: cover !important; aspect-ratio: 4 / 3 !important; width: 100% !important; height: auto !important;"
          alt="${c.hero_name}"
        />
        <div class="p-3">
          <div class="flex justify-between items-center text-[13px] lg:text-[15px] mb-1">
            <span class="text-gray-200">Win rate</span>
            <span class="font-bold text-[15px] lg:text-[18px] text-white">${c.winrate}%</span>
          </div>
          <div class="flex justify-between items-center text-[13px] lg:text-[15px] mb-2">
            <span class="text-gray-200">Matches</span>
            <span class="font-bold text-[15px] lg:text-[18px] text-white">${c.games}</span>
          </div>
          <div class="flex w-full h-[18px] lg:h-[24px] rounded-[4px] text-[10px] lg:text-[12px] font-bold text-white overflow-hidden mb-2.5">
            ${c.win > 0 ? `<div class="bg-[#2ecc71] flex items-center justify-center" style="width: ${(c.win / c.games) * 100}%">Win ${c.win}</div>` : ''}
            ${c.lose > 0 ? `<div class="bg-lose flex items-center justify-center" style="width: ${(c.lose / c.games) * 100}%">Lost ${c.lose}</div>` : ''}
          </div>
          <p class="text-[12px] lg:text-[14px] text-gray-300">Avg KDA <span class="font-bold text-white text-[13px] lg:text-[16px]">${c.kda || '0.00'}</span> (${c.kills !== undefined ? c.kills : 0}/${c.deaths !== undefined ? c.deaths : 0}/${c.assists !== undefined ? c.assists : 0})</p>
          <p class="text-[13px] lg:text-[15px] font-semibold text-[#40AFFF] mt-1.5 text-center bg-[#182641] rounded py-1 border border-[#40AFFF]/20">${c.hero_name}</p>
        </div>
      </div>
    `).join('');

        // อัปเดตประวัติแมตช์การเล่น
        if (!matches || matches.length === 0) return;

        const matchListContainer = document.getElementById('dota2-match-list');
        matchListContainer.innerHTML = '';

// Helper: Render Dota Match Row (with graceful fallback if full details fail/rate-limit)
function renderDotaMatchRow(matchDiv, match, detail) {
    const isWin = match.win;
    const modeText = match.game_mode_text || "Ranked";

    matchDiv.className = `bg-card-bg/50 border-[2px] ${isWin ? 'border-[#40AFFF]/50' : 'border-[#FF4060]/50'} rounded-xl p-3`;

    const itemImages = detail?.item_images || Array(6).fill('');
    const neutralItemImg = detail?.neutral_item_image || '';
    const allyTeam = detail?.ally_team || Array(5).fill('');
    const enemyTeam = detail?.enemy_team || Array(5).fill('');

    matchDiv.innerHTML = `
        <div class="flex justify-between items-baseline mb-3 text-sm">
            <span class="font-bold text-[16px] ${isWin ? 'text-[#40AFFF]' : 'text-[#FF4060]'}">${modeText}</span>
            <span class="text-gray-300">KDA <span class="font-bold text-[16px] text-white">${match.kda}</span></span>
            <span class="text-xs text-gray-400">${timeAgo(match.start_time)} / ${formatDuration(match.duration)}</span>
        </div>
        <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-2.5">
                ${renderImg(match.hero_icon, "w-[52px] h-[52px] rounded-[4px]")}
                <div class="flex flex-col gap-[4px] shrink-0">
                    <div class="flex gap-[4px]">${itemImages.slice(0, 3).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}</div>
                    <div class="flex gap-[4px]">${itemImages.slice(3, 6).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}</div>
                </div>
                <div class="shrink-0 flex items-center px-1">
                    ${renderImg(neutralItemImg, "w-[30px] h-[30px] !rounded-full border border-gray-600")}
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <div class="flex flex-col justify-between h-[52px] shrink-0">
                    <div class="w-[3px] h-[24px] bg-[#40AFFF] rounded-full"></div>
                    <div class="w-[3px] h-[24px] bg-[#FF4060] rounded-full"></div>
                </div>
                <div class="flex flex-col gap-[4px] shrink-0">
                    <div class="flex gap-[2px]">
                        ${allyTeam.map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
                    </div>
                    <div class="flex gap-[2px]">
                        ${enemyTeam.map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
                    </div>
                </div>
            </div>
        </div>`;
}

        // แสดงโครงร่าง (Skeleton Loading) ทีละอันเพื่อความรวดเร็วและลื่นไหล
        matches.slice(0, 10).forEach(match => {
            const matchDiv = document.createElement('div');
            matchDiv.className = "bg-card-bg/20 border-[2px] border-card-bg/30 rounded-xl p-3 animate-pulse h-[110px] flex flex-col gap-2";
            matchDiv.innerHTML = `<div class="h-4 bg-gray-700/50 rounded w-1/4"></div><div class="h-10 bg-gray-700/50 rounded w-full"></div>`;
            matchListContainer.appendChild(matchDiv);

            getDota2MatchDetail(match.match_id, accountId, isSilent)
                .then(detail => {
                    renderDotaMatchRow(matchDiv, match, detail);
                })
                .catch(err => {
                    console.warn("Failed to load match detail, rendering summary fallback:", err);
                    renderDotaMatchRow(matchDiv, match, null);
                });
        });

    } catch (error) {
        console.error("Error fetching Dota 2 Data:", error);

        // ซ่อน skeleton loading ของแมตช์
        const matchListContainer = document.getElementById('dota2-match-list');
        if (matchListContainer) {
            matchListContainer.innerHTML = `<p class="text-gray-400 text-center py-4">Failed to load matches.</p>`;
        }

        // แสดงข้อความในแบนเนอร์แจ้งเตือน
        const rateLimitBanner = document.getElementById('rate-limit-banner');
        const rateLimitBannerMsg = document.getElementById('rate-limit-banner-msg');
        if (rateLimitBanner && rateLimitBannerMsg) {
            const errorStr = String(error);
            if (errorStr.includes("429")) {
                rateLimitBannerMsg.innerText = "ไม่สามารถดึงข้อมูลได้เนื่องจาก API สาธารณะของ OpenDota ติดข้อจำกัดความถี่ในการเรียกใช้งาน (Rate Limit - 429) และไม่มีข้อมูลสำรองในระบบ กรุณารอ 30-60 วินาทีแล้วลองใหม่อีกครั้ง";
            } else {
                rateLimitBannerMsg.innerText = `ไม่สามารถดึงข้อมูลจาก OpenDota ได้ สาเหตุ: ${error.message || error} (ไม่มีข้อมูลสำรองในระบบ)`;
            }
            rateLimitBanner.classList.remove('hidden');
        }

        if (!isSilent) {
            document.querySelector('.info-banner h1').innerText = "Error Loading Player";
            const errorStr = String(error);
            if (errorStr.includes("429")) {
                alert("Dota 2 API Error: 429 (Too Many Requests)\nคุณส่งคำขอหรือรีเฟรชหน้าเว็บถี่เกินไป! กรุณารอ 30-60 วินาทีแล้วลองใหม่อีกครั้งครับ");
            } else {
                alert(`ไม่สามารถดึงข้อมูล Dota 2 ได้\nสาเหตุ: ${errorStr}\nโปรดตรวจสอบว่า Account ID ถูกต้อง หรือลองใหม่อีกครั้งภายหลัง`);
            }
        }
    }
}

// ============================================================
// Rank Progress Ring
// ============================================================
function updateRankProgress(currentMMR, maxMMR = 8000) {
    const progressRing = document.getElementById('dota-progress-ring');
    if (!progressRing) return;

    const circumference = 276;
    const percent = Math.min(Math.max((currentMMR / maxMMR) * 100, 0), 100);
    const offset = circumference - (percent / 100) * circumference;

    progressRing.style.transition = 'stroke-dashoffset 1s ease-in-out';
    progressRing.style.strokeDashoffset = offset;
}

// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initHeader === 'function') initHeader({ activePage: 'dota2' });

    // ดึง ID ผู้เล่นแบบไดนามิกจากส่วนกลาง (ใช้ ID ที่ user ใส่ไว้ในหน้า Profile)
    const activeIds = typeof getActiveGameIds === 'function' ? getActiveGameIds() : {};
    const dotaId = activeIds.dotaId;

    if (!dotaId) {
        document.querySelector('.info-banner h1').innerText = "No Dota 2 ID Linked";
        document.querySelector('.info-banner p span').innerText = "กรุณาเชื่อมต่อ Dota 2 ID ในหน้า Profile ก่อน";
        return;
    }

    // โหลดข้อมูลเริ่มต้น
    fetchAndRenderDotaPage(dotaId);

    // โหลดข้อมูล LoL รอไว้ล่วงหน้าแบบเงียบๆ ใน background (หากผู้ใช้กดสลับเกมจะได้ขึ้นทันที)
    setTimeout(() => {
        if (typeof window.prefetchGameData === 'function') {
            window.prefetchGameData('lol');
        }
    }, 2000);

    // ตั้งค่า Auto-Update ข้อมูลทุกๆ 60 วินาที เบื้องหลัง (Silent Mode)
    setInterval(() => {
        fetchAndRenderDotaPage(dotaId, true);
    }, 60000);
});