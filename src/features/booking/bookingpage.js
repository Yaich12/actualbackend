import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './bookingpage.css';
import { BookingSidebarLayout } from '../../components/ui/BookingSidebarLayout';
import AppointmentForm from './appointment/appointment';
import Journal from './Journal/journal';
import Indlæg from './Journal/indlæg/indlæg';
import { useAuth } from '../../AuthContext';
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc, where, getDocs, writeBatch, query } from 'firebase/firestore';
import { db } from '../../firebase';
import useAppointments from '../../hooks/useAppointments';
import { combineDateAndTimeToIso } from '../../utils/appointmentFormat';
import { useUserClients } from './Klienter/hooks/useUserClients';

function BookingPage() {
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('week'); // 'month' | 'week' | 'day'
  const [now, setNow] = useState(new Date());
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [nextAppointmentTemplate, setNextAppointmentTemplate] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClientFallback, setSelectedClientFallback] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showJournalEntryForm, setShowJournalEntryForm] = useState(false);
  const [journalEntryClient, setJournalEntryClient] = useState(null);
  const [dragState, setDragState] = useState(null); // { mode, appointmentId, dayIndex, startClientX, startClientY, daysRect, columnRect, originalStart, originalEnd, currentStart, currentEnd }
  const daysContainerRef = React.useRef(null);
  const { appointments = [] } = useAppointments(user?.uid || null);
  const { clients } = useUserClients();
  const START_HOUR = 6;
  const END_HOUR = 19;
  const VISIBLE_HOURS = END_HOUR - START_HOUR;
  const HOUR_HEIGHT = 64;
  const TOTAL_MINUTES = VISIBLE_HOURS * 60;
  const derivedSelectedClient = useMemo(() => {
    if (selectedClientId) {
      const match = clients.find((client) => client.id === selectedClientId);
      if (match) {
        return match;
      }
    }
    return selectedClientFallback;
  }, [clients, selectedClientId, selectedClientFallback]);

  useEffect(() => {
    const current = new Date();
    setCurrentDate(current);
    setNow(current);

    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => clearInterval(intervalId);
  }, []);


  const monthNames = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december'
  ];

  const dayNames = ['MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR', 'SØN'];

  const startOfWeek = (date) => {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const getWeekDays = (date) => {
    const start = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  };

  const formatDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const parseDateTime = (isoString, dateStr, timeStr) => {
    if (isoString) {
      const parsed = new Date(isoString);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (dateStr && timeStr) {
      const [day, month, year] = dateStr.split('-').map((part) => parseInt(part, 10));
      const [hours, minutes] = timeStr.split(':').map((part) => parseInt(part, 10));
      if ([day, month, year, hours, minutes].every((value) => !Number.isNaN(value))) {
        return new Date(year, month - 1, day, hours, minutes);
      }
    }

    return null;
  };

  const parseAppointmentDateTimes = (appointment) => {
    const startDate = parseDateTime(
      appointment.start || appointment.startIso,
      appointment.startDate,
      appointment.startTime
    );
    const endDate = parseDateTime(
      appointment.end || appointment.endIso,
      appointment.endDate || appointment.startDate,
      appointment.endTime || appointment.startTime
    );

    return { startDate, endDate: endDate || startDate };
  };

  const formatTime = (date) => {
    if (!date) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const appointmentsByDay = useMemo(() => {
    const map = {};

    appointments.forEach((appointmentItem) => {
      const { startDate, endDate } = parseAppointmentDateTimes(appointmentItem);
      if (!startDate) return;

      const key = formatDateKey(startDate);
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push({
        ...appointmentItem,
        startDateObj: startDate,
        endDateObj: endDate || startDate,
      });
    });

    return map;
  }, [appointments]);

  const deriveServiceType = (appointment) => {
    if (!appointment) return 'service';
    if (appointment.serviceType) return appointment.serviceType;
    if (typeof appointment.serviceId === 'string' && appointment.serviceId.startsWith('forloeb:')) {
      return 'forloeb';
    }
    return 'service';
  };

  const participantNames = (appointment) => {
    const extractName = (p) => {
      if (!p) return null;
      if (typeof p === 'string') return p.trim() || null;
      const firstLast =
        p.firstName || p.lastName ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null;
      return (
        p.name ||
        p.navn ||
        p.fullName ||
        p.client ||
        p.title ||
        p.label ||
        p.participantName ||
        p.displayName ||
        firstLast
      );
    };

    const names = [];
    if (Array.isArray(appointment?.participants)) {
      appointment.participants.forEach((p) => {
        const name = extractName(p);
        if (name) names.push(name);
      });
    }
    if (appointment?.client) names.push(appointment.client);

    const uniq = Array.from(new Set(names.filter(Boolean)));
    return uniq.sort((a, b) => a.localeCompare(b, 'da', { sensitivity: 'base' }));
  };

  const toRgb = (hex) => {
    if (!hex || typeof hex !== 'string') return null;
    let h = hex.replace('#', '').trim();
    if (h.length === 3) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (h.length !== 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  };

  const getSoftColorStyle = (color) => {
    const rgb = toRgb(color);
    if (!rgb) return {};
    const { r, g, b } = rgb;
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)`,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.55)`,
      color: '#0f172a',
    };
  };

  const getServiceLabel = (appointment) => {
    if (!appointment) return 'Aftale';
    if (appointment.service) return appointment.service;
    if (appointment.serviceType === 'forloeb') return 'Forløb';
    return appointment.title || appointment.client || 'Aftale';
  };

  const groupDayEvents = (dayEvents) => {
    const groups = {};
    dayEvents.forEach((ev) => {
      const startLabel = ev.startTime || formatTime(ev.startDateObj);
      const endLabel = ev.endTime || formatTime(ev.endDateObj);
      const type = deriveServiceType(ev);
      const key = `${startLabel}|${endLabel}|${type}`;
      if (!groups[key]) {
        groups[key] = { events: [], start: ev.startDateObj, end: ev.endDateObj, type };
      }
      groups[key].events.push(ev);
    });
    return Object.values(groups);
  };

  const getMinutesFromMidnight = (date) => date.getHours() * 60 + date.getMinutes();

  const getEventPosition = (startDate, endDate) => {
    const startMinutes = getMinutesFromMidnight(startDate);
    const endMinutes = Math.max(getMinutesFromMidnight(endDate || startDate), startMinutes + 15);
    const boundedStart = Math.min(Math.max(startMinutes, START_HOUR * 60), END_HOUR * 60);
    const boundedEnd = Math.min(Math.max(endMinutes, boundedStart + 15), END_HOUR * 60);
    const heightMinutes = Math.max(boundedEnd - boundedStart, 5);
    const topPercent = ((boundedStart - START_HOUR * 60) / TOTAL_MINUTES) * 100;
    const heightPercent = (heightMinutes / TOTAL_MINUTES) * 100;

    return {
      top: `${topPercent}%`,
      height: `${heightPercent}%`,
    };
  };

  const roundToStep = (value, step) => Math.round(value / step) * step;
  const SNAP_STEP_MINUTES = 15;
  const snapToStepMinutes = (totalMinutes, step = SNAP_STEP_MINUTES) =>
    Math.round(totalMinutes / step) * step;

  const updateDragPreview = (event) => {
    setDragState((prev) => {
      if (!prev) return null;

      const { mode, originalStart, originalEnd, daysRect, columnRect, dayIndex } = prev;

      const deltaY = event.clientY - prev.startClientY;
      const deltaMinutesRaw = (deltaY / columnRect.height) * TOTAL_MINUTES;

      let currentStart = new Date(originalStart);
      let currentEnd = new Date(originalEnd);

      const toTotalMinutes = (d) => d.getHours() * 60 + d.getMinutes();

      if (mode === 'move') {
        if (!daysRect) return prev;

        const daysToRender = currentView === 'week' ? weekDays : [currentDate];
        let targetDayIndex = dayIndex;

        if (event.clientX >= daysRect.left && event.clientX <= daysRect.right) {
          const relX = event.clientX - daysRect.left;
          const columnWidth = daysRect.width / daysToRender.length;
          targetDayIndex = Math.floor(relX / columnWidth);
          targetDayIndex = Math.max(0, Math.min(targetDayIndex, daysToRender.length - 1));
        }

        const baseDay = (currentView === 'week' ? weekDays : [currentDate])[targetDayIndex];

        currentStart = new Date(baseDay);
        currentStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);

        currentEnd = new Date(baseDay);
        currentEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

        const origStartMinutes = toTotalMinutes(currentStart);
        const origEndMinutes = toTotalMinutes(currentEnd);
        const duration = origEndMinutes - origStartMinutes;

        const targetStartRaw = origStartMinutes + deltaMinutesRaw;
        let targetStart = snapToStepMinutes(targetStartRaw, SNAP_STEP_MINUTES);

        const minStart = START_HOUR * 60;
        const maxEnd = END_HOUR * 60;
        const maxStart = maxEnd - duration;

        targetStart = Math.max(minStart, Math.min(targetStart, maxStart));
        const targetEnd = targetStart + duration;

        const sH = Math.floor(targetStart / 60);
        const sM = targetStart % 60;
        const eH = Math.floor(targetEnd / 60);
        const eM = targetEnd % 60;

        currentStart.setHours(sH, sM, 0, 0);
        currentEnd.setHours(eH, eM, 0, 0);
      } else if (mode === 'resize-start') {
        const origStartMinutes = toTotalMinutes(originalStart);
        const origEndMinutes = toTotalMinutes(originalEnd);

        const targetStartRaw = origStartMinutes + deltaMinutesRaw;
        let targetStart = snapToStepMinutes(targetStartRaw, SNAP_STEP_MINUTES);

        const minStart = START_HOUR * 60;
        const maxStart = origEndMinutes - SNAP_STEP_MINUTES;

        targetStart = Math.max(minStart, Math.min(targetStart, maxStart));

        const sH = Math.floor(targetStart / 60);
        const sM = targetStart % 60;

        currentStart = new Date(originalStart);
        currentStart.setHours(sH, sM, 0, 0);
        currentEnd = new Date(originalEnd);
      } else if (mode === 'resize-end') {
        const origStartMinutes = toTotalMinutes(originalStart);
        const origEndMinutes = toTotalMinutes(originalEnd);

        const targetEndRaw = origEndMinutes + deltaMinutesRaw;
        let targetEnd = snapToStepMinutes(targetEndRaw, SNAP_STEP_MINUTES);

        const minEnd = origStartMinutes + SNAP_STEP_MINUTES;
        const maxEnd = END_HOUR * 60;

        targetEnd = Math.max(minEnd, Math.min(targetEnd, maxEnd));

        const eH = Math.floor(targetEnd / 60);
        const eM = targetEnd % 60;

        currentStart = new Date(originalStart);
        currentEnd = new Date(originalEnd);
        currentEnd.setHours(eH, eM, 0, 0);
      }

      return {
        ...prev,
        currentStart,
        currentEnd,
      };
    });
  };

  const hourLabels = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index),
    [START_HOUR, END_HOUR]
  );
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const isSameDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const toDate = (dayObj) => new Date(dayObj.year, dayObj.month, dayObj.day);

  const navigateByView = (direction) => {
    setCurrentDate((prev) => {
      const nextDate = new Date(prev);
      if (currentView === 'month') {
        nextDate.setMonth(prev.getMonth() + direction);
      } else if (currentView === 'week') {
        nextDate.setDate(prev.getDate() + direction * 7);
      } else {
        nextDate.setDate(prev.getDate() + direction);
      }
      return nextDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setNow(today);
  };

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const getCalendarWeeks = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); // Monday = 1
    
    const weeks = [];
    let currentWeek = [];
    
    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i > 0; i--) {
      currentWeek.push({
        day: prevMonthLastDay - i + 1,
        month: month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false
      });
    }
    
    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      currentWeek.push({
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true
      });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Add days from next month
    let nextMonthDay = 1;
    while (currentWeek.length < 7) {
      currentWeek.push({
        day: nextMonthDay,
        month: month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false
      });
      nextMonthDay++;
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  const calendarWeeks = useMemo(() => getCalendarWeeks(), [currentDate]);

  const handleCreateAppointment = async (appointment) => {
    if (!user?.uid) {
      console.error('[BookingPage] Cannot create appointment: user not logged in');
      return;
    }

    const items = Array.isArray(appointment) ? appointment : [appointment];

    try {
      const appointmentsCollection = collection(db, 'users', user.uid, 'appointments');

      for (const appt of items) {
        const startIso = combineDateAndTimeToIso(appt.startDate, appt.startTime);
        const endIso = combineDateAndTimeToIso(appt.endDate, appt.endTime);

        if (!startIso || !endIso) {
          throw new Error('Invalid start or end time');
        }

        const title = appt.client || appt.service || 'Aftale';

        const payload = {
          therapistId: user.uid,
          title,
          client: appt.client || title,
          clientId: appt.clientId || null,
          clientEmail: appt.clientEmail || '',
          clientPhone: appt.clientPhone || '',
          service: appt.service || '',
          serviceId: appt.serviceId || null,
          serviceType: deriveServiceType(appt),
          serviceDuration: appt.serviceDuration || '',
          servicePrice:
            typeof appt.servicePrice === 'number' ? appt.servicePrice : null,
          servicePriceInclVat:
            typeof appt.servicePriceInclVat === 'number'
              ? appt.servicePriceInclVat
              : null,
          participants: Array.isArray(appt.participants)
            ? appt.participants
            : appt.client
            ? [
                {
                  id: appt.clientId || 'client-1',
                  name: appt.client,
                  email: appt.clientEmail || '',
                  phone: appt.clientPhone || '',
                },
              ]
            : [],
          notes: appt.notes || '',
          color: appt.color || null,
          start: startIso,
          end: endIso,
          startDate: appt.startDate,
          startTime: appt.startTime,
          endDate: appt.endDate,
          endTime: appt.endTime,
          status: 'booked',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        console.log('[BookingPage] Creating appointment document', payload);
        await addDoc(appointmentsCollection, payload);
      }
    } catch (error) {
      console.error('[BookingPage] Failed to create appointment', error);
    } finally {
      setShowAppointmentForm(false);
      setEditingAppointment(null);
      setNextAppointmentTemplate(null);
    }
  };

  const handleUpdateAppointment = async (appointment) => {
    if (!user?.uid || !appointment?.id) {
      console.error('[BookingPage] Cannot update appointment: missing user or appointment id');
      return;
    }

    try {
      const startIso = combineDateAndTimeToIso(appointment.startDate, appointment.startTime);
      const endIso = combineDateAndTimeToIso(appointment.endDate, appointment.endTime);

      if (!startIso || !endIso) {
        throw new Error('Invalid start or end time');
      }

      const title = appointment.client || appointment.service || 'Aftale';
      const docRef = doc(db, 'users', user.uid, 'appointments', appointment.id);

      await updateDoc(docRef, {
        title,
        client: appointment.client || title,
        clientId: appointment.clientId || null,
        clientEmail: appointment.clientEmail || '',
        clientPhone: appointment.clientPhone || '',
        service: appointment.service || '',
        serviceId: appointment.serviceId || null,
        serviceType: deriveServiceType(appointment),
        serviceDuration: appointment.serviceDuration || '',
        servicePrice:
          typeof appointment.servicePrice === 'number' ? appointment.servicePrice : null,
        servicePriceInclVat:
          typeof appointment.servicePriceInclVat === 'number'
            ? appointment.servicePriceInclVat
            : null,
        participants: Array.isArray(appointment.participants)
          ? appointment.participants
          : appointment.client
          ? [
              {
                id: appointment.clientId || 'client-1',
                name: appointment.client,
                email: appointment.clientEmail || '',
                phone: appointment.clientPhone || '',
              },
            ]
          : [],
        notes: appointment.notes || '',
        color: appointment.color || null,
        start: startIso,
        end: endIso,
        status: appointment.status || 'booked',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[BookingPage] Failed to update appointment', error);
    } finally {
      setShowAppointmentForm(false);
      setEditingAppointment(null);
      setNextAppointmentTemplate(null);
    }
  };

  const handleDeleteAppointment = async (appointment) => {
    if (!user?.uid || !appointment?.id) {
      console.error('[BookingPage] Cannot delete appointment – missing user or appointment id');
      return;
    }

    try {
      const appointmentsCollection = collection(db, 'users', user.uid, 'appointments');
      const isForloeb =
        deriveServiceType(appointment) === 'forloeb' ||
        (typeof appointment.serviceId === 'string' && appointment.serviceId.startsWith('forloeb:'));

      const deleteAll = isForloeb
        ? window.confirm(
            'Dette er en del af et forløb.\n\nOK: Slet hele klientens forløb.\nAnnuller: Slet kun denne dato.'
          )
        : false;

      if (isForloeb && deleteAll) {
        const filters = [where('serviceId', '==', appointment.serviceId || '')];
        if (appointment.clientId) {
          filters.push(where('clientId', '==', appointment.clientId));
        }
        const q = query(appointmentsCollection, ...filters);
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        console.log('[BookingPage] Deleted forløb series', appointment.serviceId, 'count:', snap.size);
      } else {
        const ref = doc(db, 'users', user.uid, 'appointments', appointment.id);
        await deleteDoc(ref);
        console.log('[BookingPage] Deleted appointment', appointment.id);
      }

      setSelectedAppointment(null);
      setSelectedClientId(null);
      setSelectedClientFallback(null);
      setEditingAppointment(null);
      setShowAppointmentForm(false);
      setNextAppointmentTemplate(null);
    } catch (error) {
      console.error('[BookingPage] Failed to delete appointment', error);
    }
  };

  const handleAppointmentClick = (appointment) => {
    setEditingAppointment(null);
    setNextAppointmentTemplate(null);
    const { startDate } = parseAppointmentDateTimes(appointment);
    if (startDate) {
      setCurrentDate(startDate);
    }
    setSelectedClientId(appointment.clientId || null);
    setSelectedClientFallback(
      appointment.client || appointment.clientEmail || appointment.clientPhone
        ? {
            id: appointment.clientId || 'legacy-client',
            navn: appointment.client || 'Ukendt klient',
            email: appointment.clientEmail || '',
            telefon: appointment.clientPhone || '',
            status: 'Aktiv',
            adresse: '',
            by: '',
            postnummer: '',
            land: 'Danmark',
          }
        : null
    );
    setSelectedAppointment(appointment);
    setShowAppointmentForm(false);
  };

  const startMoveEvent = (event, appointment, dayIndex, startDateObj, endDateObj) => {
    event.preventDefault();
    event.stopPropagation();

    if (!daysContainerRef.current) return;

    const daysRect = daysContainerRef.current.getBoundingClientRect();
    const columnEl = event.currentTarget.closest('.time-grid-day-body');
    if (!columnEl) return;
    const columnRect = columnEl.getBoundingClientRect();

    setDragState({
      mode: 'move',
      appointmentId: appointment.id,
      dayIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      daysRect,
      columnRect,
      originalStart: startDateObj,
      originalEnd: endDateObj || startDateObj,
      currentStart: startDateObj,
      currentEnd: endDateObj || startDateObj,
    });
  };

  const startResizeEvent = (event, appointment, dayIndex, startDateObj, endDateObj, mode) => {
    event.preventDefault();
    event.stopPropagation();

    const columnEl = event.currentTarget.closest('.time-grid-day-body');
    if (!columnEl) return;
    const columnRect = columnEl.getBoundingClientRect();

    setDragState({
      mode,
      appointmentId: appointment.id,
      dayIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      columnRect,
      originalStart: startDateObj,
      originalEnd: endDateObj || startDateObj,
      currentStart: startDateObj,
      currentEnd: endDateObj || startDateObj,
    });
  };

  const finishDrag = async (event) => {
    if (!dragState) return;

    const { appointmentId, currentStart, currentEnd } = dragState;

    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt || !currentStart || !currentEnd) {
      setDragState(null);
      return;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const toDateStr = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    const toTimeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const toTotalMinutes = (d) => d.getHours() * 60 + d.getMinutes();

    let snappedStart = new Date(currentStart);
    let snappedEnd = new Date(currentEnd);

    const startTotal = snapToStepMinutes(toTotalMinutes(currentStart), SNAP_STEP_MINUTES);
    const endTotal = snapToStepMinutes(toTotalMinutes(currentEnd), SNAP_STEP_MINUTES);

    const sH = Math.floor(startTotal / 60);
    const sM = startTotal % 60;
    const eH = Math.floor(endTotal / 60);
    const eM = endTotal % 60;

    snappedStart.setHours(sH, sM, 0, 0);
    snappedEnd.setHours(eH, eM, 0, 0);

    const updated = {
      ...appt,
      startDate: toDateStr(snappedStart),
      startTime: toTimeStr(snappedStart),
      endDate: toDateStr(snappedEnd),
      endTime: toTimeStr(snappedEnd),
    };

    setDragState(null);
    await handleUpdateAppointment(updated);
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (event) => {
      event.preventDefault();
      updateDragPreview(event);
    };

    const handleMouseUp = (event) => {
      event.preventDefault();
      finishDrag(event);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState]);

  const handleCloseJournal = () => {
    setSelectedClientId(null);
    setSelectedClientFallback(null);
    setSelectedAppointment(null);
    setEditingAppointment(null);
    setNextAppointmentTemplate(null);
  };

  const handleCreateNextAppointment = (payload) => {
    const fromJournal = payload?.appointment || null;
    setNextAppointmentTemplate(fromJournal);
    setShowAppointmentForm(true);
    setSelectedClientId(null);
    setSelectedClientFallback(null);
    setSelectedAppointment(null);
    setEditingAppointment(null);
  };

  const handleOpenJournalEntry = () => {
    if (!derivedSelectedClient) return;
    setJournalEntryClient(derivedSelectedClient);
    setShowJournalEntryForm(true);
  };

  const handleJournalEntrySaved = (entry) => {
    console.log('[BookingPage] journal entry saved', entry);
    setShowJournalEntryForm(false);
  };

  const handleCloseJournalEntry = () => {
    setShowJournalEntryForm(false);
  };

  const userIdentity = useMemo(() => {
    if (!user) {
      return {
        name: 'Ikke logget ind',
        email: 'Log ind for at fortsætte',
        initials: '?',
        photoURL: null,
      };
    }

    const name = user.displayName || user.email || 'Selma bruger';
    const email = user.email || '—';
    const initialsSource = (user.displayName || user.email || '?').trim();
    const initials = initialsSource
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return {
      name,
      email,
      initials,
      photoURL: user.photoURL || null,
    };
  }, [user]);

  const renderMonthView = () => (
    <>
      <div className="calendar-header">
        <div className="week-number-header"></div>
        {(calendarWeeks[0] || []).map((day, index) => {
          const dateObj = toDate(day);
          const dayNameIndex = dateObj.getDay(); // 0 (Sun) - 6 (Sat)
          const labelDayName = dayNames[(dayNameIndex + 6) % 7];
          const dayNumber = day.day;
          const month = day.month + 1;
          return (
            <div key={index} className="calendar-day-header">
              {labelDayName} {dayNumber}/{month}
            </div>
          );
        })}
      </div>
      <div className="calendar-grid">
        {calendarWeeks.map((week, weekIndex) => {
          const weekStartDate = new Date(week[0].year, week[0].month, week[0].day);
          const weekNumber = getWeekNumber(weekStartDate);
          return (
            <React.Fragment key={weekIndex}>
              <div className="week-number-cell">{weekNumber}</div>
              {week.map((day, dayIndex) => {
                const dayAppointments = appointments.filter((appointment) => {
                  if (!appointment.startDate) return false;
                  const [dayStr, monthStr, yearStr] = appointment.startDate.split('-');
                  const appDay = parseInt(dayStr, 10);
                  const appMonth = parseInt(monthStr, 10) - 1;
                  const appYear = parseInt(yearStr, 10);
                  return appDay === day.day && appMonth === day.month && appYear === day.year;
                });

                const isSelected = selectedAppointment &&
                  selectedAppointment.startDate &&
                  (() => {
                    const [dayStr, monthStr, yearStr] = selectedAppointment.startDate.split('-');
                    const appDay = parseInt(dayStr, 10);
                    const appMonth = parseInt(monthStr, 10) - 1;
                    const appYear = parseInt(yearStr, 10);
                    return appDay === day.day && appMonth === day.month && appYear === day.year;
                  })();

                return (
                  <div
                    key={dayIndex}
                    className={`calendar-day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected-day' : ''}`}
                  >
                    <span className="day-number">{day.day}</span>
                    {dayAppointments.length > 0 && (
                      <div className="day-appointments">
                        {dayAppointments.map((appointment) => (
                          <span
                            key={appointment.id}
                            className={`day-appointment-chip service-type-${deriveServiceType(appointment)}`}
                            onClick={() => handleAppointmentClick(appointment)}
                            style={{
                              cursor: 'pointer',
                              ...(appointment.color ? getSoftColorStyle(appointment.color) : {}),
                            }}
                          >
                            {getServiceLabel(appointment)}{' '}
                            {(() => {
                              const names = participantNames(appointment);
                              if (names.length > 1) {
                                return (
                                  <span className="chip-names-stack">
                                    {names.map((n) => (
                                      <span key={n} className="chip-name-line">
                                        {n}
                                      </span>
                                    ))}
                                  </span>
                                );
                              }
                              return appointment.client ? `– ${appointment.client.split(' ')[0]}` : '– Aftale';
                            })()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );

  const renderTimeGrid = () => {
    const daysToRender = currentView === 'week' ? weekDays : [currentDate];
    const gridStyle = {
      '--days-count': daysToRender.length,
      '--hour-height': `${HOUR_HEIGHT}px`,
      '--visible-hours': VISIBLE_HOURS,
      '--time-grid-height': `${VISIBLE_HOURS * HOUR_HEIGHT}px`,
      minWidth: `${80 + daysToRender.length * 120}px`,
    };
    const nowMinutes = getMinutesFromMidnight(now);
    const nowTopPercent =
      nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60
        ? ((nowMinutes - START_HOUR * 60) / TOTAL_MINUTES) * 100
        : null;

    const gridClassName = `time-grid${currentView === 'day' ? ' is-day-view' : ''}`;

    return (
      <div className={gridClassName} style={gridStyle}>
        <div className="time-grid-header">
          <div className="time-grid-hours-spacer"></div>
          {daysToRender.map((day) => {
            const isHighlighted = currentView === 'day' || isSameDate(day, currentDate);
            const isToday = isSameDate(day, now);
            const dayNameIndex = day.getDay(); // 0 (Sun) - 6 (Sat)
            const labelDayName = dayNames[(dayNameIndex + 6) % 7];
            return (
              <button
                key={formatDateKey(day)}
                type="button"
                className={`time-grid-day-header ${isHighlighted ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                onClick={() => setCurrentDate(new Date(day))}
              >
                <span className="day-name">{labelDayName}</span>
                <span className="day-date">
                  {day.getDate()}/{day.getMonth() + 1}
                </span>
              </button>
            );
          })}
        </div>
        <div className="time-grid-body">
          <div className="time-grid-hours" style={{ height: `${VISIBLE_HOURS * HOUR_HEIGHT}px` }}>
            {hourLabels.map((hour, index) => (
              <div
                key={hour}
                className="time-grid-hour-label"
                style={{ top: `${(index / VISIBLE_HOURS) * 100}%` }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          <div className="time-grid-days" ref={daysContainerRef}>
            {daysToRender.map((day, dayIndex) => {
              const dayKey = formatDateKey(day);
              const dayEvents = (appointmentsByDay[dayKey] || [])
                .slice()
                .sort(
                  (a, b) =>
                    (a.startDateObj?.getTime?.() || 0) - (b.startDateObj?.getTime?.() || 0)
                );
              const isHighlighted = currentView === 'day' || isSameDate(day, currentDate);
              const isToday = isSameDate(day, now);
              const showNowLine =
                (currentView === 'day' || currentView === 'week') &&
                isToday &&
                nowTopPercent !== null;

              const groupedEvents = groupDayEvents(dayEvents);

              return (
                <div
                  key={dayKey}
                  className={`time-grid-day ${isHighlighted ? 'is-highlighted' : ''} ${isToday ? 'is-today' : ''}`}
                >
                  <div
                    className="time-grid-day-body"
                    style={{ height: `${VISIBLE_HOURS * HOUR_HEIGHT}px` }}
                  >
                    {showNowLine && (
                      <div className="time-indicator-line" style={{ top: `${nowTopPercent}%` }} />
                    )}
                    {groupedEvents.map((group, idx) => {
                      const first = group.events[0];
                      const allNames = group.events.flatMap(participantNames).filter(Boolean);
                      const uniqNames = Array.from(new Set(allNames));
                      let visualStart = group.start;
                      let visualEnd = group.end || group.start;

                      const isDragged = dragState && dragState.appointmentId === first.id;

                      if (isDragged) {
                        if (dragState.currentStart) visualStart = dragState.currentStart;
                        if (dragState.currentEnd) visualEnd = dragState.currentEnd;
                      }

                      const style = visualStart
                        ? getEventPosition(visualStart, visualEnd || visualStart)
                        : {};

                      let ghostStyle = null;
                      if (isDragged && dragState.originalStart) {
                        const ghostStart = dragState.originalStart;
                        const ghostEnd = dragState.originalEnd || dragState.originalStart;
                        ghostStyle = getEventPosition(ghostStart, ghostEnd || ghostStart);
                      }

                      return (
                        <React.Fragment key={`${dayKey}-${idx}`}>
                          {isDragged && ghostStyle && (
                            <div
                              className={`time-grid-event time-grid-event-ghost service-type-${group.type}`}
                              style={{
                                ...ghostStyle,
                              ...(first.color ? getSoftColorStyle(first.color) : {}),
                              }}
                            >
                              <div className="time-grid-event-inner">
                                <span className="time-grid-event-time">
                                  {getServiceLabel(first)}
                                </span>
                                {uniqNames.length > 1 ? (
                                  <div className="time-grid-event-names">
                                    {uniqNames.map((n) => (
                                      <div key={n} className="time-grid-event-name">
                                        {n}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="time-grid-event-title">
                                    {first.client || first.title || 'Aftale'}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div
                            className={`time-grid-event service-type-${group.type} ${
                              isDragged ? 'is-dragging' : ''
                            }`}
                            style={{
                              ...style,
                              ...(first.color ? getSoftColorStyle(first.color) : {}),
                            }}
                          >
                            <div
                              className="time-grid-event-resize-handle resize-handle-top"
                              onMouseDown={(e) =>
                                startResizeEvent(
                                  e,
                                  first,
                                  daysToRender.indexOf(day),
                                  group.start,
                                  group.end || group.start,
                                  'resize-start'
                                )
                              }
                            />

                            <div
                              className="time-grid-event-inner"
                              onMouseDown={(e) =>
                                startMoveEvent(
                                  e,
                                  first,
                                  daysToRender.indexOf(day),
                                  group.start,
                                  group.end || group.start
                                )
                              }
                              onClick={() => handleAppointmentClick(first)}
                            >
                              <span className="time-grid-event-time">
                                {getServiceLabel(first)}
                              </span>
                              {uniqNames.length > 1 ? (
                                <div className="time-grid-event-names">
                                  {uniqNames.map((n) => (
                                    <div key={n} className="time-grid-event-name">
                                      {n}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="time-grid-event-title">
                                  {first.client || first.title || 'Aftale'}
                                </span>
                              )}
                            </div>

                            <div
                              className="time-grid-event-resize-handle resize-handle-bottom"
                              onMouseDown={(e) =>
                                startResizeEvent(
                                  e,
                                  first,
                                  daysToRender.indexOf(day),
                                  group.start,
                                  group.end || group.start,
                                  'resize-end'
                                )
                              }
                            />
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        {/* Top Navigation Bar */}
        <div className="booking-topbar">
          <div className="topbar-left">
            <button className="topbar-logo-btn" onClick={async () => {
              await signOutUser();
              navigate('/');
            }}>
              Forside
            </button>
          </div>
          <div className="topbar-center">
            <div className="topbar-navigation">
              <button className="nav-arrow" onClick={() => navigateByView(-1)}>←</button>
              <button className="nav-today" onClick={goToToday}>i dag</button>
              <button className="nav-arrow" onClick={() => navigateByView(1)}>→</button>
            </div>
            <div className="topbar-view-toggle">
              <button
                className={`view-toggle-btn ${currentView === 'month' ? 'active' : ''}`}
                onClick={() => setCurrentView('month')}
              >
                Måned
              </button>
              <button
                className={`view-toggle-btn ${currentView === 'week' ? 'active' : ''}`}
                onClick={() => setCurrentView('week')}
              >
                Uge
              </button>
              <button
                className={`view-toggle-btn ${currentView === 'day' ? 'active' : ''}`}
                onClick={() => setCurrentView('day')}
              >
                Dag
              </button>
            </div>
            <span className="current-month">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
          </div>
          <div className="topbar-right">
            <button 
              className="create-appointment-btn"
              onClick={() => {
                setEditingAppointment(null);
                setNextAppointmentTemplate(null);
                setSelectedAppointment(null);
                setSelectedClientId(null);
                setSelectedClientFallback(null);
                setShowAppointmentForm(true);
              }}
            >
              <span className="plus-icon">+</span>
              Opret aftale
            </button>
          </div>
        </div>

        <div className={`booking-content ${
          showJournalEntryForm
            ? 'with-journal-entry'
            : (showAppointmentForm || derivedSelectedClient ? 'with-appointment-form' : '')
        }`}>
          {showJournalEntryForm ? (
            <div className="booking-main booking-main-full">
              <Indlæg
                clientId={journalEntryClient?.id}
                clientName={journalEntryClient?.navn}
                onClose={handleCloseJournalEntry}
                onSave={handleJournalEntrySaved}
              />
            </div>
          ) : (
            <>
              {/* Main Calendar Area */}
              <div className="booking-main">
                <div className="calendar-container">
                  {currentView === 'month' ? renderMonthView() : renderTimeGrid()}
                </div>
              </div>

              {/* Journal or Appointment Form */}
              {derivedSelectedClient ? (
                <div className="appointment-form-wrapper">
                  <Journal
                    selectedClient={derivedSelectedClient}
                    selectedAppointment={selectedAppointment}
                    onClose={handleCloseJournal}
                    onCreateAppointment={handleCreateNextAppointment}
                    onCreateJournalEntry={handleOpenJournalEntry}
                    onEditAppointment={(appointment) => {
                      setEditingAppointment(appointment);
                      setShowAppointmentForm(true);
                      setSelectedAppointment(null);
                      setSelectedClientId(null);
                      setSelectedClientFallback(null);
                    }}
                    onDeleteAppointment={handleDeleteAppointment}
                  />
                </div>
              ) : showAppointmentForm && (
                <div className="appointment-form-wrapper">
                  <AppointmentForm
                    initialAppointment={editingAppointment || nextAppointmentTemplate || null}
                    mode={editingAppointment ? 'edit' : 'create'}
                    onClose={() => {
                      setShowAppointmentForm(false);
                      setEditingAppointment(null);
                      setNextAppointmentTemplate(null);
                    }}
                    onCreate={handleCreateAppointment}
                    onUpdate={handleUpdateAppointment}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </BookingSidebarLayout>
  );
}

export default BookingPage;
