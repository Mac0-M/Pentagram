const FALLBACK_ASSET = "../assets/logo.png";
const PAGE_CONTEXT = window.PentagramPageContext || {};
const API_BASE_URL = window.location.origin || "http://localhost:3000";
const getAvatarSrc = window.getPentagramAvatarSrc || ((avatarUrl) => String(avatarUrl || "").trim() || window.PENTAGRAM_DEFAULT_AVATAR || FALLBACK_ASSET);

console.log('[set-profile.js] Script loaded, PAGE_CONTEXT:', PAGE_CONTEXT);

function setActive(element) {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  element.classList.add("active");
}

/* ================= Profile Summary ================= */
const profileData = {
  username: "",
  shareId: "",
  avatar: "",
  verified: false,
  lolId: "-",
  dotaId: "-",
  skillTags: []
};
window.profileData = profileData;

// Edit mode state: false by default (view-only)
let isEditMode = false;
Object.defineProperty(window, '_pentagramIsEditMode', {
  get: () => isEditMode,
  set: (value) => { isEditMode = value; }
});

let profileSyncPromise = null;

function getResolvedProfileUsername() {
  const resolved = PAGE_CONTEXT.profileUsername || localStorage.getItem("username") || profileData.username;
  console.log('[getResolvedProfileUsername] PAGE_CONTEXT.profileUsername:', PAGE_CONTEXT.profileUsername, 'profileData.username:', profileData.username, '=> resolved:', resolved);
  return resolved;
}
profileData.username = getResolvedProfileUsername();

async function syncProfileMatches(username) {
  if (!username) return null;
  if (profileSyncPromise) return profileSyncPromise;

  profileSyncPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/sync-matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (result && result.activityData && typeof result.activityData === 'object') {
        window._pentagramActivityData = result.activityData;
      }
      return result;
    } catch (error) {
      console.error("syncProfileMatches error:", error);
      return null;
    } finally {
      profileSyncPromise = null;
    }
  })();

  return profileSyncPromise;
}

async function syncAndLoadProfileData() {
  const username = getResolvedProfileUsername();
  window._pentagramActivityData = {};
  await syncProfileMatches(username);
  return loadProfileData();
}

/* ================= Calendar / Consistency ================= */
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

const consistencyWorker = new Worker('../JS/workers/consistency-worker.js');
const mobaScoreWorker = new Worker('../JS/workers/moba-score-worker.js');

// ฟังก์ชันคำนวณคะแนน MOBA Skill Score บน Client-side (ใช้ Web Workers ดึงและคำนวณเบื้องหลัง)
async function computeMobaScoreLocally(dotaId, lolId) {
  console.log('[computeMobaScoreLocally] เริ่มคำนวณคะแนน MOBA Skill Score ฝั่ง Client-side สำหรับ:', dotaId, lolId);
  try {
    let dotaRaw = { matchesCount: 0, rankPercentile: 0, winEff: 50, combatPercentile: 50, economyPercentile: 50 };
    let lolRaw = { matchesCount: 0, rankPercentile: 0, winEff: 50, combatPercentile: 50, economyPercentile: 50 };

    // เรียกดึงข้อมูลสถิติ DOTA 2 ฝั่ง Client ผ่าน runWorkerTask ของ api_client.js
    if (dotaId && dotaId !== '-' && typeof window.runWorkerTask === 'function') {
      try {
        const pData = await window.runWorkerTask('dota2', 'getPlayerData', { accountId: dotaId });
        const wl = await window.runWorkerTask('dota2', 'getWinLoss', { accountId: dotaId });
        
        const winrate = wl ? parseFloat(wl.winrate) : 50;
        const matchCount = wl ? (wl.win + wl.lose) : 0;
        const confidence = 100 * Math.min(1, Math.sqrt(matchCount) / 100);
        const W = Math.min(100, Math.max(0, 50 + 4 * (winrate - 50)));
        const winEff = (0.7 * W) + (0.3 * confidence);

        const tier = pData ? pData.rank_tier : 10;
        const rankPct = Math.min(100, Math.max(10, (tier / 85) * 100));

        dotaRaw = {
          matchesCount: matchCount,
          rankPercentile: rankPct,
          winEff: winEff,
          combatPercentile: 60,
          economyPercentile: 60
        };
      } catch (dotaErr) {
        console.warn('Failed to fetch DOTA 2 stats client-side:', dotaErr);
      }
    }

    // เรียกดึงข้อมูลสถิติ LoL ฝั่ง Client ผ่าน runWorkerTask ของ api_client.js
    if (lolId && lolId !== '-' && typeof window.runWorkerTask === 'function') {
      try {
        const configLoL = { routingRegion: 'sea', region: 'sg2' };
        const pData = await window.runWorkerTask('lol', 'getPlayerData', { riotId: lolId }, configLoL);
        if (pData && pData.player_uid) {
          const rank = await window.runWorkerTask('lol', 'getRank', { puuid: pData.player_uid }, configLoL);
          const matches = await window.runWorkerTask('lol', 'getMatchIds', { puuid: pData.player_uid, count: 10 }, configLoL);
          
          let winrate = 50;
          let matchCount = matches ? matches.length : 0;
          if (rank && rank.length > 0) {
            const league = rank[0];
            const wins = league.wins || 0;
            const losses = league.losses || 0;
            const total = wins + losses;
            if (total > 0) {
              winrate = (wins / total) * 100;
              matchCount = total;
            }
          }
          const confidence = 100 * Math.min(1, Math.sqrt(matchCount) / 100);
          const W = Math.min(100, Math.max(0, 50 + 4 * (winrate - 50)));
          const winEff = (0.7 * W) + (0.3 * confidence);

          const tier = rank && rank.length > 0 ? rank[0].tier : 'IRON';
          const tierWeights = {
            'CHALLENGER': 100, 'GRANDMASTER': 95, 'MASTER': 88,
            'DIAMOND': 75, 'EMERALD': 63, 'PLATINUM': 50,
            'GOLD': 38, 'SILVER': 25, 'BRONZE': 12, 'IRON': 5
          };
          const rankPct = tierWeights[tier.toUpperCase()] || 15;

          lolRaw = {
            matchesCount: matchCount,
            rankPercentile: rankPct,
            winEff: winEff,
            combatPercentile: 65,
            economyPercentile: 65
          };
        }
      } catch (lolErr) {
        console.warn('Failed to fetch LoL stats client-side:', lolErr);
      }
    }

    // ส่งข้อมูลดิบข้ามไปให้ mobaScoreWorker ดำเนินการคำนวณเฉลี่ยถ่วงน้ำหนัก
    mobaScoreWorker.postMessage({
      type: 'COMPUTE_CROSS_GAME_STATUS',
      payload: { dotaRaw, lolRaw }
    });
  } catch (err) {
    console.error('computeMobaScoreLocally failed:', err);
  }
}

function refreshMonthCalendar() {
  loadMonthCalendar(window._pentagramActivityData || {});
}

function loadMonthCalendar(activityData) {
  const currentMonthEl = document.getElementById("calendar-month-title");
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (currentMonthEl) {
    currentMonthEl.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
  }
  consistencyWorker.postMessage({
    type: 'CALCULATE_MONTH_CALENDAR',
    payload: { activityData, year: currentCalYear, month: currentCalMonth }
  });
}

consistencyWorker.onmessage = function (e) {
  if (e.data.type === 'CALENDAR_RENDER_READY') {
    const { calendarDays } = e.data;
    const gridContainer = document.getElementById("calendar-cells");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    calendarDays.forEach(cell => {
      const cellEl = document.createElement("div");
      cellEl.className = `calendar-cell ${cell.colorClass}`;
      if (cell.date) {
        cellEl.textContent = String(cell.dayNum || "");
        cellEl.setAttribute("data-date", cell.date);
        cellEl.setAttribute("title", `${cell.date}: ${cell.count} matches`);
      }
      gridContainer.appendChild(cellEl);
    });
  }
};

mobaScoreWorker.onmessage = function (e) {
  if (e.data.type === 'MOBA_SCORE_COMPUTED') {
    renderCrossGameStatus(e.data.crossGameStatus);
  }
};

const prevMonthButton = document.getElementById('prevMonth');
const nextMonthButton = document.getElementById('nextMonth');
if (prevMonthButton) {
  prevMonthButton.addEventListener('click', () => {
    currentCalMonth--;
    if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; }
    refreshMonthCalendar();
  });
}
if (nextMonthButton) {
  nextMonthButton.addEventListener('click', () => {
    currentCalMonth++;
    if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; }
    refreshMonthCalendar();
  });
}

function renderCrossGameStatus(data) {
  if (!data) return;
  const el = (id) => document.getElementById(id);
  if (el("mobaScoreValue")) el("mobaScoreValue").textContent = data.mobaScore ?? "-";
  if (el("mobaRankBadge")) el("mobaRankBadge").textContent = data.rank || "-";
  if (el("rankSkillValue")) el("rankSkillValue").textContent = data.rankSkill ?? "-";
  if (el("winEfficiencyValue")) el("winEfficiencyValue").textContent = data.winEfficiency ?? "-";
  if (el("combatPerformanceValue")) el("combatPerformanceValue").textContent = data.combatPerformance ?? "-";
  if (el("economySkillValue")) el("economySkillValue").textContent = data.economySkill ?? "-";
}

/* ================= loadProfileData (single definition) ================= */
async function loadProfileData() {
  const currentUsername = getResolvedProfileUsername();
  if (!currentUsername) return;
  console.log('Loading profile data for:', currentUsername);

  try {
    const response = await fetch(`${API_BASE_URL}/api/public-profile/${currentUsername}`);
    console.log('[loadProfileData] API response status:', response.status, 'ok:', response.ok);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Profile data not found');
    }

    const data = await response.json();
    console.log('[loadProfileData] Raw API response data:', {
      username: data.username,
      skillTagsType: typeof data.skillTags,
      skillTagsIsArray: Array.isArray(data.skillTags),
      skillTagsLength: data.skillTags?.length,
      skillTags: data.skillTags,
      trophiesLength: data.trophies?.length,
      achievementsLength: data.achievements?.length
    });

    // 1. อัปเดตข้อมูลพื้นฐานและ Badge สถานะการยืนยันตัวตน
    profileData.username = data.username;
    profileData.shareId = data.shareId || '';
    profileData.lolId = data.lolId || '-';
    profileData.dotaId = data.dotaId || '-';
    profileData.verified = data.verified;
    profileData.avatar = data.avatar || '';

    // บันทึก Game ID ที่ user ใส่ไว้ในหน้า Profile ลง sessionStorage
    // เพื่อให้หน้า Game Detail ดึงไปใช้ผ่าน getActiveGameIds() โดยไม่ต้อง hardcode
    if (data.lolId && data.lolId !== '-') sessionStorage.setItem('pentagram_active_lol_id', data.lolId);
    if (data.dotaId && data.dotaId !== '-') sessionStorage.setItem('pentagram_active_dota_id', data.dotaId);

    // เรียกใช้ renderProfileSummary เพื่ออัปเดตรูปโปรไฟล์, ยืนยันตัวตน, lolId, dotaId แบบปลอดภัย
    renderProfileSummary(profileData);

    // 2. ดึงค่าคะแนน Cross-Game Status มาแสดงผลบนหน้า UI โดยตรง
    if (data.crossGameStatus && data.crossGameStatus.mobaScore !== null && data.crossGameStatus.mobaScore !== undefined) {
      renderCrossGameStatus(data.crossGameStatus);
    } else if (data.verified) {
      // Fallback: ใช้ Web Worker คำนวณคะแนน MOBA Skill Score ฝั่ง Client-side
      computeMobaScoreLocally(data.lolId, data.dotaId);
    }

    // 3. ส่งข้อมูลประวัติวันเวลาเล่นแมตช์จริงไปคำนวณบล็อกปฏิทินใน Web Worker
    if (data.activityData && typeof data.activityData === 'object') {
      focusCalendarOnLatestActivity(data.activityData);
      window._pentagramActivityData = data.activityData;
      loadMonthCalendar(data.activityData);
    } else {
      window._pentagramActivityData = {};
      loadMonthCalendar({});
    }

    // 4. Update trophies, achievements, and skillTags cache and render
    profileData.skillTags = Array.isArray(data.skillTags) ? data.skillTags : [];
    console.log('[loadProfileData] After setting profileData.skillTags:', {
      length: profileData.skillTags.length,
      skillTags: profileData.skillTags
    });
    renderSkillTags(profileData.skillTags);

    mediaCollectionsCache.trophy = Array.isArray(data.trophies) ? data.trophies : [];
    mediaCollectionsCache.achievement = Array.isArray(data.achievements) ? data.achievements : [];
    console.log('[loadProfileData] Updated cache:', {
      skillTagsLength: profileData.skillTags.length,
      skillTags: profileData.skillTags,
      trophiesLength: mediaCollectionsCache.trophy.length,
      achievementsLength: mediaCollectionsCache.achievement.length
    });
    renderTrophy(mediaCollectionsCache.trophy);
    renderAchievements(mediaCollectionsCache.achievement);

    // 5. โหลดโพสต์ของผู้ใช้มาแสดงในแท็บ Your Post
    await loadUserPosts(currentUsername);

  } catch (error) {
    console.error('Error loading profile:', error);
    alert('Error loading profile: ' + error.message);
    // Fallback: หากดึงคะแนนไม่สำเร็จแต่ยืนยันตัวตนไว้แล้ว ให้คำนวณฝั่ง Client-side ทันที
    if (profileData.verified) {
      computeMobaScoreLocally(profileData.lolId, profileData.dotaId);
    }
  }
}

let userPostsData = [];

async function loadUserPosts(username) {
  const container = document.getElementById("profilePostsContainer");
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/posts`);
    if (!response.ok) throw new Error("Failed to fetch posts");
    const allPosts = await response.json();

    // ฟิลเตอร์เฉพาะโพสต์ที่เป็นของ user คนนี้ และโพสต์ที่ไม่ได้ถูก suspended
    userPostsData = allPosts
      .filter(post => post.userId === username && !post.suspended)
      .map(post => ({
        ...post,
        likes: Array.isArray(post.likes) ? post.likes : [],
        comments: Array.isArray(post.comments) ? post.comments : [],
        mediaPaths: Array.isArray(post.mediaPaths) ? post.mediaPaths : []
      }));

    renderUserPosts(userPostsData);
  } catch (error) {
    console.error("Error loading user posts:", error);
    container.innerHTML = `<div style="color: #888; text-align: center; padding: 20px;">Unable to load posts.</div>`;
  }
}

function renderUserPosts(posts) {
  const container = document.getElementById("profilePostsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (posts.length === 0) {
    container.innerHTML = `<div style="color: #888; text-align: center; padding: 30px; font-weight: 500;">No posts yet.</div>`;
    return;
  }

  const currentUserId = localStorage.getItem("username") || "";

  container.innerHTML = posts.map(post => {
    const likes = Array.isArray(post.likes) ? post.likes : [];
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const images = Array.isArray(post.mediaPaths) ? post.mediaPaths : [];
    const isLiked = likes.some(l => l.userId === currentUserId);
    const userAvatar = getAvatarSrc(post.avatar);

    return `
      <article class="post-card ${post.suspended ? 'suspended' : ''}" id="post_${post._id}" style="margin-bottom: 25px; width: 100%; box-sizing: border-box; cursor: pointer;" onclick="openPostDetail('${post._id}', event)">
          <div class="post-header">
              <div class="post-user">
                  <div class="post-avatar">
                      <img src="${userAvatar}" onerror="this.src='../assets/logo.png'" />
                  </div>
                  <div class="post-username">${post.userId}</div>
                  <div class="post-time">${formatPostDate(post.createdAt)}</div>
              </div>
              <div class="menu-wrapper">
                  <button class="more-btn" onclick="toggleMenu('${post._id}', event)">
                      <i class="fa-solid fa-ellipsis"></i>
                  </button>
                  <div class="action-menu" id="menu_${post._id}">
                      <button class="action-item report" onclick="reportPost('${post._id}', event)">
                          <i class="fa-solid fa-flag"></i> Report
                      </button>
                  </div>
              </div>
          </div>

          <div class="post-media" ondblclick="handleDoubleLike('${post._id}', event)">
              <div class="carousel" id="carousel_${post._id}" onscroll="updateCounter('${post._id}')">
                  ${images.map((img, index) => {
      const isVideo = post.mediaTypes && post.mediaTypes[index] && post.mediaTypes[index].startsWith("video/");
      return `
                          <div class="slide">
                              ${isVideo
          ? `<video src="${img}" class="feed-video" autoplay loop muted playsinline controls style="width: 100%; max-height: 75vh; object-fit: contain; background: #000;"></video>`
          : `<img src="${img}" loading="lazy" style="width: 100%; max-height: 75vh; object-fit: contain;" />`
        }
                          </div>
                      `;
    }).join("")}
              </div>
              ${images.length > 1 ? `
                  <button class="nav-btn prev" onclick="moveSlide('${post._id}', -1, event)"><i class="fa-solid fa-chevron-left"></i></button>
                  <button class="nav-btn next" onclick="moveSlide('${post._id}', 1, event)"><i class="fa-solid fa-chevron-right"></i></button>
              ` : ""}
              <i class="fa-solid fa-heart double-heart"></i>
          </div>

          <div class="post-footer">
              <div class="post-actions">
                  <div class="left-actions">
                      <button class="action-btn like-btn ${isLiked ? 'active' : ''}" onclick="togglePostLike('${post._id}', event)">
                          <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                          <span id="like-count-${post._id}">${formatNumber(likes.length)}</span>
                      </button>
                      <button class="action-btn" onclick="openComments('${post._id}', event)">
                          <i class="fa-regular fa-comment"></i>
                          <span id="comment-count-${post._id}">${comments.length}</span>
                      </button>
                  </div>
                  <div class="counter">${images.length > 0 ? `1/${images.length}` : ''}</div>
              </div>
              ${images.length > 1 ? `<div class="dots">${images.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join("")}</div>` : ""}
              <div class="caption">
                  <strong>${post.userId}</strong> ${post.caption || ""}
              </div>
          </div>
      </article>
    `;
  }).join("");
}

// ================= Post Interactivity & Popup Comments (Like in Home Feeds) =================

function openComments(postId, event) {
  if (event) event.stopPropagation();
  activePostId = postId;
  renderComments();
  const commentModal = document.getElementById("commentModal");
  if (commentModal) commentModal.classList.add("active");
}

function closeComments() {
  const commentModal = document.getElementById("commentModal");
  if (commentModal) commentModal.classList.remove("active");
}

function renderComments() {
  const post = userPostsData.find(p => p._id === activePostId);
  const list = document.getElementById("commentList");
  if (!post || !list) return;

  if (post.comments.length === 0) {
    list.innerHTML = '<div style="color:#888; text-align:center; margin-top:30px; font-size:0.9rem;">No comments yet</div>';
    return;
  }

  const currentUserId = localStorage.getItem("username") || "";

  list.innerHTML = post.comments.map(c => {
    const likes = Array.isArray(c.likes) ? c.likes : [];
    const isCommentLiked = likes.includes(currentUserId);
    const commentAvatar = getAvatarSrc(c.avatar);
    return `
        <div class="comment-item">
            <img src="${commentAvatar}" class="comment-avatar" alt="avatar">
            <div class="comment-content">
                <div>
                    <span class="comment-user">${c.userId}</span>
                    <span class="comment-text">${c.text}</span>
                </div>
                <div class="comment-bottom">
                    <span class="comment-like ${isCommentLiked ? 'active' : ''}" 
                          onclick="toggleCommentLike('${post._id}', '${c._id}')">
                        <i class="${isCommentLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                        ${likes.length > 0 ? likes.length : ''}
                    </span>
                </div>
            </div>
        </div>
        `;
  }).join("");

  list.scrollTop = list.scrollHeight;
}

async function addComment() {
  const input = document.getElementById("commentInput");
  const text = input.value.trim();
  if (!text) return;

  const currentUserId = localStorage.getItem("username") || "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/posts/${activePostId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, text })
    });
    const updatedComments = await response.json();

    const postIndex = userPostsData.findIndex(p => p._id === activePostId);
    if (postIndex > -1) {
      userPostsData[postIndex].comments = updatedComments;

      // อัปเดตยอดคอมเมนต์จริงบนหน้าโปรไฟล์
      const commentCountSpan = document.getElementById(`comment-count-${activePostId}`);
      if (commentCountSpan) {
        commentCountSpan.textContent = updatedComments.length;
      }

      input.value = "";
      renderComments();
    }
  } catch (error) {
    console.error("Comment error:", error);
  }
}

async function toggleCommentLike(postId, commentId) {
  const currentUserId = localStorage.getItem("username") || "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments/${commentId}/like`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId })
    });
    const data = await response.json();

    const postIndex = userPostsData.findIndex(p => p._id === postId);
    if (postIndex > -1) {
      const commentIndex = userPostsData[postIndex].comments.findIndex(c => c._id === commentId);
      if (commentIndex > -1) {
        userPostsData[postIndex].comments[commentIndex].likes = data.likes;
        renderComments();
      }
    }
  } catch (error) {
    console.error("Comment Like error:", error);
  }
}

function openPostDetail(postId, event) {
  if (event) event.stopPropagation();
  activePostId = postId;

  const post = userPostsData.find(p => p._id === postId);
  const detailContent = document.getElementById("postDetailContent");
  const detailModal = document.getElementById("postDetailModal");
  if (!post || !detailContent || !detailModal) return;

  const images = Array.isArray(post.mediaPaths) ? post.mediaPaths : [];
  const isLiked = Array.isArray(post.likes) && post.likes.some(l => l.userId === (localStorage.getItem("username") || ""));
  const currentUserAvatar = profileData.avatar && profileData.avatar.trim() !== "" ? profileData.avatar : "../assets/logo.png";

  detailContent.innerHTML = `
    <article class="post-card" id="detail_post_${post._id}">
      <div class="post-header">
        <div class="post-user">
          <div class="post-avatar">
            <img src="${currentUserAvatar}" onerror="this.src='../assets/logo.png'" />
          </div>
          <div class="post-username">${post.userId}</div>
          <div class="post-time">${formatPostDate(post.createdAt)}</div>
        </div>
      </div>

      <div class="post-media" ondblclick="handleDoubleLike('${post._id}', event)">
        <div class="carousel" id="carousel_${post._id}" onscroll="updateCounter('${post._id}')">
          ${(images || []).map((img, index) => {
    const isVideo = post.mediaTypes && post.mediaTypes[index] && post.mediaTypes[index].startsWith("video/");
    return `
                  <div class="slide">
                      ${isVideo
        ? `<video src="${img}" class="feed-video" autoplay loop muted playsinline controls style="width: 100%; max-height: 75vh; object-fit: contain; background: #000;"></video>`
        : `<img src="${img}" loading="lazy" style="width: 100%; max-height: 75vh; object-fit: contain;" />`
      }
                  </div>
              `;
  }).join("")}
        </div>
        ${images.length > 1 ? `
          <button class="nav-btn prev" onclick="moveSlide('${post._id}', -1, event)"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="nav-btn next" onclick="moveSlide('${post._id}', 1, event)"><i class="fa-solid fa-chevron-right"></i></button>
        ` : ""}
        <i class="fa-solid fa-heart double-heart"></i>
      </div>

      <div class="post-footer">
        <div class="post-actions">
          <div class="left-actions">
            <button class="action-btn like-btn ${isLiked ? 'active' : ''}" onclick="togglePostLike('${post._id}', event)">
              <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
              <span id="like-count-${post._id}">${formatNumber(post.likes ? post.likes.length : 0)}</span>
            </button>
            <button class="action-btn" onclick="openComments('${post._id}', event)">
              <i class="fa-regular fa-comment"></i>
              <span id="comment-count-${post._id}">${post.comments ? post.comments.length : 0}</span>
            </button>
          </div>
          <div class="counter">${images.length > 0 ? `1/${images.length}` : ''}</div>
        </div>

        ${images.length > 1 ? `<div class="dots">${images.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join("")}</div>` : ""}

        <div class="caption">
          <strong>${post.userId}</strong> ${post.caption || ""}
        </div>
      </div>
    </article>
  `;

  detailModal.classList.add("active");
}

function closePostDetail() {
  const detailModal = document.getElementById("postDetailModal");
  if (detailModal) detailModal.classList.remove("active");
}

function formatPostDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatNumber(num) {
  if (!num) return 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num;
}

async function togglePostLike(postId, event) {
  if (event) event.stopPropagation();
  const currentUserId = localStorage.getItem("username") || "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId })
    });
    if (!response.ok) throw new Error("Like failed");
    const data = await response.json();

    const postIndex = userPostsData.findIndex(p => p._id === postId);
    if (postIndex > -1) {
      userPostsData[postIndex].likes = data.likes;

      // อัปเดต UI ยอดไลก์และสถานะบนตัวการ์ดจริงโดยตรงเพื่อรักษาหน้าสไลด์รูปเดิม
      const postEl = document.getElementById(`post_${postId}`);
      if (postEl) {
        const likeCountSpan = document.getElementById(`like-count-${postId}`);
        if (likeCountSpan) {
          likeCountSpan.textContent = formatNumber(data.likes.length);
        }

        const likeBtn = postEl.querySelector(".like-btn");
        if (likeBtn) {
          const isLiked = data.likes.some(l => l.userId === currentUserId);
          likeBtn.classList.toggle("active", isLiked);
          const icon = likeBtn.querySelector("i");
          if (icon) {
            icon.className = isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart";
          }
        }
      }
    }
  } catch (error) {
    console.error("Like error:", error);
  }
}

function handleDoubleLike(postId, event) {
  if (event) event.stopPropagation();
  const postEl = document.getElementById(`post_${postId}`);
  if (!postEl) return;
  const heart = postEl.querySelector(".double-heart");
  if (heart) {
    heart.classList.remove("animate");
    void heart.offsetWidth;
    heart.classList.add("animate");
  }

  const likeBtn = postEl.querySelector(".like-btn");
  if (likeBtn && !likeBtn.classList.contains("active")) {
    togglePostLike(postId);
  }
}

function moveSlide(postId, dir, event) {
  if (event) event.stopPropagation();
  const carousel = document.getElementById(`carousel_${postId}`);
  if (carousel) {
    carousel.scrollBy({ left: carousel.clientWidth * dir, behavior: "smooth" });
  }
}

function updateCounter(postId) {
  const carousel = document.getElementById(`carousel_${postId}`);
  if (!carousel) return;
  const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
  const postEl = document.getElementById(`post_${postId}`);
  if (!postEl) return;
  const counter = postEl.querySelector(".counter");
  if (counter) {
    counter.innerText = `${index + 1}/${carousel.children.length}`;
  }

  const dots = postEl.querySelectorAll(".dot");
  dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
}

function toggleMenu(postId, event) {
  if (event) event.stopPropagation();
  document.querySelectorAll(".action-menu").forEach(menu => {
    if (menu.id !== `menu_${postId}`) menu.classList.remove("active");
  });
  const targetMenu = document.getElementById(`menu_${postId}`);
  if (targetMenu) {
    targetMenu.classList.toggle("active");
  }
}

async function reportPost(postId, event) {
  if (event) event.stopPropagation();
  const currentUserId = localStorage.getItem("username") || "";
  try {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId })
    });
    const data = await response.json();
    if (response.ok) {
      if (data.suspended) {
        alert("โพสต์นี้ถูกระงับเนื่องจากได้รับรายงานจากผู้ใช้หลายราย");
        const postEl = document.getElementById(`post_${postId}`);
        if (postEl) postEl.classList.add("suspended");
      } else {
        alert("ขอบคุณที่แจ้งรายงาน เราจะดำเนินการตรวจสอบครับ");
      }
    } else {
      alert(data.message || "เกิดข้อผิดพลาด");
    }
    toggleMenu(postId);
  } catch (error) {
    console.error("Report error:", error);
  }
}

// ปิด Action menu และปิด Modal เมื่อคลิกด้านนอก
document.addEventListener("click", (e) => {
  const commentModal = document.getElementById("commentModal");
  if (commentModal && e.target === commentModal) {
    closeComments();
  }
});

// ฟังก์ชันช่วยอัปเดตความยาวแถบสถิติความสามารถ (ยืด-หด ตามคะแนนเต็ม 1000)
function updateStatProgressBar(elementId, value) {
  const bar = document.getElementById(elementId);
  if (bar) {
    const percentage = Math.min(100, Math.max(0, (value / 1000) * 100));
    bar.style.width = `${percentage}%`;
  }
}

/* ================= Skill Tags ================= */
const MASTER_SKILL_POOL = {
  "🎮 Positions & Roles": ["Mid Lane", "AD Carry", "Support", "Jungler", "Top Lane", "Offlane", "Roamer"],
  "⚡ Playstyles": ["Aggressive", "Tactical & Safe", "Shotcaller", "Farmer", "Split Pusher", "Team Player"],
  "🧠 Mindset & Attributes": ["Tilt-Proof", "Map Awareness", "High Mechanics", "Shot Execution", "Clutch Player"]
};

let selectedSkillsState = [];
window.selectedSkillsState = selectedSkillsState;

function renderSkillTags(savedSkills) {
  if (savedSkills !== undefined) {
    selectedSkillsState = Array.isArray(savedSkills) ? [...savedSkills] : [];
    window.selectedSkillsState = selectedSkillsState;
  }

  const selectedContainer = document.getElementById("selectedSkillTags");
  const selectorContainer = document.getElementById("skillSelectorGroups");
  const selectorPanel = document.querySelector(".skill-selector-panel");
  const saveBtn = document.getElementById("saveSkillsBtn");
  const copyEl = document.querySelector(".selected-skills-panel .skill-panel-copy");

  if (!selectedContainer || !selectorContainer || !selectorPanel || !saveBtn) return;

  const setSkillMode = (mode) => {
    const isEditing = mode === "edit";
    selectorPanel.hidden = !isEditing;
    selectorPanel.classList.toggle("is-collapsed", !isEditing);
    saveBtn.dataset.mode = isEditing ? "edit" : "view";
    saveBtn.textContent = isEditing ? "Save Skills" : "Edit Skills";
  };

  const renderSelectedSkills = () => {
    selectedContainer.innerHTML = "";
    if (selectedSkillsState.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "selected-skill-empty";
      emptyState.textContent = "No skills selected yet.";
      selectedContainer.appendChild(emptyState);
      return;
    }
    selectedSkillsState.forEach((skill) => {
      const chip = document.createElement("div");
      chip.className = "selected-skill-chip";
      chip.textContent = skill;
      selectedContainer.appendChild(chip);
    });
  };

  // Realtime save function - called immediately after skill selection changes
  const saveSkillsRealtime = async () => {
    const username = getResolvedProfileUsername();
    console.log('[REALTIME] saveSkillsRealtime called with username:', username, 'skills:', selectedSkillsState);

    if (!username) {
      console.error('[REALTIME] ERROR: username is empty!');
      return;
    }

    try {
      const payload = {
        username: username,
        skillTags: selectedSkillsState
      };
      console.log('[REALTIME] Sending payload:', payload);

      const response = await fetch(`${API_BASE_URL}/api/profile/update-skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log('[REALTIME] Response received - status:', response.status, 'ok:', response.ok);

      const resData = await response.json();
      if (response.ok) {
        console.log('[REALTIME] Skills saved successfully:', resData);
        profileData.skillTags = [...selectedSkillsState];
      } else {
        console.error('[REALTIME] Skills save error:', resData);
      }
    } catch (err) {
      console.error('[REALTIME] Skills save fetch error:', err);
    }
  };

  selectorContainer.innerHTML = "";

  for (const [categoryName, tags] of Object.entries(MASTER_SKILL_POOL)) {
    const categoryBlock = document.createElement("div");
    categoryBlock.className = "skill-category-card skill-category-group";
    const title = document.createElement("h4");
    title.className = "skill-category-title";
    title.textContent = categoryName;
    const chipsRow = document.createElement("div");
    chipsRow.className = "skill-chip-grid skill-chips-row";

    tags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "skill-chip skill-chip-btn";
      chip.textContent = tag;
      chip.setAttribute("aria-pressed", String(selectedSkillsState.includes(tag)));
      if (selectedSkillsState.includes(tag)) chip.classList.add("active", "active-tag");
      chip.addEventListener("click", async () => {
        if (selectedSkillsState.includes(tag)) {
          selectedSkillsState = selectedSkillsState.filter(item => item !== tag);
          window.selectedSkillsState = selectedSkillsState;
          chip.classList.remove("active", "active-tag");
          chip.setAttribute("aria-pressed", "false");
        } else {
          selectedSkillsState.push(tag);
          window.selectedSkillsState = selectedSkillsState;
          chip.classList.add("active", "active-tag");
          chip.setAttribute("aria-pressed", "true");
        }
        renderSelectedSkills();
        console.log('[REALTIME] Skill toggled:', tag, '- New state:', selectedSkillsState);
        // Save immediately in realtime
        await saveSkillsRealtime();
      });
      chipsRow.appendChild(chip);
    });

    categoryBlock.appendChild(title);
    categoryBlock.appendChild(chipsRow);
    selectorContainer.appendChild(categoryBlock);
  }

  renderSelectedSkills();

  if (copyEl) {
    if (isEditMode) {
      copyEl.textContent = "Tap chips below to toggle them on or off. Changes save automatically!";
      copyEl.style.display = "block";
    } else {
      copyEl.textContent = selectedSkillsState.length > 0 ? "Read-only skill tags." : "";
      copyEl.style.display = selectedSkillsState.length > 0 ? "block" : "none";
    }
  }

  // Only enable the selector UI when the current viewer is the owner AND edit mode is active.
  const isOwner = Boolean(PAGE_CONTEXT.isOwnerProfile);
  if (!isOwner || !isEditMode) {
    // Hide selector panel and save button in view-only mode
    selectorPanel.style.display = "none";
    saveBtn.style.display = "none";
  } else {
    selectorPanel.style.display = "block";
    saveBtn.style.display = "none"; // Hide the Save Skills button since changes now auto-save
    setSkillMode("edit");
  }

  if (!saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "true";
    saveBtn.addEventListener("click", async () => {
      if (saveBtn.dataset.mode === "view") { setSkillMode("edit"); return; }
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;
      console.log('Saving skills:', selectedSkillsState);
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile/update-skills`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: getResolvedProfileUsername(), skillTags: selectedSkillsState })
        });
        console.log('Skills API response:', { status: response.status, ok: response.ok });
        const resData = await response.json();
        if (response.ok) {
          console.log('Skills saved successfully:', resData);
          profileData.skillTags = [...selectedSkillsState];
          setSkillMode("view");
        } else {
          console.error('Skills save error:', resData);
          alert("Error: " + resData.error);
        }
      } catch (err) {
        console.error('Skills save fetch error:', err);
        alert("Unable to connect to the server");
      } finally {
        if (saveBtn.dataset.mode === "edit") saveBtn.textContent = "Save Skills";
        saveBtn.disabled = false;
      }
    });
  }
}

/* ================= Consistency (legacy renderConsistency ยังคงไว้) ================= */
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
      cell.style.background = color || "transparent";
      if (!color) cell.style.boxShadow = "none";
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

/* ================= Media (Trophy / Achievement) ================= */
let activeMediaEditIndex = null;
let activeMediaMode = 'create';
let activeMediaKind = 'trophy';
const mediaCollectionsCache = { trophy: [], achievement: [] };
const mediaManageModes = { trophy: false, achievement: false };
window.mediaCollectionsCache = mediaCollectionsCache;
window.mediaManageModes = mediaManageModes;

function getWordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function getMediaMeta(kind) {
  if (kind === 'achievement') {
    return {
      title: 'Achievement', emptyLabel: 'No achievements yet',
      emptyHint: 'Click the empty state to add one.',
      createCopy: 'Upload one image and write a caption up to 100 words.',
      editCopy: 'Update the caption or replace the image. Caption limit: 100 words.',
      cardClass: 'achievement-item-card', imageWrapClass: 'achievement-image-wrap'
    };
  }
  return {
    title: 'Trophy', emptyLabel: 'No trophies yet',
    emptyHint: 'Click the empty state to add one.',
    createCopy: 'Upload one image and write a caption up to 100 words.',
    editCopy: 'Update the caption or replace the image. Caption limit: 100 words.',
    cardClass: 'trophy-item-card', imageWrapClass: 'trophy-image-wrap'
  };
}

function setMediaModalState({ kind = 'trophy', mode = 'create', item = null, index = null } = {}) {
  const mediaModal = document.getElementById('mediaModal');
  const mediaModalTitle = document.getElementById('mediaModalTitle');
  const mediaModalCopy = document.getElementById('mediaModalCopy');
  const mediaKindInput = document.getElementById('mediaKindInput');
  const mediaTextInput = document.getElementById('mediaTextInput');
  const mediaSubmitBtn = document.getElementById('mediaSubmitBtn');
  const mediaImageInput = document.getElementById('mediaImageInput');
  const tabs = document.querySelectorAll('.media-modal-tab');
  if (!mediaModal || !mediaModalTitle || !mediaModalCopy || !mediaKindInput || !mediaTextInput || !mediaSubmitBtn || !mediaImageInput) return;

  const mediaMeta = getMediaMeta(kind);
  activeMediaEditIndex = mode === 'edit' ? index : null;
  activeMediaMode = mode;
  activeMediaKind = kind;
  mediaKindInput.value = kind;
  mediaModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  mediaModalTitle.textContent = mediaMeta.title;
  mediaModalCopy.textContent = mode === 'edit' ? mediaMeta.editCopy : mediaMeta.createCopy;
  mediaSubmitBtn.textContent = 'Save';
  mediaImageInput.required = mode !== 'edit';
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mediaKind === kind));
  mediaTextInput.value = item?.text || '';
  mediaImageInput.value = '';
}

function closeMediaModal() {
  const mediaModal = document.getElementById('mediaModal');
  const mediaForm = document.getElementById('mediaForm');
  const mediaSubmitBtn = document.getElementById('mediaSubmitBtn');
  if (!mediaModal) return;
  mediaModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = 'auto';
  activeMediaEditIndex = null;
  activeMediaMode = 'create';
  activeMediaKind = 'trophy';
  if (mediaForm) mediaForm.reset();
  if (mediaSubmitBtn) mediaSubmitBtn.textContent = 'Save';
}

function renderMediaCollection(kind, data) {
  const mediaMeta = getMediaMeta(kind);
  const container = document.getElementById(kind === 'trophy' ? 'trophyGrid' : 'achievementsCard');
  const isOwnerProfile = Boolean(PAGE_CONTEXT.isOwnerProfile);
  const isManageMode = Boolean(mediaManageModes[kind]);
  if (data !== undefined) {
    mediaCollectionsCache[kind] = Array.isArray(data) ? [...data] : [];
  }
  if (!container) return;
  container.innerHTML = '';
  const mediaItems = mediaCollectionsCache[kind];

  if (!mediaItems.length) {
    if (!isEditMode) {
      return;
    }
    const emptyState = document.createElement('div');
    emptyState.className = kind === 'trophy' ? 'trophy-empty-state' : 'achievement-empty-state';
    if (isOwnerProfile) {
      emptyState.classList.add('clickable');
      emptyState.tabIndex = 0;
      emptyState.setAttribute('role', 'button');
      emptyState.addEventListener('click', () => setMediaModalState({ kind, mode: 'create' }));
      emptyState.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setMediaModalState({ kind, mode: 'create' }); }
      });
    }
    emptyState.innerHTML = `<div class="media-empty-state"><div class="media-add-label">${mediaMeta.emptyLabel}</div><div class="collection-note">${isOwnerProfile ? mediaMeta.emptyHint : 'No items available yet.'}</div></div>`;
    container.appendChild(emptyState);
    return;
  }

  mediaItems.forEach((item, index) => {
    if (!item.image && !item.text) return;
    const mediaItem = document.createElement('div');
    mediaItem.className = `media-card ${mediaMeta.cardClass}`;
    mediaItem.innerHTML = `
      <div class="media-card-image-wrap ${mediaMeta.imageWrapClass}">
        <img class="media-card-image" src="${item.image && item.image.trim() !== '' ? item.image : FALLBACK_ASSET}" alt="${mediaMeta.title}">
      </div>
      <div class="media-card-text">${(item.text || "").replace(/\n/g, "<br>")}</div>
    `;
    if (isOwnerProfile && isManageMode) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'media-delete-btn';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!window.confirm(`Delete this ${mediaMeta.title.toLowerCase()}?`)) return;
        try {
          const response = await fetch(`${API_BASE_URL}/api/profile/media/${encodeURIComponent(getResolvedProfileUsername())}/${index}?kind=${encodeURIComponent(kind)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          });
          const result = await response.json();
          if (!response.ok) { alert(result.error || 'Unable to delete item.'); return; }
          await loadProfileData();
        } catch (error) {
          alert('Unable to connect to the server');
        }
      });
      mediaItem.appendChild(deleteButton);
    }
    container.appendChild(mediaItem);
  });
}

function renderTrophy(data) { renderMediaCollection('trophy', data); }
function renderAchievements(data) { renderMediaCollection('achievement', data); }

function setMediaManageMode(kind, enabled) {
  mediaManageModes[kind] = Boolean(enabled);
  const button = document.getElementById(kind === 'trophy' ? 'trophyManageBtn' : 'achievementManageBtn');
  const addButton = document.getElementById(kind === 'trophy' ? 'addTrophyBtn' : 'addAchievementBtn');
  if (button) {
    button.textContent = enabled ? 'Done' : 'Edit';
    button.classList.toggle('is-active', Boolean(enabled));
  }
  if (addButton) {
    // Only show add button when in edit mode AND the specific manage mode is enabled
    addButton.hidden = !enabled || !Boolean(PAGE_CONTEXT.isOwnerProfile) || !isEditMode;
  }
  renderMediaCollection(kind, mediaCollectionsCache[kind] || []);
}

function setupTrophyManager() {
  console.log('Setting up Trophy Manager...');
  const addButton = document.getElementById('addTrophyBtn');
  const addAchievementButton = document.getElementById('addAchievementBtn');
  const trophyManageBtn = document.getElementById('trophyManageBtn');
  const achievementManageBtn = document.getElementById('achievementManageBtn');
  const mediaModal = document.getElementById('mediaModal');
  const mediaForm = document.getElementById('mediaForm');
  const mediaKindInput = document.getElementById('mediaKindInput');
  const mediaTextInput = document.getElementById('mediaTextInput');
  const mediaImageInput = document.getElementById('mediaImageInput');
  const mediaSubmitBtn = document.getElementById('mediaSubmitBtn');
  const tabs = document.querySelectorAll('.media-modal-tab');
  const isOwnerProfile = Boolean(PAGE_CONTEXT.isOwnerProfile);

  console.log('Trophy Manager elements found:', {
    addButton: !!addButton,
    addAchievementButton: !!addAchievementButton,
    trophyManageBtn: !!trophyManageBtn,
    achievementManageBtn: !!achievementManageBtn,
    mediaModal: !!mediaModal,
    mediaForm: !!mediaForm,
    isOwnerProfile
  });

  // Initial state: hide collection controls until Settings (edit mode) is enabled
  if (addButton) { addButton.hidden = true; addButton.addEventListener('click', () => setMediaModalState({ kind: 'trophy', mode: 'create' })); }
  if (addAchievementButton) { addAchievementButton.hidden = true; addAchievementButton.addEventListener('click', () => setMediaModalState({ kind: 'achievement', mode: 'create' })); }
  if (trophyManageBtn) { trophyManageBtn.hidden = true; trophyManageBtn.addEventListener('click', () => setMediaManageMode('trophy', !mediaManageModes.trophy)); }
  if (achievementManageBtn) { achievementManageBtn.hidden = true; achievementManageBtn.addEventListener('click', () => setMediaManageMode('achievement', !mediaManageModes.achievement)); }
  if (mediaModal) {
    mediaModal.querySelectorAll('[data-close-media-modal]').forEach(el => el.addEventListener('click', closeMediaModal));
  }
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMediaModalState({ kind: tab.dataset.mediaKind || 'trophy', mode: 'create' }));
  });

  if (mediaForm && mediaKindInput && mediaTextInput && mediaImageInput && mediaSubmitBtn) {
    console.log('Attaching media form submit listener...');
    mediaForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const caption = mediaTextInput.value.trim();
      const imageFile = mediaImageInput.files?.[0];
      const username = getResolvedProfileUsername();
      const selectedKind = mediaKindInput.value || 'trophy';
      console.log('Media form submitted:', { username, selectedKind, caption, hasImage: !!imageFile, activeMediaMode });

      if (!imageFile && activeMediaMode !== 'edit') {
        console.error('No image provided');
        alert('Please choose an image.');
        return;
      }
      if (!caption) {
        console.error('No caption provided');
        alert('Caption is required.');
        return;
      }
      if (getWordCount(caption) > 100) {
        console.error('Caption too long');
        alert('Caption must be 100 words or fewer.');
        return;
      }

      const formData = new FormData();
      formData.append('username', username);
      formData.append('kind', selectedKind);
      formData.append('text', caption);
      if (imageFile) formData.append('image', imageFile);

      // Log FormData contents
      console.log('FormData contents:');
      for (let pair of formData.entries()) {
        if (pair[0] === 'image') {
          console.log(`  ${pair[0]}: File(name=${pair[1].name}, size=${pair[1].size})`);
        } else {
          console.log(`  ${pair[0]}: ${pair[1]}`);
        }
      }

      mediaSubmitBtn.disabled = true;
      mediaSubmitBtn.textContent = 'Saving...';

      try {
        const endpoint = activeMediaMode === 'edit' && activeMediaEditIndex !== null
          ? `${API_BASE_URL}/api/profile/media/${encodeURIComponent(username)}/${activeMediaEditIndex}`
          : `${API_BASE_URL}/api/profile/media`;
        const method = activeMediaMode === 'edit' ? 'PUT' : 'POST';

        console.log('Calling API endpoint:', endpoint, 'Method:', method);
        const response = await fetch(endpoint, { method, body: formData });

        console.log('API Response status:', response.status, 'ok:', response.ok);
        const result = await response.json();

        if (!response.ok) {
          console.error('API Error response:', result);
          alert(result.error || 'Unable to save.');
          return;
        }

        console.log('API Success response:', result);
        console.log('Save successful, reloading profile data...');
        closeMediaModal();
        await loadProfileData();
        console.log('Profile data reloaded, setting manage mode to false');
        setMediaManageMode(selectedKind, false);
      } catch (error) {
        console.error('Media save fetch error:', error);
        alert('Unable to connect to the server: ' + error.message);
      } finally {
        mediaSubmitBtn.disabled = false;
        mediaSubmitBtn.textContent = 'Save';
      }
    });
  } else {
    console.error('Media form setup failed - missing elements:', {
      mediaForm: !!mediaForm,
      mediaKindInput: !!mediaKindInput,
      mediaTextInput: !!mediaTextInput,
      mediaImageInput: !!mediaImageInput,
      mediaSubmitBtn: !!mediaSubmitBtn
    });
  }
}

function setupGameDetailModal() {
  const openButton = document.querySelector(".see-details-btn");
  if (!openButton) return;
  openButton.addEventListener("click", () => { window.location.href = "./gamedetail_dota2.html"; });
}

/* ================= Verify Games ================= */
document.addEventListener('DOMContentLoaded', () => {
  const btnVerify = document.getElementById('btnVerifyGames');
  if (!btnVerify) return;
  btnVerify.addEventListener('click', async () => {
    const lolInputValue = document.getElementById('lolIdInput')?.value.trim() || '';
    const dotaInputValue = document.getElementById('dotaIdInput')?.value.trim() || '';
    const currentUsername = getResolvedProfileUsername();
    if (!lolInputValue && !dotaInputValue) { alert('Please enter at least one game ID.'); return; }
    btnVerify.textContent = "Verifying...";
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
        const msg = cleanedWarnings.length > 0
          ? `Partial verification succeeded\n⚠️ ${cleanedWarnings.join('\n')}`
          : 'Game account verification succeeded! Verified status has been granted.';
        alert(msg);
        await syncAndLoadProfileData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Unable to connect to the server');
    } finally {
      btnVerify.textContent = "Submit verification";
      btnVerify.disabled = false;
      btnVerify.style.opacity = "1";
    }
  });
});

/* ================= Init ================= */
// Initialization deferred until DOMContentLoaded (see below)

// Ensure initialization happens after the DOM is ready so elements exist
// This prevents race conditions where scripts execute before HTML is parsed
document.addEventListener('DOMContentLoaded', () => {
  renderSkillTags([]);
  setupGameDetailModal();
  setupOwnerProfileActions();
  setupTrophyManager();
  syncAndLoadProfileData();
});