function setActive(element) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });
  element.classList.add("active");
}

/* ================= Profile Summary Logic ================= */
const profileData = {
  // เปลี่ยนจาก PENTAGRAM_USER เป็น Username
  username: "Username", 
  avatar: "", 
  verified: true,
  lolId: "ACS256977gh7779",
  dotaId: "ACS457589t5555k"
};

// ฟังก์ชัน renderProfileSummary ใช้ตัวเดิมได้เลยครับ เพราะมันดึงค่าจาก profileData.username อยู่แล้ว
function renderProfileSummary(data) {
  const usernameEl = document.getElementById("username");
  const avatarImg = document.getElementById("profileAvatar");
  const defaultSvg = document.getElementById("defaultAvatarSvg");
  const verifiedEl = document.getElementById("verifiedBadge");
  const lolIdEl = document.getElementById("lolId");
  const dotaIdEl = document.getElementById("dotaId");

  usernameEl.textContent = data.username || "Unknown User";
  lolIdEl.textContent = data.lolId || "-";
  dotaIdEl.textContent = data.dotaId || "-";

  // ตรวจสอบรูปโปรไฟล์
  if (data.avatar && data.avatar.trim() !== "") {
    avatarImg.src = data.avatar;
    avatarImg.style.display = "block";
    defaultSvg.style.display = "none";
  } else {
    // ถ้าไม่มีข้อมูล URL ให้ใช้ SVG ทันที
    avatarImg.style.display = "none";
    defaultSvg.style.display = "block";
  }

  verifiedEl.style.display = data.verified ? "flex" : "none";
}

renderProfileSummary(profileData);

/* ================= Cross Game Status ================= */
const crossGameStatusData = {
  mobaScore: 1000,
  rank: "Master",
  rankSkill: 100,
  winEfficiency: 100,
  combatPerformance: 100,
  economySkill: 100
};

function renderCrossGameStatus(data) {
  document.getElementById("mobaScoreValue").textContent = data.mobaScore ?? "-";
  document.getElementById("mobaRankBadge").textContent = data.rank || "-";
  document.getElementById("rankSkillValue").textContent = data.rankSkill ?? "-";
  document.getElementById("winEfficiencyValue").textContent = data.winEfficiency ?? "-";
  document.getElementById("combatPerformanceValue").textContent = data.combatPerformance ?? "-";
  document.getElementById("economySkillValue").textContent = data.economySkill ?? "-";
}

/* ================= Preferred Roles ================= */
const rolesData = {
  radarImage: "",
  primaryRole: "Carry",
  supportRole: "Jungle"
};

function renderRoles(data) {
  const radarImg = document.getElementById("rolesRadarImg");
  const primaryEl = document.getElementById("primaryRole");
  const supportEl = document.getElementById("supportRole");

  radarImg.src = data.radarImage && data.radarImage.trim() !== ""
    ? data.radarImage
    : "radar-placeholder.png";

  primaryEl.textContent = data.primaryRole || "-";
  supportEl.textContent = data.supportRole || "-";
}

/* ================= Skill Tags ================= */
const skillTagsData = {
  leftRole: "Carry",
  rightRole: "Tank",
  leftTags: [
    { name: "MAIN CARRY", image: "main-carry.png" },
    { name: "FARM KING", image: "farm-king.png" },
    { name: "Late Carry", image: "late-carry.png" }
  ],
  rightTags: [
    { name: "Damage Anchor", image: "damage-anchor.png" },
    { name: "Iron Body", image: "iron-body.png" },
    { name: "Iron Body", image: "iron-body2.png" }
  ]
};

function renderSkillTags(data) {
  document.getElementById("leftRoleTitle").textContent = data.leftRole || "-";
  document.getElementById("rightRoleTitle").textContent = data.rightRole || "-";

  renderTagList("leftTags", data.leftTags);
  renderTagList("rightTags", data.rightTags);
}

function renderTagList(containerId, tags) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!tags || tags.length === 0) return;

  tags.forEach(tag => {
    const div = document.createElement("div");
    div.className = "skill-tag";
    div.innerHTML = `
      <img src="${tag.image || "tag-placeholder.png"}" alt="">
      <span>${tag.name || "-"}</span>
    `;
    container.appendChild(div);
  });
}

/* ================= Consistency ================= */
const consistencyData = {
  month: "2026-04",
  weekLabels: [1, 8, 15, 22, 29],
  weeks: [
    ["#e0cf8a", "#3f7c6d", "#e0cf8a", "#114f52", "#e0cf8a", "#005d63", "#3f7c6d"],
    ["#3f7c6d", "#80936b", "#114f52", "#e0cf8a", "#3f7c6d", "#e0cf8a", "#005d63"],
    ["#114f52", "#80936b", "#114f52", "#e0cf8a", "#005d63", "#005d63", "#3f7c6d"],
    ["#005d63", "#80936b", "#e0cf8a", "#114f52", "#114f52", "#e0cf8a", "#3f7c6d"],
    ["#3f7c6d", "#005d63", "#3f7c6d", null, null, null, null]
  ],
  legend: ["#e0cf8a", "#80936b", "#3f7c6d", "#005d63"]
};

function renderConsistency(data) {
  const rowsContainer = document.getElementById("consistencyRows");
  const legendContainer = document.getElementById("legendItems");

  rowsContainer.innerHTML = "";
  legendContainer.innerHTML = "";

  data.weeks.forEach((week, rowIndex) => {
    const row = document.createElement("div");
    row.className = "consistency-row";

    const label = document.createElement("div");
    label.className = "consistency-date-label";
    label.textContent = data.weekLabels?.[rowIndex] ?? "";
    row.appendChild(label);

    const weekGrid = document.createElement("div");
    weekGrid.className = "consistency-week";

    week.forEach((color) => {
      const cell = document.createElement("div");
      cell.className = "consistency-cell";

      if (color) {
        cell.style.background = color;
      } else {
        cell.style.background = "transparent";
        cell.style.boxShadow = "none";
      }

      weekGrid.appendChild(cell);
    });

    row.appendChild(weekGrid);
    rowsContainer.appendChild(row);
  });

  data.legend.forEach((color) => {
    const item = document.createElement("span");
    item.className = "legend-box";
    item.style.background = color;
    legendContainer.appendChild(item);
  });
}

/* ================= Trophy ================= */
const trophyData = {
  image: "",
  text: "University Esports 2026\nat ACS, KMUTT\nWinner"
};

function renderTrophy(data) {
  const trophyImage = document.getElementById("trophyImage");
  const trophyText = document.getElementById("trophyText");

  trophyImage.src = data.image && data.image.trim() !== ""
    ? data.image
    : "trophy-placeholder.png";

  trophyText.innerHTML = (data.text || "").replace(/\n/g, "<br>");
}

/* ================= Achievements ================= */
const achievementsData = [
  {
    image: "",
    text: "Aegis Champions\nof DOTA 2, 2022"
  },
  {
    image: "",
    text: "Special Spring\nSeason League,\n2024"
  }
];

function renderAchievements(data) {
  const container = document.getElementById("achievementsCard");
  container.innerHTML = "";

  if (!data || data.length === 0) return;

  data.forEach((item, index) => {
    const achievementItem = document.createElement("div");
    achievementItem.className = "achievement-item";

    achievementItem.innerHTML = `
      <div class="achievement-image-wrap">
        <img
          class="achievement-image"
          src="${item.image && item.image.trim() !== "" ? item.image : "achievement-placeholder.png"}"
          alt="Achievement"
        >
      </div>

      <div class="achievement-text">
        ${(item.text || "").replace(/\n/g, "<br>")}
      </div>
    `;

    container.appendChild(achievementItem);

    if (index < data.length - 1) {
      const divider = document.createElement("div");
      divider.className = "achievement-divider";
      container.appendChild(divider);
    }
  });
}

/* ================= Post ================= */
const postData = {
  username: "Username",
  avatar: "",
  image: "post-placeholder.jpg",
  caption: "นี่คือคำบรรยายใต้โพสต์ตัวอย่างครับ",
  likeCount: "",
  commentCount: "",
  currentImage: 1,
  totalImages: 5,
  liked: false
};

// ระบบจัดการจำนวนรูปภาพ (ถ้า > 1 ถึงจะแสดง)
function setupPostImages(count) {
    const counter = document.getElementById("imgCounter");
    if (count > 1) {
        counter.innerText = `1/${count}`;
        counter.style.display = "block";
    } else {
        counter.style.display = "none";
    }
}

// สลับหน้าเมนู Bottom Nav
function setActive(el) {
    const items = document.querySelectorAll(".nav-item");
    items.forEach(item => item.classList.remove("active"));
    el.classList.add("active");
}

// ระบบ Like
function toggleLike(btn) {
    btn.classList.toggle("active");
    const countSpan = btn.querySelector(".count");
    let currentCount = parseInt(countSpan.innerText.replace(/,/g, '')) || 0;
    
    if(btn.classList.contains("active")) {
        currentCount++;
    } else {
        currentCount--;
    }
    countSpan.innerText = currentCount > 0 ? currentCount.toLocaleString() : "";
}

// ระบบ Action Menu (3 จุด)
function toggleActionMenu(btn) {
    const menu = document.getElementById('actionMenu');
    // ตรวจสอบสถานะและสลับการแสดงผล
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'block';
    }
}

// ระบบเลือก Report (กดแล้วให้หายไป)
function selectReport(item) {
    item.classList.add('selected');
    setTimeout(() => {
        alert("Reported Post!");
        document.getElementById('actionMenu').style.display = 'none';
        item.classList.remove('selected');
    }, 300);
}

// เพิ่มเติม: ปิดเมนูเมื่อคลิกที่อื่นในหน้าจอ
window.addEventListener('click', function(event) {
    const menu = document.getElementById('actionMenu');
    const btn = document.querySelector('.more-options');
    if (event.target !== btn && !menu.contains(event.target)) {
        menu.style.display = 'none';
    }
});

// ระบบ Modal คอมเมนต์
function openComments() {
    document.getElementById("commentModal").style.display = "block";
    document.body.style.overflow = "hidden";
}

function closeComments() {
    document.getElementById("commentModal").style.display = "none";
    document.body.style.overflow = "auto";
}

function sendComment() {
    const input = document.getElementById("commentInput");
    if(input.value.trim() !== "") {
        alert("Comment sent: " + input.value);
        input.value = "";
    }
}

// ปิดสิ่งต่างๆ เมื่อกดพื้นที่ว่าง
window.onclick = function(event) {
    const menu = document.getElementById('actionMenu');
    const modal = document.getElementById("commentModal");
    
    if (menu && event.target.className !== 'more-options' && !menu.contains(event.target)) {
        menu.style.display = 'none';
    }
    
    if (event.target == modal) {
        closeComments();
    }
}
/* ================= Render All ================= */
renderProfileSummary(profileData);
renderCrossGameStatus(crossGameStatusData);
renderRoles(rolesData);
renderSkillTags(skillTagsData);
renderConsistency(consistencyData);
renderTrophy(trophyData);
renderAchievements(achievementsData);
renderPost(postData);