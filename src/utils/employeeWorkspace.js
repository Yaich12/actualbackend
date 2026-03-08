import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { getIdToken } from "./auth";
import { buildApiUrl } from "./runtimeUrls";

const trim = (value) => `${value || ""}`.trim();
const toRole = (value) => `${value || ""}`.trim().toLowerCase();
const debugLog = (tag, message, details = undefined) => {
  if (typeof console === "undefined") return;
  if (details === undefined) {
    console.info(`${tag} ${message}`);
    return;
  }
  console.info(`${tag} ${message}`, details);
};

const resolveOwnerUidFromClinic = async (clinicId) => {
  const safeClinicId = trim(clinicId);
  if (!safeClinicId) return "";
  try {
    const clinicSnap = await getDoc(doc(db, "clinics", safeClinicId));
    if (!clinicSnap.exists()) return "";
    const clinicData = clinicSnap.data() || {};
    return trim(clinicData?.ownerUid || "");
  } catch (_error) {
    return "";
  }
};

const toWorkspaceResult = ({
  type = "none",
  clinicId = null,
  ownerUid = null,
  source = null,
  synced = false,
} = {}) => ({
  type,
  hasWorkspace: type === "owner" || type === "member",
  shouldOnboarding: type === "none",
  isOwner: type === "owner",
  isMember: type === "member",
  clinicId: trim(clinicId) || null,
  ownerUid: trim(ownerUid) || null,
  source: source || null,
  synced: Boolean(synced),
});

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const shouldRepairMemberWorkspaceViaApi = (source) => {
  const safeSource = trim(source);
  if (!safeSource) return false;
  return (
    safeSource !== "clinic-member-docid" &&
    safeSource !== "activeClinicId-clinic-member-docid"
  );
};

const updateUserWorkspaceProfile = async ({
  uid,
  type,
  clinicId,
  ownerUid,
  authUser,
  memberData = null,
}) => {
  const safeUid = trim(uid);
  const safeClinicId = trim(clinicId);
  if (!safeUid || !safeClinicId || (type !== "owner" && type !== "member")) {
    return;
  }

  const now = serverTimestamp();
  const fullName =
    trim(memberData?.displayName) ||
    trim(memberData?.name) ||
    trim(`${memberData?.firstName || ""} ${memberData?.lastName || ""}`) ||
    trim(authUser?.displayName) ||
    "";
  const authEmail =
    trim(authUser?.email) || trim(memberData?.email) || trim(memberData?.contactEmail) || null;

  const payload = {
    uid: safeUid,
    activeClinicId: safeClinicId,
    clinicId: safeClinicId,
    onboardingComplete: true,
    onboardingCompletedAt: now,
    updatedAt: now,
  };

  if (type === "owner") {
    payload.role = "owner";
    payload.clinicOwnerUid = deleteField();
    payload.dataOwnerUid = deleteField();
  } else {
    const safeOwnerUid = trim(ownerUid);
    payload.role = "member";
    payload.accountType = "team";
    payload.hasTeam = true;
    if (safeOwnerUid) {
      payload.clinicOwnerUid = safeOwnerUid;
      payload.dataOwnerUid = safeOwnerUid;
    }
  }

  if (fullName) {
    payload.displayName = fullName;
    payload.fullName = fullName;
  }
  if (authEmail) {
    payload.email = authEmail;
    payload.authEmail = authEmail;
  }

  debugLog("[FIRESTORE SYNC]", "updating users/{uid} workspace profile", {
    uid: safeUid,
    type,
    clinicId: safeClinicId,
    ownerUid: trim(ownerUid || "") || null,
    onboardingComplete: true,
  });
  try {
    await setDoc(doc(db, "users", safeUid), payload, { merge: true });
    debugLog("[FIRESTORE SYNC]", "users/{uid} workspace profile updated", {
      uid: safeUid,
      clinicId: safeClinicId,
      role: payload.role || null,
      onboardingComplete: true,
    });
  } catch (error) {
    debugLog("[FIRESTORE SYNC]", "failed to update users/{uid} workspace profile", {
      uid: safeUid,
      clinicId: safeClinicId,
      role: payload.role || null,
      error: error?.message || String(error),
    });
    throw error;
  }
};

const findMemberRecordInClinic = async ({ clinicId, uid }) => {
  const safeClinicId = trim(clinicId);
  const safeUid = trim(uid);
  if (!safeClinicId || !safeUid) return null;

  const directRef = doc(db, "clinics", safeClinicId, "members", safeUid);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) {
    return {
      docSnap: directSnap,
      memberData: directSnap.data() || {},
      source: "clinic-member-docid",
    };
  }

  const byMemberUid = await getDocs(
    query(
      collection(db, "clinics", safeClinicId, "members"),
      where("memberUid", "==", safeUid),
      limit(1)
    )
  );
  if (!byMemberUid.empty) {
    const docSnap = byMemberUid.docs[0];
    return {
      docSnap,
      memberData: docSnap.data() || {},
      source: "clinic-member-memberUid",
    };
  }

  const byUidField = await getDocs(
    query(collection(db, "clinics", safeClinicId, "members"), where("uid", "==", safeUid), limit(1))
  );
  if (!byUidField.empty) {
    const docSnap = byUidField.docs[0];
    return {
      docSnap,
      memberData: docSnap.data() || {},
      source: "clinic-member-uid-field",
    };
  }

  return null;
};

const findMemberWorkspaceLocal = async (uid) => {
  const safeUid = trim(uid);
  if (!safeUid) return null;

  const membershipDocs = [];
  const seenPaths = new Set();
  const appendDocs = (docs) => {
    (docs || []).forEach((docSnap) => {
      const path = `${docSnap?.ref?.path || ""}`.trim();
      if (!path || seenPaths.has(path)) return;
      seenPaths.add(path);
      membershipDocs.push(docSnap);
    });
  };

  // NOTE: collectionGroup + documentId equality requires a full document path.
  // We rely on explicit member fields instead.
  const byMemberUid = await getDocs(
    query(collectionGroup(db, "members"), where("memberUid", "==", safeUid), limit(10))
  );
  appendDocs(byMemberUid.docs);
  if (membershipDocs.length === 0) {
    const byUidField = await getDocs(
      query(collectionGroup(db, "members"), where("uid", "==", safeUid), limit(10))
    );
    appendDocs(byUidField.docs);
  }
  if (membershipDocs.length === 0) return null;

  for (const membershipDoc of membershipDocs) {
    const memberData = membershipDoc.data() || {};
    const clinicRef = membershipDoc.ref.parent?.parent || null;
    if (!clinicRef) continue;

    const clinicSnap = await getDoc(clinicRef);
    if (!clinicSnap.exists()) continue;
    const clinicData = clinicSnap.data() || {};
    const clinicId = trim(clinicRef.id);
    const ownerUid = trim(
      clinicData?.ownerUid || memberData?.clinicOwnerUid || memberData?.dataOwnerUid || ""
    );
    const role = toRole(memberData?.role);
    const isOwnerMemberDoc =
      memberData?.isOwner === true || role === "owner" || Boolean(ownerUid && ownerUid === safeUid);

    if (!clinicId || !ownerUid || isOwnerMemberDoc) {
      continue;
    }

    return {
      clinicId,
      ownerUid,
      memberData,
      source: "local-members",
    };
  }

  return null;
};

const findOwnerWorkspaceLocal = async (uid) => {
  const safeUid = trim(uid);
  if (!safeUid) return null;

  const ownerClinicsSnap = await getDocs(
    query(collection(db, "clinics"), where("ownerUid", "==", safeUid), limit(1))
  );
  if (ownerClinicsSnap.empty) {
    return null;
  }

  const clinicDoc = ownerClinicsSnap.docs[0];
  return {
    clinicId: trim(clinicDoc.id),
    ownerUid: safeUid,
    source: "local-owner-clinic-query",
  };
};

const resolveWorkspaceViaApi = async () => {
  let token = "";
  try {
    token = await getIdToken();
  } catch (error) {
    debugLog("[WORKSPACE RESOLVE]", "could not get ID token for API fallback", {
      error: error?.message || String(error),
    });
    throw error;
  }
  const endpointCandidates = [
    "/api/team/resolve-user-workspace",
    "/api/team/resolve-member-workspace",
  ];

  for (const endpoint of endpointCandidates) {
    debugLog("[WORKSPACE RESOLVE]", "calling API workspace resolver", { endpoint });
    const response = await fetch(buildApiUrl(endpoint), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const payload = await parseJsonSafely(response);
    debugLog("[WORKSPACE RESOLVE]", "API workspace resolver response", {
      endpoint,
      status: response.status,
      ok: response.ok,
      payload: payload || null,
    });

    if (!response.ok) {
      if (response.status === 404) {
        continue;
      }
      return toWorkspaceResult({
        type: "none",
        source: "api-workspace-resolve-error",
        synced: false,
      });
    }

    const clinicId = trim(payload?.clinicId) || null;
    const ownerUid = trim(payload?.ownerUid) || null;
    const isOwner = payload?.isOwner === true && Boolean(clinicId);
    const isMember = payload?.isMember === true && Boolean(clinicId);
    if (!isOwner && !isMember) {
      return toWorkspaceResult({
        type: "none",
        source: payload?.source || "api-workspace-resolve",
        synced: payload?.synced === true,
      });
    }

    return toWorkspaceResult({
      type: isOwner ? "owner" : "member",
      clinicId,
      ownerUid,
      source: payload?.source || "api-workspace-resolve",
      synced: payload?.synced === true || isOwner || isMember,
    });
  }

  return toWorkspaceResult({ type: "none", source: "api-workspace-resolve-missing" });
};

export async function resolveUserWorkspace(authUserOrUid) {
  const authUser =
    typeof authUserOrUid === "object" && authUserOrUid !== null ? authUserOrUid : null;
  const uid = trim(authUser?.uid || authUserOrUid);
  if (!uid) {
    debugLog("[WORKSPACE RESOLVE]", "missing uid during resolve", { authUserOrUid: authUserOrUid || null });
    return toWorkspaceResult({ type: "none", source: "missing-uid" });
  }
  debugLog("[WORKSPACE RESOLVE]", "starting resolveUserWorkspace", {
    uid,
    authEmail: trim(authUser?.email || "") || null,
  });

  let userData = null;
  let userExists = false;
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    userExists = userSnap.exists();
    userData = userExists ? userSnap.data() || {} : null;
  } catch (_error) {
    userData = null;
    userExists = false;
  }
  debugLog("[WORKSPACE RESOLVE]", "loaded users/{uid}", {
    uid,
    userExists,
    activeClinicId: trim(userData?.activeClinicId || "") || null,
    role: trim(userData?.role || "") || null,
    onboardingComplete:
      typeof userData?.onboardingComplete === "boolean" ? userData.onboardingComplete : null,
  });

  const activeClinicId = trim(userData?.activeClinicId || "");
  if (activeClinicId) {
    try {
      const clinicSnap = await getDoc(doc(db, "clinics", activeClinicId));
      if (clinicSnap.exists()) {
        const clinicData = clinicSnap.data() || {};
        const clinicOwnerUid = trim(clinicData?.ownerUid || "");

        if (clinicOwnerUid && clinicOwnerUid === uid) {
          await updateUserWorkspaceProfile({
            uid,
            type: "owner",
            clinicId: activeClinicId,
            ownerUid: uid,
            authUser,
          });
          return toWorkspaceResult({
            type: "owner",
            clinicId: activeClinicId,
            ownerUid: uid,
            source: "activeClinicId-owner",
            synced: true,
          });
        }

        const memberRecord = await findMemberRecordInClinic({
          clinicId: activeClinicId,
          uid,
        });
        if (memberRecord?.memberData) {
          const localResult = toWorkspaceResult({
            type: "member",
            clinicId: activeClinicId,
            ownerUid: clinicOwnerUid || null,
            source: `activeClinicId-${memberRecord.source}`,
            synced: true,
          });
          if (shouldRepairMemberWorkspaceViaApi(localResult.source)) {
            try {
              const repairedResult = await resolveWorkspaceViaApi();
              debugLog("[WORKSPACE RESOLVE]", "api repair after activeClinic member lookup", {
                uid,
                localSource: localResult.source,
                repairedResult,
              });
              if (repairedResult?.hasWorkspace) {
                return repairedResult;
              }
            } catch (error) {
              debugLog("[WORKSPACE RESOLVE]", "api repair failed after activeClinic member lookup", {
                uid,
                localSource: localResult.source,
                error: error?.message || String(error),
              });
            }
          }
          await updateUserWorkspaceProfile({
            uid,
            type: "member",
            clinicId: activeClinicId,
            ownerUid: clinicOwnerUid || null,
            authUser,
            memberData: memberRecord.memberData,
          });
          return localResult;
        }
      }
    } catch (_error) {
      debugLog("[WORKSPACE RESOLVE]", "activeClinicId lookup failed, continuing", {
        uid,
        activeClinicId,
      });
      // Continue with broader lookup and API fallback.
    }
  }

  try {
    const memberWorkspace = await findMemberWorkspaceLocal(uid);
    debugLog("[WORKSPACE RESOLVE]", "local members lookup result", {
      uid,
      found: Boolean(memberWorkspace?.clinicId),
      clinicId: memberWorkspace?.clinicId || null,
      ownerUid: memberWorkspace?.ownerUid || null,
      source: memberWorkspace?.source || null,
    });
    if (memberWorkspace?.clinicId) {
      const localResult = toWorkspaceResult({
        type: "member",
        clinicId: memberWorkspace.clinicId,
        ownerUid: memberWorkspace.ownerUid,
        source: memberWorkspace.source,
        synced: true,
      });
      if (shouldRepairMemberWorkspaceViaApi(localResult.source)) {
        try {
          const repairedResult = await resolveWorkspaceViaApi();
          debugLog("[WORKSPACE RESOLVE]", "api repair after local member lookup", {
            uid,
            localSource: localResult.source,
            repairedResult,
          });
          if (repairedResult?.hasWorkspace) {
            return repairedResult;
          }
        } catch (error) {
          debugLog("[WORKSPACE RESOLVE]", "api repair failed after local member lookup", {
            uid,
            localSource: localResult.source,
            error: error?.message || String(error),
          });
        }
      }
      await updateUserWorkspaceProfile({
        uid,
        type: "member",
        clinicId: memberWorkspace.clinicId,
        ownerUid: memberWorkspace.ownerUid,
        authUser,
        memberData: memberWorkspace.memberData,
      });
      return localResult;
    }
  } catch (error) {
    debugLog("[WORKSPACE RESOLVE]", "local members lookup threw", {
      uid,
      error: error?.message || String(error),
    });
    // Ignore and continue.
  }

  try {
    const ownerWorkspace = await findOwnerWorkspaceLocal(uid);
    debugLog("[WORKSPACE RESOLVE]", "local owner lookup result", {
      uid,
      found: Boolean(ownerWorkspace?.clinicId),
      clinicId: ownerWorkspace?.clinicId || null,
      ownerUid: ownerWorkspace?.ownerUid || null,
      source: ownerWorkspace?.source || null,
    });
    if (ownerWorkspace?.clinicId) {
      await updateUserWorkspaceProfile({
        uid,
        type: "owner",
        clinicId: ownerWorkspace.clinicId,
        ownerUid: ownerWorkspace.ownerUid,
        authUser,
      });
      return toWorkspaceResult({
        type: "owner",
        clinicId: ownerWorkspace.clinicId,
        ownerUid: ownerWorkspace.ownerUid,
        source: ownerWorkspace.source,
        synced: true,
      });
    }
  } catch (error) {
    debugLog("[WORKSPACE RESOLVE]", "local owner lookup threw", {
      uid,
      error: error?.message || String(error),
    });
    // Ignore and continue.
  }

  try {
    const apiResult = await resolveWorkspaceViaApi();
    debugLog("[WORKSPACE RESOLVE]", "api fallback resolve result", {
      uid,
      result: apiResult,
    });
    if (apiResult.hasWorkspace) {
      return apiResult;
    }
  } catch (error) {
    debugLog("[WORKSPACE RESOLVE]", "api fallback threw", {
      uid,
      error: error?.message || String(error),
    });
    // Ignore API failures.
  }

  const noWorkspaceResult = toWorkspaceResult({ type: "none", source: "no-workspace" });
  debugLog("[WORKSPACE RESOLVE]", "final resolve result", {
    uid,
    result: noWorkspaceResult,
  });
  return noWorkspaceResult;
}

export async function syncEmployeeWorkspaceProfile(authUserOrUid) {
  const resolved = await resolveUserWorkspace(authUserOrUid);
  return {
    isMember: resolved?.isMember === true,
    synced: Boolean(resolved?.hasWorkspace),
    clinicId: resolved?.clinicId || null,
    ownerUid: resolved?.ownerUid || null,
  };
}

export async function ensureMemberWorkspaceGuard(authUserOrUid, options = {}) {
  const authUser =
    typeof authUserOrUid === "object" && authUserOrUid !== null ? authUserOrUid : null;
  const uid = trim(authUser?.uid || authUserOrUid);
  const context = trim(options?.context || "unknown");
  if (!uid) {
    debugLog("[MEMBER GUARD]", "skipping guard because uid is missing", { context });
    return {
      isMember: false,
      blockedOnboarding: false,
      workspace: toWorkspaceResult({ type: "none", source: "missing-uid" }),
    };
  }

  debugLog("[MEMBER GUARD]", "running member workspace guard", {
    uid,
    email: trim(authUser?.email || "") || null,
    context,
  });
  const workspace = await resolveUserWorkspace(authUserOrUid);
  if (!workspace?.isMember || !workspace?.clinicId) {
    debugLog("[MEMBER GUARD]", "no member workspace found in guard", {
      uid,
      context,
      workspace,
    });
    return {
      isMember: false,
      blockedOnboarding: false,
      workspace,
    };
  }

  let ownerUid = trim(workspace?.ownerUid || "");
  if (!ownerUid) {
    ownerUid = await resolveOwnerUidFromClinic(workspace.clinicId);
  }

  const now = serverTimestamp();
  const payload = {
    uid,
    activeClinicId: workspace.clinicId,
    clinicId: workspace.clinicId,
    role: "member",
    onboardingComplete: true,
    onboardingCompletedAt: now,
    accountType: "team",
    hasTeam: true,
    updatedAt: now,
  };
  if (ownerUid) {
    payload.clinicOwnerUid = ownerUid;
    payload.dataOwnerUid = ownerUid;
  }
  if (trim(authUser?.email || "")) {
    payload.email = trim(authUser.email);
    payload.authEmail = trim(authUser.email);
  }
  if (trim(authUser?.displayName || "")) {
    payload.displayName = trim(authUser.displayName);
    payload.fullName = trim(authUser.displayName);
  }

  debugLog("[WORKSPACE SYNC]", "writing member workspace fields to users/{uid}", {
    uid,
    clinicId: workspace.clinicId,
    ownerUid: ownerUid || null,
    context,
  });
  await setDoc(doc(db, "users", uid), payload, { merge: true });
  debugLog("[WORKSPACE SYNC]", "member workspace fields written to users/{uid}", {
    uid,
    activeClinicId: workspace.clinicId,
    role: "member",
    onboardingComplete: true,
    ownerUid: ownerUid || null,
    context,
  });

  const guardedWorkspace = {
    ...workspace,
    ownerUid: ownerUid || workspace.ownerUid || null,
    synced: true,
  };
  debugLog("[MEMBER GUARD]", "member guard resolved and synced workspace", {
    uid,
    context,
    workspace: guardedWorkspace,
  });

  return {
    isMember: true,
    blockedOnboarding: true,
    workspace: guardedWorkspace,
  };
}
