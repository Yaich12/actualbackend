const express = require('express');
const { admin, getAuth, getFirestore } = require('../server/firebaseAdmin');

const router = express.Router();

const RESEND_API_KEY = `${process.env.RESEND_API_KEY || ''}`.trim();
const RESEND_API_BASE = `${process.env.RESEND_API_BASE || 'https://api.resend.com'}`
  .trim()
  .replace(/\/+$/, '');
const TEAM_MEMBER_LOGIN_FROM_EMAIL =
  `${process.env.TEAM_MEMBER_LOGIN_FROM_EMAIL || process.env.STRIPE_SALE_LINK_FROM_EMAIL || process.env.BOOKING_CONFIRMATION_FROM_EMAIL || ''}`.trim() ||
  'Selma+ <booking@booking.selmaplus.tech>';
const TEAM_MEMBER_LOGIN_REPLY_TO_EMAIL =
  `${process.env.TEAM_MEMBER_LOGIN_REPLY_TO_EMAIL || process.env.STRIPE_SALE_LINK_REPLY_TO_EMAIL || ''}`.trim();

const normalizeEmail = (value) => `${value || ''}`.trim().toLowerCase();
const pickFirstString = (...values) => {
  const found = values.find((value) => typeof value === 'string' && value.trim());
  return found ? found.trim() : '';
};
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(`${value || ''}`.trim());
const escapeHtml = (value) =>
  String(value || '').replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
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
  const fallback = pickFirstString(process.env.APP_URL, process.env.REACT_APP_APP_URL, process.env.NEXT_PUBLIC_APP_URL);
  return normalizeBaseUrl(fallback || 'http://localhost:3000');
};

const sendResendEmail = async ({ toEmail, subject, text, html }) => {
  const recipient = normalizeEmail(toEmail);
  if (!recipient) {
    return {
      sent: false,
      skipped: true,
      reason: 'missing_recipient_email',
      error: 'Kontakt-email mangler.',
    };
  }
  if (!RESEND_API_KEY || !TEAM_MEMBER_LOGIN_FROM_EMAIL) {
    return {
      sent: false,
      skipped: true,
      reason: 'missing_email_config',
      error: 'E-mailopsætning mangler på serveren.',
    };
  }

  const payload = {
    from: TEAM_MEMBER_LOGIN_FROM_EMAIL,
    to: [recipient],
    subject,
    text,
    html,
  };
  if (TEAM_MEMBER_LOGIN_REPLY_TO_EMAIL) {
    payload.reply_to = TEAM_MEMBER_LOGIN_REPLY_TO_EMAIL;
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

const normalizeUid = (value) => `${value || ''}`.trim();
const normalizeRole = (value) => `${value || ''}`.trim().toLowerCase();
const hasText = (value) => typeof value === 'string' && value.trim();
const logDebug = (tag, message, details = undefined) => {
  if (details === undefined) {
    console.info(`${tag} ${message}`);
    return;
  }
  console.info(`${tag} ${message}`, details);
};
const isFailedPreconditionError = (error) => {
  const numericCode = Number(error?.code);
  const codeText = `${error?.code || ''}`.toLowerCase();
  const message = `${error?.message || ''}`.toLowerCase();
  return (
    numericCode === 9 ||
    codeText.includes('failed-precondition') ||
    message.includes('failed_precondition') ||
    message.includes('requires an index')
  );
};

const findOwnedClinic = async (db, ownerUid) => {
  const uid = normalizeUid(ownerUid);
  if (!uid) return null;

  const clinicSnap = await db.collection('clinics').where('ownerUid', '==', uid).limit(1).get();
  if (clinicSnap.empty) return null;

  return {
    clinicId: normalizeUid(clinicSnap.docs[0]?.id || ''),
    ownerUid: uid,
  };
};

const ensureClinicDocument = async ({ db, clinicId, ownerUid, userData }) => {
  const resolvedClinicId = normalizeUid(clinicId);
  const resolvedOwnerUid = normalizeUid(ownerUid);
  if (!resolvedClinicId || !resolvedOwnerUid) return;

  const clinicRef = db.collection('clinics').doc(resolvedClinicId);
  const clinicSnap = await clinicRef.get();
  const existing = clinicSnap.exists ? clinicSnap.data() || {} : {};
  const now = admin.firestore.FieldValue.serverTimestamp();
  const clinicType = normalizeRole(userData?.accountType) === 'team' ? 'team' : 'solo';
  const fallbackName = pickFirstString(
    existing?.name,
    userData?.clinicName,
    userData?.publicClinicName,
    userData?.displayName,
    userData?.email,
    'Klinik'
  );
  const payload = {
    ownerUid: resolvedOwnerUid,
    clinicType,
    name: fallbackName,
    updatedAt: now,
  };
  if (!clinicSnap.exists) {
    payload.createdAt = now;
  }
  if (userData?.settings && typeof userData.settings === 'object') {
    payload.settings = userData.settings;
  }

  const address = pickFirstString(userData?.address);
  const website = pickFirstString(userData?.website);
  const cvr = pickFirstString(`${userData?.cvr || ''}`);
  const currency = pickFirstString(userData?.currency, userData?.settings?.currency);
  const publicClinicName = pickFirstString(userData?.publicClinicName);
  const publicClinicSlug = pickFirstString(userData?.publicClinicSlug);
  const stripeAccountId = pickFirstString(userData?.stripeAccountId, userData?.stripeConnectAccountId);

  if (address) payload.address = address;
  if (website) payload.website = website;
  if (cvr) payload.cvr = cvr;
  if (currency) payload.currency = currency;
  if (publicClinicName) payload.publicClinicName = publicClinicName;
  if (publicClinicSlug) payload.publicClinicSlug = publicClinicSlug;
  if (stripeAccountId) payload.stripeAccountId = stripeAccountId;
  if (userData?.stripeStatus && typeof userData.stripeStatus === 'object') {
    payload.stripeStatus = userData.stripeStatus;
  }

  await clinicRef.set(payload, { merge: true });
};

const ensureOwnerMemberDocument = async ({ db, clinicId, ownerUid, userData, email }) => {
  const resolvedClinicId = normalizeUid(clinicId);
  const resolvedOwnerUid = normalizeUid(ownerUid);
  if (!resolvedClinicId || !resolvedOwnerUid) return;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const memberRef = db.collection('clinics').doc(resolvedClinicId).collection('members').doc(resolvedOwnerUid);
  const memberSnap = await memberRef.get();
  const existing = memberSnap.exists ? memberSnap.data() || {} : {};
  const fullName = pickFirstString(
    userData?.displayName,
    userData?.fullName,
    `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
    existing?.name,
    existing?.displayName,
    email
  );
  const authEmail = pickFirstString(email, userData?.email, existing?.email);

  const payload = {
    uid: resolvedOwnerUid,
    memberUid: resolvedOwnerUid,
    role: 'owner',
    isOwner: true,
    updatedAt: now,
  };
  if (!memberSnap.exists) {
    payload.createdAt = now;
  }
  if (fullName) {
    payload.name = fullName;
    payload.displayName = fullName;
  }
  if (authEmail) {
    payload.email = authEmail;
    payload.contactEmail = authEmail;
  }

  await memberRef.set(payload, { merge: true });
};

const findMemberInClinic = async ({ db, clinicId, memberUid }) => {
  const resolvedClinicId = normalizeUid(clinicId);
  const uid = normalizeUid(memberUid);
  if (!resolvedClinicId || !uid) return null;

  const directSnap = await db
    .collection('clinics')
    .doc(resolvedClinicId)
    .collection('members')
    .doc(uid)
    .get();
  if (directSnap.exists) {
    return {
      clinicId: resolvedClinicId,
      memberDocId: normalizeUid(directSnap.id),
      memberData: directSnap.data() || {},
      source: 'clinic-member-docid',
    };
  }

  const byMemberUid = await db
    .collection('clinics')
    .doc(resolvedClinicId)
    .collection('members')
    .where('memberUid', '==', uid)
    .limit(1)
    .get();
  if (!byMemberUid.empty) {
    return {
      clinicId: resolvedClinicId,
      memberDocId: normalizeUid(byMemberUid.docs[0]?.id || ''),
      memberData: byMemberUid.docs[0]?.data() || {},
      source: 'clinic-member-memberUid',
    };
  }

  const byUidField = await db
    .collection('clinics')
    .doc(resolvedClinicId)
    .collection('members')
    .where('uid', '==', uid)
    .limit(1)
    .get();
  if (!byUidField.empty) {
    return {
      clinicId: resolvedClinicId,
      memberDocId: normalizeUid(byUidField.docs[0]?.id || ''),
      memberData: byUidField.docs[0]?.data() || {},
      source: 'clinic-member-uid-field',
    };
  }

  return null;
};

const isLikelyLegacyOwner = async ({ db, uid, userData }) => {
  const role = normalizeRole(userData?.role);
  if (role === 'member') return false;

  const hasLegacyFields = Boolean(
    hasText(userData?.clinicName) ||
      hasText(userData?.publicClinicName) ||
      hasText(userData?.address) ||
      hasText(userData?.website) ||
      hasText(`${userData?.cvr || ''}`) ||
      hasText(userData?.publicClinicSlug) ||
      hasText(userData?.stripeAccountId) ||
      hasText(userData?.stripeConnectAccountId) ||
      (userData?.settings && Object.keys(userData.settings).length > 0)
  );
  if (hasLegacyFields) return true;

  const legacyTeamSnap = await db.collection('users').doc(uid).collection('team').limit(1).get();
  return !legacyTeamSnap.empty;
};

const migrateLegacyTeamMembersToClinic = async ({ db, ownerUid, clinicId }) => {
  const resolvedOwnerUid = normalizeUid(ownerUid);
  const resolvedClinicId = normalizeUid(clinicId);
  if (!resolvedOwnerUid || !resolvedClinicId) return { migrated: 0 };

  const legacySnap = await db.collection('users').doc(resolvedOwnerUid).collection('team').get();
  if (legacySnap.empty) return { migrated: 0 };

  const now = admin.firestore.FieldValue.serverTimestamp();
  const writeTasks = legacySnap.docs.map(async (legacyDoc) => {
    const data = legacyDoc.data() || {};
    const memberUid = normalizeUid(data.memberUid || data.uid || legacyDoc.id);
    if (!memberUid) return 0;

    const role = normalizeRole(data.role);
    const isOwnerRecord = memberUid === resolvedOwnerUid || data.isOwner === true || role === 'owner';
    const memberRole = isOwnerRecord ? 'owner' : 'member';
    const fullName = pickFirstString(
      data.name,
      data.displayName,
      `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      memberUid
    );
    const email = pickFirstString(data.email, data.authEmail, data.contactEmail);

    const memberPayload = {
      uid: memberUid,
      memberUid,
      role: memberRole,
      isOwner: isOwnerRecord,
      updatedAt: now,
    };
    if (fullName) {
      memberPayload.name = fullName;
      memberPayload.displayName = fullName;
    }
    if (data.firstName) memberPayload.firstName = data.firstName;
    if (data.lastName) memberPayload.lastName = data.lastName;
    if (email) memberPayload.email = email;
    if (data.contactEmail) memberPayload.contactEmail = data.contactEmail;
    if (data.phone) memberPayload.phone = data.phone;
    if (data.phoneCountry) memberPayload.phoneCountry = data.phoneCountry;
    if (data.phoneLocal) memberPayload.phoneLocal = data.phoneLocal;
    if (data.country) memberPayload.country = data.country;
    if (data.calendarColor) memberPayload.calendarColor = data.calendarColor;
    if (data.avatarColor) memberPayload.avatarColor = data.avatarColor;
    if (data.avatarText) memberPayload.avatarText = data.avatarText;
    if (data.loginUsername) memberPayload.loginUsername = data.loginUsername;
    if (data.loginEnabled === true) memberPayload.loginEnabled = true;
    if (data.createdAt) memberPayload.createdAt = data.createdAt;
    memberPayload.clinicOwnerUid = resolvedOwnerUid;
    memberPayload.dataOwnerUid = resolvedOwnerUid;

    await db.collection('clinics').doc(resolvedClinicId).collection('members').doc(memberUid).set(memberPayload, {
      merge: true,
    });

    if (!isOwnerRecord) {
      const userPayload = {
        activeClinicId: resolvedClinicId,
        clinicId: resolvedClinicId,
        role: 'member',
        accountType: 'team',
        hasTeam: true,
        clinicOwnerUid: resolvedOwnerUid,
        dataOwnerUid: resolvedOwnerUid,
        onboardingComplete: true,
        onboardingCompletedAt: now,
        updatedAt: now,
      };
      if (fullName) {
        userPayload.displayName = fullName;
        userPayload.fullName = fullName;
      }
      if (email) {
        userPayload.email = email;
        userPayload.authEmail = email;
      }
      await db.collection('users').doc(memberUid).set(userPayload, { merge: true });
    }

    return 1;
  });

  const results = await Promise.all(writeTasks);
  return { migrated: results.reduce((sum, value) => sum + Number(value || 0), 0) };
};

const migrateLegacyOwnerWorkspace = async ({ db, uid, userData, email }) => {
  const resolvedUid = normalizeUid(uid);
  if (!resolvedUid) return null;

  const shouldMigrate = await isLikelyLegacyOwner({ db, uid: resolvedUid, userData });
  if (!shouldMigrate) return null;

  const clinicId = normalizeUid(userData?.activeClinicId || userData?.clinicId) || db.collection('clinics').doc().id;

  await ensureClinicDocument({
    db,
    clinicId,
    ownerUid: resolvedUid,
    userData,
  });
  await ensureOwnerMemberDocument({
    db,
    clinicId,
    ownerUid: resolvedUid,
    userData,
    email,
  });
  const migration = await migrateLegacyTeamMembersToClinic({
    db,
    ownerUid: resolvedUid,
    clinicId,
  });

  return {
    clinicId,
    ownerUid: resolvedUid,
    migratedMembers: migration.migrated,
  };
};

const findMembershipInClinicsByScan = async (db, memberUid) => {
  const uid = normalizeUid(memberUid);
  if (!uid) return null;

  const pageSize = 200;
  let cursor = null;

  while (true) {
    let clinicsQuery = db.collection('clinics').limit(pageSize);
    if (cursor) {
      clinicsQuery = clinicsQuery.startAfter(cursor);
    }
    const clinicsSnap = await clinicsQuery.get();
    if (clinicsSnap.empty) return null;

    for (const clinicDoc of clinicsSnap.docs) {
      const clinicId = normalizeUid(clinicDoc.id);
      const clinicData = clinicDoc.data() || {};
      const clinicOwnerUid = normalizeUid(clinicData.ownerUid || '');
      if (!clinicId || !clinicOwnerUid || clinicOwnerUid === uid) {
        continue;
      }

      const membersRef = db.collection('clinics').doc(clinicId).collection('members');
      const candidateDocs = [];

      const directSnap = await membersRef.doc(uid).get();
      if (directSnap.exists) {
        candidateDocs.push({ docSnap: directSnap, source: 'docid' });
      }

      if (candidateDocs.length === 0) {
        const byMemberUidSnap = await membersRef.where('memberUid', '==', uid).limit(1).get();
        if (!byMemberUidSnap.empty) {
          candidateDocs.push({ docSnap: byMemberUidSnap.docs[0], source: 'memberUid' });
        }
      }

      if (candidateDocs.length === 0) {
        const byUidFieldSnap = await membersRef.where('uid', '==', uid).limit(1).get();
        if (!byUidFieldSnap.empty) {
          candidateDocs.push({ docSnap: byUidFieldSnap.docs[0], source: 'uid' });
        }
      }

      for (const candidate of candidateDocs) {
        const data = candidate.docSnap.data() || {};
        const ownerUid = normalizeUid(clinicOwnerUid || data.clinicOwnerUid || data.dataOwnerUid || '');
        const role = normalizeRole(data.role);
        const isOwnerDoc =
          data.isOwner === true || role === 'owner' || (ownerUid && ownerUid === uid);
        if (!ownerUid || isOwnerDoc) {
          continue;
        }

        return {
          source: `clinics-members-scan-${candidate.source}`,
          clinicId,
          ownerUid,
          memberData: data,
          memberRef: candidate.docSnap.ref,
        };
      }
    }

    cursor = clinicsSnap.docs[clinicsSnap.docs.length - 1];
    if (clinicsSnap.size < pageSize) {
      return null;
    }
  }
};

const findMembershipInClinics = async (db, memberUid) => {
  const uid = normalizeUid(memberUid);
  if (!uid) return null;

  const membershipDocs = [];
  const seenPaths = new Set();
  const appendDocs = (docs) => {
    (docs || []).forEach((docSnap) => {
      const path = `${docSnap?.ref?.path || ''}`.trim();
      if (!path || seenPaths.has(path)) return;
      seenPaths.add(path);
      membershipDocs.push(docSnap);
    });
  };

  try {
    const byMemberUidSnap = await db.collectionGroup('members').where('memberUid', '==', uid).limit(10).get();
    appendDocs(byMemberUidSnap.docs);
    if (membershipDocs.length === 0) {
      const byUidFieldSnap = await db.collectionGroup('members').where('uid', '==', uid).limit(10).get();
      appendDocs(byUidFieldSnap.docs);
    }
  } catch (error) {
    logDebug('[MEMBER GUARD]', 'collectionGroup lookup failed, using clinic scan fallback', {
      uid,
      error: error?.message || String(error),
    });
    if (!isFailedPreconditionError(error)) {
      // Even for non-index errors we continue with scan fallback to avoid hard-failing login flow.
      logDebug('[MEMBER GUARD]', 'non-precondition collectionGroup error, still trying scan fallback', {
        uid,
      });
    }
    return findMembershipInClinicsByScan(db, uid);
  }

  if (membershipDocs.length === 0) {
    return findMembershipInClinicsByScan(db, uid);
  }

  const clinicDocs = membershipDocs
    .map((docSnap) => ({
      docSnap,
      clinicRef: docSnap.ref.parent?.parent || null,
      data: docSnap.data() || {},
    }))
    .filter(({ clinicRef }) => clinicRef);

  for (const item of clinicDocs) {
    const clinicSnap = await item.clinicRef.get();
    const clinicData = clinicSnap.exists ? clinicSnap.data() || {} : {};
    const ownerUid = normalizeUid(
      clinicData.ownerUid || item.data.clinicOwnerUid || item.data.dataOwnerUid || ''
    );
    const docId = normalizeUid(item.docSnap?.id || '');
    const docUid = normalizeUid(item.data.uid || '');
    const docMemberUid = normalizeUid(item.data.memberUid || '');
    if (docId && docId !== uid && docUid !== uid && docMemberUid !== uid) {
      logDebug('[WORKSPACE RESOLVE]', 'membership uid mismatch candidate skipped', {
        authUid: uid,
        memberDocId: docId || null,
        memberUidField: docMemberUid || null,
        uidField: docUid || null,
        clinicId: normalizeUid(item.clinicRef.id) || null,
      });
      continue;
    }
    const role = normalizeRole(item.data.role);
    const isOwnerDoc =
      item.data.isOwner === true || role === 'owner' || (ownerUid && ownerUid === uid);
    if (isOwnerDoc || !ownerUid) {
      continue;
    }

    return {
      source: 'clinics-members',
      clinicId: normalizeUid(item.clinicRef.id),
      ownerUid,
      memberData: item.data,
      memberRef: item.docSnap.ref,
    };
  }

  return findMembershipInClinicsByScan(db, uid);
};

const findMembershipInLegacyTeam = async (db, memberUid) => {
  const uid = normalizeUid(memberUid);
  if (!uid) return null;

  const legacyDocs = [];
  const seenPaths = new Set();
  const appendDocs = (docs) => {
    (docs || []).forEach((docSnap) => {
      const path = `${docSnap?.ref?.path || ''}`.trim();
      if (!path || seenPaths.has(path)) return;
      seenPaths.add(path);
      legacyDocs.push(docSnap);
    });
  };

  try {
    // Firestore collectionGroup + documentId() equality expects a full document path.
    // Use explicit uid fields for legacy team lookup as well.
    const byMemberUidSnap = await db.collectionGroup('team').where('memberUid', '==', uid).limit(10).get();
    appendDocs(byMemberUidSnap.docs);
    if (legacyDocs.length === 0) {
      const byUidFieldSnap = await db.collectionGroup('team').where('uid', '==', uid).limit(10).get();
      appendDocs(byUidFieldSnap.docs);
    }
  } catch (error) {
    logDebug('[MEMBER GUARD]', 'legacy team collectionGroup lookup failed, skipping legacy lookup', {
      uid,
      error: error?.message || String(error),
    });
    return null;
  }
  if (legacyDocs.length === 0) return null;

  for (const legacyDoc of legacyDocs) {
    const legacyData = legacyDoc.data() || {};
    const ownerRef = legacyDoc.ref.parent?.parent || null;
    const ownerUid = normalizeUid(ownerRef?.id || '');
    if (!ownerUid || ownerUid === uid) {
      continue;
    }

    const ownerSnap = await db.collection('users').doc(ownerUid).get();
    const ownerData = ownerSnap.exists ? ownerSnap.data() || {} : {};

    let clinicId = normalizeUid(
      legacyData.activeClinicId || legacyData.clinicId || ownerData.activeClinicId || ownerData.clinicId || ''
    );

    if (!clinicId) {
      const clinicSnap = await db
        .collection('clinics')
        .where('ownerUid', '==', ownerUid)
        .limit(1)
        .get();
      if (!clinicSnap.empty) {
        clinicId = normalizeUid(clinicSnap.docs[0].id);
      }
    }

    if (!clinicId) {
      const migratedOwner = await migrateLegacyOwnerWorkspace({
        db,
        uid: ownerUid,
        userData: ownerData,
        email: ownerData?.email || '',
      });
      clinicId = normalizeUid(migratedOwner?.clinicId || '');
    }

    if (!clinicId) {
      continue;
    }

    return {
      source: 'users-team-legacy',
      clinicId,
      ownerUid,
      memberData: legacyData,
      memberRef: legacyDoc.ref,
    };
  }

  return null;
};

const upsertClinicMemberDocument = async ({ db, clinicId, memberUid, ownerUid, memberData }) => {
  if (!clinicId || !memberUid) return;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const clinicMemberRef = db.collection('clinics').doc(clinicId).collection('members').doc(memberUid);
  const clinicMemberSnap = await clinicMemberRef.get();
  const existing = clinicMemberSnap.exists ? clinicMemberSnap.data() || {} : {};

  const fullName = pickFirstString(
    memberData?.name,
    `${memberData?.firstName || ''} ${memberData?.lastName || ''}`.trim(),
    existing?.name
  );

  const payload = {
    memberUid,
    uid: memberUid,
    role: 'member',
    isOwner: false,
    updatedAt: now,
  };
  if (!clinicMemberSnap.exists) {
    payload.createdAt = now;
  }
  if (fullName) {
    payload.name = fullName;
  }
  const firstName = pickFirstString(memberData?.firstName, existing?.firstName);
  const lastName = pickFirstString(memberData?.lastName, existing?.lastName);
  const contactEmail = pickFirstString(memberData?.contactEmail, existing?.contactEmail);
  const authEmail = pickFirstString(memberData?.email, existing?.email);
  const phone = pickFirstString(memberData?.phone, existing?.phone);
  const loginUsername = pickFirstString(memberData?.loginUsername, existing?.loginUsername);

  if (firstName) payload.firstName = firstName;
  if (lastName) payload.lastName = lastName;
  if (contactEmail) payload.contactEmail = contactEmail;
  if (authEmail) payload.email = authEmail;
  if (phone) payload.phone = phone;
  if (loginUsername) payload.loginUsername = loginUsername;
  if (ownerUid) {
    payload.clinicOwnerUid = ownerUid;
    payload.dataOwnerUid = ownerUid;
  }

  await clinicMemberRef.set(payload, { merge: true });
};

const syncMemberUserProfile = async ({ db, memberUid, ownerUid, clinicId, memberData, email }) => {
  const uid = normalizeUid(memberUid);
  const resolvedOwnerUid = normalizeUid(ownerUid);
  const resolvedClinicId = normalizeUid(clinicId);
  if (!uid || !resolvedOwnerUid || !resolvedClinicId) return false;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const existing = userSnap.exists ? userSnap.data() || {} : {};

  const fullName = pickFirstString(
    memberData?.name,
    `${memberData?.firstName || ''} ${memberData?.lastName || ''}`.trim(),
    existing?.displayName,
    existing?.fullName
  );
  const authEmail = pickFirstString(email, existing?.email, memberData?.email);
  const loginUsername = pickFirstString(memberData?.loginUsername, existing?.teamMemberLogin?.username);

  const payload = {
    uid,
    role: 'member',
    accountType: 'team',
    hasTeam: true,
    activeClinicId: resolvedClinicId,
    clinicId: resolvedClinicId,
    clinicOwnerUid: resolvedOwnerUid,
    dataOwnerUid: resolvedOwnerUid,
    onboardingComplete: true,
    onboardingCompletedAt: now,
    updatedAt: now,
  };
  if (!userSnap.exists) {
    payload.createdAt = now;
  }
  if (fullName) {
    payload.displayName = fullName;
    payload.fullName = fullName;
  }
  if (authEmail) {
    payload.email = authEmail;
    payload.authEmail = authEmail;
  }
  if (loginUsername) {
    payload.teamMemberLogin = {
      username: loginUsername,
      enabled: true,
      updatedAt: now,
    };
  }

  logDebug('[FIRESTORE SYNC]', 'syncing users/{memberUid} after workspace resolve', {
    uid,
    clinicId: resolvedClinicId,
    ownerUid: resolvedOwnerUid,
    role: payload.role,
    onboardingComplete: payload.onboardingComplete === true,
  });
  logDebug('[WORKSPACE SYNC]', 'syncing member workspace fields to users/{uid}', {
    uid,
    clinicId: resolvedClinicId,
    ownerUid: resolvedOwnerUid,
    role: payload.role,
    onboardingComplete: payload.onboardingComplete === true,
  });
  await userRef.set(payload, { merge: true });
  logDebug('[FIRESTORE SYNC]', 'synced users/{memberUid} after workspace resolve', {
    uid,
    activeClinicId: resolvedClinicId,
    role: payload.role,
    onboardingComplete: true,
  });
  logDebug('[WORKSPACE SYNC]', 'member workspace fields synced to users/{uid}', {
    uid,
    activeClinicId: resolvedClinicId,
    role: payload.role,
    onboardingComplete: true,
    ownerUid: resolvedOwnerUid,
  });
  return true;
};

const syncOwnerUserProfile = async ({ db, ownerUid, clinicId, userData, email }) => {
  const uid = normalizeUid(ownerUid);
  const resolvedClinicId = normalizeUid(clinicId);
  if (!uid || !resolvedClinicId) return false;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const existing = userSnap.exists ? userSnap.data() || {} : {};
  const fullName = pickFirstString(
    userData?.displayName,
    userData?.fullName,
    `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
    existing?.displayName,
    existing?.fullName
  );
  const authEmail = pickFirstString(email, userData?.email, existing?.email);

  const payload = {
    uid,
    role: 'owner',
    activeClinicId: resolvedClinicId,
    clinicId: resolvedClinicId,
    onboardingComplete: true,
    onboardingCompletedAt: now,
    updatedAt: now,
    clinicOwnerUid: admin.firestore.FieldValue.delete(),
    dataOwnerUid: admin.firestore.FieldValue.delete(),
  };
  if (!userSnap.exists) {
    payload.createdAt = now;
  }
  if (fullName) {
    payload.displayName = fullName;
    payload.fullName = fullName;
  }
  if (authEmail) {
    payload.email = authEmail;
    payload.authEmail = authEmail;
  }

  await userRef.set(payload, { merge: true });
  return true;
};

const resolveUserWorkspaceHandler = async (req, res) => {
  try {
    const sessionUid = normalizeUid(req.user?.uid);
    if (!sessionUid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const db = getFirestore();
    const sessionUserRef = db.collection('users').doc(sessionUid);
    const sessionUserSnap = await sessionUserRef.get();
    const sessionUserData = sessionUserSnap.exists ? sessionUserSnap.data() || {} : {};
    const sessionEmail = req.user?.email || sessionUserData.email || '';
    logDebug('[WORKSPACE RESOLVE]', 'resolve-user-workspace start', {
      uid: sessionUid,
      email: sessionEmail || null,
    });
    logDebug('[WORKSPACE RESOLVE]', 'loaded users/{uid} in resolver', {
      uid: sessionUid,
      userExists: sessionUserSnap.exists,
      activeClinicId: normalizeUid(sessionUserData.activeClinicId) || null,
      role: normalizeRole(sessionUserData.role) || null,
      onboardingComplete:
        typeof sessionUserData.onboardingComplete === 'boolean'
          ? sessionUserData.onboardingComplete
          : null,
    });

    // 1) If activeClinicId exists, trust it first and validate ownership/membership in that clinic.
    const activeClinicId = normalizeUid(sessionUserData.activeClinicId);
    if (activeClinicId) {
      logDebug('[WORKSPACE RESOLVE]', 'checking activeClinicId first', {
        uid: sessionUid,
        activeClinicId,
      });
      const clinicSnap = await db.collection('clinics').doc(activeClinicId).get();
      if (clinicSnap.exists) {
        const clinicData = clinicSnap.data() || {};
        const clinicOwnerUid = normalizeUid(clinicData.ownerUid);

        if (clinicOwnerUid && clinicOwnerUid === sessionUid) {
          await ensureClinicDocument({
            db,
            clinicId: activeClinicId,
            ownerUid: sessionUid,
            userData: sessionUserData,
          });
          await ensureOwnerMemberDocument({
            db,
            clinicId: activeClinicId,
            ownerUid: sessionUid,
            userData: sessionUserData,
            email: sessionEmail,
          });
          const migration = await migrateLegacyTeamMembersToClinic({
            db,
            ownerUid: sessionUid,
            clinicId: activeClinicId,
          });
          await syncOwnerUserProfile({
            db,
            ownerUid: sessionUid,
            clinicId: activeClinicId,
            userData: sessionUserData,
            email: sessionEmail,
          });
          return res.json({
            ok: true,
            isOwner: true,
            isMember: false,
            synced: true,
            clinicId: activeClinicId,
            ownerUid: sessionUid,
            source: 'activeClinicId-owner',
            migratedLegacyMembers: migration.migrated,
          });
        }

        const memberInActiveClinic = await findMemberInClinic({
          db,
          clinicId: activeClinicId,
          memberUid: sessionUid,
        });
        if (memberInActiveClinic?.memberData) {
          const candidateDocId = normalizeUid(memberInActiveClinic.memberDocId || '');
          const candidateDocUid = normalizeUid(memberInActiveClinic.memberData?.uid || '');
          const candidateMemberUid = normalizeUid(memberInActiveClinic.memberData?.memberUid || '');
          if (
            candidateDocId &&
            candidateDocId !== sessionUid &&
            candidateDocUid !== sessionUid &&
            candidateMemberUid !== sessionUid
          ) {
            logDebug('[WORKSPACE RESOLVE]', 'uid mismatch while resolving active clinic member', {
              authUid: sessionUid,
              memberDocId: candidateDocId,
              memberUidField: candidateMemberUid,
              uidField: candidateDocUid,
              clinicId: activeClinicId,
            });
          }
          const resolvedOwnerUid = normalizeUid(
            clinicOwnerUid ||
              memberInActiveClinic.memberData?.clinicOwnerUid ||
              memberInActiveClinic.memberData?.dataOwnerUid ||
              ''
          );
          if (!resolvedOwnerUid) {
            return res.json({
              ok: true,
              isOwner: false,
              isMember: false,
              synced: false,
              source: 'activeClinicId-member-missing-owner',
            });
          }
          await ensureClinicDocument({
            db,
            clinicId: activeClinicId,
            ownerUid: resolvedOwnerUid,
            userData: sessionUserData,
          });
          await upsertClinicMemberDocument({
            db,
            clinicId: activeClinicId,
            memberUid: sessionUid,
            ownerUid: resolvedOwnerUid,
            memberData: memberInActiveClinic.memberData,
          });
          await syncMemberUserProfile({
            db,
            memberUid: sessionUid,
            ownerUid: resolvedOwnerUid,
            clinicId: activeClinicId,
            memberData: memberInActiveClinic.memberData,
            email: sessionEmail,
          });
          logDebug('[WORKSPACE RESOLVE]', 'workspace resolved from activeClinic membership', {
            uid: sessionUid,
            clinicId: activeClinicId,
            ownerUid: resolvedOwnerUid,
            source: `activeClinicId-${memberInActiveClinic.source}`,
          });
          return res.json({
            ok: true,
            isOwner: false,
            isMember: true,
            synced: true,
            clinicId: activeClinicId,
            ownerUid: resolvedOwnerUid,
            source: `activeClinicId-${memberInActiveClinic.source}`,
          });
        }
      }
    }

    // 2) If activeClinicId is missing (or stale), resolve via membership lookup.
    logDebug('[MEMBER GUARD]', 'running membership guard lookup in resolver', {
      uid: sessionUid,
    });
    const membership =
      (await findMembershipInClinics(db, sessionUid)) || (await findMembershipInLegacyTeam(db, sessionUid));
    logDebug('[WORKSPACE RESOLVE]', 'membership lookup result', {
      uid: sessionUid,
      found: Boolean(membership?.clinicId && membership?.ownerUid),
      clinicId: membership?.clinicId || null,
      ownerUid: membership?.ownerUid || null,
      source: membership?.source || null,
    });

    if (membership?.ownerUid && membership?.clinicId) {
      logDebug('[MEMBER GUARD]', 'membership guard matched clinic member', {
        uid: sessionUid,
        clinicId: membership.clinicId,
        ownerUid: membership.ownerUid,
        source: membership.source,
      });
      await ensureClinicDocument({
        db,
        clinicId: membership.clinicId,
        ownerUid: membership.ownerUid,
        userData: sessionUserData,
      });
      await upsertClinicMemberDocument({
        db,
        clinicId: membership.clinicId,
        memberUid: sessionUid,
        ownerUid: membership.ownerUid,
        memberData: membership.memberData,
      });
      await syncMemberUserProfile({
        db,
        memberUid: sessionUid,
        ownerUid: membership.ownerUid,
        clinicId: membership.clinicId,
        memberData: membership.memberData,
        email: sessionEmail,
      });
      logDebug('[WORKSPACE RESOLVE]', 'workspace resolved from membership lookup', {
        uid: sessionUid,
        clinicId: membership.clinicId,
        ownerUid: membership.ownerUid,
        source: membership.source,
      });

      return res.json({
        ok: true,
        isOwner: false,
        isMember: true,
        synced: true,
        clinicId: membership.clinicId,
        ownerUid: membership.ownerUid,
        source: membership.source,
      });
    }

    // 3) Resolve owner workspace by clinics.ownerUid.
    const ownedClinic = await findOwnedClinic(db, sessionUid);
    if (ownedClinic?.clinicId) {
      await ensureClinicDocument({
        db,
        clinicId: ownedClinic.clinicId,
        ownerUid: sessionUid,
        userData: sessionUserData,
      });
      await ensureOwnerMemberDocument({
        db,
        clinicId: ownedClinic.clinicId,
        ownerUid: sessionUid,
        userData: sessionUserData,
        email: sessionEmail,
      });
      const migration = await migrateLegacyTeamMembersToClinic({
        db,
        ownerUid: sessionUid,
        clinicId: ownedClinic.clinicId,
      });
      await syncOwnerUserProfile({
        db,
        ownerUid: sessionUid,
        clinicId: ownedClinic.clinicId,
        userData: sessionUserData,
        email: sessionEmail,
      });
      logDebug('[WORKSPACE RESOLVE]', 'workspace resolved from owner clinic query', {
        uid: sessionUid,
        clinicId: ownedClinic.clinicId,
        ownerUid: sessionUid,
        source: 'owner-query',
      });
      return res.json({
        ok: true,
        isOwner: true,
        isMember: false,
        synced: true,
        clinicId: ownedClinic.clinicId,
        ownerUid: sessionUid,
        source: 'owner-query',
        migratedLegacyMembers: migration.migrated,
      });
    }

    // 4) Minimal legacy owner migration from users/{ownerUid} -> clinics/{clinicId}.
    const migratedLegacyOwner = await migrateLegacyOwnerWorkspace({
      db,
      uid: sessionUid,
      userData: sessionUserData,
      email: sessionEmail,
    });
    if (migratedLegacyOwner?.clinicId) {
      await syncOwnerUserProfile({
        db,
        ownerUid: sessionUid,
        clinicId: migratedLegacyOwner.clinicId,
        userData: sessionUserData,
        email: sessionEmail,
      });
      logDebug('[WORKSPACE RESOLVE]', 'workspace resolved from legacy owner migration', {
        uid: sessionUid,
        clinicId: migratedLegacyOwner.clinicId,
        ownerUid: sessionUid,
        source: 'legacy-owner-migration',
      });
      return res.json({
        ok: true,
        isOwner: true,
        isMember: false,
        synced: true,
        clinicId: migratedLegacyOwner.clinicId,
        ownerUid: sessionUid,
        source: 'legacy-owner-migration',
        migratedLegacyMembers: migratedLegacyOwner.migratedMembers || 0,
      });
    }

    logDebug('[WORKSPACE RESOLVE]', 'no workspace found', {
      uid: sessionUid,
      source: 'none',
    });
    return res.json({
      ok: true,
      isOwner: false,
      isMember: false,
      synced: false,
    });
  } catch (error) {
    console.error('[WORKSPACE RESOLVE] resolve workspace error:', error);
    return res.status(500).json({
      error: error?.message || 'Server error',
    });
  }
};

router.post('/resolve-user-workspace', resolveUserWorkspaceHandler);
router.post('/resolve-member-workspace', resolveUserWorkspaceHandler);

router.post('/provision-member-auth', async (req, res) => {
  try {
    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const clinicIdInput = `${req.body?.clinicId || ''}`.trim();
    const authEmailInput = normalizeEmail(req.body?.authEmail || req.body?.email || '');
    const password = `${req.body?.password || ''}`;
    const memberName = `${req.body?.memberName || ''}`.trim();

    if (!authEmailInput || !password) {
      return res.status(400).json({ error: 'Mangler authEmail eller password.', code: 'missing_fields' });
    }
    if (!isValidEmail(authEmailInput)) {
      return res.status(400).json({ error: 'Ugyldig authEmail.', code: 'invalid_email' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Adgangskode er for kort.', code: 'invalid_password' });
    }

    const db = getFirestore();
    const requesterSnap = await db.collection('users').doc(uid).get();
    if (!requesterSnap.exists) {
      return res.status(404).json({ error: 'Bruger ikke fundet.', code: 'requester_not_found' });
    }

    const requester = requesterSnap.data() || {};
    const requesterRole = `${requester.role || ''}`.trim().toLowerCase();
    if (requesterRole === 'member') {
      return res.status(403).json({ error: 'Kun klinikejeren kan oprette medarbejder-login.', code: 'forbidden' });
    }

    const requesterClinicId = `${requester.activeClinicId || requester.clinicId || ''}`.trim();
    const clinicId = clinicIdInput || requesterClinicId;
    if (!clinicId) {
      return res.status(400).json({ error: 'Klinik-id mangler.', code: 'missing_clinic_id' });
    }
    if (clinicIdInput && requesterClinicId && clinicIdInput !== requesterClinicId) {
      return res.status(403).json({ error: 'Du kan kun oprette login for din aktive klinik.', code: 'forbidden_clinic' });
    }

    const authClient = getAuth();
    const userRecord = await authClient.createUser({
      email: authEmailInput,
      password,
      emailVerified: true,
      ...(memberName ? { displayName: memberName } : {}),
    });

    return res.json({
      ok: true,
      uid: userRecord.uid,
      email: userRecord.email || authEmailInput,
    });
  } catch (error) {
    const code = `${error?.code || ''}`.trim().toLowerCase();
    if (code === 'auth/email-already-exists') {
      return res.status(409).json({
        error: 'E-mail bruges allerede.',
        code: 'email-already-exists',
      });
    }
    if (code === 'auth/invalid-password') {
      return res.status(400).json({
        error: 'Adgangskoden opfylder ikke kravene.',
        code: 'invalid-password',
      });
    }
    if (code === 'auth/invalid-email') {
      return res.status(400).json({
        error: 'Ugyldig auth e-mail.',
        code: 'invalid-email',
      });
    }
    console.error('[team] provision member auth error:', error);
    return res.status(500).json({
      error: error?.message || 'Server error',
      code: code || 'internal',
    });
  }
});

router.post('/send-member-login', async (req, res) => {
  try {
    const { uid } = req.user || {};
    if (!uid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const clinicIdInput = `${req.body?.clinicId || ''}`.trim();
    const memberUid = `${req.body?.memberUid || ''}`.trim();
    const username = `${req.body?.username || ''}`.trim();
    const password = `${req.body?.password || ''}`.trim();
    const memberNameInput = `${req.body?.memberName || ''}`.trim();
    const providedRecipient = normalizeEmail(req.body?.contactEmail || req.body?.recipientEmail || '');

    if (!memberUid || !username || !password) {
      return res.status(400).json({ error: 'Mangler memberUid, username eller password.' });
    }

    const db = getFirestore();
    const requesterSnap = await db.collection('users').doc(uid).get();
    if (!requesterSnap.exists) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    const requester = requesterSnap.data() || {};
    const requesterRole = `${requester.role || ''}`.trim().toLowerCase();
    if (requesterRole === 'member') {
      return res.status(403).json({ error: 'Kun klinikejeren kan sende login-oplysninger.' });
    }

    const requesterClinicId = `${requester.activeClinicId || ''}`.trim();
    const clinicId = clinicIdInput || requesterClinicId;
    if (!clinicId) {
      return res.status(400).json({ error: 'Klinik-id mangler.' });
    }
    if (clinicIdInput && requesterClinicId && clinicIdInput !== requesterClinicId) {
      return res.status(403).json({ error: 'Du kan kun sende login for din aktive klinik.' });
    }

    const memberRef = db.collection('clinics').doc(clinicId).collection('members').doc(memberUid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      return res.status(404).json({ error: 'Medarbejder ikke fundet i klinikken.' });
    }

    const memberData = memberSnap.data() || {};
    const storedUsername = `${memberData.loginUsername || ''}`.trim().toLowerCase();
    if (storedUsername && storedUsername !== username.toLowerCase()) {
      return res.status(409).json({ error: 'Login-oplysninger matcher ikke medarbejderen.' });
    }

    const recipient = providedRecipient || normalizeEmail(memberData.contactEmail || memberData.email || '');
    if (!recipient || !isValidEmail(recipient)) {
      return res.json({
        ok: true,
        sent: false,
        error: 'Kontakt-email mangler eller er ugyldig.',
      });
    }

    const clinicSnap = await db.collection('clinics').doc(clinicId).get();
    const clinicData = clinicSnap.exists ? clinicSnap.data() || {} : {};
    const clinicName = pickFirstString(clinicData.name, clinicData.clinicName, requester.clinicName, 'din klinik');
    const memberName = pickFirstString(
      memberNameInput,
      memberData.name,
      `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim(),
      'medarbejder'
    );
    const loginUrl = `${resolveBaseUrl(req)}/signup`;

    const subject = `Dit medarbejder-login til ${clinicName}`;
    const text = [
      `Hej ${memberName},`,
      '',
      `Her er dit login til ${clinicName}:`,
      `Brugernavn: ${username}`,
      `Adgangskode: ${password}`,
      '',
      `Log ind her: ${loginUrl}`,
      '',
      'Af sikkerhedshensyn anbefaler vi, at du ændrer koden efter første login.',
    ].join('\n');
    const html = `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;">
  <h2 style="margin:0 0 12px;">Dit medarbejder-login</h2>
  <p style="margin:0 0 12px;">Hej ${escapeHtml(memberName)},</p>
  <p style="margin:0 0 12px;">Her er dit login til <strong>${escapeHtml(clinicName)}</strong>.</p>
  <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc;">
    <p style="margin:0 0 8px;"><strong>Brugernavn:</strong> ${escapeHtml(username)}</p>
    <p style="margin:0;"><strong>Adgangskode:</strong> ${escapeHtml(password)}</p>
  </div>
  <p style="margin:16px 0;">
    <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:10px 16px;border-radius:9999px;background:#0f172a;color:#fff;text-decoration:none;font-weight:600;">
      Gå til login
    </a>
  </p>
  <p style="margin:0;color:#64748b;font-size:12px;">
    Af sikkerhedshensyn anbefaler vi, at du ændrer koden efter første login.
  </p>
</div>
`.trim();

    const emailResult = await sendResendEmail({
      toEmail: recipient,
      subject,
      text,
      html,
    });

    const now = admin.firestore.FieldValue.serverTimestamp();
    const emailMeta = {
      status: emailResult.sent ? 'sent' : 'failed',
      to: recipient,
      messageId: emailResult.messageId || null,
      error: emailResult.sent ? null : `${emailResult.error || 'Ukendt fejl'}`.slice(0, 400),
      lastAttemptAt: now,
      sentByUid: uid,
    };
    if (emailResult.sent) {
      emailMeta.sentAt = now;
    }

    await memberRef.set(
      {
        loginCredentialEmail: emailMeta,
        updatedAt: now,
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      sent: Boolean(emailResult.sent),
      to: recipient,
      messageId: emailResult.messageId || null,
      error: emailResult.sent ? null : emailResult.error || 'Kunne ikke sende e-mail.',
    });
  } catch (error) {
    console.error('[team] send member login email error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

router.post('/remove-member', async (req, res) => {
  try {
    const requesterUid = normalizeUid(req.user?.uid);
    if (!requesterUid) {
      return res.status(401).json({ error: 'Missing user context.' });
    }

    const clinicIdInput = normalizeUid(req.body?.clinicId);
    const memberUid = normalizeUid(req.body?.memberUid || req.body?.uid);
    if (!memberUid) {
      return res.status(400).json({ error: 'Mangler memberUid.' });
    }

    const db = getFirestore();
    const requesterSnap = await db.collection('users').doc(requesterUid).get();
    if (!requesterSnap.exists) {
      return res.status(404).json({ error: 'Bruger ikke fundet.' });
    }
    const requester = requesterSnap.data() || {};
    const requesterRole = normalizeRole(requester.role);
    if (requesterRole === 'member') {
      return res.status(403).json({ error: 'Kun klinikejeren kan fjerne medarbejdere.' });
    }

    const requesterClinicId = normalizeUid(requester.activeClinicId || requester.clinicId);
    const clinicId = clinicIdInput || requesterClinicId;
    if (!clinicId) {
      return res.status(400).json({ error: 'Klinik-id mangler.' });
    }
    if (clinicIdInput && requesterClinicId && clinicIdInput !== requesterClinicId) {
      return res.status(403).json({ error: 'Du kan kun fjerne medarbejdere i din aktive klinik.' });
    }

    const clinicRef = db.collection('clinics').doc(clinicId);
    const clinicSnap = await clinicRef.get();
    if (!clinicSnap.exists) {
      return res.status(404).json({ error: 'Klinik ikke fundet.' });
    }
    const clinicData = clinicSnap.data() || {};
    const ownerUid = normalizeUid(clinicData.ownerUid);
    if (!ownerUid || ownerUid !== requesterUid) {
      return res.status(403).json({ error: 'Kun klinikejeren kan fjerne medarbejdere.' });
    }
    if (memberUid === ownerUid) {
      return res.status(400).json({ error: 'Du kan ikke fjerne klinikejeren.' });
    }

    const membersRef = clinicRef.collection('members');
    let memberDocRef = membersRef.doc(memberUid);
    let memberDocSnap = await memberDocRef.get();

    if (!memberDocSnap.exists) {
      const byMemberUidSnap = await membersRef.where('memberUid', '==', memberUid).limit(1).get();
      if (!byMemberUidSnap.empty) {
        memberDocRef = byMemberUidSnap.docs[0].ref;
        memberDocSnap = byMemberUidSnap.docs[0];
      }
    }
    if (!memberDocSnap.exists) {
      const byUidFieldSnap = await membersRef.where('uid', '==', memberUid).limit(1).get();
      if (!byUidFieldSnap.empty) {
        memberDocRef = byUidFieldSnap.docs[0].ref;
        memberDocSnap = byUidFieldSnap.docs[0];
      }
    }

    if (!memberDocSnap.exists) {
      return res.status(404).json({ error: 'Medarbejder ikke fundet i klinikken.' });
    }

    const memberData = memberDocSnap.data() || {};
    const memberRole = normalizeRole(memberData.role);
    if (memberRole === 'owner' || memberData.isOwner === true) {
      return res.status(400).json({ error: 'Ejeren kan ikke fjernes fra teamet.' });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.delete(memberDocRef);
    batch.set(
      db.collection('users').doc(memberUid),
      {
        activeClinicId: admin.firestore.FieldValue.delete(),
        clinicId: admin.firestore.FieldValue.delete(),
        clinicOwnerUid: admin.firestore.FieldValue.delete(),
        dataOwnerUid: admin.firestore.FieldValue.delete(),
        role: admin.firestore.FieldValue.delete(),
        accountType: admin.firestore.FieldValue.delete(),
        hasTeam: false,
        teamMemberLogin: {
          enabled: false,
          removedByUid: requesterUid,
          removedAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );
    await batch.commit();

    return res.json({
      ok: true,
      clinicId,
      memberUid,
      removed: true,
    });
  } catch (error) {
    console.error('[team] remove member error:', error);
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
});

module.exports = { router };
