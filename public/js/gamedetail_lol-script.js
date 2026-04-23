const LOL_DATA = {
  topChampions: [
    { img: "", winRate: 75, wins: 3, losses: 1, matches: 4, kda: "4.67", kdaDetail: "8/3/6" },
    { img: "", winRate: 67, wins: 2, losses: 1, matches: 3, kda: "3.24", kdaDetail: "5/4/8" },
    { img: "", winRate: 50, wins: 1, losses: 1, matches: 2, kda: "2.43", kdaDetail: "6/5/4" },
    { img: "", winRate: 40, wins: 0, losses: 1, matches: 1, kda: "0.55", kdaDetail: "1/6/2" }
  ],
  matches: Array(10).fill().map((_, i) => ({
    type: "Ranked Solo",
    isWin: i % 2 === 0,
    kda: i % 2 === 0 ? "10/2/5" : "1/6/2",
    time: i % 2 === 0 ? "5h ago" : "1h ago",
    duration: "21m 59s",
    heroImg: "",
    spells: ["", ""],
    runes: ["", ""],
    items: ["", "", "", "", "", ""],
    trinket: "",
    allyTeam: ["", "", "", "", ""],
    enemyTeam: ["", "", "", "", ""]
  }))
};

const emptyPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const renderImg = (src, extraClass = "") => `<img src="${src || emptyPixel}" class="bg-[#2a3a5a] object-cover shrink-0 ${extraClass}" alt="">`;

function renderLoLPage() {
  const champGrid = document.getElementById('lol-champs-grid');
  if (champGrid) {
    champGrid.innerHTML = LOL_DATA.topChampions.map(c => `
      <div class="bg-card-bg/50 border-[3px] border-card-bg rounded-lg overflow-hidden">
        ${renderImg(c.img, "w-full h-24")}
        <div class="p-2.5">
          <div class="flex justify-between text-xs mb-1">
            <span>Win rate</span> <span class="font-bold">${c.winRate}%</span>
          </div>
          <div class="w-full h-1.5 bg-lose rounded-full mb-2">
            <div class="h-full bg-win rounded-l-full" style="width:${c.winRate}%"></div>
          </div>
          <p class="text-[11px]">KDA <span class="font-bold">${c.kda}</span> ${c.kdaDetail}</p>
        </div>
      </div>
    `).join('');
  }

  const matchList = document.getElementById('lol-match-list');
  if (matchList) {
    matchList.innerHTML = LOL_DATA.matches.map(m => `
      <div class="bg-card-bg/50 border-[3px] border-card-bg rounded-lg p-3">
        <div class="flex justify-between items-baseline mb-2 text-sm">
          <span class="font-bold text-[15px] text-white">${m.type}</span>
          <span class="text-gray-200">KDA <span class="font-bold text-[15px] text-white">${m.kda}</span></span>
          <span class="text-xs text-gray-300">${m.time} / ${m.duration}</span>
        </div>
        
        <div class="flex items-center justify-between gap-1">
          <div class="flex items-center gap-2">
            ${renderImg(m.heroImg, "w-[48px] h-[48px] rounded-[3px]")}
            
            <div class="flex flex-col gap-[4px] shrink-0">
              <div class="flex gap-[4px]">
                ${renderImg(m.spells[0], "w-[22px] h-[22px] rounded-[3px]")}
                ${renderImg(m.runes[0], "w-[22px] h-[22px] rounded-[3px] border border-[#2a3a5a]")}
              </div>
              <div class="flex gap-[4px]">
                ${renderImg(m.spells[1], "w-[22px] h-[22px] rounded-[3px]")}
                ${renderImg(m.runes[1], "w-[22px] h-[22px] rounded-[3px] border border-[#2a3a5a]")}
              </div>
            </div>
            
            <div class="flex flex-col gap-[4px] shrink-0">
              <div class="flex gap-[4px]">
                ${m.items.slice(0, 3).map(i => renderImg(i, "w-[22px] h-[22px] rounded-[3px]")).join('')}
              </div>
              <div class="flex gap-[4px] items-center">
                ${m.items.slice(3, 6).map(i => renderImg(i, "w-[22px] h-[22px] rounded-[3px]")).join('')}
                ${renderImg(m.trinket, "w-[22px] h-[22px] rounded-[3px]")}
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-2 shrink-0">
            <div class="flex flex-col justify-between h-[48px] shrink-0">
              <div class="w-[3px] h-[22px] bg-[#40AFFF] rounded-full"></div>
              <div class="w-[3px] h-[22px] bg-[#FF4060] rounded-full"></div>
            </div>
            <div class="flex flex-col gap-[4px] shrink-0">
              <div class="flex gap-[2px]">
                ${m.allyTeam.map(i => renderImg(i, "w-[22px] h-[22px] rounded-[3px]")).join('')}
              </div>
              <div class="flex gap-[2px]">
                ${m.enemyTeam.map(i => renderImg(i, "w-[22px] h-[22px] rounded-[3px]")).join('')}
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