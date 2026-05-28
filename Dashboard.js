// จำลองรูปภาพ Default ตามรูปที่ 2
// กำหนด Path รูปภาพที่คุณให้มา (เปลี่ยนชื่อไฟล์ให้ตรงกับที่คุณเซฟไว้)
const PROFILE_IMAGE_URL = "profile_default.png"; 

// ฟังก์ชันสร้างข้อมูลจำลอง 200 อันดับ
const allPlayers = Array.from({ length: 200 }, (_, i) => ({
    place: i + 1,
    username: `PlayerName_${i + 1}`,
    score: 999 - i,
    ranking: "Master",
    avatar: PROFILE_IMAGE_URL // ใช้รูปที่ให้มาสำหรับทุกคน
}));

// ... (คงส่วน allPlayers และ DEFAULT_AVATAR ไว้เหมือนเดิม)

let currentPage = 1;
const rowsPerPage = 50;
const totalPages = 4; // จากปุ่มที่มี 1-4

document.addEventListener("DOMContentLoaded", () => {
    renderLeaderboard(1);
    
    // ตั้งค่า Event Listener ให้ปุ่มลูกศร
    document.getElementById("prevBtn").addEventListener("click", () => {
        if (currentPage > 1) changePage(currentPage - 1);
    });

    document.getElementById("nextBtn").addEventListener("click", () => {
        if (currentPage < totalPages) changePage(currentPage + 1);
    });
});

function renderLeaderboard(page) {
    const listContainer = document.getElementById("leaderboardList");
    listContainer.innerHTML = "";
    
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = allPlayers.slice(start, end);

    pageData.forEach(player => {
        const row = document.createElement("div");
        
        let rankClass = "";
        if(player.place === 1) rankClass = "top-1";
        else if(player.place === 2) rankClass = "top-2";
        else if(player.place === 3) rankClass = "top-3";

        row.className = `player-row ${rankClass}`;
        
        row.innerHTML = `
            <div class="col-place"><span class="place-badge">${player.place}</span></div>
            <div class="col-name">
                <img src="${player.avatar}" class="user-avatar-sm" alt="profile">
                <span>${player.username}</span>
            </div>
            <div class="col-score">${player.score}</div>
            <div class="col-ranking">${player.ranking}</div>
        `;
        listContainer.appendChild(row);
    });
}

function changePage(pageNum) {
    currentPage = pageNum;
    
    // อัปเดตสถานะปุ่มตัวเลข
    document.querySelectorAll(".page-btn").forEach((btn, idx) => {
        btn.classList.toggle("active", idx + 1 === pageNum);
    });

    // อัปเดตความจางของลูกศร (Optional: เพื่อบอกว่ากดต่อไม่ได้แล้ว)
    document.getElementById("prevBtn").style.opacity = currentPage === 1 ? "0.3" : "1";
    document.getElementById("nextBtn").style.opacity = currentPage === totalPages ? "0.3" : "1";

    renderLeaderboard(pageNum);
    
    // เลื่อนกลับไปด้านบนของ Card เมื่อเปลี่ยนหน้า
    document.querySelector('.leaderboard-card').scrollIntoView({ behavior: 'smooth' });
}
// สลับหน้าเมนู Bottom Nav
function setActive(el) {
    const items = document.querySelectorAll(".nav-item");
    items.forEach(item => item.classList.remove("active"));
    el.classList.add("active");
}