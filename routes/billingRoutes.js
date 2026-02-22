const express = require('express');
const Stripe = require('stripe');
const { verifyFirebaseToken } = require('../server/middleware/verifyFirebaseToken');
const { admin } = require('../server/firebaseAdmin');
const { getUserById, setUserFields, setAccountFields } = require('../server/firestoreAccounts');

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

const normalizeBaseUrl = (value) => `${value || ''}`.replace(/\/+$/, '');

const resolveBaseUrl = (req) => {
  const origin = req?.headers?.origin;
  if (origin && /^https?:\/\//i.test(origin)) {
    return normalizeBaseUrl(origin);
  }
  const forwardedHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  if (forwardedHost) {
    const protoHeader = req?.headers?.['x-forwarded-proto'];
    const proto = protoHeader ? protoHeader.split(',')[0].trim() : 'https';
    return normalizeBaseUrl(`${proto}://${forwardedHost}`);
  }
  const candidates = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.REACT_APP_APP_URL,
  ];
  const resolved = candidates.find(
    (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim())
  );
  return normalizeBaseUrl(resolved || 'http://localhost:3000');
};

const toFirestoreTimestamp = (seconds) => {
  if (!seconds || typeof seconds !== 'number') return null;
  return admin.firestore.Timestamp.fromMillis(seconds * 1000);
};

const buildSubscriptionPayload = ({
  status,
  plan,
  stripeCustomerId,
  stripeSubscriptionId,
  createdAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  canceledAt,
  seatsIncluded,
}) => ({
  subscription: {
    status: status || null,
    plan: plan || null,
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    createdAt: createdAt || null,
    currentPeriodEnd: currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
    canceledAt: canceledAt || null,
  },
  subscriptionStatus: status || null,
  plan: plan || null,
  stripeCustomerId: stripeCustomerId || null,
  stripeSubscriptionId: stripeSubscriptionId || null,
  currentPeriodEnd: currentPeriodEnd || null,
  cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
  canceledAt: canceledAt || null,
  seatsIncluded: typeof seatsIncluded === 'number' ? seatsIncluded : undefined,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

router.post('/portal', verifyFirebaseToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }
    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }
    const userDoc = await getUserById(uid);
    if (!userDoc) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    const stripeCustomerId =
      userDoc?.subscription?.stripeCustomerId || userDoc?.stripeCustomerId || null;
    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'Mangler Stripe-kunde for brugeren.' });
    }

    const baseUrl = resolveBaseUrl(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/booking/settings?tab=subscription`,
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('[billing] portal error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

router.post('/cancel', verifyFirebaseToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }
    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }
    const userDoc = await getUserById(uid);
    if (!userDoc) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    const stripeSubscriptionId =
      userDoc?.subscription?.stripeSubscriptionId || userDoc?.stripeSubscriptionId || null;
    if (!stripeSubscriptionId) {
      return res.status(400).json({ error: 'Mangler Stripe-subscription for brugeren.' });
    }

    const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const payload = buildSubscriptionPayload({
      status: updated?.status || userDoc?.subscription?.status || userDoc?.subscriptionStatus || null,
      plan: userDoc?.subscription?.plan || userDoc?.plan || null,
      stripeCustomerId:
        updated?.customer ||
        userDoc?.subscription?.stripeCustomerId ||
        userDoc?.stripeCustomerId ||
        null,
      stripeSubscriptionId: updated?.id || stripeSubscriptionId,
      createdAt: toFirestoreTimestamp(updated?.created),
      currentPeriodEnd: toFirestoreTimestamp(updated?.current_period_end),
      cancelAtPeriodEnd: updated?.cancel_at_period_end,
      canceledAt: toFirestoreTimestamp(updated?.canceled_at),
    });

    await setUserFields(uid, payload);
    if (userDoc?.accountId) {
      await setAccountFields(userDoc.accountId, payload);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('[billing] cancel error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

module.exports = { router };
