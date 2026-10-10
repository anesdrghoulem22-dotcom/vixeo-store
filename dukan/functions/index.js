const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "europe-west1" });

const STRIPE_SECRET = process.env.STRIPE_SECRET;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_MAP = {
  basic: process.env.STRIPE_PRICE_BASIC || "price_1UP0DN1CWmgqSrPEglFJ0rV3",
  plus: process.env.STRIPE_PRICE_PLUS || "price_1UP0Dy1CWmgqSrPEY7bWVkSK",
  pro: process.env.STRIPE_PRICE_PRO || "price_1UP0F41CWmgqSrPEZvYvI4UE",
};

const stripe = STRIPE_SECRET ? require("stripe")(STRIPE_SECRET) : null;

exports.createCheckoutSession = onCall(async (request) => {
  if (!stripe) throw new HttpsError("failed-precondition", "Stripe غير مهيأ حالياً.");

  const uid = request.auth?.uid;
  const email = request.auth?.token?.email;
  if (!uid || !email) {
    throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  }

  const plan = request.data?.plan;
  if (!plan || !["basic", "plus", "pro"].includes(plan)) {
    throw new HttpsError("invalid-argument", "خطة غير صالحة.");
  }

  const priceId = STRIPE_PRICE_MAP[plan];
  if (!priceId) {
    throw new HttpsError("failed-precondition", "Price ID غير مُعرّف لهذه الخطة.");
  }

  const origin = request.data?.origin || "http://localhost:5500";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success.html?plan=${plan}`,
      cancel_url: `${origin}/pricing.html?cancel=1`,
      subscription_data: {
        metadata: { uid, plan, email },
      },
      metadata: { uid, plan, email },
    });

    return { url: session.url };
  } catch (err) {
    console.error("[createCheckoutSession]", err);
    throw new HttpsError("internal", "تعذّر إنشاء جلسة الدفع.");
  }
});

exports.stripeWebhook = onRequest(async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    res.status(500).send("Webhook not configured");
    return;
  }

  let event;
  const sig = req.headers["stripe-signature"];

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripeWebhook] signature error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const uid = session.metadata?.uid || session.subscription_data?.metadata?.uid;
      const plan = session.metadata?.plan || session.subscription_data?.metadata?.plan;

      if (uid && plan) {
        const now = Date.now();
        await db.collection("sellers").doc(uid).update({
          subscription: {
            active: true,
            plan,
            start: now,
            end: now + 30 * 24 * 60 * 60 * 1000,
          },
        });
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      if (subId) {
        const subscription = await stripe.subscriptions.retrieve(subId);
        const uid = subscription.metadata?.uid;
        const plan = subscription.metadata?.plan || subscription.items?.data[0]?.price?.metadata?.plan;

        if (uid && plan) {
          const now = Date.now();
          await db.collection("sellers").doc(uid).update({
            subscription: {
              active: true,
              plan,
              start: now,
              end: now + 30 * 24 * 60 * 60 * 1000,
            },
          });
        }
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("[stripeWebhook] processing error:", err);
    res.status(500).send("error");
  }
});

/* =========================================================
   الدفع الجزائري الثاني: البطاقة الذهبية/CIB عبر Chargily Pay
   ========================================================= */
const CHARGILY_SECRET = process.env.CHARGILY_SECRET;
const CHARGILY_MODE = process.env.CHARGILY_MODE === "live" ? "live" : "test";
const CHARGILY_API_BASE = CHARGILY_MODE === "live"
  ? "https://pay.chargily.net/api/v2"
  : "https://pay.chargily.net/test/api/v2";
const CHARGILY_AMOUNT_MAP = { basic: 1000, plus: 1500, pro: 2000 };
const CHARGILY_WEBHOOK_URL = "https://europe-west1-dukan-store-6a9fc.cloudfunctions.net/chargilyWebhook";

// تفعيل/تجديد اشتراك بائع (يستعمله Stripe وChargily معاً)
async function activateSubscription(uid, plan, provider) {
  const now = Date.now();
  const sellerRef = db.collection("sellers").doc(uid);
  const seller = await sellerRef.get();
  if (!seller.exists) {
    await sellerRef.set({
      name: "بائع جديد",
      email: null,
      createdAt: now,
      subscription: {
        active: true,
        plan,
        start: now,
        end: now + 30 * 24 * 60 * 60 * 1000,
        provider,
      },
    });
    return;
  }
  await sellerRef.update({
    subscription: {
      active: true,
      plan,
      start: now,
      end: now + 30 * 24 * 60 * 60 * 1000,
      provider,
    },
  });
}

exports.createChargilyCheckout = onCall(async (request) => {
  if (!CHARGILY_SECRET) {
    throw new HttpsError("failed-precondition", "بوابة الدفع Chargily غير مهيأة بعد.");
  }

  const uid = request.auth?.uid;
  const email = request.auth?.token?.email;
  if (!uid || !email) {
    throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  }

  const plan = request.data?.plan;
  if (!["basic", "plus", "pro"].includes(plan)) {
    throw new HttpsError("invalid-argument", "خطة غير صالحة.");
  }

  const amount = CHARGILY_AMOUNT_MAP[plan];
  let method = request.data?.method || "edahabia";
  if (!["edahabia", "cib"].includes(method)) method = "edahabia";
  const origin = request.data?.origin || "http://localhost:5500";

  try {
    const res = await fetch(`${CHARGILY_API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CHARGILY_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "dzd",
        payment_method: method,
        success_url: `${origin}/success.html?plan=${plan}`,
        failure_url: `${origin}/pricing.html?cancel=1`,
        webhook_endpoint: CHARGILY_WEBHOOK_URL,
        description: `اشتراك دكان — خطة ${plan}`,
        locale: "ar",
        metadata: { uid, plan, email },
      }),
    });

    const data = await res.json();
    if (!res.ok || !data?.checkout_url) {
      console.error("[chargily.create]", res.status, JSON.stringify(data));
      throw new HttpsError("internal", "تعذّر إنشاء جلسة الدفع عبر Chargily.");
    }

    return { url: data.checkout_url };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("[createChargilyCheckout]", err);
    throw new HttpsError("internal", "تعذّر إنشاء رابط الدفع.");
  }
});

exports.chargilyWebhook = onRequest(async (req, res) => {
  if (!CHARGILY_SECRET) {
    res.status(500).send("Webhook not configured");
    return;
  }

  const signature = req.headers["signature"];
  const rawBody = req.rawBody ? req.rawBody.toString("utf8") : "";
  if (!signature || !rawBody) {
    res.status(400).send("Missing signature or body");
    return;
  }

  // التوقيع = HMAC-SHA256 (hex) لمحتوى الطلب الخام بمفتاحك السري في Chargily
  const computed = crypto.createHmac("sha256", CHARGILY_SECRET).update(rawBody).digest("hex");
  const given = Buffer.from(signature);
  const expected = Buffer.from(computed);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    res.status(403).send("Invalid signature");
    return;
  }

  try {
    const event = JSON.parse(rawBody);
    if (event.type === "checkout.paid") {
      const checkout = event.data || {};
      if (checkout.status === "paid") {
        const metadata = checkout.metadata || {};
        const uid = metadata.uid;
        const plan = metadata.plan;
        if (uid && ["basic", "plus", "pro"].includes(plan)) {
          await activateSubscription(uid, plan, "chargily");
        }
      }
    }
    res.status(200).send("ok");
  } catch (err) {
    console.error("[chargilyWebhook] processing error:", err);
    res.status(500).send("error");
  }
});
