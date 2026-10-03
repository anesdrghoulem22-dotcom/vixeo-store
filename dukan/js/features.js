/* =========================================================
   DUKAN — ميزات لوحة التحكم المتقدمة
   (الموظفون، القائمة السوداء، الكوبونات، البيكسل، الإحصائيات)
   ========================================================= */
import { DB } from "./db.js";
import { Auth } from "./auth.js";

export const Features = (() => {
  function money(n) {
    return new Intl.NumberFormat("ar-DZ").format(n) + " د.ج";
  }
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : str;
    return d.innerHTML;
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("ar-DZ", { year: "numeric", month: "2-digit", day: "2-digit" });
  }
  function toast(text, isError = false) {
    let el = document.getElementById("featureToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "featureToast";
      document.body.appendChild(el);
    }
    el.className = isError ? "feature-toast is-error" : "feature-toast";
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add("hidden"), 3000);
  }

  /* ============ 0) التنبيهات (مخزون منخفض + محاولات محظورة) ============ */
  async function initAlerts(seller) {
    const wrap = document.getElementById("alertsWrap");
    if (!wrap) return;

    const [lowStock, attempts] = await Promise.all([
      DB.getLowStockProducts(seller.id),
      DB.getBlacklistAttempts(seller.id),
    ]);

    const newAttempts = attempts.filter((a) => !a.seen);
    const out = [];

    if (newAttempts.length) {
      out.push(`
        <div class="alert-box alert-danger">
          <div class="alert-head">
            <strong>🚫 ${newAttempts.length} محاولة طلب من أرقام محظورة</strong>
            <button class="alert-dismiss" id="dismissAttempts">تمّت المراجعة</button>
          </div>
          <ul class="alert-list">
            ${newAttempts.slice(0, 5).map((a) => `
              <li><span class="font-mono">${esc(a.phone)}</span>
                ${a.name ? ` — ${esc(a.name)}` : ""}
                <span class="tile-cat">${fmtDate(a.createdAt)}</span></li>`).join("")}
          </ul>
        </div>`);
    }

    const outOfStock = lowStock.filter((p) => (p.stock ?? 0) === 0);
    const running = lowStock.filter((p) => (p.stock ?? 0) > 0);

    if (outOfStock.length || running.length) {
      out.push(`
        <div class="alert-box alert-warn">
          <div class="alert-head">
            <strong>📦 تنبيه المخزون</strong>
          </div>
          <ul class="alert-list">
            ${outOfStock.map((p) => `
              <li><span class="stock-pill stock-out">نفد</span> ${esc(p.name)}</li>`).join("")}
            ${running.map((p) => `
              <li><span class="stock-pill stock-low">${p.stock}</span> ${esc(p.name)} — أوشك على النفاد</li>`).join("")}
          </ul>
        </div>`);
    }

    wrap.innerHTML = out.join("");

    const dismiss = document.getElementById("dismissAttempts");
    if (dismiss) {
      dismiss.addEventListener("click", async () => {
        await DB.markAttemptsSeen(seller.id);
        await initAlerts(seller);
      });
    }
  }

  /* ============ 1) الموظفون ============ */
  async function initStaff(seller) {
    const tbody = document.getElementById("staffBody");
    const empty = document.getElementById("staffEmpty");
    const permsWrap = document.getElementById("staffPerms");

    permsWrap.innerHTML = DB.STAFF_PERMISSIONS.map((p) => `
      <label class="perm-item">
        <input type="checkbox" name="perm" value="${p.id}">
        <span>${p.label}</span>
      </label>`).join("");

    async function render() {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-400">جارٍ التحميل…</td></tr>`;
      const list = await DB.getStaff(seller.id);
      empty.classList.toggle("hidden", list.length > 0);
      tbody.innerHTML = list.map((s) => {
        const labels = (s.permissions || [])
          .map((id) => DB.STAFF_PERMISSIONS.find((p) => p.id === id)?.label)
          .filter(Boolean);
        return `
        <tr data-id="${s.id}">
          <td>
            <div class="font-medium">${esc(s.name)}</div>
            <div class="tile-cat">${esc(s.email || s.phone || "—")}</div>
          </td>
          <td class="text-sm">${labels.length ? labels.map((l) => `<span class="perm-chip">${esc(l)}</span>`).join(" ") : "<span class='tile-cat'>بلا صلاحيات</span>"}</td>
          <td><span class="admin-chip ${s.active ? "chip-active" : "chip-expired"}">${s.active ? "نشط" : "موقوف"}</span></td>
          <td class="text-left whitespace-nowrap">
            <button class="table-btn" data-toggle>${s.active ? "إيقاف" : "تفعيل"}</button>
            <button class="table-btn table-btn-danger" data-del>حذف</button>
          </td>
        </tr>`;
      }).join("");
    }

    document.getElementById("staffForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const permissions = [...e.target.querySelectorAll("input[name=perm]:checked")].map((i) => i.value);
      if (!permissions.length) return toast("اختر صلاحية واحدة على الأقل.", true);

      // التحقق من الحد الأقصى لعدد الموظفين حسب خطة الاشتراك النشطة
      const status = Auth.getAccountStatus(seller);
      if (status.state === "subscribed") {
        const plan = DB.getPlan(seller.subscription.plan);
        if (plan && plan.maxStaff != null) {
          const current = await DB.getStaff(seller.id);
          if (current.length >= plan.maxStaff) {
            return toast(`وصلت للحد الأقصى (${plan.maxStaff}) من الموظفين في خطة "${plan.name}" — رقّي اشتراكك لإضافة المزيد.`, true);
          }
        }
      } else if (status.state === "trial") {
        // في الفترة التجريبية: حد افتراضي بسيط (موظف واحد) قبل الاشتراك الفعلي
        const current = await DB.getStaff(seller.id);
        if (current.length >= 1) {
          return toast("أضف اشتراكاً فعّالاً لإضافة أكثر من موظف واحد.", true);
        }
      }

      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await DB.addStaff({
          sellerId: seller.id,
          name: (fd.get("name") || "").trim(),
          email: (fd.get("email") || "").trim().toLowerCase(),
          phone: (fd.get("phone") || "").trim(),
          permissions,
          active: true,
        });
        e.target.reset();
        toast("تمت إضافة الموظف ✓");
        await render();
      } catch (err) {
        console.error("[staff.add]", err);
        toast("تعذّر الحفظ — راجع قواعد Firestore.", true);
      } finally {
        btn.disabled = false;
      }
    });

    tbody.addEventListener("click", async (e) => {
      const row = e.target.closest("tr[data-id]");
      if (!row) return;
      const id = row.dataset.id;
      try {
        if (e.target.closest("[data-del]")) {
          if (!confirm("حذف هذا الموظف نهائياً؟")) return;
          await DB.deleteStaff(id);
        } else if (e.target.closest("[data-toggle]")) {
          const isActive = e.target.textContent.trim() === "إيقاف";
          await DB.updateStaff(id, { active: !isActive });
        } else return;
        await render();
      } catch (err) {
        console.error("[staff.action]", err);
        toast("تعذّر تنفيذ العملية.", true);
      }
    });

    await render();
  }

  /* ============ 2) القائمة السوداء ============ */
  async function initBlacklist(seller) {
    const tbody = document.getElementById("blacklistBody");
    const empty = document.getElementById("blacklistEmpty");

    async function render() {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-400">جارٍ التحميل…</td></tr>`;
      const list = await DB.getBlacklist(seller.id);
      empty.classList.toggle("hidden", list.length > 0);
      tbody.innerHTML = list.map((b) => `
        <tr data-id="${b.id}">
          <td class="font-mono">${esc(b.phone)}</td>
          <td>${esc(b.name || "—")}</td>
          <td class="text-sm">${esc(b.reason || "—")}</td>
          <td class="text-left">
            <span class="tile-cat">${fmtDate(b.createdAt)}</span>
            <button class="table-btn table-btn-danger" data-del>إزالة</button>
          </td>
        </tr>`).join("");
    }

    document.getElementById("blacklistForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await DB.addToBlacklist({
          sellerId: seller.id,
          phone: fd.get("phone"),
          name: (fd.get("name") || "").trim(),
          reason: (fd.get("reason") || "").trim(),
        });
        e.target.reset();
        toast("تمت إضافة الرقم للقائمة السوداء ✓");
        await render();
      } catch (err) {
        console.error("[blacklist.add]", err);
        toast("تعذّر الحفظ.", true);
      } finally {
        btn.disabled = false;
      }
    });

    tbody.addEventListener("click", async (e) => {
      if (!e.target.closest("[data-del]")) return;
      const id = e.target.closest("tr[data-id]").dataset.id;
      if (!confirm("إزالة هذا الرقم من القائمة السوداء؟")) return;
      await DB.removeFromBlacklist(id);
      await render();
    });

    await render();
  }

  /* ============ 3) الكوبونات ============ */
  async function initCoupons(seller) {
    const tbody = document.getElementById("couponsBody");
    const empty = document.getElementById("couponsEmpty");

    async function render() {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">جارٍ التحميل…</td></tr>`;
      const list = await DB.getCoupons(seller.id);
      empty.classList.toggle("hidden", list.length > 0);
      tbody.innerHTML = list.map((c) => {
        const val = c.type === "percent" ? `${c.value}%` : money(c.value);
        const expired = c.expiresAt && c.expiresAt < Date.now();
        return `
        <tr data-id="${c.id}">
          <td><span class="coupon-code">${esc(c.code)}</span></td>
          <td class="font-bold">${val}</td>
          <td class="text-sm">${c.used || 0}${c.maxUses ? ` / ${c.maxUses}` : ""}</td>
          <td>
            <span class="admin-chip ${expired ? "chip-expired" : c.active ? "chip-active" : "chip-none"}">
              ${expired ? "منتهي" : c.active ? "مفعّل" : "موقوف"}
            </span>
            ${c.expiresAt ? `<div class="tile-cat">حتى ${fmtDate(c.expiresAt)}</div>` : ""}
          </td>
          <td class="text-left whitespace-nowrap">
            <button class="table-btn" data-toggle data-active="${c.active ? "1" : "0"}">${c.active ? "إيقاف" : "تفعيل"}</button>
            <button class="table-btn table-btn-danger" data-del>حذف</button>
          </td>
        </tr>`;
      }).join("");
    }

    document.getElementById("couponForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const type = fd.get("type");
      const value = Number(fd.get("value"));
      if (type === "percent" && (value <= 0 || value > 100)) {
        return toast("نسبة الخصم يجب أن تكون بين 1 و 100.", true);
      }
      const expires = fd.get("expiresAt");
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await DB.addCoupon({
          sellerId: seller.id,
          code: fd.get("code"),
          type,
          value,
          minOrder: Number(fd.get("minOrder")) || 0,
          maxUses: Number(fd.get("maxUses")) || 0,
          // نهاية اليوم بالتوقيت المحلي (وليس منتصف الليل UTC) حتى لا ينتهي الكوبون قبل موعده بساعات
          expiresAt: expires ? new Date(expires + "T23:59:59").getTime() : null,
          active: true,
        });
        e.target.reset();
        toast("تم إنشاء الكوبون ✓");
        await render();
      } catch (err) {
        console.error("[coupon.add]", err);
        toast("تعذّر الحفظ.", true);
      } finally {
        btn.disabled = false;
      }
    });

    tbody.addEventListener("click", async (e) => {
      const row = e.target.closest("tr[data-id]");
      if (!row) return;
      const id = row.dataset.id;
      if (e.target.closest("[data-del]")) {
        if (!confirm("حذف هذا الكوبون؟")) return;
        await DB.deleteCoupon(id);
      } else if (e.target.closest("[data-toggle]")) {
        const btn = e.target.closest("[data-toggle]");
        await DB.updateCoupon(id, { active: btn.dataset.active !== "1" });
      } else return;
      await render();
    });

    await render();
  }

  /* ============ 4) البيكسل والتسويق ============ */
  async function initPixels(seller) {
    const form = document.getElementById("pixelsForm");
    const p = seller.pixels || {};
    form.elements.facebook.value = p.facebook || "";
    form.elements.tiktok.value = p.tiktok || "";
    form.elements.snapchat.value = p.snapchat || "";
    form.elements.googleAnalytics.value = p.googleAnalytics || "";
    form.elements.googleTagManager.value = p.googleTagManager || "";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "جارٍ الحفظ…";
      try {
        await DB.savePixels(seller.id, {
          facebook: form.elements.facebook.value.trim(),
          tiktok: form.elements.tiktok.value.trim(),
          snapchat: form.elements.snapchat.value.trim(),
          googleAnalytics: form.elements.googleAnalytics.value.trim(),
          googleTagManager: form.elements.googleTagManager.value.trim(),
        });
        toast("تم حفظ إعدادات البيكسل ✓");
      } catch (err) {
        console.error("[pixels.save]", err);
        toast("تعذّر الحفظ.", true);
      } finally {
        btn.disabled = false;
        btn.textContent = "حفظ إعدادات التتبع";
      }
    });
  }

  /* ============ 5) الإحصائيات ============ */
  async function initAnalytics(seller) {
    const wrap = document.getElementById("analyticsWrap");
    wrap.innerHTML = `<p class="text-center py-10 text-gray-400">جارٍ حساب الإحصائيات…</p>`;

    const [orders, products, visits] = await Promise.all([
      DB.getOrdersForSeller(seller.id),
      DB.getProductsBySeller(seller.id),
      DB.getVisits(seller.id, 30),
    ]);

    const revenue = orders.reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.qty, 0), 0);
    const completed = orders.filter((o) => o.status === "تم التسليم");
    const cancelled = orders.filter((o) => o.status === "ملغى");
    const totalVisits = visits.reduce((s, v) => s + (v.count || 0), 0);
    const convRate = totalVisits ? ((orders.length / totalVisits) * 100).toFixed(1) : "0.0";
    const avgOrder = orders.length ? Math.round(revenue / orders.length) : 0;

    // المنتجات الأكثر مبيعاً
    const sales = {};
    orders.forEach((o) => o.items.forEach((it) => {
      if (!sales[it.productId]) sales[it.productId] = { name: it.name, qty: 0, total: 0 };
      sales[it.productId].qty += it.qty;
      sales[it.productId].total += it.price * it.qty;
    }));
    const topProducts = Object.values(sales).sort((a, b) => b.qty - a.qty).slice(0, 5);

    // زيارات آخر 14 يوم كرسم بياني بسيط
    const last14 = visits.slice(-14);
    const maxVisit = Math.max(1, ...last14.map((v) => v.count || 0));

    wrap.innerHTML = `
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="stat-card"><p class="stat-value">${totalVisits}</p><p class="stat-label">زيارة (30 يوم)</p></div>
        <div class="stat-card"><p class="stat-value">${orders.length}</p><p class="stat-label">إجمالي الطلبات</p></div>
        <div class="stat-card"><p class="stat-value">${money(revenue)}</p><p class="stat-label">إجمالي المبيعات</p></div>
        <div class="stat-card"><p class="stat-value">${convRate}%</p><p class="stat-label">نسبة التحويل</p></div>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="stat-card"><p class="stat-value">${completed.length}</p><p class="stat-label">طلب تم تسليمه</p></div>
        <div class="stat-card"><p class="stat-value">${cancelled.length}</p><p class="stat-label">طلب ملغي</p></div>
        <div class="stat-card"><p class="stat-value">${money(avgOrder)}</p><p class="stat-label">متوسط قيمة الطلب</p></div>
        <div class="stat-card"><p class="stat-value">${products.length}</p><p class="stat-label">منتج منشور</p></div>
      </div>

      <div class="settings-card">
        <h3 class="font-display mb-4">الزيارات — آخر 14 يوم</h3>
        ${last14.length ? `
          <div class="mini-chart">
            ${last14.map((v) => `
              <div class="mini-bar-wrap" title="${v.day}: ${v.count} زيارة">
                <div class="mini-bar" style="height:${Math.max(4, ((v.count || 0) / maxVisit) * 100)}%"></div>
                <span class="mini-label">${v.day.slice(8)}</span>
              </div>`).join("")}
          </div>` : `<p class="text-gray-400 text-sm">لا توجد بيانات زيارات بعد.</p>`}
      </div>

      <div class="settings-card">
        <h3 class="font-display mb-4">المنتجات الأكثر مبيعاً</h3>
        ${topProducts.length ? `
          <table class="dash-table">
            <thead><tr><th>المنتج</th><th>الكمية المباعة</th><th>الإيراد</th></tr></thead>
            <tbody>
              ${topProducts.map((p) => `
                <tr>
                  <td class="font-medium">${esc(p.name)}</td>
                  <td>${p.qty}</td>
                  <td class="font-bold">${money(p.total)}</td>
                </tr>`).join("")}
            </tbody>
          </table>` : `<p class="text-gray-400 text-sm">لا توجد مبيعات بعد.</p>`}
      </div>`;
  }

  async function initAll(seller) {
    // كل قسم مستقل — فشل أحدها لا يوقف البقية
    const tasks = [
      ["alerts", initAlerts],
      ["staff", initStaff],
      ["blacklist", initBlacklist],
      ["coupons", initCoupons],
      ["pixels", initPixels],
      ["analytics", initAnalytics],
    ];
    for (const [name, fn] of tasks) {
      try {
        await fn(seller);
      } catch (err) {
        console.error(`[Features.${name}]`, err);
      }
    }
  }

  return { initAll, initAlerts, initStaff, initBlacklist, initCoupons, initPixels, initAnalytics, toast };
})();
