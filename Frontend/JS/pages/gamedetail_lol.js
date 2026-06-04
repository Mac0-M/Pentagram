// ============================================================
// Utilities & Render Helpers are inherited from api_client.js
// ============================================================

const unrankedEmblem = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="s" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%232a3a5a"/><stop offset="100%" stop-color="%231b2845"/></linearGradient><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fabc60"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><circle cx="50" cy="50" r="40" fill="url(%23s)" stroke="url(%23g)" stroke-width="3"/><circle cx="50" cy="50" r="32" fill="none" stroke="rgba(250, 188, 96, 0.15)" stroke-width="1" stroke-dasharray="3,3"/><text x="50" y="62" font-family="sans-serif" font-size="36" font-weight="bold" fill="url(%23g)" text-anchor="middle">?</text></svg>`;

function getRankEmblem(tier) {
  if (!tier) return unrankedEmblem;
  const lowercaseTier = tier.toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${lowercaseTier}.png`;
}

// ============================================================
// Main Logic - League of Legends (Frontend Rendering Only)
// ============================================================

async function fetchAndRenderLoLData(riotId, isSilent = false) {
  try {
    // ดึงข้อมูลรวบยอดจากส่วนกลาง (api_client.js) ที่มีการคุมแคชและ rate limit ไว้แล้ว
    const profile = await getLolProfile(riotId, isSilent);
    
    // หากเช็คแล้วไม่มีประวัติแมตช์อัปเดตใหม่ ให้หยุดทำงานทันทีเพื่อประหยัด rate limit
    if (!profile.hasUpdates) return;

    const { playerData, rankData, matchIds, topHeroes } = profile;

    // อัปเดตข้อมูลผู้เล่นบนหน้าเว็บ
    document.querySelector('.info-banner h1').innerText = playerData.player_name;
    document.querySelector('.info-banner p span').innerText = `${playerData.player_name}#${playerData.tag_line}`;

    const puuid = playerData.player_uid;

    // อัปเดตรูปภาพแรงค์และคะแนน LP
    const rankImage = document.querySelector('.rank-image');
    if (rankData) {
      document.querySelector('.rank-name').innerText = `${rankData.rank_tier} ${rankData.rank_division}`;
      document.querySelector('.rank-mmr').innerText = `${rankData.rank_point} LP`;

      const emblemUrl = getRankEmblem(rankData.rank_tier);
      rankImage.src = emblemUrl;

      // เปลี่ยนขนาดสเกลรูปภาพตามชนิดของรูปภาพ (รูปแรงค์มีขอบใสว่างเยอะจึงต้องการสเกล 3.4)
      rankImage.classList.remove('scale-[1.3]');
      rankImage.classList.add('scale-[3.4]');

      updateRankProgress(rankData.rank_point, rankData.max_lp || 100);
    } else {
      document.querySelector('.rank-name').innerText = "Unranked";
      document.querySelector('.rank-mmr').innerText = "0 LP";
      rankImage.src = unrankedEmblem;

      // รูป Unranked SVG ของเราไม่มีขอบใสว่างเลย จึงต้องการสเกลเพียง 1.3
      rankImage.classList.remove('scale-[3.4]');
      rankImage.classList.add('scale-[1.3]');

      updateRankProgress(0, 100);
    }

    // อัปเดตประวัติแมตช์การเล่น
    if (!matchIds || matchIds.length === 0) return;

    const matchListContainer = document.getElementById('lol-match-list');
    matchListContainer.innerHTML = ''; // เคลียร์ของเก่า

    // แสดงโครงร่าง (Skeleton Loading) ทีละอันเพื่อความรวดเร็วและลื่นไหล
    const matchPromises = matchIds.map(match => {
      const matchDiv = document.createElement('div');
      matchDiv.className = "bg-card-bg/20 border-[2px] border-card-bg/30 rounded-xl p-3 animate-pulse h-[110px] flex flex-col gap-2";
      matchDiv.innerHTML = `<div class="h-4 bg-gray-700/50 rounded w-1/4"></div><div class="h-10 bg-gray-700/50 rounded w-full"></div>`;
      matchListContainer.appendChild(matchDiv);

      return getLolMatchDetail(match.match_uid, puuid, isSilent)
        .then(detail => {
          if (!detail) {
            matchDiv.style.display = 'none';
            return null;
          }
          const isWin = detail.win;
          matchDiv.className = `bg-card-bg/50 border-[2px] ${isWin ? 'border-[#40AFFF]/50' : 'border-[#FF4060]/50'} rounded-xl p-3`;
          matchDiv.innerHTML = `
            <div class="flex justify-between items-baseline mb-3 text-sm">
            <span class="font-bold text-[16px] ${isWin ? 'text-[#40AFFF]' : 'text-[#FF4060]'}">${detail.game_mode}</span>
            <span class="text-gray-300">KDA <span class="font-bold text-[16px] text-white">${detail.kda}</span></span>
            <span class="text-xs text-gray-400">${timeAgo(detail.start_time)} / ${formatDuration(detail.duration)}</span>
            </div>
            <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-2.5">
                ${renderImg(detail.hero_icon, "w-[52px] h-[52px] rounded-[4px]")}
                <div class="flex flex-col gap-[4px] shrink-0">
                <div class="flex gap-[4px]">
                    ${renderImg(detail.spell1_icon, "w-[24px] h-[24px] rounded-[3px]")}
                    ${detail.keystone_icon ? renderImg(detail.keystone_icon, "w-[24px] h-[24px] rounded-full") : '<div class="w-[24px] h-[24px] rounded-full border border-gray-600 bg-gray-800"></div>'}
                </div>
                <div class="flex gap-[4px]">
                    ${renderImg(detail.spell2_icon, "w-[24px] h-[24px] rounded-[3px]")}
                    ${detail.secondary_path_icon ? renderImg(detail.secondary_path_icon, "w-[24px] h-[24px] rounded-full") : '<div class="w-[24px] h-[24px] rounded-full border border-gray-600 bg-gray-800"></div>'}
                </div>
                </div>
                <div class="flex flex-col gap-[4px] shrink-0">
                <div class="flex gap-[4px]">
                    ${detail.item_images.slice(0, 3).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
                </div>
                <div class="flex gap-[4px] items-center">
                    ${detail.item_images.slice(3, 6).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
                    ${renderImg(detail.item_images[6], "w-[24px] h-[24px] rounded-[3px]")} <!-- Trinket -->
                </div>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <div class="flex flex-col justify-between h-[52px] shrink-0">
                <div class="w-[3px] h-[24px] bg-[#40AFFF] rounded-full"></div>
                <div class="w-[3px] h-[24px] bg-[#FF4060] rounded-full"></div>
                </div>
                <div class="flex flex-col gap-[4px] shrink-0">
                <div class="flex gap-[2px]">
                    ${(detail.ally_team || Array(5).fill('')).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
                </div>
                <div class="flex gap-[2px]">
                    ${(detail.enemy_team || Array(5).fill('')).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
                </div>
                </div>
            </div>
            </div>`;
          return detail;
        })
        .catch(err => {
          console.error("Failed to load match detail", err);
          matchDiv.style.display = 'none';
          return null;
        });
    });

    // แสดง Top Champions ที่คำนวณจากฝั่งเซิร์ฟเวอร์โดยตรง (ใช้ 10 แมตช์ล่าสุด เหมือน Dota 2)
    const champGrid = document.getElementById('lol-champs-grid');
    const emptyPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    if (topHeroes && topHeroes.length > 0) {
      champGrid.innerHTML = topHeroes.slice(0, 4).map(c => `
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
            <p class="text-[12px] lg:text-[14px] text-gray-300">Avg KDA <span class="font-bold text-white text-[13px] lg:text-[16px]">${c.kda}</span> (${(c.kills / c.games).toFixed(1)}/${(c.deaths / c.games).toFixed(1)}/${(c.assists / c.games).toFixed(1)})</p>
            <p class="text-[13px] lg:text-[15px] font-semibold text-[#40AFFF] mt-1.5 text-center bg-[#182641] rounded py-1 border border-[#40AFFF]/20">${c.hero_name}</p>
          </div>
        </div>
      `).join('');
    } else {
      champGrid.innerHTML = "<p class='text-white p-4'>No recent matches found.</p>";
    }

  } catch (error) {
    console.error("Error fetching LoL Data:", error);
    if (!isSilent) {
        document.querySelector('.info-banner h1').innerText = "Error Loading Player";
        
        const errorStr = String(error);
        if (errorStr.includes("429")) {
            alert("LoL Riot API Error: 429 (Too Many Requests)\nคีย์ของระบบชนขีดจำกัดความถี่ (Rate Limit) ของ Riot Games แล้ว! กรุณารอ 1-2 นาทีแล้วลองใหม่อีกครั้งครับ");
        } else {
            alert(`ไม่สามารถดึงข้อมูล Riot Games ได้\nสาเหตุ: ${errorStr}\nโปรดตรวจสอบว่ารัน Backend แล้วและใส่ API Key เรียบร้อย`);
        }
    }
  }
}

// ============================================================
// Rank Progress Ring
// ============================================================
function updateRankProgress(currentLP, maxLP = 100) {
  const progressRing = document.getElementById('rank-progress-ring');
  if (!progressRing) return;

  const circumference = 276;
  const percent = Math.min(Math.max((currentLP / maxLP) * 100, 0), 100);
  const offset = circumference - (percent / 100) * circumference;

  progressRing.style.transition = 'stroke-dashoffset 1s ease-in-out';
  progressRing.style.strokeDashoffset = offset;
}

// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initHeader === 'function') initHeader({ activePage: 'lol' });

  // ดึง ID ผู้เล่นแบบไดนามิกจากส่วนกลาง (ใช้ ID ที่ user ใส่ไว้ในหน้า Profile)
  const activeIds = typeof getActiveGameIds === 'function' ? getActiveGameIds() : {};
  const riotId = activeIds.lolId;

  if (!riotId) {
    document.querySelector('.info-banner h1').innerText = "No Riot ID Linked";
    document.querySelector('.info-banner p span').innerText = "กรุณาเชื่อมต่อ Riot ID ในหน้า Profile ก่อน";
    return;
  }

  // โหลดข้อมูลเริ่มต้น
  fetchAndRenderLoLData(riotId);

  // โหลดข้อมูล Dota 2 รอไว้ล่วงหน้าแบบเงียบๆ ใน background (หากผู้ใช้กดสลับเกมจะได้ขึ้นทันที)
  setTimeout(() => {
      if (typeof window.prefetchGameData === 'function') {
          window.prefetchGameData('dota2');
      }
  }, 2000);

  // ตั้งค่า Auto-Update ข้อมูลทุกๆ 60 วินาที เบื้องหลัง (Silent Mode)
  setInterval(() => {
      fetchAndRenderLoLData(riotId, true);
  }, 60000);
});