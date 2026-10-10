/* =========================================================
   DUKAN — حارس الاشتراك: شاشة حظر حمراء عند انتهاء الاشتراك
   ========================================================= */
import { DB } from "./db.js";
import { Auth } from "./auth.js";

export const SubGuard = (() => {
  function money(n) {
    return new Intl.NumberFormat("ar-DZ").format(n) + " د.ج";
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  // شاشة حظر كاملة تمنع أي تفاعل مع لوحة التحكم
  function showBlockScreen(seller, status) {
    const reason = status.state === "expired"
      ? "انتهت فترتك التجريبية المجانية."
      : "اشتراكك غير مفعّل حالياً.";

    const overlay = document.createElement("div");
    overlay.className = "block-overlay";
    overlay.innerHTML = `
      <div class="block-card">
        <div class="block-icon">⛔</div>
        <h1 class="block-title">تم إيقاف الوصول للوحة التحكم</h1>
        <p class="block-reason">${reason}</p>
        <p class="block-text">
          متجرك وبياناتك محفوظة بالكامل — جدّد اشتراكك الآن ليعود كل شيء للعمل فوراً.
        </p>
        <div class="block-plans">
          ${DB.PLANS.map((p) => `
            <div class="block-plan${p.featured ? " is-best" : ""}">
              <span class="block-plan-name">${p.name}</span>
              <span class="block-plan-price">${money(p.price)}<small>/شهر</small></span>
            </div>`).join("")}
        </div>
        <a href="pricing.html" class="block-btn">تجديد الاشتراك الآن</a>
        <button id="blockLogout" class="block-link">تسجيل الخروج</button>
      </div>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    document.getElementById("blockLogout").addEventListener("click", async () => {
      await Auth.logout();
      window.location.href = "login.html";
    });
  }

  // شريط تحذير أحمر يظهر في آخر 3 أيام قبل الانتهاء، مع عداد تنازلي
  function showWarningBar(status) {
    const bar = document.createElement("div");
    bar.className = "expiry-warning-bar";
    bar.innerHTML = `
      <span>⚠️ ${status.state === "trial" ? "فترتك التجريبية" : "اشتراكك"} ينتهي خلال
        <strong id="expiryCountdown">—</strong>
      </span>
      <a href="pricing.html" class="expiry-warning-btn">جدّد الآن</a>`;
    document.body.prepend(bar);
    document.body.classList.add("has-warning-bar");

    const el = document.getElementById("expiryCountdown");
    function tick() {
      const left = status.end - Date.now();
      if (left <= 0) {
        window.location.reload();
        return;
      }
      const d = Math.floor(left / 86400000);
      const h = Math.floor(left / 3600000) % 24;
      const m = Math.floor(left / 60000) % 60;
      const s = Math.floor(left / 1000) % 60;
      el.textContent = `${d} يوم ${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  /**
   * يتحقق من الجلسة وحالة الاشتراك ويعرض الحظر عند الحاجة.
   * - صاحب المتجر: يرى متجره.
   * - الموظف: يرى متجر صاحب العمل بصلاحيات محدودة (موسوم بـ __isStaff).
   * يُرجع كائن المتجر الفعّال، أو null إن تم الحظر/التحويل.
   */
  async function enforce() {
    const user = await Auth.waitForAuthReady();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }

    const session = await DB.resolveSession();
    if (!session) {
      window.location.href = "login.html";
      return null;
    }

    // حساب جديد لم يؤكّد بريده بعد → صفحة تأكيد البريد
    if (Auth.emailNeedsVerification(user, session.ownSeller)) {
      window.location.href = "verify-email.html";
      return null;
    }

    // تفضيل الدور (يخزّنه المستخدم عند التبديل بين متجره وفريق العمل)
    const role = localStorage.getItem("dukan_role_" + user.uid);

    // وضع الموظف: الافتراضي للموظفين، إلا إذا اختار صراحةً فتح متجره الخاص
    if (session.isStaff && (role !== "owner" || !session.ownSeller)) {
      const staffSeller = {
        ...session.teamSeller,
        __isStaff: true,
        __staff: session.staff,
        __ownSeller: session.ownSeller || null,
        __uid: user.uid,
      };
      const status = Auth.getAccountStatus(staffSeller);
      if (status.state === "expired" || status.state === "no_trial") {
        showBlockScreen(staffSeller, status);
        return null;
      }
      return staffSeller;
    }

    const seller = session.ownSeller;
    if (!seller) {
      window.location.href = "login.html";
      return null;
    }
    // إن كان أيضاً موظفاً في متجر آخر، نُعلّم الكائن لإظهار زرّ التبديل
    if (session.isStaff) {
      seller.__alsoStaff = { ...session.staff, storeName: session.teamSeller.name };
      seller.__uid = user.uid;
    }

    const status = Auth.getAccountStatus(seller);

    if (status.state === "expired" || status.state === "no_trial") {
      showBlockScreen(seller, status);
      return null;
    }

    // تحذير مبكر في آخر 3 أيام
    const THREE_DAYS = 3 * 86400000;
    if (status.msLeft && status.msLeft < THREE_DAYS) {
      showWarningBar(status);
    }

    return seller;
  }

  return { enforce, showBlockScreen, showWarningBar };
})();
