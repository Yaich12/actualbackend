import { Storage } from "@google-cloud/storage";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const publicAssetsDir = path.join(repoRoot, "public-assets");

const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;

if (!bucketName) {
  console.error(
    "Missing bucket name. Set FIREBASE_STORAGE_BUCKET or REACT_APP_FIREBASE_STORAGE_BUCKET."
  );
  process.exit(1);
}

const storage = new Storage();
const bucket = storage.bucket(bucketName);

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

    await bucket.upload(filePath, {
      destination,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
        ...(contentType ? { contentType } : {}),
      },
    });

    uploaded.push(destination);
  }

  console.log("Uploaded files:");
  uploaded.forEach((file) => console.log(`- ${file}`));
};

await uploadAll();
