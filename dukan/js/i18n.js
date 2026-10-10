/* =========================================================
   DUKAN — نظام اللغات (عربي / فرنسي / إنجليزي)
   أي نص بلا ترجمة يبقى بالعربية تلقائياً (سليم دائماً)
   الاستعمال:
     - الساكنة نصوص الصفحات: data-i18n / data-i18n-ph / data-i18n-html
     - الساكنة داخل JS:  I18n.t("النص العربي", { متغير: value })
     - إضافة المبدّل:    <span data-lang-switch></span>
   ========================================================= */
const I18N_KEY = "dukan_lang";
const SUPPORTED = ["ar", "fr", "en"];

const D = {
  fr: {
    // ===== عناوين الصفحات =====
    "دكان — متجرك الإلكتروني لبيع وشراء كل شيء أونلاين": "Dukan — Votre boutique en ligne pour acheter et vendre",
    "تصفّح المنتجات — دكان": "Parcourir les produits — Dukan",
    "تفاصيل المنتج — دكان": "Détails du produit — Dukan",
    "متجر البائع — دكان": "Boutique du vendeur — Dukan",
    "السلة — دكان": "Panier — Dukan",
    "دخول البائعين — دكان": "Espace vendeurs — Dukan",
    "افتح متجرك — دكان": "Ouvrir votre boutique — Dukan",
    "تأكيد البريد الإلكتروني — دكان": "Vérification de l'e-mail — Dukan",
    "خطط الاشتراك — دكان": "Formules d'abonnement — Dukan",

    // ===== الترويسة العامة =====
    "تصفّح المتجر": "Parcourir la boutique",
    "المتجر": "Boutique",
    "خطط البائعين": "Formules vendeurs",
    "دخول البائعين": "Espace vendeurs",
    "افتح متجرك": "Ouvrir votre boutique",
    "بيع منتجاتك معنا": "Vendez vos produits avec nous",
    "السلة": "Panier",
    "العودة للوحة التحكم": "Retour au tableau de bord",
    "متابعة التسوق": "Continuer mes achats",
    "كل المنتجات": "Tous les produits",
    "بيع منتجاتك": "Vendez vos produits",

    // ===== الصفحة الرئيسية =====
    "✦ منصة بائعين متعددين — 7 أيام تجربة مجانية": "✦ Plateforme multi-vendeurs — 7 jours d'essai gratuit",
    "متجرك الإلكتروني الخاص،": "Votre propre boutique en ligne,",
    "جاهز خلال دقائق": "prête en quelques minutes",
    "دكان منصة تجمع البائعين والزبائن في مكان واحد: بيع أي منتج تحبّه — رقمياً أو ملموساً — بمتجر إلكتروني خاص، إدارة كاملة للطلبات، وتواصل مباشر مع الزبائن عبر واتساب.": "Dukan réunit vendeurs et clients en un seul endroit : vendez tout produit — numérique ou physique — avec votre propre boutique, une gestion complète des commandes et une communication directe avec vos clients via WhatsApp.",
    "🏪 افتح متجرك مجاناً": "🏪 Ouvrez votre boutique gratuitement",
    "تصفّح المتجر ↖": "Parcourir la boutique ↖",
    "أنا زبون": "Je suis un client",
    "تصفح كل منتجات البائعين على المنصة واطلب ما يعجبك مباشرة.": "Parcourez tous les produits des vendeurs et commandez directement ce qui vous plaît.",
    "أنا بائع": "Je suis un vendeur",
    "افتح متجرك الخاص، أضف منتجاتك، واستفد من 7 أيام تجربة مجانية.": "Ouvrez votre boutique, ajoutez vos produits et profitez de 7 jours d'essai gratuit.",
    "بلا عمولة على مبيعاتك": "Sans commission sur vos ventes",
    "متجرك جاهز خلال دقائق": "Boutique prête en quelques minutes",
    "طلبات مباشرة عبر واتساب": "Commandes directes via WhatsApp",
    "بياناتك محفوظة بأمان": "Vos données sont sécurisées",
    "بائع نشط": "Vendeurs actifs",
    "منتج معروض": "Produits en ligne",
    "أيام تجربة مجانية": "Jours d'essai gratuit",
    "عمولة على المبيعات": "Commission sur les ventes",
    "✦ لماذا دكان": "✦ Pourquoi Dukan",
    "كل شيء تحتاجه لتبيع أونلاين": "Tout ce qu'il faut pour vendre en ligne",
    "صفحة متجر خاصة بك": "Une page boutique personnelle",
    "رابط مباشر لمتجرك فقط، يمكنك مشاركته على إنستغرام وفيسبوك وواتساب.": "Un lien direct vers votre boutique, à partager sur Instagram, Facebook et WhatsApp.",
    "طلبات تصل مباشرة لواتساب": "Commandes envoyées directement sur WhatsApp",
    "كل طلب زبون يُحوَّل تلقائياً لمحادثة واتساب جاهزة بكامل التفاصيل.": "Chaque commande est envoyée automatiquement dans une conversation WhatsApp avec tous les détails.",
    "لوحة تحكم كاملة": "Tableau de bord complet",
    "إحصائيات، عملاء، كوبونات، فريق عمل، وحماية من الطلبات الوهمية — كل شيء في مكان واحد.": "Statistiques, clients, coupons, équipe et protection anti-fausses commandes — tout au même endroit.",
    "✦ ابدأ في دقائق": "✦ Lancez-vous en quelques minutes",
    "تفتح متجرك في 3 خطوات": "Ouvrez votre boutique en 3 étapes",
    "سجّل حسابك": "Créez votre compte",
    "أنشئ حساب بائع خلال دقيقة، مع 7 أيام تجربة مجانية بلا التزام.": "Créez un compte vendeur en une minute, avec 7 jours d'essai gratuit sans engagement.",
    "أضف منتجاتك": "Ajoutez vos produits",
    "منتجات رقمية أو ملموسة، مع صور وأسعار وتخفيضات وكوبونات خصم.": "Produits numériques ou physiques, avec photos, prix, réductions et coupons.",
    "استقبل الطلبات": "Recevez vos commandes",
    "شارك رابط متجرك، والطلبات تصلك مباشرة عبر واتساب بكل التفاصيل.": "Partagez le lien de votre boutique et recevez vos commandes directement sur WhatsApp.",
    "✦ تصفّح بسرعة": "✦ Explorez rapidement",
    "تصفّح حسب التصنيف": "Parcourez par catégorie",
    "✦ خطط البائعين": "✦ Formules vendeurs",
    "خطط اشتراك مرنة": "Des formules d'abonnement flexibles",
    "اشتراك شهري بسيط، بلا عمولة على مبيعاتك — كلما ارتفعت الخطة، زاد ظهور متجرك. 7 أيام تجربة مجانية عند التسجيل.": "Un abonnement mensuel simple, sans commission sur vos ventes — plus la formule est élevée, plus votre boutique est visible. 7 jours d'essai à l'inscription.",
    "✦ الخطوة الأولى": "✦ La première étape",
    "متجرك الاحترافي يبدأ بقرار واحد": "Votre boutique professionnelle commence par une décision",
    "سجّل الآن واحصل على 7 أيام تجربة كاملة بلا عمولة — منتجاتك، طلباتك، وعملاؤك في مكان واحد.": "Inscrivez-vous maintenant et profitez de 7 jours d'essai sans commission — vos produits, commandes et clients au même endroit.",
    "شاهد المتجر أولاً": "Voir la boutique d'abord",
    "روابط سريعة": "Liens rapides",
    "خطط الاشتراك": "Formules d'abonnement",
    "للبائعين": "Pour les vendeurs",
    "7 أيام تجربة مجانية": "7 jours d'essai gratuit",
    "لوحة تحكم كاملة": "Tableau de bord complet",
    "منصة بائعين متعددين لبيع كل أنواع المنتجات — رقمية أو ملموسة — بمتجر إلكتروني خاص لكل بائع وطلبات تصل مباشرة عبر واتساب.": "Plateforme multi-vendeurs pour vendre tous types de produits — numériques ou physiques — avec une boutique propre à chaque vendeur et des commandes directes via WhatsApp.",
    "© دكان — مشروع تجريبي يعمل بالكامل داخل المتصفح.": "© Dukan — projet démo fonctionnant entièrement dans le navigateur.",
    "الذهاب للوحة التحكم": "Aller au tableau de bord",
    "متجرك جاهز — تابع منتجاتك وطلباتك من هنا.": "Votre boutique est prête — suivez vos produits et commandes d'ici.",
    "🕐 مرحباً {name}، متبقٍ من تجربتك المجانية:": "🕐 Bonjour {name}, il vous reste :",
    "⚠️ انتهت فترتك التجريبية.": "⚠️ Votre période d'essai est terminée.",
    "اشترك الآن": "Abonnez-vous maintenant",
    "يوم": "j",

    // ===== صفحة المتجر العام (market) =====
    "✦ منتجات حقيقية، من بائعين حقيقيين": "✦ De vrais produits, de vrais vendeurs",
    "من الأزياء للإلكترونيات، كل ما تحتاجه في مكان واحد": "De la mode à l'électronique, tout ce qu'il vous faut au même endroit",
    "تصفح، قارن، واطلب ما يعجبك خلال دقائق — منتجات من بائعين حقيقيين على المنصة.": "Parcourez, comparez et commandez ce qui vous plaît en quelques minutes — des produits de vrais vendeurs sur la plateforme.",
    "ابحث عن منتج، مثال: حذاء رياضي، ساعة يد…": "Rechercher un produit, ex : baskets, montre…",
    "© دكان — مشروع تجريبي يعمل بالكامل داخل المتصفح (بدون خادم).": "© Dukan — projet démo fonctionnant entièrement dans le navigateur (sans serveur).",
    "هل أنت بائع؟ افتح متجرك الآن": "Vous êtes vendeur ? Ouvrez votre boutique maintenant",

    // ===== صفحة متجر البائع (store) =====
    "✦ متجر على منصة دكان": "✦ Boutique sur la plateforme Dukan",
    "🔗 نسخ رابط المتجر": "🔗 Copier le lien de la boutique",
    "توصيل لكل الولايات": "Livraison dans toutes les wilayas",
    "الدفع عند الاستلام": "Paiement à la livraison",
    "تواصل مباشر عبر واتساب": "Contact direct via WhatsApp",
    "منتجات موثوقة": "Produits fiables",
    "ابحث في منتجات هذا المتجر…": "Rechercher dans cette boutique…",
    "لم يضف هذا البائع أي منتج بعد.": "Ce vendeur n'a pas encore ajouté de produits.",
    "متجر يعمل على منصة دكان — طلبات مباشرة عبر واتساب.": "Boutique hébergée sur Dukan — commandes directes via WhatsApp.",

    // ===== صفحة تفاصيل المنتج =====
    "→ عودة للمتجر": "→ Retour à la boutique",
    "متوفر": "Disponible",
    "غير متوفر حالياً": "Indisponible pour le moment",
    "أضف إلى السلة": "Ajouter au panier",
    "تمت الإضافة إلى السلة ✓": "Ajouté au panier ✓",
    "نسخة": "exemplaire",

    // ===== صفحة السلة =====
    "سلة المشتريات": "Panier",
    "سلتك فارغة حالياً.": "Votre panier est vide pour le moment.",
    "تصفح المنتجات": "Parcourir les produits",
    "إتمام الطلب": "Finaliser la commande",
    "الاسم الكامل": "Nom complet",
    "رقم الهاتف": "Numéro de téléphone",
    "منتجات رقمية فقط — سيتم التسليم مباشرة بعد التواصل معك عبر واتساب، بدون حاجة لعنوان توصيل.": "Produits numériques uniquement — livraison immédiate après contact via WhatsApp, sans adresse de livraison.",
    "الولاية": "Wilaya",
    "اختر الولاية…": "Choisir la wilaya…",
    "طريقة التوصيل": "Mode de livraison",
    "توصيل للمنزل": "Livraison à domicile",
    "توصيل لمكتب الشحن (أرخص)": "Livraison au bureau de fret (moins cher)",
    "العنوان التفصيلي": "Adresse détaillée",
    "تأكيد الطلب عبر واتساب": "Confirmer la commande via WhatsApp",
    "بعد تأكيد الطلب سيُفتح واتساب تلقائياً برسالة جاهزة بكل تفاصيل طلبك.": "Après confirmation, WhatsApp s'ouvrira automatiquement avec un message prêt contenant tous les détails.",
    "التوصيل": "Livraison",
    "الخصم": "Remise",
    "المجموع": "Sous-total",
    "المجموع الكلي": "Total",
    "إزالة": "Retirer",
    "الكمية": "Quantité",
    "أخرى": "Autre",

    // ===== صفحات الدخول والتسجيل =====
    "تسجيل دخول البائعين": "Connexion des vendeurs",
    "أدر متجرك وتابع طلباتك من لوحة التحكم.": "Gérez votre boutique et suivez vos commandes depuis le tableau de bord.",
    "البريد الإلكتروني": "Adresse e-mail",
    "كلمة المرور": "Mot de passe",
    "تذكّرني": "Se souvenir de moi",
    "دخول": "Connexion",
    "ليس لديك حساب؟": "Vous n'avez pas de compte ?",
    "سجّل متجرك الآن": "Créez votre boutique",
    "افتح متجرك على دكان": "Ouvrez votre boutique sur Dukan",
    "7 أيام تجريبية مجاناً، بدون أي التزام.": "7 jours d'essai gratuits, sans engagement.",
    "اسم المتجر": "Nom de la boutique",
    "إنشاء الحساب وبدء التجربة": "Créer le compte et lancer l'essai",
    "لديك حساب؟": "Vous avez déjà un compte ?",
    "تسجيل الدخول": "Se connecter",
    "الرجاء ملء جميع الحقول الإجبارية.": "Veuillez remplir tous les champs obligatoires.",
    "جاري إنشاء الحساب...": "Création du compte…",
    "جارٍ الدخول…": "Connexion…",

    // ===== صفحة تأكيد البريد =====
    "تحقّق من بريدك الإلكتروني": "Vérifiez votre e-mail",
    "أرسلنا رابط تأكيد إلى": "Nous avons envoyé un lien de confirmation à",
    "اضغط على رابط التأكيد داخل الرسالة لتنشيط حسابك، ثم ارجع لهذه الصفحة واضغط «تحققتُ من بريدي».": "Cliquez sur le lien de confirmation dans le message pour activer votre compte, puis revenez sur cette page et cliquez sur « J'ai vérifié mon e-mail ».",
    "تحققتُ من بريدي — تابع": "J'ai vérifié mon e-mail — Continuer",
    "إعادة إرسال الرابط": "Renvoyer le lien",
    "تسجيل الخروج": "Déconnexion",
    "لم تصلك الرسالة؟ تحقّق من مجلد «الرسائل غير المرغوب فيها (Spam)».": "Vous n'avez pas reçu le message ? Vérifiez le dossier « spam ».",
    "جارٍ التحقق…": "Vérification…",
    "تم إرسال رابط التحقق ✓ — تحقّق أيضاً من مجلد «الرسائل غير المرغوب فيها».": "Lien de vérification envoyé ✓ — vérifiez aussi le dossier « spam ».",
    "لم يتم تأكيد بريدك بعد. افتح الرابط الذي أرسلناه إليك ثم اضغط «تحققتُ من بريدي».": "Votre e-mail n'est pas encore confirmé. Ouvrez le lien envoyé puis cliquez sur « J'ai vérifié mon e-mail ».",
    "تعذّر إرسال الرابط، حاول مجدداً.": "Impossible d'envoyer le lien, réessayez.",
    "تعذّر التحقق، حاول مجدداً.": "Échec de la vérification, réessayez.",
    "إعادة الإرسال بعد {s}ث": "Renvoi dans {s}s",

    // ===== صفحة الاشتراك =====
    "اختر خطة اشتراكك كبائع": "Choisissez votre formule vendeur",
    "اشتراك شهري بسيط، بلا عمولة على مبيعاتك — كلما ارتفعت الخطة، زاد ظهور متجرك.": "Un abonnement mensuel simple, sans commission sur vos ventes — plus la formule est élevée, plus votre boutique est visible.",
    "انتهت فترتك التجريبية المجانية. اختر خطة اشتراك لتفعيلها والمتابعة في استخدام لوحة التحكم.": "Votre période d'essai est terminée. Choisissez une formule pour la réactiver et continuer à utiliser le tableau de bord.",
    "تم إلغاء الدفع أو لم يكتمل — لم يُخصم أي مبلغ. يمكنك إعادة المحاولة متى شئت.": "Paiement annulé ou incomplet — aucun montant débité. Vous pouvez réessayer quand vous voulez.",
    "طرق الدفع المتاحة: تحويل عبر بريدي موب (تعليمات كاملة بالخطوات) أو الدفع بالبطاقة عبر Chargily Pay (البطاقة الذهبية / CIB) — يُفعَّل اشتراكك تلقائياً فور تأكيد الدفع.": "Modes de paiement : virement BaridiMob (instructions complètes) ou paiement par carte via Chargily Pay (Edahabia / CIB) — votre abonnement est activé automatiquement dès confirmation.",
    "اختر طريقة الدفع": "Choisissez le mode de paiement",
    "الخطة «{name}» — {price} / شهر": "Formule «{name}» — {price} / mois",
    "بريدي موب": "BaridiMob",
    "تحويل من حساب بريدي موب — أسرع طريقة في الجزائر": "Virement depuis un compte BaridiMob — le moyen le plus rapide en Algérie",
    "البطاقة الذهبية / CIB": "Carte Or / CIB",
    "دفع آمن عبر Chargily Pay (Edahabia + CIB)": "Paiement sécurisé via Chargily Pay (Edahabia + CIB)",
    "👀 بعد الاختيار سترى التعليمات الكاملة قبل إتمام الدفع.": "👀 Après le choix, vous verrez les instructions complètes avant de payer.",
    "الدفع عبر بريدي موب": "Paiement par BaridiMob",
    "RIB الخاص بنا للتحويل (بريدي موب)": "Notre RIB de virement (BaridiMob)",
    "نسخ": "Copier",
    "تم النسخ ✓": "Copié ✓",
    "الخطة «{name}» — المبلغ المطلوب تحويله: {price}": "Formule «{name}» — montant à transférer : {price}",
    "1️⃣ افتح تطبيق بريدي موب، وحوّل المبلغ {price} إلى الحساب أعلاه.<br>2️⃣ بعد إتمام التحويل، اضغط الزر الأخضر بالأسفل لمراسلتنا عبر واتساب.<br>3️⃣ أرفق صورة إثبات التحويل مع اسم المتجر والبريد — سنفعّل اشتراكك فور التأكيد.": "1️⃣ Ouvrez l'app BaridiMob et transférez le montant {price} au compte ci-dessus.<br>2️⃣ Après le virement, appuyez sur le bouton vert pour nous écrire sur WhatsApp.<br>3️⃣ Joignez une preuve de virement avec le nom de la boutique et l'e-mail — nous activons votre abonnement après confirmation.",
    "📲 إرسال إثبات التحويل عبر واتساب": "📲 Envoyer la preuve de virement via WhatsApp",
    "👤 المتجر: {name} — 📧 {email}": "👤 Boutique : {name} — 📧 {email}",
    "رجوع لطرق الدفع": "Retour aux modes de paiement",
    "جارٍ تحويلك لصفحة الدفع الآمنة…": "Redirection vers la page de paiement sécurisée…",
    "Chargily Pay — البطاقة الذهبية / CIB": "Chargily Pay — Carte Or / CIB",
    "إذا لم تُفتح الصفحة خلال ثوانٍ، اضغط رجوع واختر الدفع عبر بريدي موب.": "Si la page ne s'ouvre pas en quelques secondes, revenez et choisissez le paiement par BaridiMob.",
    "تعذّر إنشاء رابط الدفع بالبطاقة حالياً (قد تكون بوابة الدفع غير مهيأة بعد). جرّب الدفع عبر بريدي موب.": "Impossible de créer le lien de paiement par carte pour le moment. Essayez le paiement par BaridiMob.",

    // ===== أسماء الخطط ومزاياها =====
    "أساسي": "Basic",
    "بلس": "Plus",
    "برو": "Pro",
    "للبداية القوية": "Pour bien commencer",
    "الأكثر اختياراً": "Le plus populaire",
    "للمتاجر الاحترافية": "Pour les boutiques pro",
    "منتجات غير محدودة": "Produits illimités",
    "حتى 30 طلباً شهرياً": "Jusqu'à 30 commandes/mois",
    "إدارة كاملة للطلبات": "Gestion complète des commandes",
    "صفحة متجر خاصة بك": "Une page boutique personnelle",
    "كوبونات خصم غير محدودة": "Coupons de réduction illimités",
    "موظف واحد إضافي": "1 employé supplémentaire",
    "دعم عبر واتساب": "Support via WhatsApp",
    "كل مزايا الخطة الأساسية": "Tous les avantages de Basic",
    "حتى 100 طلب شهرياً": "Jusqu'à 100 commandes/mois",
    "ظهور مبكر في نتائج البحث والمتجر العام": "Apparition prioritaire dans les résultats et la boutique générale",
    "فريق عمل حتى 3 موظفين": "Équipe jusqu'à 3 employés",
    "دعم أولوية عبر واتساب": "Support prioritaire via WhatsApp",
    "كل مزايا خطة بلس": "Tous les avantages de Plus",
    "طلبات ومبيعات غير محدودة": "Commandes et ventes illimitées",
    'علامة "متجر موثّق ✓" على منتجاتك ومتجرك': 'Badge « Boutique vérifiée ✓ » sur vos produits et votre boutique',
    "الظهور الأول دائماً في نتائج البحث": "Toujours premier dans les résultats de recherche",
    "فريق عمل غير محدود": "Équipe illimitée",
    "دعم VIP مباشر": "Support VIP direct",
    "⭐ ظهور مبكر بين البائعين": "⭐ Apparition prioritaire parmi les vendeurs",
    "✓ علامة متجر موثّق": "✓ Badge boutique vérifiée",
    "/ شهر": "/mois",

    // ===== متجر/منتج/سلة (نصوص داخلية ديناميكية) =====
    "الكل": "Tout",
    "لا توجد منتجات في المنصة بعد. البائعون يضيفون منتجاتهم قريباً — عاود الزيارة لاحقاً.": "Aucun produit sur la plateforme pour l'instant. Les vendeurs en ajoutent bientôt — revenez plus tard.",
    "لا توجد منتجات مطابقة لبحثك.": "Aucun produit ne correspond à votre recherche.",
    "تعذّر تحميل المنتجات. تأكد من إعداد Firebase بشكل صحيح (راجع README).": "Impossible de charger les produits. Vérifiez la configuration de Firebase (voir README).",
    "رابط المتجر غير صالح.": "Lien de boutique invalide.",
    "تصفح كل المنتجات": "Parcourir tous les produits",
    "تعذّر تحميل المتجر. تأكد من إعداد Firebase بشكل صحيح (راجع README).": "Impossible de charger la boutique. Vérifiez la configuration de Firebase (voir README).",
    "المتجر غير موجود.": "Boutique introuvable.",
    "تم نسخ الرابط ✓": "Lien copié ✓",
    "جارٍ تحميل المنتج…": "Chargement du produit…",
    "تعذّر تحميل المنتج. تأكد من إعداد Firebase (راجع README).": "Impossible de charger le produit. Vérifiez la configuration de Firebase (voir README).",
    "المنتج غير موجود.": "Produit introuvable.",
    "عودة للمتجر": "Retour à la boutique",
    "خصم": "Réduction",
    "لا يوجد وصف لهذا المنتج.": "Aucune description pour ce produit.",
    "متوفر ({n} نسخة)": "Disponible ({n} exemplaires)",
    "منتج ملموس": "Produit physique",
    "منتج رقمي": "Produit numérique",
    "متجر موثّق": "Boutique vérifiée",
    "✓ موثّق": "✓ Vérifié",
    "جارٍ تحميل سلتك…": "Chargement de votre panier…",
    "الوحدة": "l'unité",
    "ملموس": "Physique",
    "رقمي": "Numérique",
    "حذف": "Supprimer",
    "🎟️ الكوبون {code} مطبّق": "🎟️ Coupon {code} appliqué",
    "لديك كود خصم؟ اكتبه هنا": "Vous avez un code promo ? Saisissez-le ici",
    "تطبيق": "Appliquer",
    "عدد المنتجات": "Nombre de produits",
    "المجموع الفرعي": "Sous-total",
    "الإجمالي": "Total",
    "أكواد الخصم تُطبَّق على منتجات متجر واحد فقط في الطلب.": "Les codes promo ne s'appliquent qu'aux produits d'une seule boutique par commande.",
    "جارٍ التحقق…": "Vérification…",
    "تعذّر التحقق من الكوبون — حاول مرة أخرى بعد قليل.": "Impossible de vérifier le coupon — réessayez dans un instant.",
    "جارٍ إرسال الطلب…": "Envoi de la commande…",
    "🛒 السلة": "🛒 Panier",
    "مواصلة التسوق": "Continuer mes achats",
    "تم تسجيل طلبك بنجاح": "Votre commande a bien été enregistrée",
    "رقم الطلب:": "N° de commande :",
    "أكمل تأكيد الطلب عبر واتساب ليتواصل معك البائع.": "Finalisez la commande via WhatsApp pour que le vendeur vous contacte.",
    "عذراً، لا يمكن إتمام هذا الطلب. يرجى التواصل مع المتجر مباشرة.": "Désolé, cette commande ne peut pas être finalisée. Veuillez contacter la boutique directement.",
    "عذراً، هذا المتجر وصل للحد الأقصى من الطلبات المسموح بها لهذا الشهر ({max} طلب). يمكنك التواصل معه مباشرة عبر واتساب.": "Désolé, cette boutique a atteint sa limite mensuelle de commandes ({max}). Vous pouvez la contacter directement via WhatsApp.",
    "تعذّر إرسال الطلب. تأكد من إعداد Firebase بشكل صحيح (راجع README) ثم أعد المحاولة.": "Échec de l'envoi de la commande. Vérifiez la configuration de Firebase (voir README) puis réessayez.",
    "مرحباً، عندي سؤال بخصوص متجر {name}": "Bonjour, j'ai une question concernant la boutique {name}",

    // ===== التصنيفات =====
    "أزياء وموضة": "Mode & vêtements",
    "إلكترونيات وتقنية": "Électronique & high-tech",
    "المنزل والمطبخ": "Maison & cuisine",
    "الجمال والعناية": "Beauté & soins",
    "رياضة ولياقة": "Sport & fitness",
    "أطفال ومستلزمات رضّع": "Bébé & maternité",
    "إكسسوارات ومجوهرات": "Accessoires & bijoux",
    "كتب وقرطاسية": "Livres & papeterie",
    "اشتراكات وخدمات رقمية": "Abonnements & services numériques",
    "منتجات أخرى": "Autres produits",
  },

  en: {
    // ===== Page titles =====
    "دكان — متجرك الإلكتروني لبيع وشراء كل شيء أونلاين": "Dukan — Your online store to buy and sell everything",
    "تصفّح المنتجات — دكان": "Browse products — Dukan",
    "تفاصيل المنتج — دكان": "Product details — Dukan",
    "متجر البائع — دكان": "Seller store — Dukan",
    "السلة — دكان": "Cart — Dukan",
    "دخول البائعين — دكان": "Seller login — Dukan",
    "افتح متجرك — دكان": "Open your store — Dukan",
    "تأكيد البريد الإلكتروني — دكان": "Email verification — Dukan",
    "خطط الاشتراك — دكان": "Pricing plans — Dukan",

    // ===== Header =====
    "تصفّح المتجر": "Browse the store",
    "المتجر": "Store",
    "خطط البائعين": "Seller plans",
    "دخول البائعين": "Seller login",
    "افتح متجرك": "Open your store",
    "بيع منتجاتك معنا": "Sell with us",
    "السلة": "Cart",
    "العودة للوحة التحكم": "Back to dashboard",
    "متابعة التسوق": "Continue shopping",
    "كل المنتجات": "All products",

    // ===== Landing =====
    "✦ منصة بائعين متعددين — 7 أيام تجربة مجانية": "✦ Multi-vendor marketplace — 7-day free trial",
    "متجرك الإلكتروني الخاص،": "Your own online store,",
    "جاهز خلال دقائق": "ready in minutes",
    "دكان منصة تجمع البائعين والزبائن في مكان واحد: بيع أي منتج تحبّه — رقمياً أو ملموساً — بمتجر إلكتروني خاص، إدارة كاملة للطلبات، وتواصل مباشر مع الزبائن عبر واتساب.": "Dukan brings sellers and customers together: sell any product — digital or physical — with your own online store, full order management, and direct customer contact via WhatsApp.",
    "🏪 افتح متجرك مجاناً": "🏪 Open your store free",
    "تصفّح المتجر ↖": "Browse the store ↖",
    "أنا زبون": "I'm a customer",
    "تصفح كل منتجات البائعين على المنصة واطلب ما يعجبك مباشرة.": "Browse all sellers' products and order what you like directly.",
    "أنا بائع": "I'm a seller",
    "افتح متجرك الخاص، أضف منتجاتك، واستفد من 7 أيام تجربة مجانية.": "Open your own store, add your products, and enjoy a 7-day free trial.",
    "بلا عمولة على مبيعاتك": "No commission on sales",
    "متجرك جاهز خلال دقائق": "Store ready in minutes",
    "طلبات مباشرة عبر واتساب": "Direct orders via WhatsApp",
    "بياناتك محفوظة بأمان": "Your data is secure",
    "بائع نشط": "Active sellers",
    "منتج معروض": "Products listed",
    "أيام تجربة مجانية": "Days free trial",
    "عمولة على المبيعات": "Commission on sales",
    "✦ لماذا دكان": "✦ Why Dukan",
    "كل شيء تحتاجه لتبيع أونلاين": "Everything you need to sell online",
    "صفحة متجر خاصة بك": "Your own store page",
    "رابط مباشر لمتجرك فقط، يمكنك مشاركته على إنستغرام وفيسبوك وواتساب.": "A direct link to your store, shareable on Instagram, Facebook and WhatsApp.",
    "طلبات تصل مباشرة لواتساب": "Orders sent straight to WhatsApp",
    "كل طلب زبون يُحوَّل تلقائياً لمحادثة واتساب جاهزة بكامل التفاصيل.": "Every order is sent automatically to a ready WhatsApp chat with all details.",
    "لوحة تحكم كاملة": "Full dashboard",
    "إحصائيات، عملاء، كوبونات، فريق عمل، وحماية من الطلبات الوهمية — كل شيء في مكان واحد.": "Stats, customers, coupons, team, and fake-order protection — everything in one place.",
    "✦ ابدأ في دقائق": "✦ Start in minutes",
    "تفتح متجرك في 3 خطوات": "Open your store in 3 steps",
    "سجّل حسابك": "Create your account",
    "أنشئ حساب بائع خلال دقيقة، مع 7 أيام تجربة مجانية بلا التزام.": "Create a seller account in under a minute, with a free 7-day trial, no commitment.",
    "أضف منتجاتك": "Add your products",
    "منتجات رقمية أو ملموسة، مع صور وأسعار وتخفيضات وكوبونات خصم.": "Digital or physical products, with photos, prices, discounts and coupons.",
    "استقبل الطلبات": "Receive orders",
    "شارك رابط متجرك، والطلبات تصلك مباشرة عبر واتساب بكل التفاصيل.": "Share your store link and orders arrive directly on WhatsApp with full details.",
    "✦ تصفّح بسرعة": "✦ Browse fast",
    "تصفّح حسب التصنيف": "Browse by category",
    "✦ خطط البائعين": "✦ Seller plans",
    "خطط اشتراك مرنة": "Flexible subscription plans",
    "اشتراك شهري بسيط، بلا عمولة على مبيعاتك — كلما ارتفعت الخطة، زاد ظهور متجرك. 7 أيام تجربة مجانية عند التسجيل.": "A simple monthly subscription, no commission on your sales — the higher the plan, the more visible your store. 7-day free trial on signup.",
    "✦ الخطوة الأولى": "✦ The first step",
    "متجرك الاحترافي يبدأ بقرار واحد": "Your professional store starts with one decision",
    "سجّل الآن واحصل على 7 أيام تجربة كاملة بلا عمولة — منتجاتك، طلباتك، وعملاؤك في مكان واحد.": "Sign up now and get a full 7-day trial with no commission — products, orders and customers in one place.",
    "شاهد المتجر أولاً": "See the store first",
    "روابط سريعة": "Quick links",
    "خطط الاشتراك": "Plans",
    "للبائعين": "For sellers",
    "7 أيام تجربة مجانية": "7-day free trial",
    "منصة بائعين متعددين لبيع كل أنواع المنتجات — رقمية أو ملموسة — بمتجر إلكتروني خاص لكل بائع وطلبات تصل مباشرة عبر واتساب.": "A multi-vendor platform to sell all kinds of products — digital or physical — with a dedicated online store for each seller and orders delivered directly via WhatsApp.",
    "© دكان — مشروع تجريبي يعمل بالكامل داخل المتصفح.": "© Dukan — demo project fully running in the browser.",
    "الذهاب للوحة التحكم": "Go to dashboard",
    "متجرك جاهز — تابع منتجاتك وطلباتك من هنا.": "Your store is ready — manage your products and orders from here.",
    "🕐 مرحباً {name}، متبقٍ من تجربتك المجانية:": "🕐 Hi {name}, time left on your free trial:",
    "⚠️ انتهت فترتك التجريبية.": "⚠️ Your free trial has ended.",
    "اشترك الآن": "Subscribe now",
    "يوم": "d",

    // ===== Market =====
    "✦ منتجات حقيقية، من بائعين حقيقيين": "✦ Real products from real sellers",
    "من الأزياء للإلكترونيات، كل ما تحتاجه في مكان واحد": "From fashion to electronics, everything you need in one place",
    "تصفح، قارن، واطلب ما يعجبك خلال دقائق — منتجات من بائعين حقيقيين على المنصة.": "Browse, compare and order what you like in minutes — products from real sellers on the platform.",
    "ابحث عن منتج، مثال: حذاء رياضي، ساعة يد…": "Search a product, e.g. sneakers, watch…",
    "© دكان — مشروع تجريبي يعمل بالكامل داخل المتصفح (بدون خادم).": "© Dukan — demo project fully running in the browser (no server).",
    "هل أنت بائع؟ افتح متجرك الآن": "Are you a seller? Open your store now",

    // ===== Store page =====
    "✦ متجر على منصة دكان": "✦ Store on Dukan",
    "🔗 نسخ رابط المتجر": "🔗 Copy store link",
    "توصيل لكل الولايات": "Delivery to all wilayas",
    "الدفع عند الاستلام": "Cash on delivery",
    "تواصل مباشر عبر واتساب": "Direct contact via WhatsApp",
    "منتجات موثوقة": "Trusted products",
    "ابحث في منتجات هذا المتجر…": "Search this store…",
    "لم يضف هذا البائع أي منتج بعد.": "This seller hasn't added any products yet.",
    "متجر يعمل على منصة دكان — طلبات مباشرة عبر واتساب.": "A store on Dukan — orders delivered directly via WhatsApp.",

    // ===== Product =====
    "→ عودة للمتجر": "→ Back to store",
    "متوفر": "In stock",
    "غير متوفر حالياً": "Currently unavailable",
    "أضف إلى السلة": "Add to cart",
    "تمت الإضافة إلى السلة ✓": "Added to cart ✓",
    "نسخة": "copies",

    // ===== Cart =====
    "سلة المشتريات": "Shopping cart",
    "سلتك فارغة حالياً.": "Your cart is currently empty.",
    "تصفح المنتجات": "Browse products",
    "إتمام الطلب": "Checkout",
    "الاسم الكامل": "Full name",
    "رقم الهاتف": "Phone number",
    "منتجات رقمية فقط — سيتم التسليم مباشرة بعد التواصل معك عبر واتساب، بدون حاجة لعنوان توصيل.": "Digital products only — delivered right after we contact you on WhatsApp, no delivery address needed.",
    "الولاية": "Wilaya",
    "اختر الولاية…": "Choose wilaya…",
    "طريقة التوصيل": "Delivery method",
    "توصيل للمنزل": "Home delivery",
    "توصيل لمكتب الشحن (أرخص)": "Delivery to shipping office (cheaper)",
    "العنوان التفصيلي": "Detailed address",
    "تأكيد الطلب عبر واتساب": "Confirm order via WhatsApp",
    "بعد تأكيد الطلب سيُفتح واتساب تلقائياً برسالة جاهزة بكل تفاصيل طلبك.": "After confirming, WhatsApp will open automatically with a ready message containing all your order details.",
    "التوصيل": "Delivery",
    "الخصم": "Discount",
    "المجموع": "Subtotal",
    "المجموع الكلي": "Total",
    "إزالة": "Remove",
    "الكمية": "Quantity",
    "أخرى": "Other",

    // ===== Auth =====
    "تسجيل دخول البائعين": "Seller login",
    "أدر متجرك وتابع طلباتك من لوحة التحكم.": "Manage your store and follow your orders from the dashboard.",
    "البريد الإلكتروني": "Email address",
    "كلمة المرور": "Password",
    "تذكّرني": "Remember me",
    "دخول": "Login",
    "ليس لديك حساب؟": "Don't have an account?",
    "سجّل متجرك الآن": "Create your store",
    "افتح متجرك على دكان": "Open your store on Dukan",
    "7 أيام تجريبية مجاناً، بدون أي التزام.": "7 days free trial, no commitment.",
    "اسم المتجر": "Store name",
    "إنشاء الحساب وبدء التجربة": "Create account & start trial",
    "لديك حساب؟": "Have an account?",
    "تسجيل الدخول": "Log in",
    "الرجاء ملء جميع الحقول الإجبارية.": "Please fill in all required fields.",
    "جاري إنشاء الحساب...": "Creating account…",
    "جارٍ الدخول…": "Logging in…",

    // ===== Verify email =====
    "تحقّق من بريدك الإلكتروني": "Check your email",
    "أرسلنا رابط تأكيد إلى": "We sent a verification link to",
    "اضغط على رابط التأكيد داخل الرسالة لتنشيط حسابك، ثم ارجع لهذه الصفحة واضغط «تحققتُ من بريدي».": "Click the verification link in the message to activate your account, then return to this page and click « I've verified my email ».",
    "تحققتُ من بريدي — تابع": "I've verified my email — Continue",
    "إعادة إرسال الرابط": "Resend link",
    "تسجيل الخروج": "Log out",
    "لم تصلك الرسالة؟ تحقّق من مجلد «الرسائل غير المرغوب فيها (Spam)».": "Didn't receive the message? Check your « spam » folder.",
    "جارٍ التحقق…": "Checking…",
    "تم إرسال رابط التحقق ✓ — تحقّق أيضاً من مجلد «الرسائل غير المرغوب فيها».": "Verification link sent ✓ — also check your « spam » folder.",
    "لم يتم تأكيد بريدك بعد. افتح الرابط الذي أرسلناه إليك ثم اضغط «تحققتُ من بريدي».": "Your email isn't verified yet. Open the link we sent you, then click « I've verified my email ».",
    "تعذّر إرسال الرابط، حاول مجدداً.": "Couldn't send the link, try again.",
    "تعذّر التحقق، حاول مجدداً.": "Verification failed, try again.",
    "إعادة الإرسال بعد {s}ث": "Resend in {s}s",

    // ===== Pricing =====
    "اختر خطة اشتراكك كبائع": "Choose your seller plan",
    "اشتراك شهري بسيط، بلا عمولة على مبيعاتك — كلما ارتفعت الخطة، زاد ظهور متجرك.": "A simple monthly subscription, no commission on your sales — the higher the plan, the more visible your store.",
    "انتهت فترتك التجريبية المجانية. اختر خطة اشتراك لتفعيلها والمتابعة في استخدام لوحة التحكم.": "Your free trial has ended. Choose a plan to reactivate it and keep using the dashboard.",
    "تم إلغاء الدفع أو لم يكتمل — لم يُخصم أي مبلغ. يمكنك إعادة المحاولة متى شئت.": "Payment was cancelled or incomplete — nothing was charged. You can try again anytime.",
    "طرق الدفع المتاحة: تحويل عبر بريدي موب (تعليمات كاملة بالخطوات) أو الدفع بالبطاقة عبر Chargily Pay (البطاقة الذهبية / CIB) — يُفعَّل اشتراكك تلقائياً فور تأكيد الدفع.": "Payment options: BaridiMob transfer (full step-by-step instructions) or card payment via Chargily Pay (Edahabia / CIB) — your subscription activates automatically once payment is confirmed.",
    "اختر طريقة الدفع": "Choose payment method",
    "الخطة «{name}» — {price} / شهر": "Plan «{name}» — {price} / month",
    "بريدي موب": "BaridiMob",
    "تحويل من حساب بريدي موب — أسرع طريقة في الجزائر": "Transfer from a BaridiMob account — fastest way in Algeria",
    "البطاقة الذهبية / CIB": "Carte Or / CIB",
    "دفع آمن عبر Chargily Pay (Edahabia + CIB)": "Secure payment via Chargily Pay (Edahabia + CIB)",
    "👀 بعد الاختيار سترى التعليمات الكاملة قبل إتمام الدفع.": "👀 After choosing, you'll see the full instructions before paying.",
    "الدفع عبر بريدي موب": "Pay via BaridiMob",
    "RIB الخاص بنا للتحويل (بريدي موب)": "Our transfer RIB (BaridiMob)",
    "نسخ": "Copy",
    "تم النسخ ✓": "Copied ✓",
    "الخطة «{name}» — المبلغ المطلوب تحويله: {price}": "Plan «{name}» — amount to transfer: {price}",
    "1️⃣ افتح تطبيق بريدي موب، وحوّل المبلغ {price} إلى الحساب أعلاه.<br>2️⃣ بعد إتمام التحويل، اضغط الزر الأخضر بالأسفل لمراسلتنا عبر واتساب.<br>3️⃣ أرفق صورة إثبات التحويل مع اسم المتجر والبريد — سنفعّل اشتراكك فور التأكيد.": "1️⃣ Open the BaridiMob app and transfer {price} to the account above.<br>2️⃣ After the transfer, tap the green button to message us on WhatsApp.<br>3️⃣ Attach a transfer receipt with the store name and email — we activate your subscription right after confirmation.",
    "📲 إرسال إثبات التحويل عبر واتساب": "📲 Send transfer proof via WhatsApp",
    "👤 المتجر: {name} — 📧 {email}": "👤 Store: {name} — 📧 {email}",
    "رجوع لطرق الدفع": "Back to payment methods",
    "جارٍ تحويلك لصفحة الدفع الآمنة…": "Redirecting to the secure payment page…",
    "Chargily Pay — البطاقة الذهبية / CIB": "Chargily Pay — Carte Or / CIB",
    "إذا لم تُفتح الصفحة خلال ثوانٍ، اضغط رجوع واختر الدفع عبر بريدي موب.": "If the page doesn't open in a few seconds, go back and choose BaridiMob.",
    "تعذّر إنشاء رابط الدفع بالبطاقة حالياً (قد تكون بوابة الدفع غير مهيأة بعد). جرّب الدفع عبر بريدي موب.": "Couldn't create the card payment link right now. Try BaridiMob instead.",

    // ===== Plan names & features =====
    "أساسي": "Basic",
    "بلس": "Plus",
    "برو": "Pro",
    "للبداية القوية": "For a strong start",
    "الأكثر اختياراً": "Most popular",
    "للمتاجر الاحترافية": "For pro stores",
    "منتجات غير محدودة": "Unlimited products",
    "حتى 30 طلباً شهرياً": "Up to 30 orders/month",
    "إدارة كاملة للطلبات": "Full order management",
    "صفحة متجر خاصة بك": "Your own store page",
    "كوبونات خصم غير محدودة": "Unlimited discount coupons",
    "موظف واحد إضافي": "1 extra staff member",
    "دعم عبر واتساب": "WhatsApp support",
    "كل مزايا الخطة الأساسية": "Everything in Basic",
    "حتى 100 طلب شهرياً": "Up to 100 orders/month",
    "ظهور مبكر في نتائج البحث والمتجر العام": "Higher ranking in search and the general marketplace",
    "فريق عمل حتى 3 موظفين": "Team of up to 3 staff",
    "دعم أولوية عبر واتساب": "Priority WhatsApp support",
    "كل مزايا خطة بلس": "Everything in Plus",
    "طلبات ومبيعات غير محدودة": "Unlimited orders and sales",
    'علامة "متجر موثّق ✓" على منتجاتك ومتجرك': '«Verified store ✓» badge on your products and store',
    "الظهور الأول دائماً في نتائج البحث": "Always first in search results",
    "فريق عمل غير محدود": "Unlimited team",
    "دعم VIP مباشر": "Direct VIP support",
    "⭐ ظهور مبكر بين البائعين": "⭐ Higher ranking among sellers",
    "✓ علامة متجر موثّق": "✓ Verified store badge",
    "/ شهر": "/month",

    // ===== Store/product/cart (dynamic UI strings) =====
    "الكل": "All",
    "لا توجد منتجات في المنصة بعد. البائعون يضيفون منتجاتهم قريباً — عاود الزيارة لاحقاً.": "No products on the platform yet. Sellers are adding more soon — check back later.",
    "لا توجد منتجات مطابقة لبحثك.": "No products match your search.",
    "تعذّر تحميل المنتجات. تأكد من إعداد Firebase بشكل صحيح (راجع README).": "Failed to load products. Check your Firebase setup (see README).",
    "رابط المتجر غير صالح.": "Invalid store link.",
    "تصفح كل المنتجات": "Browse all products",
    "تعذّر تحميل المتجر. تأكد من إعداد Firebase بشكل صحيح (راجع README).": "Failed to load the store. Check your Firebase setup (see README).",
    "المتجر غير موجود.": "Store not found.",
    "تم نسخ الرابط ✓": "Link copied ✓",
    "جارٍ تحميل المنتج…": "Loading product…",
    "تعذّر تحميل المنتج. تأكد من إعداد Firebase (راجع README).": "Failed to load the product. Check your Firebase setup (see README).",
    "المنتج غير موجود.": "Product not found.",
    "عودة للمتجر": "Back to store",
    "خصم": "Off",
    "لا يوجد وصف لهذا المنتج.": "No description for this product.",
    "متوفر ({n} نسخة)": "In stock ({n} items)",
    "منتج ملموس": "Physical product",
    "منتج رقمي": "Digital product",
    "متجر موثّق": "Verified store",
    "✓ موثّق": "✓ Verified",
    "جارٍ تحميل سلتك…": "Loading your cart…",
    "الوحدة": "each",
    "ملموس": "Physical",
    "رقمي": "Digital",
    "حذف": "Delete",
    "🎟️ الكوبون {code} مطبّق": "🎟️ Coupon {code} applied",
    "لديك كود خصم؟ اكتبه هنا": "Have a promo code? Enter it here",
    "تطبيق": "Apply",
    "عدد المنتجات": "Items",
    "المجموع الفرعي": "Subtotal",
    "الإجمالي": "Total",
    "أكواد الخصم تُطبَّق على منتجات متجر واحد فقط في الطلب.": "Promo codes apply to products from a single store per order.",
    "جارٍ التحقق…": "Checking…",
    "تعذّر التحقق من الكوبون — حاول مرة أخرى بعد قليل.": "Couldn't verify the coupon — try again shortly.",
    "جارٍ إرسال الطلب…": "Sending order…",
    "🛒 السلة": "🛒 Cart",
    "مواصلة التسوق": "Continue shopping",
    "تم تسجيل طلبك بنجاح": "Your order was placed successfully",
    "رقم الطلب:": "Order number:",
    "أكمل تأكيد الطلب عبر واتساب ليتواصل معك البائع.": "Complete the order on WhatsApp so the seller can contact you.",
    "عذراً، لا يمكن إتمام هذا الطلب. يرجى التواصل مع المتجر مباشرة.": "Sorry, this order can't be completed. Please contact the store directly.",
    "عذراً، هذا المتجر وصل للحد الأقصى من الطلبات المسموح بها لهذا الشهر ({max} طلب). يمكنك التواصل معه مباشرة عبر واتساب.": "Sorry, this store has reached its monthly order limit ({max}). You can contact it directly via WhatsApp.",
    "تعذّر إرسال الطلب. تأكد من إعداد Firebase بشكل صحيح (راجع README) ثم أعد المحاولة.": "Failed to send the order. Check your Firebase setup (see README) and try again.",
    "مرحباً، عندي سؤال بخصوص متجر {name}": "Hi, I have a question about the store {name}",

    // ===== Categories =====
    "أزياء وموضة": "Fashion",
    "إلكترونيات وتقنية": "Electronics & tech",
    "المنزل والمطبخ": "Home & kitchen",
    "الجمال والعناية": "Beauty & care",
    "رياضة ولياقة": "Sports & fitness",
    "أطفال ومستلزمات رضّع": "Kids & baby",
    "إكسسوارات ومجوهرات": "Accessories & jewelry",
    "كتب وقرطاسية": "Books & stationery",
    "اشتراكات وخدمات رقمية": "Subscriptions & digital services",
    "منتجات أخرى": "Other products",
  },
};

const state = { lang: "ar" };

function currentLang() {
  const saved = localStorage.getItem(I18N_KEY);
  return SUPPORTED.includes(saved) ? saved : "ar";
}

function t(key, vars) {
  const table = D[state.lang] || {};
  let s = table[key] || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      s = s.split(`{${k}}`).join(String(v));
    });
  }
  return s;
}

function apply() {
  document.documentElement.setAttribute("lang", state.lang);
  document.documentElement.setAttribute("dir", state.lang === "ar" ? "rtl" : "ltr");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    if (el.hasAttribute("data-i18n-html")) {
      el.innerHTML = t(key);
    } else {
      el.textContent = t(key);
    }
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    if (key) el.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key) el.setAttribute("title", t(key));
  });
}

function mountSwitchers() {
  document.querySelectorAll("[data-lang-switch]").forEach((host) => {
    host.innerHTML =
      `<select class="lang-select" aria-label="Language / اللغة">
         <option value="ar">العربية</option>
         <option value="fr">Français</option>
         <option value="en">English</option>
       </select>`;
    const sel = host.querySelector("select");
    sel.value = state.lang;
    sel.addEventListener("change", () => {
      if (SUPPORTED.includes(sel.value)) {
        localStorage.setItem(I18N_KEY, sel.value);
        location.reload();
      }
    });
  });
}

function init() {
  state.lang = currentLang();
  apply();
  mountSwitchers();
}

export const I18n = { t, apply, init, setLang: (l) => { localStorage.setItem(I18N_KEY, l); location.reload(); }, lang: () => state.lang };

init();