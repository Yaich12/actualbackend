import { Storage } from "@google-cloud/storage";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const publicAssetsDir = path.join(repoRoot, "public-assets");

const ensureCredentialsPath = async () => {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) return;
  try {
    await fs.access(credentialsPath);
  } catch (error) {
    console.warn(
      `Warning: GOOGLE_APPLICATION_CREDENTIALS not found at "${credentialsPath}". Using ADC instead.`
    );
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
};

const getDefaultProjectId = async () => {
  const firebaseRcPath = path.join(repoRoot, ".firebaserc");
  try {
    const raw = await fs.readFile(firebaseRcPath, "utf8");
    const data = JSON.parse(raw);
    if (typeof data?.projects?.default === "string") {
      return data.projects.default;
    }
    if (typeof data?.default === "string") {
      return data.default;
    }
  } catch (error) {
    return null;
  }
  return null;
};

const resolveBucketName = async () => {
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    return process.env.FIREBASE_STORAGE_BUCKET;
  }
  if (process.env.REACT_APP_FIREBASE_STORAGE_BUCKET) {
    return process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;
  }
  const projectId = await getDefaultProjectId();
  if (!projectId) return null;
  return `${projectId}.firebasestorage.app`;
};

const storage = new Storage();

const CONTENT_TYPES = new Map([
  [".mp4", "video/mp4"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
]);

const walkFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

const uploadAll = async () => {
  await ensureCredentialsPath();

  const bucketName = await resolveBucketName();
  if (!bucketName) {
    console.error(
      "Missing bucket name. Set FIREBASE_STORAGE_BUCKET or REACT_APP_FIREBASE_STORAGE_BUCKET, or configure a default project in .firebaserc."
    );
    process.exit(1);
  }

  console.log(`Using bucket: ${bucketName}`);

  const bucket = storage.bucket(bucketName);
  try {
    await bucket.getMetadata();
  } catch (error) {
    console.error(
      `Bucket "${bucketName}" not found or inaccessible. Go to Firebase Console → Storage → Get started.`
    );
    process.exit(1);
  }

  const files = await walkFiles(publicAssetsDir);
  if (!files.length) {
    console.log("No files found in public-assets.");
    return;
  }

  const uploaded = [];

  for (const filePath of files) {
    const relativePath = path
      .relative(publicAssetsDir, filePath)
      .split(path.sep)
      .join("/");
    const destination = `public/${relativePath}`;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES.get(ext);
    const metadata = contentType
      ? {
          cacheControl: "public, max-age=31536000, immutable",
          contentType,
        }
      : undefined;

    await bucket.upload(filePath, {
      destination,
      ...(metadata ? { metadata } : {}),
    });

    uploaded.push(destination);
  }

  console.log("Uploaded files:");
  uploaded.forEach((file) => console.log(`- ${file}`));
};

await uploadAll();
