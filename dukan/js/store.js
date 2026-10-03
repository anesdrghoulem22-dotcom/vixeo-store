/* =========================================================
   DUKAN — منطق واجهة الزبون (المتجر العام، متجر بائع، المنتج، السلة)
   ========================================================= */
import { DB } from "./db.js";
import { Auth } from "./auth.js";

export const Store = (() => {
  function money(n) {
    return new Intl.NumberFormat("ar-DZ").format(n) + " د.ج";
  }
  function categoryOf(id) {
    return DB.CATEGORIES.find((c) => c.id === id) || { label: "أخرى", icon: "🏷️" };
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }
  function cartCount() {
    return DB.getCart().reduce((sum, l) => sum + l.qty, 0);
  }
  function updateCartBadge() {
    const count = cartCount();
    document.querySelectorAll("[data-cart-badge]").forEach((b) => {
      b.textContent = count;
      b.classList.toggle("hidden", count === 0);
    });
  }
  // يحسب المزايا الفعلية المستحقة للبائع حسب خطة اشتراكه النشطة فعلاً (وليست وصفاً تسويقياً فقط)
  function sellerPerks(seller) {
    if (!seller) return { priorityListing: false, verifiedBadge: false };
    const status = Auth.getAccountStatus(seller);
    if (status.state !== "subscribed") return { priorityListing: false, verifiedBadge: false };
    const plan = DB.getPlan(seller.subscription.plan);
    return plan
      ? { priorityListing: !!plan.priorityListing, verifiedBadge: !!plan.verifiedBadge }
      : { priorityListing: false, verifiedBadge: false };
  }
  function verifiedPill() {
    return `<span class="verified-pill" title="متجر موثّق">✓ موثّق</span>`;
  }

  function mediaFor(p) {
    if (p.image) return `<img src="${p.image}" alt="${escapeHtml(p.name)}" class="tile-img">`;
    return `<span class="tile-icon">${categoryOf(p.category).icon}</span>`;
  }
  function typeBadge(p) {
    return p.type === "physical"
      ? `<span class="type-badge type-physical">🚚 منتج ملموس</span>`
      : `<span class="type-badge type-digital">⚡ منتج رقمي</span>`;
  }
  function productTile(p) {
    const cat = categoryOf(p.category);
    const discount = p.oldPrice ? Math.round(100 - (p.price / p.oldPrice) * 100) : null;
    return `
    <a href="product.html?id=${p.id}" class="tile group">
      <div class="tile-media" style="background: var(--tile-${p.category}, var(--c-sand))">
        ${mediaFor(p)}
        ${discount ? `<span class="tile-badge">خصم ${discount}%</span>` : ""}
        ${p.verified ? `<span class="tile-verified" title="متجر موثّق">✓</span>` : ""}
      </div>
      <div class="tile-body">
        <p class="tile-cat">${cat.label}</p>
        <h3 class="tile-name">${escapeHtml(p.name)}</h3>
        <div class="tile-price-row">
          <span class="tile-price">${money(p.price)}</span>
          ${p.oldPrice ? `<span class="tile-old-price">${money(p.oldPrice)}</span>` : ""}
        </div>
      </div>
    </a>`;
  }

  // ---------- عداد تنازلي حقيقي (يُحدَّث كل ثانية) ----------
  function formatCountdown(ms) {
    if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000) % 24;
    const d = Math.floor(ms / 86400000);
    return { d, h, m, s };
  }
  function startCountdown(endTs, renderFn, onExpire) {
    function tick() {
      const left = endTs - Date.now();
      if (left <= 0) { renderFn({ d: 0, h: 0, m: 0, s: 0 }); clearInterval(timer); if (onExpire) onExpire(); return; }
      renderFn(formatCountdown(left));
    }
    tick();
    const timer = setInterval(tick, 1000);
    return timer;
  }

  function waLink(number, message) {
    const clean = (number || DB.PLATFORM_WHATSAPP).replace(/[^0-9]/g, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  function loading(el, text = "جارٍ التحميل…") {
    el.innerHTML = `<p class="col-span-full text-center py-16 text-gray-400">${text}</p>`;
  }

  // ---------- حقن أكواد التتبع (البيكسل) الخاصة بالبائع ----------
  function injectPixels(pixels) {
    if (!pixels) return;
    const head = document.head;

    if (pixels.facebook) {
      const s = document.createElement("script");
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixels.facebook}');fbq('track','PageView');`;
      head.appendChild(s);
    }

    if (pixels.tiktok) {
      const s = document.createElement("script");
      s.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";
o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];
a.parentNode.insertBefore(o,a)};ttq.load('${pixels.tiktok}');ttq.page();}(window,document,'ttq');`;
      head.appendChild(s);
    }

    if (pixels.snapchat) {
      const s = document.createElement("script");
      s.innerHTML = `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){
a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];
var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];
u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js');
snaptr('init','${pixels.snapchat}');snaptr('track','PAGE_VIEW');`;
      head.appendChild(s);
    }

    if (pixels.googleAnalytics) {
      const lib = document.createElement("script");
      lib.async = true;
      lib.src = `https://www.googletagmanager.com/gtag/js?id=${pixels.googleAnalytics}`;
      head.appendChild(lib);
      const s = document.createElement("script");
      s.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${pixels.googleAnalytics}');`;
      head.appendChild(s);
    }

    if (pixels.googleTagManager) {
      const s = document.createElement("script");
      s.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${pixels.googleTagManager}');`;
      head.appendChild(s);
    }
  }

  // يطلق حدث تتبع موحّد عبر كل المنصات المتاحة
  function trackEvent(name, params = {}) {
    try {
      if (window.fbq) window.fbq("track", name, params);
      if (window.ttq) window.ttq.track(name, params);
      if (window.snaptr) window.snaptr("track", name.toUpperCase(), params);
      if (window.gtag) window.gtag("event", name, params);
    } catch (e) {
      console.warn("[trackEvent]", e.message);
    }
  }

  // ---------- المتجر العام (كل البائعين، بيانات حقيقية من Firebase) ----------
  async function initMarket() {
    updateCartBadge();
    const grid = document.getElementById("productGrid");
    const searchInput = document.getElementById("searchInput");
    const catBar = document.getElementById("categoryBar");
    const emptyState = document.getElementById("emptyState");
    const urlCat = new URLSearchParams(location.search).get("cat");
    let activeCategory = DB.CATEGORIES.some((c) => c.id === urlCat) ? urlCat : "all";

    catBar.innerHTML =
      `<button class="chip${activeCategory === "all" ? " is-active" : ""}" data-cat="all">الكل</button>` +
      DB.CATEGORIES.map((c) => `<button class="chip${activeCategory === c.id ? " is-active" : ""}" data-cat="${c.id}">${c.icon} ${c.label}</button>`).join("");

    loading(grid);
    let all = [];
    try {
      all = await DB.getProducts();
      // نجلب البائعين مرة واحدة لتحديد من يملك مزايا "ظهور مبكر" و"علامة موثّق" فعلاً حسب اشتراكه النشط
      const sellers = await DB.getAllSellers();
      const sellerMap = new Map(sellers.map((s) => [s.id, s]));
      all = all.map((p) => {
        const perks = sellerPerks(sellerMap.get(p.sellerId));
        return { ...p, priority: perks.priorityListing, verified: perks.verifiedBadge };
      });
      // ترتيب: أصحاب "الظهور المبكر" أولاً، ثم الأحدث فالأحدث داخل كل مجموعة
      all.sort((a, b) => (b.priority - a.priority) || (b.createdAt - a.createdAt));
    } catch (err) {
      grid.innerHTML = `<p class="col-span-full text-center py-16 text-red-500">تعذّر تحميل المنتجات. تأكد من إعداد Firebase بشكل صحيح (راجع README).</p>`;
      console.error(err);
      return;
    }

    function render() {
      const q = (searchInput.value || "").trim().toLowerCase();
      const products = all.filter((p) => {
        const matchCat = activeCategory === "all" || p.category === activeCategory;
        const matchQ = !q || p.name.toLowerCase().includes(q) || categoryOf(p.category).label.includes(q);
        return matchCat && matchQ;
      });
      grid.innerHTML = products.map(productTile).join("");
      emptyState.classList.toggle("hidden", products.length > 0);
      emptyState.textContent = all.length === 0
        ? "لا توجد منتجات في المنصة بعد. البائعون يضيفون منتجاتهم قريباً — عاود الزيارة لاحقاً."
        : "لا توجد منتجات مطابقة لبحثك.";
    }

    catBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      activeCategory = btn.dataset.cat;
      catBar.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      render();
    });
    searchInput.addEventListener("input", render);
    render();
  }

  // ---------- متجر بائع واحد (Landing Page خاصة، تعمل لأي زائر) ----------
  async function initSellerStore() {
    updateCartBadge();
    const params = new URLSearchParams(location.search);
    const sellerId = params.get("seller");
    const wrap = document.getElementById("storeWrap");
    if (!sellerId) {
      wrap.innerHTML = `<p class="text-center py-24 text-lg">رابط المتجر غير صالح. <a class="underline" href="market.html">تصفح كل المنتجات</a></p>`;
      return;
    }

    let seller;
    try {
      seller = await DB.getSellerById(sellerId);
    } catch (err) {
      wrap.innerHTML = `<p class="text-center py-24 text-lg text-red-500">تعذّر تحميل المتجر. تأكد من إعداد Firebase بشكل صحيح (راجع README).</p>`;
      console.error(err);
      return;
    }

    if (!seller) {
      wrap.innerHTML = `<p class="text-center py-24 text-lg">المتجر غير موجود. <a class="underline" href="market.html">تصفح كل المنتجات</a></p>`;
      return;
    }

    document.title = seller.name + " — دكان";
    // تفعيل بيكسلات البائع وتسجيل الزيارة
    injectPixels(seller.pixels);
    DB.trackVisit(seller.id);
    trackEvent("ViewContent", { content_name: seller.name });
    const avatarEl = document.getElementById("sellerAvatar");
    if (seller.avatar) avatarEl.innerHTML = `<img src="${seller.avatar}" class="avatar-img">`;
    else avatarEl.textContent = seller.name.trim().charAt(0) || "د";
    document.getElementById("sellerStoreName").innerHTML =
      escapeHtml(seller.name) + (sellerPerks(seller).verifiedBadge ? " " + verifiedPill() : "");

    // بانر، نبذة، وشبكات التواصل (إن وُجدت)
    const sp = seller.storeProfile || {};
    if (sp.banner) {
      document.getElementById("storeBanner").style.backgroundImage = `url('${sp.banner}')`;
    }
    if (sp.bio) {
      const bioEl = document.getElementById("sellerBio");
      bioEl.textContent = sp.bio;
      bioEl.classList.remove("hidden");
    }
    const socialsEl = document.getElementById("sellerSocials");
    const socialLinks = [
      sp.instagram ? { icon: "📷", url: `https://instagram.com/${sp.instagram.replace(/^@/, "")}` } : null,
      sp.facebook ? { icon: "📘", url: `https://facebook.com/${sp.facebook}` } : null,
      sp.tiktok ? { icon: "🎵", url: `https://tiktok.com/@${sp.tiktok.replace(/^@/, "")}` } : null,
      seller.whatsapp ? { icon: "💬", url: waLink(seller.whatsapp, `مرحباً، عندي سؤال بخصوص متجر ${seller.name}`) } : null,
    ].filter(Boolean);
    socialsEl.innerHTML = socialLinks.map((s) => `<a href="${s.url}" target="_blank" class="social-btn">${s.icon}</a>`).join("");

    const grid = document.getElementById("sellerProductGrid");
    const searchInput = document.getElementById("storeSearchInput");
    const catBar = document.getElementById("storeCategoryBar");
    const emptyState = document.getElementById("sellerEmptyState");
    loading(grid);
    const rawProducts = await DB.getProductsBySeller(seller.id);
    const isVerified = sellerPerks(seller).verifiedBadge;
    const products = rawProducts.map((p) => ({ ...p, verified: isVerified }));

    const usedCats = [...new Set(products.map((p) => p.category))];
    let activeCategory = "all";
    if (usedCats.length > 1) {
      catBar.innerHTML =
        `<button class="chip is-active" data-cat="all">الكل</button>` +
        usedCats.map((c) => { const cat = categoryOf(c); return `<button class="chip" data-cat="${c}">${cat.icon} ${cat.label}</button>`; }).join("");
    }

    function renderGrid() {
      const q = (searchInput.value || "").trim().toLowerCase();
      const filtered = products.filter((p) => {
        const matchCat = activeCategory === "all" || p.category === activeCategory;
        const matchQ = !q || p.name.toLowerCase().includes(q);
        return matchCat && matchQ;
      });
      grid.innerHTML = filtered.map(productTile).join("");
      emptyState.classList.toggle("hidden", filtered.length > 0);
      emptyState.textContent = products.length === 0
        ? "لم يضف هذا البائع أي منتج بعد."
        : "لا توجد منتجات مطابقة لبحثك.";
    }
    searchInput.addEventListener("input", renderGrid);
    catBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      activeCategory = btn.dataset.cat;
      catBar.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderGrid();
    });
    renderGrid();

    const copyBtn = document.getElementById("copyStoreLinkBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const url = `${location.origin}${location.pathname.replace("store.html", "")}store.html?seller=${seller.id}`;
        navigator.clipboard.writeText(url).then(() => {
          const original = copyBtn.textContent;
          copyBtn.textContent = "تم نسخ الرابط ✓";
          setTimeout(() => (copyBtn.textContent = original), 1800);
        });
      });
    }
  }

  // ---------- صفحة تفاصيل المنتج ----------
  async function initProduct() {
    updateCartBadge();
    const params = new URLSearchParams(location.search);
    const wrap = document.getElementById("productWrap");
    loading(wrap, "جارٍ تحميل المنتج…");

    let product;
    try {
      product = await DB.getProductById(params.get("id"));
    } catch (err) {
      wrap.innerHTML = `<p class="text-center py-20 text-lg text-red-500">تعذّر تحميل المنتج. تأكد من إعداد Firebase (راجع README).</p>`;
      console.error(err);
      return;
    }
    if (!product) {
      wrap.innerHTML = `<p class="text-center py-20 text-lg">المنتج غير موجود. <a class="underline" href="market.html">عودة للمتجر</a></p>`;
      return;
    }

    const cat = categoryOf(product.category);
    const discount = product.oldPrice ? Math.round(100 - (product.price / product.oldPrice) * 100) : null;
    document.title = product.name + " — دكان";
    let sellerVerified = false;
    try {
      sellerVerified = sellerPerks(await DB.getSellerById(product.sellerId)).verifiedBadge;
    } catch (err) {
      console.warn("[initProduct seller lookup]", err.message);
    }
    wrap.innerHTML = `
      <div class="pd-media" style="background: var(--tile-${product.category}, var(--c-sand))">
        ${product.image ? `<img src="${product.image}" alt="${escapeHtml(product.name)}" class="pd-img">` : `<span class="pd-icon">${cat.icon}</span>`}
        ${discount ? `<span class="tile-badge">خصم ${discount}%</span>` : ""}
      </div>
      <div class="pd-info">
        <p class="tile-cat">${cat.label} · <a href="store.html?seller=${product.sellerId}" class="underline">${escapeHtml(product.sellerName)}</a>${sellerVerified ? " " + verifiedPill() : ""}</p>
        <h1 class="pd-title">${escapeHtml(product.name)}</h1>
        ${typeBadge(product)}
        <div class="tile-price-row mb-4 mt-3">
          <span class="pd-price">${money(product.price)}</span>
          ${product.oldPrice ? `<span class="tile-old-price">${money(product.oldPrice)}</span>` : ""}
        </div>
        <p class="pd-desc">${escapeHtml(product.description || "لا يوجد وصف لهذا المنتج.")}</p>
        <p class="pd-stock">${product.stock > 0 ? `متوفر (${product.stock} نسخة)` : "غير متوفر حالياً"}</p>
        <div class="flex items-center gap-3 mt-6">
          <div class="qty-stepper">
            <button type="button" id="qtyMinus">−</button>
            <span id="qtyValue">1</span>
            <button type="button" id="qtyPlus">+</button>
          </div>
          <button id="addToCartBtn" class="btn-primary" ${product.stock <= 0 ? "disabled" : ""}>أضف إلى السلة</button>
        </div>
        <p id="addedMsg" class="text-sm mt-3 hidden" style="color: var(--c-primary)">تمت الإضافة إلى السلة ✓</p>
      </div>
    `;

    let qty = 1;
    const qtyValue = document.getElementById("qtyValue");
    document.getElementById("qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); qtyValue.textContent = qty; });
    document.getElementById("qtyPlus").addEventListener("click", () => { qty = Math.min(product.stock || 99, qty + 1); qtyValue.textContent = qty; });
    document.getElementById("addToCartBtn").addEventListener("click", () => {
      DB.addToCart(product.id, qty);
      updateCartBadge();
      const msg = document.getElementById("addedMsg");
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 2000);
    });
  }

  // ---------- صفحة السلة والدفع ----------
  async function initCart() {
    updateCartBadge();
    const listEl = document.getElementById("cartList");
    const summaryEl = document.getElementById("cartSummary");
    const emptyEl = document.getElementById("cartEmpty");
    const checkoutForm = document.getElementById("checkoutForm");
    const checkoutSection = document.getElementById("checkoutSection");
    const physicalFields = document.getElementById("physicalFields");
    const digitalNote = document.getElementById("digitalNote");

    listEl.innerHTML = `<p class="text-center py-16 text-gray-400">جارٍ تحميل سلتك…</p>`;

    async function lines() {
      const cart = DB.getCart();
      const results = await Promise.all(cart.map(async (l) => ({ ...l, product: await DB.getProductById(l.productId) })));
      return results.filter((l) => l.product);
    }

    let cachedLines = [];
    let appliedCoupon = null; // { coupon, discount }
    let deliveryInfo = null; // { sellerId, delivery }
    let deliveryInfoFor = null; // sellerId الذي حُسب من أجله deliveryInfo (تفادي إعادة الجلب)

    const wilayaSelect = document.getElementById("wilayaSelect");
    const deliveryModeField = document.getElementById("deliveryModeField");
    const deliveryModeSelect = document.getElementById("deliveryModeSelect");
    if (wilayaSelect && wilayaSelect.options.length <= 1) {
      DB.WILAYAS.forEach((w, i) => {
        const opt = document.createElement("option");
        opt.value = w;
        opt.textContent = `${i + 1} — ${w}`;
        wilayaSelect.appendChild(opt);
      });
    }
    wilayaSelect?.addEventListener("change", render);
    deliveryModeSelect?.addEventListener("change", render);

    async function resolveDelivery(ls) {
      const physicalSellerIds = [...new Set(ls.filter((l) => l.product.type === "physical").map((l) => l.product.sellerId))];
      if (physicalSellerIds.length !== 1) return null;
      const sellerId = physicalSellerIds[0];
      if (deliveryInfoFor === sellerId) return deliveryInfo;
      const seller = await DB.getSellerById(sellerId);
      deliveryInfoFor = sellerId;
      deliveryInfo = seller ? { sellerId, delivery: seller.delivery } : null;
      return deliveryInfo;
    }

    async function render() {
      cachedLines = await lines();
      const ls = cachedLines;
      if (ls.length === 0) {
        listEl.innerHTML = "";
        emptyEl.classList.remove("hidden");
        checkoutSection.classList.add("hidden");
        summaryEl.innerHTML = "";
        return;
      }
      emptyEl.classList.add("hidden");
      checkoutSection.classList.remove("hidden");

      const hasPhysical = ls.some((l) => l.product.type === "physical");
      physicalFields.classList.toggle("hidden", !hasPhysical);
      physicalFields.querySelectorAll("input, textarea, select").forEach((i) => {
        if (i.id !== "deliveryModeSelect") i.required = hasPhysical;
      });
      digitalNote.classList.toggle("hidden", hasPhysical);

      let deliveryCost = 0;
      if (hasPhysical) {
        const info = await resolveDelivery(ls);
        const enabled = info?.delivery?.enabled;
        deliveryModeField.classList.toggle("hidden", !enabled);
        if (enabled && wilayaSelect.value) {
          deliveryCost = DB.getDeliveryPrice(info.delivery, wilayaSelect.value, deliveryModeSelect.value);
        }
      }

      listEl.innerHTML = ls.map((l) => `
        <div class="cart-row" data-id="${l.product.id}">
          <div class="cart-row-media" style="background: var(--tile-${l.product.category}, var(--c-sand))">
            ${l.product.image ? `<img src="${l.product.image}" class="cart-row-img">` : `<span>${categoryOf(l.product.category).icon}</span>`}
          </div>
          <div class="cart-row-info">
            <h3>${escapeHtml(l.product.name)}</h3>
            <p class="tile-cat">${money(l.product.price)} / الوحدة · ${l.product.type === "physical" ? "ملموس 🚚" : "رقمي ⚡"}</p>
          </div>
          <div class="qty-stepper" data-qty>
            <button type="button" data-minus>−</button>
            <span>${l.qty}</span>
            <button type="button" data-plus>+</button>
          </div>
          <p class="cart-row-total">${money(l.product.price * l.qty)}</p>
          <button class="cart-row-remove" data-remove title="حذف">✕</button>
        </div>`).join("");

      const subtotal = ls.reduce((s, l) => s + l.product.price * l.qty, 0);
      const discount = appliedCoupon ? appliedCoupon.discount : 0;
      const total = Math.max(0, subtotal - discount) + deliveryCost;

      summaryEl.innerHTML = `
        <div class="coupon-box">
          ${appliedCoupon ? `
            <div class="coupon-applied">
              <span>🎟️ الكوبون <strong>${escapeHtml(appliedCoupon.coupon.code)}</strong> مطبّق</span>
              <button type="button" id="removeCouponBtn" class="coupon-remove">إزالة</button>
            </div>` : `
            <div class="coupon-input-row">
              <input type="text" id="couponInput" placeholder="لديك كود خصم؟ اكتبه هنا"
                     style="text-transform:uppercase">
              <button type="button" id="applyCouponBtn" class="btn-outline">تطبيق</button>
            </div>
            <p id="couponMsg" class="coupon-msg hidden"></p>`}
        </div>
        <div class="flex justify-between py-1"><span>عدد المنتجات</span><span>${ls.reduce((s, l) => s + l.qty, 0)}</span></div>
        <div class="flex justify-between py-1"><span>المجموع الفرعي</span><span>${money(subtotal)}</span></div>
        ${discount ? `<div class="flex justify-between py-1" style="color: var(--c-primary)"><span>الخصم</span><span>− ${money(discount)}</span></div>` : ""}
        ${deliveryCost ? `<div class="flex justify-between py-1"><span>التوصيل</span><span>${money(deliveryCost)}</span></div>` : ""}
        <div class="flex justify-between py-1 font-bold text-lg"><span>الإجمالي</span><span>${money(total)}</span></div>
      `;

      // تطبيق الكوبون
      const applyBtn = document.getElementById("applyCouponBtn");
      if (applyBtn) {
        applyBtn.addEventListener("click", async () => {
          const code = (document.getElementById("couponInput").value || "").trim();
          const msg = document.getElementById("couponMsg");
          if (!code) return;
          // الكوبون خاص بالبائع — يُطبَّق فقط إن كانت كل المنتجات من نفس المتجر
          const sellerIds = [...new Set(ls.map((l) => l.product.sellerId))];
          if (sellerIds.length > 1) {
            msg.textContent = "أكواد الخصم تُطبَّق على منتجات متجر واحد فقط في الطلب.";
            msg.className = "coupon-msg is-error";
            return;
          }
          applyBtn.disabled = true;
          applyBtn.textContent = "جارٍ التحقق…";
          try {
            const res = await DB.validateCoupon(sellerIds[0], code, subtotal);
            if (!res.valid) {
              msg.textContent = res.reason;
              msg.className = "coupon-msg is-error";
              return;
            }
            appliedCoupon = { coupon: res.coupon, discount: res.discount };
            await render();
          } catch (err) {
            console.error("[applyCoupon]", err);
            msg.textContent = "تعذّر التحقق من الكوبون — حاول مرة أخرى بعد قليل.";
            msg.className = "coupon-msg is-error";
          } finally {
            applyBtn.disabled = false;
            applyBtn.textContent = "تطبيق";
          }
        });
      }
      const removeBtn = document.getElementById("removeCouponBtn");
      if (removeBtn) {
        removeBtn.addEventListener("click", async () => {
          appliedCoupon = null;
          await render();
        });
      }
    }

    listEl.addEventListener("click", async (e) => {
      const row = e.target.closest(".cart-row");
      if (!row) return;
      const id = row.dataset.id;
      const current = DB.getCart().find((c) => c.productId === id);
      if (!current) return;
      if (e.target.closest("[data-plus]")) DB.updateCartQty(id, current.qty + 1);
      if (e.target.closest("[data-minus]")) DB.updateCartQty(id, current.qty - 1);
      if (e.target.closest("[data-remove]")) DB.updateCartQty(id, 0);
      updateCartBadge();
      await render();
    });

    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ls = cachedLines;
      if (ls.length === 0) return;
      const submitBtn = checkoutForm.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.textContent = "جارٍ إرسال الطلب…";

      const fd = new FormData(checkoutForm);
      const hasPhysical = ls.some((l) => l.product.type === "physical");
      const subtotal = ls.reduce((s, l) => s + l.product.price * l.qty, 0);
      const discount = appliedCoupon ? appliedCoupon.discount : 0;
      let deliveryCost = 0;
      let deliveryMode = "";
      if (hasPhysical) {
        const info = await resolveDelivery(ls);
        if (info?.delivery?.enabled && fd.get("wilaya")) {
          deliveryMode = fd.get("deliveryMode") || "home";
          deliveryCost = DB.getDeliveryPrice(info.delivery, fd.get("wilaya"), deliveryMode);
        }
      }
      const total = Math.max(0, subtotal - discount) + deliveryCost;

      const customer = {
        name: fd.get("name"),
        phone: fd.get("phone"),
        wilaya: hasPhysical ? fd.get("wilaya") : "",
        address: hasPhysical ? fd.get("address") : "",
      };

      // فحص القائمة السوداء قبل تسجيل الطلب
      const orderSellerIds = [...new Set(ls.map((l) => l.product.sellerId))];
      try {
        for (const sid of orderSellerIds) {
          if (await DB.isPhoneBlacklisted(sid, customer.phone)) {
            // تنبيه التاجر بمحاولة الطلب من رقم محظور
            await DB.logBlacklistAttempt(sid, {
              phone: customer.phone,
              name: customer.name,
              total,
            });
            alert("عذراً، لا يمكن إتمام هذا الطلب. يرجى التواصل مع المتجر مباشرة.");
            submitBtn.disabled = false;
            submitBtn.textContent = "تأكيد الطلب عبر واتساب";
            return;
          }
        }
      } catch (err) {
        console.warn("[blacklist check skipped]", err.message);
      }

      // فحص الحد الأقصى للطلبات الشهرية حسب خطة كل بائع (البريميوم/برو بلا حد)
      try {
        for (const sid of orderSellerIds) {
          const cap = await DB.checkOrderCap(sid);
          if (cap.capped) {
            alert(`عذراً، هذا المتجر وصل للحد الأقصى من الطلبات المسموح بها لهذا الشهر (${cap.max} طلب). يمكنك التواصل معه مباشرة عبر واتساب.`);
            submitBtn.disabled = false;
            submitBtn.textContent = "تأكيد الطلب عبر واتساب";
            return;
          }
        }
      } catch (err) {
        console.warn("[order cap check skipped]", err.message);
      }

      const order = {
        items: ls.map((l) => ({
          productId: l.product.id, sellerId: l.product.sellerId, sellerName: l.product.sellerName,
          name: l.product.name, price: l.product.price, qty: l.qty, type: l.product.type,
        })),
        subtotal,
        discount,
        deliveryCost,
        deliveryMode,
        coupon: appliedCoupon ? appliedCoupon.coupon.code : null,
        total, customer, status: DB.ORDER_STATUSES[0],
      };

      let orderId;
      try {
        orderId = await DB.addOrder(order);
      } catch (err) {
        console.error(err);
        alert("تعذّر إرسال الطلب. تأكد من إعداد Firebase بشكل صحيح (راجع README) ثم أعد المحاولة.");
        submitBtn.disabled = false;
        submitBtn.textContent = "تأكيد الطلب عبر واتساب";
        return;
      }

      // خصم الكميات من المخزون
      await DB.decrementStock(order.items);

      // تسجيل استعمال الكوبون وإطلاق حدث الشراء للبيكسل
      if (appliedCoupon) {
        try {
          await DB.incrementCouponUse(appliedCoupon.coupon.id);
        } catch (err) {
          console.warn("[coupon increment skipped]", err.message);
        }
      }
      trackEvent("Purchase", { value: total, currency: "DZD", num_items: order.items.length });

      const sellerIds = [...new Set(order.items.map((it) => it.sellerId))];
      let targetNumber = DB.PLATFORM_WHATSAPP;
      if (sellerIds.length === 1) {
        const seller = await DB.getSellerById(sellerIds[0]);
        if (seller && seller.whatsapp) targetNumber = seller.whatsapp;
      }

      const itemsText = order.items.map((it) => `• ${it.name} × ${it.qty} = ${money(it.price * it.qty)}`).join("\n");
      let message = `مرحباً، أود تأكيد طلب جديد من متجر دكان:\n\n${itemsText}\n`;
      if (discount) {
        message += `\nالمجموع الفرعي: ${money(subtotal)}\nالخصم (${order.coupon}): − ${money(discount)}`;
      }
      if (deliveryCost) {
        message += `\nالتوصيل (${deliveryMode === "desk" ? "مكتب الشحن" : "المنزل"}): ${money(deliveryCost)}`;
      }
      message += `\nالمجموع: ${money(total)}\n\nالاسم: ${customer.name}\nالهاتف: ${customer.phone}`;
      if (hasPhysical) message += `\nالولاية: ${customer.wilaya}\nالعنوان: ${customer.address}`;
      message += `\n\nرقم الطلب: ${orderId}`;

      const link = waLink(targetNumber, message);
      DB.clearCart();
      updateCartBadge();

      document.getElementById("cartPage").innerHTML = `
        <div class="success-box">
          <div class="text-5xl mb-4">✓</div>
          <h2 class="text-2xl font-bold mb-2">تم تسجيل طلبك بنجاح</h2>
          <p class="text-gray-600 mb-1">رقم الطلب: <span class="font-mono">${orderId}</span></p>
          <p class="text-gray-600 mb-6">أكمل تأكيد الطلب عبر واتساب ليتواصل معك البائع.</p>
          <a href="${link}" target="_blank" class="btn-accent">تأكيد الطلب عبر واتساب</a>
          <div class="mt-4"><a href="market.html" class="nav-link text-sm">مواصلة التسوق</a></div>
        </div>`;
      window.open(link, "_blank");
    });

    await render();
  }

  return {
    money, categoryOf, escapeHtml, productTile, typeBadge,
    updateCartBadge, formatCountdown, startCountdown, waLink,
    initMarket, initSellerStore, initProduct, initCart,
  };
})();
