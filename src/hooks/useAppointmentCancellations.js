import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { deriveLegacyOwnerUid, migrateLegacyCollectionToClinic } from '../utils/workspaceContext';

const normalizeId = (value) => `${value || ''}`.trim();

const toDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return converted instanceof Date ? converted : null;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const mapCancellationDoc = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    appointmentId: data.appointmentId || null,
    referenceNumber: data.referenceNumber || null,
    scheduledDateKey:
      typeof data.scheduledDateKey === 'string' && data.scheduledDateKey.trim()
        ? data.scheduledDateKey.trim()
        : '',
    scheduledAtIso:
      typeof data.scheduledAtIso === 'string' && data.scheduledAtIso.trim()
        ? data.scheduledAtIso.trim()
        : '',
    scheduledAtDate: toDateValue(data.scheduledAtIso || data.scheduledAt || null),
    cancelledAtDate: toDateValue(data.cancelledAt),
    cancellationSource: data.cancellationSource || '',
  };
};

const useAppointmentCancellations = (scopeId, options = {}) => {
  const { sessionUid, userDoc, activeClinicId, workspaceUid } = useAuth();
  const requestedMaxItems = Number(options.maxItems);
  const maxItems =
    Number.isFinite(requestedMaxItems) && requestedMaxItems > 0 ? requestedMaxItems : 500;
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const clinicId = normalizeId(activeClinicId || userDoc?.activeClinicId || userDoc?.clinicId || '');
  const legacyOwnerUid = deriveLegacyOwnerUid(userDoc, workspaceUid || scopeId || sessionUid || '');

  useEffect(() => {
    if (!clinicId && !legacyOwnerUid) {
      setCancellations([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubscribe = () => {};
    let cancelled = false;
    const setUnsubscribe = (nextUnsubscribe) => {
      let stopped = false;
      unsubscribe = () => {
        if (stopped) return;
        stopped = true;
        nextUnsubscribe();
      };
    };

    const attachListener = async () => {
      let cancellationsRef = null;
      if (clinicId) {
        if (legacyOwnerUid) {
          try {
            await migrateLegacyCollectionToClinic({
              clinicId,
              legacyOwnerUid,
              collectionName: 'appointmentCancellations',
              transformDoc: () => ({ clinicId }),
            });
          } catch (migrationError) {
            console.error('[useAppointmentCancellations] legacy migration failed:', migrationError);
          }
        }
        if (cancelled) return;
        cancellationsRef = collection(db, 'clinics', clinicId, 'appointmentCancellations');
      } else {
        if (cancelled) return;
        cancellationsRef = collection(db, 'users', legacyOwnerUid, 'appointmentCancellations');
      }

      const cancellationsQuery = query(
        cancellationsRef,
        orderBy('cancelledAt', 'desc'),
        limit(maxItems)
      );

      if (cancelled) return;
      const stop = onSnapshot(
        cancellationsQuery,
        (snapshot) => {
          if (cancelled) return;
          setCancellations(snapshot.docs.map(mapCancellationDoc));
          setLoading(false);
        },
        (snapshotError) => {
          if (cancelled) return;
          console.error('[useAppointmentCancellations] snapshot error:', snapshotError);
          setError(snapshotError);
          setCancellations([]);
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
  }, [clinicId, legacyOwnerUid, maxItems]);

  return { cancellations, loading, error };
};

export default useAppointmentCancellations;
