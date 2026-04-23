function renderNavbar() {
  const el = document.getElementById('navbar-placeholder');
  if (el) {
    el.innerHTML = `
      <nav class="h-[70px] bg-[#1B1B2F] border-b border-white/20 flex items-center justify-between px-4 box-border">
        <a href="#">
          <img src="../resource/pentagram-logo.png" alt="Pentagram Logo" class="h-[35px] object-contain">
        </a>
        <div class="text-white text-xl cursor-pointer"><i class="fa-solid fa-xmark"></i></div>
      </nav>
    `;
  }
}

function renderGameSelector(activePage) {
  const el = document.getElementById('game-selector-placeholder');
  if (el) {
    const dotaActive = activePage === 'dota2' ? 'bg-[#104245] text-white border border-[#238c8f]' : 'bg-[#181f3b] text-[#8b8c98] border border-white/10';
    const lolActive = activePage === 'lol' ? 'bg-[#104245] text-white border border-[#238c8f]' : 'bg-[#181f3b] text-[#8b8c98] border border-white/10';

    el.innerHTML = `
      <div class="h-auto bg-[#162447] px-3 py-4 border-b border-white/10 box-border">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-white text-[18px] font-bold">Game Details</h2>
            <i class="fa-regular fa-circle-xmark text-white text-xl cursor-pointer"></i>
        </div>
        <div class="grid grid-cols-2 gap-2 w-full">
          <a href="./gamedetail_dota2.html" class="flex items-center justify-center gap-3 h-[60px] rounded ${dotaActive} font-bold transition-all shadow-md">
            <img src="../resource/dota2-logo.png" alt="Dota 2" class="w-8 h-8 rounded-sm object-cover">
            <span>Dota 2</span>
          </a>
          <a href="./gamedetail_lol.html" class="flex items-center justify-center gap-3 h-[60px] rounded ${lolActive} font-bold transition-all shadow-md">
            <img src="../resource/lol-logo.png" alt="LoL" class="w-8 h-8 rounded-sm object-cover">
            <span>LoL</span>
          </a>
        </div>
      </div>
    `;
  }
}

// ฟังก์ชัน renderBottomNav สำหรับสร้าง HTML ของแถบนำทางด้านล่าง
// พารามิเตอร์ activeTab คือชื่อ tab ที่ต้องการให้เป็นสถานะ 'active' (มีสีขาว)
function renderBottomNav(activeTab = 'home') {
  const el = document.getElementById('bottom-nav-placeholder');
  if (el) {
    el.innerHTML = `
      <nav class="h-[60px] bg-[#1a1a2e] border-t border-white/20 flex items-center justify-around px-2 box-border">
        <a href="#" class="p-2 flex items-center justify-center ${activeTab === 'home' ? 'text-white' : 'text-[#8b8c98]'} hover:text-white transition-colors">
          <i class="fa-solid fa-house text-[22px]"></i>
        </a>
        <a href="#" class="p-2 flex items-center justify-center ${activeTab === 'star' ? 'text-white' : 'text-[#8b8c98]'} hover:text-white transition-colors">
          <div class="w-7 h-7 bg-current rounded-full flex items-center justify-center">
            <i class="fa-solid fa-star text-[#1a1a2e] text-[14px]"></i>
          </div>
        </a>
        <a href="#" class="p-2 flex items-center justify-center ${activeTab === 'add' ? 'text-white' : 'text-[#8b8c98]'} hover:text-white transition-colors">
          <i class="fa-solid fa-plus text-[26px]"></i>
        </a>
        <a href="#" class="p-2 flex items-center justify-center ${activeTab === 'heart' ? 'text-white' : 'text-[#8b8c98]'} hover:text-white transition-colors">
          <i class="fa-solid fa-heart text-[24px]"></i>
        </a>
        <a href="#" class="p-2 flex items-center justify-center ${activeTab === 'profile' ? 'text-white' : 'text-[#8b8c98]'} hover:text-white transition-colors">
          <i class="fa-solid fa-circle-user text-[26px]"></i>
        </a>
      </nav>
    `;
  }
}

// ฟังก์ชันเริ่มต้นสำหรับโหลดส่วนหัวและแถบนำทาง
// เราแก้ไขค่าเริ่มต้นของ activeTab จาก 'home' เป็น 'profile' ที่นี่ครับ
function initHeader(options = {}) {
  // เปลี่ยนค่า default ของ activeTab จาก 'home' ไปเป็น 'profile'
  const { activePage = 'lol', activeTab = 'profile' } = options;
  renderNavbar();
  renderGameSelector(activePage);
  // เรียก renderBottomNav โดยใช้ activeTab ที่ถูกตั้งค่าใหม่
  renderBottomNav(activeTab);
}

// *อย่าลืม* เรียกใช้ initHeader() เพื่อแสดงผลเมื่อหน้าเว็บโหลดเสร็จ
// initHeader(); // หรือ initHeader({ activeTab: 'profile' }); ก็ได้ผลลัพธ์เดียวกัน