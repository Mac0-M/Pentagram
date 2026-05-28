const feedList = document.getElementById("feedList");
const commentModal = document.getElementById("commentModal");
const commentList = document.getElementById("commentList");

let postsData = [];
let activePostId = null;

// สมมติว่านี่คือไอดีของคุณที่ล็อกอินอยู่
const currentUserId = "currentUser_1"; 
const API_URL = "http://localhost:3000"; 

async function fetchPosts() {
    try {
        const response = await fetch(`${API_URL}/api/posts`);
        postsData = await response.json();
        renderFeed();
    } catch (error) {
        console.error("Error fetching posts:", error);
    }
}

function renderFeed() {
    feedList.innerHTML = postsData.map(post => {
        // 🟢 เปลี่ยนมาใช้ .some ให้ตรงกับ Database ใหม่
        const isLiked = post.likes.some(l => l.userId === currentUserId);
        
        const images = post.mediaPaths.map(path => `${API_URL}/${path}`);
        const userAvatar = "https://i.pravatar.cc/150?img=11"; 

        return `
        <article class="post-card ${post.suspended ? 'suspended' : ''}" id="post_${post._id}">
            <div class="post-header">
                <div class="post-user" onclick="openProfile('${post.userId}')">
                    <div class="post-avatar">
                        <img src="${userAvatar}" />
                    </div>
                    <div class="post-username">${post.userId}</div>
                    <div class="post-time">${formatPostDate(post.createdAt)}</div>
                </div>
                <div class="menu-wrapper">
                    <button class="more-btn" onclick="toggleMenu('${post._id}')">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                    <div class="action-menu" id="menu_${post._id}">
                        <button class="action-item report" onclick="reportPost('${post._id}')">
                            <i class="fa-solid fa-flag"></i> Report
                        </button>
                    </div>
                </div>
            </div>

            <div class="post-media" ondblclick="handleDoubleLike('${post._id}')">
                <div class="carousel" id="carousel_${post._id}" onscroll="updateCounter('${post._id}')">
                    ${images.map(img => `<div class="slide"><img src="${img}" loading="lazy" /></div>`).join("")}
                </div>
                ${images.length > 1 ? `
                    <button class="nav-btn prev" onclick="moveSlide('${post._id}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
                    <button class="nav-btn next" onclick="moveSlide('${post._id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
                ` : ""}
                <i class="fa-solid fa-heart double-heart"></i>
            </div>

            <div class="post-footer">
                <div class="post-actions">
                    <div class="left-actions">
                        <button class="action-btn like-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${post._id}')">
                            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                            <span id="like-count-${post._id}">${formatNumber(post.likes.length)}</span>
                        </button>
                        <button class="action-btn" onclick="openComments('${post._id}')">
                            <i class="fa-regular fa-comment"></i>
                            <span>${post.comments.length}</span>
                        </button>
                    </div>
                    <div class="counter">${images.length > 0 ? `1/${images.length}` : ''}</div>
                </div>
                ${images.length > 1 ? `<div class="dots">${images.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join("")}</div>` : ""}
                <div class="caption">
                    <strong>${post.userId}</strong> ${post.caption}
                </div>
            </div>
        </article>
        `;
    }).join("");
}

fetchPosts();

async function toggleLike(postId) {
    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/like`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        
        const postIndex = postsData.findIndex(p => p._id === postId);
        postsData[postIndex].likes = data.likes;
        
        renderFeed(); 
    } catch (error) {
        console.error("Like error:", error);
    }
}

function handleDoubleLike(postId) {
    const post = postsData.find(p => p._id === postId);
    const postEl = document.getElementById(`post_${postId}`);
    const heart = postEl.querySelector(".double-heart");

    heart.classList.remove("animate");
    void heart.offsetWidth;
    heart.classList.add("animate");

    // 🟢 เปลี่ยนมาใช้ .some ให้ตรงกับ Database ใหม่
    const isLiked = post.likes.some(l => l.userId === currentUserId);
    if (!isLiked) {
        toggleLike(postId);
    }
}

function openComments(postId) {
    activePostId = postId;
    renderComments();
    commentModal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeComments() {
    commentModal.classList.remove("active");
    document.body.style.overflow = "";
}

document.getElementById("closeCommentBtn").addEventListener("click", closeComments);
commentModal.addEventListener("click", e => {
    if (e.target === commentModal) closeComments();
});

function renderComments() {
    const post = postsData.find(p => p._id === activePostId);
    
    commentList.innerHTML = post.comments.map(comment => {
        const isCommentLiked = comment.likes.includes(currentUserId);
        const userAvatar = "https://i.pravatar.cc/150?img=11"; 

        return `
            <div class="comment-item">
                <img src="${userAvatar}" class="comment-avatar" />
                <div class="comment-content">
                    <div>
                        <span class="comment-user" onclick="openProfile('${comment.userId}')">${comment.userId}</span>
                        <span class="comment-text">${comment.text}</span>
                    </div>
                    <div class="comment-bottom">
                        <span class="comment-like ${isCommentLiked ? 'active' : ''}" 
                              onclick="toggleCommentLike('${post._id}', '${comment._id}')">
                            <i class="${isCommentLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                            ${comment.likes.length > 0 ? comment.likes.length : ''}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

document.getElementById("sendCommentBtn").addEventListener("click", async () => {
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
        
        const postIndex = postsData.findIndex(p => p._id === activePostId);
        postsData[postIndex].comments = updatedComments;
        
        input.value = "";
        renderComments();
        renderFeed();
    } catch (error) {
        console.error("Comment error:", error);
    }
});

async function toggleCommentLike(postId, commentId) {
    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/comments/${commentId}/like`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        
        const postIndex = postsData.findIndex(p => p._id === postId);
        const commentIndex = postsData[postIndex].comments.findIndex(c => c._id === commentId);
        postsData[postIndex].comments[commentIndex].likes = data.likes;
        
        renderComments();
    } catch (error) {
        console.error("Comment Like error:", error);
    }
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
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
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

function toggleMenu(postId) {
    document.querySelectorAll(".action-menu").forEach(menu => {
        if (menu.id !== `menu_${postId}`) menu.classList.remove("active");
    });
    document.getElementById(`menu_${postId}`).classList.toggle("active");
}

async function reportPost(postId) {
    try {
        const response = await fetch(`${API_URL}/api/posts/${postId}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.suspended) {
                alert("โพสต์นี้ถูกระงับเนื่องจากได้รับรายงานจากผู้ใช้หลายราย");
                const postIndex = postsData.findIndex(p => p._id === postId);
                if (postIndex > -1) {
                    postsData[postIndex].suspended = true;
                    renderFeed();
                }
            } else {
                alert("ขอบคุณที่แจ้งรายงาน เราจะดำเนินการตรวจสอบครับ");
            }
        } else {
            alert(data.message); 
        }
        
        toggleMenu(postId);
    } catch (error) {
        console.error("Report error:", error);
    }
}

function openProfile(username) {
    window.location.href = `profile.html?user=${username}`;
}