const { admin, getFirestore } = require('./firebaseAdmin');

const DEFAULT_ACCOUNT_FIELDS = {
  plan: null,
  subscriptionStatus: 'none',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
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

module.exports = {
  ensureAccountForUser,
  getAccountById,
  getUserById,
  setAccountFields,
  DEFAULT_ACCOUNT_FIELDS,
};
