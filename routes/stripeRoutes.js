const express = require('express');
const Stripe = require('stripe');
const { verifyFirebaseToken } = require('../server/middleware/verifyFirebaseToken');
const { admin, getAuth } = require('../server/firebaseAdmin');
const {
  ensureAccountForUser,
  getAccountById,
  getUserById,
  setAccountFields,
} = require('../server/firestoreAccounts');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

const PRICE_BY_PLAN = {
  solo: process.env.STRIPE_PRICE_SOLO_MONTHLY,
  duo: process.env.STRIPE_PRICE_DUO_MONTHLY,
};

const normalizePlan = (plan) => {
  const value = `${plan || ''}`.trim().toLowerCase();
  if (value === 'solo' || value === 'starter') return 'solo';
  if (value === 'duo' || value === 'business') return 'duo';
  return null;
};

const resolveBaseUrl = () => {
  const candidates = [
    process.env.APP_URL,
    process.env.REACT_APP_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];
  const resolved = candidates.find(
    (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim())
  );
  return `${resolved || 'http://localhost:3000'}`.replace(/\/+$/, '');
};

const router = express.Router();

const resolvePlanAndPrice = (rawPlan) => {
  const plan = normalizePlan(rawPlan);
  if (!plan) {
    return { error: { status: 400, message: 'Ugyldig plan' } };
  }
  const priceId = PRICE_BY_PLAN[plan];
  if (!priceId) {
    return { error: { status: 500, message: 'Price ID mangler på serveren.' } };
  }
  return { plan, priceId };
};

const buildCheckoutMetadata = ({ accountId, plan, uid }) => {
  const metadata = {};
  if (accountId) metadata.accountId = accountId;
  if (plan) metadata.plan = plan;
  if (uid) metadata.uid = uid;
  return metadata;
};

const createCheckoutSession = async ({ plan, priceId, accountId, uid, stripeCustomerId }) => {
  const baseUrl = resolveBaseUrl();
  const metadata = buildCheckoutMetadata({ accountId, plan, uid });
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer: stripeCustomerId || undefined,
    success_url: `${baseUrl}/?checkout=success&plan=${plan}`,
    cancel_url: `${baseUrl}/?checkout=cancel&plan=${plan}`,
    allow_promotion_codes: true,
    metadata,
    subscription_data: {
      metadata,
    },
  });
};

const verifyFirebaseTokenIfPresent = async (req) => {
  const header = req.headers?.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const idToken = match[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || decoded.displayName || null,
    };
  } catch (error) {
    console.warn('[stripe] ignoring invalid auth token:', error?.message || error);
    return null;
  }
};

router.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const { plan, priceId, error } = resolvePlanAndPrice(req.body?.plan);
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    console.info('[stripe] checkout session requested:', plan);
    const user = await verifyFirebaseTokenIfPresent(req);

    let accountId = null;
    let uid = null;
    let stripeCustomerId = null;
    if (user) {
      const { uid: userUid, email, displayName } = user;
      uid = userUid;
      let role = 'owner';
      const userDoc = await getUserById(uid);
      if (userDoc) {
        accountId = userDoc.accountId || null;
        role = userDoc.role || 'owner';
      }
      if (!accountId) {
        const ensured = await ensureAccountForUser({ uid, email, displayName });
        accountId = ensured.accountId;
        role = 'owner';
      }
      if (role !== 'owner') {
        return res.status(403).json({ error: 'Kun owner kan starte abonnement.' });
      }

      const account = await getAccountById(accountId);
      if (!account) {
        return res.status(500).json({ error: 'Account could not be resolved.' });
      }
      const subscriptionStatus = account.subscriptionStatus || 'none';
      if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
        return res.status(409).json({ error: 'Abonnement er allerede aktivt.' });
      }

      stripeCustomerId = account.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: email || account.email || undefined,
          metadata: {
            accountId,
            ownerUid: account.ownerUid || uid,
          },
        });
        stripeCustomerId = customer.id;
        await setAccountFields(accountId, {
          stripeCustomerId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      console.info('[stripe] public checkout session for plan:', plan);
    }

    const session = await createCheckoutSession({
      plan,
      priceId,
      accountId,
      uid,
      stripeCustomerId,
    });

    console.info('[stripe] checkout session created:', {
      plan,
      sessionId: session?.id,
      public: !user,
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error('[stripe] create-checkout-session error:', error);
    return res.status(500).json({
      error: error?.message || 'Server error',
    });
  }
});

router.post('/create-billing-portal-session', verifyFirebaseToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const { uid } = req.user || {};
    const userDoc = await getUserById(uid);
    if (!userDoc) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    const role = userDoc.role || 'owner';
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Kun owner kan administrere abonnement.' });
    }
    const accountId = userDoc.accountId;
    if (!accountId) {
      return res.status(400).json({ error: 'Ingen account tilknyttet bruger.' });
    }
    const account = await getAccountById(accountId);
    if (!account?.stripeCustomerId) {
      return res.status(400).json({ error: 'Mangler Stripe-kunde for kontoen.' });
    }

    const baseUrl = resolveBaseUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${baseUrl}/settings/subscription`,
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('[stripe] create-billing-portal-session error:', error);
    return res.status(500).json({
      error: error?.message || 'Server error',
    });
  }
});

const toFirestoreTimestamp = (seconds) => {
  if (!seconds || typeof seconds !== 'number') return null;
  return admin.firestore.Timestamp.fromMillis(seconds * 1000);
};

const resolveAccountMetadata = (object) => {
  const metadata = object?.metadata || object?.subscription_details?.metadata || {};
  const accountId = metadata.accountId || null;
  const plan = normalizePlan(metadata.plan) || metadata.plan || null;
  return { accountId, plan };
};

const updateAccountFromStripe = async ({
  accountId,
  subscriptionStatus,
  plan,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodEnd,
}) => {
  if (!accountId) return;
  const payload = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (subscriptionStatus) payload.subscriptionStatus = subscriptionStatus;
  if (plan) {
    payload.plan = plan;
  }
  if (stripeCustomerId) payload.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId) payload.stripeSubscriptionId = stripeSubscriptionId;
  if (currentPeriodEnd !== undefined) payload.currentPeriodEnd = currentPeriodEnd;

  await setAccountFields(accountId, payload);
};

const fetchSubscription = async (subscriptionId) => {
  if (!subscriptionId) return null;
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('[stripe] Failed to fetch subscription', subscriptionId, error);
    return null;
  }
};

const webhookHandler = async (req, res) => {
  if (!stripe) {
    return res.status(500).send('Stripe er ikke konfigureret.');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing Stripe signature.');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).send('STRIPE_WEBHOOK_SECRET mangler.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.info('[stripe] webhook received:', event?.type);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId =
          typeof session?.subscription === 'string'
            ? session.subscription
            : session?.subscription?.id;
        const subscription = await fetchSubscription(subscriptionId);
        const metadata = resolveAccountMetadata(session);
        const fallbackMeta = subscription ? resolveAccountMetadata(subscription) : {};
        const accountId = metadata.accountId || fallbackMeta.accountId;
        const plan = metadata.plan || fallbackMeta.plan || null;
        const subscriptionStatus = subscription?.status || 'active';
        const currentPeriodEnd = subscription
          ? toFirestoreTimestamp(subscription?.current_period_end)
          : undefined;

        await updateAccountFromStripe({
          accountId,
          subscriptionStatus,
          plan,
          stripeCustomerId: session?.customer,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd,
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const metadata = resolveAccountMetadata(subscription);
        const accountId = metadata.accountId;
        const plan = metadata.plan;
        const subscriptionStatus =
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : subscription?.status;
        const currentPeriodEnd = toFirestoreTimestamp(subscription?.current_period_end);

        await updateAccountFromStripe({
          accountId,
          subscriptionStatus,
          plan,
          stripeCustomerId: subscription?.customer,
          stripeSubscriptionId: subscription?.id,
          currentPeriodEnd,
        });
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const metadata = resolveAccountMetadata(invoice);
        let accountId = metadata.accountId;
        let plan = metadata.plan;
        let subscription = null;
        if (!accountId && invoice?.subscription) {
          subscription = await fetchSubscription(invoice.subscription);
          if (subscription) {
            const fallbackMeta = resolveAccountMetadata(subscription);
            accountId = fallbackMeta.accountId || accountId;
            plan = fallbackMeta.plan || plan;
          }
        }
        const subscriptionStatus = event.type === 'invoice.paid' ? 'active' : 'past_due';
        const currentPeriodEnd = subscription
          ? toFirestoreTimestamp(subscription?.current_period_end)
          : undefined;

        await updateAccountFromStripe({
          accountId,
          subscriptionStatus,
          plan,
          stripeCustomerId: invoice?.customer,
          stripeSubscriptionId: invoice?.subscription,
          currentPeriodEnd,
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('[stripe] webhook handler error:', error);
  }

  return res.json({ received: true });
};

// Local test:
// curl -i -X POST http://localhost:4000/api/stripe/create-checkout-session \
//   -H "Content-Type: application/json" \
//   -d '{"plan":"solo"}'

module.exports = { router, webhookHandler };
