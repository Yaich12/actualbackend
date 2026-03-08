import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { resolveUserWorkspace } from "./employeeWorkspace";

const normalizeId = (value) => `${value || ""}`.trim();
const migrationMemo = new Set();

export const deriveLegacyOwnerUid = (userDoc, fallbackUid = "") => {
  const fromProfile = normalizeId(userDoc?.dataOwnerUid || userDoc?.clinicOwnerUid || "");
  if (fromProfile) return fromProfile;
  return normalizeId(fallbackUid);
};

export async function resolveWorkspaceContext(authUserOrUid) {
  const authUser =
    typeof authUserOrUid === "object" && authUserOrUid !== null ? authUserOrUid : null;
  const viewerUid = normalizeId(authUser?.uid || authUserOrUid);
  if (!viewerUid) {
    return {
      viewerUid: null,
      clinicId: null,
      role: null,
      hasWorkspace: false,
      source: "missing-uid",
      workspace: null,
    };
  }

  const workspace = await resolveUserWorkspace(authUserOrUid);
  const role = workspace?.isOwner ? "owner" : workspace?.isMember ? "member" : null;
  return {
    viewerUid,
    clinicId: normalizeId(workspace?.clinicId || "") || null,
    role,
    hasWorkspace: Boolean(workspace?.hasWorkspace),
    source: workspace?.source || null,
    ownerUid: normalizeId(workspace?.ownerUid || "") || null,
    workspace,
  };
}

const runBatchSet = async (targetRefs, payloadBuilder) => {
  let batch = writeBatch(db);
  let opCount = 0;
  for (const item of targetRefs) {
    batch.set(item.ref, payloadBuilder(item), { merge: true });
    opCount += 1;
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  if (opCount > 0) {
    await batch.commit();
  }
};

export async function migrateLegacyCollectionToClinic({
  clinicId,
  legacyOwnerUid,
  collectionName,
  transformDoc,
}) {
  const safeClinicId = normalizeId(clinicId);
  const safeLegacyOwnerUid = normalizeId(legacyOwnerUid);
  const safeCollectionName = normalizeId(collectionName);
  if (!safeClinicId || !safeLegacyOwnerUid || !safeCollectionName) {
    return { migrated: false, copied: 0, reason: "missing-input" };
  }

  const migrationKey = `${safeClinicId}:${safeLegacyOwnerUid}:${safeCollectionName}`;
  if (migrationMemo.has(migrationKey)) {
    return { migrated: false, copied: 0, reason: "already-checked" };
  }
  migrationMemo.add(migrationKey);

  const clinicCollectionRef = collection(db, "clinics", safeClinicId, safeCollectionName);
  const legacyCollectionRef = collection(db, "users", safeLegacyOwnerUid, safeCollectionName);
  const legacySnap = await getDocs(legacyCollectionRef);
  if (legacySnap.empty) {
    return { migrated: false, copied: 0, reason: "legacy-empty" };
  }

  const clinicExistingSnap = await getDocs(clinicCollectionRef);
  const existingClinicDocIds = new Set(
    clinicExistingSnap.docs.map((docSnap) => normalizeId(docSnap.id)).filter(Boolean)
  );

  const targets = legacySnap.docs
    .filter((docSnap) => !existingClinicDocIds.has(normalizeId(docSnap.id)))
    .map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() || {},
      ref: doc(db, "clinics", safeClinicId, safeCollectionName, docSnap.id),
    }));

  if (targets.length === 0) {
    return { migrated: false, copied: 0, reason: "already-synced" };
  }

  await runBatchSet(targets, (item) => {
    const basePayload = {
      ...item.data,
      clinicId: safeClinicId,
      migratedFromLegacyOwnerUid: safeLegacyOwnerUid,
      migratedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (typeof transformDoc === "function") {
      const transformed = transformDoc({
        id: item.id,
        data: item.data,
        clinicId: safeClinicId,
        legacyOwnerUid: safeLegacyOwnerUid,
      });
      if (transformed && typeof transformed === "object") {
        return { ...basePayload, ...transformed };
      }
    }
    return basePayload;
  });

  return { migrated: true, copied: targets.length, reason: "copied" };
}

export async function migrateLegacyClientJournalToClinic({
  clinicId,
  legacyOwnerUid,
  clientId,
}) {
  const safeClinicId = normalizeId(clinicId);
  const safeLegacyOwnerUid = normalizeId(legacyOwnerUid);
  const safeClientId = normalizeId(clientId);
  if (!safeClinicId || !safeLegacyOwnerUid || !safeClientId) {
    return { migrated: false, copied: 0, reason: "missing-input" };
  }

  const migrationKey = `journal:${safeClinicId}:${safeLegacyOwnerUid}:${safeClientId}`;
  if (migrationMemo.has(migrationKey)) {
    return { migrated: false, copied: 0, reason: "already-checked" };
  }
  migrationMemo.add(migrationKey);

  const clinicCollectionRef = collection(
    db,
    "clinics",
    safeClinicId,
    "clients",
    safeClientId,
    "journalEntries"
  );
  const clinicHasData = await getDocs(query(clinicCollectionRef, limit(1)));
  if (!clinicHasData.empty) {
    return { migrated: false, copied: 0, reason: "clinic-has-data" };
  }

  const legacyCollectionRef = collection(
    db,
    "users",
    safeLegacyOwnerUid,
    "clients",
    safeClientId,
    "journalEntries"
  );
  const legacySnap = await getDocs(legacyCollectionRef);
  if (legacySnap.empty) {
    return { migrated: false, copied: 0, reason: "legacy-empty" };
  }

  const targets = legacySnap.docs.map((docSnap) => ({
    data: docSnap.data() || {},
    ref: doc(
      db,
      "clinics",
      safeClinicId,
      "clients",
      safeClientId,
      "journalEntries",
      docSnap.id
    ),
  }));

  await runBatchSet(targets, (item) => ({
    ...item.data,
    clinicId: safeClinicId,
    clientId: safeClientId,
    migratedFromLegacyOwnerUid: safeLegacyOwnerUid,
    migratedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  return { migrated: true, copied: targets.length, reason: "copied" };
}
