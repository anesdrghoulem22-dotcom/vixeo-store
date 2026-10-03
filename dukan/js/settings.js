/* =========================================================
   DUKAN — إعدادات الحساب (الصورة، اسم المتجر، واتساب، كلمة المرور)
   ========================================================= */
import { DB } from "./db.js";
import { Auth } from "./auth.js";
import { Dashboard } from "./dashboard.js";

export const Settings = (() => {
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function init() {
    const seller = await Auth.guardDashboard();
    if (!seller) return;

    document.getElementById("sellerName").textContent = seller.name;
    Dashboard.renderAvatar(seller);
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await Auth.logout();
      window.location.href = "login.html";
    });

    // ---------- نموذج الملف الشخصي ----------
    const profileForm = document.getElementById("profileForm");
    const avatarPreview = document.getElementById("avatarPreview");
    const avatarFile = document.getElementById("avatarFile");
    let newAvatar = seller.avatar || "";

    if (seller.avatar) {
      avatarPreview.innerHTML = `<img src="${seller.avatar}" class="avatar-img">`;
    } else {
      avatarPreview.textContent = seller.name.trim().charAt(0) || "د";
    }

    profileForm.elements.name.value = seller.name;
    profileForm.elements.whatsapp.value = seller.whatsapp || "";

    avatarFile.addEventListener("change", async () => {
      const file = avatarFile.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) {
        alert("الصورة كبيرة جداً (الحد الأقصى تقريباً 500KB). استخدم صورة أصغر.");
        avatarFile.value = "";
        return;
      }
      newAvatar = await fileToBase64(file);
      avatarPreview.innerHTML = `<img src="${newAvatar}" class="avatar-img">`;
    });

    const profileMsg = document.getElementById("profileMsg");
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = profileForm.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "جارٍ الحفظ…";
      profileMsg.classList.add("hidden");
      try {
        await Auth.updateProfile(seller.id, {
          name: profileForm.elements.name.value,
          whatsapp: profileForm.elements.whatsapp.value,
          avatar: newAvatar,
        });
        profileMsg.textContent = "تم حفظ التعديلات بنجاح ✓";
        profileMsg.className = "text-sm mt-2";
        profileMsg.style.color = "var(--c-primary)";
        profileMsg.classList.remove("hidden");
        document.getElementById("sellerName").textContent = profileForm.elements.name.value;
      } catch (err) {
        profileMsg.textContent = err.message || "تعذّر الحفظ.";
        profileMsg.className = "auth-error text-sm mt-2";
        profileMsg.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "حفظ التعديلات";
      }
    });

    // ---------- نموذج صفحة المتجر العامة (الغلاف، النبذة، شبكات التواصل) ----------
    const storeForm = document.getElementById("storeProfileForm");
    const bannerFile = document.getElementById("bannerFile");
    const bannerPreview = document.getElementById("bannerPreview");
    let newBanner = seller.storeProfile?.banner || "";

    if (newBanner) {
      bannerPreview.src = newBanner;
      bannerPreview.classList.remove("hidden");
    }
    storeForm.elements.bio.value = seller.storeProfile?.bio || "";
    storeForm.elements.instagram.value = seller.storeProfile?.instagram || "";
    storeForm.elements.facebook.value = seller.storeProfile?.facebook || "";
    storeForm.elements.tiktok.value = seller.storeProfile?.tiktok || "";

    bannerFile.addEventListener("change", async () => {
      const file = bannerFile.files[0];
      if (!file) return;
      if (file.size > 700 * 1024) {
        alert("الصورة كبيرة جداً (الحد الأقصى تقريباً 700KB). استخدم صورة أصغر.");
        bannerFile.value = "";
        return;
      }
      newBanner = await fileToBase64(file);
      bannerPreview.src = newBanner;
      bannerPreview.classList.remove("hidden");
    });

    const storeMsg = document.getElementById("storeProfileMsg");
    storeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = storeForm.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "جارٍ الحفظ…";
      storeMsg.classList.add("hidden");
      try {
        await DB.saveStoreProfile(seller.id, {
          banner: newBanner,
          bio: storeForm.elements.bio.value.trim(),
          instagram: storeForm.elements.instagram.value.trim(),
          facebook: storeForm.elements.facebook.value.trim(),
          tiktok: storeForm.elements.tiktok.value.trim(),
        });
        storeMsg.textContent = "تم حفظ صفحة المتجر بنجاح ✓";
        storeMsg.className = "text-sm mt-2";
        storeMsg.style.color = "var(--c-primary)";
        storeMsg.classList.remove("hidden");
      } catch (err) {
        console.error("[storeProfile.save]", err);
        storeMsg.textContent = "تعذّر الحفظ — راجع قواعد Firestore.";
        storeMsg.className = "auth-error text-sm mt-2";
        storeMsg.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "حفظ صفحة المتجر";
      }
    });

    // ---------- نموذج تغيير كلمة المرور ----------
    const passForm = document.getElementById("passwordForm");
    const passMsg = document.getElementById("passwordMsg");
    passForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(passForm);
      const newPass = fd.get("newPassword");
      const confirmPass = fd.get("confirmPassword");
      passMsg.classList.add("hidden");

      if (newPass !== confirmPass) {
        passMsg.textContent = "كلمتا المرور الجديدتان غير متطابقتين.";
        passMsg.className = "auth-error text-sm mt-2";
        passMsg.classList.remove("hidden");
        return;
      }

      const btn = passForm.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "جارٍ التحديث…";
      try {
        await Auth.changePassword(fd.get("currentPassword"), newPass);
        passMsg.textContent = "تم تغيير كلمة المرور بنجاح ✓";
        passMsg.className = "text-sm mt-2";
        passMsg.style.color = "var(--c-primary)";
        passMsg.classList.remove("hidden");
        passForm.reset();
      } catch (err) {
        passMsg.textContent = err.message || "تعذّر تغيير كلمة المرور.";
        passMsg.className = "auth-error text-sm mt-2";
        passMsg.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "تحديث كلمة المرور";
      }
    });
  }

  return { init };
})();
