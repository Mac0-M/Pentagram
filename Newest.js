document.addEventListener("DOMContentLoaded", function() {
    setupPostImages(5); 
});

// ฟังก์ชันเปิด/ปิด Sort Menu
function toggleSortMenu() {
    const modal = document.getElementById("sortModal");
    const arrow = document.getElementById("sortArrow");
    
    modal.style.display = "block";
    arrow.classList.add("rotate"); // หมุนลูกศรลง (รูปที่ 3)
}

function closeSortMenu(e) {
    if (e === 'force' || e.target.id === "sortModal") {
        document.getElementById("sortModal").style.display = "none";
        document.getElementById("sortArrow").classList.remove("rotate"); // ลูกศรชี้ขึ้น (รูปที่ 2)
    }
}

// ฟังก์ชันเลือกวิธี Sort (รูปที่ 4)
function selectSortOption(label, type) {
    const radioNewest = document.getElementById("radio-newest");
    const radioOldest = document.getElementById("radio-oldest");
    const titleText = document.getElementById("currentSortTitle");

    // ล้างจุดดำออกก่อน
    radioNewest.classList.remove("active");
    radioOldest.classList.remove("active");

    // ใส่จุดดำตามที่เลือก
    if (type === 'newest') {
        radioNewest.classList.add("active");
        titleText.innerText = "Newest";
    } else {
        radioOldest.classList.add("active");
        titleText.innerText = "Oldest";
    }

    // ปิดเมนู
    setTimeout(() => {
        closeSortMenu('force');
    }, 300);
}

// --- Logic เดิมที่คุณส่งมา ---
function setupPostImages(count) {
    const counter = document.getElementById("imgCounter");
    if (count > 1) {
        counter.innerText = `1/${count}`;
        counter.style.display = "block";
    } else {
        counter.style.display = "none";
    }
}

function setActive(el) {
    const items = document.querySelectorAll(".nav-item");
    items.forEach(item => item.classList.remove("active"));
    el.classList.add("active");
}

function toggleLike(btn) {
    btn.classList.toggle("active");
    const countSpan = btn.querySelector(".count");
    let currentCount = parseInt(countSpan.innerText.replace(/,/g, '')) || 0;
    if(btn.classList.contains("active")) { currentCount++; } else { currentCount--; }
    countSpan.innerText = currentCount > 0 ? currentCount.toLocaleString() : "";
}

function toggleActionMenu(btn) {
    const menu = document.getElementById('actionMenu');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function selectReport(item) {
    item.classList.add('selected');
    setTimeout(() => {
        alert("Reported Post!");
        document.getElementById('actionMenu').style.display = 'none';
        item.classList.remove('selected');
    }, 500);
}

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

window.onclick = function(event) {
    const menu = document.getElementById('actionMenu');
    const commentModal = document.getElementById("commentModal");
    const sortModal = document.getElementById("sortModal");
    
    if (menu && event.target.className !== 'more-options' && !menu.contains(event.target)) {
        menu.style.display = 'none';
    }
    
    if (event.target == commentModal) {
        closeComments();
    }
    
    if (event.target == sortModal) {
        closeSortMenu('force');
    }
}