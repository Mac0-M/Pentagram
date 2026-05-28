const API_URL = "http://localhost:3000";
const currentUserId = "currentUser_1"; 

let likedPostsData = [];
let activePostId = null;
let currentSortType = 'newest';

document.addEventListener("DOMContentLoaded", () => {
    fetchFavPosts();
    document.getElementById("radio-newest").classList.add("active");
});

async function fetchFavPosts() {
    try {
        const response = await fetch(`${API_URL}/api/posts/liked/${currentUserId}`);
        likedPostsData = await response.json();
        sortAndRenderGrid();
    } catch (error) {
        console.error("Error fetching fav posts:", error);
    }
}

function sortAndRenderGrid() {
    const gridArea = document.getElementById("favGridArea");
    gridArea.innerHTML = "";

    let sortedData = [...likedPostsData];

    sortedData.sort((a, b) => {
        // 1. หาข้อมูล Like ของ User คนนี้จาก Array
        const likeA = a.likes.find(l => l.userId === currentUserId);
        const likeB = b.likes.find(l => l.userId === currentUserId);

        // 2. ถ้ามี likedAt ให้ใช้ ถ้าไม่มีให้ตกไปใช้ createdAt ของโพสต์นั้น (ป้องกันค่า undefined)
        const timeA = likeA?.likedAt ? new Date(likeA.likedAt).getTime() : new Date(a.createdAt).getTime();
        const timeB = likeB?.likedAt ? new Date(likeB.likedAt).getTime() : new Date(b.createdAt).getTime();

        // 3. เรียงตามเวลา
        if (currentSortType === 'newest') {
            return timeB - timeA; 
        } else {
            return timeA - timeB; 
        }
    });

    sortedData.forEach(post => {
        // เช็คการไลก์โดยดูจาก userId ใน object
        const isLiked = post.likes.some(l => l.userId === currentUserId);
        if (!isLiked) return; 

        // ... โค้ดส่วนการแสดงผล (Render) เดิมของคุณ ...
        const images = post.mediaPaths.map(path => `${API_URL}/${path}`);
        const userAvatar = "https://i.pravatar.cc/150?img=11";
        
        const item = document.createElement("div");
        item.className = "fav-post-card";
        item.onclick = () => openPostDetail(post._id);
        item.innerHTML = `
            <div class="fav-post-header">
                <img src="${userAvatar}" class="fav-post-avatar">
                <span class="fav-post-username">${post.userId}</span>
            </div>
            <img src="${images[0]}" class="fav-post-image">
            <div class="fav-post-actions">
                <i class="fa-solid fa-heart" style="color: #ff3040;" onclick="toggleLike('${post._id}', event)"></i>
                <i class="fa-regular fa-comment"></i>
            </div>
            <div class="fav-post-content">
                <div class="fav-post-likes">${formatNumber(post.likes.length)} likes</div>
                <div class="fav-post-caption"><strong>${post.userId}</strong> ${post.caption}</div>
            </div>
        `;
        gridArea.appendChild(item);
    });
}
function openPostDetail(postId) {
    activePostId = postId;
    const post = likedPostsData.find(p => p._id === postId);
    if(!post) return;

    const detailContent = document.getElementById("postDetailContent");
    const images = post.mediaPaths.map(path => `${API_URL}/${path}`);
    const isLiked = post.likes.some(l => l.userId === currentUserId);
    const userAvatar = "https://i.pravatar.cc/150?img=11";

    detailContent.innerHTML = `
        <article class="post-card" id="post_${post._id}">
            <div class="post-header">
                <div class="post-user">
                    <div class="post-avatar">
                        <img src="${userAvatar}" />
                    </div>
                    <div class="post-username">${post.userId}</div>
                    <div class="post-time">${formatPostDate(post.createdAt)}</div>
                </div>
            </div>

            <div class="post-media" ondblclick="handleDoubleLike('${post._id}')">
                <div class="carousel" id="carousel_${post._id}" onscroll="updateCounter('${post._id}')">
                    ${images.map(img => `
                        <div class="slide">
                            <img src="${img}" loading="lazy" />
                        </div>
                    `).join("")}
                </div>
                ${images.length > 1 ? `
                    <button class="nav-btn prev" onclick="moveSlide('${post._id}', -1)">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <button class="nav-btn next" onclick="moveSlide('${post._id}', 1)">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                ` : ""}
                <i class="fa-solid fa-heart double-heart"></i>
            </div>

            <div class="post-footer">
                <div class="post-actions">
                    <div class="left-actions">
                        <button class="action-btn like-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${post._id}', event)">
                            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                            <span>${formatNumber(post.likes.length)}</span>
                        </button>
                        <button class="action-btn" onclick="openComments('${post._id}', event)">
                            <i class="fa-regular fa-comment"></i>
                            <span>${post.comments.length}</span>
                        </button>
                    </div>
                    <div class="counter">${images.length > 0 ? `1/${images.length}` : ''}</div>
                </div>

                ${images.length > 1 ? `
                    <div class="dots">
                        ${images.map((_, i) => `
                            <div class="dot ${i === 0 ? 'active' : ''}"></div>
                        `).join("")}
                    </div>
                ` : ""}

                <div class="caption">
                    <strong>${post.userId}</strong> ${post.caption}
                </div>
            </div>
        </article>
    `;
    document.getElementById("postDetailModal").classList.add("active");
}

async function toggleLike(postId, event) {
    if (event) event.stopPropagation(); 
    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/like`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        
        const postIndex = likedPostsData.findIndex(p => p._id === postId);
        if (postIndex > -1) {
            likedPostsData[postIndex].likes = data.likes;
            
            if (!data.likes.some(l => l.userId === currentUserId)) {
                if (activePostId === postId) closePostDetail();
            } else {
                if (activePostId === postId) openPostDetail(postId);
            }
            sortAndRenderGrid();
        }
    } catch (error) {
        console.error("Like error:", error);
    }
}

function openComments(postId, event) {
    if(event) event.stopPropagation();
    activePostId = postId;
    renderComments();
    document.getElementById("commentModal").classList.add("active");
}

function closeComments() {
    document.getElementById("commentModal").classList.remove("active");
}

function renderComments() {
    const post = likedPostsData.find(p => p._id === activePostId);
    const list = document.getElementById("commentList");
    
    if (post.comments.length === 0) {
        list.innerHTML = '<div style="color:#888; text-align:center; margin-top:30px; font-size:0.9rem;">No comments yet</div>';
        return;
    }

    const userAvatar = "https://i.pravatar.cc/150?img=11";

    list.innerHTML = post.comments.map(c => {
        const isCommentLiked = c.likes.includes(currentUserId);
        return `
        <div class="comment-item">
            <img src="${userAvatar}" class="comment-avatar" alt="avatar">
            <div class="comment-content">
                <div>
                    <span class="comment-user">${c.userId}</span>
                    <span class="comment-text">${c.text}</span>
                </div>
                <div class="comment-bottom">
                    <span class="comment-like ${isCommentLiked ? 'active' : ''}" 
                          onclick="toggleCommentLike('${post._id}', '${c._id}')">
                        <i class="${isCommentLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                        ${c.likes.length > 0 ? c.likes.length : ''}
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
    
    try {
        const response = await fetch(`${API_URL}/api/posts/${activePostId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, text })
        });
        const updatedComments = await response.json();
        
        const postIndex = likedPostsData.findIndex(p => p._id === activePostId);
        likedPostsData[postIndex].comments = updatedComments;
        
        input.value = "";
        renderComments();
        if(document.getElementById("postDetailModal").classList.contains("active")){
            openPostDetail(activePostId);
        }
    } catch (error) {
        console.error("Comment error:", error);
    }
}

async function toggleCommentLike(postId, commentId) {
    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/comments/${commentId}/like`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        
        const postIndex = likedPostsData.findIndex(p => p._id === postId);
        const commentIndex = likedPostsData[postIndex].comments.findIndex(c => c._id === commentId);
        likedPostsData[postIndex].comments[commentIndex].likes = data.likes;
        
        renderComments();
    } catch (error) {
        console.error("Comment Like error:", error);
    }
}

function handleDoubleLike(postId) {
    const post = likedPostsData.find(p => p._id === postId);
    const postEl = document.getElementById(`post_${postId}`);
    const heart = postEl.querySelector(".double-heart");

    heart.classList.remove("animate");
    void heart.offsetWidth; 
    heart.classList.add("animate");

    if (!post.likes.some(l => l.userId === currentUserId)) toggleLike(postId);
}

function moveSlide(postId, dir) {
    const carousel = document.getElementById(`carousel_${postId}`);
    carousel.scrollBy({ left: carousel.clientWidth * dir, behavior: "smooth" });
}

function updateCounter(postId) {
    const carousel = document.getElementById(`carousel_${postId}`);
    const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
    const postEl = document.getElementById(`post_${postId}`);
    
    const counter = postEl.querySelector(".counter");
    if(counter) counter.innerText = `${index + 1}/${carousel.children.length}`;

    const dots = postEl.querySelectorAll(".dot");
    dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
}

function formatNumber(num) {
    if (num >= 1000000) return ((num / 1000000).toFixed(1) + "M");
    if (num >= 1000) return ((num / 1000).toFixed(1) + "k");
    return num;
}

function formatPostDate(d) {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }); 
}

function closePostDetail() {
    document.getElementById("postDetailModal").classList.remove("active");
}

function toggleSortMenu() {
    const modal = document.getElementById("sortModal");
    const arrow = document.getElementById("sortArrow");
    modal.style.display = "flex";
    arrow.classList.add("rotate");
}

function closeSortMenu(e) {
    // ตรวจสอบก่อนว่า e เป็น Event Object หรือไม่
    // ถ้า e เป็น 'force' หรือไม่มีค่า ก็ให้ถือว่าเป็นการปิดแบบปกติ
    const isClickOutside = (e && e.target && e.target.classList.contains("sort-modal-overlay"));
    const isForceClose = (e === 'force');

    if (isClickOutside || isForceClose || !e) {
        document.getElementById("sortModal").style.display = "none";
        document.getElementById("sortArrow").classList.remove("rotate");
    }
}

function selectSortOption(label, type) {
    currentSortType = type;
    document.getElementById("currentSortTitle").innerText = label;

    document.getElementById("radio-newest").classList.remove("active");
    document.getElementById("radio-oldest").classList.remove("active");
    document.getElementById(`radio-${type}`).classList.add("active");

    closeSortMenu('force');
    sortAndRenderGrid();
}