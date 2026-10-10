const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "europe-west1" });

const STRIPE_SECRET = process.env.STRIPE_SECRET;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_MAP = {
  basic: process.env.STRIPE_PRICE_BASIC,
  plus: process.env.STRIPE_PRICE_PLUS,
  pro: process.env.STRIPE_PRICE_PRO,
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
