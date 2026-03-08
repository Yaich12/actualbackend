import { useEffect, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';
import { deriveLegacyOwnerUid, migrateLegacyCollectionToClinic } from '../../../../utils/workspaceContext';

const normalizeId = (value) => `${value || ''}`.trim();

const mapDocToService = (doc) => {
  const data = doc.data ? doc.data() : doc;

  const createdAtTimestamp = data.createdAt;
  const createdAtIso =
    createdAtTimestamp?.toDate?.()?.toISOString?.() ??
    data.createdAtIso ??
    data.createdAt ??
    null;

  const price = typeof data.price === 'number' ? data.price : data.pris ?? 0;

  return {
    id: doc.id || data.id,
    navn: data.name?.trim?.() || data.navn?.trim?.() || 'Ny ydelse',
    varighed: data.duration || data.varighed || '1 time',
    pris: price,
    prisInklMoms: price,
    priceInclVat: price,
    includeVat: false,
    description: data.description || '',
    createdAt: createdAtIso,
    color: data.color || '#3B82F6',
  };
};

export function useUserServices() {
  const { workspaceUid, activeClinicId, userDoc, sessionUid } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const clinicId = normalizeId(activeClinicId || userDoc?.activeClinicId || userDoc?.clinicId || '');
  const legacyOwnerUid = deriveLegacyOwnerUid(userDoc, workspaceUid || sessionUid || '');

  useEffect(() => {
    if (!clinicId && !legacyOwnerUid) {
      setServices([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

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

    const attachListener = async () => {
      const candidates = [];
      if (clinicId) {
        if (legacyOwnerUid) {
          try {
            await migrateLegacyCollectionToClinic({
              clinicId,
              legacyOwnerUid,
              collectionName: 'services',
              transformDoc: ({ data }) => ({
                clinicId,
                createdByUid: data.createdByUid || data.ownerUid || sessionUid || null,
              }),
            });
          } catch (migrationError) {
            console.error('[useUserServices] Legacy migration failed:', migrationError);
          }
        }
        if (cancelled) return;
        candidates.push({
          source: 'clinic',
          pathLabel: `clinics/${clinicId}/services`,
          ref: collection(db, 'clinics', clinicId, 'services'),
        });
      }
      if (legacyOwnerUid) {
        if (cancelled) return;
        candidates.push({
          source: 'legacy',
          pathLabel: `users/${legacyOwnerUid}/services`,
          ref: collection(db, 'users', legacyOwnerUid, 'services'),
        });
      }

      if (candidates.length === 0) {
        setServices([]);
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
          console.warn('[useUserServices] probe failed for candidate', candidate, probeError);
        }
      }

      if (!selectedCandidate) {
        selectedCandidate = candidates[0];
      }

      console.log(
        '[useUserServices] subscribing path=%s source=%s',
        selectedCandidate.pathLabel,
        selectedCandidate.source
      );

      if (cancelled) return;
      const stop = onSnapshot(
        selectedCandidate.ref,
        (snapshot) => {
          if (cancelled) return;
          const mapped = snapshot.docs.map((doc) => mapDocToService(doc));
          const sorted = mapped.slice().sort((a, b) => {
            const aTime = a?.createdAt ? Date.parse(String(a.createdAt)) : Number.POSITIVE_INFINITY;
            const bTime = b?.createdAt ? Date.parse(String(b.createdAt)) : Number.POSITIVE_INFINITY;
            if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
            if (!Number.isFinite(aTime)) return 1;
            if (!Number.isFinite(bTime)) return -1;
            return aTime - bTime;
          });
          setServices(sorted);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          if (cancelled) return;
          console.error('Error loading services:', snapshotError, selectedCandidate);
          setError('Kunne ikke hente dine ydelser.');
          setServices([]);
          setLoading(false);
        }
      );
      if (cancelled) {
        stop();
        return;
      }
      setUnsubscribe(stop);
    };

    void attachListener();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [clinicId, legacyOwnerUid, sessionUid]);

  return { services, loading, error };
}

export default useUserServices;
