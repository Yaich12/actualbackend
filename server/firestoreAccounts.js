const { admin, getFirestore } = require('./firebaseAdmin');

const normalizeEmail = (email) => `${email || ''}`.trim().toLowerCase();

const getUserById = async (uid) => {
  if (!uid) return null;
  const snap = await getFirestore().collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
};

const getAccountById = async (accountId) => {
  if (!accountId) return null;
  const snap = await getFirestore().collection('accounts').doc(accountId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
};

const setUserFields = async (uid, fields) => {
  if (!uid) return;
  await getFirestore().collection('users').doc(uid).set(fields, { merge: true });
};

const setAccountFields = async (accountId, fields) => {
  if (!accountId) return;
  await getFirestore().collection('accounts').doc(accountId).set(fields, { merge: true });
};

const setUserSubscription = async (uid, subscriptionPayload) => {
  if (!uid || !subscriptionPayload) return;
  const payload = {
    subscription: subscriptionPayload,
    subscriptionStatus: subscriptionPayload.status || null,
    plan: subscriptionPayload.plan || null,
    stripeCustomerId: subscriptionPayload.stripeCustomerId || null,
    stripeSubscriptionId: subscriptionPayload.stripeSubscriptionId || null,
    currentPeriodEnd: subscriptionPayload.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(subscriptionPayload.cancelAtPeriodEnd),
    canceledAt: subscriptionPayload.canceledAt ?? null,
    seatsIncluded: subscriptionPayload.seatsIncluded ?? null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await setUserFields(uid, payload);
};

const ensureAccountForUser = async ({ uid, email, displayName }) => {
  if (!uid) throw new Error('Missing uid');
  const db = getFirestore();
  const userDoc = await getUserById(uid);
  if (userDoc?.accountId) {
    return { accountId: userDoc.accountId };
  }

  const accountRef = db.collection('accounts').doc();
  const accountId = accountRef.id;
  const payload = {
    ownerUid: uid,
    email: email || userDoc?.email || null,
    displayName: displayName || userDoc?.displayName || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await accountRef.set(payload, { merge: true });

  await setUserFields(uid, {
    accountId,
    role: userDoc?.role || 'owner',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(email ? { email } : {}),
    ...(displayName ? { displayName } : {}),
  });

  return { accountId };
};

const updateUsersByEmail = async (email, payload) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const db = getFirestore();
  const updates = [];
  const pushDocs = (snap) => {
    snap.docs.forEach((doc) => {
      updates.push({ id: doc.id, ref: doc.ref });
    });
  };
  const snapByEmail = await db.collection('users').where('email', '==', normalized).get();
  pushDocs(snapByEmail);
  if (!updates.length) {
    const snapByEmailLower = await db
      .collection('users')
      .where('emailLowercase', '==', normalized)
      .get();
    pushDocs(snapByEmailLower);
  }
  await Promise.all(
    updates.map((user) =>
      user.ref.set(
        {
          subscription: payload,
          subscriptionStatus: payload.status || null,
          plan: payload.plan || null,
          stripeCustomerId: payload.stripeCustomerId || null,
          stripeSubscriptionId: payload.stripeSubscriptionId || null,
          currentPeriodEnd: payload.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: Boolean(payload.cancelAtPeriodEnd),
          canceledAt: payload.canceledAt ?? null,
          seatsIncluded: payload.seatsIncluded ?? null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
  return updates.map((user) => user.id);
};

module.exports = {
  ensureAccountForUser,
  getAccountById,
  getUserById,
  setAccountFields,
  setUserFields,
  setUserSubscription,
  updateUsersByEmail,
};
const { admin, getFirestore } = require('./firebaseAdmin');

const DEFAULT_ACCOUNT_FIELDS = {
  plan: null,
  subscriptionStatus: 'none',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  seatsIncluded: 1,
};

const ensureAccountForUser = async ({ uid, email = null, displayName = null } = {}) => {
  if (!uid) {
    throw new Error('Missing uid for ensureAccountForUser');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    if (userData.accountId) {
      return { accountId: userData.accountId, created: false };
    }

    const accountRef = db.collection('accounts').doc();
    const accountId = accountRef.id;
    const createdAt = admin.firestore.FieldValue.serverTimestamp();

    tx.set(
      accountRef,
      {
        ownerUid: uid,
        ...DEFAULT_ACCOUNT_FIELDS,
        createdAt,
      },
      { merge: true }
    );

    const memberRef = accountRef.collection('members').doc(uid);
    tx.set(memberRef, {
      role: 'owner',
      createdAt,
    });

    tx.set(
      userRef,
      {
        accountId,
        role: 'owner',
        email: email || userData.email || null,
        displayName: displayName || userData.displayName || null,
        updatedAt: createdAt,
      },
      { merge: true }
    );

    return { accountId, created: true };
  });

  return result;
};

const getAccountById = async (accountId) => {
  if (!accountId) return null;
  const db = getFirestore();
  const snap = await db.collection('accounts').doc(accountId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
};

const getUserById = async (uid) => {
  if (!uid) return null;
  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
};

const setAccountFields = async (accountId, payload) => {
  if (!accountId) return;
  const db = getFirestore();
  await db.collection('accounts').doc(accountId).set(payload, { merge: true });
};

const setUserFields = async (uid, payload) => {
  if (!uid) return;
  const db = getFirestore();
  await db.collection('users').doc(uid).set(payload, { merge: true });
};

const setUserSubscription = async (uid, subscriptionPayload) => {
  if (!uid) return;
  const db = getFirestore();
  await db.collection('users').doc(uid).set(
    {
      subscription: subscriptionPayload,
    },
    { merge: true }
  );
};

const normalizeEmail = (email) => `${email || ''}`.trim().toLowerCase();

const getUsersByEmail = async (email) => {
  const raw = `${email || ''}`.trim();
  if (!raw) return [];
  const db = getFirestore();
  const exactSnap = await db.collection('users').where('email', '==', raw).get();
  if (!exactSnap.empty) {
    return exactSnap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }));
  }
  const lowered = normalizeEmail(raw);
  if (!lowered) return [];
  const lowerSnap = await db
    .collection('users')
    .where('emailLowercase', '==', lowered)
    .get();
  return lowerSnap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }));
};

const updateUsersByEmail = async (email, subscriptionPayload) => {
  const lowered = normalizeEmail(email);
  const users = await getUsersByEmail(email);
  if (!users.length) return [];
  await Promise.all(
    users.map((user) =>
      user.ref.set(
        {
          subscription: subscriptionPayload,
          emailLowercase: lowered || null,
        },
        { merge: true }
      )
    )
  );
  return users.map((user) => user.id);
};

module.exports = {
  ensureAccountForUser,
  getAccountById,
  getUserById,
  setAccountFields,
  setUserFields,
  setUserSubscription,
  updateUsersByEmail,
  DEFAULT_ACCOUNT_FIELDS,
};
