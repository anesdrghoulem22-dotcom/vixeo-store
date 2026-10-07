/* =========================================================
   DUKAN — لوحة الإدارة الشاملة
   تحكم كامل: البائعون والاشتراكات والتجارب، المنتجات، الطلبات،
   الكوبونات، الموظفون، القوائم السوداء، التصدير والتنظيف.
   الوصول محصور بالبُرد الموجودة في DB.ADMIN_EMAILS
   ملاحظة: يلزم تحديث قواعد Firestore (ملف firestore.rules المرفق).
   ========================================================= */
import { db } from "./firebase-config.js";
import {
  collection, doc, getDocs, updateDoc, deleteDoc, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { DB } from "./db.js";
import { Auth } from "./auth.js";

export const Admin = (() => {
  const DAY = 86400000;
  const PAGE_SIZE = 25;

  // ---------- الحالة ----------
  const S = {
    sellers: [], products: [], orders: [], coupons: [], staff: [], blacklist: [], attempts: [],
    page: { products: 1, orders: 1 },
    filteredOrders: [],
  };

  // ---------- أدوات مساعدة ----------
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const money = (n) => new Intl.NumberFormat("ar-DZ").format(Math.round(n || 0)) + " د.ج";
  const num = (n) => new Intl.NumberFormat("ar-DZ").format(n || 0);
  const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString("ar-DZ", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
  const fmtDateTime = (ts) => (ts ? new Date(ts).toLocaleString("ar-DZ", { dateStyle: "short", timeStyle: "short" }) : "—");
  const orderTotal = (o) => o.total ?? (o.items || []).reduce((s, it) => s + it.price * it.qty, 0);
  const catLabel = (id) => DB.CATEGORIES.find((c) => c.id === id);
  const sellerById = (id) => S.sellers.find((s) => s.id === id);
  const sellerName = (id) => sellerById(id)?.name || "(محذوف)";
  const waNumber = (n) => {
    const d = String(n || "").replace(/[^0-9]/g, "");
    if (!d) return "";
    return d.startsWith("0") ? "213" + d.slice(1) : d;
  };
  const waLink = (n, text = "") => {
    const w = waNumber(n);
    return w ? `https://wa.me/${w}${text ? "?text=" + encodeURIComponent(text) : ""}` : "";
  };

  let toastTimer;
  function toast(text, isError = false) {
    const el = $("adminToast");
    el.textContent = text;
    el.className = isError ? "admin-toast is-error" : "admin-toast";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 4000);
  }

  function statusChip(seller) {
    const st = Auth.getAccountStatus(seller);
    if (st.state === "subscribed") {
      const label = DB.getPlan(st.plan)?.name || "شهري";
      return `<span class="admin-chip chip-active">مشترك "${esc(label)}" — ${st.daysLeft} يوم</span>`;
    }
    if (st.state === "trial") return `<span class="admin-chip chip-trial">تجريبي — ${st.daysLeft} يوم</span>`;
    if (st.state === "expired") return `<span class="admin-chip chip-expired">منتهي</span>`;
    return `<span class="admin-chip chip-none">بلا تجربة</span>`;
  }

  function downloadCSV(filename, rows) {
    const body = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- النافذة المنبثقة ----------
  function openModal(html) {
    $("admModalBox").innerHTML = html;
    $("admModal").classList.remove("hidden");
  }
  function closeModal() {
    $("admModal").classList.add("hidden");
    $("admModalBox").innerHTML = "";
  }

  // ---------- تحميل البيانات ----------
  async function fetchAll(name) {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function reload() {
    $("sellersBody").innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-400">جارٍ التحميل…</td></tr>`;
    const jobs = {
      sellers: DB.getAllSellers(),
      products: fetchAll("products"),
      orders: fetchAll("orders"),
      coupons: fetchAll("coupons"),
      staff: fetchAll("staff"),
      blacklist: fetchAll("blacklist"),
      attempts: fetchAll("blacklist_attempts"),
    };
    const keys = Object.keys(jobs);
    const results = await Promise.allSettled(Object.values(jobs));
    const failed = [];
    results.forEach((r, i) => {
      const key = keys[i];
      if (r.status === "fulfilled") S[key] = r.value;
      else { S[key] = []; failed.push(key); console.error("[Admin.reload]", key, r.reason); }
    });
    S.products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    S.orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    S.coupons.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (failed.length) {
      toast(`تعذّرت قراءة: ${failed.join("، ")} — حدّث قواعد Firestore بالملف المرفق (firestore.rules).`, true);
    }
    renderAll();
  }

  function fillSellerSelect() {
    const sel = $("orderSeller");
    const cur = sel.value || "all";
    sel.innerHTML = `<option value="all">كل المتاجر</option>` +
      S.sellers.map((x) => `<option value="${x.id}">${esc(x.name || x.email)}</option>`).join("");
    sel.value = S.sellers.some((x) => x.id === cur) ? cur : "all";
  }

  function renderAll() {
    fillSellerSelect();
    renderOverview();
    renderSellers();
    renderProducts();
    renderOrders();
    renderCoupons();
    renderSafety();
    $("cntSellers").textContent = S.sellers.length;
    $("cntProducts").textContent = S.products.length;
    $("cntOrders").textContent = S.orders.length;
    $("cntCoupons").textContent = S.coupons.length;
  }

  // ---------- تحديث مستند + الحالة المحلية ----------
  async function patch(colName, id, data, listKey) {
    await updateDoc(doc(db, colName, id), data);
    const item = S[listKey].find((x) => x.id === id);
    if (item) Object.assign(item, data);
  }
  async function remove(colName, id, listKey) {
    await deleteDoc(doc(db, colName, id));
    S[listKey] = S[listKey].filter((x) => x.id !== id);
  }
  async function batchDelete(colName, ids) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db);
      ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, colName, id)));
      await batch.commit();
    }
  }

  // =========================================================
  //  نظرة عامة
  // =========================================================
  function renderOverview() {
    const states = S.sellers.map((s) => ({ s, st: Auth.getAccountStatus(s) }));
    const subscribed = states.filter((x) => x.st.state === "subscribed");
    const trial = states.filter((x) => x.st.state === "trial");
    const expired = states.filter((x) => x.st.state === "expired" || x.st.state === "no_trial");
    const mrr = subscribed.reduce((sum, x) => sum + (DB.getPlan(x.st.plan)?.price || 0), 0);
    const gmv = S.orders.filter((o) => o.status !== "ملغى").reduce((s, o) => s + orderTotal(o), 0);

    $("statTotal").textContent = num(S.sellers.length);
    $("statSubscribed").textContent = num(subscribed.length);
    $("statTrial").textContent = num(trial.length);
    $("statExpired").textContent = num(expired.length);
    $("statMrr").textContent = money(mrr);
    $("statProducts").textContent = num(S.products.length);
    $("statOrders").textContent = num(S.orders.length);
    $("statGmv").textContent = money(gmv);

    const soon = states
      .filter((x) => (x.st.state === "subscribed" || x.st.state === "trial") && x.st.msLeft < 3 * DAY)
      .sort((a, b) => a.st.msLeft - b.st.msLeft);
    $("expiringList").innerHTML = soon.length
      ? soon.map(({ s, st }) => `
          <div class="mini-row">
            <span><strong>${esc(s.name || "—")}</strong>
              <span class="tile-cat">${st.state === "trial" ? "تجربة" : "اشتراك"} · ${st.daysLeft} يوم</span></span>
            <span class="btn-row">
              ${s.whatsapp ? `<a class="table-btn" target="_blank" rel="noopener" href="${waLink(s.whatsapp, `مرحباً ${s.name}، اشتراكك في دكان على وشك الانتهاء. هل تودّ التجديد؟`)}">واتساب</a>` : ""}
              <button class="table-btn table-btn-ok" data-act="manage-seller" data-id="${s.id}">إدارة</button>
            </span>
          </div>`).join("")
      : `<p class="text-sm text-gray-400 py-4">لا شيء ينتهي قريباً ✓</p>`;

    const total = S.orders.length || 1;
    $("statusBreakdown").innerHTML = DB.ORDER_STATUSES.map((st) => {
      const c = S.orders.filter((o) => o.status === st).length;
      return `<div class="mb-3">
        <div class="flex justify-between text-sm mb-1"><span>${esc(st)}</span><span>${num(c)}</span></div>
        <div class="bar"><span style="width:${Math.round((c / total) * 100)}%"></span></div>
      </div>`;
    }).join("");

    $("recentOrders").innerHTML = S.orders.slice(0, 6).map((o) => `
      <div class="mini-row">
        <span><strong>${esc(o.customer?.name || "—")}</strong>
          <span class="tile-cat">${esc((o.sellerIds || []).map(sellerName).join("، "))}</span></span>
        <span>${money(orderTotal(o))} <span class="tile-cat">· ${esc(o.status || "")}</span></span>
      </div>`).join("") || `<p class="text-sm text-gray-400 py-4">لا طلبات بعد.</p>`;

    $("recentSellers").innerHTML = S.sellers.slice(0, 6).map((s) => `
      <div class="mini-row">
        <span><strong>${esc(s.name || "—")}</strong> <span class="tile-cat">${esc(s.email || "")}</span></span>
        <span>${statusChip(s)}</span>
      </div>`).join("") || `<p class="text-sm text-gray-400 py-4">لا بائعين بعد.</p>`;
  }

  // =========================================================
  //  البائعون
  // =========================================================
  function renderSellers() {
    const q = ($("sellerSearch").value || "").trim().toLowerCase();
    const f = $("sellerFilter").value;
    const prodCount = new Map();
    S.products.forEach((p) => prodCount.set(p.sellerId, (prodCount.get(p.sellerId) || 0) + 1));
    const ordCount = new Map();
    S.orders.forEach((o) => (o.sellerIds || []).forEach((id) => ordCount.set(id, (ordCount.get(id) || 0) + 1)));

    const list = S.sellers.filter((s) => {
      if (f !== "all" && Auth.getAccountStatus(s).state !== f) return false;
      if (!q) return true;
      return (s.email || "").toLowerCase().includes(q)
        || (s.name || "").toLowerCase().includes(q)
        || (s.whatsapp || "").includes(q);
    });

    $("sellersEmpty").classList.toggle("hidden", list.length > 0);
    $("sellersBody").innerHTML = list.map((s) => `
      <tr data-id="${s.id}">
        <td>
          <div class="font-medium">${esc(s.name || "—")}</div>
          <div class="tile-cat">${esc(s.email || "—")}</div>
        </td>
        <td>${statusChip(s)}</td>
        <td class="text-sm">${fmtDate(s.subscription?.end)}</td>
        <td class="text-sm">${num(prodCount.get(s.id) || 0)} / ${num(ordCount.get(s.id) || 0)}</td>
        <td class="text-left whitespace-nowrap">
          <button class="table-btn table-btn-ok" data-act="manage-seller" data-id="${s.id}">إدارة</button>
          <a class="table-btn" target="_blank" rel="noopener" href="store.html?seller=${s.id}">المتجر</a>
          ${s.whatsapp ? `<a class="table-btn" target="_blank" rel="noopener" href="${waLink(s.whatsapp)}">واتساب</a>` : ""}
        </td>
      </tr>`).join("");
  }

  function openSellerModal(id) {
    const s = sellerById(id);
    if (!s) return;
    const st = Auth.getAccountStatus(s);
    const myProducts = S.products.filter((p) => p.sellerId === id).length;
    const myOrders = S.orders.filter((o) => (o.sellerIds || []).includes(id));
    const revenue = myOrders.filter((o) => o.status !== "ملغى")
      .reduce((sum, o) => sum + (o.items || []).filter((it) => it.sellerId === id).reduce((a, it) => a + it.price * it.qty, 0), 0);
    const planOptions = DB.PLANS.map((p) => `<option value="${p.id}" ${s.subscription?.plan === p.id ? "selected" : ""}>${esc(p.name)} — ${money(p.price)}</option>`).join("");

    openModal(`
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="font-display text-lg">${esc(s.name || "—")}</h3>
          <p class="tile-cat">${esc(s.email || "")}</p>
        </div>
        <button class="table-btn" data-act="close-modal">✕</button>
      </div>
      <div class="mb-3">${statusChip(s)}</div>
      <dl class="kv">
        <dt>انضم في</dt><dd>${fmtDate(s.createdAt)}</dd>
        <dt>نهاية الاشتراك</dt><dd>${fmtDate(s.subscription?.end)}</dd>
        <dt>بداية التجربة</dt><dd>${fmtDate(s.trialStart)}</dd>
        <dt>المنتجات</dt><dd>${num(myProducts)}</dd>
        <dt>الطلبات</dt><dd>${num(myOrders.length)} · ${money(revenue)}</dd>
      </dl>

      <div class="adm-section">
        <h4>👤 بيانات الحساب</h4>
        <form id="sellerInfoForm" data-id="${id}" class="grid sm:grid-cols-2 gap-3 items-end">
          <div class="field"><label>الاسم</label><input name="name" value="${esc(s.name)}" required></div>
          <div class="field"><label>واتساب</label><input name="whatsapp" value="${esc(s.whatsapp)}" inputmode="tel"></div>
          <button class="btn-primary !py-2 sm:col-span-2" type="submit">حفظ البيانات</button>
        </form>
      </div>

      <div class="adm-section">
        <h4>💳 الاشتراك</h4>
        <div class="btn-row mb-3">
          ${DB.PLANS.map((p) => `<button class="table-btn table-btn-ok" data-act="activate" data-id="${id}" data-plan="${p.id}">فعّل ${esc(p.name)} (30 يوم)</button>`).join("")}
          ${st.state === "subscribed" ? `<button class="table-btn" data-act="extend" data-id="${id}" data-plan="${esc(s.subscription.plan)}">+30 يوماً للخطة الحالية</button>` : ""}
          <button class="table-btn table-btn-danger" data-act="cancel-sub" data-id="${id}">إلغاء الاشتراك</button>
        </div>
        <form id="customSubForm" data-id="${id}" class="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
          <div class="field"><label>خطة + مدة مخصصة</label><select name="plan" class="adm-select w-full">${planOptions}</select></div>
          <div class="field"><label>أيام</label><input name="days" type="number" min="1" max="3650" value="30" style="width:90px" required></div>
          <button class="table-btn table-btn-ok" type="submit" style="height:42px">تعيين</button>
        </form>
      </div>

      <div class="adm-section">
        <h4>🧪 الفترة التجريبية (${DB.TRIAL_DAYS} أيام)</h4>
        <div class="btn-row">
          <button class="table-btn" data-act="trial-reset" data-id="${id}">منح تجربة جديدة من الآن</button>
          <button class="table-btn" data-act="trial-add" data-id="${id}">إضافة أيام للتجربة…</button>
          <button class="table-btn table-btn-danger" data-act="trial-end" data-id="${id}">إنهاء التجربة</button>
        </div>
      </div>

      <div class="adm-section">
        <h4>🔗 تواصل وروابط</h4>
        <div class="btn-row">
          <a class="table-btn" target="_blank" rel="noopener" href="store.html?seller=${id}">فتح المتجر</a>
          ${s.whatsapp ? `<a class="table-btn" target="_blank" rel="noopener" href="${waLink(s.whatsapp)}">محادثة واتساب</a>` : ""}
          ${s.email ? `<a class="table-btn" href="mailto:${esc(s.email)}">بريد</a>` : ""}
          <button class="table-btn" data-act="filter-products" data-id="${id}">منتجاته</button>
          <button class="table-btn" data-act="filter-orders" data-id="${id}">طلباته</button>
        </div>
      </div>

      <div class="adm-section">
        <h4 style="color:var(--c-danger)">⚠️ منطقة الخطر</h4>
        <p class="text-xs text-gray-500 mb-2">يحذف ملف البائع ومنتجاته وكوبوناته وموظفيه وقائمته السوداء. لن يتمكن من الدخول بعدها. (حساب الدخول في Firebase Authentication يُحذف يدوياً من لوحة Firebase إن أردت.)</p>
        <button class="table-btn table-btn-danger" data-act="delete-seller" data-id="${id}">حذف البائع وكل بياناته</button>
      </div>
    `);
  }

  async function sellerAction(act, id, btn) {
    const s = sellerById(id);
    if (!s) return;
    const labelOf = (p) => DB.getPlan(p)?.name || p;

    if (act === "activate") {
      if (!confirm(`تفعيل اشتراك "${labelOf(btn.dataset.plan)}" لـ ${s.name} لمدة 30 يوماً من الآن؟`)) return;
      const sub = await DB.activateSubscription(id, btn.dataset.plan);
      s.subscription = sub;
      toast(`تم تفعيل "${labelOf(btn.dataset.plan)}" ✓`);
    } else if (act === "extend") {
      const sub = await DB.extendSubscription(id, btn.dataset.plan);
      s.subscription = sub;
      toast("تم التمديد 30 يوماً ✓");
    } else if (act === "cancel-sub") {
      if (!confirm("إلغاء اشتراك هذا البائع؟ سيفقد الوصول للوحة التحكم (ما لم تكن تجربته سارية).")) return;
      s.subscription = await DB.cancelSubscription(id);
      toast("تم إلغاء الاشتراك.");
    } else if (act === "trial-reset") {
      if (!confirm("منح البائع تجربة جديدة مدتها 7 أيام من الآن؟")) return;
      await patch("sellers", id, { trialStart: Date.now() }, "sellers");
      toast("تم منح تجربة جديدة ✓");
    } else if (act === "trial-add") {
      const n = Number(prompt("كم يوماً تريد إضافته للتجربة؟", "7"));
      if (!n || n < 1) return;
      const now = Date.now();
      const base = s.trialStart && s.trialStart + DB.TRIAL_DAYS * DAY > now ? s.trialStart : now - DB.TRIAL_DAYS * DAY;
      await patch("sellers", id, { trialStart: base + n * DAY }, "sellers");
      toast(`تمت إضافة ${n} يوم للتجربة ✓`);
    } else if (act === "trial-end") {
      if (!confirm("إنهاء التجربة المجانية لهذا البائع الآن؟")) return;
      await patch("sellers", id, { trialStart: Date.now() - (DB.TRIAL_DAYS + 1) * DAY }, "sellers");
      toast("تم إنهاء التجربة.");
    } else if (act === "delete-seller") {
      if (!confirm(`حذف "${s.name}" نهائياً مع كل بياناته؟ لا يمكن التراجع.`)) return;
      if (prompt('للتأكيد اكتب كلمة "حذف"') !== "حذف") return;
      const mine = (key) => S[key].filter((x) => x.sellerId === id).map((x) => x.id);
      await batchDelete("products", mine("products"));
      await batchDelete("coupons", mine("coupons"));
      await batchDelete("staff", mine("staff"));
      await batchDelete("blacklist", mine("blacklist"));
      await batchDelete("blacklist_attempts", mine("attempts"));
      await deleteDoc(doc(db, "sellers", id));
      closeModal();
      toast("تم حذف البائع وبياناته.");
      await reload();
      return;
    }
    renderAll();
    openSellerModal(id);
  }

  // =========================================================
  //  المنتجات
  // =========================================================
  function renderPager(el, key, total) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (S.page[key] > pages) S.page[key] = pages;
    el.innerHTML = pages <= 1 ? "" : `
      <button class="table-btn" data-act="page" data-key="${key}" data-dir="-1" ${S.page[key] <= 1 ? "disabled" : ""}>السابق</button>
      <span>${S.page[key]} / ${pages}</span>
      <button class="table-btn" data-act="page" data-key="${key}" data-dir="1" ${S.page[key] >= pages ? "disabled" : ""}>التالي</button>`;
  }

  function renderProducts() {
    const q = ($("productSearch").value || "").trim().toLowerCase();
    const cat = $("productCat").value;
    const type = $("productType").value;
    const stock = $("productStockFilter").value;
    const sellerFilter = $("productSearch").dataset.seller || "";

    const list = S.products.filter((p) => {
      if (sellerFilter && p.sellerId !== sellerFilter) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (type !== "all" && p.type !== type) return false;
      const st = p.stock ?? 0;
      if (stock === "low" && !(st > 0 && st <= DB.LOW_STOCK_THRESHOLD)) return false;
      if (stock === "out" && st > 0) return false;
      if (!q) return true;
      return (p.name || "").toLowerCase().includes(q) || (p.sellerName || sellerName(p.sellerId)).toLowerCase().includes(q);
    });

    $("productsEmpty").classList.toggle("hidden", list.length > 0);
    const start = (S.page.products - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);
    $("productsBody").innerHTML = slice.map((p) => {
      const c = catLabel(p.category);
      const img = p.image
        ? `<img class="adm-thumb" src="${esc(p.image)}" alt="" loading="lazy">`
        : `<span class="adm-thumb">${c?.icon || "📦"}</span>`;
      return `<tr data-id="${p.id}">
        <td><div class="flex items-center gap-3">${img}
          <div><div class="font-medium clip">${esc(p.name)}</div>
          <div class="tile-cat">${c ? esc(c.label) : "—"} · ${p.type === "physical" ? "🚚 ملموس" : "⚡ رقمي"}</div></div></div></td>
        <td class="text-sm">${esc(p.sellerName || sellerName(p.sellerId))}</td>
        <td class="text-sm">${money(p.price)}${p.oldPrice ? `<div class="tile-cat" style="text-decoration:line-through">${money(p.oldPrice)}</div>` : ""}</td>
        <td><input class="stock-input" type="number" min="0" value="${p.stock ?? 0}" data-act="stock" data-id="${p.id}"></td>
        <td class="text-left whitespace-nowrap">
          <a class="table-btn" target="_blank" rel="noopener" href="product.html?id=${p.id}">عرض</a>
          <button class="table-btn" data-act="edit-product" data-id="${p.id}">تعديل</button>
          <button class="table-btn table-btn-danger" data-act="delete-product" data-id="${p.id}">حذف</button>
        </td>
      </tr>`;
    }).join("");
    renderPager($("productsPager"), "products", list.length);
  }

  function openProductModal(id) {
    const p = S.products.find((x) => x.id === id);
    if (!p) return;
    openModal(`
      <div class="flex items-start justify-between gap-3 mb-4">
        <h3 class="font-display text-lg">تعديل منتج — ${esc(p.sellerName || sellerName(p.sellerId))}</h3>
        <button class="table-btn" data-act="close-modal">✕</button>
      </div>
      <form id="productEditForm" data-id="${id}" class="grid gap-3">
        <div class="field"><label>الاسم</label><input name="name" value="${esc(p.name)}" required></div>
        <div class="grid grid-cols-2 gap-3">
          <div class="field"><label>التصنيف</label>
            <select name="category">${DB.CATEGORIES.map((c) => `<option value="${c.id}" ${p.category === c.id ? "selected" : ""}>${c.icon} ${esc(c.label)}</option>`).join("")}</select></div>
          <div class="field"><label>النوع</label>
            <select name="type">
              <option value="digital" ${p.type !== "physical" ? "selected" : ""}>⚡ رقمي</option>
              <option value="physical" ${p.type === "physical" ? "selected" : ""}>🚚 ملموس</option>
            </select></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="field"><label>السعر</label><input name="price" type="number" min="0" value="${p.price ?? 0}" required></div>
          <div class="field"><label>السعر القديم</label><input name="oldPrice" type="number" min="0" value="${p.oldPrice ?? ""}"></div>
          <div class="field"><label>المخزون</label><input name="stock" type="number" min="0" value="${p.stock ?? 0}" required></div>
        </div>
        <div class="field"><label>الوصف</label><textarea name="description" rows="4">${esc(p.description)}</textarea></div>
        <button class="btn-primary" type="submit">حفظ التعديلات</button>
      </form>`);
  }

  // =========================================================
  //  الطلبات
  // =========================================================
  function renderOrders() {
    const q = ($("orderSearch").value || "").trim().toLowerCase();
    const status = $("orderStatus").value;
    const seller = $("orderSeller").value;
    const list = S.orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (seller !== "all" && !(o.sellerIds || []).includes(seller)) return false;
      if (!q) return true;
      return o.id.toLowerCase().includes(q)
        || (o.customer?.name || "").toLowerCase().includes(q)
        || (o.customer?.phone || "").includes(q);
    });
    S.filteredOrders = list;

    $("ordersEmpty").classList.toggle("hidden", list.length > 0);
    const start = (S.page.orders - 1) * PAGE_SIZE;
    $("ordersBody").innerHTML = list.slice(start, start + PAGE_SIZE).map((o) => `
      <tr data-id="${o.id}">
        <td><div class="font-medium text-sm">#${esc(o.id.slice(0, 6))}</div><div class="tile-cat">${fmtDateTime(o.createdAt)}</div></td>
        <td><div class="text-sm">${esc(o.customer?.name || "—")}</div>
          <div class="tile-cat">${esc(o.customer?.phone || "")}${o.customer?.wilaya ? " · " + esc(o.customer.wilaya) : ""}</div></td>
        <td class="text-sm">${esc((o.sellerIds || []).map(sellerName).join("، "))}</td>
        <td class="text-sm">${money(orderTotal(o))}</td>
        <td><select class="status-select" data-act="order-status" data-id="${o.id}">
          ${DB.ORDER_STATUSES.map((st) => `<option ${o.status === st ? "selected" : ""}>${esc(st)}</option>`).join("")}
        </select></td>
        <td class="text-left whitespace-nowrap">
          <button class="table-btn" data-act="view-order" data-id="${o.id}">تفاصيل</button>
          <button class="table-btn table-btn-danger" data-act="delete-order" data-id="${o.id}">حذف</button>
        </td>
      </tr>`).join("");
    renderPager($("ordersPager"), "orders", list.length);
  }

  function openOrderModal(id) {
    const o = S.orders.find((x) => x.id === id);
    if (!o) return;
    const c = o.customer || {};
    openModal(`
      <div class="flex items-start justify-between gap-3 mb-3">
        <div><h3 class="font-display text-lg">طلب #${esc(o.id.slice(0, 6))}</h3><p class="tile-cat">${fmtDateTime(o.createdAt)}</p></div>
        <button class="table-btn" data-act="close-modal">✕</button>
      </div>
      <dl class="kv mb-4">
        <dt>الزبون</dt><dd>${esc(c.name || "—")}</dd>
        <dt>الهاتف</dt><dd dir="ltr" style="text-align:right">${esc(c.phone || "—")}</dd>
        <dt>الولاية</dt><dd>${esc(c.wilaya || "—")}</dd>
        <dt>العنوان</dt><dd>${esc(c.address || "—")}</dd>
        <dt>الحالة</dt><dd>${esc(o.status || "—")}</dd>
        ${o.coupon ? `<dt>الكوبون</dt><dd>${esc(o.coupon)}</dd>` : ""}
      </dl>
      <table class="dash-table">
        <thead><tr><th>المنتج</th><th>المتجر</th><th>الكمية</th><th>السعر</th></tr></thead>
        <tbody>${(o.items || []).map((it) => `<tr>
          <td>${esc(it.name)}</td><td class="text-sm">${esc(it.sellerName || sellerName(it.sellerId))}</td>
          <td>${num(it.qty)}</td><td>${money(it.price * it.qty)}</td></tr>`).join("")}</tbody>
      </table>
      <div class="mt-3 text-sm">
        ${o.subtotal != null ? `<div class="flex justify-between py-1"><span>المجموع الفرعي</span><span>${money(o.subtotal)}</span></div>` : ""}
        ${o.discount ? `<div class="flex justify-between py-1"><span>الخصم</span><span>− ${money(o.discount)}</span></div>` : ""}
        ${o.deliveryCost ? `<div class="flex justify-between py-1"><span>التوصيل</span><span>${money(o.deliveryCost)}</span></div>` : ""}
        <div class="flex justify-between py-1 font-bold text-base"><span>الإجمالي</span><span>${money(orderTotal(o))}</span></div>
      </div>
      <div class="btn-row mt-4">
        ${c.phone ? `<a class="table-btn" target="_blank" rel="noopener" href="${waLink(c.phone)}">واتساب الزبون</a>` : ""}
        <button class="table-btn table-btn-danger" data-act="delete-order" data-id="${o.id}">حذف الطلب</button>
      </div>`);
  }

  function ordersCSVRows(list) {
    const rows = [["رقم الطلب", "التاريخ", "الزبون", "الهاتف", "الولاية", "العنوان", "المتاجر", "المنتجات", "الكوبون", "التوصيل", "المجموع", "الحالة"]];
    list.forEach((o) => rows.push([
      o.id, new Date(o.createdAt || 0).toLocaleDateString("ar-DZ"),
      o.customer?.name || "", o.customer?.phone || "", o.customer?.wilaya || "", o.customer?.address || "",
      (o.sellerIds || []).map(sellerName).join(" | "),
      (o.items || []).map((it) => `${it.name} x${it.qty}`).join(" | "),
      o.coupon || "", o.deliveryCost || 0, orderTotal(o), o.status || "",
    ]));
    return rows;
  }

  // =========================================================
  //  الكوبونات
  // =========================================================
  function renderCoupons() {
    const q = ($("couponSearch").value || "").trim().toLowerCase();
    const list = S.coupons.filter((c) => !q
      || (c.code || "").toLowerCase().includes(q) || sellerName(c.sellerId).toLowerCase().includes(q));
    $("couponsEmpty").classList.toggle("hidden", list.length > 0);
    $("couponsBody").innerHTML = list.map((c) => {
      const expired = c.expiresAt && c.expiresAt < Date.now();
      const exhausted = c.maxUses && (c.used || 0) >= c.maxUses;
      const chip = !c.active ? `<span class="admin-chip chip-none">معطّل</span>`
        : expired ? `<span class="admin-chip chip-expired">منتهي</span>`
        : exhausted ? `<span class="admin-chip chip-warn">مستهلك</span>`
        : `<span class="admin-chip chip-active">فعّال</span>`;
      return `<tr data-id="${c.id}">
        <td><strong dir="ltr">${esc(c.code)}</strong>${c.minOrder ? `<div class="tile-cat">حد أدنى ${money(c.minOrder)}</div>` : ""}</td>
        <td class="text-sm">${esc(sellerName(c.sellerId))}</td>
        <td class="text-sm">${c.type === "percent" ? num(c.value) + "%" : money(c.value)}${c.expiresAt ? `<div class="tile-cat">حتى ${fmtDate(c.expiresAt)}</div>` : ""}</td>
        <td class="text-sm">${num(c.used || 0)}${c.maxUses ? " / " + num(c.maxUses) : ""}</td>
        <td>${chip}</td>
        <td class="text-left whitespace-nowrap">
          <button class="table-btn" data-act="toggle-coupon" data-id="${c.id}">${c.active ? "تعطيل" : "تفعيل"}</button>
          <button class="table-btn table-btn-danger" data-act="delete-coupon" data-id="${c.id}">حذف</button>
        </td>
      </tr>`;
    }).join("");
  }

  // =========================================================
  //  الفريق والحظر
  // =========================================================
  function renderSafety() {
    $("staffCount").textContent = `(${S.staff.length})`;
    $("staffEmpty").classList.toggle("hidden", S.staff.length > 0);
    $("staffBody").innerHTML = S.staff.map((m) => `
      <tr data-id="${m.id}">
        <td><div class="font-medium text-sm">${esc(m.name || "—")}</div>
          <div class="tile-cat">${esc(m.email || m.phone || "")} · ${esc(sellerName(m.sellerId))}</div></td>
        <td><span class="admin-chip ${m.active === false ? "chip-none" : "chip-active"}">${m.active === false ? "معطّل" : "فعّال"}</span></td>
        <td class="text-left whitespace-nowrap">
          <button class="table-btn" data-act="toggle-staff" data-id="${m.id}">${m.active === false ? "تفعيل" : "تعطيل"}</button>
          <button class="table-btn table-btn-danger" data-act="delete-staff" data-id="${m.id}">حذف</button>
        </td>
      </tr>`).join("");

    $("blCount").textContent = `(${S.blacklist.length})`;
    $("blEmpty").classList.toggle("hidden", S.blacklist.length > 0);
    $("blBody").innerHTML = S.blacklist.map((b) => `
      <tr data-id="${b.id}">
        <td><div class="font-medium text-sm" dir="ltr" style="text-align:right">${esc(b.phone)}</div>
          <div class="tile-cat">${esc(b.name || "")}${b.reason ? " — " + esc(b.reason) : ""} · ${esc(sellerName(b.sellerId))}</div></td>
        <td class="text-left"><button class="table-btn table-btn-danger" data-act="delete-bl" data-id="${b.id}">إزالة</button></td>
      </tr>`).join("");
  }

  // =========================================================
  //  أدوات
  // =========================================================
  function groupSellers(group) {
    return S.sellers.filter((s) => {
      const st = Auth.getAccountStatus(s);
      if (group === "all") return true;
      if (group === "expiring") return (st.state === "subscribed" || st.state === "trial") && st.msLeft < 3 * DAY;
      if (group === "expired") return st.state === "expired" || st.state === "no_trial";
      return st.state === group;
    });
  }

  function buildBroadcast() {
    const text = ($("bcText").value || "").trim();
    if (!text) { toast("اكتب نص الرسالة أولاً.", true); return; }
    const list = groupSellers($("bcGroup").value).filter((s) => waNumber(s.whatsapp));
    $("bcList").innerHTML = list.length
      ? `<p class="mb-2 text-gray-500">${list.length} بائع — اضغط على كل اسم لفتح المحادثة:</p>` +
        list.map((s) => `<a class="table-btn" style="display:inline-block;margin:.15rem" target="_blank" rel="noopener"
          href="${waLink(s.whatsapp, text.replace(/\{الاسم\}/g, s.name || ""))}">${esc(s.name || s.email)}</a>`).join("")
      : `<p class="text-gray-400">لا يوجد بائعون بأرقام واتساب في هذه المجموعة.</p>`;
  }

  async function runCleanup(kind) {
    if (kind === "orphans") {
      const ids = new Set(S.sellers.map((s) => s.id));
      const orphans = S.products.filter((p) => !ids.has(p.sellerId)).map((p) => p.id);
      if (!orphans.length) return toast("لا توجد منتجات يتيمة ✓");
      if (!confirm(`حذف ${orphans.length} منتج يتيم؟`)) return;
      await batchDelete("products", orphans);
      toast(`تم حذف ${orphans.length} منتج.`);
    } else if (kind === "cancelled") {
      const cutoff = Date.now() - 60 * DAY;
      const old = S.orders.filter((o) => o.status === "ملغى" && (o.createdAt || 0) < cutoff).map((o) => o.id);
      if (!old.length) return toast("لا توجد طلبات ملغاة قديمة ✓");
      if (!confirm(`حذف ${old.length} طلب ملغى أقدم من 60 يوماً؟`)) return;
      await batchDelete("orders", old);
      toast(`تم حذف ${old.length} طلب.`);
    } else if (kind === "attempts") {
      const seen = S.attempts.filter((a) => a.seen).map((a) => a.id);
      if (!seen.length) return toast("لا توجد محاولات مشاهدة ✓");
      if (!confirm(`حذف ${seen.length} سجل؟`)) return;
      await batchDelete("blacklist_attempts", seen);
      toast(`تم حذف ${seen.length} سجل.`);
    }
    await reload();
  }

  // =========================================================
  //  التهيئة والأحداث
  // =========================================================
  function switchTab(name) {
    document.querySelectorAll(".adm-tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
    document.querySelectorAll(".adm-pane").forEach((p) => p.classList.toggle("hidden", p.id !== "pane-" + name));
  }

  async function guarded(fn) {
    try { await fn(); }
    catch (err) {
      console.error("[Admin]", err);
      toast("تعذّر تنفيذ العملية — راجع قواعد Firestore (ملف firestore.rules).", true);
    }
  }

  async function init() {
    const user = await Auth.waitForAuthReady();
    if (!user) { window.location.href = "login.html"; return; }
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

    $("adminEmail").textContent = user.email;
    $("adminShell").classList.remove("hidden");

    // قوائم الاختيار
    $("quickPlanSelect").innerHTML = DB.PLANS.map((p) => `<option value="${p.id}">${esc(p.name)} — ${money(p.price)}/شهر</option>`).join("");
    $("productCat").innerHTML = `<option value="all">كل التصنيفات</option>` +
      DB.CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.label)}</option>`).join("");
    $("orderStatus").innerHTML = `<option value="all">كل الحالات</option>` +
      DB.ORDER_STATUSES.map((s) => `<option>${esc(s)}</option>`).join("");

    // تبويبات
    $("admTabs").addEventListener("click", (e) => {
      const b = e.target.closest(".adm-tab");
      if (!b) return;
      if (b.dataset.tab === "products") { delete $("productSearch").dataset.seller; S.page.products = 1; renderProducts(); }
      switchTab(b.dataset.tab);
    });

    $("logoutBtn").addEventListener("click", async () => { await Auth.logout(); window.location.href = "login.html"; });
    $("refreshBtn").addEventListener("click", () => guarded(reload));

    // فلاتر
    $("sellerSearch").addEventListener("input", renderSellers);
    $("sellerFilter").addEventListener("change", renderSellers);
    ["productSearch", "productCat", "productType", "productStockFilter"].forEach((id) =>
      $(id).addEventListener(id === "productSearch" ? "input" : "change", () => { S.page.products = 1; renderProducts(); }));
    ["orderSearch", "orderStatus", "orderSeller"].forEach((id) =>
      $(id).addEventListener(id === "orderSearch" ? "input" : "change", () => { S.page.orders = 1; renderOrders(); }));
    $("couponSearch").addEventListener("input", renderCoupons);

    // تفعيل سريع بالبريد
    $("quickForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = (fd.get("email") || "").trim().toLowerCase();
      const plan = fd.get("plan");
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "جارٍ التفعيل…";
      await guarded(async () => {
        const seller = await DB.getSellerByEmail(email);
        if (!seller) return toast("لا يوجد بائع مسجّل بهذا البريد الإلكتروني.", true);
        const active = seller.subscription?.active && seller.subscription.end > Date.now();
        if (active) await DB.extendSubscription(seller.id, plan);
        else await DB.activateSubscription(seller.id, plan);
        toast(`تم ${active ? "تمديد" : "تفعيل"} اشتراك "${DB.getPlan(plan)?.name}" لـ ${seller.name} ✓`);
        e.target.reset();
        await reload();
      });
      btn.disabled = false; btn.textContent = "تفعيل الاشتراك";
    });

    // تصدير
    $("exportOrdersBtn").addEventListener("click", () => downloadCSV("orders-filtered.csv", ordersCSVRows(S.filteredOrders)));
    $("exportOrdersBtn2").addEventListener("click", () => downloadCSV("orders-all.csv", ordersCSVRows(S.orders)));
    $("exportSellersBtn").addEventListener("click", () => {
      const rows = [["الاسم", "البريد", "واتساب", "الحالة", "الخطة", "نهاية الاشتراك", "تاريخ التسجيل"]];
      S.sellers.forEach((s) => {
        const st = Auth.getAccountStatus(s);
        rows.push([s.name, s.email, s.whatsapp, st.state, DB.getPlan(st.plan)?.name || "", fmtDate(s.subscription?.end), fmtDate(s.createdAt)]);
      });
      downloadCSV("sellers.csv", rows);
    });
    $("exportProductsBtn").addEventListener("click", () => {
      const rows = [["المنتج", "المتجر", "التصنيف", "النوع", "السعر", "المخزون", "الإنشاء"]];
      S.products.forEach((p) => rows.push([p.name, p.sellerName || sellerName(p.sellerId), catLabel(p.category)?.label || "", p.type, p.price, p.stock ?? 0, fmtDate(p.createdAt)]));
      downloadCSV("products.csv", rows);
    });

    $("bcBuild").addEventListener("click", buildBroadcast);
    $("cleanOrphans").addEventListener("click", () => guarded(() => runCleanup("orphans")));
    $("cleanCancelled").addEventListener("click", () => guarded(() => runCleanup("cancelled")));
    $("cleanAttempts").addEventListener("click", () => guarded(() => runCleanup("attempts")));

    // نافذة: إغلاق بالنقر خارجها
    $("admModal").addEventListener("click", (e) => { if (e.target.id === "admModal") closeModal(); });

    // ---- تفويض النقرات العام ----
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-act]");
      if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
      const act = el.dataset.act;
      const id = el.dataset.id;
      guarded(async () => {
        switch (act) {
          case "close-modal": return closeModal();
          case "manage-seller": return openSellerModal(id);
          case "activate": case "extend": case "cancel-sub":
          case "trial-reset": case "trial-add": case "trial-end": case "delete-seller":
            return sellerAction(act, id, el);
          case "filter-products":
            closeModal(); switchTab("products");
            $("productSearch").value = "";
            $("productSearch").dataset.seller = id;
            toast(`عرض منتجات ${sellerName(id)} فقط — انقر تبويب "المنتجات" لإلغاء الفلتر.`);
            S.page.products = 1; return renderProducts();
          case "filter-orders":
            closeModal(); switchTab("orders");
            $("orderSeller").value = id; S.page.orders = 1; return renderOrders();
          case "page":
            S.page[el.dataset.key] += Number(el.dataset.dir);
            return el.dataset.key === "products" ? renderProducts() : renderOrders();
          case "edit-product": return openProductModal(id);
          case "delete-product": {
            const p = S.products.find((x) => x.id === id);
            if (!confirm(`حذف المنتج "${p?.name}" نهائياً؟`)) return;
            await remove("products", id, "products");
            toast("تم حذف المنتج."); return renderAll();
          }
          case "view-order": return openOrderModal(id);
          case "delete-order": {
            if (!confirm("حذف هذا الطلب نهائياً؟ سيختفي من لوحة البائع أيضاً.")) return;
            await remove("orders", id, "orders");
            closeModal(); toast("تم حذف الطلب."); return renderAll();
          }
          case "toggle-coupon": {
            const c = S.coupons.find((x) => x.id === id);
            await patch("coupons", id, { active: !c.active }, "coupons");
            return renderCoupons();
          }
          case "delete-coupon": {
            if (!confirm("حذف هذا الكوبون؟")) return;
            await remove("coupons", id, "coupons");
            toast("تم حذف الكوبون."); return renderAll();
          }
          case "toggle-staff": {
            const m = S.staff.find((x) => x.id === id);
            await patch("staff", id, { active: m.active === false }, "staff");
            return renderSafety();
          }
          case "delete-staff": {
            if (!confirm("حذف هذا الموظف؟")) return;
            await remove("staff", id, "staff");
            return renderSafety();
          }
          case "delete-bl": {
            if (!confirm("إزالة هذا الرقم من القائمة السوداء؟")) return;
            await remove("blacklist", id, "blacklist");
            return renderSafety();
          }
        }
      });
    });

    // تغييرات الحقول المضمّنة (مخزون / حالة طلب)
    document.addEventListener("change", (e) => {
      const el = e.target.closest("[data-act]");
      if (!el) return;
      if (el.dataset.act === "stock") {
        const v = Math.max(0, Number(el.value) || 0);
        guarded(async () => { await patch("products", el.dataset.id, { stock: v }, "products"); toast("تم تحديث المخزون ✓"); });
      } else if (el.dataset.act === "order-status") {
        guarded(async () => {
          await patch("orders", el.dataset.id, { status: el.value }, "orders");
          toast("تم تحديث حالة الطلب ✓");
          renderOverview();
        });
      }
    });

    // النماذج داخل النافذة
    $("admModalBox").addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      const id = form.dataset.id;
      const fd = new FormData(form);
      guarded(async () => {
        if (form.id === "sellerInfoForm") {
          const name = (fd.get("name") || "").trim();
          const whatsapp = (fd.get("whatsapp") || "").replace(/[^0-9]/g, "");
          if (!name) return;
          await patch("sellers", id, { name, whatsapp }, "sellers");
          // مزامنة اسم البائع في منتجاته (كما يفعل Auth.updateProfile)
          const mine = S.products.filter((p) => p.sellerId === id);
          if (mine.length) {
            const batch = writeBatch(db);
            mine.forEach((p) => { batch.update(doc(db, "products", p.id), { sellerName: name }); p.sellerName = name; });
            await batch.commit();
          }
          toast("تم حفظ بيانات البائع ✓");
          renderAll(); openSellerModal(id);
        } else if (form.id === "customSubForm") {
          const plan = fd.get("plan");
          const days = Math.max(1, Number(fd.get("days")) || 30);
          const now = Date.now();
          const subscription = { active: true, plan, start: now, end: now + days * DAY };
          await patch("sellers", id, { subscription }, "sellers");
          toast(`تم تعيين "${DB.getPlan(plan)?.name}" لمدة ${days} يوماً ✓`);
          renderAll(); openSellerModal(id);
        } else if (form.id === "productEditForm") {
          const data = {
            name: (fd.get("name") || "").trim(),
            category: fd.get("category"),
            type: fd.get("type"),
            price: Number(fd.get("price")) || 0,
            oldPrice: fd.get("oldPrice") ? Number(fd.get("oldPrice")) : null,
            stock: Math.max(0, Number(fd.get("stock")) || 0),
            description: (fd.get("description") || "").trim(),
          };
          await patch("products", id, data, "products");
          closeModal(); toast("تم حفظ المنتج ✓"); renderAll();
        }
      });
    });

    // قائمة المتاجر في فلتر الطلبات تُملأ بعد التحميل
    await guarded(reload);
  }

  return { init };
})();
