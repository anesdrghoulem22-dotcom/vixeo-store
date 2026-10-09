/* =========================================================
   DUKAN — لوحة القيادة والإدارة العليا (مركز تحكم كامل)
   تحكم كامل: البائعون والاشتراكات والتجارب، المنتجات، الطلبات،
   الكوبونات، الموظفون، القوائم السوداء، التنبيهات الذكية،
   التحليلات، الإجراءات الجماعية، البحث الشامل، التصدير والتنظيف.
   الوصول محصور بالبُرد الموجودة في DB.ADMIN_EMAILS
   ملاحظة: يلزم تحديث قواعد Firestore (كما في README).
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
    selected: { sellers: new Set(), products: new Set(), orders: new Set() },
  };
  let orderQuick = "all";

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
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const waNumber = (n) => {
    const d = String(n || "").replace(/[^0-9]/g, "");
    if (!d) return "";
    return d.startsWith("0") ? "213" + d.slice(1) : d;
  };
  const waLink = (n, text = "") => {
    const w = waNumber(n);
    return w ? `https://wa.me/${w}${text ? "?text=" + encodeURIComponent(text) : ""}` : "";
  };
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

  let toastTimer;
  function toast(text, isError = false) {
    const el = $("adminToast");
    el.textContent = text;
    el.className = isError ? "admin-toast is-error" : "admin-toast";
    el.classList.remove("hidden");
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
    if ($("sellersBody")) $("sellersBody").innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400">جارٍ التحميل…</td></tr>`;
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
    // إزالة معرّفات محذوفة من التحديد
    S.selected.sellers.forEach((id) => { if (!sellerById(id)) S.selected.sellers.delete(id); });
    if (failed.length) {
      toast(`تعذّرت قراءة: ${failed.join("، ")} — حدّث قواعد Firestore كما في README.`, true);
    }
    renderAll();
  }

  function fillSellerSelect() {
    const sel = $("orderSeller");
    if (!sel) return;
    const cur = sel.value || "all";
    sel.innerHTML = `<option value="all">كل المتاجر</option>` +
      S.sellers.map((x) => `<option value="${x.id}">${esc(x.name || x.email)}</option>`).join("");
    sel.value = S.sellers.some((x) => x.id === cur) ? cur : "all";
  }

  function renderAll() {
    fillSellerSelect();
    renderOverview();
    renderAnalytics();
    renderAlerts();
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

  // ---------- إحصاءات مشتقة ----------
  function sellerStats() {
    const prod = new Map(), ord = new Map(), rev = new Map();
    S.products.forEach((p) => prod.set(p.sellerId, (prod.get(p.sellerId) || 0) + 1));
    S.orders.forEach((o) => {
      (o.sellerIds || []).forEach((id) => ord.set(id, (ord.get(id) || 0) + 1));
      if (o.status === "ملغى") return;
      (o.items || []).forEach((it) => rev.set(it.sellerId, (rev.get(it.sellerId) || 0) + it.price * it.qty));
    });
    return { prod, ord, rev };
  }

  // =========================================================
  //  التنبيهات الذكية
  // =========================================================
  function renderAlerts() {
    const wrap = $("alertCenter");
    if (!wrap) return;
    const now = Date.now();
    const states = S.sellers.map((s) => ({ s, st: Auth.getAccountStatus(s) }));
    const expiring = states.filter((x) => (x.st.state === "subscribed" || x.st.state === "trial") && x.st.msLeft < 3 * DAY);
    const expired = states.filter((x) => x.st.state === "expired" || x.st.state === "no_trial");
    const pending = S.orders.filter((o) => o.status === "قيد الانتظار");
    const stalePending = pending.filter((o) => now - (o.createdAt || 0) > DAY);
    const outStock = S.products.filter((p) => (p.stock ?? 0) === 0);
    const lowStock = S.products.filter((p) => { const st = p.stock ?? 0; return st > 0 && st <= DB.LOW_STOCK_THRESHOLD; });
    const unseen = S.attempts.filter((a) => !a.seen);

    const items = [];
    const add = (sev, icon, n, title, desc, tab) =>
      items.push({ sev, icon, n, title, desc, tab });

    if (expiring.length) add("sev-warn", "⏳", expiring.length, "تنتهي قريباً", "اشتراكات أو تجارب تنتهي خلال 3 أيام", "sellers");
    if (expired.length) add("sev-danger", "⚠️", expired.length, "حسابات متوقفة", "اشتراكات منتهية أو بلا تجربة — تحتاج متابعة", "sellers");
    if (stalePending.length) add("sev-warn", "🧾", stalePending.length, "طلبات معلّقة", "طلبات قيد الانتظار منذ أكثر من 24 ساعة", "orders");
    if (outStock.length) add("sev-danger", "📦", outStock.length, "منتجات نافدة", "منتجات مخزونها صفر ويجب تنبيه أصحابها", "products");
    if (lowStock.length) add("sev-info", "🪫", lowStock.length, "مخزون منخفض", `منتجات بقي فيها 1–${DB.LOW_STOCK_THRESHOLD} قطع`, "products");
    if (unseen.length) add("sev-danger", "🚨", unseen.length, "محاولات محظورة", "محاولات طلب من أرقام في القوائم السوداء", "safety");

    if (!items.length) {
      wrap.innerHTML = `<div class="alert-item sev-ok" style="cursor:default"><div class="alert-ico">✅</div><div><div class="alert-num" style="color:#0E753B">كل شيء يعمل بسلاسة</div><div class="alert-desc">لا توجد تنبيهات أو مخاطر تحتاج تدخلاً الآن.</div></div></div>`;
      return;
    }
    wrap.innerHTML = items.map((it) => `
      <button class="alert-item ${it.sev}" data-alert-tab="${it.tab}">
        <div class="alert-ico">${it.icon}</div>
        <div>
          <div class="alert-num">${num(it.n)}</div>
          <div class="alert-title">${esc(it.title)}</div>
          <div class="alert-desc">${esc(it.desc)}</div>
        </div>
      </button>`).join("");
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

    if ($("heroSellers")) $("heroSellers").textContent = num(S.sellers.length);
    if ($("heroProducts")) $("heroProducts").textContent = num(S.products.length);
    if ($("heroOrders")) $("heroOrders").textContent = num(S.orders.length);
    if ($("heroMrr")) $("heroMrr").textContent = money(mrr);

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
  //  التحليلات: الرسم البياني + المتصدرون
  // =========================================================
  function renderAnalytics() {
    // --- إيرادات آخر 14 يوماً ---
    const days = 14;
    const buckets = [];
    const map = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      map.set(k, 0);
      buckets.push({ k, d });
    }
    S.orders.forEach((o) => {
      if (o.status === "ملغى") return;
      const k = dayKey(new Date(o.createdAt || 0));
      if (map.has(k)) map.set(k, map.get(k) + orderTotal(o));
    });
    const max = Math.max(1, ...map.values());
    $("revenueChart").innerHTML = buckets.length ? `
      <div class="chart">
        ${buckets.map(({ k, d }) => {
          const v = map.get(k) || 0;
          const h = Math.max(4, Math.round((v / max) * 100));
          return `<div class="chart-col" title="${k}: ${money(v)}">
            <div style="flex:1;display:flex;align-items:flex-end;width:100%">
              <div class="chart-bar ${v ? "" : "is-empty"}" style="height:${h}%"></div>
            </div>
            <span class="chart-lbl">${d.getDate()}</span>
          </div>`;
        }).join("")}
      </div>
      <div class="flex justify-between text-xs text-slate-400 font-bold mt-3">
        <span>الأعلى في اليوم: ${money(max)}</span>
        <span>إجمالي 14 يوماً: ${money([...map.values()].reduce((a, b) => a + b, 0))}</span>
      </div>` : `<p class="text-sm text-gray-400 py-6">لا توجد بيانات بعد.</p>`;

    // --- المتاجر الأعلى إيراداً ---
    const stats = sellerStats();
    const top = S.sellers
      .map((s) => ({ s, revenue: stats.rev.get(s.id) || 0, orders: stats.ord.get(s.id) || 0 }))
      .filter((x) => x.revenue > 0 || x.orders > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
    $("topSellers").innerHTML = top.length ? top.map((x, i) => `
      <div class="leader-row">
        <span class="rank-badge ${i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : ""}">${i + 1}</span>
        <div class="leader-main">
          <div class="leader-name">${esc(x.s.name || "—")}</div>
          <div class="leader-sub">${num(x.orders)} طلب · ${esc(x.s.email || "")}</div>
        </div>
        <span class="leader-val">${money(x.revenue)}</span>
      </div>`).join("") : `<p class="text-sm text-gray-400 py-6">لا مبيعات بعد.</p>`;

    // --- المنتجات الأكثر مبيعاً ---
    const sales = new Map();
    S.orders.forEach((o) => {
      if (o.status === "ملغى") return;
      (o.items || []).forEach((it) => {
        const e = sales.get(it.productId) || { name: it.name, qty: 0, revenue: 0 };
        e.qty += it.qty;
        e.revenue += it.price * it.qty;
        sales.set(it.productId, e);
      });
    });
    const topP = [...sales.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
    $("topProducts").innerHTML = topP.length ? topP.map((x, i) => `
      <div class="leader-row">
        <span class="rank-badge ${i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : ""}">${i + 1}</span>
        <div class="leader-main">
          <div class="leader-name">${esc(x.name || "—")}</div>
          <div class="leader-sub">${num(x.qty)} قطعة مباعة</div>
        </div>
        <span class="leader-val">${money(x.revenue)}</span>
      </div>`).join("") : `<p class="text-sm text-gray-400 py-6">لا مبيعات بعد.</p>`;
  }

  // =========================================================
  //  التحديد الجماعي
  // =========================================================
  function updateBulk(kind) {
    const bar = $(`bulk${cap(kind)}Bar`);
    const info = $(`bulk${cap(kind)}Info`);
    const n = S.selected[kind].size;
    if (bar) bar.classList.toggle("hidden", n === 0);
    if (info) info.textContent = n;
    syncSelectAll(kind);
  }
  function syncSelectAll(kind) {
    const all = document.querySelector(`[data-pick-all="${kind}"]`);
    if (!all) return;
    const boxes = [...document.querySelectorAll(`[data-pick="${kind}"]`)];
    const checked = boxes.filter((b) => b.checked).length;
    all.checked = boxes.length > 0 && checked === boxes.length;
    all.indeterminate = checked > 0 && checked < boxes.length;
  }
  function clearSelection(kind) {
    S.selected[kind].clear();
    document.querySelectorAll(`[data-pick="${kind}"]`).forEach((b) => { b.checked = false; });
    updateBulk(kind);
  }

  // =========================================================
  //  البائعون
  // =========================================================
  function renderSellers() {
    const q = ($("sellerSearch").value || "").trim().toLowerCase();
    const f = $("sellerFilter").value;
    const sort = $("sellerSort")?.value || "new";
    const stats = sellerStats();

    let list = S.sellers.filter((s) => {
      if (f !== "all" && Auth.getAccountStatus(s).state !== f) return false;
      if (!q) return true;
      return (s.email || "").toLowerCase().includes(q)
        || (s.name || "").toLowerCase().includes(q)
        || (s.whatsapp || "").includes(q);
    });

    const revOf = (s) => stats.rev.get(s.id) || 0;
    const ordOf = (s) => stats.ord.get(s.id) || 0;
    const prodOf = (s) => stats.prod.get(s.id) || 0;
    const endOf = (s) => s.subscription?.end || Infinity;
    if (sort === "expiry") list = list.slice().sort((a, b) => endOf(a) - endOf(b));
    else if (sort === "revenue") list = list.slice().sort((a, b) => revOf(b) - revOf(a));
    else if (sort === "products") list = list.slice().sort((a, b) => prodOf(b) - prodOf(a));
    else if (sort === "orders") list = list.slice().sort((a, b) => ordOf(b) - ordOf(a));
    else if (sort === "name") list = list.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
    else list = list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    $("sellersEmpty").classList.toggle("hidden", list.length > 0);
    $("sellersBody").innerHTML = list.map((s) => `
      <tr data-id="${s.id}">
        <td><input type="checkbox" class="pick" data-pick="sellers" data-id="${s.id}" ${S.selected.sellers.has(s.id) ? "checked" : ""}></td>
        <td>
          <div class="font-medium">${esc(s.name || "—")}</div>
          <div class="tile-cat">${esc(s.email || "—")}</div>
        </td>
        <td>${statusChip(s)}</td>
        <td class="text-sm">${fmtDate(s.subscription?.end)}</td>
        <td class="text-sm">${num(prodOf(s))} / ${num(ordOf(s))}
          ${revOf(s) ? `<div class="tile-cat">${money(revOf(s))}</div>` : ""}</td>
        <td class="text-left whitespace-nowrap">
          <button class="table-btn table-btn-ok" data-act="manage-seller" data-id="${s.id}">إدارة</button>
          <a class="table-btn" target="_blank" rel="noopener" href="store.html?seller=${s.id}">المتجر</a>
          ${s.whatsapp ? `<a class="table-btn" target="_blank" rel="noopener" href="${waLink(s.whatsapp)}">واتساب</a>` : ""}
        </td>
      </tr>`).join("");
    updateBulk("sellers");
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
        <h4 style="color:var(--adm-danger)">⚠️ منطقة الخطر</h4>
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

  // ---------- الإجراءات الجماعية على البائعين ----------
  async function bulkSellerSub(mode) {
    const ids = [...S.selected.sellers];
    if (!ids.length) return;
    const plan = $("bulkSellersPlan").value;
    const label = DB.getPlan(plan)?.name || plan;
    const verb = mode === "extend" ? `تمديد "${label}" 30 يوماً لـ` : mode === "cancel" ? "إلغاء اشتراك" : `تفعيل "${label}" لـ`;
    if (!confirm(`${verb} ${ids.length} بائع؟`)) return;
    for (const id of ids) {
      const s = sellerById(id);
      if (mode === "cancel") { await DB.cancelSubscription(id); if (s) s.subscription = { active: false, plan: null, start: null, end: null }; continue; }
      const active = s?.subscription?.active && s.subscription.end > Date.now();
      if (mode === "extend" || active) { const sub = await DB.extendSubscription(id, plan); if (s) s.subscription = sub; }
      else { const sub = await DB.activateSubscription(id, plan); if (s) s.subscription = sub; }
    }
    clearSelection("sellers");
    toast(`تم تنفيذ العملية على ${ids.length} بائع ✓`);
    renderAll();
  }

  function bulkSellerWhatsapp() {
    const list = [...S.selected.sellers].map(sellerById).filter((s) => s && waNumber(s.whatsapp));
    if (!list.length) return toast("لا يوجد بائعون محددون بأرقام واتساب.", true);
    openModal(`
      <div class="flex items-start justify-between gap-3 mb-3">
        <h3 class="font-display text-lg">💬 فتح محادثات واتساب (${list.length})</h3>
        <button class="table-btn" data-act="close-modal">✕</button>
      </div>
      <p class="text-sm text-slate-500 mb-3">اضغط على كل بائع لفتح محادثته مباشرة.</p>
      <div class="btn-row">
        ${list.map((s) => `<a class="table-btn" target="_blank" rel="noopener" href="${waLink(s.whatsapp)}">${esc(s.name || s.email)}</a>`).join("")}
      </div>`);
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

  function productList() {
    const q = ($("productSearch").value || "").trim().toLowerCase();
    const cat = $("productCat").value;
    const type = $("productType").value;
    const stock = $("productStockFilter").value;
    const sellerFilter = $("productSearch").dataset.seller || "";
    return S.products.filter((p) => {
      if (sellerFilter && p.sellerId !== sellerFilter) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (type !== "all" && p.type !== type) return false;
      const st = p.stock ?? 0;
      if (stock === "low" && !(st > 0 && st <= DB.LOW_STOCK_THRESHOLD)) return false;
      if (stock === "out" && st > 0) return false;
      if (!q) return true;
      return (p.name || "").toLowerCase().includes(q) || (p.sellerName || sellerName(p.sellerId)).toLowerCase().includes(q);
    });
  }

  function renderProducts() {
    const list = productList();

    $("productsEmpty").classList.toggle("hidden", list.length > 0);
    const start = (S.page.products - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);
    $("productsBody").innerHTML = slice.map((p) => {
      const c = catLabel(p.category);
      const img = p.image
        ? `<img class="adm-thumb" src="${esc(p.image)}" alt="" loading="lazy">`
        : `<span class="adm-thumb">${c?.icon || "📦"}</span>`;
      const st = p.stock ?? 0;
      const stockChip = st === 0 ? `<span class="admin-chip chip-expired">نفد</span>`
        : st <= DB.LOW_STOCK_THRESHOLD ? `<span class="admin-chip chip-warn">منخفض</span>` : "";
      return `<tr data-id="${p.id}">
        <td><input type="checkbox" class="pick" data-pick="products" data-id="${p.id}" ${S.selected.products.has(p.id) ? "checked" : ""}></td>
        <td><div class="flex items-center gap-3">${img}
          <div><div class="font-medium clip">${esc(p.name)}</div>
          <div class="tile-cat">${c ? esc(c.label) : "—"} · ${p.type === "physical" ? "🚚 ملموس" : "⚡ رقمي"} ${stockChip}</div></div></div></td>
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
    updateBulk("products");
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

  async function bulkProductStock() {
    const ids = [...S.selected.products];
    if (!ids.length) return;
    const v = Math.max(0, Number($("bulkProductsStock").value) || 0);
    if (!confirm(`تعيين المخزون إلى ${v} لـ ${ids.length} منتج؟`)) return;
    for (const id of ids) await patch("products", id, { stock: v }, "products");
    clearSelection("products");
    toast("تم تحديث المخزون ✓");
    renderProducts();
  }
  async function bulkProductDelete() {
    const ids = [...S.selected.products];
    if (!ids.length) return;
    if (!confirm(`حذف ${ids.length} منتج نهائياً؟ لا يمكن التراجع.`)) return;
    await batchDelete("products", ids);
    S.products = S.products.filter((p) => !ids.includes(p.id));
    clearSelection("products");
    toast(`تم حذف ${ids.length} منتج.`);
    renderAll();
  }

  // =========================================================
  //  الطلبات
  // =========================================================
  function renderOrders() {
    const q = ($("orderSearch").value || "").trim().toLowerCase();
    const status = $("orderStatus").value;
    const seller = $("orderSeller").value;
    const todayStart = startOfToday();
    const list = S.orders.filter((o) => {
      if (orderQuick === "__today") { if ((o.createdAt || 0) < todayStart) return false; }
      else if (status !== "all" && o.status !== status) return false;
      if (seller !== "all" && !(o.sellerIds || []).includes(seller)) return false;
      if (!q) return true;
      return o.id.toLowerCase().includes(q)
        || (o.customer?.name || "").toLowerCase().includes(q)
        || (o.customer?.phone || "").includes(q);
    });
    S.filteredOrders = list;

    $("ordersEmpty").classList.toggle("hidden", list.length > 0);
    const start = (S.page.orders - 1) * PAGE_SIZE;
    $("ordersBody").innerHTML = list.slice(start, start + PAGE_SIZE).map((o) => {
      const stale = o.status === "قيد الانتظار" && (Date.now() - (o.createdAt || 0) > DAY);
      return `<tr data-id="${o.id}">
        <td><input type="checkbox" class="pick" data-pick="orders" data-id="${o.id}" ${S.selected.orders.has(o.id) ? "checked" : ""}></td>
        <td><div class="font-medium text-sm">#${esc(o.id.slice(0, 6))}</div><div class="tile-cat">${fmtDateTime(o.createdAt)}</div></td>
        <td><div class="text-sm">${esc(o.customer?.name || "—")}</div>
          <div class="tile-cat">${esc(o.customer?.phone || "")}${o.customer?.wilaya ? " · " + esc(o.customer.wilaya) : ""}</div></td>
        <td class="text-sm">${esc((o.sellerIds || []).map(sellerName).join("، "))}</td>
        <td class="text-sm">${money(orderTotal(o))}</td>
        <td><select class="status-select" data-act="order-status" data-id="${o.id}">
          ${DB.ORDER_STATUSES.map((st) => `<option ${o.status === st ? "selected" : ""}>${esc(st)}</option>`).join("")}
        </select>${stale ? `<div class="tile-cat" style="color:#B92626">⏰ معلّق منذ أكثر من يوم</div>` : ""}</td>
        <td class="text-left whitespace-nowrap">
          <button class="table-btn" data-act="view-order" data-id="${o.id}">تفاصيل</button>
          <button class="table-btn table-btn-danger" data-act="delete-order" data-id="${o.id}">حذف</button>
        </td>
      </tr>`;
    }).join("");
    updateBulk("orders");
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

  async function bulkOrderStatus() {
    const ids = [...S.selected.orders];
    if (!ids.length) return;
    const st = $("bulkOrdersStatus").value;
    if (!confirm(`تغيير حالة ${ids.length} طلب إلى "${st}"؟`)) return;
    for (const id of ids) await patch("orders", id, { status: st }, "orders");
    clearSelection("orders");
    toast("تم تحديث حالات الطلبات ✓");
    renderAll();
  }
  async function bulkOrderDelete() {
    const ids = [...S.selected.orders];
    if (!ids.length) return;
    if (!confirm(`حذف ${ids.length} طلب نهائياً؟ سيختفي من لوحات البائعين أيضاً.`)) return;
    await batchDelete("orders", ids);
    S.orders = S.orders.filter((o) => !ids.includes(o.id));
    clearSelection("orders");
    toast(`تم حذف ${ids.length} طلب.`);
    renderAll();
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

  function couponsCSVRows() {
    const rows = [["الكود", "المتجر", "النوع", "القيمة", "الحد الأدنى", "المستخدم", "الحد الأقصى", "الانتهاء", "الحالة"]];
    S.coupons.forEach((c) => rows.push([
      c.code, sellerName(c.sellerId), c.type === "percent" ? "نسبة" : "ثابت", c.value,
      c.minOrder || 0, c.used || 0, c.maxUses || "∞", fmtDate(c.expiresAt),
      !c.active ? "معطّل" : (c.expiresAt && c.expiresAt < Date.now()) ? "منتهي" : "فعّال",
    ]));
    return rows;
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

    $("attemptsCount").textContent = `(${S.attempts.length})`;
    $("attemptsEmpty").classList.toggle("hidden", S.attempts.length > 0);
    $("attemptsBody").innerHTML = S.attempts.map((a) => `
      <tr data-id="${a.id}">
        <td><div class="font-medium text-sm" dir="ltr" style="text-align:right">${esc(a.phone)}</div>
          <div class="tile-cat">${esc(a.name || "بدون اسم")} · طلب بقيمة ${money(a.total)}</div></td>
        <td class="text-sm">${esc(sellerName(a.sellerId))}</td>
        <td class="text-sm">${fmtDateTime(a.createdAt)}</td>
        <td><span class="admin-chip ${a.seen ? "chip-none" : "chip-warn"}">${a.seen ? "تمت المراجعة" : "جديدة"}</span></td>
        <td class="text-left whitespace-nowrap">
          ${a.phone ? `<a class="table-btn" target="_blank" rel="noopener" href="${waLink(a.phone)}">واتساب</a>` : ""}
          <button class="table-btn table-btn-danger" data-act="delete-attempt" data-id="${a.id}">حذف</button>
        </td>
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
  //  البحث الشامل (Command Search)
  // =========================================================
  function renderGsearch() {
    const box = $("globalResults");
    if (!box) return;
    const q = ($("globalSearch").value || "").trim().toLowerCase();
    if (!q) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    const sellers = S.sellers.filter((s) => (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q))
      .slice(0, 4).map((s) => ({ kind: "بائع", cls: "", go: "seller", id: s.id, title: s.name || s.email, sub: s.email || "" }));
    const products = S.products.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.sellerName || "").toLowerCase().includes(q))
      .slice(0, 4).map((p) => ({ kind: "منتج", cls: "k-product", go: "product", id: p.id, title: p.name, sub: `${money(p.price)} — ${p.sellerName || sellerName(p.sellerId)}` }));
    const orders = S.orders.filter((o) => o.id.toLowerCase().includes(q) || (o.customer?.name || "").toLowerCase().includes(q) || (o.customer?.phone || "").includes(q))
      .slice(0, 4).map((o) => ({ kind: "طلب", cls: "k-order", go: "order", id: o.id, title: `#${o.id.slice(0, 6)} — ${o.customer?.name || ""}`, sub: `${money(orderTotal(o))} — ${o.status || ""}` }));
    const all = [...sellers, ...products, ...orders];
    box.innerHTML = all.length
      ? `<p class="text-xs text-slate-400 font-bold px-2 py-1">${all.length} نتيجة</p>` + all.map((r) => `
          <div class="gres-item" data-goto="${r.go}" data-id="${r.id}">
            <span class="gres-kind ${r.cls}">${r.kind}</span>
            <div class="gres-main"><div class="gres-title">${esc(r.title)}</div><div class="gres-sub">${esc(r.sub)}</div></div>
          </div>`).join("")
      : `<p class="text-sm text-slate-400 p-3">لا نتائج مطابقة لـ "${esc(q)}".</p>`;
    box.classList.remove("hidden");
  }
  function hideGsearch() {
    const box = $("globalResults");
    if (box) { box.classList.add("hidden"); box.innerHTML = ""; }
  }
  function gotoResult(go, id) {
    hideGsearch();
    if ($("globalSearch")) $("globalSearch").value = "";
    if (go === "seller") return openSellerModal(id);
    if (go === "product") {
      const p = S.products.find((x) => x.id === id);
      closeModal(); switchTab("products");
      $("productSearch").value = p ? p.name : "";
      $("productSearch").dataset.seller = "";
      S.page.products = 1; renderProducts();
      if (p) toast(`المنتج: ${p.name}`);
      return;
    }
    if (go === "order") {
      closeModal(); switchTab("orders");
      orderQuick = "all"; syncQuickChips();
      $("orderSearch").value = id; S.page.orders = 1; renderOrders();
    }
  }

  function syncQuickChips() {
    document.querySelectorAll("[data-quick]").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.quick === orderQuick));
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
      toast("تعذّر تنفيذ العملية — راجع قواعد Firestore (كما في README).", true);
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
    $("bulkSellersPlan").innerHTML = DB.PLANS.map((p) => `<option value="${p.id}">${esc(p.name)} — ${money(p.price)}</option>`).join("");
    $("bulkOrdersStatus").innerHTML = DB.ORDER_STATUSES.map((s) => `<option>${esc(s)}</option>`).join("");
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
    $("sideRefresh").addEventListener("click", () => guarded(reload));

    // فلاتر
    $("sellerSearch").addEventListener("input", renderSellers);
    $("sellerFilter").addEventListener("change", renderSellers);
    $("sellerSort").addEventListener("change", renderSellers);
    ["productSearch", "productCat", "productType", "productStockFilter"].forEach((id) =>
      $(id).addEventListener(id === "productSearch" ? "input" : "change", () => { S.page.products = 1; renderProducts(); }));
    ["orderSearch", "orderSeller"].forEach((id) =>
      $(id).addEventListener("input", () => { S.page.orders = 1; renderOrders(); }));
    $("orderStatus").addEventListener("change", () => {
      orderQuick = $("orderStatus").value;
      syncQuickChips();
      S.page.orders = 1; renderOrders();
    });
    $("couponSearch").addEventListener("input", renderCoupons);

    // شرائح فلترة الطلبات
    document.querySelectorAll("[data-quick]").forEach((chip) => chip.addEventListener("click", () => {
      orderQuick = chip.dataset.quick;
      if (orderQuick === "__today") { $("orderStatus").value = "all"; }
      else if (orderQuick === "all") { $("orderStatus").value = "all"; }
      else { $("orderStatus").value = orderQuick; }
      syncQuickChips();
      S.page.orders = 1; renderOrders();
    }));

    // البحث الشامل
    $("globalSearch").addEventListener("input", renderGsearch);
    $("globalSearch").addEventListener("focus", renderGsearch);

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
    const exportProducts = () => {
      const rows = [["المنتج", "المتجر", "التصنيف", "النوع", "السعر", "المخزون", "الإنشاء"]];
      S.products.forEach((p) => rows.push([p.name, p.sellerName || sellerName(p.sellerId), catLabel(p.category)?.label || "", p.type, p.price, p.stock ?? 0, fmtDate(p.createdAt)]));
      downloadCSV("products.csv", rows);
    };
    $("exportProductsBtn").addEventListener("click", exportProducts);
    $("exportProductsBtn2").addEventListener("click", exportProducts);
    $("exportSellersBtn").addEventListener("click", () => {
      const rows = [["الاسم", "البريد", "واتساب", "الحالة", "الخطة", "نهاية الاشتراك", "تاريخ التسجيل"]];
      S.sellers.forEach((s) => {
        const st = Auth.getAccountStatus(s);
        rows.push([s.name, s.email, s.whatsapp, st.state, DB.getPlan(st.plan)?.name || "", fmtDate(s.subscription?.end), fmtDate(s.createdAt)]);
      });
      downloadCSV("sellers.csv", rows);
    });
    $("exportCouponsBtn").addEventListener("click", () => downloadCSV("coupons.csv", couponsCSVRows()));
    $("exportCouponsBtn2").addEventListener("click", () => downloadCSV("coupons.csv", couponsCSVRows()));
    $("exportBlacklistBtn").addEventListener("click", () => {
      const rows = [["الهاتف", "الاسم", "السبب", "المتجر", "التاريخ"]];
      S.blacklist.forEach((b) => rows.push([b.phone, b.name || "", b.reason || "", sellerName(b.sellerId), fmtDate(b.createdAt)]));
      downloadCSV("blacklist.csv", rows);
    });

    $("bcBuild").addEventListener("click", buildBroadcast);
    $("cleanOrphans").addEventListener("click", () => guarded(() => runCleanup("orphans")));
    $("cleanCancelled").addEventListener("click", () => guarded(() => runCleanup("cancelled")));
    $("cleanAttempts").addEventListener("click", () => guarded(() => runCleanup("attempts")));

    // نافذة: إغلاق بالنقر خارجها
    $("admModal").addEventListener("click", (e) => { if (e.target.id === "admModal") closeModal(); });

    // إخفاء البحث الشامل عند النقر خارجه
    document.addEventListener("click", (e) => { if (!e.target.closest(".gsearch")) hideGsearch(); });

    // ---- تفويض النقرات العام ----
    document.addEventListener("click", (e) => {
      const g = e.target.closest("[data-goto]");
      if (g) return guarded(async () => gotoResult(g.dataset.goto, g.dataset.id));

      const alertEl = e.target.closest("[data-alert-tab]");
      if (alertEl) return switchTab(alertEl.dataset.alertTab);

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
            orderQuick = "all"; syncQuickChips();
            $("orderSeller").value = id; S.page.orders = 1; return renderOrders();
          case "page":
            S.page[el.dataset.key] += Number(el.dataset.dir);
            return el.dataset.key === "products" ? renderProducts() : renderOrders();
          case "edit-product": return openProductModal(id);
          case "delete-product": {
            const p = S.products.find((x) => x.id === id);
            if (!confirm(`حذف المنتج "${p?.name}" نهائياً؟`)) return;
            await remove("products", id, "products");
            S.selected.products.delete(id);
            toast("تم حذف المنتج."); return renderAll();
          }
          case "view-order": return openOrderModal(id);
          case "delete-order": {
            if (!confirm("حذف هذا الطلب نهائياً؟ سيختفي من لوحة البائع أيضاً.")) return;
            await remove("orders", id, "orders");
            S.selected.orders.delete(id);
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
          case "delete-attempt": {
            if (!confirm("حذف سجل هذه المحاولة؟")) return;
            await remove("blacklist_attempts", id, "attempts");
            return renderSafety();
          }
          case "bulk-clear": {
            const kind = el.dataset.kind;
            clearSelection(kind);
            return kind === "sellers" ? renderSellers() : kind === "products" ? renderProducts() : renderOrders();
          }
          case "bulk-seller-activate": return bulkSellerSub("activate");
          case "bulk-seller-extend": return bulkSellerSub("extend");
          case "bulk-seller-cancel": return bulkSellerSub("cancel");
          case "bulk-seller-whatsapp": return bulkSellerWhatsapp();
          case "bulk-product-stock": return bulkProductStock();
          case "bulk-product-delete": return bulkProductDelete();
          case "bulk-order-status": return bulkOrderStatus();
          case "bulk-order-delete": return bulkOrderDelete();
        }
      });
    });

    // تغييرات الحقول المضمّنة (تحديد / مخزون / حالة طلب)
    document.addEventListener("change", (e) => {
      const pick = e.target.closest("[data-pick]");
      if (pick) {
        const kind = pick.dataset.pick;
        if (pick.checked) S.selected[kind].add(pick.dataset.id);
        else S.selected[kind].delete(pick.dataset.id);
        return updateBulk(kind);
      }
      const pickAll = e.target.closest("[data-pick-all]");
      if (pickAll) {
        const kind = pickAll.dataset.pickAll;
        const boxes = [...document.querySelectorAll(`[data-pick="${kind}"]`)];
        boxes.forEach((b) => { b.checked = pickAll.checked; if (pickAll.checked) S.selected[kind].add(b.dataset.id); else S.selected[kind].delete(b.dataset.id); });
        return updateBulk(kind);
      }
      const el = e.target.closest("[data-act]");
      if (!el) return;
      if (el.dataset.act === "stock") {
        const v = Math.max(0, Number(el.value) || 0);
        guarded(async () => { await patch("products", el.dataset.id, { stock: v }, "products"); toast("تم تحديث المخزون ✓"); });
      } else if (el.dataset.act === "order-status") {
        guarded(async () => {
          await patch("orders", el.dataset.id, { status: el.value }, "orders");
          toast("تم تحديث حالة الطلب ✓");
          renderOverview(); renderAlerts();
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
