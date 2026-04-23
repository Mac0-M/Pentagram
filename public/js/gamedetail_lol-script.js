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
  const { activePage = 'lol', activeTab = 'profile' } = options;
  setupHomeNavigation();
  setupGameSelector(activePage);
  setupBottomNav(activeTab);
}

// อัปเดตข้อมูลจำลอง พร้อมรูปภาพ Placeholder
const LOL_DATA = {
  topChampions: [
    { img: "https://picsum.photos/seed/riven/200/200", winRate: 75, wins: 3, losses: 1, matches: 4, kda: "4.6730", kdaDetail: "8/3/6" },
    { img: "https://picsum.photos/seed/syndra/200/200", winRate: 67, wins: 2, losses: 1, matches: 3, kda: "3.2395", kdaDetail: "5/4/8" },
    { img: "https://picsum.photos/seed/leesin/200/200", winRate: 50, wins: 1, losses: 1, matches: 2, kda: "2.4255", kdaDetail: "6/5/4" },
    { img: "https://picsum.photos/seed/gwen/200/200", winRate: 40, wins: 0, losses: 1, matches: 1, kda: "0.5489", kdaDetail: "1/6/2" }
  ],
  matches: Array(10).fill().map((_, i) => ({
    type: "Ranked Solo",
    isWin: i % 2 === 0,
    kda: i % 2 === 0 ? "10/2/5" : "1/6/2",
    time: i % 2 === 0 ? "5h ago" : "1h ago",
    duration: "21m 59s",
    heroImg: `https://picsum.photos/seed/lolchamp${i}/100/100`,
    spells: [`https://picsum.photos/seed/spell1${i}/50/50`, `https://picsum.photos/seed/spell2${i}/50/50`],
    runes: [`https://picsum.photos/seed/rune1${i}/50/50`, `https://picsum.photos/seed/rune2${i}/50/50`],
    // ปล่อยว่างบางช่องให้เหมือนจริง
    items: [
      `https://picsum.photos/seed/litem1${i}/50/50`, `https://picsum.photos/seed/litem2${i}/50/50`, `https://picsum.photos/seed/litem3${i}/50/50`, 
      i % 2 === 0 ? `https://picsum.photos/seed/litem4${i}/50/50` : "", "", ""
    ],
    trinket: `https://picsum.photos/seed/trinket${i}/50/50`,
    allyTeam: Array(5).fill().map((_, j) => `https://picsum.photos/seed/lolally${i}${j}/50/50`),
    enemyTeam: Array(5).fill().map((_, j) => `https://picsum.photos/seed/lolenemy${i}${j}/50/50`)
  }))
};

const emptyPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const renderImg = (src, extraClass = "") => `<img src="${src || emptyPixel}" class="bg-[#182641] object-cover shrink-0 ${extraClass}" alt="">`;

function renderLoLPage() {
  const champGrid = document.getElementById('lol-champs-grid');
  if (champGrid) {
    // อัปเดต HTML ให้เหมือนกับในรูป Screenshot ใหม่
    champGrid.innerHTML = LOL_DATA.topChampions.map(c => `
      <div class="bg-card-bg/50 border-[2px] border-card-bg rounded-xl overflow-hidden">
        ${renderImg(c.img, "w-full h-28 object-cover")}
        <div class="p-3">
          <div class="flex justify-between items-center text-[13px] mb-1">
            <span class="text-gray-200">Win rate</span> 
            <span class="font-bold text-[15px]">${c.winRate}%</span>
          </div>
          <div class="flex justify-between items-center text-[13px] mb-2">
            <span class="text-gray-200">Matches</span> 
            <span class="font-bold text-[15px]">${c.matches}</span>
          </div>
          <div class="flex w-full h-[18px] rounded-[4px] text-[10px] font-bold text-white overflow-hidden mb-2.5">
            ${c.wins > 0 ? `<div class="bg-[#2ecc71] flex items-center justify-center" style="width: ${(c.wins/c.matches)*100}%">Win ${c.wins}</div>` : ''}
            ${c.losses > 0 ? `<div class="bg-lose flex items-center justify-center" style="width: ${(c.losses/c.matches)*100}%">Lost ${c.losses}</div>` : ''}
          </div>
          <p class="text-[12px] text-gray-300">KDA <span class="font-bold text-white text-[13px]">${c.kda}</span> ${c.kdaDetail}</p>
        </div>
      </div>
    `).join('');
  }

  const matchList = document.getElementById('lol-match-list');
  if (matchList) {
    matchList.innerHTML = LOL_DATA.matches.map(m => `
      <div class="bg-card-bg/50 border-[2px] border-card-bg rounded-xl p-3">
        <div class="flex justify-between items-baseline mb-3 text-sm">
          <span class="font-bold text-[16px] text-white">${m.type}</span>
          <span class="text-gray-300">KDA <span class="font-bold text-[16px] text-white">${m.kda}</span></span>
          <span class="text-xs text-gray-400">${m.time} / ${m.duration}</span>
        </div>
        
        <div class="flex items-center justify-between gap-1">
          <div class="flex items-center gap-2.5">
            ${renderImg(m.heroImg, "w-[52px] h-[52px] rounded-[4px]")}
            
            <div class="flex flex-col gap-[4px] shrink-0">
              <div class="flex gap-[4px]">
                ${renderImg(m.spells[0], "w-[24px] h-[24px] rounded-[3px]")}
                ${renderImg(m.runes[0], "w-[24px] h-[24px] rounded-full border border-gray-600")}
              </div>
              <div class="flex gap-[4px]">
                ${renderImg(m.spells[1], "w-[24px] h-[24px] rounded-[3px]")}
                ${renderImg(m.runes[1], "w-[24px] h-[24px] rounded-full border border-gray-600")}
              </div>
            </div>
            
            <div class="flex flex-col gap-[4px] shrink-0">
              <div class="flex gap-[4px]">
                ${m.items.slice(0, 3).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
              </div>
              <div class="flex gap-[4px] items-center">
                ${m.items.slice(3, 6).map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
                ${renderImg(m.trinket, "w-[24px] h-[24px] rounded-[3px]")}
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
                ${m.allyTeam.map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
              </div>
              <div class="flex gap-[2px]">
                ${m.enemyTeam.map(i => renderImg(i, "w-[24px] h-[24px] rounded-[3px]")).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initHeader === 'function') initHeader({ activePage: 'lol' });
  renderLoLPage();
});