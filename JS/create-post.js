/* =========================================
   create-post.js
   ========================================= */

// --- ส่วนของระบบผู้ใช้งาน (Mock Data) ---
const currentUser = {
    "userId": "user_punch_001",
    "username": "Punch",
    "profilePic": "https://i.pravatar.cc/150?img=11"
};

// ฟังก์ชันดึงข้อมูลผู้ใช้มาแสดงใน UI
function loadUserProfile() {
    const avatar = document.querySelector('.avatar');
    if (avatar) {
        avatar.src = currentUser.profilePic;
        avatar.alt = currentUser.username;
    }
    
    const usernameDisplay = document.getElementById('username');
    if (usernameDisplay) {
        usernameDisplay.innerText = currentUser.username;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
});

const MAX_FILES = 10;
const MAX_CHARS = 5000;
let selectedFiles = []; 

// 1. จัดการเมื่อผู้ใช้เลือกไฟล์
function handleFileSelect(event) {
    const newFiles = Array.from(event.target.files);
    
    if (selectedFiles.length + newFiles.length > MAX_FILES) {
        alert(`คุณสามารถเลือกรูปภาพหรือวิดีโอได้สูงสุด ${MAX_FILES} ไฟล์เท่านั้น`);
        const allowedSlots = MAX_FILES - selectedFiles.length;
        selectedFiles = [...selectedFiles, ...newFiles.slice(0, allowedSlots)];
    } else {
        selectedFiles = [...selectedFiles, ...newFiles];
    }

    renderPreview();
    document.getElementById('fileInput').value = ''; 
}

// 2. สร้าง UI สำหรับ Carousel Preview
function renderPreview() {
    const placeholder = document.getElementById('upload-placeholder');
    const carousel = document.getElementById('preview-carousel');
    const addMoreBtn = document.getElementById('add-more-btn');

    carousel.innerHTML = ''; 

    if (selectedFiles.length === 0) {
        placeholder.style.display = 'block';
        carousel.style.display = 'none';
        addMoreBtn.style.display = 'none';
        return;
    }

    placeholder.style.display = 'none';
    carousel.style.display = 'flex';
    addMoreBtn.style.display = selectedFiles.length < MAX_FILES ? 'flex' : 'none';

    selectedFiles.forEach((file, index) => {
        const fileURL = URL.createObjectURL(file);
        const slide = document.createElement('div');
        slide.className = 'preview-slide';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-media-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.onclick = () => removeFile(index);

        let mediaElement;
        if (file.type.startsWith('image/')) {
            mediaElement = document.createElement('img');
            mediaElement.src = fileURL;
        } else if (file.type.startsWith('video/')) {
            mediaElement = document.createElement('video');
            mediaElement.src = fileURL;
            mediaElement.controls = true;
        }

        slide.appendChild(mediaElement);
        slide.appendChild(removeBtn);
        carousel.appendChild(slide);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderPreview();
}

// 3. ระบบนับตัวอักษร
function updateCharCount() {
    const textarea = document.getElementById('captionText');
    const counter = document.getElementById('charCounter');
    const currentLength = textarea.value.length;

    if (currentLength > MAX_CHARS) {
        textarea.value = textarea.value.substring(0, MAX_CHARS);
    }

    const finalLength = textarea.value.length;
    counter.innerText = `${finalLength.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
}

// 4. ปุ่ม Cancel
function handleCancel() {
    if(selectedFiles.length > 0 || document.getElementById('captionText').value.trim() !== "") {
        if(confirm("คุณต้องการละทิ้งการโพสต์นี้ใช่หรือไม่?")) {
            selectedFiles = [];
            document.getElementById('captionText').value = "";
            updateCharCount();
            renderPreview();
        }
    } else {
        window.location.href = 'feeds.html';
    }
}

// 5. ปุ่ม Share
async function handleShare() {
    const caption = document.getElementById('captionText').value.trim();
    
    if (selectedFiles.length === 0) {
        alert("กรุณาเลือกรูปภาพหรือวิดีโออย่างน้อย 1 ไฟล์");
        return;
    }

    const formData = new FormData();
    formData.append('caption', caption);
    formData.append('userId', currentUser.userId); // ส่งค่า userId ไปให้ Backend
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });

    try {
        const response = await fetch('http://localhost:3000/api/posts', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            alert("โพสต์ของคุณถูกแชร์เรียบร้อยแล้ว!");
            window.location.href = 'feeds.html';
        }
    } catch (error) {
        console.error("Error:", error);
        alert("เกิดข้อผิดพลาดในการอัปโหลด");
    }
}