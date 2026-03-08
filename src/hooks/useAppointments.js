import { useEffect, useState } from 'react';
import { getApp } from 'firebase/app';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { buildAppointmentReference } from '../utils/appointmentReference';
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
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const deriveDatePartsFromValue = (value) => {
  const date = toDateValue(value);
  if (!date) {
    return { startDate: '', startTime: '' };
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return {
    startDate: `${day}-${month}-${year}`,
    startTime: `${hours}:${minutes}`,
  };
};

const getAppointmentSortTime = (appointment) => {
  const directStart =
    toDateValue(appointment?.start) ||
    toDateValue(appointment?.startIso);
  if (directStart) {
    return directStart.getTime();
  }

  const startDate = String(appointment?.startDate || '').trim();
  const startTime = String(appointment?.startTime || '').trim();
  if (startDate && startTime) {
    const [left = '', middle = '', right = ''] = startDate.split('-').map((part) => part.trim());
    const [hours = '0', minutes = '0'] = startTime.split(':').map((part) => part.trim());
    const values = [left, middle, right, hours, minutes].map((part) => Number(part));
    if (values.every((value) => Number.isFinite(value))) {
      let [day, month, year, hour, minute] = values;
      if (day > 31) {
        [year, month, day] = [day, month, year];
      }
      const parsed = new Date(year, month - 1, day, hour, minute);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
    }
  }

  return 0;
};

/**
 * Maps a Firestore appointment document to a UI-friendly shape.
 */
const mapAppointmentDoc = (doc) => {
  const data = doc.data() || {};
  const startValue = data.start || data.startIso || data.startTime || null;
  const endValue = data.end || data.endIso || data.endTime || null;
  const startDateObj = toDateValue(startValue);
  const endDateObj = toDateValue(endValue);

  const {
    startDate: derivedStartDate,
    startTime: derivedStartTime,
  } = deriveDatePartsFromValue(startValue);

  const {
    startDate: derivedEndDate,
    startTime: derivedEndTime,
  } = deriveDatePartsFromValue(endValue);

  const storedReference =
    data.refNr ||
    data.ref_nr ||
    data.referenceNumber ||
    data.referenceNo ||
    data.reference ||
    data.ref ||
    data.refNumber ||
    data.appointmentRef ||
    data.appointmentReference ||
    data.appointmentRefNr ||
    data.referenceId ||
    null;

  const fallbackReference = buildAppointmentReference({
    clientName: data.client || data.title || data.firstName || '',
    createdAt: data.createdAt || data.createdAtIso || startDateObj || startValue || null,
  });

  return {
    id: doc.id,
    referenceNumber: storedReference || fallbackReference,
    clinicId: data.clinicId || null,
    assignedToUid:
      data.assignedToUid ||
      data.calendarOwnerId ||
      data.staffUid ||
      data.staffId ||
      data.therapistId ||
      null,
    createdByUid: data.createdByUid || data.createdBy || null,
    staffUid:
      data.assignedToUid ||
      data.staffUid ||
      data.calendarOwnerId ||
      data.staffId ||
      data.therapistId ||
      null,
    therapistId: data.therapistId || null,
    calendarOwnerId:
      data.calendarOwnerId ||
      data.staffUid ||
      data.staffId ||
      data.therapistId ||
      null,
    calendarOwner:
      data.calendarOwner ||
      data.ownerName ||
      data.staffName ||
      data.employeeName ||
      data.teamMember ||
      data.assignedTo ||
      null,
    client: data.client || data.title || '',
    clientId: data.clientId ?? null,
    clientEmail: data.clientEmail || '',
    clientPhone: data.clientPhone || '',
    firstName: data.firstName || data.fornavn || '',
    lastName: data.lastName || data.efternavn || '',
    email: data.email || data.clientEmail || '',
    phone: data.phone || data.clientPhone || data.telefonKomplet || data.telefon || '',
    service: data.service || '',
    serviceId: data.serviceId ?? null,
    forloebId: data.forloebId ?? null,
    serviceType: data.serviceType || data.type || '',
    serviceDuration: data.serviceDuration || '',
    servicePrice:
      typeof data.servicePrice === 'number' ? data.servicePrice : null,
    servicePriceInclVat:
      typeof data.servicePriceInclVat === 'number'
        ? data.servicePriceInclVat
        : null,
    additionalServices: Array.isArray(data.additionalServices)
      ? data.additionalServices
      : [],
    title: data.title || '',
    notes: data.notes || '',
    status: data.status || 'booked',
    source: data.source || data.bookingSource || data.origin || '',
    createdBy: data.createdBy || data.createdByUid || null,
    startIso: startDateObj ? startDateObj.toISOString() : data.start || '',
    endIso: endDateObj ? endDateObj.toISOString() : data.end || '',
    start: startDateObj || data.start || '',
    end: endDateObj || data.end || '',
    startDate: derivedStartDate || data.startDate || '',
    startTime: derivedStartTime || data.startTime || '',
    endDate: derivedEndDate || data.endDate || '',
    endTime: derivedEndTime || data.endTime || '',
    createdAt: data.createdAt || null,
    createdAtIso: data.createdAtIso || null,
    updatedAt: data.updatedAt || null,
    notificationAcknowledged:
      data.notificationAcknowledged === true || data.notificationSeen === true,
    notificationAcknowledgedAt:
      data.notificationAcknowledgedAt || data.notificationSeenAt || null,
    participants: Array.isArray(data.participants) ? data.participants : [],
    recurrenceGroupId: data.recurrenceGroupId || null,
    recurrenceIndex:
      typeof data.recurrenceIndex === 'number' ? data.recurrenceIndex : null,
    recurrenceCount:
      typeof data.recurrenceCount === 'number' ? data.recurrenceCount : null,
    recurrenceAnchorDate: data.recurrenceAnchorDate || '',
    isRecurringSeries: data.isRecurringSeries === true,
    color: data.color || null,
  };
};

/**
 * Subscribe to appointments in the active clinic workspace.
 * Reads from: clinics/{clinicId}/appointments
 * Legacy fallback: users/{ownerUid}/appointments
 * Appointments are ordered by start time ascending.
 *
 * @param {string|null} scopeId - Optional legacy scope identifier
 * @returns {{ appointments: Array, loading: boolean, error: Error|null }}
 */
const useAppointments = (scopeId) => {
  const { sessionUid, userDoc, activeClinicId, workspaceUid } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const clinicId = normalizeId(activeClinicId || userDoc?.activeClinicId || userDoc?.clinicId || '');
  const legacyOwnerUid = deriveLegacyOwnerUid(userDoc, workspaceUid || scopeId || sessionUid || '');

  useEffect(() => {
    if (!clinicId && !legacyOwnerUid) {
      setAppointments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const projectId = getApp().options?.projectId || 'unknown-project';
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
      const candidates = [];
      if (clinicId) {
        if (legacyOwnerUid) {
          try {
            await migrateLegacyCollectionToClinic({
              clinicId,
              legacyOwnerUid,
              collectionName: 'appointments',
              transformDoc: ({ data }) => {
                const assignedToUid =
                  data.assignedToUid ||
                  data.calendarOwnerId ||
                  data.staffUid ||
                  data.staffId ||
                  data.therapistId ||
                  null;
                const createdByUid = data.createdByUid || data.createdBy || data.therapistId || sessionUid || null;
                return {
                  clinicId,
                  assignedToUid,
                  createdByUid,
                };
              },
            });
          } catch (migrationError) {
            console.error('[useAppointments] legacy migration failed:', migrationError);
          }
        }
        if (cancelled) return;
        candidates.push({
          source: 'clinic',
          pathLabel: `clinics/${clinicId}/appointments`,
          ref: collection(db, 'clinics', clinicId, 'appointments'),
        });
      }
      if (legacyOwnerUid) {
        if (cancelled) return;
        candidates.push({
          source: 'legacy',
          pathLabel: `users/${legacyOwnerUid}/appointments`,
          ref: collection(db, 'users', legacyOwnerUid, 'appointments'),
        });
      }

      if (candidates.length === 0) {
        setAppointments([]);
        setLoading(false);
        setError(null);
        return;
      }

      let selectedCandidate = null;
      for (const candidate of candidates) {
        if (cancelled) return;
        try {
          // Preflight read to avoid listen/unlisten races that can trigger SDK assertions.
          // eslint-disable-next-line no-await-in-loop
          await getDocs(query(candidate.ref, limit(1)));
          if (cancelled) return;
          selectedCandidate = candidate;
          break;
        } catch (probeError) {
          console.warn('[useAppointments] probe failed for candidate', candidate, probeError);
        }
      }

      if (!selectedCandidate) {
        selectedCandidate = candidates[0];
      }

      console.log(
        '[useAppointments] projectId=%s path=%s source=%s',
        projectId,
        selectedCandidate.pathLabel,
        selectedCandidate.source
      );

      if (cancelled) return;
      const stop = onSnapshot(
        selectedCandidate.ref,
        (snapshot) => {
          if (cancelled) return;
          const nextAppointments = snapshot.docs
            .map(mapAppointmentDoc)
            .sort((left, right) => getAppointmentSortTime(left) - getAppointmentSortTime(right));
          console.log(
            '[useAppointments] received appointments: %s from %s',
            nextAppointments.length,
            selectedCandidate.pathLabel
          );
          setAppointments(nextAppointments);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          if (cancelled) return;
          console.error('[useAppointments] snapshot error:', snapshotError, selectedCandidate);
          setError(snapshotError);
          setAppointments([]);
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
      console.log('[useAppointments] unsubscribing');
      unsubscribe();
    };
  }, [clinicId, legacyOwnerUid, sessionUid]);

  return { appointments, loading, error };
};

export default useAppointments;
