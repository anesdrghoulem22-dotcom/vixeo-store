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
  sendEmailVerification,
  reload as fbReload,
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

  // =========================================================
  //  حماية التسجيل من البُرد الوهمية والمؤقتة
  // =========================================================
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // مزوّدو البريد المؤقت/الوهمي (Disposable) — يُرفض التسجيل بهم.
  // القائمة قابلة للتوسيع: أضف الدومين هنا عند الحاجة.
  const DISPOSABLE_DOMAINS = new Set([
    "0-mail.com","0815.ru","0clickemail.com","10mail.org","10minutemail.com","10minutemail.net",
    "10minutemail.org","10minutemail.ru","20minutemail.com","2prong.com","30minutemail.com",
    "33mail.com","3d-painting.com","4warding.com","5ymail.com","6paq.com","7tags.com","9ox.net",
    "a-bc.net","afrobacon.com","ajaxapp.net","amilegit.com","amiri.net","antireg.ru","antispam.de",
    "antispam24.de","armyspy.com","azmeil.com","binkmail.com","bobmail.info","bogusmail.com",
    "bofthew.com","bugmenot.com","bunnyban.com","byom.de","c2.hu","card.zp.ua","cashflow35.com",
    "centermail.com","chogmail.com","correo.blogos.net","cosmorph.com","cust.in","dacoolest.com",
    "dandikmail.com","deadaddress.com","despam.it","devnullmail.com","dfgh.net",
    "digitalsanctuary.com","discard.email","discardmail.com","discardmail.de","disposableaddress.com",
    "disposableemailaddresses.com","disposabled.de","disposablemail.com","dispostable.com","dizum.com",
    "dodgeit.com","dodgit.com","donemail.ru","dontreg.com","dump-email.info","dumpandjunk.com",
    "dumpmail.de","e4ward.com","email60.com","emaildienst.de","emailgo.de","emailias.com",
    "emailinfive.com","emailmiser.com","emailsensei.com","emailtemporario.com.br","emailthe.net",
    "emailtmp.com","emailwarden.com","emailx.at","enterto.com","ephemail.net","etranquil.com",
    "etranquil.net","etranquil.org","express.net.ua","fakeinbox.com","fakemail.fr","fakemailgenerator.com",
    "fastacura.com","fastchevy.com","fastchrysler.com","fastkawasaki.com","fastmazda.com",
    "fastmitsubishi.com","fastnissan.com","fastsubaru.com","fastsuzuki.com","fasttoyota.com",
    "fastyamaha.com","filzmail.com","frapmail.com","front14.org","gafy.net","garliclife.com",
    "get1mail.com","getairmail.com","getnada.com","getonemail.com","getonemail.net","ghosttexter.de",
    "gishpuppy.com","guerrillamail.biz","guerrillamail.com","guerrillamail.de","guerrillamail.info",
    "guerrillamail.net","guerrillamail.org","guerrillamailblock.com","haltospam.com","hotpop.com",
    "ieatspam.eu","ieatspam.info","ihateyoualot.info","iheartspam.org","imails.info","inboxalias.com",
    "incognitomail.com","incognitomail.net","incognitomail.org","insorg.org","ipoo.org","irish2me.com",
    "jetable.com","jetable.fr.nf","jetable.net","jetable.org","jnxjn.com","junk1e.com","kickassmail.com",
    "killmail.com","killmail.net","kismail.ru","klassmaster.com","klassmaster.net","klzlk.com",
    "koszmail.pl","kurzepost.de","laztrash.com","litedrop.com","lookugly.com","lortemail.dk","lr78.com",
    "maboard.com","mail-temporaire.fr","mail.by","mail2rss.org","mail333.com","mailbidon.com",
    "mailblocks.com","mailcatch.com","mailchop.com","mailde.de","mailde.info","maildrop.cc",
    "maileater.com","mailexpire.com","mailfa.tk","mailforspam.com","mailfreeonline.com","mailguard.me",
    "mailin8r.com","mailinater.com","mailinator.com","mailinator.net","mailinator2.com",
    "mailincubator.com","mailismagic.com","mailme.ir","mailme.lv","mailmetrash.com","mailmoat.com",
    "mailnator.com","mailnesia.com","mailnull.com","mailorg.org","mailscrap.com","mailshell.com",
    "mailsiphon.com","mailslite.com","mailtemp.info","mailtome.de","mailtothis.com","mailtrash.net",
    "mailzilla.com","mailzilla.org","mbx.cc","mega.zik.dj","meltmail.com","messagebeamer.de",
    "mezimages.net","mintemail.com","misi.me","mjkp.com","moakt.com","mohmal.com","moncourrier.fr.nf",
    "monemail.fr.nf","monmail.fr.nf","mt2009.com","mycleaninbox.net","mypartyclip.de",
    "myphantomemail.com","myspaceinc.com","myspaceinc.net","myspaceinc.org","mytrashmail.com",
    "neverbox.com","no-spam.ws","nobulk.com","noclickemail.com","nomail.xl.cx","nomail2me.com",
    "nomorespamemails.com","nospam.ze.tc","nospam4.us","nospamfor.us","nospammail.net",
    "notmailinator.com","nowmymail.com","nurfuerspam.de","objectmail.com","obobbo.com",
    "oneoffemail.com","onewaymail.com","online.ms","ordinaryamerican.net","otherinbox.com",
    "ourklips.com","outlawspam.com","owlpic.com","pjjkp.com","politikerclub.de","pookmail.com",
    "privy-mail.com","proxymail.eu","prtnx.com","punkass.com","putthisinyourspamdatabase.com",
    "quickinbox.com","rcpt.at","recode.me","recursor.net","rejectmail.com","rklips.com","rmqkr.net",
    "rppkn.com","rtrtr.com","s0ny.net","safe-mail.net","safersignup.de","safetymail.info",
    "safetypost.de","sandelf.de","saynotospams.com","selfdestructingmail.com","sendspamhere.com",
    "sharklasers.com","shiftmail.com","shmeriously.com","shortmail.net","sibmail.com","skeefmail.com",
    "slaskpost.se","slopsbox.com","smellfear.com","sneakemail.com","snkmail.com","sofort-mail.de",
    "sogetthis.com","soodonims.com","spam.la","spam.su","spam4.me","spamavert.com","spambob.com",
    "spambob.net","spambob.org","spambog.com","spambog.de","spambog.ru","spambox.info","spambox.us",
    "spamcannon.com","spamcon.org","spamcorptastic.com","spamcowboy.com","spamcowboy.net",
    "spamcowboy.org","spamday.com","spamdecoy.net","spamex.com","spamfree.eu","spamfree24.de",
    "spamfree24.org","spamgourmet.com","spamgourmet.net","spamgourmet.org","spamherelots.com",
    "spamhereplease.com","spamhole.com","spamify.com","spamkill.info","spaml.com","spaml.de",
    "spamlot.net","spammehere.com","spammotel.com","spamobox.com","spamoff.de","spamslicer.com",
    "spamspot.com","spamthis.co.uk","spamtrail.com","spamtrap.ro","spamtraps.net","spamtroll.net",
    "spikio.com","supergreatmail.com","supermailer.jp","suremail.info","teewars.org","teleworm.com",
    "teleworm.us","temp-mail.org","temp-mail.ru","tempail.com","tempemail.net","tempinbox.co.uk",
    "tempinbox.com","templinfo.com","tempmail.com","tempmail.net","tempmail.org","tempr.email",
    "temporaryemail.net","temporaryinbox.com","tempthe.net","tempsky.com","thankyou2010.com",
    "thisisnotmyrealemail.com","throwawayemailaddress.com","throwawaymail.com","tiltblog.com",
    "tmailinator.com","tradermail.info","trash-amil.com","trash-mail.at","trash-mail.com",
    "trash-mail.de","trash2009.com","trashemail.de","trashmail.at","trashmail.com","trashmail.de",
    "trashmail.me","trashmail.net","trashmail.org","trashymail.com","trashymail.net","trbvm.com",
    "turual.com","twinmail.de","tyldd.com","uglyemail.com","umail.net","venompen.com",
    "veryrealemail.com","viditag.com","viewcastmedia.com","viewcastmedia.net","viewcastmedia.org",
    "webemail.me","webm4il.info","wegwerfmail.de","wegwerfmail.net","wegwerfmail.org","wh4f.org",
    "whyspam.me","willhackforfood.biz","willselfdestruct.com","winemaven.info","wronghead.com",
    "wuzup.net","xagloo.com","xemaps.com","xents.com","xmaily.com","xoxy.net","yep.it",
    "yogamaven.com","yopmail.com","yopmail.fr","yopmail.net","yopmail.org","yuurok.com",
    "zehnminutenmail.de","zippymail.info","zoemail.net","zomg.info",
  ]);

  // دومينات شبيهة بأسماء المزودين الحقيقيين (أخطاء مقصودة/تصيّد) — ممنوعة.
  const LOOKALIKE_DOMAINS = new Set([
    "gmial.com","gmai.com","gamil.com","gnail.com","gmaill.com","gmail.co","gmail.cm",
    "gmail.con","gmail.comm","gmaill.co","googlmail.com","hotmial.com","hotmai.com",
    "hotmall.com","yaho.com","yahoo.co","yhoo.com","outlok.com","outllok.com","iclod.com",
    "icloud.co","protonmai.com","protonmal.com",
  ]);

  function isDisposableDomain(domain) {
    if (DISPOSABLE_DOMAINS.has(domain)) return true;
    // حجب النطاقات الفرعية لمزود مؤقت (مثال: sub.mailinator.com)
    const parts = domain.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      if (DISPOSABLE_DOMAINS.has(parts.slice(i).join("."))) return true;
    }
    return false;
  }

  // يتحقق من صيغة البريد ومن كونه غير وهمي/مؤقت.
  // يُرجع { ok, message } — يُستعمل في التسجيل وفي إضافة الموظفين.
  function validateEmail(email) {
    const value = (email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      return { ok: false, message: "صيغة البريد الإلكتروني غير صحيحة." };
    }
    const domain = value.split("@")[1];
    if (isDisposableDomain(domain)) {
      return { ok: false, message: "لا نقبل البُرد المؤقتة أو الوهمية. استعمل بريدك الحقيقي (مثل Gmail)." };
    }
    if (LOOKALIKE_DOMAINS.has(domain)) {
      return { ok: false, message: "يبدو أن هناك خطأً في اسم البريد (ربما تقصد @gmail.com). تأكد من كتابته." };
    }
    return { ok: true, message: "" };
  }

  // هل يلزم هذا المستخدم تأكيد بريده؟
  // نُلزم فقط الحسابات الجديدة (الموسومة بـ emailVerifyRequired) حتى لا نُقفل
  // الحسابات القديمة التي أُنشئت قبل تفعيل هذه الميزة.
  function emailNeedsVerification(user, sellerDoc) {
    if (!user || user.emailVerified) return false;
    return !!(sellerDoc && sellerDoc.emailVerifyRequired === true);
  }

  async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) throw new Error("يجب تسجيل الدخول أولاً.");
    if (user.emailVerified) return true;
    await sendEmailVerification(user);
    return true;
  }

  // يعيد تحميل حالة المستخدم من Firebase ويرجع true إن تأكّد بريده.
  async function refreshEmailVerification() {
    const user = auth.currentUser;
    if (!user) return false;
    await fbReload(user);
    if (user.emailVerified) {
      try { await DB.updateSellerProfile(user.uid, { emailVerified: true }); }
      catch (err) { console.warn("[Auth.refreshEmailVerification] update failed:", err.message); }
      return true;
    }
    return false;
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

    // رفض البُرد الوهمية/المؤقتة قبل إنشاء الحساب
    const check = validateEmail(email);
    if (!check.ok) throw new Error(check.message);

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

    // إرسال رابط تأكيد البريد — إلزامي للحسابات الجديدة
    try {
      await sendEmailVerification(cred.user);
    } catch (err) {
      console.warn("[Auth.register] sendEmailVerification failed:", err.message);
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
      // يلزم هذا الحساب بتأكيد البريد قبل استعمال لوحة التحكم
      emailVerifyRequired: true,
      emailVerified: false,
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
      if (seller) return seller;
      // ليس صاحب متجر؟ ربما هو موظف مسجّل ببريده في متجر غيره
      const member = await DB.getMyMembership(cred.user.email || "").catch(() => null);
      if (member && member.active !== false) return { role: "staff", email: cred.user.email };
      throw new Error("تعذّر العثور على متجر مرتبط بهذا الحساب. تأكد أن صاحب المتجر أضاف بريدك إلى فريق العمل.");
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
    // موظف بلا متجر خاص → لا يحق له تعديل إعدادات متجر صاحب العمل
    if (!seller) {
      window.location.href = "dashboard.html";
      return null;
    }
    if (emailNeedsVerification(user, seller)) {
      window.location.href = "verify-email.html";
      return null;
    }
    if (!canAccessDashboard(seller)) {
      const member = await DB.getMyMembership(user.email || "").catch(() => null);
      window.location.href = member && member.active !== false ? "dashboard.html" : "pricing.html?expired=1";
      return null;
    }
    return seller;
  }

  async function redirectIfLoggedIn() {
    const user = await waitForAuthReady();
    if (!user) return;
    const session = await DB.resolveSession();
    if (!session) return;
    // حساب جديد لم يؤكّد بريده بعد → صفحة التحقق
    if (emailNeedsVerification(user, session.ownSeller)) {
      window.location.href = "verify-email.html";
      return;
    }
    // الموظف يدخل مباشرة إلى لوحة فريق العمل
    if (session.isStaff) {
      window.location.href = "dashboard.html";
      return;
    }
    window.location.href = session.ownSeller && canAccessDashboard(session.ownSeller) ? "dashboard.html" : "pricing.html";
  }

  return {
    waitForAuthReady, register, login, logout,
    getAccountStatus, canAccessDashboard, updateProfile, changePassword,
    guardDashboard, redirectIfLoggedIn,
    validateEmail, emailNeedsVerification, resendVerificationEmail, refreshEmailVerification,
  };
})();
