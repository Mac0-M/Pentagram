const MAX_FILES = 10;
const MAX_CHARS = 5000;
let selectedFiles = [];

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
  document.getElementById("fileInput").value = "";
}

function renderPreview() {
  const placeholder = document.getElementById("upload-placeholder");
  const carousel = document.getElementById("preview-carousel");
  const addMoreBtn = document.getElementById("add-more-btn");
  const prevBtn = document.getElementById("preview-prev-btn");
  const nextBtn = document.getElementById("preview-next-btn");
  const counter = document.getElementById("preview-counter");

  carousel.innerHTML = ""; // เคลียร์ของเก่า

  if (selectedFiles.length === 0) {
    placeholder.style.display = "block";
    carousel.style.display = "none";
    addMoreBtn.style.display = "none";
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    counter.style.display = "none";
    return;
  }

  placeholder.style.display = "none";
  carousel.style.display = "flex"; // เปิดคาร์รูเซลเต็มประสิทธิภาพ 1:1

  // อัปเดตการโชว์ปุ่มเสริมสไตล์ Overlay ลอยทับเนื้อหา
  addMoreBtn.style.display = selectedFiles.length < MAX_FILES ? "flex" : "none";
  prevBtn.style.display = selectedFiles.length > 1 ? "flex" : "none";
  nextBtn.style.display = selectedFiles.length > 1 ? "flex" : "none";
  counter.style.display = "block";

  selectedFiles.forEach((file, index) => {
    const fileURL = URL.createObjectURL(file);
    const slide = document.createElement("div");
    slide.className = "preview-slide"; // กลับมาใช้คลาสแท้เพื่อบังคับ 100% ทั้งกว้างและสูง

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-media-btn"; // ดึงคลาสแท้ดึงปุ่มลบไปล็อคขวาบนอัตโนมัติ ไม่เอ๋อตรงกลาง
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeFile(index);
    };

    let mediaElement;
    if (file.type.startsWith("image/")) {
      mediaElement = document.createElement("img");
      mediaElement.src = fileURL;
    } else if (file.type.startsWith("video/")) {
      mediaElement = document.createElement("video");
      mediaElement.src = fileURL;
      mediaElement.controls = true;
      mediaElement.muted = true;
    }

    if (mediaElement) {
      slide.appendChild(mediaElement);
      slide.appendChild(removeBtn);
      carousel.appendChild(slide);
    }
  });

  // ตรวจจับการสไลด์เพื่อเปลี่ยนเลขตัวนับ
  carousel.removeEventListener("scroll", window.updatePreviewCounter);
  carousel.addEventListener("scroll", window.updatePreviewCounter);
  window.updatePreviewCounter();
}

window.movePreviewSlide = function (dir) {
  const carousel = document.getElementById("preview-carousel");
  if (carousel) {
    carousel.scrollBy({ left: carousel.clientWidth * dir, behavior: "smooth" });
  }
};

window.updatePreviewCounter = function () {
  const carousel = document.getElementById("preview-carousel");
  const counter = document.getElementById("preview-counter");
  if (!carousel || !counter) return;
  const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
  counter.innerText = `${index + 1} / ${selectedFiles.length}`;
};

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderPreview();
}

function updateCharCount() {
  const textarea = document.getElementById("captionText");
  const counter = document.getElementById("charCounter");
  const currentLength = textarea.value.length;

  if (currentLength > MAX_CHARS) {
    textarea.value = textarea.value.substring(0, MAX_CHARS);
  }
  const finalLength = textarea.value.length;
  counter.innerText = `${finalLength.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
}

function handleCancel() {
  if (
    selectedFiles.length > 0 ||
    document.getElementById("captionText").value.trim() !== ""
  ) {
    if (
      confirm("คุณต้องการละทิ้งการโพสต์นี้ใช่หรือไม่? ข้อมูลทั้งหมดจะหายไป")
    ) {
      selectedFiles = [];
      document.getElementById("captionText").value = "";
      renderPreview();
    }
  } else {
    window.location.href = "feeds.html";
  }
}

async function handleShare() {
  const caption = document.getElementById("captionText").value.trim();
  if (selectedFiles.length === 0) {
    alert("กรุณาเลือกรูปภาพหรือวิดีโออย่างน้อย 1 ไฟล์");
    return;
  }
  const currentUserId = localStorage.getItem("username") || "TestPlayer";
  const formData = new FormData();
  formData.append("caption", caption);
  formData.append("userId", currentUserId);
  selectedFiles.forEach((file) => {
    formData.append("files", file);
  });

  try {
    const response = await fetch("/api/posts", {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      alert("โพสต์ของคุณถูกแชร์เรียบร้อยแล้ว!");
      window.location.href = "feeds.html";
    } else {
      const err = await response.json();
      alert("เกิดข้อผิดพลาด: " + (err.error || "ไม่สามารถแชร์โพสต์ได้"));
    }
  } catch (error) {
    console.error("Error:", error);
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
  }
}
