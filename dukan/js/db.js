/* =========================================================
   DUKAN — طبقة البيانات (Firebase Firestore، Modular SDK v10)
   بيانات حقيقية مشتركة بين كل المستخدمين على أي جهاز أو متصفح
   ========================================================= */
import { db, auth } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  addDoc, query, where, orderBy, limit, increment,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const DB = (() => {
  const TRIAL_DAYS = 7;
  // خطط الاشتراك — شهرية فقط، 3 مستويات بمزايا متدرّجة
  // maxOrders: الحد الأقصى للطلبات المستلمة كل 30 يوماً (null = غير محدود)
  // maxStaff: الحد الأقصى لعدد الموظفين (null = غير محدود)
  const PLANS = [
    {
      id: "basic",
      name: "أساسي",
      price: 1000,
      tagline: "للبداية القوية",
      featured: false,
      priorityListing: false,
      verifiedBadge: false,
      maxOrders: 30,
      maxStaff: 1,
      features: [
        "منتجات غير محدودة",
        "حتى 30 طلباً شهرياً",
        "إدارة كاملة للطلبات",
        "صفحة متجر خاصة بك",
        "كوبونات خصم غير محدودة",
        "موظف واحد إضافي",
        "دعم عبر واتساب",
      ],
    },
    {
      id: "plus",
      name: "بلس",
      price: 1500,
      tagline: "الأكثر اختياراً",
      featured: true,
      priorityListing: true,
      verifiedBadge: false,
      maxOrders: 100,
      maxStaff: 3,
      features: [
        "كل مزايا الخطة الأساسية",
        "حتى 100 طلب شهرياً",
        "ظهور مبكر في نتائج البحث والمتجر العام",
        "فريق عمل حتى 3 موظفين",
        "دعم أولوية عبر واتساب",
      ],
    },
    {
      id: "pro",
      name: "برو",
      price: 2000,
      tagline: "للمتاجر الاحترافية",
      featured: false,
      priorityListing: true,
      verifiedBadge: true,
      maxOrders: null,
      maxStaff: null,
      features: [
        "كل مزايا خطة بلس",
        "طلبات ومبيعات غير محدودة",
        'علامة "متجر موثّق ✓" على منتجاتك ومتجرك',
        "الظهور الأول دائماً في نتائج البحث",
        "فريق عمل غير محدود",
        "دعم VIP مباشر",
      ],
    },
  ];
  function getPlan(planId) {
    return PLANS.find((p) => p.id === planId) || null;
  }
  const PLATFORM_WHATSAPP = "213558593252"; // بدون + وبدون أصفار، بصيغة wa.me
  // حالات الطلب الموحّدة عبر المنصة كلها
  const ORDER_STATUSES = ["قيد الانتظار", "قيد التوصيل", "تم التسليم", "ملغى"];
  const LOW_STOCK_THRESHOLD = 5; // تنبيه عند وصول المخزون لهذا الحد أو أقل

  // الولايات الـ 58 لحساب أسعار التوصيل حسب الولاية
  const WILAYAS = [
    "أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة",
    "تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة",
    "سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة",
    "وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة",
    "سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غرداية","غليزان","تيميمون",
    "برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة",
  ];

  // بريد (أو بُرد) المشرف الذي يحق له فتح صفحة admin.html وتفعيل الاشتراكات.
  // ضع هنا بريدك أنت. يجب أن يكون لك حساب مسجّل بنفس هذا البريد في الموقع.
  const ADMIN_EMAILS = ["ivoraivora138@gmail.com"];
  // تصنيفات عامة — هذا سوق مفتوح لأي منتج، وليس مخصصاً للاشتراكات الرقمية فقط
  const CATEGORIES = [
    { id: "fashion", label: "أزياء وموضة", icon: "👗" },
    { id: "electronics", label: "إلكترونيات وتقنية", icon: "📱" },
    { id: "home", label: "المنزل والمطبخ", icon: "🏠" },
    { id: "beauty", label: "الجمال والعناية", icon: "💄" },
    { id: "sports", label: "رياضة ولياقة", icon: "⚽" },
    { id: "kids", label: "أطفال ومستلزمات رضّع", icon: "🍼" },
    { id: "accessories", label: "إكسسوارات ومجوهرات", icon: "💍" },
    { id: "books", label: "كتب وقرطاسية", icon: "📚" },
    { id: "digital", label: "اشتراكات وخدمات رقمية", icon: "💻" },
    { id: "other", label: "منتجات أخرى", icon: "📦" },
  ];

  function uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---------- بصمة الجهاز (لقفل التجربة المجانية محلياً فقط، مستقل عن Firebase) ----------
  function getDeviceId() {
    let id = localStorage.getItem("dukan_device_id");
    if (!id) {
      const raw = [navigator.userAgent, navigator.language, screen.width + "x" + screen.height, new Date().getTimezoneOffset()].join("|");
      let hash = 0;
      for (let i = 0; i < raw.length; i++) { hash = (hash << 5) - hash + raw.charCodeAt(i); hash |= 0; }
      id = "dev_" + Math.abs(hash).toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem("dukan_device_id", id);
    }
    return id;
  }
  function hasDeviceUsedTrial(deviceId) {
    const list = JSON.parse(localStorage.getItem("dukan_trial_used_devices") || "[]");
    return list.includes(deviceId);
  }
  function markDeviceTrialUsed(deviceId) {
    const list = JSON.parse(localStorage.getItem("dukan_trial_used_devices") || "[]");
    if (!list.includes(deviceId)) {
      list.push(deviceId);
      localStorage.setItem("dukan_trial_used_devices", JSON.stringify(list));
    }
  }

  function snapToObj(snap) {
    return { id: snap.id, ...snap.data() };
  }

  // ---------- Sellers (collection: sellers, doc id = Firebase Auth uid) ----------
  async function getSellerById(id) {
    if (!id) return null;
    const snap = await getDoc(doc(db, "sellers", id));
    return snap.exists() ? snapToObj(snap) : null;
  }
  async function getSellerByEmail(email) {
    const q = query(collection(db, "sellers"), where("email", "==", email.toLowerCase()), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snapToObj(snap.docs[0]);
  }
  async function createSellerProfile(uid, data) {
    await setDoc(doc(db, "sellers", uid), data);
    return { id: uid, ...data };
  }
  async function updateSellerProfile(uid, data) {
    await updateDoc(doc(db, "sellers", uid), data);
  }
  async function getCurrentSeller() {
    const user = auth.currentUser;
    if (!user) return null;
    return getSellerById(user.uid);
  }

  // ---------- Admin (إدارة الاشتراكات) ----------
  function isAdminEmail(email) {
    if (!email) return false;
    return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
  }
  async function getAllSellers() {
    const snap = await getDocs(collection(db, "sellers"));
    return snap.docs.map(snapToObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  // يفعّل الاشتراك بالأرقام الصحيحة تلقائياً (number بالمللي ثانية) — بلا حساب يدوي
  // كل الخطط شهرية (30 يوماً) — الفرق بينها في المزايا لا في المدة
  async function activateSubscription(sellerId, plan) {
    const now = Date.now();
    const subscription = {
      active: true,
      plan,
      start: now,
      end: now + 30 * 86400000,
    };
    await updateDoc(doc(db, "sellers", sellerId), { subscription });
    return subscription;
  }
  // يمدد اشتراكاً قائماً بدل أن يبدأ من الآن (إن كان لا يزال فعّالاً)
  async function extendSubscription(sellerId, plan) {
    const seller = await getSellerById(sellerId);
    const now = Date.now();
    const base = seller?.subscription?.active && seller.subscription.end > now ? seller.subscription.end : now;
    const subscription = {
      active: true,
      plan,
      start: seller?.subscription?.start || now,
      end: base + 30 * 86400000,
    };
    await updateDoc(doc(db, "sellers", sellerId), { subscription });
    return subscription;
  }
  async function cancelSubscription(sellerId) {
    const subscription = { active: false, plan: null, start: null, end: null };
    await updateDoc(doc(db, "sellers", sellerId), { subscription });
    return subscription;
  }

  // ---------- Staff (موظفو المتجر) ----------
  // الصلاحيات المتاحة لموظفي المتجر
  const STAFF_PERMISSIONS = [
    { id: "orders_view", label: "عرض الطلبات" },
    { id: "orders_update", label: "تأكيد وتعديل حالة الطلبات" },
    { id: "products_view", label: "عرض المنتجات" },
    { id: "products_manage", label: "إضافة وتعديل وحذف المنتجات" },
    { id: "coupons_manage", label: "إدارة كوبونات الخصم" },
    { id: "blacklist_manage", label: "إدارة القائمة السوداء" },
    { id: "analytics_view", label: "عرض الإحصائيات" },
  ];
  async function getStaff(sellerId) {
    const q = query(collection(db, "staff"), where("sellerId", "==", sellerId));
    const snap = await getDocs(q);
    return snap.docs.map(snapToObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  async function addStaff(data) {
    const ref = await addDoc(collection(db, "staff"), { ...data, createdAt: Date.now() });
    return ref.id;
  }
  async function updateStaff(id, data) {
    await updateDoc(doc(db, "staff", id), data);
  }
  async function deleteStaff(id) {
    await deleteDoc(doc(db, "staff", id));
  }

  // ---------- Blacklist (القائمة السوداء) ----------
  function normalizePhone(phone) {
    return (phone || "").replace(/[^0-9]/g, "").replace(/^213/, "0");
  }
  async function getBlacklist(sellerId) {
    const q = query(collection(db, "blacklist"), where("sellerId", "==", sellerId));
    const snap = await getDocs(q);
    return snap.docs.map(snapToObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  async function addToBlacklist(data) {
    const ref = await addDoc(collection(db, "blacklist"), {
      ...data,
      phone: normalizePhone(data.phone),
      createdAt: Date.now(),
    });
    return ref.id;
  }
  async function removeFromBlacklist(id) {
    await deleteDoc(doc(db, "blacklist", id));
  }
  // يسجّل محاولة طلب من رقم محظور لتنبيه التاجر في لوحته
  async function logBlacklistAttempt(sellerId, data) {
    try {
      await addDoc(collection(db, "blacklist_attempts"), {
        sellerId,
        phone: normalizePhone(data.phone),
        name: data.name || "",
        total: data.total || 0,
        seen: false,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn("[logBlacklistAttempt]", err.message);
    }
  }
  async function getBlacklistAttempts(sellerId) {
    const q = query(collection(db, "blacklist_attempts"), where("sellerId", "==", sellerId));
    const snap = await getDocs(q);
    return snap.docs.map(snapToObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  async function markAttemptsSeen(sellerId) {
    const attempts = await getBlacklistAttempts(sellerId);
    for (const a of attempts.filter((x) => !x.seen)) {
      try {
        await updateDoc(doc(db, "blacklist_attempts", a.id), { seen: true });
      } catch (err) {
        console.warn("[markAttemptsSeen]", err.message);
      }
    }
  }
  // يُستعمل عند إتمام الطلب لمنع العملاء المحظورين
  async function isPhoneBlacklisted(sellerId, phone) {
    const q = query(
      collection(db, "blacklist"),
      where("sellerId", "==", sellerId),
      where("phone", "==", normalizePhone(phone)),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }

  // ---------- Coupons (كوبونات الخصم) ----------
  async function getCoupons(sellerId) {
    const q = query(collection(db, "coupons"), where("sellerId", "==", sellerId));
    const snap = await getDocs(q);
    return snap.docs.map(snapToObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  async function addCoupon(data) {
    const ref = await addDoc(collection(db, "coupons"), {
      ...data,
      code: (data.code || "").trim().toUpperCase(),
      used: 0,
      createdAt: Date.now(),
    });
    return ref.id;
  }
  async function updateCoupon(id, data) {
    await updateDoc(doc(db, "coupons", id), data);
  }
  async function deleteCoupon(id) {
    await deleteDoc(doc(db, "coupons", id));
  }
  // يتحقق من صلاحية الكوبون ويُرجع قيمة الخصم المحسوبة
  // يبحث بالرمز أولاً (بلا قيد المتجر) ليميّز بين "غير موجود إطلاقاً" و"خاص بمتجر آخر"
  async function validateCoupon(sellerId, code, subtotal) {
    const cleanCode = (code || "").trim().toUpperCase();
    const q = query(collection(db, "coupons"), where("code", "==", cleanCode));
    const snap = await getDocs(q);
    if (snap.empty) return { valid: false, reason: "الكوبون غير موجود." };

    const all = snap.docs.map(snapToObj);
    const c = all.find((x) => x.sellerId === sellerId);
    if (!c) {
      return { valid: false, reason: "هذا الكوبون خاص بمتجر آخر — تأكد أنك تتسوّق من نفس المتجر الذي أصدره." };
    }

    if (!c.active) return { valid: false, reason: "هذا الكوبون غير مفعّل." };
    if (c.expiresAt && c.expiresAt < Date.now()) return { valid: false, reason: "انتهت صلاحية الكوبون." };
    if (c.maxUses && c.used >= c.maxUses) return { valid: false, reason: "تم استهلاك هذا الكوبون بالكامل." };
    if (c.minOrder && subtotal < c.minOrder) {
      return { valid: false, reason: `الحد الأدنى للطلب ${c.minOrder} د.ج.` };
    }
    const discount = c.type === "percent"
      ? Math.round((subtotal * c.value) / 100)
      : Math.min(c.value, subtotal);
    return { valid: true, coupon: c, discount };
  }
  // زيادة ذرّية (atomic) — تمنع فقدان أي عملية استخدام عند طلبين متزامنين على نفس الكوبون
  async function incrementCouponUse(couponId) {
    await updateDoc(doc(db, "coupons", couponId), { used: increment(1) });
  }

  // ---------- التوصيل حسب الولاية (تُحفظ داخل مستند البائع) ----------
  async function saveDelivery(sellerId, delivery) {
    await updateDoc(doc(db, "sellers", sellerId), { delivery });
  }
  // يحسب سعر التوصيل لولاية معيّنة حسب إعدادات البائع (مع احتساب توصيل للمنزل افتراضياً)
  function getDeliveryPrice(delivery, wilaya, mode = "home") {
    if (!delivery || !delivery.enabled) return 0;
    const override = delivery.overrides && delivery.overrides[wilaya];
    if (override && typeof override[mode] === "number") return override[mode];
    return (mode === "desk" ? delivery.defaultDesk : delivery.defaultHome) || 0;
  }

  // ---------- ملف المتجر العام (البانر، الوصف، شبكات التواصل) ----------
  async function saveStoreProfile(sellerId, storeProfile) {
    await updateDoc(doc(db, "sellers", sellerId), { storeProfile });
  }

  // ---------- Pixels & Marketing (تُحفظ داخل مستند البائع) ----------
  async function savePixels(sellerId, pixels) {
    await updateDoc(doc(db, "sellers", sellerId), { pixels });
  }

  // ---------- Analytics (زيارات المتجر) ----------
  // عدّاد زيارات بسيط: مستند واحد لكل بائع لكل يوم
  // تاريخ اليوم بالتوقيت المحلي للمتصفح (وليس UTC) — حتى لا تُحتسب زيارات منتصف الليل ليوم خاطئ
  function localDateStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  async function trackVisit(sellerId) {
    if (!sellerId) return;
    const day = localDateStr();
    const ref = doc(db, "visits", `${sellerId}_${day}`);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { count: (snap.data().count || 0) + 1 });
      } else {
        await setDoc(ref, { sellerId, day, count: 1 });
      }
    } catch (err) {
      // الزيارات ميزة ثانوية — لا توقف الصفحة إن فشلت
      console.warn("[trackVisit] skipped:", err.message);
    }
  }
  // يُرجع دائماً سلسلة كاملة من "days" يوماً متتالياً (بأصفار للأيام بلا زيارات)
  // حتى يظهر الرسم البياني متواصلاً بدل أن يعرض فقط الأيام التي صادف أن فيها زيارات
  async function getVisits(sellerId, days = 30) {
    const q = query(collection(db, "visits"), where("sellerId", "==", sellerId));
    const snap = await getDocs(q);
    const byDay = new Map(snap.docs.map((d) => [d.data().day, d.data().count || 0]));
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDateStr(d);
      result.push({ day: key, count: byDay.get(key) || 0 });
    }
    return result;
  }

  // ---------- العملاء (مُشتقّة من الطلبات — بلا حاجة لمجموعة جديدة) ----------
  async function getCustomers(sellerId) {
    const orders = await getOrdersForSeller(sellerId);
    const map = new Map();
    orders.forEach((o) => {
      const phone = normalizePhone(o.customer?.phone);
      if (!phone) return;
      const subtotal = o.items.reduce((s, it) => s + it.price * it.qty, 0);
      const existing = map.get(phone) || {
        phone, name: o.customer.name, wilaya: o.customer.wilaya || "",
        orders: 0, total: 0, lastOrderAt: 0,
      };
      existing.orders += 1;
      existing.total += subtotal;
      if (o.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = o.createdAt;
        existing.name = o.customer.name || existing.name;
      }
      map.set(phone, existing);
    });
    return [...map.values()].sort((a, b) => b.lastOrderAt - a.lastOrderAt);
  }

  // ---------- تصدير CSV ----------
  function ordersToCSV(orders) {
    const rows = [["رقم الطلب", "التاريخ", "الزبون", "الهاتف", "الولاية", "المنتجات", "المجموع", "الحالة"]];
    orders.forEach((o) => {
      const itemsText = o.items.map((it) => `${it.name} x${it.qty}`).join(" | ");
      rows.push([
        o.id, new Date(o.createdAt).toLocaleDateString("ar-DZ"),
        o.customer?.name || "", o.customer?.phone || "", o.customer?.wilaya || "",
        itemsText, o.total ?? o.items.reduce((s, it) => s + it.price * it.qty, 0), o.status,
      ]);
    });
    return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  // ---------- Products (collection: products) ----------
  async function getProducts() {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(snapToObj);
  }
  async function getProductById(id) {
    const snap = await getDoc(doc(db, "products", id));
    return snap.exists() ? snapToObj(snap) : null;
  }
  async function getProductsBySeller(sellerId) {
    const q = query(collection(db, "products"), where("sellerId", "==", sellerId));
    const snap = await getDocs(q);
    return snap.docs.map(snapToObj).sort((a, b) => b.createdAt - a.createdAt);
  }
  async function addProduct(data) {
    const ref = await addDoc(collection(db, "products"), { ...data, createdAt: Date.now() });
    return ref.id;
  }
  async function updateProduct(id, data) {
    await updateDoc(doc(db, "products", id), data);
  }
  async function deleteProduct(id) {
    await deleteDoc(doc(db, "products", id));
  }
  // منتجات نفد مخزونها أو شارف على النفاد
  async function getLowStockProducts(sellerId) {
    const products = await getProductsBySeller(sellerId);
    return products
      .filter((p) => (p.stock ?? 0) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  }
  // يخصم الكميات المطلوبة من المخزون بعد تسجيل الطلب
  async function decrementStock(items) {
    for (const it of items) {
      try {
        const snap = await getDoc(doc(db, "products", it.productId));
        if (!snap.exists()) continue;
        const current = snap.data().stock ?? 0;
        await updateDoc(doc(db, "products", it.productId), {
          stock: Math.max(0, current - it.qty),
        });
      } catch (err) {
        console.warn("[decrementStock]", it.productId, err.message);
      }
    }
  }

  // ---------- Orders (collection: orders) ----------
  async function addOrder(order) {
    const sellerIds = [...new Set(order.items.map((it) => it.sellerId))];
    const ref = await addDoc(collection(db, "orders"), { ...order, sellerIds, createdAt: Date.now() });
    return ref.id;
  }
  async function getOrdersForSeller(sellerId) {
    const q = query(collection(db, "orders"), where("sellerIds", "array-contains", sellerId));
    const snap = await getDocs(q);
    return snap.docs
      .map(snapToObj)
      .map((o) => ({ ...o, items: o.items.filter((it) => it.sellerId === sellerId) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async function updateOrderStatus(orderId, status) {
    await updateDoc(doc(db, "orders", orderId), { status });
  }
  // يتحقق هل تجاوز البائع الحد الأقصى للطلبات المسموح بها في خطته خلال آخر 30 يوماً
  // يُرجع null إن كانت الخطة بلا حد (غير محدود) أو لم يوجد اشتراك فعّال أصلاً (لا حد على التجربة المجانية)
  async function checkOrderCap(sellerId) {
    const seller = await getSellerById(sellerId);
    if (!seller) return { capped: false };
    const sub = seller.subscription;
    if (!sub || !sub.active || !sub.end || sub.end < Date.now()) return { capped: false };
    const plan = getPlan(sub.plan);
    if (!plan || plan.maxOrders == null) return { capped: false };

    const cycleStart = Date.now() - 30 * 86400000;
    const q = query(collection(db, "orders"), where("sellerIds", "array-contains", sellerId));
    const snap = await getDocs(q);
    const count = snap.docs.filter((d) => (d.data().createdAt || 0) >= cycleStart).length;
    return { capped: count >= plan.maxOrders, count, max: plan.maxOrders, planName: plan.name };
  }

  // ---------- Cart (محلي فقط، السلة شخصية ولا تحتاج مشاركة) ----------
  function getCart() { return JSON.parse(localStorage.getItem("dukan_cart") || "[]"); }
  function saveCart(cart) { localStorage.setItem("dukan_cart", JSON.stringify(cart)); }
  function addToCart(productId, qty = 1) {
    const cart = getCart();
    const line = cart.find((c) => c.productId === productId);
    if (line) line.qty += qty; else cart.push({ productId, qty });
    saveCart(cart);
    return cart;
  }
  function updateCartQty(productId, qty) {
    let cart = getCart();
    if (qty <= 0) cart = cart.filter((c) => c.productId !== productId);
    else { const line = cart.find((c) => c.productId === productId); if (line) line.qty = qty; }
    saveCart(cart);
    return cart;
  }
  function clearCart() { saveCart([]); }

  return {
    TRIAL_DAYS, PLANS, getPlan, PLATFORM_WHATSAPP, CATEGORIES, ADMIN_EMAILS, STAFF_PERMISSIONS,
    ORDER_STATUSES, LOW_STOCK_THRESHOLD, WILAYAS, uid,
    getDeviceId, hasDeviceUsedTrial, markDeviceTrialUsed,
    getSellerById, getSellerByEmail, createSellerProfile, updateSellerProfile, getCurrentSeller,
    isAdminEmail, getAllSellers, activateSubscription, extendSubscription, cancelSubscription,
    getStaff, addStaff, updateStaff, deleteStaff,
    normalizePhone, getBlacklist, addToBlacklist, removeFromBlacklist, isPhoneBlacklisted,
    logBlacklistAttempt, getBlacklistAttempts, markAttemptsSeen,
    getLowStockProducts, decrementStock,
    saveDelivery, getDeliveryPrice, saveStoreProfile,
    getCustomers, ordersToCSV,
    getCoupons, addCoupon, updateCoupon, deleteCoupon, validateCoupon, incrementCouponUse,
    savePixels, trackVisit, getVisits,
    getProducts, getProductById, getProductsBySeller, addProduct, updateProduct, deleteProduct,
    addOrder, getOrdersForSeller, updateOrderStatus, checkOrderCap,
    getCart, saveCart, addToCart, updateCartQty, clearCart,
  };
})();
