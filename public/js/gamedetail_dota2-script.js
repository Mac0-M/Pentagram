function setupHomeNavigation() {
  const logo = document.getElementById('home-logo');
  if (logo) {
    logo.addEventListener('click', () => {
      window.location.href = 'index.html'; 
    });
  }
}

function setupGameSelector(activePage) {
  const btnDota = document.getElementById('btn-dota2');
  const btnLol = document.getElementById('btn-lol');
  if (!btnDota || !btnLol) return; 

  const activeClasses = ['bg-[#104245]', 'text-white', 'border', 'border-[#238c8f]'];
  const inactiveClasses = ['bg-[#181f3b]', 'text-[#8b8c98]', 'border', 'border-white/10'];

  if (activePage === 'dota2') {
    btnDota.classList.add(...activeClasses);
    btnLol.classList.add(...inactiveClasses);
  } else if (activePage === 'lol') {
    btnLol.classList.add(...activeClasses);
    btnDota.classList.add(...inactiveClasses);
  }
}

function setupBottomNav(activeTab = 'profile') {
  const tabs = {
    home: document.getElementById('nav-home'),
    star: document.getElementById('nav-star'),
    add: document.getElementById('nav-add'),
    heart: document.getElementById('nav-heart'),
    profile: document.getElementById('nav-profile')
  };

  const activeClass = 'text-white';
  const inactiveClass = 'text-[#8b8c98]';

  Object.keys(tabs).forEach(key => {
    const el = tabs[key];
    if (!el) return;
    if (key === activeTab) {
      el.classList.add(activeClass);
      el.classList.remove(inactiveClass);
    } else {
      el.classList.add(inactiveClass);
      el.classList.remove(activeClass);
    }
  });
}

function initHeader(options = {}) {
  const { activePage = 'dota2', activeTab = 'profile' } = options;
  setupHomeNavigation();
  setupGameSelector(activePage);
  setupBottomNav(activeTab);
}

// อัปเดตข้อมูลจำลอง พร้อมรูปภาพ Placeholder
const DOTA_DATA = {
  topHeroes: [
    { img: "https://picsum.photos/seed/sf/200/200", winRate: 75, wins: 3, losses: 1, matches: 4, kda: "4.6730", kdaDetail: "8/3/6" },
    { img: "https://picsum.photos/seed/luna/200/200", winRate: 67, wins: 2, losses: 1, matches: 3, kda: "3.2395", kdaDetail: "5/4/8" },
    { img: "https://picsum.photos/seed/mirana/200/200", winRate: 50, wins: 1, losses: 1, matches: 2, kda: "2.4255", kdaDetail: "6/5/4" },
    { img: "https://picsum.photos/seed/venge/200/200", winRate: 40, wins: 0, losses: 1, matches: 1, kda: "0.5489", kdaDetail: "1/6/2" }
  ],
  matches: Array(10).fill().map((_, i) => ({
    type: "Ranked Solo", isWin: i % 2 === 0, kda: i % 2 === 0 ? "11/1/7" : "1/6/2",
    time: `${i + 1}h ago`, duration: "41m 12s",
    heroImg: `https://picsum.photos/seed/dotahero${i}/100/100`,
    // ไอเทมบางช่องปล่อยว่างไว้เพื่อให้เหมือนจริง
    items: [
      `https://picsum.photos/seed/ditem1${i}/50/50`, `https://picsum.photos/seed/ditem2${i}/50/50`, `https://picsum.photos/seed/ditem3${i}/50/50`, 
      `https://picsum.photos/seed/ditem4${i}/50/50`, i % 2 === 0 ? `https://picsum.photos/seed/ditem5${i}/50/50` : "", ""
    ], 
    neutralItem: `https://picsum.photos/seed/dotaneutral${i}/50/50`,
    allyTeam: Array(5).fill().map((_, j) => `https://picsum.photos/seed/dotaally${i}${j}/50/50`),
    enemyTeam: Array(5).fill().map((_, j) => `https://picsum.photos/seed/dotaenemy${i}${j}/50/50`)
  }))
};

const emptyPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const renderImg = (src, extraClass = "") => `<img src="${src || emptyPixel}" class="bg-[#182641] object-cover shrink-0 ${extraClass}" alt="">`;

function renderDotaPage() {
  const heroGrid = document.getElementById('dota2-heroes-grid');
  if (heroGrid) {
    // อัปเดต HTML ให้เหมือนกับในรูป Screenshot ใหม่
    heroGrid.innerHTML = DOTA_DATA.topHeroes.map(h => `
      <div class="bg-card-bg/50 border-[2px] border-card-bg rounded-xl overflow-hidden">
        ${renderImg(h.img, "w-full h-28 object-cover")}
        <div class="p-3">
          <div class="flex justify-between items-center text-[13px] mb-1">
            <span class="text-gray-200">Win rate</span> 
            <span class="font-bold text-[15px]">${h.winRate}%</span>
          </div>
          <div class="flex justify-between items-center text-[13px] mb-2">
            <span class="text-gray-200">Matches</span> 
            <span class="font-bold text-[15px]">${h.matches}</span>
          </div>
          <div class="flex w-full h-[18px] rounded-[4px] text-[10px] font-bold text-white overflow-hidden mb-2.5">
            ${h.wins > 0 ? `<div class="bg-[#2ecc71] flex items-center justify-center" style="width: ${(h.wins/h.matches)*100}%">Win ${h.wins}</div>` : ''}
            ${h.losses > 0 ? `<div class="bg-lose flex items-center justify-center" style="width: ${(h.losses/h.matches)*100}%">Lost ${h.losses}</div>` : ''}
          </div>
          <p class="text-[12px] text-gray-300">KDA <span class="font-bold text-white text-[13px]">${h.kda}</span> ${h.kdaDetail}</p>
        </div>
      </div>
    `).join('');
  }

  const matchList = document.getElementById('dota2-match-list');
  if (matchList) {
    matchList.innerHTML = DOTA_DATA.matches.map(m => `
      <div class="bg-card-bg/50 border-[2px] border-card-bg rounded-xl p-3">
        <div class="flex justify-between items-baseline mb-3 text-sm">
          <span class="font-bold text-[16px]">${m.type}</span>
          <span class="text-gray-300">KDA <span class="font-bold text-[16px] text-white">${m.kda}</span></span>
          <span class="text-xs text-gray-400">${m.time} / ${m.duration}</span>
        </div>
        
        <div class="flex items-center justify-between gap-1">
          <div class="flex items-center gap-2.5">
            ${renderImg(m.heroImg, "w-[52px] h-[52px] rounded-[4px]")}
            
            <div class="flex flex-col gap-[4px] shrink-0">
              <div class="flex gap-[4px]">${m.items.slice(0, 3).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}</div>
              <div class="flex gap-[4px]">${m.items.slice(3, 6).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}</div>
            </div>

            <div class="shrink-0 flex items-center px-1">
              ${renderImg(m.neutralItem, "w-[30px] h-[30px] !rounded-full border border-gray-600")}
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <div class="flex flex-col justify-between h-[52px] shrink-0">
              <div class="w-[3px] h-[24px] bg-[#40AFFF] rounded-full"></div>
              <div class="w-[3px] h-[24px] bg-[#FF4060] rounded-full"></div>
            </div>
            <div class="flex flex-col gap-[4px] shrink-0">
              <div class="flex gap-[2px]">${m.allyTeam.map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}</div>
              <div class="flex gap-[2px]">${m.enemyTeam.map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}</div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initHeader === 'function') initHeader({ activePage: 'dota2' });
  renderDotaPage();
});