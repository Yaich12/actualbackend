const { admin, getFirestore } = require('../firebaseAdmin');
const {
  getActiveClinicId,
  getAccountById,
  getClinicById,
  getUserById,
} = require('../firestoreAccounts');
const { generateReceiptPdfBuffer } = require('./generateReceiptPdf');
const {
  DEFAULT_PREFIX,
  assignReceiptNumberInTransaction,
  normalizeReceiptPrefix,
} = require('./receiptNumber');

const RESEND_API_KEY = `${process.env.RESEND_API_KEY || ''}`.trim();
const RESEND_API_BASE = `${process.env.RESEND_API_BASE || 'https://api.resend.com'}`
  .trim()
  .replace(/\/+$/, '');
const RECEIPT_FROM_EMAIL =
  `${process.env.STRIPE_RECEIPT_FROM_EMAIL ||
    process.env.STRIPE_SALE_LINK_FROM_EMAIL ||
    process.env.BOOKING_CONFIRMATION_FROM_EMAIL ||
    ''}`.trim() || '';
const RECEIPT_REPLY_TO_EMAIL =
  `${process.env.STRIPE_RECEIPT_REPLY_TO_EMAIL ||
    process.env.STRIPE_SALE_LINK_REPLY_TO_EMAIL ||
    process.env.BOOKING_CONFIRMATION_REPLY_TO_EMAIL ||
    ''}`.trim() || '';
const RECEIPT_EMAIL_SUBJECT = 'Kvittering for din behandling';
const SIGNED_URL_TTL_MS = 10 * 60 * 1000;
const RECEIPT_TIMEZONE = 'Europe/Copenhagen';

class ReceiptServiceError extends Error {
  constructor(message, { code = 'receipt_error', statusCode = 400 } = {}) {
    super(message);
    this.name = 'ReceiptServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const pickFirstString = (...candidates) => {
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return match ? match.trim() : '';
};

const normalizeEmail = (value) => `${value || ''}`.trim().toLowerCase();
const normalizeStatus = (value) =>
  `${value || ''}`
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toUpperCurrency = (value) => `${value || 'DKK'}`.trim().toUpperCase() || 'DKK';

const toLowerCurrency = (value) => `${value || 'dkk'}`.trim().toLowerCase() || 'dkk';

const resolveDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch (_error) {
      return null;
    }
  }
  if (typeof value === 'number') {
    if (value > 10_000_000_000) {
      return new Date(value);
    }
    return new Date(value * 1000);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatDateTimeDa = (value) => {
  const date = resolveDate(value) || new Date();
  try {
    return new Intl.DateTimeFormat('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: RECEIPT_TIMEZONE,
    }).format(date);
  } catch (_error) {
    return date.toISOString();
  }
};

const formatMoneyDa = (value) =>
  new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const formatMoneyWithCurrency = (value, currency) =>
  `${formatMoneyDa(value)} ${toUpperCurrency(currency)}`;

const normalizePaymentMethodLabel = (value) => {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (!normalized) return 'Kortbetaling';
  if (normalized === 'card' || normalized === 'kort' || normalized === 'kortbetaling') {
    return 'Kortbetaling';
  }
  if (normalized === 'mobilepay') return 'MobilePay';
  if (normalized === 'cash' || normalized === 'kontant') return 'Kontant';
  if (normalized === 'bank_transfer' || normalized === 'bank') return 'Bankoverførsel';
  return `${value || 'Andet'}`.trim();
};

const isPaidLikeStatus = (value) => {
  const normalized = normalizeStatus(value);
  return (
    normalized === 'paid' ||
    normalized === 'completed' ||
    normalized === 'complete' ||
    normalized === 'success' ||
    normalized === 'succeeded' ||
    normalized === 'gennemfort'
  );
};

const resolveStorageBucketCandidates = () => {
  const candidates = [];
  const pushCandidate = (value) => {
    const normalized = `${value || ''}`.trim();
    if (!normalized) return;
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(process.env.FIREBASE_STORAGE_BUCKET);
  pushCandidate(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET);

  const appBucket = admin.app()?.options?.storageBucket;
  if (typeof appBucket === 'string') {
    pushCandidate(appBucket);
  }

  const projectId = pickFirstString(
    process.env.FIREBASE_PROJECT_ID,
    process.env.GCLOUD_PROJECT,
    process.env.REACT_APP_PROJECT_ID
  );
  if (projectId) {
    pushCandidate(`${projectId}.firebasestorage.app`);
    pushCandidate(`${projectId}.appspot.com`);
  }

  return candidates;
};

const shouldTryNextBucket = (error) => {
  const statusCode = Number(error?.code || error?.statusCode || 0);
  const message = `${error?.message || ''}`.toLowerCase();
  if (statusCode === 404 || statusCode === 400) return true;
  if (message.includes('no such bucket')) return true;
  if (message.includes('bucket') && message.includes('not exist')) return true;
  if (message.includes('bucket') && message.includes('not found')) return true;
  if (message.includes('file') && message.includes('not found')) return true;
  return false;
};

const withStorageBucket = async (operationName, handler) => {
  const bucketCandidates = resolveStorageBucketCandidates();
  if (!bucketCandidates.length) {
    throw new ReceiptServiceError('Storage bucket er ikke konfigureret.', {
      code: 'missing_storage_bucket',
      statusCode: 500,
    });
  }

  let lastError = null;
  for (let index = 0; index < bucketCandidates.length; index += 1) {
    const bucketName = bucketCandidates[index];
    const bucket = admin.storage().bucket(bucketName);
    try {
      // eslint-disable-next-line no-await-in-loop
      return await handler(bucket, bucketName);
    } catch (error) {
      lastError = error;
      const hasMoreCandidates = index < bucketCandidates.length - 1;
      if (hasMoreCandidates && shouldTryNextBucket(error)) {
        console.warn('[receipts] retrying storage bucket', {
          operation: operationName,
          failedBucket: bucketName,
          nextBucket: bucketCandidates[index + 1],
          error: error?.message || error,
        });
        continue;
      }
      throw error;
    }
  }

  throw lastError;
};

const buildReceiptPdfPath = ({ clinicId, receiptNumber }) =>
  `receipts/${clinicId}/${receiptNumber}.pdf`;

const uploadReceiptPdfToStorage = async ({ clinicId, receiptNumber, pdfBuffer }) => {
  const path = buildReceiptPdfPath({ clinicId, receiptNumber });
  await withStorageBucket('upload_receipt_pdf', async (bucket) => {
    const file = bucket.file(path);
    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=0, no-store',
        contentDisposition: `attachment; filename=\"${receiptNumber}.pdf\"`,
      },
    });
  });
  return path;
};

const readReceiptPdfFromStorage = async (path) =>
  withStorageBucket('read_receipt_pdf', async (bucket) => {
    const file = bucket.file(path);
    const [buffer] = await file.download();
    return buffer;
  });

const createSignedReceiptUrl = async (path) => {
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS);
  const url = await withStorageBucket('create_signed_receipt_url', async (bucket) => {
    const file = bucket.file(path);
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      version: 'v4',
      expires: expiresAt,
    });
    return signedUrl;
  });
  return { url, expiresAt };
};

const resolvePaymentIntentId = ({ session, fallbackPaymentIntent }) => {
  if (fallbackPaymentIntent?.id) return `${fallbackPaymentIntent.id}`;
  const raw = session?.payment_intent;
  if (typeof raw === 'string') return raw;
  if (raw?.id) return `${raw.id}`;
  return '';
};

const resolveChargeId = (paymentIntent) => {
  const latest = paymentIntent?.latest_charge;
  if (typeof latest === 'string') return latest;
  if (latest?.id) return `${latest.id}`;
  const charges = Array.isArray(paymentIntent?.charges?.data) ? paymentIntent.charges.data : [];
  if (charges.length && charges[0]?.id) {
    return `${charges[0].id}`;
  }
  return '';
};

const retrievePaymentIntent = async ({ stripe, connectedAccountId, paymentIntentId }) => {
  if (!stripe || !paymentIntentId) return null;
  try {
    return await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ['latest_charge'],
      },
      connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
    );
  } catch (error) {
    console.warn('[receipts] could not retrieve payment intent', {
      paymentIntentId,
      connectedAccountId: connectedAccountId || null,
      error: error?.message || error,
    });
    return null;
  }
};

const normalizeTotals = ({ pendingData, session, paymentIntent }) => {
  const pendingTotals = pendingData?.totals || {};
  const amountFromPending = toNumber(pendingTotals.total);
  const amountFromSession = toNumber(session?.amount_total) / 100;
  const amountFromIntent =
    toNumber(paymentIntent?.amount_received || paymentIntent?.amount) / 100;
  const amount = amountFromPending || amountFromSession || amountFromIntent || 0;

  const vatAmount = Math.max(0, toNumber(pendingTotals.vat));
  const explicitSubtotal = toNumber(pendingTotals.subtotal);
  const subtotalAmount =
    explicitSubtotal > 0 ? explicitSubtotal : Math.max(0, amount - vatAmount);
  const vatRateRaw = toNumber(pendingTotals.vatRate);
  const vatRate =
    vatRateRaw > 0 ? vatRateRaw : subtotalAmount > 0 ? (vatAmount / subtotalAmount) * 100 : 0;

  return {
    amount,
    vatAmount,
    subtotalAmount,
    vatRate: Number(vatRate.toFixed(2)),
  };
};

const parseAppointmentDateTime = (appointmentData = {}) => {
  const isoCandidate = pickFirstString(
    appointmentData.start,
    appointmentData.startIso,
    appointmentData.startAt,
    appointmentData.completedAt
  );
  if (isoCandidate) {
    const parsed = new Date(isoCandidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const startDateRaw = `${appointmentData.startDate || ''}`.trim();
  if (startDateRaw) {
    const parts = startDateRaw.split('-').map((part) => Number(part));
    if (parts.length === 3 && parts.every((value) => Number.isFinite(value) && value > 0)) {
      const [day, month, year] = parts;
      const date = new Date(year, month - 1, day);
      const [hours, minutes] = `${appointmentData.startTime || '00:00'}`
        .split(':')
        .map((part) => Number(part));
      if (!Number.isNaN(date.getTime()) && !Number.isNaN(hours) && !Number.isNaN(minutes)) {
        date.setHours(hours, minutes, 0, 0);
        return date;
      }
    }
  }
  return null;
};

const resolveAppointmentDetails = async ({ ownerUid, appointmentId, pendingData }) => {
  if (!ownerUid || !appointmentId) {
    return {
      appointmentDateTime: null,
      appointmentLabel: pickFirstString(pendingData?.appointmentRef) || '-',
      serviceName: pickFirstString(
        pendingData?.items?.[0]?.name,
        pendingData?.serviceName,
        'Behandling'
      ),
      therapistName: pickFirstString(pendingData?.employeeName, 'Behandler'),
    };
  }

  try {
    const snap = await getFirestore()
      .collection('users')
      .doc(ownerUid)
      .collection('appointments')
      .doc(appointmentId)
      .get();
    const appointment = snap.exists ? snap.data() || {} : {};
    const appointmentDateTime = parseAppointmentDateTime(appointment);

    return {
      appointmentDateTime,
      appointmentLabel: appointmentDateTime
        ? formatDateTimeDa(appointmentDateTime)
        : pickFirstString(pendingData?.appointmentRef) || '-',
      serviceName: pickFirstString(
        appointment?.service,
        appointment?.title,
        pendingData?.items?.[0]?.name,
        pendingData?.serviceName,
        'Behandling'
      ),
      therapistName: pickFirstString(
        appointment?.calendarOwner,
        appointment?.therapistName,
        pendingData?.employeeName,
        'Behandler'
      ),
    };
  } catch (error) {
    console.warn('[receipts] appointment lookup failed', {
      ownerUid,
      appointmentId,
      error: error?.message || error,
    });
    return {
      appointmentDateTime: null,
      appointmentLabel: pickFirstString(pendingData?.appointmentRef) || '-',
      serviceName: pickFirstString(
        pendingData?.items?.[0]?.name,
        pendingData?.serviceName,
        'Behandling'
      ),
      therapistName: pickFirstString(pendingData?.employeeName, 'Behandler'),
    };
  }
};

const resolveClinicMetadata = async ({ clinicId, accountId, ownerUid }) => {
  const [clinic, account, ownerUser] = await Promise.all([
    clinicId ? getClinicById(clinicId) : Promise.resolve(null),
    accountId ? getAccountById(accountId) : Promise.resolve(null),
    ownerUid ? getUserById(ownerUid) : Promise.resolve(null),
  ]);

  const clinicName = pickFirstString(
    clinic?.name,
    clinic?.clinicName,
    account?.clinicName,
    account?.name,
    ownerUser?.clinicName,
    'Selma+'
  );
  const clinicAddress = pickFirstString(
    clinic?.address,
    clinic?.invoiceAddress,
    account?.address,
    ownerUser?.address,
    '-'
  );
  const clinicCvr = pickFirstString(
    clinic?.cvr,
    clinic?.CVR,
    clinic?.businessNumber,
    account?.cvr,
    ownerUser?.cvr,
    '-'
  );
  const receiptPrefix = normalizeReceiptPrefix(
    pickFirstString(
      clinic?.receiptPrefix,
      clinic?.receipt?.prefix,
      clinic?.accounting?.receiptPrefix,
      account?.receiptPrefix,
      DEFAULT_PREFIX
    )
  );

  return {
    clinic,
    account,
    ownerUser,
    clinicName,
    clinicAddress,
    clinicCvr,
    receiptPrefix,
  };
};

const resolvePatientData = ({ pendingData, paymentIntent }) => {
  const latestCharge =
    typeof paymentIntent?.latest_charge === 'object' && paymentIntent?.latest_charge
      ? paymentIntent.latest_charge
      : null;
  const billingDetails = latestCharge?.billing_details || {};
  const customer = pendingData?.customer || {};

  const patientName = pickFirstString(customer?.name, billingDetails?.name, 'Patient');
  const patientEmail = normalizeEmail(
    pickFirstString(customer?.email, billingDetails?.email, paymentIntent?.receipt_email)
  );
  const patientPhone = pickFirstString(customer?.phone, billingDetails?.phone);
  const patientId = pickFirstString(customer?.id) || null;

  return {
    patientName,
    patientEmail,
    patientPhone,
    patientId,
  };
};

const resolvePatientFromClientRecord = async ({ ownerUid, patientId }) => {
  const normalizedOwnerUid = `${ownerUid || ''}`.trim();
  const normalizedPatientId = `${patientId || ''}`.trim();
  if (!normalizedOwnerUid || !normalizedPatientId) return null;

  try {
    const snap = await getFirestore()
      .collection('users')
      .doc(normalizedOwnerUid)
      .collection('clients')
      .doc(normalizedPatientId)
      .get();
    if (!snap.exists) return null;
    const client = snap.data() || {};
    const contact = client.contact || {};

    return {
      patientName: pickFirstString(client.name, client.fullName, client.displayName),
      patientEmail: normalizeEmail(pickFirstString(client.email, contact.email, client.clientEmail)),
      patientPhone: pickFirstString(client.phone, contact.phone, client.mobile, client.telephone),
    };
  } catch (error) {
    console.warn('[receipts] client lookup failed', {
      ownerUid: normalizedOwnerUid,
      patientId: normalizedPatientId,
      error: error?.message || error,
    });
    return null;
  }
};

const buildPaymentPayload = ({
  paymentId,
  clinicId,
  ownerUid,
  saleId,
  session,
  pendingData,
  paymentIntent,
  clinicMetadata,
  appointmentDetails,
  totals,
}) => {
  const paymentIntentId = resolvePaymentIntentId({ session, fallbackPaymentIntent: paymentIntent });
  const chargeId = resolveChargeId(paymentIntent);
  const paidAtDate =
    resolveDate(session?.created) ||
    resolveDate(paymentIntent?.created) ||
    new Date();
  const paidAtTimestamp = admin.firestore.Timestamp.fromDate(paidAtDate);
  const currency = toLowerCurrency(
    session?.currency || pendingData?.currency || paymentIntent?.currency || 'dkk'
  );

  const patient = resolvePatientData({ pendingData, paymentIntent });
  const paymentMethod = normalizePaymentMethodLabel(
    pickFirstString(
      pendingData?.paymentMethod?.label,
      paymentIntent?.payment_method_types?.[0],
      paymentIntent?.latest_charge?.payment_method_details?.type
    )
  );

  return {
    paymentId,
    clinicId,
    patientId: patient.patientId,
    appointmentId: pickFirstString(pendingData?.appointmentId) || null,
    amount: totals.amount,
    currency,
    vatAmount: totals.vatAmount,
    vatRate: totals.vatRate,
    subtotalAmount: totals.subtotalAmount,
    paymentMethod,
    stripePaymentIntentId: paymentIntentId || null,
    stripeChargeId: chargeId || null,
    stripeCheckoutSessionId: pickFirstString(session?.id) || null,
    status: 'paid',
    receiptPdfPath: null,
    receiptEmailStatus: 'not_sent',
    receiptSentAt: null,
    receiptLastError: null,
    patientName: patient.patientName,
    patientEmail: patient.patientEmail,
    patientPhone: patient.patientPhone,
    clinicName: clinicMetadata.clinicName,
    clinicAddress: clinicMetadata.clinicAddress,
    clinicCvr: clinicMetadata.clinicCvr,
    therapistName: appointmentDetails.therapistName,
    serviceName: appointmentDetails.serviceName,
    appointmentDateTime: appointmentDetails.appointmentDateTime
      ? admin.firestore.Timestamp.fromDate(appointmentDetails.appointmentDateTime)
      : null,
    appointmentLabel: appointmentDetails.appointmentLabel,
    ownerUid: ownerUid || null,
    saleId: saleId || null,
    paymentDateTime: paidAtTimestamp,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const upsertPaymentWithReceiptNumber = async ({
  paymentId,
  clinicId,
  paidAtDate,
  receiptPrefix,
  payload,
}) => {
  const db = getFirestore();
  const paymentRef = db.collection('payments').doc(paymentId);
  const counterRef = db.collection('receiptCounters').doc(clinicId);

  const result = await db.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    const existing = paymentSnap.exists ? paymentSnap.data() || {} : {};

    let receiptNumber = pickFirstString(existing.receiptNumber, payload?.receiptNumber);
    if (!receiptNumber) {
      const assigned = await assignReceiptNumberInTransaction({
        tx,
        counterRef,
        year: (paidAtDate || new Date()).getFullYear(),
        prefix: receiptPrefix,
      });
      receiptNumber = assigned.receiptNumber;
    }

    tx.set(
      paymentRef,
      {
        ...payload,
        paymentId,
        clinicId,
        receiptNumber,
        receiptEmailStatus:
          existing.receiptEmailStatus || payload.receiptEmailStatus || 'not_sent',
        receiptSentAt: existing.receiptSentAt || payload.receiptSentAt || null,
        receiptPdfPath: existing.receiptPdfPath || payload.receiptPdfPath || null,
        createdAt: existing.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { existing };
  });

  const paymentSnap = await paymentRef.get();
  const payment = paymentSnap.exists ? paymentSnap.data() || {} : {};
  return {
    paymentRef,
    payment,
    existedBefore: Boolean(result?.existing),
  };
};

const buildPdfInputFromPayment = (payment = {}) => ({
  clinicName: payment.clinicName || 'Klinik',
  clinicAddress: payment.clinicAddress || '-',
  clinicCvr: payment.clinicCvr || '-',
  patientName: payment.patientName || '-',
  receiptNumber: payment.receiptNumber || '-',
  paidAtLabel: formatDateTimeDa(payment.paymentDateTime),
  paymentMethod: payment.paymentMethod || '-',
  stripePaymentIntentId: payment.stripePaymentIntentId || '-',
  stripeChargeId: payment.stripeChargeId || '-',
  therapistName: payment.therapistName || '-',
  serviceName: payment.serviceName || '-',
  appointmentLabel: payment.appointmentLabel || '-',
  subtotalAmount: payment.subtotalAmount || 0,
  vatRate: payment.vatRate || 0,
  vatAmount: payment.vatAmount || 0,
  amount: payment.amount || 0,
  currency: payment.currency || 'DKK',
});

const ensureReceiptPdf = async ({
  paymentRef,
  payment,
  forceRegenerate = false,
  returnBuffer = false,
}) => {
  if (!paymentRef || !payment?.receiptNumber || !payment?.clinicId) {
    throw new ReceiptServiceError('Payment mangler data til PDF-generering.', {
      code: 'invalid_payment_data',
      statusCode: 400,
    });
  }

  if (payment.receiptPdfPath && !forceRegenerate) {
    if (!returnBuffer) {
      return { receiptPdfPath: payment.receiptPdfPath, pdfBuffer: null };
    }
    try {
      const existingBuffer = await readReceiptPdfFromStorage(payment.receiptPdfPath);
      return { receiptPdfPath: payment.receiptPdfPath, pdfBuffer: existingBuffer };
    } catch (_error) {
      // Fall through and regenerate if file no longer exists.
    }
  }

  const pdfBuffer = generateReceiptPdfBuffer(buildPdfInputFromPayment(payment));
  const receiptPdfPath = await uploadReceiptPdfToStorage({
    clinicId: payment.clinicId,
    receiptNumber: payment.receiptNumber,
    pdfBuffer,
  });

  await paymentRef.set(
    {
      receiptPdfPath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    receiptPdfPath,
    pdfBuffer: returnBuffer ? pdfBuffer : null,
  };
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const sendReceiptEmail = async ({ payment, pdfBuffer }) => {
  const recipient = normalizeEmail(payment?.patientEmail);
  if (!recipient) {
    return {
      sent: false,
      skipped: true,
      code: 'missing_patient_email',
      error: 'Patientens e-mail mangler.',
    };
  }

  if (!RESEND_API_KEY || !RECEIPT_FROM_EMAIL) {
    return {
      sent: false,
      skipped: true,
      code: 'missing_email_config',
      error: 'E-mailopsætning mangler på serveren.',
    };
  }

  const amountLabel = formatMoneyWithCurrency(payment?.amount, payment?.currency);
  const paidAtLabel = formatDateTimeDa(payment?.paymentDateTime);

  const text = [
    `Hej ${payment?.patientName || 'der'}`,
    '',
    'Tak for din betaling.',
    `Kvitteringsnummer: ${payment?.receiptNumber || '-'}`,
    `Dato: ${paidAtLabel}`,
    `Beløb: ${amountLabel}`,
    '',
    'Din kvittering er vedhæftet som PDF.',
    '',
    'SelmaPay drives af Stripe (Express).',
  ].join('\n');

  const html = `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;">
  <h2 style="margin:0 0 12px;">Kvittering for din behandling</h2>
  <p style="margin:0 0 12px;">Hej ${payment?.patientName || 'der'}</p>
  <p style="margin:0 0 12px;">Tak for din betaling. Din kvittering er vedhæftet som PDF.</p>
  <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc;">
    <p style="margin:0 0 8px;"><strong>Kvitteringsnummer:</strong> ${payment?.receiptNumber || '-'}</p>
    <p style="margin:0 0 8px;"><strong>Dato:</strong> ${paidAtLabel}</p>
    <p style="margin:0;"><strong>Beløb:</strong> ${amountLabel}</p>
  </div>
  <p style="margin:16px 0 0;color:#64748b;font-size:12px;">SelmaPay drives af Stripe (Express).</p>
</div>
`.trim();

  const payload = {
    from: RECEIPT_FROM_EMAIL,
    to: [recipient],
    subject: RECEIPT_EMAIL_SUBJECT,
    text,
    html,
    attachments: [
      {
        filename: `${payment?.receiptNumber || 'kvittering'}.pdf`,
        content: pdfBuffer.toString('base64'),
        content_type: 'application/pdf',
      },
    ],
  };
  if (RECEIPT_REPLY_TO_EMAIL) {
    payload.reply_to = RECEIPT_REPLY_TO_EMAIL;
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
          `Kvittering kunne ikke sendes (HTTP ${response.status}).`,
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
      error: error?.message || 'Uventet fejl ved afsendelse af kvittering.',
    };
  }
};

const updatePaymentEmailStatus = async ({ paymentRef, emailResult }) => {
  if (!paymentRef || !emailResult) return;
  if (emailResult.sent) {
    await paymentRef.set(
      {
        receiptEmailStatus: 'sent',
        receiptSentAt: admin.firestore.FieldValue.serverTimestamp(),
        receiptLastError: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  await paymentRef.set(
    {
      receiptEmailStatus: 'failed',
      receiptLastError: `${emailResult.error || emailResult.code || 'Ukendt fejl'}`.slice(0, 400),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

const ensureClinicId = async ({ clinicId, accountId, ownerUid }) => {
  const explicitClinic = pickFirstString(clinicId);
  if (explicitClinic) return explicitClinic;
  if (ownerUid) {
    const activeClinicId = await getActiveClinicId(ownerUid);
    if (activeClinicId) return activeClinicId;
  }
  const fallback = pickFirstString(accountId);
  if (fallback) return fallback;
  throw new ReceiptServiceError('Kunne ikke bestemme clinicId for kvittering.', {
    code: 'missing_clinic_id',
    statusCode: 500,
  });
};

const syncPaymentReceiptForSale = async ({
  stripe,
  connectedAccountId = null,
  session = {},
  pendingData = {},
  accountId = null,
  clinicId = null,
  ownerUid = null,
  saleId = null,
  fallbackPaymentIntent = null,
}) => {
  const paymentIntentId = resolvePaymentIntentId({
    session,
    fallbackPaymentIntent,
  });
  const paymentIntent =
    fallbackPaymentIntent ||
    (await retrievePaymentIntent({
      stripe,
      connectedAccountId,
      paymentIntentId,
    }));
  const paymentId = pickFirstString(paymentIntentId, resolveChargeId(paymentIntent), session?.id);

  if (!paymentId) {
    throw new ReceiptServiceError('Mangler payment-id til kvittering.', {
      code: 'missing_payment_id',
      statusCode: 400,
    });
  }

  const resolvedOwnerUid =
    pickFirstString(ownerUid, pendingData?.ownerUid, session?.metadata?.ownerUid) || null;
  const resolvedAccountId =
    pickFirstString(accountId, pendingData?.accountId, session?.metadata?.accountId) || null;
  const resolvedClinicId = await ensureClinicId({
    clinicId,
    accountId: resolvedAccountId,
    ownerUid: resolvedOwnerUid,
  });

  const clinicMetadata = await resolveClinicMetadata({
    clinicId: resolvedClinicId,
    accountId: resolvedAccountId,
    ownerUid: resolvedOwnerUid,
  });
  const appointmentDetails = await resolveAppointmentDetails({
    ownerUid: resolvedOwnerUid,
    appointmentId: pickFirstString(pendingData?.appointmentId) || null,
    pendingData,
  });
  const totals = normalizeTotals({ pendingData, session, paymentIntent });

  const paymentPayload = buildPaymentPayload({
    paymentId,
    clinicId: resolvedClinicId,
    ownerUid: resolvedOwnerUid,
    saleId,
    session,
    pendingData,
    paymentIntent,
    clinicMetadata,
    appointmentDetails,
    totals,
  });

  if (
    (!paymentPayload.patientEmail || paymentPayload.patientName === 'Patient') &&
    paymentPayload.ownerUid &&
    paymentPayload.patientId
  ) {
    const clientData = await resolvePatientFromClientRecord({
      ownerUid: paymentPayload.ownerUid,
      patientId: paymentPayload.patientId,
    });
    if (clientData) {
      const currentPatientName =
        paymentPayload.patientName === 'Patient' ? '' : paymentPayload.patientName;
      paymentPayload.patientName =
        pickFirstString(currentPatientName, clientData.patientName, 'Patient') || 'Patient';
      paymentPayload.patientEmail = paymentPayload.patientEmail || clientData.patientEmail || '';
      paymentPayload.patientPhone = paymentPayload.patientPhone || clientData.patientPhone || '';
    }
  }

  const { paymentRef } = await upsertPaymentWithReceiptNumber({
    paymentId,
    clinicId: resolvedClinicId,
    paidAtDate: resolveDate(paymentPayload.paymentDateTime) || new Date(),
    receiptPrefix: clinicMetadata.receiptPrefix,
    payload: paymentPayload,
  });

  const updatedSnap = await paymentRef.get();
  const payment = updatedSnap.exists ? updatedSnap.data() || {} : {};
  const ensuredPdf = await ensureReceiptPdf({
    paymentRef,
    payment,
    forceRegenerate: false,
    returnBuffer: true,
  });
  const paymentAfterPdf = {
    ...payment,
    receiptPdfPath: ensuredPdf.receiptPdfPath,
  };

  const alreadySent = `${paymentAfterPdf.receiptEmailStatus || ''}`.trim().toLowerCase() === 'sent';

  let emailResult = {
    sent: false,
    skipped: true,
    code: 'already_sent',
    error: null,
  };
  if (!alreadySent) {
    emailResult = await sendReceiptEmail({
      payment: paymentAfterPdf,
      pdfBuffer: ensuredPdf.pdfBuffer || (await readReceiptPdfFromStorage(ensuredPdf.receiptPdfPath)),
    });
    await updatePaymentEmailStatus({ paymentRef, emailResult });
  }

  const finalSnap = await paymentRef.get();
  const finalPayment = finalSnap.exists ? finalSnap.data() || {} : paymentAfterPdf;

  return {
    paymentId,
    receiptNumber: finalPayment.receiptNumber || paymentAfterPdf.receiptNumber || null,
    receiptPdfPath: finalPayment.receiptPdfPath || paymentAfterPdf.receiptPdfPath || null,
    receiptEmailStatus: finalPayment.receiptEmailStatus || 'not_sent',
    receiptSentAt: finalPayment.receiptSentAt || null,
    stripeChargeId: finalPayment.stripeChargeId || null,
    email: emailResult,
    payment: finalPayment,
    paymentRef,
  };
};

const normalizeTotalsFromSale = (saleData = {}) => {
  const totals = saleData?.totals || {};
  const amount =
    toNumber(totals.total) ||
    toNumber(saleData.amount) ||
    toNumber(saleData.total) ||
    0;
  const vatAmount = Math.max(
    0,
    toNumber(totals.vat || totals.moms || saleData.vatAmount || saleData.vat)
  );
  const explicitSubtotal = toNumber(
    totals.subtotal || totals.subTotal || saleData.subtotalAmount || saleData.subtotal
  );
  const subtotalAmount =
    explicitSubtotal > 0 ? explicitSubtotal : Math.max(0, amount - vatAmount);
  const vatRateRaw = toNumber(totals.vatRate || saleData.vatRate);
  const vatRate =
    vatRateRaw > 0 ? vatRateRaw : subtotalAmount > 0 ? (vatAmount / subtotalAmount) * 100 : 0;

  return {
    amount,
    vatAmount,
    subtotalAmount,
    vatRate: Number(vatRate.toFixed(2)),
  };
};

const resolveSalePaymentDate = (saleData = {}) =>
  resolveDate(saleData.paymentDateTime) ||
  resolveDate(saleData.completedAt) ||
  resolveDate(saleData.createdAt) ||
  new Date();

const resolveLegacyPaymentId = ({ saleData, saleId, ownerUid }) =>
  pickFirstString(
    saleData?.paymentId,
    saleData?.stripePaymentIntentId,
    saleData?.stripeChargeId,
    saleData?.stripeCheckoutSessionId
  ) || `sale_${ownerUid || 'owner'}_${saleId}`;

const findSaleByAnyIdentifier = async ({
  saleId,
  ownerUidCandidates = [],
  clinicIdCandidates = [],
}) => {
  const normalizedSaleId = `${saleId || ''}`.trim();
  if (!normalizedSaleId) return null;

  const db = getFirestore();
  const uniqueClinicIds = Array.from(
    new Set(
      clinicIdCandidates
        .map((value) => `${value || ''}`.trim())
        .filter(Boolean)
    )
  );
  const uniqueOwnerUids = Array.from(
    new Set(
      ownerUidCandidates
        .map((value) => `${value || ''}`.trim())
        .filter(Boolean)
    )
  );

  for (const clinicId of uniqueClinicIds) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('clinics').doc(clinicId).collection('sales').doc(normalizedSaleId).get();
    if (!snap.exists) continue;
    return {
      id: snap.id,
      ref: snap.ref,
      data: snap.data() || {},
      ownerUid: `${snap.data()?.ownerUid || ''}`.trim() || null,
      clinicId,
    };
  }

  for (const ownerUid of uniqueOwnerUids) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('users').doc(ownerUid).collection('sales').doc(normalizedSaleId).get();
    if (!snap.exists) continue;
    return {
      id: snap.id,
      ref: snap.ref,
      data: snap.data() || {},
      ownerUid,
      clinicId: `${snap.data()?.clinicId || ''}`.trim() || null,
    };
  }

  const saleGroup = await db
    .collectionGroup('sales')
    .where(admin.firestore.FieldPath.documentId(), '==', normalizedSaleId)
    .limit(8)
    .get();
  if (saleGroup.empty) return null;

  const candidate = saleGroup.docs.find((docSnap) => {
    const parentDocId = `${docSnap.ref.parent?.parent?.id || ''}`.trim();
    const parentCollectionId = `${docSnap.ref.parent?.parent?.parent?.id || ''}`.trim();
    const ownerUid = parentCollectionId === 'users' ? parentDocId : '';
    const clinicId = parentCollectionId === 'clinics' ? parentDocId : '';

    if (uniqueClinicIds.length && clinicId && uniqueClinicIds.includes(clinicId)) return true;
    if (uniqueOwnerUids.length && ownerUid && uniqueOwnerUids.includes(ownerUid)) return true;
    return !uniqueClinicIds.length && !uniqueOwnerUids.length;
  });

  if (!candidate && (uniqueOwnerUids.length || uniqueClinicIds.length)) {
    return null;
  }

  const docSnap = candidate || saleGroup.docs[0];
  const parentDocId = `${docSnap.ref.parent?.parent?.id || ''}`.trim() || null;
  const parentCollectionId = `${docSnap.ref.parent?.parent?.parent?.id || ''}`.trim();
  const ownerUid = parentCollectionId === 'users' ? parentDocId : null;
  const clinicId = parentCollectionId === 'clinics' ? parentDocId : null;
  return {
    id: docSnap.id,
    ref: docSnap.ref,
    data: docSnap.data() || {},
    ownerUid,
    clinicId,
  };
};

const ensurePaymentForSale = async ({
  saleId,
  ownerUidCandidates = [],
  fallbackClinicId = null,
  fallbackAccountId = null,
}) => {
  const normalizedSaleId = `${saleId || ''}`.trim();
  if (!normalizedSaleId) {
    throw new ReceiptServiceError('Mangler saleId.', {
      code: 'missing_sale_id',
      statusCode: 400,
    });
  }

  const saleLookup = await findSaleByAnyIdentifier({
    saleId: normalizedSaleId,
    ownerUidCandidates,
    clinicIdCandidates: [fallbackClinicId, fallbackAccountId],
  });
  if (!saleLookup?.data || !saleLookup?.ref) {
    throw new ReceiptServiceError('Salget blev ikke fundet.', {
      code: 'sale_not_found',
      statusCode: 404,
    });
  }

  const saleData = saleLookup.data || {};
  if (!isPaidLikeStatus(pickFirstString(saleData.paymentStatus, saleData.status))) {
    throw new ReceiptServiceError('Kvittering kan kun håndteres for betalte salg.', {
      code: 'payment_not_paid',
      statusCode: 400,
    });
  }

  const ownerUid =
    saleLookup.ownerUid || pickFirstString(saleData.ownerUid, saleData.employeeId) || null;
  const resolvedAccountId =
    pickFirstString(saleData.accountId, saleData.clinicId, fallbackAccountId) || null;
  const resolvedClinicId = await ensureClinicId({
    clinicId: pickFirstString(saleData.clinicId, fallbackClinicId) || null,
    accountId: resolvedAccountId,
    ownerUid,
  });

  const clinicMetadata = await resolveClinicMetadata({
    clinicId: resolvedClinicId,
    accountId: resolvedAccountId,
    ownerUid,
  });
  const appointmentDetails = await resolveAppointmentDetails({
    ownerUid,
    appointmentId: pickFirstString(saleData.appointmentId) || null,
    pendingData: {
      appointmentRef: pickFirstString(saleData.appointmentRef),
      items: Array.isArray(saleData.items) ? saleData.items : [],
      serviceName: pickFirstString(saleData.serviceName),
      employeeName: pickFirstString(saleData.employeeName, saleData.employee),
    },
  });

  const totals = normalizeTotalsFromSale(saleData);
  const paidAtDate = resolveSalePaymentDate(saleData);
  const patientId = pickFirstString(saleData.customerId, saleData.patientId) || null;
  let patientName = pickFirstString(saleData.customerName, saleData.patientName, 'Patient');
  let patientEmail = normalizeEmail(
    pickFirstString(saleData.customerEmail, saleData.patientEmail)
  );
  let patientPhone = pickFirstString(saleData.customerPhone, saleData.patientPhone);

  if ((!patientEmail || !patientPhone || patientName === 'Patient') && ownerUid && patientId) {
    const clientData = await resolvePatientFromClientRecord({
      ownerUid,
      patientId,
    });
    if (clientData) {
      const currentPatientName = patientName === 'Patient' ? '' : patientName;
      patientName = pickFirstString(currentPatientName, clientData.patientName, 'Patient');
      patientEmail = patientEmail || clientData.patientEmail || '';
      patientPhone = patientPhone || clientData.patientPhone || '';
    }
  }

  const paymentId = resolveLegacyPaymentId({
    saleData,
    saleId: normalizedSaleId,
    ownerUid: ownerUid || 'owner',
  });
  const paymentDateTime = admin.firestore.Timestamp.fromDate(paidAtDate);
  const saleReceiptSentAtDate = resolveDate(saleData.receiptSentAt);
  const saleReceiptStatus = normalizeStatus(saleData.receiptEmailStatus);
  const normalizedReceiptEmailStatus =
    saleReceiptStatus === 'sent'
      ? 'sent'
      : saleReceiptStatus === 'failed'
        ? 'failed'
        : 'not_sent';

  const payload = {
    paymentId,
    clinicId: resolvedClinicId,
    patientId,
    appointmentId: pickFirstString(saleData.appointmentId) || null,
    amount: totals.amount,
    currency: toLowerCurrency(saleData.currency || 'dkk'),
    vatAmount: totals.vatAmount,
    vatRate: totals.vatRate,
    subtotalAmount: totals.subtotalAmount,
    paymentMethod: normalizePaymentMethodLabel(
      pickFirstString(saleData.paymentMethod, saleData.paymentType, 'Kortbetaling')
    ),
    stripePaymentIntentId: pickFirstString(saleData.stripePaymentIntentId) || null,
    stripeChargeId: pickFirstString(saleData.stripeChargeId) || null,
    stripeCheckoutSessionId: pickFirstString(saleData.stripeCheckoutSessionId) || null,
    status: 'paid',
    receiptNumber: pickFirstString(saleData.receiptNumber) || null,
    receiptPdfPath: pickFirstString(saleData.receiptPdfPath) || null,
    receiptEmailStatus: normalizedReceiptEmailStatus,
    receiptSentAt: saleReceiptSentAtDate
      ? admin.firestore.Timestamp.fromDate(saleReceiptSentAtDate)
      : null,
    receiptLastError: pickFirstString(saleData.receiptLastError) || null,
    patientName,
    patientEmail,
    patientPhone,
    clinicName: clinicMetadata.clinicName,
    clinicAddress: clinicMetadata.clinicAddress,
    clinicCvr: clinicMetadata.clinicCvr,
    therapistName: appointmentDetails.therapistName,
    serviceName: appointmentDetails.serviceName,
    appointmentDateTime: appointmentDetails.appointmentDateTime
      ? admin.firestore.Timestamp.fromDate(appointmentDetails.appointmentDateTime)
      : null,
    appointmentLabel: appointmentDetails.appointmentLabel,
    ownerUid: ownerUid || null,
    saleId: normalizedSaleId,
    paymentDateTime,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const { paymentRef } = await upsertPaymentWithReceiptNumber({
    paymentId,
    clinicId: resolvedClinicId,
    paidAtDate,
    receiptPrefix: clinicMetadata.receiptPrefix,
    payload,
  });

  const snap = await paymentRef.get();
  const payment = snap.exists ? snap.data() || {} : payload;

  await saleLookup.ref.set(
    {
      paymentId,
      paymentStatus: 'paid',
      receiptNumber: payment.receiptNumber || null,
      receiptPdfPath: payment.receiptPdfPath || null,
      receiptEmailStatus: payment.receiptEmailStatus || 'not_sent',
      stripeChargeId: payment.stripeChargeId || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: paymentRef.id,
    ref: paymentRef,
    data: payment,
    saleLookup,
  };
};

const findPaymentByAnyIdentifier = async ({ paymentId }) => {
  const candidate = `${paymentId || ''}`.trim();
  if (!candidate) {
    throw new ReceiptServiceError('Mangler paymentId.', {
      code: 'missing_payment_id',
      statusCode: 400,
    });
  }

  const db = getFirestore();
  const directRef = db.collection('payments').doc(candidate);
  const directSnap = await directRef.get();
  if (directSnap.exists) {
    return {
      id: directSnap.id,
      ref: directRef,
      data: directSnap.data() || {},
    };
  }

  const searchableFields = [
    'stripePaymentIntentId',
    'stripeChargeId',
    'stripeCheckoutSessionId',
    'paymentId',
    'saleId',
  ];
  for (const field of searchableFields) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('payments').where(field, '==', candidate).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return {
        id: doc.id,
        ref: doc.ref,
        data: doc.data() || {},
      };
    }
  }
  return null;
};

const assertPaidPayment = (payment = {}) => {
  const status = pickFirstString(payment.status, payment.paymentStatus);
  if (!isPaidLikeStatus(status)) {
    throw new ReceiptServiceError('Kvittering kan kun håndteres for betalte betalinger.', {
      code: 'payment_not_paid',
      statusCode: 400,
    });
  }
};

const ensureReceiptDownloadUrl = async ({ paymentLookup }) => {
  if (!paymentLookup?.ref || !paymentLookup?.data) {
    throw new ReceiptServiceError('Betalingen blev ikke fundet.', {
      code: 'payment_not_found',
      statusCode: 404,
    });
  }
  assertPaidPayment(paymentLookup.data);

  const ensuredPdf = await ensureReceiptPdf({
    paymentRef: paymentLookup.ref,
    payment: paymentLookup.data,
    forceRegenerate: false,
    returnBuffer: false,
  });
  const refreshedSnap = await paymentLookup.ref.get();
  const payment = refreshedSnap.exists ? refreshedSnap.data() || {} : paymentLookup.data;
  const { url, expiresAt } = await createSignedReceiptUrl(
    ensuredPdf.receiptPdfPath || payment.receiptPdfPath
  );

  return {
    url,
    expiresAt,
    payment,
  };
};

const resendReceiptEmailForPayment = async ({ paymentLookup }) => {
  if (!paymentLookup?.ref || !paymentLookup?.data) {
    throw new ReceiptServiceError('Betalingen blev ikke fundet.', {
      code: 'payment_not_found',
      statusCode: 404,
    });
  }
  assertPaidPayment(paymentLookup.data);

  const recipient = normalizeEmail(paymentLookup.data.patientEmail);
  if (!recipient) {
    throw new ReceiptServiceError('Patientens e-mail mangler.', {
      code: 'missing_patient_email',
      statusCode: 400,
    });
  }

  const ensuredPdf = await ensureReceiptPdf({
    paymentRef: paymentLookup.ref,
    payment: paymentLookup.data,
    forceRegenerate: false,
    returnBuffer: true,
  });

  const refreshedSnap = await paymentLookup.ref.get();
  const refreshedPayment = refreshedSnap.exists ? refreshedSnap.data() || {} : paymentLookup.data;
  const emailResult = await sendReceiptEmail({
    payment: refreshedPayment,
    pdfBuffer: ensuredPdf.pdfBuffer || (await readReceiptPdfFromStorage(refreshedPayment.receiptPdfPath)),
  });
  await updatePaymentEmailStatus({
    paymentRef: paymentLookup.ref,
    emailResult,
  });

  if (!emailResult.sent) {
    throw new ReceiptServiceError(
      emailResult.error || 'Kunne ikke gensende kvittering.',
      {
        code: emailResult.code || 'receipt_email_failed',
        statusCode: 502,
      }
    );
  }

  const finalSnap = await paymentLookup.ref.get();
  const payment = finalSnap.exists ? finalSnap.data() || {} : refreshedPayment;
  return {
    payment,
    emailResult,
  };
};

module.exports = {
  ReceiptServiceError,
  SIGNED_URL_TTL_MS,
  syncPaymentReceiptForSale,
  ensurePaymentForSale,
  findPaymentByAnyIdentifier,
  ensureReceiptDownloadUrl,
  resendReceiptEmailForPayment,
};
