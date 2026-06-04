const currentUserId = localStorage.getItem("username") || "";
const FALLBACK_ASSET = "../assets/logo.png";
const PAGE_CONTEXT = window.PentagramPageContext || {};
const API_BASE_URL = window.location.origin || "http://localhost:3000";
const LOCAL_USERNAME = localStorage.getItem("username") || "";

// Register Service Worker for Persistent L2 Caching & Offline Support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service_worker.js')
            .then(reg => console.log('Pentagram Service Worker registered successfully via Profile on scope:', reg.scope))
            .catch(err => console.warn('Pentagram Service Worker registration failed via Profile:', err));
    });
}

function setActive(element) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });
  element.classList.add("active");
}

/* ================= Profile Summary Logic ================= */
const profileData = {
  username: "Username",
  shareId: "",
  avatar: "",
  verified: false,
  lolId: "-",
  dotaId: "-",
  skillTags: [],
  trophies: [],
  achievements: []
};
window.profileData = profileData;

function getResolvedProfileUsername() {
  return PAGE_CONTEXT.profileUsername || LOCAL_USERNAME || profileData.username;
}

profileData.username = getResolvedProfileUsername();

function updateVerificationCardVisibility(isVerified) {
  const verificationCard = document.getElementById("game-verification-card");
  if (!verificationCard) return;

  const isOwnerProfile = Boolean(PAGE_CONTEXT.isOwnerProfile);
  const shouldShow = isOwnerProfile && !isVerified;

  verificationCard.hidden = !shouldShow;
  verificationCard.style.display = shouldShow ? "block" : "none";

  if (shouldShow) {
    verificationCard.removeAttribute("aria-hidden");
  } else {
    verificationCard.setAttribute("aria-hidden", "true");
  }
}

// ฟังก์ชัน renderProfileSummary ใช้ตัวเดิมได้เลยครับ เพราะมันดึงค่าจาก profileData.username อยู่แล้ว
function renderProfileSummary(data) {
  const usernameEl = document.getElementById("username");
  const avatarImg = document.getElementById("profileAvatar");
  const defaultSvg = document.getElementById("defaultAvatarSvg");
  const verifiedEl = document.getElementById("verifiedBadge");
  const verifiedTextEl = verifiedEl ? verifiedEl.querySelector("span") : null;
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
  if (verifiedTextEl) {
    verifiedTextEl.textContent = data.verified ? "Game ID Verified" : "Game ID Not Verified";
  }

  // ซ่อนฟอร์มยืนยันถ้าเป็น Verified แล้ว
  updateVerificationCardVisibility(Boolean(data.verified));

  // Avatar Upload Logic
  const avatarUploadOverlay = document.getElementById("avatarUploadOverlay");
  const avatarUploadInput = document.getElementById("avatarUploadInput");
  if (avatarUploadOverlay && avatarUploadInput) {
    if (PAGE_CONTEXT.isOwnerProfile) {
      avatarUploadOverlay.hidden = false;
      avatarUploadOverlay.removeAttribute("aria-hidden");
      avatarUploadInput.disabled = false;

      avatarUploadInput.onchange = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("avatar", file);
        formData.append("username", data.username);

        try {
          const res = await fetch(`${API_BASE_URL}/api/profile/upload-avatar`, {
            method: "POST",
            body: formData
          });
          const result = await res.json();
          if (res.ok) {
            avatarImg.src = result.avatarUrl;
            avatarImg.style.display = "block";
            defaultSvg.style.display = "none";
            alert("อัปโหลดรูปโปรไฟล์เรียบร้อย");
          } else {
            alert(result.error || "เกิดข้อผิดพลาดในการอัปโหลด");
          }
        } catch (err) {
          alert("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้");
        }
      };
    } else {
      avatarUploadOverlay.hidden = true;
      avatarUploadOverlay.setAttribute("aria-hidden", "true");
      avatarUploadInput.disabled = true;
    }
  }
}


async function loadProfileData() {
  // ถ้ามาจาก share-profile.html จะมี profileShareId ใน PAGE_CONTEXT
  const shareId = PAGE_CONTEXT.profileShareId || "";
  if (!shareId) {
    renderProfileNotFound();
    return null;
  }

  const fetchUrl = `${API_BASE_URL}/api/share/${encodeURIComponent(shareId)}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      // ถ้า 404 หรือ token ผิด — แสดง error overlay
      if (response.status === 404) {
        renderProfileNotFound();
        return null;
      }
      throw new Error(`Profile lookup failed with ${response.status}`);
    }
    const data = await response.json();
    profileData.username = data.username || profileData.username;
    profileData.shareId = data.shareId || "";
    profileData.avatar = data.avatar || profileData.avatar;
    profileData.verified = Boolean(data.verified);
    profileData.lolId = data.lolId || profileData.lolId;
    profileData.dotaId = data.dotaId || profileData.dotaId;
    profileData.skillTags = normalizeSkillTags(data.skillTags);
    profileData.trophies = normalizeMediaItems(data.trophies);
    profileData.achievements = normalizeMediaItems(data.achievements);
    profileData.activityData = data.activityData || {};
    focusCalendarOnLatestActivity(profileData.activityData);

    // ✨ อัปเดต crossGameStatusData จากข้อมูลจริงที่ได้มาจาก API
    // โดยเช็คว่า verified === true ก่อนจึงแสดงคะแนน
    if (data.crossGameStatus) {
      if (profileData.verified) {
        // ถ้า verified เป็น true ให้แสดงคะแนนจริง
        crossGameStatusData.mobaScore = data.crossGameStatus.mobaScore ?? 0;
        crossGameStatusData.rank = data.crossGameStatus.rank ?? "Unranked";
        crossGameStatusData.rankSkill = data.crossGameStatus.rankSkill ?? 0;
        crossGameStatusData.winEfficiency = data.crossGameStatus.winEfficiency ?? 0;
        crossGameStatusData.combatPerformance = data.crossGameStatus.combatPerformance ?? 0;
        crossGameStatusData.economySkill = data.crossGameStatus.economySkill ?? 0;
      } else {
        // ถ้า verified เป็น false ให้แสดง "-" (placeholder)
        crossGameStatusData.mobaScore = null;
        crossGameStatusData.rank = null;
        crossGameStatusData.rankSkill = null;
        crossGameStatusData.winEfficiency = null;
        crossGameStatusData.combatPerformance = null;
        crossGameStatusData.economySkill = null;
      }
    }

    // บันทึก Game ID ที่ user ใส่ไว้ในหน้า Profile ลง sessionStorage
    // เพื่อให้หน้า Game Detail ดึงไปใช้ผ่าน getActiveGameIds() โดยไม่ต้อง hardcode
    if (data.lolId && data.lolId !== '-') sessionStorage.setItem('pentagram_active_lol_id', data.lolId);
    if (data.dotaId && data.dotaId !== '-') sessionStorage.setItem('pentagram_active_dota_id', data.dotaId);
    renderProfileSummary(profileData);
    renderCrossGameStatus(crossGameStatusData);
    renderSkillTags(profileData.skillTags);
    renderTrophyCollection(profileData.trophies);
    renderAchievementCollection(profileData.achievements);
    loadCalendar(currentCalYear, currentCalMonth);
    return data;
  } catch (error) {
    renderProfileSummary(profileData);
    renderSkillTags(profileData.skillTags);
    renderTrophyCollection(profileData.trophies);
    renderAchievementCollection(profileData.achievements);
    return null;
  }
}

// แสดง overlay เมื่อ share token ผิดหรือไม่มีในระบบ
function renderProfileNotFound() {
  const main = document.querySelector('.main-content');
  if (!main) return;
  main.innerHTML = `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 60vh; gap: 16px;
      color: var(--text-secondary, #aaa); text-align: center; padding: 40px;
    ">
      <i class="fas fa-user-slash" style="font-size: 3rem; opacity: 0.4;"></i>
      <h2 style="margin: 0; font-size: 1.4rem;">Profile not found</h2>
      <p style="margin: 0; font-size: 0.95rem; opacity: 0.7;">
        This profile link is no longer valid or has been revoked.
      </p>
    </div>
  `;
}


/* ================= Consistency Calendar Worker Logic ================= */
// เรียก Worker แค่ไฟล์เดียว
const consisWorker = new Worker('../JS/workers/profile-worker.js');

let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

function focusCalendarOnLatestActivity(activityData) {
  if (!activityData || typeof activityData !== 'object') return false;

  const activityDates = Object.keys(activityData).filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey));
  if (activityDates.length === 0) return false;

  activityDates.sort();
  const latestDate = activityDates[activityDates.length - 1];
  const [year, month] = latestDate.split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return false;

  currentCalYear = year;
  currentCalMonth = month - 1;
  return true;
}

// 1. รับค่าที่ Worker คำนวณเสร็จแล้วนำมาแสดงผล
consisWorker.onmessage = function (e) {
  const { type, payload } = e.data;
  if (type === 'RENDER_CALENDAR') {
    renderCalendarUI(payload.calendarDays, payload.year, payload.month);
  }
};

// 2. ฟังก์ชันสั่งให้ Worker คำนวณใหม่เมื่อเปลี่ยนเดือน
function loadCalendar(year, month) {
  const activityData = profileData.activityData && Object.keys(profileData.activityData).length > 0
    ? profileData.activityData
    : null;

  if (!activityData) {
    renderCalendarEmptyState();
    return;
  }

  consisWorker.postMessage({
    type: 'CALCULATE_MONTH_CALENDAR',
    payload: { activityData, year: year, month: month }
  });
}

function renderCalendarEmptyState(message = 'No game activity synced yet') {
  const grid = document.getElementById('calendar-cells');
  const title = document.getElementById('calendar-month-title');

  if (title) {
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    title.textContent = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }

  if (!grid) return;

  grid.innerHTML = `
    <div class="calendar-empty-state">
    <span class="calendar-empty-title">No game activity synced yet</span>
    <span class="calendar-empty-copy">Connect and verify a game account, then sync matches to populate this calendar.</span>
    </div>
  `;
}

// 3. ฟังก์ชันวาด UI
function renderCalendarUI(days, year, month) {
  const grid = document.getElementById('calendar-cells');
  const title = document.getElementById('calendar-month-title');

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  title.textContent = `${monthNames[month]} ${year}`;

  grid.innerHTML = '';

  days.forEach(day => {
    const cell = document.createElement('div');
    if (day.date) {
      cell.className = `calendar-cell ${day.colorClass}`;
      cell.title = `${day.date}: ${day.count} matches`;
      cell.textContent = day.dayNum; // แสดงเลขวันที่
    } else {
      cell.className = 'calendar-cell level-empty';
    }
    grid.appendChild(cell);
  });
}

// 4. ติด Event Listener ให้ปุ่มเลื่อนเดือน
document.getElementById('prevMonth').addEventListener('click', () => {
  currentCalMonth--;
  if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; }
  loadCalendar(currentCalYear, currentCalMonth);
});

document.getElementById('nextMonth').addEventListener('click', () => {
  currentCalMonth++;
  if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; }
  loadCalendar(currentCalYear, currentCalMonth);
});

// เริ่มโหลดปฏิทินของเดือนปัจจุบัน
loadCalendar(currentCalYear, currentCalMonth);

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
  // ✨ แสดง "-" เมื่อค่าเป็น null หรือ undefined (เช่น กรณี verified=false)
  document.getElementById("mobaScoreValue").textContent = data.mobaScore != null ? data.mobaScore : "-";
  document.getElementById("mobaRankBadge").textContent = data.rank || "-";
  document.getElementById("rankSkillValue").textContent = data.rankSkill != null ? data.rankSkill : "-";
  document.getElementById("winEfficiencyValue").textContent = data.winEfficiency != null ? data.winEfficiency : "-";
  document.getElementById("combatPerformanceValue").textContent = data.combatPerformance != null ? data.combatPerformance : "-";
  document.getElementById("economySkillValue").textContent = data.economySkill != null ? data.economySkill : "-";
}

/* ================= Skill Tags ================= */
const skillTagCatalog = [
  {
    title: "Role & Lane",
    tags: ["Carry", "Mid Lane", "Offlane", "Support", "Roamer", "Jungler"]
  },
  {
    title: "Macro & Map",
    tags: ["Map Awareness", "Vision Control", "Rotation", "Objective Control", "Wave Management", "Shotcalling"]
  },
  {
    title: "Combat & Tempo",
    tags: ["Aggressive", "Teamfight", "Initiator", "Clutch Plays", "Counter Engage", "Pick Off"]
  },
  {
    title: "Economy & Mechanics",
    tags: ["Farming", "Last Hit", "Lane Dominance", "Resource Management", "Combo Execution", "Spell Timing"]
  }
];

function normalizeSkillTags(tags) {
  return Array.from(new Set((Array.isArray(tags) ? tags : []).map(tag => String(tag).trim()).filter(Boolean)));
}

function renderSkillTags(data) {
  const selectedTags = normalizeSkillTags(data);
  const selectedContainer = document.getElementById("selectedSkillTags");
  const selectorContainer = document.getElementById("skillSelectorGroups");
  const saveButton = document.getElementById("saveSkillsBtn");

  if (selectedContainer) {
    selectedContainer.innerHTML = "";

    if (selectedTags.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "selected-skill-empty";
      emptyState.textContent = "No skills selected yet";
      selectedContainer.appendChild(emptyState);
    } else {
      selectedTags.forEach(tag => {
        const chip = document.createElement("span");
        chip.className = "selected-skill-chip";
        chip.textContent = tag;
        selectedContainer.appendChild(chip);
      });
    }
  }

  if (selectorContainer) {
    selectorContainer.innerHTML = "";

    skillTagCatalog.forEach(group => {
      const groupCard = document.createElement("section");
      groupCard.className = "skill-category-card";

      const groupTitle = document.createElement("h4");
      groupTitle.className = "skill-category-title";
      groupTitle.textContent = group.title;
      groupCard.appendChild(groupTitle);

      const chipGrid = document.createElement("div");
      chipGrid.className = "skill-chip-grid";

      group.tags.forEach(tag => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `skill-chip ${selectedTags.includes(tag) ? "active" : ""}`;
        button.textContent = tag;
        button.dataset.skillTag = tag;
        chipGrid.appendChild(button);
      });

      groupCard.appendChild(chipGrid);
      selectorContainer.appendChild(groupCard);
    });
  }

  if (saveButton) {
    saveButton.hidden = !Boolean(PAGE_CONTEXT.isOwnerProfile);
  }
}

function toggleSkillTag(tag) {
  if (!PAGE_CONTEXT.isOwnerProfile) return;

  const normalizedTag = String(tag || "").trim();
  if (!normalizedTag) return;

  const selectedTags = new Set(normalizeSkillTags(profileData.skillTags));
  if (selectedTags.has(normalizedTag)) {
    selectedTags.delete(normalizedTag);
  } else {
    selectedTags.add(normalizedTag);
  }

  profileData.skillTags = Array.from(selectedTags);
  renderSkillTags(profileData.skillTags);
}

async function saveSkillTags() {
  if (!PAGE_CONTEXT.isOwnerProfile) return;

  const saveButton = document.getElementById("saveSkillsBtn");
  const username = getResolvedProfileUsername();

  if (!username) {
    alert("ไม่พบ Username สำหรับบันทึก Skill Tags");
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/update-skills`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, skillTags: normalizeSkillTags(profileData.skillTags) })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to save skills");
    }

    profileData.skillTags = normalizeSkillTags(result.skillTags);
    renderSkillTags(profileData.skillTags);
    alert("Saved skills successfully");
  } catch (error) {
    alert(error.message || "ไม่สามารถบันทึก Skill Tags ได้");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save Skills";
    }
  }
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

  if (!rowsContainer || !legendContainer) return;

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

/* ================= Trophies & Achievements ================= */
const MAX_MEDIA_ITEMS = 10;
const mediaModalState = {
  kind: "trophy"
};

function normalizeMediaItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      image: String(item?.image || "").trim(),
      text: String(item?.text || "").trim()
    }))
    .filter((item) => item.image || item.text)
    .slice(0, MAX_MEDIA_ITEMS);
}

function getMediaLabel(kind) {
  return kind === "achievement" ? "Achievement" : "Trophy";
}

function getMediaField(kind) {
  return kind === "achievement" ? "achievements" : "trophies";
}

function getMediaContainer(kind) {
  return kind === "achievement" ? document.getElementById("achievementsCard") : document.getElementById("trophyGrid");
}

function openMediaModal(kind) {
  const modal = document.getElementById("mediaModal");
  const title = document.getElementById("mediaModalTitle");
  const copy = document.getElementById("mediaModalCopy");
  const kindInput = document.getElementById("mediaKindInput");
  const tabs = document.querySelectorAll(".media-modal-tab");
  const fileInput = document.getElementById("mediaImageInput");
  const textInput = document.getElementById("mediaTextInput");

  if (!modal || !title || !copy || !kindInput) return;

  mediaModalState.kind = kind;
  kindInput.value = kind;
  title.textContent = `Add ${getMediaLabel(kind)}`;
  copy.textContent = `Upload an image and caption for a ${getMediaLabel(kind).toLowerCase()}.`;

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mediaKind === kind);
  });

  if (fileInput) fileInput.value = "";
  if (textInput) textInput.value = "";

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeMediaModal() {
  const modal = document.getElementById("mediaModal");
  if (!modal) return;

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "auto";
}

function createMediaCard(item, kind) {
  const card = document.createElement("article");
  card.className = `media-card ${kind}-card`;

  const imageWrap = document.createElement("div");
  imageWrap.className = "media-card-image-wrap";

  const image = document.createElement("img");
  image.className = `media-card-image ${kind === "achievement" ? "achievement-image" : "trophy-image"}`;
  image.src = item.image && item.image.trim() !== "" ? item.image : FALLBACK_ASSET;
  image.alt = `${getMediaLabel(kind)} image`;
  imageWrap.appendChild(image);

  const text = document.createElement("div");
  text.className = "media-card-text";
  text.innerHTML = (item.text || "").replace(/\n/g, "<br>");

  card.appendChild(imageWrap);
  card.appendChild(text);

  return card;
}

function createAddMediaCard(kind, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "media-add-card";
  button.dataset.openMediaKind = kind;
  button.innerHTML = `
    <span class="media-add-plus">+</span>
    <span class="media-add-label">${label}</span>
  `;
  return button;
}

function renderTrophyCollection(items) {
  const container = getMediaContainer("trophy");
  if (!container) return;

  const list = normalizeMediaItems(items);
  container.innerHTML = "";

  if (list.length === 0 && !PAGE_CONTEXT.isOwnerProfile) {
    const emptyState = document.createElement("div");
    emptyState.className = "media-empty-state";
    emptyState.textContent = "No trophies yet";
    container.appendChild(emptyState);
    return;
  }

  list.forEach((item) => {
    container.appendChild(createMediaCard(item, "trophy"));
  });

  if (PAGE_CONTEXT.isOwnerProfile && list.length < MAX_MEDIA_ITEMS) {
    container.appendChild(createAddMediaCard("trophy", "+ Add Trophy"));
  }
}

function renderAchievementCollection(items) {
  const container = getMediaContainer("achievement");
  if (!container) return;

  const list = normalizeMediaItems(items);
  container.innerHTML = "";

  if (list.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "media-empty-state";
    emptyState.textContent = "No achievements yet";
    container.appendChild(emptyState);
    return;
  }

  list.forEach((item) => {
    const card = createMediaCard(item, "achievement");
    card.classList.add("achievement-slot", "filled");
    container.appendChild(card);
  });
}

async function submitMediaForm(event) {
  event.preventDefault();

  if (!PAGE_CONTEXT.isOwnerProfile) return;

  const username = getResolvedProfileUsername();
  const kind = document.getElementById("mediaKindInput")?.value || "trophy";
  const fileInput = document.getElementById("mediaImageInput");
  const textInput = document.getElementById("mediaTextInput");
  const submitButton = document.getElementById("mediaSubmitBtn");

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert("Please choose an image first.");
    return;
  }

  const caption = String(textInput?.value || "").trim();
  if (!caption) {
    alert("Please enter a caption.");
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
  }

  const formData = new FormData();
  formData.append("username", username);
  formData.append("kind", kind);
  formData.append("text", caption);
  formData.append("image", fileInput.files[0]);

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/media`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to save media");
    }

    profileData.trophies = normalizeMediaItems(result.trophies ?? profileData.trophies);
    profileData.achievements = normalizeMediaItems(result.achievements ?? profileData.achievements);
    renderTrophyCollection(profileData.trophies);
    renderAchievementCollection(profileData.achievements);
    closeMediaModal();
  } catch (error) {
    alert(error.message || "Failed to save media");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Save";
    }
  }
}

function setupGameDetailModal() {
  const openButton = document.querySelector(".see-details-btn");
  const modal = document.getElementById("gameDetailModal");
  if (!openButton || !modal) return;

  // เมื่อคลิกปุ่ม See Details
  openButton.addEventListener("click", (e) => {
    e.preventDefault(); // กันไม่ให้เปลี่ยนหน้าไป gamedetail_dota2.html ทันที

    // บันทึก ID เกมที่ยืนยันแล้วลง sessionStorage เพื่อส่งข้ามไปหน้า gamedetail
    if (profileData.dotaId && profileData.dotaId !== "-") {
      sessionStorage.setItem('pentagram_active_dota_id', profileData.dotaId);
    }
    if (profileData.lolId && profileData.lolId !== "-") {
      sessionStorage.setItem('pentagram_active_lol_id', profileData.lolId);
    }

    // อัปเดตลิงก์ในโมดอลให้มี Query Params ด้วยเพื่อความชัวร์ 100%
    const lolLink = modal.querySelector(".game-detail-option-lol");
    const dotaLink = modal.querySelector(".game-detail-option-dota2");

    if (lolLink && profileData.lolId && profileData.lolId !== "-") {
      lolLink.href = `gamedetail_lol.html?lolId=${encodeURIComponent(profileData.lolId)}`;
    }
    if (dotaLink && profileData.dotaId && profileData.dotaId !== "-") {
      dotaLink.href = `gamedetail_dota2.html?dotaId=${encodeURIComponent(profileData.dotaId)}`;
    }

    // แสดงโมดอลให้ผู้ใช้เลือกเกม
    modal.classList.add("show");
    modal.removeAttribute("aria-hidden");
  });

  // ปุ่มปิดโมดอลทั้งหมด (ปุ่มกากบาท และพื้นหลังสีดำ)
  modal.querySelectorAll("[data-close-game-detail]").forEach(btn => {
    btn.addEventListener("click", () => {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    });
  });
}

function setupProfileActions() {
  const verificationCard = document.getElementById("game-verification-card");
  const settingsButton = document.getElementById("settings-btn");
  const shareButton = document.getElementById("share-profile-btn");
  const logoutButton = document.getElementById("logout-btn");
  const isOwnerProfile = Boolean(PAGE_CONTEXT.isOwnerProfile);

  // สร้าง URL แบบ share token — ซ่อน username ไม่ให้เห็นใน link
  function getPublicProfileUrl(shareId) {
    const base = new URL("share-profile.html", window.location.href);
    base.searchParams.set("t", shareId);
    return base.toString();
  }

  if (verificationCard) {
    updateVerificationCardVisibility(Boolean(profileData.verified));
  }

  if (settingsButton) {
    settingsButton.hidden = !isOwnerProfile;

    if (!isOwnerProfile) {
      settingsButton.setAttribute("aria-hidden", "true");
    }

    settingsButton.addEventListener("click", () => {
      if (verificationCard) {
        verificationCard.scrollIntoView({ behavior: "smooth", block: "center" });
        const firstInput = verificationCard.querySelector("input");
        if (firstInput) {
          firstInput.focus();
        }
      }
    });
  }

  if (shareButton) {
    shareButton.addEventListener("click", async () => {
      // ถ้าเป็นเจ้าของ profile: regenerate shareId ก่อนเสมอ (ล้าง link เก่า)
      // ถ้าไม่ใช่เจ้าของ: copy URL ปัจจุบันได้เลย (มี ?t= อยู่แล้ว)
      if (!isOwnerProfile) {
        const currentUrl = window.location.href;
        try {
          await navigator.clipboard.writeText(currentUrl);
          alert("Share link copied.");
        } catch (err) {
          window.prompt("Copy this share link:", currentUrl);
        }
        return;
      }

      // เจ้าของ: regenerate token ใหม่ก่อนทุกครั้ง (ล้าง link เก่า)
      const token = localStorage.getItem("token") || "";
      let shareId;
      try {
        shareButton.disabled = true;
        const res = await fetch(`${API_BASE_URL}/api/profile/regenerate-share`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Regenerate failed");
        const result = await res.json();
        shareId = result.shareId;
        profileData.shareId = shareId;
      } catch (err) {
        console.error("[Share] Failed to regenerate share token:", err);
        alert("Could not generate share link. Please try again.");
        shareButton.disabled = false;
        return;
      } finally {
        shareButton.disabled = false;
      }

      const profileUrl = getPublicProfileUrl(shareId);
      try {
        await navigator.clipboard.writeText(profileUrl);
        window.history.replaceState(null, "", profileUrl);
        alert("Share link copied. Previous links are now invalid.");
      } catch (err) {
        window.prompt("Copy this share link:", profileUrl);
      }
    });
  }

  if (logoutButton) {
    logoutButton.hidden = !isOwnerProfile;

    if (!isOwnerProfile) {
      logoutButton.setAttribute("aria-hidden", "true");
    }

    logoutButton.addEventListener("click", () => {
      const confirmed = window.confirm("Log out from this account?");
      if (!confirmed) return;

      localStorage.removeItem("token");
      localStorage.removeItem("username");
      sessionStorage.clear(); // ล้างแคชสถิติและ ID เกมทั้งหมดเพื่อต้อนรับ ID ใหม่แบบสะอาด 100%
      window.location.href = "index.html";
    });
  }
}

/* ================= Post ================= */
const postData = {
  username: "Username",
  avatar: "",
  image: FALLBACK_ASSET,
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

  if (btn.classList.contains("active")) {
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
window.addEventListener('click', function (event) {
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
  if (input.value.trim() !== "") {
    alert("Comment sent: " + input.value);
    input.value = "";
  }
}

// ปิดสิ่งต่างๆ เมื่อกดพื้นที่ว่าง
window.onclick = function (event) {
  const menu = document.getElementById('actionMenu');
  const modal = document.getElementById("commentModal");

  if (menu && event.target.className !== 'more-options' && !menu.contains(event.target)) {
    menu.style.display = 'none';
  }

  if (event.target == modal) {
    closeComments();
  }
}

// วางต่อท้ายสุดของไฟล์ profile.js
document.addEventListener('DOMContentLoaded', () => {
  const btnVerify = document.getElementById('btnVerifyGames');
  const saveSkillsBtn = document.getElementById('saveSkillsBtn');
  const mediaForm = document.getElementById('mediaForm');

  if (saveSkillsBtn) {
    saveSkillsBtn.addEventListener('click', saveSkillTags);
  }

  if (mediaForm) {
    mediaForm.addEventListener('submit', submitMediaForm);
  }

  document.addEventListener('click', (event) => {
    const openMediaButton = event.target.closest('[data-open-media-kind]');
    if (openMediaButton) {
      openMediaModal(openMediaButton.dataset.openMediaKind || 'trophy');
      return;
    }

    const closeMediaButton = event.target.closest('[data-close-media-modal]');
    if (closeMediaButton) {
      closeMediaModal();
      return;
    }

    const tabButton = event.target.closest('.media-modal-tab');
    if (tabButton) {
      document.querySelectorAll('.media-modal-tab').forEach((tab) => {
        tab.classList.toggle('active', tab === tabButton);
      });
      const kind = tabButton.dataset.mediaKind || 'trophy';
      const kindInput = document.getElementById('mediaKindInput');
      const title = document.getElementById('mediaModalTitle');
      const copy = document.getElementById('mediaModalCopy');
      if (kindInput) kindInput.value = kind;
      if (title) title.textContent = `Add ${getMediaLabel(kind)}`;
      if (copy) copy.textContent = `Upload an image and caption for a ${getMediaLabel(kind).toLowerCase()}.`;
    }
  });

  document.addEventListener('click', (event) => {
    const chipButton = event.target.closest('[data-skill-tag]');
    if (!chipButton) return;

    toggleSkillTag(chipButton.dataset.skillTag);
  });

  if (!btnVerify) return;

  btnVerify.addEventListener('click', async () => {
    const lolInputValue = document.getElementById('lolIdInput').value.trim();
    const dotaInputValue = document.getElementById('dotaIdInput').value.trim();
    const currentUsername = getResolvedProfileUsername();

    if (!lolInputValue && !dotaInputValue) {
      alert('กรุณากรอกข้อมูล ID เกมอย่างน้อย 1 เกมครับ');
      return;
    }

    btnVerify.textContent = "กำลังเชื่อมต่อ API จริง...";
    btnVerify.disabled = true;
    btnVerify.style.opacity = "0.6";

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/verify-games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername, lolId: lolInputValue, dotaId: dotaInputValue })
      });

      const data = await response.json();

      if (response.ok) {
        const cleanedWarnings = (data.warnings || []).map(w => {
          try {
            const parsed = JSON.parse(w);
            if (parsed.error) {
              if (parsed.error.includes("rate limit exceeded") || parsed.error.includes("Rate limit")) {
                return "Dota 2 API: ความถี่ในการดึงข้อมูลเกินกำหนด (Rate Limit Exceeded) กรุณาลองใหม่อีกครั้งใน 1-2 นาที";
              }
              return parsed.error;
            }
            return w;
          } catch (_) {
            return w;
          }
        });

        if (cleanedWarnings.length > 0) {
          alert(`ยืนยันบัญชีสำเร็จบางส่วน\n⚠️ ${cleanedWarnings.join('\n')}`);
        } else {
          alert('ยินดีด้วย! ยืนยันบัญชีเกมสำเร็จ บัญชีของคุณได้รับสถานะ Verified แล้ว');
        }
        loadProfileData(); // รีโหลดข้อมูลให้ติ๊กถูกขึ้นมาเลย
      } else {
        alert('เกิดข้อผิดพลาด: ' + data.error);
      }
    } catch (error) {
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลักได้');
    } finally {
      btnVerify.textContent = "ส่งข้อมูลยืนยันตัวตน";
      btnVerify.disabled = false;
      btnVerify.style.opacity = "1";
    }
  });
});

/* ================= Render All ================= */
renderCrossGameStatus(crossGameStatusData);
renderConsistency(consistencyData);
renderTrophyCollection(profileData.trophies);
renderAchievementCollection(profileData.achievements);

if (typeof renderPost === "function") {
  renderPost(postData);
}

setupGameDetailModal();
setupProfileActions();
renderSkillTags(profileData.skillTags);
loadProfileData();