const admin = require('firebase-admin');

const resolveProjectId = () =>
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.REACT_APP_PROJECT_ID ||
  undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: resolveProjectId(),
  });
}

const getFirestore = () => admin.firestore();
const getAuth = () => admin.auth();

module.exports = {
  admin,
  getAuth,
  getFirestore,
};
