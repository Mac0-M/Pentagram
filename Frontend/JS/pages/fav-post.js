const currentUserId = localStorage.getItem("username") || "";
const getAvatarSrc =
  window.getPentagramAvatarSrc ||
  ((avatarUrl) =>
    String(avatarUrl || "").trim() ||
    window.PENTAGRAM_DEFAULT_AVATAR ||
    "../assets/logo.png");

let likedPostsData = [];
let activePostId = null;
let currentSortType = "newest";

document.addEventListener("DOMContentLoaded", () => {
  fetchFavPosts();
  const newestRadio = document.getElementById("radio-newest");
  if (newestRadio) newestRadio.classList.add("active");
});

async function fetchFavPosts() {
  try {
    if (!currentUserId) {
      likedPostsData = [];
      sortAndRenderGrid();
      return;
    }
    const response = await fetch(`/api/posts/liked/${currentUserId}`);
    likedPostsData = await response.json();
    sortAndRenderGrid();
  } catch (error) {
    console.error("Error fetching fav posts:", error);
  }
}

function sortAndRenderGrid() {
  const gridArea = document.getElementById("favGridArea");
  if (!gridArea) return;
  gridArea.innerHTML = "";

  if (!likedPostsData || !Array.isArray(likedPostsData)) return;

  let sortedData = [...likedPostsData];

  sortedData.sort((a, b) => {
    const likesA = a && a.likes ? a.likes : [];
    const likesB = b && b.likes ? b.likes : [];
    const likeA = likesA.find((l) => l.userId === currentUserId);
    const likeB = likesB.find((l) => l.userId === currentUserId);

    const timeA = likeA?.likedAt
      ? new Date(likeA.likedAt).getTime()
      : new Date(a.createdAt).getTime();
    const timeB = likeB?.likedAt
      ? new Date(likeB.likedAt).getTime()
      : new Date(b.createdAt).getTime();

    return currentSortType === "newest" ? timeB - timeA : timeA - timeB;
  });

  sortedData.forEach((post) => {
    const imageUrl =
      post.mediaPaths && post.mediaPaths.length > 0 ? post.mediaPaths[0] : "";

    // [แก้ไขจุดที่ 1] ประกาศตัวแปรคำนวณชนิดสื่อวิดีโอ เพื่อป้องกัน ReferenceError แครชหน้าจอ
    const isVideo = post.mediaTypes && post.mediaTypes[0] && post.mediaTypes[0].startsWith("video/");
    const userAvatar = getAvatarSrc(post.avatar);

    const item = document.createElement("div");
    item.className = "fav-post-card";
    item.onclick = () => openPostDetail(post._id);
    item.innerHTML = `
            <div class="fav-post-header" onclick="openProfile('${post.userId}', event)" style="cursor: pointer;">
                <img src="${userAvatar}" class="fav-post-avatar">
                <span class="fav-post-username">${post.userId || "Unknown"}</span>
            </div>
            <div style="width: 100%; aspect-ratio: 1/1; background: #000; overflow: hidden;">
                ${isVideo
        ? `<video src="${imageUrl}" class="fav-post-image" muted autoplay loop playsinline style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"></video>`
        : `<img src="${imageUrl}" class="fav-post-image" style="width: 100%; height: 100%; object-fit: cover;">`
      }
            </div>
            <div class="fav-post-actions">
                <i class="fa-solid fa-heart" style="color: #ff3040;" onclick="toggleLike('${post._id}', event)"></i>
                <i class="fa-regular fa-comment" onclick="openComments('${post._id}', event)" role="button" tabindex="0"></i>
            </div>
            <div class="fav-post-content">
                <div class="fav-post-likes">${formatNumber(post.likes ? post.likes.length : 0)} likes</div>
                <div class="fav-post-caption"><strong>${post.userId || ""}</strong> ${post.caption || ""}</div>
            </div>
        `;
    gridArea.appendChild(item);
  });
}

function openPostDetail(postId) {
  activePostId = postId;
  const post = likedPostsData.find((p) => p._id === postId);
  if (!post) return;

  const detailContent = document.getElementById("postDetailContent");
  if (!detailContent) return;

  const images =
    post.mediaPaths && Array.isArray(post.mediaPaths) ? post.mediaPaths : [];
  const isLiked =
    Array.isArray(post.likes) &&
    post.likes.some((l) => l.userId === currentUserId);
  const userAvatar = getAvatarSrc(post.avatar);

  detailContent.innerHTML = `
        <article class="post-card" id="post_${post._id}">
            <div class="post-header">
                <div class="post-user" onclick="openProfile('${post.userId}')" style="cursor: pointer;">
                    <div class="post-avatar">
                        <img src="${userAvatar}" />
                    </div>
                    <div class="post-username">${post.userId}</div>
                    <div class="post-time">${formatPostDate(post.createdAt)}</div>
                </div>
            </div>

            <div class="post-media" ondblclick="handleDoubleLike('${post._id}')">
                <div class="carousel" id="carousel_${post._id}" onscroll="updateCounter('${post._id}')">
                    ${images
      .map((img, i) => {
        const isVideo =
          post.mediaTypes &&
          post.mediaTypes[i] &&
          post.mediaTypes[i].startsWith("video/");
        return `
                            <div class="slide" style="flex: 0 0 100%; scroll-snap-align: start; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #000;">
                                ${isVideo
            ? `<video src="${img}" autoplay loop muted playsinline controls style="width: 100%; max-height: 75vh; object-fit: contain; background: #000;"></video>`
            : `<img src="${img}" loading="lazy" style="width: 100%; max-height: 75vh; object-fit: contain;" />`
          }
                            </div>
                        `;
      })
      .join("")}
                </div>
                ${images.length > 1
      ? `
                    <button class="nav-btn prev" onclick="moveSlide('${post._id}', -1)">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <button class="nav-btn next" onclick="moveSlide('${post._id}', 1)">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
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
                            <span>${formatNumber(post.likes.length)}</span>
                        </button>
                        <button class="action-btn" onclick="openComments('${post._id}', event)">
                            <i class="fa-regular fa-comment"></i>
                            <span>${post.comments.length}</span>
                        </button>
                    </div>
                    <div class="counter">${images.length > 0 ? `1/${images.length}` : ""}</div>
                </div>

                ${images.length > 1
      ? `
                    <div class="dots">
                        ${images
        .map(
          (_, i) => `
                            <div class="dot ${i === 0 ? "active" : ""}"></div>
                        `,
        )
        .join("")}
                    </div>
                `
      : ""
    }

                <div class="caption">
                    <strong>${post.userId}</strong> ${post.caption}
                </div>
            </div>
        </article>
    `;
  const detailModal = document.getElementById("postDetailModal");
  if (detailModal) detailModal.classList.add("active");
}

async function toggleLike(postId, event) {
  if (event) event.stopPropagation();
  try {
    const response = await fetch(`/api/posts/${postId}/like`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId }),
    });
    const data = await response.json();

    const postIndex = likedPostsData.findIndex((p) => p._id === postId);
    if (postIndex > -1) {
      likedPostsData[postIndex].likes = data.likes;

      // ตรวจสอบว่าผู้ใช้เลิกกดใจโพสต์นี้แล้วใช่ไหม
      if (!data.likes.some((l) => l.userId === currentUserId)) {
        // [แก้ไขจุดที่ 2] ตัดโพสต์นี้ออกจากอาร์เรย์หน้าจอ Favorite ทันทีเพื่อให้การ์ดหายไปแบบ Real-time
        likedPostsData.splice(postIndex, 1);
        if (activePostId === postId) closePostDetail();
      } else {
        if (activePostId === postId) openPostDetail(postId);
      }
      sortAndRenderGrid();
    } else {
      fetchFavPosts();
    }
  } catch (error) {
    console.error("Like error:", error);
  }
}

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
  const post = likedPostsData.find((p) => p._id === activePostId);
  const list = document.getElementById("commentList");
  if (!post || !list) return;

  if (post.comments.length === 0) {
    list.innerHTML =
      '<div style="color:#888; text-align:center; margin-top:30px; font-size:0.9rem;">No comments yet</div>';
    return;
  }

  // [แก้ไขจุดที่ 3] ย้ายโครงสร้างดึงข้อมูล Avatar เข้าไปอยู่ในลูป .map() ให้ถูกต้องเพื่อป้องกันสคริปต์หยุดทำงาน
  list.innerHTML = post.comments
    .map((c) => {
      const userAvatar = getAvatarSrc(c.avatar);
      const likes = Array.isArray(c.likes) ? c.likes : [];
      const isCommentLiked = likes.includes(currentUserId);
      return `
        <div class="comment-item">
            <img src="${userAvatar}" class="comment-avatar" alt="avatar" onclick="openProfile('${c.userId}', event)" style="cursor: pointer;">
            <div class="comment-content">
                <div>
                    <span class="comment-user" onclick="openProfile('${c.userId}', event)" style="cursor: pointer;">${c.userId}</span>
                    <span class="comment-text">${c.text}</span>
                </div>
                <div class="comment-bottom">
                    <span class="comment-like ${isCommentLiked ? "active" : ""}" 
                          onclick="toggleCommentLike('${post._id}', '${c._id}')">
                        <i class="${isCommentLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
                        ${likes.length > 0 ? likes.length : ""}
                    </span>
                </div>
            </div>
        </div>
        `;
    })
    .join("");

  list.scrollTop = list.scrollHeight;
}

async function addComment() {
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

    const postIndex = likedPostsData.findIndex((p) => p._id === activePostId);
    if (postIndex > -1) {
      likedPostsData[postIndex].comments = updatedComments;

      input.value = "";
      renderComments();
      const detailModal = document.getElementById("postDetailModal");
      if (detailModal && detailModal.classList.contains("active")) {
        openPostDetail(activePostId);
      }
    }
  } catch (error) {
    console.error("Comment error:", error);
  }
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
    const data = await response.json();

    const postIndex = likedPostsData.findIndex((p) => p._id === postId);
    if (postIndex > -1) {
      const commentIndex = likedPostsData[postIndex].comments.findIndex(
        (c) => c._id === commentId,
      );
      if (commentIndex > -1) {
        likedPostsData[postIndex].comments[commentIndex].likes = data.likes;
        renderComments();
      }
    }
  } catch (error) {
    console.error("Comment Like error:", error);
  }
}

function handleDoubleLike(postId) {
  const post = likedPostsData.find((p) => p._id === postId);
  if (!post) return;
  const postEl = document.getElementById(`post_${postId}`);
  const heart = postEl.querySelector(".double-heart");

  heart.classList.remove("animate");
  void heart.offsetWidth;
  heart.classList.add("animate");

  if (!post.likes.some((l) => l.userId === currentUserId)) toggleLike(postId);
}

function moveSlide(postId, dir) {
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

function closePostDetail() {
  const detailModal = document.getElementById("postDetailModal");
  if (detailModal) detailModal.classList.remove("active");
  activePostId = null;
}

function toggleSortMenu() {
  const modal = document.getElementById("sortModal");
  const arrow = document.getElementById("sortArrow");
  if (modal) modal.style.display = "flex";
  if (arrow) arrow.classList.add("rotate");
}

function closeSortMenu(e) {
  const isClickOutside =
    e && e.target && e.target.classList.contains("sort-modal-overlay");
  const isForceClose = e === "force";

  if (isClickOutside || isForceClose || !e) {
    const modal = document.getElementById("sortModal");
    const arrow = document.getElementById("sortArrow");
    if (modal) modal.style.display = "none";
    if (arrow) arrow.classList.remove("rotate");
  }
}

function selectSortOption(label, type) {
  currentSortType = type;
  const sortTitle = document.getElementById("currentSortTitle");
  if (sortTitle) sortTitle.innerText = label;

  const newestRadio = document.getElementById("radio-newest");
  const oldestRadio = document.getElementById("radio-oldest");
  const targetRadio = document.getElementById(`radio-${type}`);

  if (newestRadio) newestRadio.classList.remove("active");
  if (oldestRadio) oldestRadio.classList.remove("active");
  if (targetRadio) targetRadio.classList.add("active");

  closeSortMenu("force");
  sortAndRenderGrid();
}

function openProfile(username, event) {
  if (event) event.stopPropagation();
  window.location.href = `profile.html?username=${username}`;
}