const PROFILE_IMAGE_URL = "https://i.pravatar.cc/150?img="; 

function getRankFromScore(score) {
    if (score >= 950) return "Challenger";
    if (score >= 850) return "Grandmaster";
    if (score >= 750) return "Master";
    if (score >= 650) return "Diamond";
    if (score >= 550) return "Emerald";
    if (score >= 450) return "Platinum";
    if (score >= 350) return "Gold";
    if (score >= 250) return "Silver";
    if (score >= 150) return "Bronze";
    return "Iron";
}

let allPlayers = []; 
let currentPage = 1;
const rowsPerPage = 50;

document.addEventListener("DOMContentLoaded", async () => {
    await fetchLeaderboardData();
});

async function fetchLeaderboardData() {
    try {
        const response = await fetch('http://localhost:3000/api/get-friend-scores');
        const data = await response.json();
        
        // ใส่ค่า place
        allPlayers = data.map((player, index) => ({
            ...player,
            place: index + 1
        }));

        renderLeaderboard(1);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function renderLeaderboard(page) {
    const listContainer = document.getElementById("leaderboardList");
    if (!listContainer) return;
    listContainer.innerHTML = "";
    
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = allPlayers.slice(start, end);

    pageData.forEach(player => {
        const row = document.createElement("div");
        let rankClass = player.place <= 3 ? `top-${player.place}` : (player.place <= 10 ? "top-4-10" : "");
        let placeDisplay = player.place === 1 ? `<i class="fas fa-crown"></i> 1` : player.place;

        row.className = `player-row ${rankClass}`;
        row.onclick = () => window.location.href = `profile.html?user=${player.username}`; 
        
        row.innerHTML = `
            <div class="col-place">${placeDisplay}</div>
            <div class="col-name">
                <img src="${player.avatar}" class="user-avatar-sm" alt="profile">
                <span>${player.username}</span>
            </div>
            <div class="col-score">${player.score.toLocaleString()}</div>
            <div class="col-ranking">${player.ranking}</div>
        `;
        listContainer.appendChild(row);
    });

    renderPagination();
}

function renderPagination() {
    const pageContainer = document.querySelector(".page-numbers");
    if (!pageContainer) return;
    pageContainer.innerHTML = "";
    const totalPages = Math.ceil(allPlayers.length / rowsPerPage);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.className = `page-btn ${i === currentPage ? "active" : ""}`;
        btn.innerText = i;
        btn.onclick = () => {
            currentPage = i;
            renderLeaderboard(currentPage);
            document.querySelector('.leaderboard-card')?.scrollIntoView({ behavior: 'smooth' });
        };
        pageContainer.appendChild(btn);
    }
}