/* =========================================================
   DUKAN — لوحة الإدارة (تفعيل اشتراكات البائعين)
   الوصول محصور بالبُرد الموجودة في DB.ADMIN_EMAILS
   ========================================================= */
import { DB } from "./db.js";
import { Auth } from "./auth.js";

export const Admin = (() => {
  function money(n) {
    return new Intl.NumberFormat("ar-DZ").format(n) + " د.ج";
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("ar-DZ", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function statusChip(seller) {
    const st = Auth.getAccountStatus(seller);
    if (st.state === "subscribed") {
      const label = DB.getPlan(st.plan)?.name || "شهري";
      return `<span class="admin-chip chip-active">مشترك "${label}" — ${st.daysLeft} يوم</span>`;
    }
    if (st.state === "trial") return `<span class="admin-chip chip-trial">تجريبي — ${st.daysLeft} يوم</span>`;
    if (st.state === "expired") return `<span class="admin-chip chip-expired">منتهي</span>`;
    return `<span class="admin-chip chip-none">بلا تجربة</span>`;
  }

  let allSellers = [];

  function renderTable(list) {
    const tbody = document.getElementById("sellersBody");
    const empty = document.getElementById("sellersEmpty");
    empty.classList.toggle("hidden", list.length > 0);

    tbody.innerHTML = list.map((s) => `
      <tr data-id="${s.id}" data-email="${(s.email || "").toLowerCase()}">
        <td>
          <div class="font-medium">${escapeHtml(s.name || "—")}</div>
          <div class="tile-cat">${escapeHtml(s.email || "—")}</div>
        </td>
        <td>${statusChip(s)}</td>
        <td class="text-sm">${fmtDate(s.subscription?.end)}</td>
        <td class="text-left whitespace-nowrap">
          ${DB.PLANS.map((p) => `<button class="table-btn" data-activate="${p.id}">فعّل ${p.name}</button>`).join("")}
          <button class="table-btn table-btn-danger" data-cancel>إلغاء</button>
        </td>
      </tr>`).join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function applyFilter() {
    const q = (document.getElementById("adminSearch").value || "").trim().toLowerCase();
    const filtered = !q
      ? allSellers
      : allSellers.filter((s) =>
          (s.email || "").toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q));
    renderTable(filtered);
  }

  async function reload() {
    const tbody = document.getElementById("sellersBody");
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-gray-400">جارٍ التحميل…</td></tr>`;
    try {
      allSellers = await DB.getAllSellers();
    } catch (err) {
      console.error("[Admin.reload]", err);
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-red-500">
        تعذّر تحميل قائمة البائعين — تأكد أن قواعد Firestore تسمح للمشرف بقراءة مجموعة sellers (راجع README).
      </td></tr>`;
      return;
    }
    applyFilter();
    document.getElementById("statTotal").textContent = allSellers.length;
    document.getElementById("statSubscribed").textContent =
      allSellers.filter((s) => Auth.getAccountStatus(s).state === "subscribed").length;
    document.getElementById("statTrial").textContent =
      allSellers.filter((s) => Auth.getAccountStatus(s).state === "trial").length;
  }

  function toast(text, isError = false) {
    const el = document.getElementById("adminToast");
    el.textContent = text;
    el.className = isError ? "admin-toast is-error" : "admin-toast";
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3500);
  }

  async function init() {
    // حارس الوصول: لازم مسجّل دخول + بريده ضمن قائمة المشرفين
    const user = await Auth.waitForAuthReady();
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (!DB.isAdminEmail(user.email)) {
      document.body.innerHTML = `
        <div class="auth-shell">
          <div class="auth-card text-center">
            <h1 class="font-display text-xl mb-3">غير مصرّح لك</h1>
            <p class="text-sm text-gray-600 mb-6">هذه الصفحة مخصصة لإدارة المنصة فقط.</p>
            <a href="dashboard.html" class="btn-primary">العودة للوحة التحكم</a>
          </div>
        </div>`;
      return;
    }

    document.getElementById("adminEmail").textContent = user.email;
    document.getElementById("adminShell").classList.remove("hidden");

    document.getElementById("quickPlanSelect").innerHTML = DB.PLANS.map((p) =>
      `<option value="${p.id}">${p.name} — ${money(p.price)}/شهر</option>`
    ).join("");

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await Auth.logout();
      window.location.href = "login.html";
    });
    document.getElementById("refreshBtn").addEventListener("click", reload);
    document.getElementById("adminSearch").addEventListener("input", applyFilter);

    // تفعيل سريع بالبريد من النموذج العلوي
    document.getElementById("quickForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = (fd.get("email") || "").trim().toLowerCase();
      const plan = fd.get("plan");
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "جارٍ التفعيل…";
      try {
        const seller = await DB.getSellerByEmail(email);
        if (!seller) {
          toast("لا يوجد بائع مسجّل بهذا البريد الإلكتروني.", true);
        } else {
          await DB.activateSubscription(seller.id, plan);
          toast(`تم تفعيل اشتراك "${DB.getPlan(plan)?.name}" لـ ${seller.name} ✓`);
          e.target.reset();
          await reload();
        }
      } catch (err) {
        console.error("[Admin.quickActivate]", err);
        toast("تعذّر التفعيل — راجع قواعد Firestore (Rules).", true);
      } finally {
        btn.disabled = false;
        btn.textContent = "تفعيل الاشتراك";
      }
    });

    // أزرار الجدول
    document.getElementById("sellersBody").addEventListener("click", async (e) => {
      const row = e.target.closest("tr[data-id]");
      if (!row) return;
      const id = row.dataset.id;
      const activateBtn = e.target.closest("[data-activate]");
      const cancelBtn = e.target.closest("[data-cancel]");

      try {
        if (activateBtn) {
          const plan = activateBtn.dataset.activate;
          const label = DB.getPlan(plan)?.name || plan;
          if (!confirm(`تفعيل اشتراك "${label}" لهذا البائع؟`)) return;
          await DB.activateSubscription(id, plan);
          toast(`تم تفعيل اشتراك "${label}" ✓`);
          await reload();
        } else if (cancelBtn) {
          if (!confirm("إلغاء اشتراك هذا البائع؟ سيفقد الوصول للوحة التحكم.")) return;
          await DB.cancelSubscription(id);
          toast("تم إلغاء الاشتراك.");
          await reload();
        }
      } catch (err) {
        console.error("[Admin.tableAction]", err);
        toast("تعذّر تنفيذ العملية — راجع قواعد Firestore (Rules).", true);
      }
    });

    await reload();
  }

  return { init };
})();
