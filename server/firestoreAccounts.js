const { admin, getFirestore } = require('./firebaseAdmin');

const DEFAULT_ACCOUNT_FIELDS = {
  plan: null,
  subscriptionStatus: 'none',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
};
const DEFAULT_CLINIC_TYPE = 'solo';

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

const normalizeEmail = (value) => `${value || ''}`.trim().toLowerCase();
const normalizeClinicType = (value) => (`${value || ''}`.trim().toLowerCase() === 'team' ? 'team' : 'solo');

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

const getClinicById = async (clinicId) => {
  if (!clinicId) return null;
  const db = getFirestore();
  const snap = await db.collection('clinics').doc(clinicId).get();
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

const setClinicFields = async (clinicId, payload) => {
  if (!clinicId) return;
  const db = getFirestore();
  await db.collection('clinics').doc(clinicId).set(payload, { merge: true });
};

const setClinicMemberFields = async (clinicId, uid, payload) => {
  if (!clinicId || !uid) return;
  const db = getFirestore();
  await db.collection('clinics').doc(clinicId).collection('members').doc(uid).set(payload, {
    merge: true,
  });
};

const pickFirstString = (...values) => {
  const found = values.find((value) => typeof value === 'string' && value.trim());
  return found ? found.trim() : '';
};

const buildClinicName = ({ userDoc, account }) =>
  pickFirstString(
    userDoc?.clinicName,
    account?.name,
    userDoc?.displayName,
    userDoc?.email,
    'Klinik'
  );

const findOwnedClinicByUid = async (uid) => {
  if (!uid) return null;
  const db = getFirestore();
  const snap = await db.collection('clinics').where('ownerUid', '==', uid).limit(1).get();
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...first.data() };
};

const ensureClinicOwnerMembership = async ({ clinicId, uid, displayName, email }) => {
  if (!clinicId || !uid) return;
  const db = getFirestore();
  const memberRef = db.collection('clinics').doc(clinicId).collection('members').doc(uid);
  const memberSnap = await memberRef.get();
  const payload = {
    role: 'owner',
    displayName: displayName || '',
    email: email || '',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!memberSnap.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await memberRef.set(payload, { merge: true });
};

const linkPublicClinicsByOwner = async ({ ownerUid, clinicId }) => {
  if (!ownerUid || !clinicId) return 0;
  const db = getFirestore();
  const snap = await db.collection('publicClinics').where('ownerUid', '==', ownerUid).get();
  if (snap.empty) return 0;
  const refsToUpdate = snap.docs.filter((docSnap) => {
    const data = docSnap.data() || {};
    return !(`${data.clinicId || ''}`.trim());
  });
  if (!refsToUpdate.length) return 0;
  await Promise.all(
    refsToUpdate.map((docSnap) =>
      docSnap.ref.set(
        {
          clinicId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
  return refsToUpdate.length;
};

const getActiveClinicId = async (uid) => {
  if (!uid) return null;
  const db = getFirestore();
  const userDoc = await getUserById(uid);
  if (!userDoc) return null;

  const userRef = db.collection('users').doc(uid);
  const accountId = userDoc.accountId || null;
  const account = accountId ? await getAccountById(accountId) : null;

  let clinicId = `${userDoc.activeClinicId || ''}`.trim() || null;
  let clinic = clinicId ? await getClinicById(clinicId) : null;

  if (!clinic) {
    const ownedClinic = await findOwnedClinicByUid(uid);
    if (ownedClinic) {
      clinicId = ownedClinic.id;
      clinic = ownedClinic;
    }
  }

  if (!clinic) {
    const fallbackClinicId = pickFirstString(accountId) || db.collection('clinics').doc().id;
    clinicId = clinicId || fallbackClinicId;
    clinic = { id: clinicId };
  }

  const clinicType = normalizeClinicType(userDoc.accountType || userDoc.clinicType || DEFAULT_CLINIC_TYPE);
  const clinicPayload = {
    ownerUid: clinic?.ownerUid || uid,
    clinicType,
    name: clinic?.name || buildClinicName({ userDoc, account }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!clinic?.createdAt) {
    clinicPayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  // Backfill Stripe Connect data from legacy account fields when available.
  if (!clinic?.stripeAccountId && account?.stripeConnectAccountId) {
    clinicPayload.stripeAccountId = account.stripeConnectAccountId;
  }
  if (!clinic?.stripeStatus && account?.stripeConnect) {
    clinicPayload.stripeStatus = {
      charges_enabled: Boolean(account.stripeConnect.chargesEnabled),
      payouts_enabled: Boolean(account.stripeConnect.payoutsEnabled),
      details_submitted: Boolean(account.stripeConnect.detailsSubmitted),
    };
  }

  await setClinicFields(clinicId, clinicPayload);
  await ensureClinicOwnerMembership({
    clinicId,
    uid,
    displayName: userDoc.displayName || null,
    email: userDoc.email || null,
  });

  if (!userDoc.activeClinicId || userDoc.activeClinicId !== clinicId) {
    await userRef.set(
      {
        activeClinicId: clinicId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const linkedCount = await linkPublicClinicsByOwner({ ownerUid: uid, clinicId });
  if (process.env.NODE_ENV !== 'production') {
    console.info('[firestoreAccounts] getActiveClinicId', {
      uid,
      clinicId,
      source: userDoc.activeClinicId ? 'user.activeClinicId' : 'fallback/bootstrap',
      linkedPublicClinics: linkedCount,
    });
  }

  return clinicId;
};

const buildUserSubscriptionFields = (subscriptionPayload = {}) => {
  const status = subscriptionPayload?.status || null;
  const plan = subscriptionPayload?.plan || null;
  const stripeCustomerId = subscriptionPayload?.stripeCustomerId || null;
  const stripeSubscriptionId = subscriptionPayload?.stripeSubscriptionId || null;
  const createdAt = subscriptionPayload?.createdAt || null;
  const currentPeriodEnd = subscriptionPayload?.currentPeriodEnd || null;
  const cancelAtPeriodEnd = Boolean(subscriptionPayload?.cancelAtPeriodEnd);
  const canceledAt = subscriptionPayload?.canceledAt || null;
  const seatsIncluded =
    typeof subscriptionPayload?.seatsIncluded === 'number'
      ? subscriptionPayload.seatsIncluded
      : undefined;

  return {
    subscription: {
      status,
      plan,
      stripeCustomerId,
      stripeSubscriptionId,
      createdAt,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      canceledAt,
    },
    subscriptionStatus: status,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    canceledAt,
    seatsIncluded,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const setUserSubscription = async (uid, subscriptionPayload = {}) => {
  if (!uid) return;
  await setUserFields(uid, buildUserSubscriptionFields(subscriptionPayload));
};

const updateUsersByEmail = async (email, payload) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const db = getFirestore();
  const candidateEmails = Array.from(new Set([`${email || ''}`.trim(), normalizedEmail].filter(Boolean)));
  const docById = new Map();

  await Promise.all(
    candidateEmails.map(async (candidate) => {
      const snap = await db.collection('users').where('email', '==', candidate).get();
      snap.docs.forEach((docSnap) => {
        docById.set(docSnap.id, docSnap.ref);
      });
    })
  );

  const refs = Array.from(docById.values());
  if (!refs.length) return [];

  await Promise.all(refs.map((ref) => ref.set(payload, { merge: true })));
  return Array.from(docById.keys());
};

module.exports = {
  ensureAccountForUser,
  getActiveClinicId,
  getAccountById,
  getClinicById,
  getUserById,
  setAccountFields,
  setClinicFields,
  setClinicMemberFields,
  setUserFields,
  setUserSubscription,
  updateUsersByEmail,
  buildUserSubscriptionFields,
  DEFAULT_ACCOUNT_FIELDS,
  DEFAULT_CLINIC_TYPE,
};
