const { getAuth } = require('../firebaseAdmin');

const extractBearerToken = (req) => {
  const header = req?.headers?.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      return res.status(401).json({ error: 'Missing authorization token.' });
    }
    const decoded = await getAuth().verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || decoded.displayName || null,
    };
    return next();
  } catch (error) {
    console.warn('[auth] token verification failed:', error?.message || error);
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }
};

module.exports = { verifyFirebaseToken };
