/* =========================================================
   DUKAN — لوحة تحكم البائع (Firebase)
   ========================================================= */
import { DB } from "./db.js";
import { Auth } from "./auth.js";
import { Store } from "./store.js";
import { SubGuard } from "./subguard.js";
import { Features } from "./features.js";

export const Dashboard = (() => {
  function money(n) {
    return new Intl.NumberFormat("ar-DZ").format(n) + " د.ج";
  }

  async function renderStatusBanner(seller) {
    const el = document.getElementById("statusBanner");
    const status = Auth.getAccountStatus(seller);

    if (status.state === "trial") {
      el.innerHTML = `<div class="status-banner status-trial">
        <span>🕐 أنت في الفترة التجريبية — متبقي <strong id="trialCountdown">...</strong></span>
        <a href="pricing.html" class="status-link">اشترك الآن وتجنّب الانقطاع</a>
      </div>`;
      const countdownEl = document.getElementById("trialCountdown");
      Store.startCountdown(status.end, (p) => {
        countdownEl.textContent = `${p.d} يوم ${String(p.h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}:${String(p.s).padStart(2, "0")}`;
      }, () => window.location.reload());
    } else if (status.state === "subscribed") {
      const plan = DB.getPlan(status.plan);
      const planLabel = plan?.name || "شهرية";
      el.innerHTML = `<div class="status-banner status-active">
        <span>✓ خطتك "${planLabel}" فعّالة — تتجدد خلال ${status.daysLeft} يوم.</span>
      </div>`;

      // مؤشر استهلاك الحد الأقصى للطلبات الشهرية (لا يظهر للخطط غير المحدودة)
      if (plan && plan.maxOrders != null) {
        try {
          const cap = await DB.checkOrderCap(seller.id);
          const pct = Math.min(100, Math.round((cap.count / cap.max) * 100));
          const nearLimit = pct >= 80;
          el.insertAdjacentHTML("beforeend", `
            <div class="order-cap-bar ${nearLimit ? "is-near" : ""}">
              <div class="order-cap-row">
                <span>📦 ${cap.count} / ${cap.max} طلب هذا الشهر</span>
                ${nearLimit ? `<a href="pricing.html" class="status-link">رقّي خطتك</a>` : ""}
              </div>
              <div class="order-cap-track"><div class="order-cap-fill" style="width:${pct}%"></div></div>
            </div>`);
        } catch (err) {
          console.warn("[order cap indicator]", err.message);
        }
      }
    } else {
      el.innerHTML = "";
    }
  }

  function renderAvatar(seller) {
    const el = document.getElementById("sellerAvatar");
    if (!el) return;
    if (seller.avatar) el.innerHTML = `<img src="${seller.avatar}" class="avatar-img">`;
    else el.textContent = seller.name.trim().charAt(0) || "د";
  }

  // التبديل بين متجرك الخاص وفريق العمل (يُحفظ لكل مستخدم)
  function switchRole(seller, role) {
    if (seller && seller.__uid) localStorage.setItem("dukan_role_" + seller.__uid, role);
    window.location.reload();
  }

  // وضع الموظف: ترويسة + إخفاء الأقسام غير المسموح بها + تقييد الإجراءات
  function applyStaffMode(seller) {
    const staff = seller.__staff || {};
    const perms = new Set(staff.permissions || []);
    const can = (p) => perms.has(p);

    document.getElementById("sellerName").textContent = staff.name || "موظف";
    const av = document.getElementById("sellerAvatar");
    if (av) av.textContent = (staff.name || "م").trim().charAt(0) || "م";
    const greet = document.getElementById("topbarGreeting");
    if (greet) greet.textContent = "موظف في";

    const banner = document.getElementById("statusBanner");
    banner.innerHTML = `<div class="status-banner status-staff">
      <span>👤 أنت مسجّل كموظف في متجر «<strong>${Store.escapeHtml(seller.name)}</strong>» — صلاحياتك محدودة حسب ما منحه لك صاحب المتجر.</span>
      ${seller.__ownSeller ? `<button type="button" id="switchToOwner" class="status-link">فتح متجري الخاص</button>` : ""}
    </div>`;
    const switchBtn = document.getElementById("switchToOwner");
    if (switchBtn) switchBtn.addEventListener("click", () => switchRole(seller, "owner"));

    // الأقسام المسموح بها حسب الصلاحيات الممنوحة
    const allowed = new Set();
    if (can("analytics_view")) allowed.add("overview");
    if (can("products_view") || can("products_manage")) allowed.add("products");
    if (can("orders_view") || can("orders_update")) { allowed.add("orders"); allowed.add("customers"); }
    if (can("analytics_view")) allowed.add("analytics");
    if (can("coupons_manage")) allowed.add("coupons");
    if (can("blacklist_manage")) allowed.add("blacklist");

    // أقسام محظورة دائماً على الموظف (إدارة الفريق/الإعدادات/التسويق)
    const alwaysHidden = ["staff", "delivery", "pixels"];
    document.querySelectorAll("[data-tab-btn]").forEach((btn) => {
      const t = btn.dataset.tabBtn;
      if (alwaysHidden.includes(t) || !allowed.has(t)) btn.classList.add("hidden");
    });
    document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
      const t = panel.dataset.tabPanel;
      if (alwaysHidden.includes(t) || !allowed.has(t)) panel.classList.add("hidden");
    });

    document.getElementById("adminLink")?.classList.add("hidden");
    document.querySelector('a[href="settings.html"]')?.classList.add("hidden");

    // تفعيل أول تبويب مسموح
    const allBtns = [...document.querySelectorAll("[data-tab-btn]")];
    allBtns.forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll("[data-tab-panel]").forEach((p) => p.classList.add("hidden"));
    const first = allBtns.find((b) => !b.classList.contains("hidden"));
    if (first) {
      first.classList.add("is-active");
      document.querySelector(`[data-tab-panel="${first.dataset.tabBtn}"]`)?.classList.remove("hidden");
    }

    seller.__canManageProducts = can("products_manage");
    seller.__canUpdateOrders = can("orders_update");
  }

  function renderAlsoStaffBanner(seller) {
    const banner = document.getElementById("statusBanner");
    const storeName = seller.__alsoStaff?.storeName || "";
    banner.insertAdjacentHTML("beforeend", `<div class="status-banner status-staff">
      <span>👥 أنت أيضاً موظف في متجر «<strong>${Store.escapeHtml(storeName)}</strong>».</span>
      <button type="button" id="switchToStaff" class="status-link">الدخول كموظف</button>
    </div>`);
    document.getElementById("switchToStaff")?.addEventListener("click", () => switchRole(seller, "staff"));
  }

  async function initShell() {
    // حارس الاشتراك: يعرض شاشة حظر حمراء بدل التحويل الصامت
    const seller = await SubGuard.enforce();
    if (!seller) return null;

    const isStaff = !!seller.__isStaff;

    if (isStaff) {
      applyStaffMode(seller);
    } else {
      document.getElementById("sellerName").textContent = seller.name;
      renderAvatar(seller);
      const greet = document.getElementById("topbarGreeting");
      if (greet) greet.textContent = "مرحباً بعودتك،";
      renderStatusBanner(seller);
      if (seller.__alsoStaff) renderAlsoStaffBanner(seller);
    }

    const storeLink = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}store.html?seller=${seller.id}`;
    const viewStoreLink = document.getElementById("viewStoreLink");
    if (viewStoreLink) viewStoreLink.href = storeLink;
    const copyBtn = document.getElementById("copyStoreLinkBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(storeLink).then(() => {
          const original = copyBtn.textContent;
          copyBtn.textContent = "تم النسخ ✓";
          setTimeout(() => (copyBtn.textContent = original), 1800);
        });
      });
    }

    // رابط لوحة الإدارة يظهر فقط لبريد المشرف (وليس للموظف)
    const adminLink = document.getElementById("adminLink");
    if (adminLink && !isStaff && DB.isAdminEmail(seller.email)) adminLink.classList.remove("hidden");

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await Auth.logout();
        window.location.href = "login.html";
      });
    }
    return seller;
  }

  // ---------- تبويب المنتجات ----------
  async function renderProductsTable(seller) {
    const tbody = document.getElementById("productsBody");
    const empty = document.getElementById("productsEmpty");
    const canManage = seller.__canManageProducts !== false;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400">جارٍ التحميل…</td></tr>`;
    const products = await DB.getProductsBySeller(seller.id);

    empty.classList.toggle("hidden", products.length > 0);
    tbody.innerHTML = products.map((p) => `
      <tr data-id="${p.id}">
        <td>
          <div class="flex items-center gap-3">
            <div class="dash-thumb" style="background: var(--tile-${p.category}, var(--c-sand))">
              ${p.image ? `<img src="${p.image}" class="dash-thumb-img">` : Store.categoryOf(p.category).icon}
            </div>
            <span class="font-medium">${Store.escapeHtml(p.name)}</span>
          </div>
        </td>
        <td>${Store.categoryOf(p.category).label}</td>
        <td>${p.type === "physical" ? "ملموس 🚚" : "رقمي ⚡"}</td>
        <td>${money(p.price)}</td>
        <td>${
          (p.stock ?? 0) === 0
            ? `<span class="stock-pill stock-out">نفد</span>`
            : (p.stock ?? 0) <= DB.LOW_STOCK_THRESHOLD
              ? `<span class="stock-pill stock-low">${p.stock}</span>`
              : p.stock
        }</td>
        <td class="text-left">
          ${canManage ? `
            <button class="table-btn" data-edit>تعديل</button>
            <button class="table-btn table-btn-danger" data-delete>حذف</button>` : `<span class="tile-cat">عرض فقط</span>`}
        </td>
      </tr>`).join("");
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function openProductModal(seller, product = null) {
    const modal = document.getElementById("productModal");
    const form = document.getElementById("productForm");
    form.reset();
    document.getElementById("modalTitle").textContent = product ? "تعديل المنتج" : "إضافة منتج جديد";
    form.elements.category.innerHTML = DB.CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join("");

    const preview = document.getElementById("imagePreview");
    preview.classList.add("hidden");
    preview.removeAttribute("src");
    form.dataset.currentImage = "";

    if (product) {
      form.elements.id.value = product.id;
      form.elements.name.value = product.name;
      form.elements.category.value = product.category;
      form.elements.type.value = product.type || "digital";
      form.elements.price.value = product.price;
      form.elements.oldPrice.value = product.oldPrice || "";
      form.elements.stock.value = product.stock;
      form.elements.description.value = product.description || "";
      form.elements.imageUrl.value = product.image && product.image.startsWith("http") ? product.image : "";
      if (product.image) {
        preview.src = product.image;
        preview.classList.remove("hidden");
        form.dataset.currentImage = product.image;
      }
    } else {
      form.elements.id.value = "";
      form.elements.type.value = "digital";
    }
    modal.classList.remove("hidden");
  }

  function closeProductModal() {
    document.getElementById("productModal").classList.add("hidden");
  }

  function initProductsTab(seller) {
    renderProductsTable(seller);
    // موظف بصلاحية عرض فقط → لا إضافة/تعديل/حذف
    if (seller.__canManageProducts === false) {
      document.getElementById("addProductBtn")?.classList.add("hidden");
      return;
    }
    document.getElementById("addProductBtn").addEventListener("click", () => openProductModal(seller));
    document.getElementById("closeModalBtn").addEventListener("click", closeProductModal);
    document.getElementById("cancelModalBtn").addEventListener("click", closeProductModal);

    const form = document.getElementById("productForm");
    const fileInput = document.getElementById("imageFile");
    const preview = document.getElementById("imagePreview");

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 700 * 1024) {
        alert("الصورة كبيرة جداً (الحد الأقصى تقريباً 700KB). استخدم صورة أصغر أو الصق رابط صورة بدل الرفع.");
        fileInput.value = "";
        return;
      }
      const base64 = await fileToBase64(file);
      preview.src = base64;
      preview.classList.remove("hidden");
      form.dataset.currentImage = base64;
    });

    form.elements.imageUrl.addEventListener("input", () => {
      const url = form.elements.imageUrl.value.trim();
      if (url) {
        preview.src = url;
        preview.classList.remove("hidden");
        form.dataset.currentImage = url;
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.textContent = "جارٍ الحفظ…";

      const fd = new FormData(form);
      const id = fd.get("id");
      const payload = {
        name: fd.get("name").trim(),
        category: fd.get("category"),
        type: fd.get("type"),
        price: Number(fd.get("price")),
        oldPrice: fd.get("oldPrice") ? Number(fd.get("oldPrice")) : null,
        stock: Number(fd.get("stock")),
        description: fd.get("description").trim(),
        image: form.dataset.currentImage || "",
      };

      try {
        if (id) {
          await DB.updateProduct(id, payload);
        } else {
          await DB.addProduct({ ...payload, sellerId: seller.id, sellerName: seller.name });
        }
        closeProductModal();
        await renderProductsTable(seller);
      } catch (err) {
        console.error(err);
        alert("تعذّر حفظ المنتج. تأكد من إعداد Firebase بشكل صحيح (راجع README).");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "حفظ المنتج";
      }
    });

    document.getElementById("productsBody").addEventListener("click", async (e) => {
      const row = e.target.closest("tr[data-id]");
      if (!row) return;
      const id = row.dataset.id;
      if (e.target.closest("[data-edit]")) {
        const product = await DB.getProductById(id);
        openProductModal(seller, product);
      }
      if (e.target.closest("[data-delete]")) {
        if (confirm("هل تريد حذف هذا المنتج نهائياً؟")) {
          await DB.deleteProduct(id);
          await renderProductsTable(seller);
        }
      }
    });
  }

  // ---------- تبويب الطلبات ----------
  let cachedOrders = [];

  async function renderOrders(seller) {
    const tbody = document.getElementById("ordersBody");
    const empty = document.getElementById("ordersEmpty");
    const canUpdate = seller.__canUpdateOrders !== false;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400">جارٍ التحميل…</td></tr>`;
    const orders = await DB.getOrdersForSeller(seller.id);
    cachedOrders = orders;

    empty.classList.toggle("hidden", orders.length > 0);
    tbody.innerHTML = orders.map((o) => {
      const subtotal = o.items.reduce((s, it) => s + it.price * it.qty, 0);
      const itemsLabel = o.items.map((it) => `${it.name} ×${it.qty}`).join("، ");
      return `
        <tr data-id="${o.id}">
          <td class="font-mono text-sm">${o.id.slice(-8)}</td>
          <td>${Store.escapeHtml(o.customer.name)}<br><span class="tile-cat">${Store.escapeHtml(o.customer.phone)}</span></td>
          <td class="text-sm">${Store.escapeHtml(itemsLabel)}</td>
          <td>${money(subtotal)}</td>
          <td>
            ${canUpdate ? `<select class="status-select" data-status>
              ${DB.ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
            </select>` : `<span class="status-badge">${Store.escapeHtml(o.status)}</span>`}
          </td>
          <td><button class="table-btn" data-view>عرض</button></td>
        </tr>`;
    }).join("");
  }

  function openOrderModal(order) {
    const body = document.getElementById("orderModalBody");
    const subtotal = order.subtotal ?? order.items.reduce((s, it) => s + it.price * it.qty, 0);
    body.innerHTML = `
      <div class="order-items-list">
        ${order.items.map((it) => `
          <div class="order-item-line">
            <span>${Store.escapeHtml(it.name)} × ${it.qty} <span class="tile-cat">(${it.type === "physical" ? "ملموس 🚚" : "رقمي ⚡"})</span></span>
            <span>${money(it.price * it.qty)}</span>
          </div>`).join("")}
      </div>
      <div class="order-detail-row"><span>المجموع الفرعي</span><span>${money(subtotal)}</span></div>
      ${order.discount ? `<div class="order-detail-row"><span>الخصم (${Store.escapeHtml(order.coupon || "")})</span><span>− ${money(order.discount)}</span></div>` : ""}
      ${order.deliveryCost ? `<div class="order-detail-row"><span>التوصيل (${order.deliveryMode === "desk" ? "مكتب" : "منزل"})</span><span>${money(order.deliveryCost)}</span></div>` : ""}
      <div class="order-detail-row font-bold"><span>الإجمالي</span><span>${money(order.total ?? subtotal)}</span></div>
      <div class="order-detail-row"><span>الاسم</span><span>${Store.escapeHtml(order.customer.name)}</span></div>
      <div class="order-detail-row"><span>الهاتف</span><span class="font-mono">${Store.escapeHtml(order.customer.phone)}</span></div>
      ${order.customer.wilaya ? `<div class="order-detail-row"><span>الولاية</span><span>${Store.escapeHtml(order.customer.wilaya)}</span></div>` : ""}
      ${order.customer.address ? `<div class="order-detail-row"><span>العنوان</span><span>${Store.escapeHtml(order.customer.address)}</span></div>` : ""}
      <div class="order-detail-row"><span>تاريخ الطلب</span><span>${new Date(order.createdAt).toLocaleString("ar-DZ")}</span></div>
      <div class="order-detail-row"><span>الحالة</span><span>${Store.escapeHtml(order.status)}</span></div>
    `;
    document.getElementById("orderModal").classList.remove("hidden");
  }

  function initOrderModal() {
    document.getElementById("closeOrderModalBtn").addEventListener("click", () => {
      document.getElementById("orderModal").classList.add("hidden");
    });
  }

  function initOrdersTab(seller) {
    renderOrders(seller);
    initOrderModal();
    document.getElementById("ordersBody").addEventListener("click", async (e) => {
      if (!e.target.closest("[data-view]")) return;
      const id = e.target.closest("tr").dataset.id;
      const order = cachedOrders.find((o) => o.id === id);
      if (order) openOrderModal(order);
    });
    document.getElementById("ordersBody").addEventListener("change", async (e) => {
      if (seller.__canUpdateOrders === false) return;
      const select = e.target.closest("[data-status]");
      if (!select) return;
      const id = e.target.closest("tr").dataset.id;
      await DB.updateOrderStatus(id, select.value);
    });
    document.getElementById("exportOrdersBtn").addEventListener("click", () => {
      if (!cachedOrders.length) return;
      const csv = "\uFEFF" + DB.ordersToCSV(cachedOrders);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `طلبات-${seller.name}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /* ============ نظرة عامة ============ */
  async function initOverview(seller, orders, products) {
    const recentWrap = document.getElementById("recentOrdersWrap");
    const recent = orders.slice(0, 6);
    recentWrap.innerHTML = recent.length
      ? recent.map((o) => {
          const subtotal = o.items.reduce((s, it) => s + it.price * it.qty, 0);
          return `<div class="mini-order-row">
            <span>${Store.escapeHtml(o.customer.name)} <span class="tile-cat">— ${o.items.length} منتج</span></span>
            <span class="font-bold">${money(subtotal)}</span>
          </div>`;
        }).join("")
      : `<p class="text-gray-400 text-sm">لا توجد طلبات بعد.</p>`;

    const chartWrap = document.getElementById("overviewChart");
    try {
      const visits = await DB.getVisits(seller.id, 14);
      const max = Math.max(1, ...visits.map((v) => v.count || 0));
      chartWrap.innerHTML = visits.length
        ? `<div class="mini-chart">
            ${visits.map((v) => `
              <div class="mini-bar-wrap" title="${v.day}: ${v.count} زيارة">
                <div class="mini-bar" style="height:${Math.max(4, ((v.count || 0) / max) * 100)}%"></div>
                <span class="mini-label">${v.day.slice(8)}</span>
              </div>`).join("")}
          </div>`
        : `<p class="text-gray-400 text-sm">لا توجد بيانات زيارات بعد.</p>`;
    } catch (err) {
      chartWrap.innerHTML = `<p class="text-gray-400 text-sm">تعذّر تحميل بيانات الزيارات.</p>`;
    }
  }

  /* ============ العملاء ============ */
  async function initCustomersTab(seller) {
    const tbody = document.getElementById("customersBody");
    const empty = document.getElementById("customersEmpty");
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-400">جارٍ التحميل…</td></tr>`;
    const customers = await DB.getCustomers(seller.id);
    empty.classList.toggle("hidden", customers.length > 0);
    document.getElementById("statCustomers").textContent = customers.length;
    tbody.innerHTML = customers.map((c) => `
      <tr>
        <td>
          <div class="font-medium">${Store.escapeHtml(c.name || "—")}${c.orders > 1 ? `<span class="vip-badge">VIP</span>` : ""}</div>
          <div class="tile-cat font-mono">${Store.escapeHtml(c.phone)}</div>
        </td>
        <td>${Store.escapeHtml(c.wilaya || "—")}</td>
        <td>${c.orders}</td>
        <td class="font-bold">${money(c.total)}</td>
        <td class="text-sm">${new Date(c.lastOrderAt).toLocaleDateString("ar-DZ")}</td>
      </tr>`).join("");
    return customers;
  }

  /* ============ التوصيل حسب الولاية ============ */
  async function initDeliveryTab(seller) {
    const delivery = seller.delivery || { enabled: false, defaultHome: 0, defaultDesk: 0, overrides: {} };
    document.getElementById("deliveryEnabled").checked = !!delivery.enabled;
    document.getElementById("defaultHome").value = delivery.defaultHome || "";
    document.getElementById("defaultDesk").value = delivery.defaultDesk || "";

    const listEl = document.getElementById("wilayaList");
    function renderWilayas(filter = "") {
      const q = filter.trim().toLowerCase();
      const list = DB.WILAYAS.filter((w) => !q || w.includes(q));
      listEl.innerHTML = list.map((w) => {
        const ov = (delivery.overrides || {})[w] || {};
        return `<div class="wilaya-row" data-wilaya="${w}">
          <span>${w}</span>
          <input type="number" min="0" placeholder="افتراضي" data-field="home" value="${ov.home ?? ""}">
          <input type="number" min="0" placeholder="افتراضي" data-field="desk" value="${ov.desk ?? ""}">
        </div>`;
      }).join("");
    }
    renderWilayas();
    document.getElementById("wilayaSearch").addEventListener("input", (e) => renderWilayas(e.target.value));

    document.getElementById("saveDeliveryBtn").addEventListener("click", async () => {
      const overrides = {};
      listEl.querySelectorAll(".wilaya-row").forEach((row) => {
        const w = row.dataset.wilaya;
        const home = row.querySelector('[data-field="home"]').value;
        const desk = row.querySelector('[data-field="desk"]').value;
        if (home !== "" || desk !== "") {
          overrides[w] = {};
          if (home !== "") overrides[w].home = Number(home);
          if (desk !== "") overrides[w].desk = Number(desk);
        }
      });
      const newDelivery = {
        enabled: document.getElementById("deliveryEnabled").checked,
        defaultHome: Number(document.getElementById("defaultHome").value) || 0,
        defaultDesk: Number(document.getElementById("defaultDesk").value) || 0,
        overrides,
      };
      const msg = document.getElementById("deliveryMsg");
      const btn = document.getElementById("saveDeliveryBtn");
      btn.disabled = true;
      try {
        await DB.saveDelivery(seller.id, newDelivery);
        msg.textContent = "تم حفظ إعدادات التوصيل ✓";
        msg.className = "mt-2";
        msg.style.color = "var(--c-primary)";
        msg.classList.remove("hidden");
      } catch (err) {
        console.error("[delivery.save]", err);
        msg.textContent = "تعذّر الحفظ — راجع قواعد Firestore.";
        msg.className = "auth-error mt-2";
        msg.classList.remove("hidden");
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ============ الجرس والتنبيهات والبحث ============ */
  async function initTopbar(seller) {
    const [lowStock, attempts, orders] = await Promise.all([
      DB.getLowStockProducts(seller.id),
      DB.getBlacklistAttempts(seller.id),
      DB.getOrdersForSeller(seller.id),
    ]);
    const newAttempts = attempts.filter((a) => !a.seen);
    const pendingOrders = orders.filter((o) => o.status === DB.ORDER_STATUSES[0]);
    const totalCount = lowStock.length + newAttempts.length + pendingOrders.length;

    const dot = document.getElementById("bellDot");
    if (totalCount > 0) {
      dot.textContent = totalCount > 9 ? "9+" : totalCount;
      dot.classList.remove("hidden");
    } else {
      dot.classList.add("hidden");
    }
    const badge = document.getElementById("blacklistBadge");
    if (newAttempts.length > 0) {
      badge.textContent = newAttempts.length > 9 ? "9+" : newAttempts.length;
      badge.classList.remove("hidden");
    }

    // بناء محتوى قائمة التنبيهات المنسدلة
    const items = [];
    pendingOrders.slice(0, 5).forEach((o) => {
      const subtotal = o.items.reduce((s, it) => s + it.price * it.qty, 0);
      items.push({
        icon: "🧾",
        text: `طلب جديد من ${Store.escapeHtml(o.customer.name)} — ${money(subtotal)}`,
        action: "orders",
      });
    });
    lowStock.slice(0, 5).forEach((p) => {
      items.push({
        icon: (p.stock ?? 0) === 0 ? "🔴" : "🟠",
        text: (p.stock ?? 0) === 0 ? `نفد مخزون "${Store.escapeHtml(p.name)}"` : `"${Store.escapeHtml(p.name)}" أوشك على النفاد (${p.stock})`,
        action: "products",
      });
    });
    newAttempts.slice(0, 5).forEach((a) => {
      items.push({
        icon: "🚫",
        text: `محاولة طلب من رقم محظور: ${a.phone}`,
        action: "blacklist",
      });
    });

    const bodyEl = document.getElementById("bellPanelBody");
    bodyEl.innerHTML = items.length
      ? items.map((it) => `<button class="bell-item" data-goto="${it.action}"><span>${it.icon}</span><span>${it.text}</span></button>`).join("")
      : `<p class="bell-empty">لا توجد تنبيهات جديدة 👍</p>`;

    bodyEl.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelector(`[data-tab-btn="${btn.dataset.goto}"]`)?.click();
        document.getElementById("bellPanel").classList.add("hidden");
      });
    });

    // فتح/إغلاق القائمة المنسدلة
    const bellBtn = document.getElementById("bellBtn");
    const bellPanel = document.getElementById("bellPanel");
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      bellPanel.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!bellPanel.classList.contains("hidden") && !bellPanel.contains(e.target) && e.target !== bellBtn) {
        bellPanel.classList.add("hidden");
      }
    });

    document.getElementById("dashSearch").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll("#productsBody tr[data-id], #ordersBody tr[data-id]").forEach((row) => {
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }

  function initTabs() {
    const buttons = document.querySelectorAll("[data-tab-btn]");
    const panels = document.querySelectorAll("[data-tab-panel]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("is-active"));
        panels.forEach((p) => p.classList.add("hidden"));
        btn.classList.add("is-active");
        document.querySelector(`[data-tab-panel="${btn.dataset.tabBtn}"]`).classList.remove("hidden");
      });
    });
  }

  // يشغّل فقط الأقسام التي يملك الموظف صلاحيتها
  async function initStaffFeatures(seller) {
    const perms = new Set(seller.__staff?.permissions || []);
    const tasks = [];
    if (perms.has("blacklist_manage")) tasks.push(["blacklist", Features.initBlacklist]);
    if (perms.has("coupons_manage")) tasks.push(["coupons", Features.initCoupons]);
    if (perms.has("analytics_view")) tasks.push(["analytics", Features.initAnalytics]);
    for (const [name, fn] of tasks) {
      try {
        await fn(seller);
      } catch (err) {
        console.error(`[Staff.features.${name}]`, err);
      }
    }
  }

  async function initDashboard() {
    const seller = await initShell();
    if (!seller) return;

    const isStaff = !!seller.__isStaff;
    initTabs();
    initProductsTab(seller);
    initOrdersTab(seller);
    if (!isStaff) initDeliveryTab(seller);
    initTopbar(seller);

    if (isStaff) {
      await initStaffFeatures(seller);
    } else {
      // الميزات المتقدمة: موظفون، قائمة سوداء، كوبونات، بيكسل، إحصائيات
      Features.initAll(seller);
    }

    const [myProducts, myOrders] = await Promise.all([DB.getProductsBySeller(seller.id), DB.getOrdersForSeller(seller.id)]);
    const revenue = myOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.price * it.qty, 0), 0);
    document.getElementById("statProducts").textContent = myProducts.length;
    document.getElementById("statOrders").textContent = myOrders.length;
    document.getElementById("statRevenue").textContent = money(revenue);

    await initCustomersTab(seller);
    await initOverview(seller, myOrders, myProducts);
  }

  return { initDashboard, renderAvatar };
})();
