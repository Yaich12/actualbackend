import { useEffect, useState } from 'react';
import { getApp } from 'firebase/app';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';

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

  return {
    id: doc.id,
    referenceNumber:
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
      null,
    staffUid:
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
    service: data.service || '',
    serviceId: data.serviceId ?? null,
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
    startIso: startDateObj ? startDateObj.toISOString() : data.start || '',
    endIso: endDateObj ? endDateObj.toISOString() : data.end || '',
    start: startDateObj || data.start || '',
    end: endDateObj || data.end || '',
    startDate: derivedStartDate || data.startDate || '',
    startTime: derivedStartTime || data.startTime || '',
    endDate: derivedEndDate || data.endDate || '',
    endTime: derivedEndTime || data.endTime || '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    participants: Array.isArray(data.participants) ? data.participants : [],
    color: data.color || null,
  };
};

/**
 * Subscribe to appointments for a specific therapist.
 * Reads from: users/{therapistId}/appointments
 * Appointments are ordered by start time ascending.
 *
 * @param {string|null} therapistId - The UID of the therapist (user.uid)
 * @returns {{ appointments: Array, loading: boolean, error: Error|null }}
 */
const useAppointments = (therapistId) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If no therapistId is provided, don't subscribe
    if (!therapistId) {
      setAppointments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Collection path: users/{therapistId}/appointments
    const appointmentsRef = collection(db, 'users', therapistId, 'appointments');
    const appointmentsQuery = query(appointmentsRef, orderBy('start', 'asc'));

    const projectId = getApp().options?.projectId || 'unknown-project';
    console.log(
      '[useAppointments] projectId=%s path=users/%s/appointments',
      projectId,
      therapistId
    );

    const unsubscribe = onSnapshot(
      appointmentsQuery,
      (snapshot) => {
        const nextAppointments = snapshot.docs.map(mapAppointmentDoc);
        console.log('[useAppointments] received appointments:', nextAppointments.length);
        setAppointments(nextAppointments);
        setLoading(false);
      },
      (snapshotError) => {
        console.error('[useAppointments] snapshot error:', snapshotError);
        setError(snapshotError);
        setAppointments([]);
        setLoading(false);
      }
    );

    return () => {
      console.log('[useAppointments] unsubscribing');
      unsubscribe();
    };
  }, [therapistId]);

  return { appointments, loading, error };
};

export default useAppointments;
