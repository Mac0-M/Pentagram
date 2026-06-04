function setOwnerSettingsVisibility(isEditing) {
  if (!window.PentagramPageContext?.isOwnerProfile) return;

  const shouldShow = Boolean(isEditing);
  const verificationCard = document.getElementById('game-verification-card');
  const avatarUploadOverlay = document.getElementById('avatarUploadOverlay');

  if (verificationCard) {
    const isVerified = Boolean(window.profileData?.verified);
    const showCard = shouldShow && !isVerified;
    verificationCard.hidden = !showCard;
    verificationCard.style.display = showCard ? "block" : "none";
    verificationCard.setAttribute('aria-hidden', String(!showCard));
  }

  if (avatarUploadOverlay) {
    avatarUploadOverlay.hidden = !shouldShow;
    avatarUploadOverlay.setAttribute('aria-hidden', String(!shouldShow));
  }
}

function renderProfileSummary(data) {
  const usernameEl = document.getElementById("username");
  const avatarImg = document.getElementById("profileAvatar");
  const defaultSvg = document.getElementById("defaultAvatarSvg");
  const verifiedEl = document.getElementById("verifiedBadge");
  const lolIdEl = document.getElementById("lolId");
  const dotaIdEl = document.getElementById("dotaId");

  if (usernameEl) usernameEl.textContent = data.username || "Unknown User";
  if (lolIdEl) lolIdEl.textContent = data.lolId || "-";
  if (dotaIdEl) dotaIdEl.textContent = data.dotaId || "-";

  if (avatarImg && defaultSvg) {
    if (data.avatar && data.avatar.trim() !== "") {
      avatarImg.src = data.avatar;
      avatarImg.style.display = "block";
      defaultSvg.style.display = "none";
    } else {
      avatarImg.style.display = "none";
      defaultSvg.style.display = "block";
    }
  }

  if (verifiedEl) verifiedEl.style.display = data.verified ? "flex" : "none";

  const verificationCard = document.getElementById("game-verification-card");
  if (verificationCard) {
    const isOwner = Boolean(window.PentagramPageContext?.isOwnerProfile);
    const isVerified = Boolean(data.verified);
    const shouldShow = isOwner && !isVerified;

    verificationCard.hidden = !shouldShow;
    verificationCard.style.display = shouldShow ? "block" : "none";
    verificationCard.setAttribute('aria-hidden', String(!shouldShow));
  }

  const avatarUploadOverlay = document.getElementById("avatarUploadOverlay");
  const avatarUploadInput = document.getElementById("avatarUploadInput");
  if (avatarUploadOverlay && avatarUploadInput) {
    const shouldAllowEdit = window.PentagramPageContext?.isOwnerProfile && Boolean(window._pentagramIsEditMode);
    if (shouldAllowEdit) {
      avatarUploadOverlay.hidden = false;
      avatarUploadOverlay.removeAttribute("aria-hidden");
      avatarUploadInput.disabled = false;
      avatarUploadInput.onchange = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("avatar", file);
        formData.append("username", data.username);
        try {
          const res = await fetch(`${API_BASE_URL}/api/profile/upload-avatar`, { method: "POST", body: formData });
          const result = await res.json();
          if (res.ok) {
            avatarImg.src = result.avatarUrl;
            avatarImg.style.display = "block";
            defaultSvg.style.display = "none";
            
            // อัปเดตรูปลง Cache บราวเซอร์และสั่งโหลดใหม่ในหน้านี้ทันที
            sessionStorage.setItem("currentUserAvatar", result.avatarUrl);
            if (typeof window.loadPentagramCurrentUserAvatar === 'function') {
              window.loadPentagramCurrentUserAvatar();
            }

            alert("Profile picture uploaded successfully");
          } else {
            alert(result.error || "An error occurred while uploading");
          }
        } catch (err) {
          alert("Unable to contact the server");
        }
      };
    } else {
      avatarUploadOverlay.hidden = true;
      avatarUploadOverlay.setAttribute("aria-hidden", "true");
      avatarUploadInput.disabled = true;
    }
  }
}

function setupOwnerProfileActions() {
  const settingsButton = document.getElementById("settings-btn");
  const shareButton = document.getElementById("share-profile-btn");
  const logoutButton = document.getElementById("logout-btn");
  const isOwnerProfile = Boolean(window.PentagramPageContext?.isOwnerProfile);

  // สร้าง URL แบบ share token ชี้ไปที่ share-profile.html?t=
  function getPublicProfileUrl(shareId) {
    const base = new URL("share-profile.html", window.location.href);
    base.searchParams.set("t", shareId);
    return base.toString();
  }

  if (settingsButton) {
    settingsButton.hidden = !isOwnerProfile;
    if (!isOwnerProfile) settingsButton.setAttribute("aria-hidden", "true");
    settingsButton.innerHTML = '<i class="fas fa-gear"></i> <span>Settings</span>';

    settingsButton.addEventListener("click", async () => {
      if (!isOwnerProfile) return;

      if (!window._pentagramIsEditMode) {
        window._pentagramIsEditMode = true;
        setOwnerSettingsVisibility(true);
        settingsButton.innerHTML = '<i class="fas fa-check"></i> <span>Save & Close</span>';
        settingsButton.classList.add("editing-active");

        const trophyManageBtn = document.getElementById('trophyManageBtn');
        const achievementManageBtn = document.getElementById('achievementManageBtn');
        if (trophyManageBtn) trophyManageBtn.hidden = false;
        if (achievementManageBtn) achievementManageBtn.hidden = false;

        setMediaManageMode('trophy', window.mediaManageModes.trophy);
        setMediaManageMode('achievement', window.mediaManageModes.achievement);
        renderProfileSummary(window.profileData);
        renderSkillTags(window.profileData?.skillTags || []);
        renderTrophy(window.mediaCollectionsCache.trophy);
        renderAchievements(window.mediaCollectionsCache.achievement);
        return;
      }

      settingsButton.disabled = true;
      const prevHtml = settingsButton.innerHTML;
      settingsButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Saving...</span>';
      let saveSucceeded = false;

      try {
        if (Array.isArray(window.selectedSkillsState)) {
          if (window.profileData) window.profileData.skillTags = [...window.selectedSkillsState];
          const response = await fetch(`${API_BASE_URL}/api/profile/update-skills`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: getResolvedProfileUsername(), skillTags: window.selectedSkillsState })
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'Failed to save skills');
          }
        }

        window.mediaManageModes.trophy = false;
        window.mediaManageModes.achievement = false;

        window._pentagramIsEditMode = false;
        setOwnerSettingsVisibility(false);
        settingsButton.classList.remove("editing-active");
        settingsButton.innerHTML = '<i class="fas fa-gear"></i> <span>Settings</span>';

        const trophyManageBtn2 = document.getElementById('trophyManageBtn');
        const achievementManageBtn2 = document.getElementById('achievementManageBtn');
        const addTrophyBtn = document.getElementById('addTrophyBtn');
        const addAchievementBtn = document.getElementById('addAchievementBtn');
        if (trophyManageBtn2) trophyManageBtn2.hidden = true;
        if (achievementManageBtn2) achievementManageBtn2.hidden = true;
        if (addTrophyBtn) addTrophyBtn.hidden = true;
        if (addAchievementBtn) addAchievementBtn.hidden = true;
        saveSucceeded = true;
      } catch (err) {
        console.error('Error saving profile edits:', err);
        alert('Unable to save changes. Please try again.');
        window._pentagramIsEditMode = true;
        setOwnerSettingsVisibility(true);
        settingsButton.classList.add("editing-active");
        settingsButton.innerHTML = prevHtml;
      } finally {
        settingsButton.disabled = false;
        renderProfileSummary(window.profileData);
        renderSkillTags(window.profileData?.skillTags || []);
        renderTrophy(window.mediaCollectionsCache?.trophy || []);
        renderAchievements(window.mediaCollectionsCache?.achievement || []);
      }

      if (saveSucceeded) {
        loadProfileData().catch((reloadErr) => {
          console.warn('Profile reload after save failed:', reloadErr);
        });
      }
    });
  }

  if (shareButton) {
    shareButton.addEventListener("click", async () => {
      let shareId = window.profileData?.shareId;

      if (isOwnerProfile) {
        const token = localStorage.getItem("token") || "";
        try {
          shareButton.disabled = true;
          const res = await fetch(`${API_BASE_URL}/api/profile/regenerate-share`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error("Regenerate failed");
          const result = await res.json();
          shareId = result.shareId;
          if (window.profileData) window.profileData.shareId = shareId; // อัปเดตใน memory ด้วย
        } catch (err) {
          console.error("[Share] Failed to regenerate share token:", err);
          alert("Could not generate share link. Please try again.");
          shareButton.disabled = false;
          return;
        } finally {
          shareButton.disabled = false;
        }
      }

      if (!shareId) {
        alert("Share link is not available yet. Please try again.");
        return;
      }

      const profileUrl = getPublicProfileUrl(shareId);
      try {
        await navigator.clipboard.writeText(profileUrl);
        alert("Share link copied. Previous links are now invalid.");
      } catch (err) {
        window.prompt("Copy this share link:", profileUrl);
      }
    });
  }

  if (logoutButton) {
    logoutButton.hidden = !isOwnerProfile;
    if (!isOwnerProfile) logoutButton.setAttribute("aria-hidden", "true");
    logoutButton.addEventListener("click", () => {
      if (!window.confirm("Log out from this account?")) return;
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      sessionStorage.clear();
      window.location.href = "index.html";
    });
  }
}
