/* =========================================================
   DUKAN — المصادقة (Firebase Auth) + التجربة المجانية + الاشتراكات
   ========================================================= */
import { auth, db } from "./firebase-config.js";
import { DB } from "./db.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as fbUpdatePassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const Auth = (() => {
  const DAY = 86400000;

  function friendlyError(err) {
    const map = {
      "auth/email-already-in-use": "هذا البريد الإلكتروني مسجل مسبقاً، جرّب تسجيل الدخول.",
      "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
      "auth/weak-password": "كلمة المرور ضعيفة جداً، استخدم 6 أحرف على الأقل.",
      "auth/user-not-found": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      "auth/wrong-password": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      "auth/too-many-requests": "محاولات كثيرة فاشلة، حاول لاحقاً.",
      "auth/network-request-failed": "تعذّر الاتصال — تحقق من اتصالك بالإنترنت ومن إعدادات Firebase (ملف firebase-config.js).",
      "auth/api-key-not-valid": "مفتاح Firebase (apiKey) غير صحيح — تأكد من نسخ بيانات مشروعك بالكامل في js/firebase-config.js.",
      "auth/invalid-api-key": "مفتاح Firebase (apiKey) غير صحيح — تأكد من نسخ بيانات مشروعك بالكامل في js/firebase-config.js.",
    };
    return map[err.code] || err.message || "حدث خطأ غير متوقع.";
  }

  function waitForAuthReady() {
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user);
      });
    });
  }

  async function register({ name, email, password, whatsapp }) {
    email = email.trim().toLowerCase();
    const deviceId = DB.getDeviceId();
    const deviceAlreadyUsedTrial = DB.hasDeviceUsedTrial(deviceId);

    let cred;
    try {
      await setPersistence(auth, browserLocalPersistence);
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("[Auth.register] createUserWithEmailAndPassword failed:", err);
      throw new Error(friendlyError(err));
    }

    const profile = {
      name: name.trim(),
      email,
      whatsapp: (whatsapp || "").replace(/[^0-9]/g, ""),
      avatar: "",
      createdAt: Date.now(),
      deviceId,
      trialStart: deviceAlreadyUsedTrial ? null : Date.now(),
      subscription: { active: false, plan: null, start: null, end: null },
    };

    try {
      await DB.createSellerProfile(cred.user.uid, profile);
    } catch (err) {
      console.error("[Auth.register] createSellerProfile failed:", err);
      throw new Error("تم إنشاء حساب الدخول لكن تعذّر حفظ بيانات المتجر. راجع قواعد Firestore (Rules) في README.");
    }

    if (!deviceAlreadyUsedTrial) DB.markDeviceTrialUsed(deviceId);
    return { id: cred.user.uid, ...profile };
  }

  // remember=true يبقي تسجيل الدخول محفوظاً حتى بعد إغلاق المتصفح (تذكّرني)
  // remember=false يُنهي الجلسة عند إغلاق التبويب/المتصفح
  async function login({ email, password, remember = true }) {
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const seller = await DB.getSellerById(cred.user.uid);
      if (!seller) throw new Error("تعذّر العثور على بيانات المتجر لهذا الحساب.");
      return seller;
    } catch (err) {
      console.error("[Auth.login] failed:", err);
      throw new Error(err.code ? friendlyError(err) : err.message);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  function getAccountStatus(seller) {
    const now = Date.now();
    const sub = seller.subscription;

    if (sub && sub.active && sub.end && sub.end > now) {
      return { state: "subscribed", plan: sub.plan, end: sub.end, msLeft: sub.end - now, daysLeft: Math.ceil((sub.end - now) / DAY) };
    }
    if (seller.trialStart) {
      const trialEnd = seller.trialStart + DB.TRIAL_DAYS * DAY;
      if (trialEnd > now) {
        return { state: "trial", end: trialEnd, msLeft: trialEnd - now, daysLeft: Math.ceil((trialEnd - now) / DAY) };
      }
      return { state: "expired", msLeft: 0 };
    }
    return { state: "no_trial", msLeft: 0 };
  }

  function canAccessDashboard(seller) {
    if (!seller) return false;
    const status = getAccountStatus(seller);
    return status.state === "trial" || status.state === "subscribed";
  }

  async function updateProfile(sellerId, { name, whatsapp, avatar }) {
    const patch = {};
    if (name !== undefined && name.trim()) patch.name = name.trim();
    if (whatsapp !== undefined) patch.whatsapp = (whatsapp || "").replace(/[^0-9]/g, "");
    if (avatar !== undefined) patch.avatar = avatar;
    await DB.updateSellerProfile(sellerId, patch);

    if (patch.name) {
      const products = await DB.getProductsBySeller(sellerId);
      const batch = writeBatch(db);
      products.forEach((p) => batch.update(doc(db, "products", p.id), { sellerName: patch.name }));
      if (products.length) await batch.commit();
    }
    return DB.getSellerById(sellerId);
  }

  async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("يجب تسجيل الدخول أولاً.");
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await fbUpdatePassword(user, newPassword);
    } catch (err) {
      console.error("[Auth.changePassword] failed:", err.code, err.message);
      throw new Error(friendlyError(err));
    }
  }

  async function guardDashboard() {
    const user = await waitForAuthReady();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }
    const seller = await DB.getSellerById(user.uid);
    if (!seller || !canAccessDashboard(seller)) {
      window.location.href = "pricing.html?expired=1";
      return null;
    }
    return seller;
  }

  async function redirectIfLoggedIn() {
    const user = await waitForAuthReady();
    if (!user) return;
    const seller = await DB.getSellerById(user.uid);
    window.location.href = seller && canAccessDashboard(seller) ? "dashboard.html" : "pricing.html";
  }

  return {
    waitForAuthReady, register, login, logout,
    getAccountStatus, canAccessDashboard, updateProfile, changePassword,
    guardDashboard, redirectIfLoggedIn,
  };
})();
