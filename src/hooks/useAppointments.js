import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';

const deriveDatePartsFromIso = (iso) => {
  if (!iso) {
    return { startDate: '', startTime: '' };
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
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

  const {
    startDate: derivedStartDate,
    startTime: derivedStartTime,
  } = deriveDatePartsFromIso(data.start);

  const {
    startDate: derivedEndDate,
    startTime: derivedEndTime,
  } = deriveDatePartsFromIso(data.end);

  return {
    id: doc.id,
    therapistId: data.therapistId || null,
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
    title: data.title || '',
    notes: data.notes || '',
    status: data.status || 'booked',
    startIso: data.start || '',
    endIso: data.end || '',
    start: data.start || '',
    end: data.end || '',
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

    console.log(
      '[useAppointments] subscribing to users/%s/appointments',
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


