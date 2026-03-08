import { useEffect, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';
import { deriveLegacyOwnerUid, migrateLegacyCollectionToClinic } from '../../../../utils/workspaceContext';

const normalizeId = (value) => `${value || ''}`.trim();

const mapDocToClient = (doc) => {
  const data = typeof doc.data === 'function' ? doc.data() : doc;

  const createdAtIso =
    (typeof data.createdAtIso === 'string' && data.createdAtIso) ||
    data.createdAt?.toDate?.()?.toISOString?.() ||
    null;

  return {
    id: doc.id || data.id,
    navn: data.navn || 'Uden navn',
    email: data.email || '',
    telefon: data.telefonKomplet || data.telefon || '',
    telefonLand: data.telefonLand || '+45',
    cpr: data.cpr || '',
    adresse: data.adresse || '',
    adresse2: data.adresse2 || '',
    postnummer: data.postnummer || '',
    by: data.by || '',
    land: data.land || 'Danmark',
    status: data.status || 'Aktiv',
    maalForForloebet: data.clientensoplysninger?.maalForForloebet || '',
    clientensoplysninger: data.clientensoplysninger || {}, // Include full clientensoplysninger object
    createdAt: createdAtIso,
  };
};

export function useUserClients() {
  const { workspaceUid, activeClinicId, userDoc, sessionUid } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const clinicId = normalizeId(activeClinicId || userDoc?.activeClinicId || userDoc?.clinicId || '');
  const legacyOwnerUid = deriveLegacyOwnerUid(userDoc, workspaceUid || sessionUid || '');

  useEffect(() => {
    if (!clinicId && !legacyOwnerUid) {
      setClients([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let unsubscribe = () => {};
    const setUnsubscribe = (nextUnsubscribe) => {
      let stopped = false;
      unsubscribe = () => {
        if (stopped) return;
        stopped = true;
        nextUnsubscribe();
      };
    };
    const bootstrap = async () => {
      const candidates = [];
      if (clinicId) {
        if (legacyOwnerUid) {
          try {
            await migrateLegacyCollectionToClinic({
              clinicId,
              legacyOwnerUid,
              collectionName: 'clients',
              transformDoc: ({ data }) => ({
                clinicId,
                createdByUid: data.createdByUid || data.ownerUid || sessionUid || null,
              }),
            });
          } catch (migrationError) {
            console.error('[useUserClients] Legacy migration failed:', migrationError);
          }
        }
        if (cancelled) return;
        candidates.push({
          source: 'clinic',
          pathLabel: `clinics/${clinicId}/clients`,
          ref: collection(db, 'clinics', clinicId, 'clients'),
        });
      }
      if (legacyOwnerUid) {
        if (cancelled) return;
        candidates.push({
          source: 'legacy',
          pathLabel: `users/${legacyOwnerUid}/clients`,
          ref: collection(db, 'users', legacyOwnerUid, 'clients'),
        });
      }

      if (candidates.length === 0) {
        setClients([]);
        setLoading(false);
        setError(null);
        return;
      }

      let selectedCandidate = null;
      for (const candidate of candidates) {
        if (cancelled) return;
        try {
          // Keep one stable snapshot listener; preflight read picks best path.
          // eslint-disable-next-line no-await-in-loop
          await getDocs(query(candidate.ref, limit(1)));
          if (cancelled) return;
          selectedCandidate = candidate;
          break;
        } catch (probeError) {
          console.warn('[useUserClients] probe failed for candidate', candidate, probeError);
        }
      }

      if (!selectedCandidate) {
        selectedCandidate = candidates[0];
      }

      setLoading(true);
      setError(null);
      if (cancelled) return;
      console.log(
        '[useUserClients] subscribing path=%s source=%s',
        selectedCandidate.pathLabel,
        selectedCandidate.source
      );
      const stop = onSnapshot(
        selectedCandidate.ref,
        (snapshot) => {
          if (cancelled) return;
          const mapped = snapshot.docs.map((clientDoc) => mapDocToClient(clientDoc));
          const sorted = mapped.slice().sort((a, b) => {
            const aTime = a?.createdAt ? Date.parse(a.createdAt) : Number.POSITIVE_INFINITY;
            const bTime = b?.createdAt ? Date.parse(b.createdAt) : Number.POSITIVE_INFINITY;
            if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
            if (!Number.isFinite(aTime)) return 1;
            if (!Number.isFinite(bTime)) return -1;
            return aTime - bTime;
          });
          setClients(sorted);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          if (cancelled) return;
          console.error('[useUserClients] Error loading clients:', snapshotError, selectedCandidate);
          setClients([]);
          setError('Kunne ikke hente klienter. Prøv igen senere.');
          setLoading(false);
        }
      );
      if (cancelled) {
        stop();
        return;
      }
      setUnsubscribe(stop);
    };
    void bootstrap();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [clinicId, legacyOwnerUid, sessionUid]);

  return { clients, loading, error };
}

export default useUserClients;
