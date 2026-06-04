const feedList = document.getElementById("feedList");
const commentModal = document.getElementById("commentModal");
const commentList = document.getElementById("commentList");
let currentSearchKeyword = "";
let postsData = [];
let activePostId = null;
let searchAbortController = null; // AbortController for live user search requests


// ใช้สำหรับสถานะไลก์/คอมเมนต์เท่านั้น ไม่ได้ใช้กรองว่าโพสต์ของใคร
const currentUserId = localStorage.getItem("username") || "";
const getAvatarSrc =
  window.getPentagramAvatarSrc ||
  ((avatarUrl) =>
    String(avatarUrl || "").trim() ||
    window.PENTAGRAM_DEFAULT_AVATAR ||
    "../assets/logo.png");

async function fetchPosts() {
  try {
    // หน้า home/feed ต้องแสดงโพสต์ทั้งหมดจาก backend โดยไม่กรองตาม user
    const response = await fetch(`/api/posts`);
    postsData = await response.json();
    
    // ⚡ ส่วนที่ใส่เพิ่ม: เปิดใช้งานระบบเชื่อมต่อกล่องค้นหา
    initFeedSearchEngine();
    
    // ⚡ ส่วนที่แก้ไข: เปลี่ยนจาก renderFeed() ปกติ เป็นฟังก์ชันกรองคำค้นหา
    renderFeedWithFilter();

    // ตรวจเช็คเพื่อเปิดกล่องคอมเมนต์อัตโนมัติ (Premium UX)
    const urlParams = new URLSearchParams(window.location.search);
    const autoOpenPostId = urlParams.get("postId");
    if (autoOpenPostId) {
      openComments(autoOpenPostId);
    }
  } catch (error) {
    console.error("Error fetching posts:", error);
  }
}

function renderFeed(matchedUsers = null) {
  if (!feedList) return;

  let filteredPosts;
  if (matchedUsers !== null) {
    // Filter by usernames returned from the search API
    const usernameSet = new Set(matchedUsers.map(u => u.toLowerCase()));
    filteredPosts = postsData.filter(post => usernameSet.has(post.userId.toLowerCase()));
  } else if (currentSearchKeyword) {
    // Fallback: local filter when API is unavailable
    filteredPosts = postsData.filter(post =>
      post.userId.toLowerCase().includes(currentSearchKeyword.toLowerCase())
    );
  } else {
    filteredPosts = postsData;
  }

  // Show Empty State when no matching creators found
  if (filteredPosts.length === 0) {
    feedList.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 60px 20px; font-weight: 600; background: var(--color-bg-card); border: 1px solid rgba(255,255,255,0.06); border-radius: 24px;">
        <i class="fa-solid fa-user-slash" style="font-size: 2.5rem; margin-bottom: 15px; display: block; color: var(--color-text-gold); opacity: 0.7;"></i>
        No matching creators found.
      </div>`;
    return;
  }

  // 🌟 โครงสร้างหน้ารายการการ์ดโพสต์และ Carousel ดั้งเดิมของ Punch ทั้งหมดอยู่คงเดิมตรงนี้...
  feedList.innerHTML = filteredPosts
    .map((post) => {
      const isLiked = post.likes.some((l) => l.userId === currentUserId);
      const images = post.mediaPaths;
      const userAvatar = getAvatarSrc(post.avatar);

      return `
        <article class="post-card ${post.suspended ? "suspended" : ""}" id="post_${post._id}" style="cursor: pointer;" onclick="openPostDetail('${post._id}', event)">
            <div class="post-header">
                <div class="post-user" onclick="openProfile('${post.userId}', event)">
                    <div class="post-avatar">
                        <img src="${userAvatar}" />
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
                    ${images
                      .map((img, index) => {
                        const isVideo =
                          post.mediaTypes &&
                          post.mediaTypes[index] &&
                          post.mediaTypes[index].startsWith("video/");
                        return `
                            <div class="slide">
                                ${isVideo
                                  ? `<video src="${img}" class="feed-video" autoplay loop muted playsinline controls style="width: 100%; max-height: 75vh; object-fit: contain; background: #000;"></video>`
                                  : `<img src="${img}" loading="lazy" style="width: 100%; max-height: 75vh; object-fit: contain;" />`
                                }
                            </div>
                        `;
                      })
                      .join("")}
                </div>
                ${images.length > 1
                  ? `
                    <button class="nav-btn prev" onclick="moveSlide('${post._id}', -1, event)"><i class="fa-solid fa-chevron-left"></i></button>
                    <button class="nav-btn next" onclick="moveSlide('${post._id}', 1, event)"><i class="fa-solid fa-chevron-right"></i></button>
                `
                  : ""
                }
                <i class="fa-solid fa-heart double-heart"></i>
            </div>

            <div class="post-footer">
                <div class="post-actions">
                    <div class="left-actions">
                        <button class="action-btn like-btn ${isLiked ? "active" : ""}" onclick="toggleLike('${post._id}', event)">
                            <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
                            <span id="like-count-${post._id}">${formatNumber(post.likes.length)}</span>
                        </button>
                        <button class="action-btn" onclick="openComments('${post._id}', event)">
                            <i class="fa-regular fa-comment"></i>
                            <span>${post.comments.length}</span>
                        </button>
                    </div>
                    <div class="counter">${images.length > 0 ? `1/${images.length}` : ""}</div>
                </div>
                ${images.length > 1 ? `<div class="dots">${images.map((_, i) => `<div class="dot ${i === 0 ? "active" : ""}"></div>`).join("")}</div>` : ""}
                <div class="caption">
                    <strong>${post.userId}</strong> ${post.caption}
                </div>
            </div>
        </article>
        `;
    })
    .join("");
}

fetchPosts();

async function toggleLike(postId, event) {
  if (event) event.stopPropagation();
  try {
    const response = await fetch(`/api/posts/${postId}/like`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId }),
    });
    const data = await response.json();

    const postIndex = postsData.findIndex((p) => p._id === postId);
    if (postIndex > -1) {
      postsData[postIndex].likes = data.likes;
      renderFeed();
      if (activePostId === postId) {
        openPostDetail(postId);
      }
    }
  } catch (error) {
    console.error("Like error:", error);
  }
}

function handleDoubleLike(postId, event) {
  if (event) event.stopPropagation();
  const post = postsData.find((p) => p._id === postId);
  if (!post) return;

  const postEl = document.getElementById(`post_${postId}`) || document.getElementById(`detail_post_${postId}`);
  if (postEl) {
    const heart = postEl.querySelector(".double-heart");
    if (heart) {
      heart.classList.remove("animate");
      void heart.offsetWidth;
      heart.classList.add("animate");
    }
  }

  const isLiked = post.likes.some((l) => l.userId === currentUserId);
  if (!isLiked) {
    toggleLike(postId);
  }
}

function openComments(postId, event) {
  if (event) event.stopPropagation();
  activePostId = postId;
  renderComments();
  commentModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeComments() {
  commentModal.classList.remove("active");
  document.body.style.overflow = "";
}

const closeCommentBtn = document.getElementById("closeCommentBtn");
if (closeCommentBtn) {
  closeCommentBtn.addEventListener("click", closeComments);
}
if (commentModal) {
  commentModal.addEventListener("click", (e) => {
    if (e.target === commentModal) closeComments();
  });
}

function openPostDetail(postId, event) {
  if (event) event.stopPropagation();
  activePostId = postId;

  const post = postsData.find((p) => p._id === postId);
  const detailContent = document.getElementById("postDetailContent");
  const detailModal = document.getElementById("postDetailModal");
  if (!post || !detailContent || !detailModal) return;

  const images = Array.isArray(post.mediaPaths) ? post.mediaPaths : [];
  const isLiked = Array.isArray(post.likes) && post.likes.some((l) => l.userId === currentUserId);
  const userAvatar = getAvatarSrc(post.avatar);

  detailContent.innerHTML = `
    <article class="post-card" id="detail_post_${post._id}">
      <div class="post-header">
        <div class="post-user" onclick="openProfile('${post.userId}', event)" style="cursor: pointer;">
          <div class="post-avatar">
            <img src="${userAvatar}" />
          </div>
          <div class="post-username">${post.userId}</div>
          <div class="post-time">${formatPostDate(post.createdAt)}</div>
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
            <button class="action-btn like-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${post._id}', event)">
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
  document.body.style.overflow = "hidden";
}

function closePostDetail() {
  const detailModal = document.getElementById("postDetailModal");
  if (detailModal) detailModal.classList.remove("active");
  document.body.style.overflow = "";
  activePostId = null;
}

const detailModal = document.getElementById("postDetailModal");
if (detailModal) {
  detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) closePostDetail();
  });
}

function renderComments() {
  const post = postsData.find((p) => p._id === activePostId);
  if (!post || !post.comments || !commentList) return;

  commentList.innerHTML = post.comments
    .map((comment) => {
      const likes = Array.isArray(comment.likes) ? comment.likes : [];
      const isCommentLiked = likes.includes(currentUserId);
      const userAvatar = getAvatarSrc(comment.avatar);

      return `
            <div class="comment-item">
                <img src="${userAvatar}" class="comment-avatar" onclick="openProfile('${comment.userId}', event)" style="cursor: pointer;" />
                <div class="comment-content">
                    <div>
                        <span class="comment-user" onclick="openProfile('${comment.userId}', event)" style="cursor: pointer;">${comment.userId}</span>
                        <span class="comment-text">${comment.text}</span>
                    </div>
                    <div class="comment-bottom">
                        <span class="comment-like ${isCommentLiked ? "active" : ""}" 
                              onclick="toggleCommentLike('${post._id}', '${comment._id}')">
                            <i class="${isCommentLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
                            ${likes.length > 0 ? likes.length : ""}
                        </span>
                    </div>
                </div>
            </div>
        `;
    })
    .join("");
}

const sendCommentBtn = document.getElementById("sendCommentBtn");
if (sendCommentBtn) {
  sendCommentBtn.addEventListener("click", async () => {
    const input = document.getElementById("commentInput");
    const text = input.value.trim();
    if (!text) return;

    try {
      const response = await fetch(`/api/posts/${activePostId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, text }),
      });
      const updatedComments = await response.json();

      const postIndex = postsData.findIndex((p) => p._id === activePostId);
      if (postIndex > -1) {
        postsData[postIndex].comments = updatedComments;

        input.value = "";
        renderComments();
        renderFeed();

        const detailModal = document.getElementById("postDetailModal");
        if (detailModal && detailModal.classList.contains("active")) {
          openPostDetail(activePostId);
        }
      }
    } catch (error) {
      console.error("Comment error:", error);
    }
  });
}

async function toggleCommentLike(postId, commentId) {
  try {
    const response = await fetch(
      `/api/posts/${postId}/comments/${commentId}/like`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      },
    );

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();

    const postIndex = postsData.findIndex((p) => p._id === postId);
    if (postIndex > -1) {
      const commentIndex = postsData[postIndex].comments.findIndex(
        (c) => c._id === commentId,
      );
      if (commentIndex > -1) {
        postsData[postIndex].comments[commentIndex].likes = data.likes;
        renderComments();
      }
    }
  } catch (error) {
    console.error("Comment Like error:", error);
    alert("Unable to like the comment at this time.");
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
  const postEl = document.getElementById(`post_${postId}`) || document.getElementById(`detail_post_${postId}`);
  if (!postEl) return;
  const counter = postEl.querySelector(".counter");
  if (counter) counter.innerText = `${index + 1}/${carousel.children.length}`;

  const dots = postEl.querySelectorAll(".dot");
  dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num;
}

function formatPostDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toggleMenu(postId, event) {
  if (event) event.stopPropagation();
  document.querySelectorAll(".action-menu").forEach((menu) => {
    if (menu.id !== `menu_${postId}`) menu.classList.remove("active");
  });
  const targetMenu = document.getElementById(`menu_${postId}`);
  if (targetMenu) {
    targetMenu.classList.toggle("active");
  }
}

async function reportPost(postId, event) {
  if (event) event.stopPropagation();
  try {
    const response = await fetch(`/api/posts/${postId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId })
    });
    const data = await response.json();
    if (response.ok) {
      if (data.suspended) {
        alert("This post has been suspended due to multiple user reports.");
        const postEl = document.getElementById(`post_${postId}`);
        if (postEl) postEl.classList.add("suspended");
      } else {
        alert("Thank you for your report. We will investigate it.");
      }
    } else {
      alert(data.message || "An error occurred.");
    }
    toggleMenu(postId);
  } catch (error) {
    console.error("Report error:", error);
  }
}

/**
 * 🚀 Initialise the search box with AbortController
 *
 * Flow for each keystroke:
 *  1. Abort any in-flight request from the previous keystroke.
 *  2. If the box is empty → show all posts immediately.
 *  3. Otherwise create a fresh AbortController and call
 *     GET /api/users/search?q=<keyword> with its signal.
 *  4. On success  → pass the matched username list to renderFeedWithFilter.
 *  5. On AbortError → silently ignore (a newer request is already running).
 *  6. On other errors → fall back to local filtering so the page still works.
 */
function initFeedSearchEngine() {
  const searchInput = document.getElementById("feedSearchInput");
  const clearBtn    = document.getElementById("clearSearchBtn");

  if (!searchInput) return;

  searchInput.addEventListener("input", async (e) => {
    const keyword = e.target.value.trim();

    // Show / hide the clear (×) button
    if (clearBtn) {
      clearBtn.style.display = keyword.length > 0 ? "block" : "none";
    }

    // ── Abort the previous in-flight request ─────────────────────────────
    if (searchAbortController) {
      searchAbortController.abort();
      searchAbortController = null;
    }

    // Empty box → reset and show all posts
    if (!keyword) {
      currentSearchKeyword = "";
      renderFeedWithFilter(null);
      return;
    }

    currentSearchKeyword = keyword.toLowerCase();

    // ── Create a new controller for this request ──────────────────────────
    searchAbortController = new AbortController();
    const { signal } = searchAbortController;

    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(keyword)}`,
        { signal }
      );
      if (!res.ok) throw new Error(`Search request failed: ${res.status}`);

      const matchedUsers = await res.json(); // string[]
      renderFeedWithFilter(matchedUsers);

    } catch (err) {
      if (err.name === "AbortError") {
        // Request was intentionally cancelled — a newer one is already running
        return;
      }
      console.error("[Search] Fetch error, falling back to local filter:", err);
      // Fall back to local filtering so the page stays functional
      renderFeedWithFilter(null);
    }
  });

  // Clear button: abort any pending request, reset state
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchAbortController) {
        searchAbortController.abort();
        searchAbortController = null;
      }
      searchInput.value   = "";
      currentSearchKeyword = "";
      clearBtn.style.display = "none";
      searchInput.focus();
      renderFeedWithFilter(null);
    });
  }
}

/**
 * 🎯 Bridge between the search engine and the feed renderer.
 * @param {string[] | null} matchedUsers - Usernames returned by the search API,
 *   or null to use the local keyword filter / show all posts.
 */
function renderFeedWithFilter(matchedUsers = null) {
  renderFeed(matchedUsers);
}

function openProfile(username, event) {
  if (event) event.stopPropagation();
  window.location.href = `profile.html?username=${username}`;
}
