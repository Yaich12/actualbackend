const admin = require('firebase-admin');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');

const resolveProjectId = () =>
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.REACT_APP_PROJECT_ID ||
  undefined;

const resolveFirestoreDatabaseId = () => {
  const value =
    process.env.FIRESTORE_DB_ID ||
    process.env.REACT_APP_FIRESTORE_DB_ID ||
    '';
  const trimmed = `${value}`.trim();
  return trimmed || undefined;
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: resolveProjectId(),
  });
}

const firestoreDatabaseId = resolveFirestoreDatabaseId();
const getFirestore = () =>
  firestoreDatabaseId
    ? getAdminFirestore(admin.app(), firestoreDatabaseId)
    : getAdminFirestore(admin.app());
const getAuth = () => admin.auth();

if (process.env.NODE_ENV !== 'production') {
  console.info('[firebaseAdmin] Firestore database:', firestoreDatabaseId || '(default)');
}

module.exports = {
  admin,
  getAuth,
  getFirestore,
};
