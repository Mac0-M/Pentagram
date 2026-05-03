function previewMedia(event) {
    const file = event.target.files[0];
    const imagePreview = document.getElementById('image-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.getElementById('upload-placeholder');

    if (!file) return;

    const fileType = file.type;
    const reader = new FileReader();

    imagePreview.style.display = 'none';
    videoPreview.style.display = 'none';
    placeholder.style.display = 'none';

    reader.onload = function(e) {
        if (fileType.startsWith('image/')) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
        } else if (fileType.startsWith('video/')) {
            videoPreview.src = e.target.result;
            videoPreview.style.display = 'block';
        }
    }
    reader.readAsDataURL(file);
}

function setActive(el) {
    const items = document.querySelectorAll(".nav-item");
    items.forEach(item => item.classList.remove("active"));
    el.classList.add("active");
}
// ฟังก์ชันสำหรับปุ่ม Cancel
function handleCancel() {
    if(confirm("คุณต้องการละทิ้งการโพสต์นี้ใช่หรือไม่?")) {
        // ล้างคำบรรยาย
        document.getElementById('captionText').value = "";
        // รีโหลดหน้าใหม่ หรือสั่งให้กลับไปหน้า Feed
        location.reload(); 
    }
}

// ฟังก์ชันสำหรับปุ่ม Share
function handleShare() {
    const caption = document.getElementById('captionText').value;
    if(caption.trim() === "") {
        alert("กรุณาใส่คำบรรยายก่อนแชร์");
        return;
    }
    // จำลองการส่งข้อมูล
    console.log("กำลังแชร์โพสต์พร้อมแคปชั่น:", caption);
    alert("แชร์โพสต์ของคุณเรียบร้อยแล้ว!");
}

// --- ฟังก์ชันเดิมของคุณ (ห้ามลบ) ---
function previewMedia(event) {
    const file = event.target.files[0];
    const imagePreview = document.getElementById('image-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.getElementById('upload-placeholder');

    if (!file) return;

    const fileType = file.type;
    const reader = new FileReader();

    imagePreview.style.display = 'none';
    videoPreview.style.display = 'none';
    placeholder.style.display = 'none';

    reader.onload = function(e) {
        if (fileType.startsWith('image/')) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
        } else if (fileType.startsWith('video/')) {
            videoPreview.src = e.target.result;
            videoPreview.style.display = 'block';
        }
    }
    reader.readAsDataURL(file);
}

function setActive(el) {
    const items = document.querySelectorAll(".nav-item");
    items.forEach(item => item.classList.remove("active"));
    el.classList.add("active");
}