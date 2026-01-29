export const getPublicAssetUrl = (relativePath) => {
  const trimmedPath = `${relativePath || ""}`.replace(/^\/+/, "");
  const bucket =
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET;

  if (!bucket) {
    return `/${trimmedPath}`;
  }

  const fullPath = `public/${trimmedPath}`;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
    fullPath
  )}?alt=media`;
};
