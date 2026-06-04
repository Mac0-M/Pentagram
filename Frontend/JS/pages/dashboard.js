/* =========================================
   dashboard.js
   ========================================= */

const getAvatarSrc = window.getPentagramAvatarSrc || ((avatarUrl) => String(avatarUrl || "").trim() || window.PENTAGRAM_DEFAULT_AVATAR || "../assets/logo.png");

let allPlayers = []; 
let currentPage = 1;
const rowsPerPage = 50;
let totalPages = 1;

document.addEventListener("DOMContentLoaded", async () => {
    await fetchLeaderboardData();
    
    // ตั้งค่า Event Listener ให้ปุ่มลูกศร
    const prevBtn = document.getElementById("prevBtn");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                renderLeaderboard(currentPage);
            }
        });
    }

    const nextBtn = document.getElementById("nextBtn");
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderLeaderboard(currentPage);
            }
        });
    }
});

async function fetchLeaderboardData() {
    try {
        const response = await fetch('/api/get-friend-scores');
        const data = await response.json();
        
        console.log("ข้อมูลที่ได้รับจาก API:", data);

        const playersArray = Array.isArray(data) ? data : (data.scores || []);

        // เรียงลำดับจากคะแนนสูงสุดไปน้อยสุด
        playersArray.sort((a, b) => b.score - a.score);

        allPlayers = playersArray.map((player, index) => ({
            ...player,
            place: index + 1
        }));

        totalPages = Math.ceil(allPlayers.length / rowsPerPage) || 1;

        renderLeaderboard(1);
    } catch (error) {
        console.error("Error fetching leaderboard data:", error);
    }
}

function renderLeaderboard(page) {
    const listContainer = document.getElementById("leaderboardList");
    listContainer.innerHTML = "";
    
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = allPlayers.slice(start, end);

    pageData.forEach(player => {
        const row = document.createElement("div");
        
        let rankClass = "";
        let placeDisplay = player.place;
        
        // แยกเงื่อนไขคลาสของแต่ละอันดับ
        if(player.place === 1) {
            rankClass = "top-1";
            placeDisplay = `<i class="fas fa-crown"></i> 1`; // ที่ 1 มีมงกุฎ
        } else if(player.place === 2) {
            rankClass = "top-2";
        } else if(player.place === 3) {
            rankClass = "top-3";
        } else if(player.place >= 4 && player.place <= 10) {
            rankClass = "top-4-10"; // ที่ 4-10 จะมีขอบฟ้าเรืองแสง
        }

        // 🔥 เพิ่ม onclick ตรงนี้ เพื่อให้คลิกที่แถวแล้วไปหน้า profile.html
        row.className = `player-row ${rankClass}`;
        row.onclick = () => {
            // ส่งค่าชื่อผู้เล่นไปด้วยผ่าน URL Parameter ก็ได้ (เช่น ?username=ProPlayer_1)
            window.location.href = `profile.html?username=${player.username}`; 
        };
        
        row.innerHTML = `
            <div class="col-place">${placeDisplay}</div>
            <div class="col-name">
                <img src="${getAvatarSrc(player.avatar)}" class="user-avatar-sm" alt="profile">
                <span>${player.username}</span>
            </div>
            <div class="col-score">${player.score.toLocaleString()}</div>
            <div class="col-ranking">${player.ranking}</div>
        `;
        
        listContainer.appendChild(row);
    });

    renderPagination();
}

// สร้างปุ่มเลขหน้า 1, 2, 3, 4
function renderPagination() {
    const pageContainer = document.querySelector(".page-numbers");
    pageContainer.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.className = `page-btn ${i === currentPage ? "active" : ""}`;
        btn.innerText = i;
        btn.onclick = () => {
            currentPage = i;
            renderLeaderboard(currentPage);
            // 🔥 เลื่อนกลับไปบนสุดเวลาเปลี่ยนหน้า
            document.querySelector('.leaderboard-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        pageContainer.appendChild(btn);
    }
}