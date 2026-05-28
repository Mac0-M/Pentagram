// ฟังก์ชันเมื่อโหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded", function() {
    // สมมติตัวอย่าง: หลังบ้านส่งมาว่าโพสต์นี้มี 5 รูป
    // ถ้ามี 1 รูป ให้ส่งเลข 1 เข้าไป ฟังก์ชันจะซ่อนตัวเลขเอง
    setupPostImages(5); 
});

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
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

// ระบบเลือก Report
function selectReport(item) {
    item.classList.add('selected');
    setTimeout(() => {
        alert("Reported Post!");
        document.getElementById('actionMenu').style.display = 'none';
        item.classList.remove('selected');
    }, 500);
}

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