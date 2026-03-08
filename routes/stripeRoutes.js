const express = require('express');
const Stripe = require('stripe');
const { verifyFirebaseToken } = require('../server/middleware/verifyFirebaseToken');
const { admin, getAuth, getFirestore } = require('../server/firebaseAdmin');
const {
  ensureAccountForUser,
  getActiveClinicId,
  getAccountById,
  getClinicById,
  getUserById,
  setAccountFields,
  setClinicFields,
  setUserSubscription,
  updateUsersByEmail,
} = require('../server/firestoreAccounts');
const {
  ReceiptServiceError,
  SIGNED_URL_TTL_MS,
  syncPaymentReceiptForSale,
  ensurePaymentForSale,
  findPaymentByAnyIdentifier,
  ensureReceiptDownloadUrl,
  resendReceiptEmailForPayment,
} = require('../server/receipts/receiptService');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

const PRICE_BY_PLAN = {
  solo: process.env.STRIPE_PRICE_SOLO_MONTHLY,
  duo: process.env.STRIPE_PRICE_DUO_MONTHLY,
};

const STRIPE_CONNECT_COUNTRY = `${process.env.STRIPE_CONNECT_COUNTRY || 'DK'}`
  .trim()
  .toUpperCase();
const STRIPE_CONNECT_DEFAULT_CURRENCY = `${process.env.STRIPE_CONNECT_DEFAULT_CURRENCY || 'DKK'}`
  .trim()
  .toLowerCase();
const STRIPE_CONNECT_DEFAULT_RETURN_URL =
  `${process.env.STRIPE_CONNECT_RETURN_URL || '/booking/fakturaer/betalinger?stripeConnect=return'}`.trim() ||
  '/booking/fakturaer/betalinger?stripeConnect=return';
const STRIPE_CONNECT_DEFAULT_REFRESH_URL =
  `${process.env.STRIPE_CONNECT_REFRESH_URL || '/booking/fakturaer/betalinger?stripeConnect=refresh'}`.trim() ||
  '/booking/fakturaer/betalinger?stripeConnect=refresh';
const STRIPE_CONNECT_ONBOARDING_FIELDS =
  `${process.env.STRIPE_CONNECT_ONBOARDING_FIELDS || 'eventually_due'}`.trim().toLowerCase() ===
  'currently_due'
    ? 'currently_due'
    : 'eventually_due';
const STRIPE_CONNECT_PAYMENT_METHODS = ['card', 'apple_pay', 'google_pay', 'mobilepay'];
const STRIPE_CONNECT_CHECKOUT_METHOD_TYPES = ['card', 'mobilepay'];
const RESEND_API_KEY = `${process.env.RESEND_API_KEY || ''}`.trim();
const RESEND_API_BASE = `${process.env.RESEND_API_BASE || 'https://api.resend.com'}`
  .trim()
  .replace(/\/+$/, '');
const STRIPE_SALE_LINK_FROM_EMAIL =
  `${process.env.STRIPE_SALE_LINK_FROM_EMAIL || process.env.BOOKING_CONFIRMATION_FROM_EMAIL || ''}`.trim() ||
  'Selma+ <booking@booking.selmaplus.tech>';
const STRIPE_SALE_LINK_REPLY_TO_EMAIL = `${process.env.STRIPE_SALE_LINK_REPLY_TO_EMAIL || ''}`.trim();

const normalizePlan = (plan) => {
  const value = `${plan || ''}`.trim().toLowerCase();
  if (value === 'solo' || value === 'starter') return 'solo';
  if (value === 'duo' || value === 'business') return 'duo';
  return null;
};

const resolveSeatsIncluded = (plan) => {
  if (plan === 'duo') return 2;
  if (plan === 'solo') return 1;
  return null;
};

const normalizeEmail = (email) => `${email || ''}`.trim().toLowerCase();

const escapeHtml = (value) =>
  String(value || '').replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });

const formatSaleAmount = (amount, currency) => {
  try {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: `${currency || STRIPE_CONNECT_DEFAULT_CURRENCY}`.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch (_error) {
    return `${Number(amount || 0).toFixed(2)} ${String(currency || STRIPE_CONNECT_DEFAULT_CURRENCY).toUpperCase()}`;
  }
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const sendResendEmail = async ({ toEmail, subject, text, html }) => {
  const recipient = normalizeEmail(toEmail);
  if (!recipient) {
    return {
      sent: false,
      skipped: true,
      reason: 'missing_recipient_email',
      error: 'Modtager e-mail mangler.',
    };
  }

  if (!RESEND_API_KEY || !STRIPE_SALE_LINK_FROM_EMAIL) {
    return {
      sent: false,
      skipped: true,
      reason: 'missing_email_config',
      error: 'E-mailopsætning mangler på serveren.',
    };
  }

  const payload = {
    from: STRIPE_SALE_LINK_FROM_EMAIL,
    to: [recipient],
    subject,
    text,
    html,
  };
  if (STRIPE_SALE_LINK_REPLY_TO_EMAIL) {
    payload.reply_to = STRIPE_SALE_LINK_REPLY_TO_EMAIL;
  }

  try {
    const response = await fetch(`${RESEND_API_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const responseJson = await parseJsonSafely(response);
    if (!response.ok) {
      return {
        sent: false,
        error:
          responseJson?.error ||
          responseJson?.message ||
          `E-mail kunne ikke sendes (HTTP ${response.status}).`,
      };
    }
    return {
      sent: true,
      to: recipient,
      messageId: responseJson?.id || null,
    };
  } catch (error) {
    return {
      sent: false,
      error: error?.message || 'Uventet fejl ved afsendelse af e-mail.',
    };
  }
};

const formatSaleDateTime = (value = new Date()) => {
  try {
    return new Intl.DateTimeFormat('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  } catch (_error) {
    return new Date(value).toISOString();
  }
};

const normalizeSaleItems = (items) =>
  Array.isArray(items)
    ? items
        .map((item) => ({
          name: `${item?.name || ''}`.trim(),
          quantity: Math.max(1, Math.round(Number(item?.quantity || 1) || 1)),
          price: Number(item?.price || 0) || 0,
        }))
        .filter((item) => item.name && item.price > 0)
    : [];

const toSaleItemsPlainText = (items, currency) => {
  const normalized = normalizeSaleItems(items);
  if (!normalized.length) return 'Ingen varelinjer';
  return normalized
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      return `- ${item.name} x${item.quantity}: ${formatSaleAmount(lineTotal, currency)}`;
    })
    .join('\n');
};

const toSaleItemsHtml = (items, currency) => {
  const normalized = normalizeSaleItems(items);
  if (!normalized.length) return '<li>Ingen varelinjer</li>';
  return normalized
    .map((item) => {
      const lineTotal = formatSaleAmount(item.price * item.quantity, currency);
      return `<li style="margin:0 0 6px;">${escapeHtml(item.name)} x${item.quantity}: ${escapeHtml(
        lineTotal
      )}</li>`;
    })
    .join('');
};

const sendConnectSalePaymentLinkEmail = async ({
  toEmail,
  toName,
  clinicName,
  amountLabel,
  paymentUrl,
  appointmentRef,
}) => {
  const safeName = escapeHtml(toName || 'der');
  const safeClinic = escapeHtml(clinicName || 'klinikken');
  const safeAmount = escapeHtml(amountLabel);
  const safeRef = escapeHtml(appointmentRef || '');
  const safeUrl = escapeHtml(paymentUrl);
  const subject = `Betalingslink fra ${clinicName || 'Selma+'}`;
  const text = [
    `Hej ${toName || 'der'}`,
    '',
    `Du har modtaget et betalingslink fra ${clinicName || 'din klinik'}.`,
    safeRef ? `Reference: ${appointmentRef}` : null,
    `Beløb: ${amountLabel}`,
    '',
    `Betal her: ${paymentUrl}`,
    '',
    'Linket er sikkert og udstedt via Stripe Checkout.',
  ]
    .filter(Boolean)
    .join('\n');
  const html = `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;">
  <h2 style="margin:0 0 12px;">Betalingslink</h2>
  <p style="margin:0 0 12px;">Hej ${safeName}</p>
  <p style="margin:0 0 12px;">Du har modtaget et betalingslink fra <strong>${safeClinic}</strong>.</p>
  <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc;">
    ${safeRef ? `<p style="margin:0 0 8px;"><strong>Reference:</strong> ${safeRef}</p>` : ''}
    <p style="margin:0;"><strong>Beløb:</strong> ${safeAmount}</p>
  </div>
  <p style="margin:16px 0;">
    <a href="${safeUrl}" style="display:inline-block;padding:10px 16px;border-radius:9999px;background:#0f172a;color:#fff;text-decoration:none;font-weight:600;">
      Betal nu
    </a>
  </p>
  <p style="margin:0;color:#64748b;font-size:12px;">Linket er sikkert og udstedt via Stripe Checkout.</p>
</div>
`.trim();

  return sendResendEmail({
    toEmail,
    subject,
    text,
    html,
  });
};

const sendConnectSaleReceiptEmail = async ({
  toEmail,
  toName,
  clinicName,
  appointmentRef,
  saleNumber,
  amountLabel,
  items,
  currency,
  paidAt,
}) => {
  const safeName = escapeHtml(toName || 'der');
  const safeClinic = escapeHtml(clinicName || 'klinikken');
  const safeAmount = escapeHtml(amountLabel);
  const safeAppointmentRef = escapeHtml(appointmentRef || '');
  const safeSaleNumber = escapeHtml(saleNumber || '');
  const paidAtLabel = escapeHtml(formatSaleDateTime(paidAt || new Date()));
  const subject = `Kvittering fra ${clinicName || 'Selma+'}`;
  const itemsText = toSaleItemsPlainText(items, currency);
  const itemsHtml = toSaleItemsHtml(items, currency);
  const text = [
    `Hej ${toName || 'der'}`,
    '',
    `Tak for din betaling hos ${clinicName || 'din klinik'}.`,
    safeSaleNumber ? `Kvitteringsnummer: ${saleNumber}` : null,
    safeAppointmentRef ? `Reference: ${appointmentRef}` : null,
    `Betalt: ${formatSaleDateTime(paidAt || new Date())}`,
    `Beløb: ${amountLabel}`,
    '',
    'Ydelser:',
    itemsText,
    '',
    'Denne kvittering er udstedt via SelmaPay (Stripe Express).',
  ]
    .filter(Boolean)
    .join('\n');
  const html = `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;">
  <h2 style="margin:0 0 12px;">Kvittering</h2>
  <p style="margin:0 0 12px;">Hej ${safeName}</p>
  <p style="margin:0 0 12px;">Tak for din betaling hos <strong>${safeClinic}</strong>.</p>
  <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc;">
    ${safeSaleNumber ? `<p style="margin:0 0 8px;"><strong>Kvitteringsnummer:</strong> ${safeSaleNumber}</p>` : ''}
    ${safeAppointmentRef ? `<p style="margin:0 0 8px;"><strong>Reference:</strong> ${safeAppointmentRef}</p>` : ''}
    <p style="margin:0 0 8px;"><strong>Betalt:</strong> ${paidAtLabel}</p>
    <p style="margin:0;"><strong>Beløb:</strong> ${safeAmount}</p>
  </div>
  <h3 style="margin:16px 0 8px;font-size:16px;">Ydelser</h3>
  <ul style="margin:0;padding-left:18px;">${itemsHtml}</ul>
  <p style="margin:16px 0 0;color:#64748b;font-size:12px;">Denne kvittering er udstedt via SelmaPay (Stripe Express).</p>
</div>
`.trim();

  return sendResendEmail({
    toEmail,
    subject,
    text,
    html,
  });
};

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
    process.env.REACT_APP_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];
  const resolved = candidates.find(
    (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim())
  );
  return normalizeBaseUrl(resolved || 'http://localhost:3000');
};

const toAbsoluteUrl = (req, rawValue, fallbackPath) => {
  const baseUrl = resolveBaseUrl(req);
  const value = `${rawValue || ''}`.trim();
  if (value && /^https?:\/\//i.test(value)) {
    return value;
  }
  if (value && value.startsWith('/')) {
    return `${baseUrl}${value}`;
  }
  return `${baseUrl}${fallbackPath}`;
};

const toConnectRequirementList = (value) => (Array.isArray(value) ? value : []);

const normalizeStripeConnectStatus = (stripeAccount) => {
  const requirements = stripeAccount?.requirements || {};
  const chargesEnabled = Boolean(stripeAccount?.charges_enabled);
  const payoutsEnabled = Boolean(stripeAccount?.payouts_enabled);
  const detailsSubmitted = Boolean(stripeAccount?.details_submitted);
  const currentlyDue = toConnectRequirementList(requirements.currently_due);
  const eventuallyDue = toConnectRequirementList(requirements.eventually_due);
  const pastDue = toConnectRequirementList(requirements.past_due);
  const onboardingComplete =
    chargesEnabled && payoutsEnabled && detailsSubmitted && currentlyDue.length === 0;

  return {
    accountId: stripeAccount?.id || null,
    type: stripeAccount?.type || 'express',
    country: stripeAccount?.country || STRIPE_CONNECT_COUNTRY,
    defaultCurrency: stripeAccount?.default_currency || STRIPE_CONNECT_DEFAULT_CURRENCY,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    onboardingComplete,
    requirementsCurrentlyDue: currentlyDue,
    requirementsEventuallyDue: eventuallyDue,
    requirementsPastDue: pastDue,
    disabledReason: requirements.disabled_reason || null,
    paymentMethods: STRIPE_CONNECT_PAYMENT_METHODS,
  };
};

const buildStripeConnectAccountFields = (connectStatus) => ({
  stripeConnect: {
    ...connectStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  stripeConnectAccountId: connectStatus?.accountId || null,
  paymentSetupStatus: connectStatus?.onboardingComplete ? 'active' : 'pending',
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const buildStripeConnectClinicFields = (connectStatus) => ({
  stripeAccountId: connectStatus?.accountId || null,
  stripeStatus: {
    charges_enabled: Boolean(connectStatus?.chargesEnabled),
    payouts_enabled: Boolean(connectStatus?.payoutsEnabled),
    details_submitted: Boolean(connectStatus?.detailsSubmitted),
  },
  stripeConnect: {
    ...connectStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

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

const createCheckoutSession = async ({
  plan,
  priceId,
  accountId,
  uid,
  stripeCustomerId,
  req,
}) => {
  const baseUrl = resolveBaseUrl(req);
  const metadata = buildCheckoutMetadata({ accountId, plan, uid });
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer: stripeCustomerId || undefined,
    client_reference_id: uid || undefined,
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

const getStripeConnectAccountId = ({ clinic, account }) =>
  clinic?.stripeAccountId ||
  clinic?.stripeConnect?.accountId ||
  account?.stripeConnect?.accountId ||
  account?.stripeConnectAccountId ||
  null;

const resolveUserAccountContext = async (uid, { ensureForOwner = false } = {}) => {
  const userDoc = await getUserById(uid);
  if (!userDoc) return { userDoc: null, account: null, accountId: null, role: 'owner' };

  let accountId = userDoc.accountId || null;
  let role = userDoc.role || 'owner';
  if (!accountId && ensureForOwner && role === 'owner') {
    const ensured = await ensureAccountForUser({
      uid,
      email: userDoc.email || null,
      displayName: userDoc.displayName || null,
    });
    accountId = ensured.accountId;
    role = 'owner';
  }

  const account = accountId ? await getAccountById(accountId) : null;
  return { userDoc, account, accountId, role };
};

const pickFirstString = (...candidates) => {
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return match ? match.trim() : '';
};

const resolveClinicSlug = ({ clinic, account, userDoc, clinicId, accountId }) =>
  pickFirstString(
    clinic?.slug,
    clinic?.clinicSlug,
    clinic?.publicBooking?.slug,
    clinic?.name,
    account?.slug,
    account?.clinicSlug,
    account?.clinic?.slug,
    account?.publicBooking?.slug,
    userDoc?.clinicSlug,
    userDoc?.publicBookingSlug,
    userDoc?.slug,
    clinicId,
    accountId
  );

const logConnectAudit = ({ action, uid, clinicId, accountId, clinicSlug, source }) => {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[stripe][connect-audit]', {
    action,
    uid: uid || null,
    clinic: clinicSlug || clinicId || accountId || null,
    clinicId: clinicId || null,
    accountId: accountId || null,
    source: source || 'unknown',
  });
};

const resolveUserClinicContext = async (uid) => {
  const userDoc = await getUserById(uid);
  if (!userDoc) {
    return {
      userDoc: null,
      clinic: null,
      clinicId: null,
      account: null,
      accountId: null,
      role: 'owner',
      source: 'missing_user',
    };
  }

  const accountId = userDoc.accountId || null;
  const account = accountId ? await getAccountById(accountId) : null;
  let clinicId = `${userDoc.activeClinicId || ''}`.trim() || null;
  let source = clinicId ? 'user.activeClinicId' : 'bootstrap';

  if (!clinicId) {
    clinicId = await getActiveClinicId(uid);
  }

  let clinic = clinicId ? await getClinicById(clinicId) : null;
  if (!clinic) {
    const repairedClinicId = await getActiveClinicId(uid);
    if (repairedClinicId && repairedClinicId !== clinicId) {
      clinicId = repairedClinicId;
      source = 'repaired.activeClinicId';
    }
    clinic = clinicId ? await getClinicById(clinicId) : null;
  }

  // Legacy fallback path: if clinic bootstrap failed, use accountId until repaired.
  if (!clinic && !clinicId && accountId) {
    clinicId = accountId;
    source = 'legacy.accountId';
    clinic = await getClinicById(clinicId);
  }

  if (!clinic && clinicId) {
    source = source === 'bootstrap' ? 'bootstrap_missing_doc' : source;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[stripe] resolved clinic context', {
      uid,
      clinicId: clinicId || null,
      accountId: accountId || null,
      source,
    });
  }

  return {
    userDoc,
    clinic,
    clinicId,
    account,
    accountId,
    role: userDoc.role || 'owner',
    source,
  };
};

const hasClinicAccess = async ({ uid, clinicId, context }) => {
  const normalizedClinicId = `${clinicId || ''}`.trim();
  if (!uid || !normalizedClinicId) return false;

  if (
    normalizedClinicId === `${context?.clinicId || ''}`.trim() ||
    normalizedClinicId === `${context?.accountId || ''}`.trim()
  ) {
    return true;
  }

  const db = getFirestore();
  const [clinicMemberSnap, accountMemberSnap, clinicSnap] = await Promise.all([
    db.collection('clinics').doc(normalizedClinicId).collection('members').doc(uid).get(),
    db.collection('accounts').doc(normalizedClinicId).collection('members').doc(uid).get(),
    db.collection('clinics').doc(normalizedClinicId).get(),
  ]);

  if (clinicMemberSnap.exists || accountMemberSnap.exists) return true;
  const clinicData = clinicSnap.exists ? clinicSnap.data() || {} : {};
  return `${clinicData?.ownerUid || ''}`.trim() === uid;
};

const createStripeConnectExpressAccount = async ({ clinicId, accountId, uid, email }) => {
  return stripe.accounts.create({
    type: 'express',
    country: STRIPE_CONNECT_COUNTRY,
    email: email || undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      clinicId: clinicId || '',
      accountId: accountId || clinicId || '',
      ownerUid: uid || '',
    },
  });
};

const syncStripeConnectStatus = async ({ clinicId, accountId, stripeConnectAccountId }) => {
  if (!stripeConnectAccountId) return null;
  const stripeAccount = await stripe.accounts.retrieve(stripeConnectAccountId);
  const connectStatus = normalizeStripeConnectStatus(stripeAccount);
  if (clinicId) {
    await setClinicFields(clinicId, buildStripeConnectClinicFields(connectStatus));
  }
  if (accountId) {
    // Legacy mirror to avoid breaking existing reads during migration.
    await setAccountFields(accountId, buildStripeConnectAccountFields(connectStatus));
  }
  return connectStatus;
};

const resolveConnectContextByStripeAccountId = async (stripeConnectAccountId) => {
  const normalizedAccountId = `${stripeConnectAccountId || ''}`.trim();
  if (!normalizedAccountId) {
    return { clinicId: null, accountId: null, source: 'missing_account' };
  }

  const db = getFirestore();
  const [clinicSnap, accountSnap] = await Promise.all([
    db.collection('clinics').where('stripeAccountId', '==', normalizedAccountId).limit(1).get(),
    db.collection('accounts').where('stripeConnectAccountId', '==', normalizedAccountId).limit(1).get(),
  ]);

  let clinicId = clinicSnap.empty ? null : clinicSnap.docs[0].id;
  const accountId = accountSnap.empty ? null : accountSnap.docs[0].id;
  let source = clinicId ? 'clinics.stripeAccountId' : accountId ? 'accounts.stripeConnectAccountId' : 'not_found';

  if (!clinicId && accountId) {
    const legacyAccount = await getAccountById(accountId);
    const ownerUid = `${legacyAccount?.ownerUid || ''}`.trim() || null;
    if (ownerUid) {
      const repairedClinicId = await getActiveClinicId(ownerUid);
      if (repairedClinicId) {
        clinicId = repairedClinicId;
        source = 'repaired.from_owner_activeClinicId';
      }
    }
  }

  return { clinicId, accountId, source };
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toAmountMinor = (value) => Math.max(0, Math.round(toNumber(value) * 100));

const normalizeCheckoutCurrency = (value) => {
  const normalized = `${value || STRIPE_CONNECT_DEFAULT_CURRENCY}`.trim().toLowerCase();
  if (!normalized || normalized.length !== 3) {
    return STRIPE_CONNECT_DEFAULT_CURRENCY;
  }
  return normalized;
};

const normalizeConnectCheckoutPaymentMethods = (value, fallbackTypes = ['card']) => {
  const fallback = Array.isArray(fallbackTypes) ? fallbackTypes : ['card'];
  const accepted = new Set(STRIPE_CONNECT_CHECKOUT_METHOD_TYPES);
  const aliases = {
    apple_pay: 'card',
    google_pay: 'card',
  };
  const rawList = Array.isArray(value) ? value : fallback;
  const resolved = [];

  rawList.forEach((entry) => {
    const raw = `${entry || ''}`.trim().toLowerCase();
    if (!raw) return;
    const mapped = aliases[raw] || raw;
    if (accepted.has(mapped) && !resolved.includes(mapped)) {
      resolved.push(mapped);
    }
  });

  if (resolved.length) return resolved;
  if (fallback.includes('mobilepay')) return ['card', 'mobilepay'];
  return ['card'];
};

const resolveConnectSalePaymentMethods = ({ paymentMethodId, requestedTypes }) => {
  const methodId = `${paymentMethodId || ''}`.trim().toLowerCase();
  const fallbackTypes =
    methodId === 'qr' || methodId === 'selvbetjening'
      ? ['card', 'mobilepay']
      : ['card'];
  return normalizeConnectCheckoutPaymentMethods(requestedTypes, fallbackTypes);
};

const sanitizeCheckoutLineItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const name = `${item?.name || ''}`.trim();
      const quantity = Math.max(1, Math.round(toNumber(item?.quantity || 1)));
      const price = toNumber(item?.price);
      if (!name || price <= 0) return null;
      return {
        name: name.slice(0, 120),
        quantity,
        price,
        type: `${item?.type || ''}`.trim() || 'service',
        referenceId: `${item?.referenceId || ''}`.trim() || null,
        duration: `${item?.duration || ''}`.trim() || '',
        owner: `${item?.owner || ''}`.trim() || '',
        color: `${item?.color || ''}`.trim() || '',
      };
    })
    .filter(Boolean);
};

const computeSaleTotals = (items, rawTotals = {}) => {
  const subtotal = items.reduce(
    (sum, item) => sum + toNumber(item?.price) * Math.max(1, Math.round(toNumber(item?.quantity || 1))),
    0
  );
  const vat = Math.max(0, toNumber(rawTotals?.vat));
  const totalFromClient = toNumber(rawTotals?.total);
  const minimumTotal = subtotal + vat;
  const total = totalFromClient > 0 ? Math.max(totalFromClient, minimumTotal) : minimumTotal;

  return {
    subtotal,
    vat,
    total,
  };
};

const buildCheckoutLineItems = (items, currency) =>
  items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency,
      unit_amount: toAmountMinor(item.price),
      product_data: {
        name: item.name,
      },
    },
  }));

const fetchPendingSaleRef = (accountId, sessionId) =>
  getFirestore().collection('accounts').doc(accountId).collection('pendingSales').doc(sessionId);

const fetchPendingSaleLookupRef = (sessionId) =>
  getFirestore().collection('stripeConnectSaleSessions').doc(sessionId);

const mapPendingSaleToStripeMetadata = (payload = {}) => ({
  flow: 'connect_sale',
  clinicId: payload.accountId || '',
  accountId: payload.accountId || '',
  ownerUid: payload.ownerUid || '',
  patientId: payload.customerId || '',
  therapistId: payload.employeeId || '',
  employeeId: payload.employeeId || '',
  employeeName: `${payload.employeeName || ''}`.slice(0, 120),
  appointmentId: payload.appointmentId || '',
  serviceId: payload.items?.[0]?.referenceId || '',
  appointmentRef: `${payload.appointmentRef || ''}`.slice(0, 120),
  paymentMethodId: payload.paymentMethodId || '',
  paymentMethodLabel: `${payload.paymentMethodLabel || ''}`.slice(0, 120),
  saleTotal: `${toNumber(payload?.totals?.total) || ''}`,
  currency: `${payload.currency || STRIPE_CONNECT_DEFAULT_CURRENCY}`.toLowerCase(),
});

const persistPendingSale = async ({
  accountId,
  session,
  stripeConnectAccountId,
  payload,
}) => {
  const db = getFirestore();
  const pendingRef = fetchPendingSaleRef(accountId, session.id);
  const lookupRef = fetchPendingSaleLookupRef(session.id);
  await pendingRef.set(
    {
      kind: 'connect_checkout_sale',
      status: 'created',
      accountId,
      ownerUid: payload.ownerUid,
      employeeId: payload.employeeId,
      employeeName: payload.employeeName,
      stripeConnectAccountId,
      checkoutSessionId: session.id,
      checkoutUrl: session.url || null,
      appointmentId: payload.appointmentId || null,
      appointmentRef: payload.appointmentRef || null,
      customer: {
        id: payload.customerId || null,
        name: payload.customerName || '',
        email: payload.customerEmail || '',
        phone: payload.customerPhone || '',
      },
      location: payload.location || '',
      items: payload.items,
      totals: payload.totals,
      currency: payload.currency,
      paymentMethod: {
        id: payload.paymentMethodId,
        label: payload.paymentMethodLabel,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await lookupRef.set(
    {
      accountId,
      ownerUid: payload.ownerUid || null,
      stripeConnectAccountId: stripeConnectAccountId || null,
      checkoutSessionId: session.id,
      pendingSalePath: pendingRef.path,
      paymentStatus: 'created',
      appointmentRef: payload.appointmentRef || null,
      customerName: payload.customerName || '',
      customerEmail: payload.customerEmail || '',
      totals: payload.totals || null,
      currency: payload.currency || STRIPE_CONNECT_DEFAULT_CURRENCY,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

const toSalePayloadFromPending = ({ pendingData, session, connectedAccountId }) => {
  const items = Array.isArray(pendingData?.items) ? pendingData.items : [];
  const computedSubtotal = items.reduce(
    (sum, item) => sum + toNumber(item?.price) * Math.max(1, Math.round(toNumber(item?.quantity || 1))),
    0
  );
  const totals = pendingData?.totals || {};
  const metadataTotal = toNumber(session?.metadata?.saleTotal);
  const total =
    toNumber(totals.total) > 0 ? toNumber(totals.total) : toNumber(session?.amount_total) / 100;
  const resolvedTotal = total > 0 ? total : metadataTotal;
  const subtotal =
    toNumber(totals.subtotal) > 0 ? toNumber(totals.subtotal) : computedSubtotal || resolvedTotal;
  const vat = toNumber(totals.vat);
  const paymentMethodLabel =
    pendingData?.paymentMethod?.label || session?.metadata?.paymentMethodLabel || 'Kort';
  const stripePaymentIntentId =
    typeof session?.payment_intent === 'string'
      ? session.payment_intent
      : session?.payment_intent?.id || null;

  return {
    status: 'completed',
    paymentStatus: 'paid',
    paymentId: stripePaymentIntentId || null,
    appointmentId: pendingData?.appointmentId || null,
    appointmentRef: pendingData?.appointmentRef || null,
    customerId: pendingData?.customer?.id || null,
    customerName: pendingData?.customer?.name || '',
    customerEmail: pendingData?.customer?.email || '',
    customerPhone: pendingData?.customer?.phone || '',
    items,
    totals: {
      subtotal,
      vat,
      total: resolvedTotal,
    },
    paymentMethod: paymentMethodLabel,
    paymentProvider: 'stripeConnect',
    employeeId: pendingData?.employeeId || session?.metadata?.employeeId || null,
    employeeName:
      pendingData?.employeeName ||
      session?.metadata?.employeeName ||
      pendingData?.ownerUid ||
      'Medarbejder',
    location: pendingData?.location || '',
    stripeCheckoutSessionId: session?.id || null,
    stripePaymentIntentId,
    stripeConnectedAccountId: connectedAccountId || null,
    currency: `${session?.currency || pendingData?.currency || session?.metadata?.currency || 'dkk'}`.toLowerCase(),
    saleNumber:
      pendingData?.appointmentRef ||
      `${session?.id || ''}`.replace(/^cs_(test|live)_/i, '').slice(0, 12) ||
      null,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const resolveConnectSaleClinicName = async ({ accountId, ownerUid }) => {
  let clinic = accountId ? await getClinicById(accountId) : null;
  let account = accountId ? await getAccountById(accountId) : null;

  if (!clinic && ownerUid) {
    const activeClinicId = await getActiveClinicId(ownerUid);
    if (activeClinicId) {
      clinic = await getClinicById(activeClinicId);
      if (!account) {
        account = await getAccountById(activeClinicId);
      }
    }
  }

  return pickFirstString(
    clinic?.name,
    clinic?.clinicName,
    account?.clinicName,
    account?.name,
    'Selma+'
  );
};

const upsertConnectSaleInAppNotification = async ({
  db,
  ownerUid,
  sessionId,
  saleId,
  accountId,
  appointmentId,
  appointmentRef,
  customerName,
  amountLabel,
  currency,
}) => {
  if (!ownerUid || !sessionId) return false;
  const notificationRef = db
    .collection('users')
    .doc(ownerUid)
    .collection('notifications')
    .doc(`payment_${sessionId}`);

  await notificationRef.set(
    {
      type: 'payment_received',
      status: 'unread',
      title: 'Betaling modtaget',
      message: `${customerName || 'Patient'} har betalt ${amountLabel}.`,
      saleId: saleId || null,
      accountId: accountId || null,
      appointmentId: appointmentId || null,
      appointmentRef: appointmentRef || null,
      customerName: customerName || '',
      amountLabel,
      currency: `${currency || STRIPE_CONNECT_DEFAULT_CURRENCY}`.toLowerCase(),
      actionPath: '/booking/fakturaer/salg',
      readAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return true;
};

const runConnectSalePostProcessing = async ({
  db,
  pendingRef,
  pendingData,
  session,
  saleId,
  accountId,
  ownerUid,
  clinicId,
}) => {
  const sessionId = `${session?.id || ''}`.trim();
  if (!sessionId || !ownerUid) return;

  const currency = `${session?.currency || pendingData?.currency || STRIPE_CONNECT_DEFAULT_CURRENCY}`.toLowerCase();
  const totalAmount = toNumber(pendingData?.totals?.total) || toNumber(session?.amount_total) / 100;
  const amountLabel = formatSaleAmount(totalAmount, currency);
  const appointmentRef = `${pendingData?.appointmentRef || ''}`.trim();
  const customerName = `${pendingData?.customer?.name || ''}`.trim();

  if (!pendingData?.paymentNotificationCreatedAt) {
    try {
      const created = await upsertConnectSaleInAppNotification({
        db,
        ownerUid,
        sessionId,
        saleId,
        accountId,
        appointmentId: pendingData?.appointmentId || null,
        appointmentRef,
        customerName,
        amountLabel,
        currency,
      });
      if (created) {
        await pendingRef.set(
          {
            paymentNotificationCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (notificationError) {
      console.warn('[stripe] could not create in-app payment notification', {
        sessionId,
        ownerUid,
        error: notificationError?.message || notificationError,
      });
    }
  }

  try {
    const receiptSyncResult = await syncPaymentReceiptForSale({
      stripe,
      connectedAccountId: session?.account || pendingData?.stripeConnectAccountId || null,
      session,
      pendingData,
      accountId,
      ownerUid,
      saleId,
    });

    const paymentId = `${receiptSyncResult?.paymentId || ''}`.trim() || null;
    const receiptNumber = `${receiptSyncResult?.receiptNumber || ''}`.trim() || null;
    const receiptPdfPath = `${receiptSyncResult?.receiptPdfPath || ''}`.trim() || null;
    const receiptEmailStatus = `${receiptSyncResult?.receiptEmailStatus || ''}`.trim() || 'not_sent';
    const stripeChargeId = `${receiptSyncResult?.stripeChargeId || ''}`.trim() || null;
    const customerEmail = normalizeEmail(pendingData?.customer?.email || '');

    await pendingRef.set(
      {
        paymentId,
        receiptNumber,
        receiptPdfPath,
        receiptEmailStatus,
        stripeChargeId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (saleId && (clinicId || ownerUid)) {
      const saleRef = clinicId
        ? db.collection('clinics').doc(clinicId).collection('sales').doc(saleId)
        : db.collection('users').doc(ownerUid).collection('sales').doc(saleId);
      await saleRef.set(
        {
          paymentId,
          paymentStatus: 'paid',
          receiptNumber,
          receiptPdfPath,
          receiptEmailStatus,
          stripeChargeId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const emailResult = receiptSyncResult?.email || null;
    if (emailResult?.sent) {
      await pendingRef.set(
        {
          patientReceiptEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          patientReceiptEmailTo: emailResult.to || customerEmail || null,
          patientReceiptEmailError: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (emailResult?.error) {
      await pendingRef.set(
        {
          patientReceiptEmailError: `${emailResult.error}`.slice(0, 400),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (receiptError) {
    await pendingRef.set(
      {
        patientReceiptEmailError: `${receiptError?.message || receiptError}`.slice(0, 400),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.warn('[stripe] connect sale receipt sync failed', {
      sessionId,
      accountId,
      ownerUid,
      appointmentRef: appointmentRef || null,
      amountLabel,
      customerName: customerName || null,
      error: receiptError?.message || receiptError,
    });
  }
};

const upsertSaleFromCheckoutSession = async ({ session, connectedAccountId = null }) => {
  const metadata = session?.metadata || {};
  const flow = `${metadata?.flow || ''}`.trim();
  if (flow !== 'connect_sale') return;

  const accountId = `${metadata?.accountId || ''}`.trim();
  const clinicIdFromMeta = `${metadata?.clinicId || ''}`.trim();
  const ownerUid = `${metadata?.ownerUid || ''}`.trim();
  const sessionId = `${session?.id || ''}`.trim();
  if (!accountId || !ownerUid || !sessionId) {
    console.warn('[stripe] missing connect sale metadata', { accountId, ownerUid, sessionId });
    return;
  }

  const db = getFirestore();
  const pendingRef = fetchPendingSaleRef(accountId, sessionId);
  const lookupRef = fetchPendingSaleLookupRef(sessionId);
  const pendingSnap = await pendingRef.get();
  const pendingData = pendingSnap.exists ? pendingSnap.data() || {} : {};
  if (pendingData?.status === 'processed' && pendingData?.saleId) {
    await runConnectSalePostProcessing({
      db,
      pendingRef,
      pendingData,
      session,
      saleId: pendingData.saleId,
      accountId,
      ownerUid,
      clinicId: `${clinicIdFromMeta || pendingData?.accountId || accountId || ''}`.trim() || null,
    });
    return;
  }

  const salePayload = toSalePayloadFromPending({
    pendingData,
    session,
    connectedAccountId: connectedAccountId || session?.account || null,
  });
  const clinicId = `${clinicIdFromMeta || pendingData?.accountId || accountId || ''}`.trim() || null;
  if (clinicId) {
    salePayload.clinicId = clinicId;
  }

  const saleRef = clinicId
    ? db.collection('clinics').doc(clinicId).collection('sales').doc()
    : db.collection('users').doc(ownerUid).collection('sales').doc();
  await saleRef.set(salePayload, { merge: true });

  const appointmentId = pendingData?.appointmentId || null;
  if (appointmentId) {
    const appointmentRef = clinicId
      ? db.collection('clinics').doc(clinicId).collection('appointments').doc(appointmentId)
      : db.collection('users').doc(ownerUid).collection('appointments').doc(appointmentId);
    await appointmentRef.set(
      {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await pendingRef.set(
    {
      status: 'processed',
      saleId: saleRef.id,
      stripePaymentIntentId:
        typeof session?.payment_intent === 'string'
          ? session.payment_intent
          : session?.payment_intent?.id || null,
      stripeConnectedAccountId: connectedAccountId || session?.account || null,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await lookupRef.set(
    {
      accountId,
      ownerUid,
      clinicId,
      saleId: saleRef.id,
      stripePaymentIntentId:
        typeof session?.payment_intent === 'string'
          ? session.payment_intent
          : session?.payment_intent?.id || null,
      stripeConnectAccountId: connectedAccountId || session?.account || null,
      paymentStatus: 'processed',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await runConnectSalePostProcessing({
    db,
    pendingRef,
    pendingData: {
      ...pendingData,
      status: 'processed',
      saleId: saleRef.id,
    },
    session,
    saleId: saleRef.id,
    accountId,
    ownerUid,
    clinicId,
  });
};

const markPendingSaleFailed = async ({ session, reason = null, connectedAccountId = null }) => {
  const metadata = session?.metadata || {};
  const flow = `${metadata?.flow || ''}`.trim();
  if (flow !== 'connect_sale') return;

  const accountId = `${metadata?.accountId || ''}`.trim();
  const sessionId = `${session?.id || ''}`.trim();
  if (!accountId || !sessionId) return;

  const pendingRef = fetchPendingSaleRef(accountId, sessionId);
  const lookupRef = fetchPendingSaleLookupRef(sessionId);
  await pendingRef.set(
    {
      status: 'failed',
      failureReason: reason || 'payment_failed',
      stripeConnectedAccountId: connectedAccountId || session?.account || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await lookupRef.set(
    {
      accountId,
      ownerUid: `${metadata?.ownerUid || ''}`.trim() || null,
      stripeConnectAccountId: connectedAccountId || session?.account || null,
      paymentStatus: 'failed',
      failureReason: reason || 'payment_failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

const retrieveConnectCheckoutSession = async ({ stripeConnectAccountId, sessionId }) =>
  stripe.checkout.sessions.retrieve(
    sessionId,
    { expand: ['payment_intent'] },
    { stripeAccount: stripeConnectAccountId }
  );

const findPendingSaleBySessionId = async (sessionId) => {
  if (!sessionId) return null;
  const db = getFirestore();
  const lookupRef = fetchPendingSaleLookupRef(sessionId);
  const lookupSnap = await lookupRef.get();
  const lookupData = lookupSnap.exists ? lookupSnap.data() || {} : {};
  const lookupAccountId = `${lookupData?.accountId || ''}`.trim() || null;
  const lookupPath = `${lookupData?.pendingSalePath || ''}`.trim() || null;

  if (lookupPath) {
    const pendingRef = db.doc(lookupPath);
    const pendingSnap = await pendingRef.get();
    if (pendingSnap.exists) {
      return {
        ref: pendingRef,
        data: pendingSnap.data() || {},
        accountId: lookupAccountId,
        lookupRef,
        lookupData,
      };
    }
  }

  if (lookupAccountId) {
    const pendingRef = fetchPendingSaleRef(lookupAccountId, sessionId);
    const pendingSnap = await pendingRef.get();
    if (pendingSnap.exists) {
      return {
        ref: pendingRef,
        data: pendingSnap.data() || {},
        accountId: lookupAccountId,
        lookupRef,
        lookupData,
      };
    }
  }

  if (lookupSnap.exists) {
    return {
      ref: null,
      data: null,
      accountId: lookupAccountId,
      lookupRef,
      lookupData,
    };
  }

  // Legacy fallback for sessions created before lookup docs were introduced.
  // This runs only when lookup is missing, then backfills lookup for future requests.
  const candidateIds = new Set();
  const [accountSnap, clinicSnap] = await Promise.all([
    db.collection('accounts').get(),
    db.collection('clinics').get(),
  ]);
  accountSnap.docs.forEach((docSnap) => candidateIds.add(docSnap.id));
  clinicSnap.docs.forEach((docSnap) => candidateIds.add(docSnap.id));

  for (const candidateId of candidateIds) {
    const pendingRef = fetchPendingSaleRef(candidateId, sessionId);
    // eslint-disable-next-line no-await-in-loop
    const pendingSnap = await pendingRef.get();
    if (!pendingSnap.exists) continue;
    const data = pendingSnap.data() || {};
    const backfillData = {
      accountId: candidateId,
      ownerUid: data?.ownerUid || null,
      stripeConnectAccountId: data?.stripeConnectAccountId || null,
      checkoutSessionId: sessionId,
      pendingSalePath: pendingRef.path,
      paymentStatus: data?.status || 'created',
      appointmentRef: data?.appointmentRef || null,
      customerName: data?.customer?.name || '',
      customerEmail: data?.customer?.email || '',
      totals: data?.totals || null,
      currency: data?.currency || STRIPE_CONNECT_DEFAULT_CURRENCY,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: data?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    };
    await lookupRef.set(backfillData, { merge: true });
    return {
      ref: pendingRef,
      data,
      accountId: candidateId,
      lookupRef,
      lookupData: backfillData,
    };
  }
  return null;
};

router.get('/connect/public-sale-receipt', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const sessionId = `${req.query?.session_id || req.query?.sessionId || ''}`.trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'Mangler Stripe session ID.' });
    }

    const pending = await findPendingSaleBySessionId(sessionId);
    if (!pending) {
      return res.status(404).json({ error: 'Kvittering blev ikke fundet.' });
    }

    let pendingData = pending.data || {};
    const lookupData = pending.lookupData || {};
    const stripeConnectAccountId =
      `${pendingData?.stripeConnectAccountId || lookupData?.stripeConnectAccountId || ''}`.trim() ||
      null;
    let session;
    try {
      session = stripeConnectAccountId
        ? await retrieveConnectCheckoutSession({ stripeConnectAccountId, sessionId })
        : await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
    } catch (error) {
      return res.status(404).json({ error: 'Kunne ikke hente betalingsstatus hos Stripe.' });
    }

    const paymentStatus = `${session?.payment_status || ''}`.trim().toLowerCase();
    const sessionStatus = `${session?.status || ''}`.trim().toLowerCase();
    const paid =
      paymentStatus === 'paid' || (sessionStatus === 'complete' && toNumber(session?.amount_total) === 0);

    if (paid) {
      await upsertSaleFromCheckoutSession({
        session,
        connectedAccountId: stripeConnectAccountId || session?.account || null,
      });
      const refreshedPending = await findPendingSaleBySessionId(sessionId);
      if (refreshedPending?.data) {
        pendingData = refreshedPending.data;
      }
    }

    const currency = `${session?.currency || pendingData?.currency || lookupData?.currency || STRIPE_CONNECT_DEFAULT_CURRENCY}`.toLowerCase();
    const amount =
      toNumber(pendingData?.totals?.total) ||
      toNumber(lookupData?.totals?.total) ||
      toNumber(session?.amount_total) / 100;

    return res.json({
      ok: true,
      paid,
      paymentStatus: session?.payment_status || null,
      sessionStatus: session?.status || null,
      receipt: {
        sessionId,
        amount,
        amountLabel: formatSaleAmount(amount, currency),
        currency,
        customerName: pendingData?.customer?.name || lookupData?.customerName || '',
        appointmentRef: pendingData?.appointmentRef || lookupData?.appointmentRef || '',
        saleId: pendingData?.saleId || lookupData?.saleId || null,
        saleSynced: pendingData?.status === 'processed',
        receiptEmailSent: Boolean(pendingData?.patientReceiptEmailSentAt),
        receiptEmailError: `${pendingData?.patientReceiptEmailError || ''}`.trim() || null,
      },
    });
  } catch (error) {
    console.error('[stripe] public sale receipt error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

router.get('/connect/status', verifyFirebaseToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const { userDoc, clinic, clinicId, account, accountId, role } = await resolveUserClinicContext(uid);
    if (!userDoc) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    if (!clinicId) {
      return res.status(400).json({ error: 'Klinik/tenant kunne ikke findes for brugerens session.' });
    }

    const stripeConnectAccountId = getStripeConnectAccountId({ clinic, account });
    if (!stripeConnectAccountId) {
      return res.json({
        ok: true,
        isOwner: role === 'owner',
        accountId: clinicId || accountId || null,
        clinicId: clinicId || null,
        hasConnectAccount: false,
        connect: null,
      });
    }

    const connectStatus = await syncStripeConnectStatus({
      clinicId,
      accountId,
      stripeConnectAccountId,
    });

    return res.json({
      ok: true,
      isOwner: role === 'owner',
      accountId: clinicId || accountId || null,
      clinicId: clinicId || null,
      hasConnectAccount: true,
      connect: connectStatus,
    });
  } catch (error) {
    console.error('[stripe] connect status error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

router.post('/connect/create-onboarding-link', verifyFirebaseToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const { userDoc, clinic, clinicId, account, accountId, role, source } = await resolveUserClinicContext(
      uid
    );
    if (!userDoc) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    if (!clinicId) {
      return res
        .status(400)
        .json({ error: 'Klinik/tenant kunne ikke findes for brugerens session.' });
    }
    const clinicSlug = resolveClinicSlug({ clinic, account, userDoc, clinicId, accountId });
    logConnectAudit({ action: 'create_onboarding_link', uid, clinicId, accountId, clinicSlug, source });

    let stripeConnectAccountId = getStripeConnectAccountId({ clinic, account });
    if (!stripeConnectAccountId) {
      const created = await createStripeConnectExpressAccount({
        clinicId,
        accountId,
        uid,
        email: userDoc.email || clinic?.email || account?.email || null,
      });
      stripeConnectAccountId = created?.id || null;
      if (!stripeConnectAccountId) {
        throw new Error('Stripe Connect account kunne ikke oprettes.');
      }
      await setClinicFields(clinicId, {
        stripeAccountId: stripeConnectAccountId,
        stripeConnect: {
          accountId: stripeConnectAccountId,
          type: 'express',
          country: STRIPE_CONNECT_COUNTRY,
          defaultCurrency: STRIPE_CONNECT_DEFAULT_CURRENCY,
          paymentMethods: STRIPE_CONNECT_PAYMENT_METHODS,
          onboardingComplete: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        paymentSetupStatus: 'pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (accountId) {
        await setAccountFields(accountId, {
          stripeConnectAccountId,
          paymentSetupStatus: 'pending',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    const connectStatus = await syncStripeConnectStatus({
      clinicId,
      accountId,
      stripeConnectAccountId,
    });

    const returnUrl = toAbsoluteUrl(
      req,
      req.body?.return_url || req.body?.returnUrl,
      STRIPE_CONNECT_DEFAULT_RETURN_URL
    );
    const refreshUrl = toAbsoluteUrl(
      req,
      req.body?.refresh_url || req.body?.refreshUrl,
      STRIPE_CONNECT_DEFAULT_REFRESH_URL
    );

    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
      collection_options: {
        fields: STRIPE_CONNECT_ONBOARDING_FIELDS,
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.info('[stripe] onboarding link created', {
        uid,
        clinicId,
        accountId,
        stripeConnectAccountId,
        fields: STRIPE_CONNECT_ONBOARDING_FIELDS,
        returnUrl,
        refreshUrl,
      });
    }

    return res.json({
      ok: true,
      url: accountLink?.url || null,
      isOwner: role === 'owner',
      accountId: clinicId || accountId || null,
      clinicId: clinicId || null,
      hasConnectAccount: true,
      connect: connectStatus,
    });
  } catch (error) {
    console.error('[stripe] create onboarding link error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

router.post('/connect/create-dashboard-link', verifyFirebaseToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const { userDoc, clinic, clinicId, account, accountId, role, source } = await resolveUserClinicContext(
      uid
    );
    if (!userDoc) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    if (!clinicId) {
      return res
        .status(400)
        .json({ error: 'Klinik/tenant kunne ikke findes for brugerens session.' });
    }
    const clinicSlug = resolveClinicSlug({ clinic, account, userDoc, clinicId, accountId });
    logConnectAudit({ action: 'create_dashboard_link', uid, clinicId, accountId, clinicSlug, source });

    const stripeConnectAccountId = getStripeConnectAccountId({ clinic, account });
    if (!stripeConnectAccountId) {
      return res.status(400).json({ error: 'Betalinger er ikke aktiveret endnu.' });
    }

    const loginLink = await stripe.accounts.createLoginLink(stripeConnectAccountId);
    const connectStatus = await syncStripeConnectStatus({
      clinicId,
      accountId,
      stripeConnectAccountId,
    });

    return res.json({
      ok: true,
      url: loginLink?.url || null,
      isOwner: role === 'owner',
      accountId: clinicId || accountId || null,
      clinicId: clinicId || null,
      hasConnectAccount: true,
      connect: connectStatus,
    });
  } catch (error) {
    console.error('[stripe] create dashboard link error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

router.post('/connect/create-sale-checkout-session', verifyFirebaseToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const { uid, displayName, email } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const { userDoc, clinic, clinicId, account, accountId, source } = await resolveUserClinicContext(uid);
    if (!userDoc) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    if (!clinicId && !accountId) {
      return res.status(400).json({ error: 'Klinik/tenant kunne ikke findes for brugerens session.' });
    }
    const resolvedAccountId = accountId || clinicId;

    const clinicSlug = resolveClinicSlug({ clinic, account, userDoc, clinicId, accountId: resolvedAccountId });
    logConnectAudit({
      action: 'create_sale_checkout_session',
      uid,
      clinicId,
      accountId: resolvedAccountId,
      clinicSlug,
      source,
    });

    const stripeConnectAccountId = getStripeConnectAccountId({ clinic, account });
    if (!stripeConnectAccountId) {
      return res.status(409).json({
        error: 'Betalinger er ikke aktiveret. Aktivér Stripe Connect først.',
        requiresConnect: true,
      });
    }

    const connectStatus = await syncStripeConnectStatus({
      clinicId,
      accountId: resolvedAccountId,
      stripeConnectAccountId,
    });
    if (!connectStatus?.onboardingComplete) {
      return res.status(409).json({
        error: 'Stripe onboarding er ikke færdig endnu.',
        requiresConnect: true,
        connect: connectStatus,
      });
    }

    const currency = normalizeCheckoutCurrency(req.body?.currency);
    const items = sanitizeCheckoutLineItems(req.body?.items);
    if (!items.length) {
      return res.status(400).json({ error: 'Manglende gyldige salgslinjer.' });
    }
    const totals = computeSaleTotals(items, req.body?.totals || {});

    const appointmentId = `${req.body?.appointmentId || ''}`.trim() || null;
    const appointmentRef = `${req.body?.appointmentRef || ''}`.trim() || null;
    const customerName = `${req.body?.customerName || ''}`.trim();
    const customerEmail = normalizeEmail(req.body?.customerEmail || '');
    const customerPhone = `${req.body?.customerPhone || ''}`.trim();
    const customerId = `${req.body?.customerId || ''}`.trim() || null;
    const location = `${req.body?.location || ''}`.trim();

    const paymentMethodId =
      `${req.body?.paymentMethodId || req.body?.paymentMethod?.id || ''}`.trim().toLowerCase() ||
      'kortterminal';
    const paymentMethodLabel =
      `${req.body?.paymentMethodLabel || req.body?.paymentMethod?.label || ''}`.trim() ||
      'Kortbetaling';
    let paymentMethodTypes = resolveConnectSalePaymentMethods({
      paymentMethodId,
      requestedTypes: req.body?.paymentMethodTypes,
    });
    const shouldSendPaymentLinkByEmail =
      paymentMethodId === 'kortterminal' || req.body?.sendPaymentLinkByEmail === true;

    if (shouldSendPaymentLinkByEmail && !customerEmail) {
      return res.status(400).json({
        error: 'Kundens e-mail mangler. Tilføj e-mail for at sende betalingslink.',
      });
    }

    const ownerUid = uid;
    const employeeId = `${req.body?.employeeId || uid}`.trim() || uid;
    const employeeName =
      `${req.body?.employeeName || displayName || userDoc.displayName || userDoc.email || ''}`.trim() ||
      'Medarbejder';

    const pendingSalePayload = {
      accountId: resolvedAccountId,
      ownerUid,
      employeeId,
      employeeName,
      appointmentId,
      appointmentRef,
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      location,
      items,
      totals,
      currency,
      paymentMethodId,
      paymentMethodLabel,
    };
    const stripeMetadata = mapPendingSaleToStripeMetadata(pendingSalePayload);

    const defaultSuccessPath = shouldSendPaymentLinkByEmail
      ? '/betaling/kvittering?payment=success&session_id={CHECKOUT_SESSION_ID}'
      : '/booking/fakturaer/salg?stripeCheckout=success&session_id={CHECKOUT_SESSION_ID}';
    const defaultCancelPath = shouldSendPaymentLinkByEmail
      ? '/betaling/kvittering?payment=cancel'
      : '/booking/fakturaer/salg?stripeCheckout=cancel';
    const successUrl = toAbsoluteUrl(
      req,
      req.body?.success_url || req.body?.successUrl,
      defaultSuccessPath
    );
    const cancelUrl = toAbsoluteUrl(
      req,
      req.body?.cancel_url || req.body?.cancelUrl,
      defaultCancelPath
    );

    const createSession = (methodTypes) =>
      stripe.checkout.sessions.create(
        {
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          line_items: buildCheckoutLineItems(items, currency),
          payment_method_types: methodTypes,
          customer_email: customerEmail || userDoc.email || email || undefined,
          client_reference_id: uid,
          metadata: stripeMetadata,
          payment_intent_data: {
            metadata: stripeMetadata,
            receipt_email: customerEmail || userDoc.email || email || undefined,
          },
          locale: 'da',
          submit_type: 'pay',
        },
        {
          stripeAccount: stripeConnectAccountId,
        }
      );

    let session;
    try {
      session = await createSession(paymentMethodTypes);
    } catch (sessionError) {
      const message = `${sessionError?.message || ''}`.toLowerCase();
      const canRetryWithCardOnly =
        paymentMethodTypes.includes('mobilepay') &&
        message &&
        (message.includes('payment_method_types') || message.includes('mobilepay'));
      if (!canRetryWithCardOnly) {
        throw sessionError;
      }
      paymentMethodTypes = ['card'];
      session = await createSession(paymentMethodTypes);
    }

    await persistPendingSale({
      accountId: resolvedAccountId,
      session,
      stripeConnectAccountId,
      payload: pendingSalePayload,
    });

    let paymentLinkEmail = null;
    if (shouldSendPaymentLinkByEmail) {
      const clinicDisplayName =
        clinic?.name ||
        clinic?.clinicName ||
        account?.clinicName ||
        account?.name ||
        clinicSlug ||
        'Selma+';
      const amountLabel = formatSaleAmount(totals?.total, currency);
      const emailResult = await sendConnectSalePaymentLinkEmail({
        toEmail: customerEmail,
        toName: customerName,
        clinicName: clinicDisplayName,
        amountLabel,
        paymentUrl: session?.url || '',
        appointmentRef,
      });
      if (!emailResult?.sent) {
        return res.status(502).json({
          error: emailResult?.error || 'Kunne ikke sende betalingslink på e-mail.',
        });
      }
      paymentLinkEmail = {
        sent: true,
        to: emailResult.to || customerEmail,
        messageId: emailResult.messageId || null,
      };
    }

    return res.json({
      ok: true,
      url: session?.url || null,
      checkoutSessionId: session?.id || null,
      delivery: shouldSendPaymentLinkByEmail ? 'email' : 'redirect',
      paymentLinkEmail,
      accountId: resolvedAccountId,
      clinicId: clinicId || null,
      connectAccountId: stripeConnectAccountId,
      paymentMethodTypes,
      totals,
      currency,
      connect: connectStatus,
    });
  } catch (error) {
    console.error('[stripe] create connect sale checkout session error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

router.post('/connect/sync-sale-session', verifyFirebaseToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const sessionId = `${req.body?.sessionId || req.body?.checkoutSessionId || ''}`.trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'Mangler Stripe session ID.' });
    }

    const { userDoc, clinic, clinicId, account, accountId, source } = await resolveUserClinicContext(uid);
    if (!userDoc) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    if (!clinicId && !accountId) {
      return res.status(400).json({ error: 'Klinik/tenant kunne ikke findes for brugerens session.' });
    }
    const resolvedAccountId = accountId || clinicId;
    const clinicSlug = resolveClinicSlug({ clinic, account, userDoc, clinicId, accountId: resolvedAccountId });
    logConnectAudit({
      action: 'sync_sale_session',
      uid,
      clinicId,
      accountId: resolvedAccountId,
      clinicSlug,
      source,
    });

    const stripeConnectAccountId = getStripeConnectAccountId({ clinic, account });
    if (!stripeConnectAccountId) {
      return res.status(409).json({
        error: 'Betalinger er ikke aktiveret. Aktivér Stripe Connect først.',
        requiresConnect: true,
      });
    }

    const pendingRef = fetchPendingSaleRef(resolvedAccountId, sessionId);
    const pendingSnap = await pendingRef.get();
    const pendingData = pendingSnap.exists ? pendingSnap.data() || {} : {};
    if (pendingData?.status === 'processed' && pendingData?.saleId) {
      return res.json({
        ok: true,
        synced: true,
        alreadyProcessed: true,
        saleId: pendingData.saleId,
      });
    }

    let session;
    try {
      session = await retrieveConnectCheckoutSession({
        stripeConnectAccountId,
        sessionId,
      });
    } catch (stripeError) {
      const statusCode = stripeError?.statusCode || stripeError?.raw?.statusCode || 500;
      if (statusCode === 404) {
        return res.status(404).json({ error: 'Checkout session blev ikke fundet i Stripe Connect.' });
      }
      throw stripeError;
    }

    const flow = `${session?.metadata?.flow || ''}`.trim();
    if (flow !== 'connect_sale') {
      return res.status(400).json({ error: 'Session matcher ikke et Connect-salg.' });
    }

    const paymentStatus = `${session?.payment_status || ''}`.trim().toLowerCase();
    const sessionStatus = `${session?.status || ''}`.trim().toLowerCase();
    const isPaid = paymentStatus === 'paid' || (sessionStatus === 'complete' && toNumber(session?.amount_total) === 0);

    if (!isPaid) {
      return res.status(202).json({
        ok: true,
        synced: false,
        pending: true,
        paymentStatus: session?.payment_status || null,
        sessionStatus: session?.status || null,
      });
    }

    await upsertSaleFromCheckoutSession({
      session,
      connectedAccountId: stripeConnectAccountId,
    });

    const processedSnap = await pendingRef.get();
    const processedData = processedSnap.exists ? processedSnap.data() || {} : {};

    return res.json({
      ok: true,
      synced: processedData?.status === 'processed',
      saleId: processedData?.saleId || null,
      paymentStatus: session?.payment_status || null,
      sessionStatus: session?.status || null,
    });
  } catch (error) {
    console.error('[stripe] sync connect sale session error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

const resolveAuthorizedPaymentLookup = async ({ uid, paymentId, saleId }) => {
  const context = await resolveUserClinicContext(uid);
  if (!context?.userDoc) {
    throw new ReceiptServiceError('Bruger ikke fundet.', {
      code: 'user_not_found',
      statusCode: 404,
    });
  }

  let paymentLookup = null;
  const normalizedPaymentId = `${paymentId || ''}`.trim();
  const normalizedSaleId = `${saleId || ''}`.trim();

  if (normalizedPaymentId) {
    paymentLookup = await findPaymentByAnyIdentifier({ paymentId: normalizedPaymentId });
  }

  if (!paymentLookup?.data && normalizedSaleId) {
    const ownerUidCandidates = [
      uid,
      context?.userDoc?.id,
      context?.clinic?.ownerUid,
      context?.account?.ownerUid,
    ]
      .map((value) => `${value || ''}`.trim())
      .filter(Boolean);

    paymentLookup = await ensurePaymentForSale({
      saleId: normalizedSaleId,
      ownerUidCandidates,
      fallbackClinicId: context?.clinicId || context?.accountId || null,
      fallbackAccountId: context?.accountId || null,
    });
  }

  if (!paymentLookup?.data) {
    throw new ReceiptServiceError('Betalingen blev ikke fundet.', {
      code: 'payment_not_found',
      statusCode: 404,
    });
  }

  const paymentClinicId =
    `${paymentLookup.data?.clinicId || paymentLookup.data?.accountId || ''}`.trim();
  if (!paymentClinicId) {
    throw new ReceiptServiceError('Betalingen mangler clinicId.', {
      code: 'missing_clinic_id',
      statusCode: 500,
    });
  }

  const authorized = await hasClinicAccess({
    uid,
    clinicId: paymentClinicId,
    context,
  });
  if (!authorized) {
    throw new ReceiptServiceError('Du har ikke adgang til denne kvittering.', {
      code: 'forbidden',
      statusCode: 403,
    });
  }

  return { context, paymentLookup };
};

router.post('/connect/payments/get-receipt-download-url', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const paymentId = `${req.body?.paymentId || ''}`.trim();
    const saleId = `${req.body?.saleId || ''}`.trim();
    if (!paymentId && !saleId) {
      return res.status(400).json({ error: 'Mangler paymentId eller saleId.' });
    }

    const { paymentLookup } = await resolveAuthorizedPaymentLookup({
      uid,
      paymentId,
      saleId,
    });
    const download = await ensureReceiptDownloadUrl({
      paymentLookup,
    });

    return res.json({
      ok: true,
      paymentId: paymentLookup.id,
      receiptNumber: download?.payment?.receiptNumber || null,
      url: download.url,
      expiresAt: download.expiresAt ? new Date(download.expiresAt).toISOString() : null,
      expiresInSeconds: Math.round(SIGNED_URL_TTL_MS / 1000),
    });
  } catch (error) {
    const statusCode = error instanceof ReceiptServiceError ? error.statusCode : 500;
    const message = error?.message || 'Server error';
    return res.status(statusCode).json({
      error: message,
      code: error instanceof ReceiptServiceError ? error.code : 'internal_error',
    });
  }
});

router.post('/connect/payments/resend-receipt', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const paymentId = `${req.body?.paymentId || ''}`.trim();
    const saleId = `${req.body?.saleId || ''}`.trim();
    if (!paymentId && !saleId) {
      return res.status(400).json({ error: 'Mangler paymentId eller saleId.' });
    }

    const { paymentLookup } = await resolveAuthorizedPaymentLookup({
      uid,
      paymentId,
      saleId,
    });
    const resendResult = await resendReceiptEmailForPayment({
      paymentLookup,
    });

    return res.json({
      ok: true,
      paymentId: paymentLookup.id,
      receiptNumber: resendResult?.payment?.receiptNumber || null,
      receiptEmailStatus: resendResult?.payment?.receiptEmailStatus || 'sent',
      receiptSentAt: resendResult?.payment?.receiptSentAt || null,
      messageId: resendResult?.emailResult?.messageId || null,
    });
  } catch (error) {
    const statusCode = error instanceof ReceiptServiceError ? error.statusCode : 500;
    const message = error?.message || 'Server error';
    return res.status(statusCode).json({
      error: message,
      code: error instanceof ReceiptServiceError ? error.code : 'internal_error',
    });
  }
});

router.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe er ikke konfigureret.' });
    }

    const { plan, priceId, error } = resolvePlanAndPrice(req.body?.plan);
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    const user = await verifyFirebaseTokenIfPresent(req);
    console.info('[stripe] checkout session requested:', plan, 'uid:', user?.uid || 'anon');
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
      req,
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

const createBillingPortalSession = async (req, res) => {
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

    const baseUrl = resolveBaseUrl(req);
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
};

router.post('/create-billing-portal-session', verifyFirebaseToken, createBillingPortalSession);
router.post('/create-portal-session', verifyFirebaseToken, createBillingPortalSession);

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

const buildSubscriptionPayload = ({
  status,
  plan,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  canceledAt,
  createdAt,
}) => {
  const seatsIncluded = resolveSeatsIncluded(plan);
  const payload = {
    status,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodEnd: currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
    canceledAt: canceledAt ?? null,
    createdAt: createdAt ?? null,
    seatsIncluded: seatsIncluded ?? null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  return payload;
};

const updateAccountFromStripe = async ({
  accountId,
  subscriptionStatus,
  plan,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  canceledAt,
  createdAt,
}) => {
  if (!accountId) return;
  const payload = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (subscriptionStatus) payload.subscriptionStatus = subscriptionStatus;
  if (plan) payload.plan = plan;
  if (stripeCustomerId) payload.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId) payload.stripeSubscriptionId = stripeSubscriptionId;
  if (currentPeriodEnd !== undefined) payload.currentPeriodEnd = currentPeriodEnd;
  if (cancelAtPeriodEnd !== undefined) payload.cancelAtPeriodEnd = cancelAtPeriodEnd;
  if (canceledAt !== undefined) payload.canceledAt = canceledAt;
  if (createdAt !== undefined) payload.createdAt = createdAt;

  await setAccountFields(accountId, payload);
  const account = await getAccountById(accountId);
  if (account?.ownerUid) {
    const subscriptionPayload = buildSubscriptionPayload({
      status: subscriptionStatus,
      plan,
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      canceledAt,
      createdAt,
    });
    await setUserSubscription(account.ownerUid, subscriptionPayload);
  }
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

const findUsersBySubscriptionField = async (field, value) => {
  if (!value) return [];
  const db = getFirestore();
  const snap = await db.collection('users').where(`subscription.${field}`, '==', value).get();
  return snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }));
};

const updateUsersBySubscriptionField = async (field, value, subscriptionPayload) => {
  const users = await findUsersBySubscriptionField(field, value);
  if (!users.length) return [];
  await Promise.all(
    users.map((user) =>
      user.ref.set(
        {
          subscription: subscriptionPayload,
        },
        { merge: true }
      )
    )
  );
  return users.map((user) => user.id);
};

const fetchCustomerEmail = async (customerId) => {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer?.email || null;
  } catch (error) {
    console.warn('[stripe] Failed to fetch customer email', customerId, error);
    return null;
  }
};

const resolveEmailFromObject = async (object) => {
  const direct =
    object?.customer_details?.email ||
    object?.customer_email ||
    object?.email ||
    null;
  if (direct) return direct;
  const customerId =
    typeof object?.customer === 'string' ? object.customer : object?.customer?.id;
  return fetchCustomerEmail(customerId);
};

const applySubscriptionToUsersByEmail = async ({
  email,
  subscriptionStatus,
  plan,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  canceledAt,
  createdAt,
}) => {
  if (!email) return;
  const payload = buildSubscriptionPayload({
    status: subscriptionStatus,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    canceledAt,
    createdAt,
  });
  const matched = await updateUsersByEmail(email, payload);
  console.info('[stripe] updated users by email', normalizeEmail(email), matched);
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const flow = `${session?.metadata?.flow || ''}`.trim();
        if (flow === 'connect_sale') {
          await upsertSaleFromCheckoutSession({
            session,
            connectedAccountId: event?.account || session?.account || null,
          });
          break;
        }

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
        const createdAt = subscription?.created
          ? toFirestoreTimestamp(subscription.created)
          : session?.created
            ? toFirestoreTimestamp(session.created)
            : undefined;
        const cancelAtPeriodEnd = subscription?.cancel_at_period_end || false;
        const canceledAt = subscription?.canceled_at
          ? toFirestoreTimestamp(subscription.canceled_at)
          : null;
        const uid = session?.metadata?.uid || session?.client_reference_id || null;
        const email = await resolveEmailFromObject(session);

        await updateAccountFromStripe({
          accountId,
          subscriptionStatus,
          plan,
          stripeCustomerId: session?.customer,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          canceledAt,
          createdAt,
        });
        if (uid) {
          const payload = buildSubscriptionPayload({
            status: subscriptionStatus,
            plan,
            stripeCustomerId: session?.customer,
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            createdAt,
          });
          await setUserSubscription(uid, payload);
        } else if (email) {
          await applySubscriptionToUsersByEmail({
            email,
            subscriptionStatus,
            plan,
            stripeCustomerId: session?.customer,
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            createdAt,
          });
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const flow = `${paymentIntent?.metadata?.flow || ''}`.trim();
        if (flow !== 'connect_sale') {
          break;
        }

        const connectedAccountId = event?.account || null;
        let checkoutSession = null;
        try {
          const sessionList = await stripe.checkout.sessions.list(
            {
              payment_intent: paymentIntent?.id,
              limit: 1,
            },
            connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
          );
          checkoutSession = Array.isArray(sessionList?.data) ? sessionList.data[0] : null;
        } catch (lookupError) {
          console.warn('[stripe] payment_intent.succeeded session lookup failed', {
            paymentIntentId: paymentIntent?.id || null,
            connectedAccountId: connectedAccountId || null,
            error: lookupError?.message || lookupError,
          });
        }

        if (checkoutSession) {
          await upsertSaleFromCheckoutSession({
            session: checkoutSession,
            connectedAccountId: connectedAccountId || checkoutSession?.account || null,
          });
          break;
        }

        const metadata = paymentIntent?.metadata || {};
        const accountId = `${metadata?.accountId || ''}`.trim();
        const ownerUid = `${metadata?.ownerUid || ''}`.trim();
        if (accountId && ownerUid) {
          await syncPaymentReceiptForSale({
            stripe,
            connectedAccountId,
            session: {
              id: `pi_${paymentIntent?.id || Date.now()}`,
              metadata,
              currency: paymentIntent?.currency || STRIPE_CONNECT_DEFAULT_CURRENCY,
              amount_total: paymentIntent?.amount_received || paymentIntent?.amount || 0,
              payment_intent: paymentIntent?.id || null,
              created: paymentIntent?.created || null,
            },
            pendingData: {
              accountId,
              ownerUid,
              appointmentId: `${metadata?.appointmentId || ''}`.trim() || null,
              appointmentRef: `${metadata?.appointmentRef || ''}`.trim() || null,
              employeeId: `${metadata?.employeeId || ''}`.trim() || ownerUid,
              employeeName: `${metadata?.employeeName || ''}`.trim() || 'Behandler',
              paymentMethod: {
                id: `${metadata?.paymentMethodId || ''}`.trim() || null,
                label: `${metadata?.paymentMethodLabel || ''}`.trim() || 'Kortbetaling',
              },
              totals: {
                subtotal: toNumber(paymentIntent?.amount_received || paymentIntent?.amount) / 100,
                vat: 0,
                total: toNumber(paymentIntent?.amount_received || paymentIntent?.amount) / 100,
              },
              currency: `${paymentIntent?.currency || STRIPE_CONNECT_DEFAULT_CURRENCY}`.toLowerCase(),
              items: [],
              customer: {},
            },
            accountId,
            ownerUid,
            saleId: null,
          });
        }
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        await markPendingSaleFailed({
          session,
          reason: 'async_payment_failed',
          connectedAccountId: event?.account || session?.account || null,
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
        const createdAt = subscription?.created
          ? toFirestoreTimestamp(subscription.created)
          : undefined;
        const cancelAtPeriodEnd = subscription?.cancel_at_period_end || false;
        const canceledAt = subscription?.canceled_at
          ? toFirestoreTimestamp(subscription.canceled_at)
          : null;
        const uid = subscription?.metadata?.uid || null;
        const email = await resolveEmailFromObject(subscription);

        await updateAccountFromStripe({
          accountId,
          subscriptionStatus,
          plan,
          stripeCustomerId: subscription?.customer,
          stripeSubscriptionId: subscription?.id,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          canceledAt,
          createdAt,
        });
        if (uid) {
          const payload = buildSubscriptionPayload({
            status: subscriptionStatus,
            plan,
            stripeCustomerId: subscription?.customer,
            stripeSubscriptionId: subscription?.id,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            createdAt,
          });
          await setUserSubscription(uid, payload);
        } else if (email) {
          await applySubscriptionToUsersByEmail({
            email,
            subscriptionStatus,
            plan,
            stripeCustomerId: subscription?.customer,
            stripeSubscriptionId: subscription?.id,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            createdAt,
          });
        }
        await updateUsersBySubscriptionField(
          'stripeCustomerId',
          subscription?.customer,
          buildSubscriptionPayload({
            status: subscriptionStatus,
            plan,
            stripeCustomerId: subscription?.customer,
            stripeSubscriptionId: subscription?.id,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            createdAt,
          })
        );
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
        const createdAt = subscription?.created
          ? toFirestoreTimestamp(subscription.created)
          : undefined;
        const cancelAtPeriodEnd = subscription?.cancel_at_period_end || false;
        const canceledAt = subscription?.canceled_at
          ? toFirestoreTimestamp(subscription.canceled_at)
          : null;
        const uid = subscription?.metadata?.uid || null;
        const email = await resolveEmailFromObject(invoice);

        await updateAccountFromStripe({
          accountId,
          subscriptionStatus,
          plan,
          stripeCustomerId: invoice?.customer,
          stripeSubscriptionId: invoice?.subscription,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          canceledAt,
          createdAt,
        });
        if (uid) {
          const payload = buildSubscriptionPayload({
            status: subscriptionStatus,
            plan,
            stripeCustomerId: invoice?.customer,
            stripeSubscriptionId: invoice?.subscription,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            createdAt,
          });
          await setUserSubscription(uid, payload);
        } else if (email) {
          await applySubscriptionToUsersByEmail({
            email,
            subscriptionStatus,
            plan,
            stripeCustomerId: invoice?.customer,
            stripeSubscriptionId: invoice?.subscription,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            createdAt,
          });
        }
        await updateUsersBySubscriptionField(
          'stripeSubscriptionId',
          invoice?.subscription,
          buildSubscriptionPayload({
            status: subscriptionStatus,
            plan,
            stripeCustomerId: invoice?.customer,
            stripeSubscriptionId: invoice?.subscription,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
            createdAt,
          })
        );
        break;
      }
      case 'account.updated': {
        const stripeAccount = event.data.object;
        const stripeConnectAccountId = `${stripeAccount?.id || event?.account || ''}`.trim() || null;
        if (!stripeConnectAccountId) {
          break;
        }
        const connectStatus = normalizeStripeConnectStatus(stripeAccount);
        const { clinicId, accountId, source } = await resolveConnectContextByStripeAccountId(
          stripeConnectAccountId
        );
        if (clinicId) {
          await setClinicFields(clinicId, buildStripeConnectClinicFields(connectStatus));
        }
        if (accountId) {
          await setAccountFields(accountId, buildStripeConnectAccountFields(connectStatus));
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info('[stripe] connect account.updated synced', {
            stripeConnectAccountId,
            clinicId,
            accountId,
            source,
            chargesEnabled: connectStatus?.chargesEnabled || false,
            payoutsEnabled: connectStatus?.payoutsEnabled || false,
            detailsSubmitted: connectStatus?.detailsSubmitted || false,
          });
        }
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
