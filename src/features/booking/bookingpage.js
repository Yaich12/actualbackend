import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './bookingpage.css';
import { BookingSidebarLayout } from '../../components/ui/BookingSidebarLayout';
import AppointmentForm from './appointment/appointment';
import Journal from './Journal/journal';
import Indlæg from './Journal/indlæg/indlæg';
import AddKlient from './Klienter/addklient/addklient';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc, where, getDocs, writeBatch, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import useAppointments from '../../hooks/useAppointments';
import { combineDateAndTimeToIso, parseDateString } from '../../utils/appointmentFormat';
import { formatServiceDuration } from '../../utils/serviceLabels';
import { useUserClients } from './Klienter/hooks/useUserClients';
import { useUserServices } from './Ydelser/hooks/useUserServices';
import Dropdown from './dropdown/dropdown';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Snowflake,
  UserPlus,
  X,
} from 'lucide-react';

const getInitials = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const candidateParts =
    parts.length > 1 ? parts : parts[0].split(/[@._-]+/).filter(Boolean);
  return candidateParts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

function BookingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
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
  const [journalEntryParticipants, setJournalEntryParticipants] = useState([]);
  const [journalEntryDate, setJournalEntryDate] = useState('');
  const [dragState, setDragState] = useState(null); // { mode, appointmentId, dayIndex, startClientX, startClientY, daysRect, columnRect, originalStart, originalEnd, currentStart, currentEnd }
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [calendarAddMode, setCalendarAddMode] = useState(false);
  const [calendarStep, setCalendarStep] = useState('services');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [additionalServices, setAdditionalServices] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [showClientCreate, setShowClientCreate] = useState(false);
  const [serviceSelectionMode, setServiceSelectionMode] = useState('primary');
  const [serviceQuery, setServiceQuery] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [hoverSlot, setHoverSlot] = useState(null);
  const isDev = process.env.NODE_ENV !== 'production';
  const ownerNameFallback = useMemo(
    () =>
      user?.displayName ||
      user?.email ||
      t('booking.topbar.defaultUser', 'Selma bruger'),
    [t, user?.displayName, user?.email]
  );
  const ownerInitials = useMemo(
    () => getInitials(ownerNameFallback),
    [ownerNameFallback]
  );
  const ownerEntry = useMemo(
    () => ({
      id: user?.uid || 'owner',
      name: ownerNameFallback,
      avatarUrl: profilePhotoUrl || user?.photoURL || '',
      avatarColor: '#0ea5e9',
      avatarText: ownerInitials,
    }),
    [ownerInitials, ownerNameFallback, profilePhotoUrl, user?.photoURL, user?.uid]
  );
  const [teamMembers, setTeamMembers] = useState(() => [ownerEntry]);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState('all'); // 'all' | 'custom'
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([ownerEntry.name]);
  const [hasTeamAccess, setHasTeamAccess] = useState(false);
  const teamMenuRef = useRef(null);
  const daysContainerRef = React.useRef(null);
  const { appointments = [] } = useAppointments(user?.uid || null);
  const { clients, loading: clientsLoading, error: clientsError } = useUserClients();
  const {
    services,
    loading: servicesLoading,
    error: servicesError,
  } = useUserServices();
  const appointmentFallback = t('booking.calendar.appointment', 'Aftale');
  const programFallback = t('booking.calendar.program', 'Forløb');
  const START_HOUR = 6;
  const END_HOUR = 19;
  const VISIBLE_HOURS = END_HOUR - START_HOUR;
  const HOUR_HEIGHT = 64;
  const TOTAL_MINUTES = VISIBLE_HOURS * 60;
  const CALENDAR_SLOT_STEP = 10;
  const DEFAULT_SERVICE_MINUTES = 60;
  const normalizeValue = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();
  const normalizePhone = (value) => normalizeValue(value).replace(/[^\d+]/g, '');
  const resolveClientMatch = (appointment) => {
    if (!appointment || !clients.length) return null;
    if (appointment.clientId) {
      const direct = clients.find((client) => client.id === appointment.clientId);
      if (direct) return direct;
    }
    const email = normalizeValue(appointment.clientEmail);
    if (email) {
      const match = clients.find(
        (client) => normalizeValue(client.email) === email
      );
      if (match) return match;
    }
    const phone = normalizePhone(appointment.clientPhone);
    if (phone) {
      const match = clients.find(
        (client) => normalizePhone(client.telefon) === phone
      );
      if (match) return match;
    }
    const name = normalizeValue(appointment.client || appointment.title);
    if (name) {
      const match = clients.find(
        (client) => normalizeValue(client.navn) === name
      );
      if (match) return match;
    }
    return null;
  };
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (teamMenuRef.current && !teamMenuRef.current.contains(event.target)) {
        setTeamMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMember = (name) => {
    setSelectedTeamMembers((prev) => {
      if (prev.includes(name)) {
        const next = prev.filter((n) => n !== name);
        setTeamFilter(next.length === teamMembers.length ? 'all' : 'custom');
        return next;
      }
      const next = [...prev, name];
      setTeamFilter(next.length === teamMembers.length ? 'all' : 'custom');
      return next;
    });
  };

  const clearMembers = () => {
    setSelectedTeamMembers([]);
    setTeamFilter('custom');
  };

  const selectAllMembers = () => {
    setSelectedTeamMembers(teamMembers.map((m) => m.name));
    setTeamFilter('all');
  };

  const entireTeamLabel = t('booking.calendar.entireTeam', 'Hele teamet');
  const teamOnDutyLabel = t('booking.calendar.teamOnDuty', 'Team på arbejde');
  const primaryCalendarOwner = teamMembers[0]?.name || entireTeamLabel;

  const getAppointmentOwner = (appointment) =>
    appointment?.calendarOwner || appointment?.ownerName || primaryCalendarOwner;

  const visibleAppointments = useMemo(() => {
    if (!selectedTeamMembers.length) return appointments;
    const selected = new Set(selectedTeamMembers);
    return appointments.filter((appointment) => selected.has(getAppointmentOwner(appointment)));
  }, [appointments, selectedTeamMembers, primaryCalendarOwner]);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return services;
    return services.filter((service) => {
      const name = service.navn?.toLowerCase?.() || '';
      const duration = service.varighed?.toLowerCase?.() || '';
      return name.includes(query) || duration.includes(query);
    });
  }, [serviceQuery, services]);

  const groupedServices = useMemo(() => {
    const groups = new Map();
    filteredServices.forEach((service) => {
      const key =
        service.category ||
        service.kategori ||
        service.group ||
        service.groupName ||
        t('booking.calendar.services.defaultGroup', 'Ydelser');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(service);
    });
    return Array.from(groups.entries()).map(([name, items]) => ({
      name,
      items,
    }));
  }, [filteredServices, t]);

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => {
      const name = client.navn?.toLowerCase?.() || '';
      const email = client.email?.toLowerCase?.() || '';
      const phone = client.telefon?.toLowerCase?.() || '';
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [clientQuery, clients]);

  const selectedLabel = (() => {
    const total = teamMembers.length;
    if (selectedTeamMembers.length === total && total > 0) return entireTeamLabel;
    if (selectedTeamMembers.length === 1) return selectedTeamMembers[0];
    if (selectedTeamMembers.length === 0) return teamOnDutyLabel;
    return teamOnDutyLabel;
  })();

  const isMultiTeam = selectedTeamMembers.length > 1;
  const hourHeight = isMultiTeam ? 44 : HOUR_HEIGHT;
  const singleTeamMember =
    selectedTeamMembers.length === 1
      ? teamMembers.find((member) => member.name === selectedTeamMembers[0]) || {
          id: selectedTeamMembers[0],
          name: selectedTeamMembers[0],
          avatarText: selectedTeamMembers[0]?.charAt(0) || '?',
          avatarColor: '#0ea5e9',
        }
      : null;

  const mapTeamDoc = (docSnap) => {
    const data = docSnap.data() || {};
    const name =
      (typeof data.name === 'string' && data.name.trim()) ||
      `${data.firstName || ''}${data.lastName ? ` ${data.lastName}` : ''}`.trim() ||
      t('booking.calendar.memberFallback', 'Medarbejder');
    const avatarText =
      (typeof data.avatarText === 'string' && data.avatarText.trim()) ||
      name.charAt(0).toUpperCase() ||
      'S';
    return {
      id: docSnap.id,
      name,
      email: data.email || '',
      phone: data.phone || '',
      avatarUrl: data.avatarUrl || '',
      avatarColor: data.calendarColor || data.avatarColor || '#0ea5e9',
      avatarText,
      role: data.role || '',
    };
  };

  useEffect(() => {
    setTeamMembers([ownerEntry]);
    setSelectedTeamMembers([ownerEntry.name]);
  }, [ownerEntry]);

  useEffect(() => {
    if (!user?.uid || !hasTeamAccess) {
      setTeamMembers([ownerEntry]);
      setSelectedTeamMembers([ownerEntry.name]);
      setTeamFilter('custom');
      setTeamMenuOpen(false);
      return;
    }

    const ref = collection(db, 'users', user.uid, 'team');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const loaded = snap.docs.map(mapTeamDoc);
        const membersWithOwner = loaded.length ? loaded : [ownerEntry];
        setTeamMembers(membersWithOwner);

        setSelectedTeamMembers((prev) => {
          const validNames = membersWithOwner.map((m) => m.name);
          const filtered = prev.filter((n) => validNames.includes(n));
          if (filtered.length > 0) return filtered;
          return [membersWithOwner[0]?.name || ownerEntry.name];
        });

        if (membersWithOwner.length === 1) {
          setTeamFilter('custom');
        }
      },
      (error) => {
        console.error('[BookingPage] Failed to load team members', error);
        setTeamMembers([ownerEntry]);
        setSelectedTeamMembers([ownerEntry.name]);
        setTeamFilter('custom');
        setTeamMenuOpen(false);
      }
    );

    return () => unsubscribe();
  }, [hasTeamAccess, ownerEntry, t, user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setHasTeamAccess(false);
      setSelectedTeamMembers([
        teamMembers[0]?.name || t('booking.topbar.defaultUser', 'Selma bruger'),
      ]);
      setTeamFilter('custom');
      return;
    }

    const ref = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const teamAllowed = data?.accountType === 'team' || data?.hasTeam === true;
        setHasTeamAccess(teamAllowed);
        if (typeof data?.photoURL === 'string') {
          setProfilePhotoUrl(data.photoURL);
        } else {
          setProfilePhotoUrl(user.photoURL || '');
        }

        if (!teamAllowed) {
          const fallbackName =
            data?.fullName ||
            data?.clinicName ||
            user.displayName ||
            user.email ||
            t('booking.topbar.defaultUser', 'Selma bruger');
          setSelectedTeamMembers((prev) => {
            if (prev.length === 1 && prev[0] === fallbackName) return prev;
            return [fallbackName];
          });
          setTeamFilter('custom');
          setTeamMenuOpen(false);
        } else if (selectedTeamMembers.length === 0) {
          setSelectedTeamMembers(teamMembers.map((m) => m.name));
          setTeamFilter('all');
        }
      },
      (err) => {
        console.error('[BookingPage] Failed to load account type', err);
        setHasTeamAccess(false);
        setProfilePhotoUrl(user?.photoURL || '');
        setSelectedTeamMembers([
          teamMembers[0]?.name || t('booking.topbar.defaultUser', 'Selma bruger'),
        ]);
        setTeamFilter('custom');
        setTeamMenuOpen(false);
      }
    );

    return () => unsubscribe();
  }, [selectedTeamMembers.length, t, teamMembers, user?.displayName, user?.email, user?.photoURL, user?.uid]);

  const dayNameFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale]
  );
  const toolbarDayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    [locale]
  );
  const slotDayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    [locale]
  );
  const toolbarMonthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    [locale]
  );

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

  const formatToolbarDay = (date) => {
    return toolbarDayFormatter.format(date);
  };

  const formatToolbarWeek = (date) => {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${formatToolbarDay(start)} - ${formatToolbarDay(end)}`;
  };

  const toolbarDateLabel = useMemo(() => {
    if (currentView === 'day') return formatToolbarDay(currentDate);
    if (currentView === 'week') return formatToolbarWeek(currentDate);
    return toolbarMonthFormatter.format(currentDate);
  }, [currentDate, currentView, toolbarDayFormatter, toolbarMonthFormatter]);

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
      const parsedDate = parseDateString(dateStr);
      const [hours, minutes] = timeStr.split(':').map((part) => parseInt(part, 10));
      if (parsedDate && [hours, minutes].every((value) => !Number.isNaN(value))) {
        return new Date(
          parsedDate.year,
          parsedDate.month - 1,
          parsedDate.day,
          hours,
          minutes
        );
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

  const formatDateString = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(typeof value === 'number' && !Number.isNaN(value) ? value : 0);

  const parseDurationToMinutes = (value) => {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (!value || typeof value !== 'string') return null;
    const text = value.toLowerCase();
    let total = 0;
    const hoursMatch = text.match(/(\d+)\s*(t|time|timer)/);
    const minutesMatch = text.match(/(\d+)\s*(min|minute|minutter)/);
    if (hoursMatch) total += Number(hoursMatch[1]) * 60;
    if (minutesMatch) total += Number(minutesMatch[1]);
    if (total > 0) return total;
    const numeric = text.match(/(\d+)/);
    return numeric ? Number(numeric[1]) : null;
  };

  const buildSlotFromMinutes = (dayDate, ownerName, minutesFromMidnight) => {
    const startDate = new Date(dayDate);
    const hours = Math.floor(minutesFromMidnight / 60);
    const minutes = minutesFromMidnight % 60;
    startDate.setHours(hours, minutes, 0, 0);
    const dayKey = formatDateKey(startDate);
    const topPercent = ((minutesFromMidnight - START_HOUR * 60) / TOTAL_MINUTES) * 100;
    return {
      dayKey,
      ownerName: ownerName || null,
      startDate,
      startMinutes: minutesFromMidnight,
      topPercent,
      label: formatTime(startDate),
    };
  };

  const getSlotFromPointer = (event, dayDate, ownerName) => {
    const columnRect = event.currentTarget.getBoundingClientRect();
    const offsetY = Math.min(Math.max(event.clientY - columnRect.top, 0), columnRect.height);
    const rawMinutes = START_HOUR * 60 + (offsetY / columnRect.height) * TOTAL_MINUTES;
    const snappedMinutes = Math.round(rawMinutes / CALENDAR_SLOT_STEP) * CALENDAR_SLOT_STEP;
    const maxStart = END_HOUR * 60 - CALENDAR_SLOT_STEP;
    const clampedMinutes = Math.min(Math.max(snappedMinutes, START_HOUR * 60), maxStart);
    return buildSlotFromMinutes(dayDate, ownerName, clampedMinutes);
  };

  const appointmentsByDay = useMemo(() => {
    const map = {};

    visibleAppointments.forEach((appointmentItem) => {
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
  }, [visibleAppointments]);

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
    const isForloeb =
      deriveServiceType(appointment) === 'forloeb' ||
      (typeof appointment?.serviceId === 'string' && appointment.serviceId.startsWith('forloeb:'));
    if (!isForloeb && appointment?.client) names.push(appointment.client);

    const uniq = Array.from(new Set(names.filter(Boolean)));
    return uniq.sort((a, b) => a.localeCompare(b, locale, { sensitivity: 'base' }));
  };

  const renderNamesPreview = (names) => {
    if (!Array.isArray(names) || names.length === 0) return null;

    const visible = names.slice(0, 2);
    const remaining = Math.max(0, names.length - visible.length);

    return (
      <span className="chip-names-stack">
        {visible.map((n) => (
          <span key={n} className="chip-name-line">
            {n}
          </span>
        ))}
        {remaining > 0 && (
          <span className="chip-name-more">+{remaining}</span>
        )}
      </span>
    );
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
    if (!appointment) return appointmentFallback;
    if (appointment.service) return appointment.service;
    if (appointment.serviceType === 'forloeb') return programFallback;
    return appointment.title || appointment.client || appointmentFallback;
  };

  const groupDayEvents = (dayEvents) => {
    const groups = {};
    dayEvents.forEach((ev) => {
      const startLabel = ev.startTime || formatTime(ev.startDateObj);
      const endLabel = ev.endTime || formatTime(ev.endDateObj);
      const type = deriveServiceType(ev);
      const serviceKey = ev.serviceId || ev.service || ev.title || '';
      const key = `${startLabel}|${endLabel}|${type}|${serviceKey}`;
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

  const handleSelectDayFromWeek = (day) => {
    setCurrentDate(new Date(day));
    if (currentView === 'week') {
      setCurrentView('day');
    }
  };

  const handleRefresh = () => {
    setNow(new Date());
    setCurrentDate((prev) => new Date(prev));
  };

  const resetCalendarAddState = () => {
    setSelectedSlot(null);
    setSelectedService(null);
    setAdditionalServices([]);
    setSelectedClient(null);
    setClientPickerOpen(false);
    setServiceQuery('');
    setClientQuery('');
    setHoverSlot(null);
    setCalendarStep('services');
    setServiceSelectionMode('primary');
  };

  const handleStartCalendarAddMode = () => {
    setEditingAppointment(null);
    setNextAppointmentTemplate(null);
    setSelectedAppointment(null);
    setSelectedClientId(null);
    setSelectedClientFallback(null);
    setShowAppointmentForm(false);
    resetCalendarAddState();
    setCalendarAddMode(true);
    if (currentView === 'month') {
      setCurrentView('week');
    }
  };

  const handleCloseCalendarAddMode = () => {
    setCalendarAddMode(false);
    resetCalendarAddState();
  };

  const handleOpenAppointmentForm = () => {
    setCalendarAddMode(false);
    resetCalendarAddState();
    setEditingAppointment(null);
    setNextAppointmentTemplate(null);
    setSelectedAppointment(null);
    setSelectedClientId(null);
    setSelectedClientFallback(null);
    setShowAppointmentForm(true);
  };

  useEffect(() => {
    if (!calendarAddMode) {
      setHoverSlot(null);
    }
  }, [calendarAddMode]);

  useEffect(() => {
    if (calendarAddMode && currentView === 'month') {
      setCurrentView('week');
    }
  }, [calendarAddMode, currentView]);

  const handleSlotHover = (event, dayDate, ownerName) => {
    if (!calendarAddMode || dragState) return;
    const slot = getSlotFromPointer(event, dayDate, ownerName);
    setHoverSlot((prev) => {
      if (
        prev &&
        prev.dayKey === slot.dayKey &&
        prev.ownerName === slot.ownerName &&
        prev.startMinutes === slot.startMinutes
      ) {
        return prev;
      }
      return slot;
    });
  };

  const handleSlotLeave = () => {
    if (!calendarAddMode) return;
    setHoverSlot(null);
  };

  const handleSlotClick = (event, dayDate, ownerName) => {
    if (!calendarAddMode) return;
    if (event.target.closest('.time-grid-event')) return;
    const slot = getSlotFromPointer(event, dayDate, ownerName);
    setSelectedSlot(slot);
    setSelectedService(null);
    setSelectedClient(null);
    setClientPickerOpen(false);
    setCalendarStep('services');
    if (isDev) {
      console.log('[BookingPage] Selected calendar slot', {
        date: slot.startDate,
        owner: slot.ownerName,
      });
    }
  };

  const handleSelectService = (service) => {
    if (!selectedSlot || !service) return;
    setClientPickerOpen(false);
    if (serviceSelectionMode === 'additional' && selectedService) {
      setAdditionalServices((prev) => {
        if (prev.some((item) => item.id === service.id)) {
          return prev;
        }
        return [...prev, service];
      });
      setCalendarStep('confirm');
      setServiceSelectionMode('primary');
      if (isDev) {
        console.log('[BookingPage] Added extra service', {
          id: service.id,
          navn: service.navn,
        });
      }
      return;
    }

    const durationMinutes =
      parseDurationToMinutes(service.varighed) || DEFAULT_SERVICE_MINUTES;
    const endDate = new Date(selectedSlot.startDate);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);
    setSelectedSlot((prev) =>
      prev
        ? {
            ...prev,
            endDate,
            durationMinutes,
            serviceDuration: service.varighed || `${durationMinutes} min`,
          }
        : prev
    );
    setSelectedService(service);
    setAdditionalServices([]);
    setCalendarStep('confirm');
    setServiceSelectionMode('primary');
    if (isDev) {
      console.log('[BookingPage] Selected service', {
        id: service.id,
        navn: service.navn,
        durationMinutes,
        endTime: formatTime(endDate),
      });
    }
  };

  const handleAddAnotherService = () => {
    setCalendarStep('services');
    setServiceSelectionMode('additional');
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientPickerOpen(false);
    if (isDev && client) {
      console.log('[BookingPage] Selected client', {
        id: client.id,
        navn: client.navn,
      });
    }
  };

  const handleOpenClientCreate = () => {
    setClientPickerOpen(false);
    setShowClientCreate(true);
  };

  const handleClientCreated = (client) => {
    if (client) {
      handleSelectClient(client);
    }
    setShowClientCreate(false);
  };

  const handleSaveCalendarAppointment = async () => {
    if (!selectedSlot || !selectedService) return;

    const startDate = selectedSlot.startDate;
    const durationMinutes =
      selectedSlot.durationMinutes ||
      parseDurationToMinutes(selectedService.varighed) ||
      DEFAULT_SERVICE_MINUTES;
    const endDate = selectedSlot.endDate
      ? new Date(selectedSlot.endDate)
      : new Date(startDate);

    if (!selectedSlot.endDate) {
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);
    }

    const ownerName =
      selectedSlot.ownerName ||
      (selectedTeamMembers.length === 1
        ? selectedTeamMembers[0]
        : teamMembers[0]?.name || ownerEntry.name);

    const extraServices = additionalServices.map((service) => ({
      id: service.id,
      navn: service.navn,
      varighed: service.varighed,
      pris: typeof service.pris === 'number' ? service.pris : null,
      prisInklMoms:
        typeof service.prisInklMoms === 'number' ? service.prisInklMoms : null,
      color: service.color || null,
    }));

    const payload = {
      title: selectedClient?.navn || selectedService.navn || appointmentFallback,
      calendarOwner: ownerName,
      client: selectedClient?.navn || '',
      clientId: selectedClient?.id || null,
      clientEmail: selectedClient?.email || '',
      clientPhone: selectedClient?.telefon || '',
      service: selectedService.navn || appointmentFallback,
      serviceId: selectedService.id || null,
      serviceType: 'service',
      serviceDuration: selectedService.varighed || `${durationMinutes} min`,
      servicePrice:
        typeof selectedService.pris === 'number' ? selectedService.pris : null,
      servicePriceInclVat:
        typeof selectedService.prisInklMoms === 'number'
          ? selectedService.prisInklMoms
          : typeof selectedService.pris === 'number'
          ? selectedService.pris
          : null,
      additionalServices: extraServices,
      participants: selectedClient
        ? [
            {
              id: selectedClient.id || null,
              name: selectedClient.navn || '',
              email: selectedClient.email || '',
              phone: selectedClient.telefon || '',
            },
          ]
        : [],
      notes: '',
      color: selectedService.color || null,
      startDate: formatDateString(startDate),
      startTime: formatTime(startDate),
      endDate: formatDateString(endDate),
      endTime: formatTime(endDate),
      status: 'booked',
    };

    if (isDev) {
      console.log('[BookingPage] Saving calendar appointment', {
        startDate: payload.startDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        service: payload.service,
        client: payload.client,
      });
    }

    try {
      await handleCreateAppointment(payload);
      if (isDev) {
        console.log('[BookingPage] Calendar appointment saved');
      }
    } catch (error) {
      if (isDev) {
        console.error('[BookingPage] Failed to save calendar appointment', error);
      }
    }

    resetCalendarAddState();
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

      const normalizeParticipant = (p) => {
        if (!p) return null;
        if (typeof p === 'string') {
          const name = p.trim();
          return name ? { id: null, name } : null;
        }
        const name =
          p.name ||
          p.navn ||
          p.fullName ||
          (p.firstName || p.lastName ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null);
        if (!name && !p.email) return null;
        return {
          id: p.id || null,
          name: name || null,
          email: p.email || null,
          phone: p.phone || p.telefon || null,
        };
      };

      const mergeParticipants = (...lists) => {
        const all = [];
        lists.forEach((list) => {
          if (!Array.isArray(list)) return;
          list.forEach((p) => {
            const normalized = normalizeParticipant(p);
            if (normalized) all.push(normalized);
          });
        });

        const seen = new Set();
        const result = [];
        all.forEach((p) => {
          const key =
            (p.id && `id:${p.id}`) ||
            (p.email && `email:${String(p.email).toLowerCase()}`) ||
            (p.name && `name:${String(p.name).toLowerCase()}`) ||
            null;
          if (!key || seen.has(key)) return;
          seen.add(key);
          result.push(p);
        });
        return result;
      };

      const forloebGroups = new Map(); // key -> payload
      const normalPayloads = [];

      for (const appt of items) {
        const startIso = combineDateAndTimeToIso(appt.startDate, appt.startTime);
        const endIso = combineDateAndTimeToIso(appt.endDate, appt.endTime);

        if (!startIso || !endIso) {
          throw new Error('Invalid start or end time');
        }

        const serviceType = deriveServiceType(appt);
        const isForloeb =
          serviceType === 'forloeb' ||
          (typeof appt?.serviceId === 'string' && appt.serviceId.startsWith('forloeb:'));
        const title = isForloeb
          ? appt.service || appt.title || programFallback
          : appt.client || appt.service || appointmentFallback;
        const selectedOwnerName =
          appt.calendarOwner ||
          appt.ownerName ||
          (selectedTeamMembers.length === 1 ? selectedTeamMembers[0] : teamMembers[0]?.name) ||
          ownerEntry.name;
        const selectedOwnerId = appt.calendarOwnerId || null;

        const payload = {
          therapistId: user.uid,
          calendarOwner: selectedOwnerName,
          calendarOwnerId: selectedOwnerId,
          title,
          client: isForloeb ? title : appt.client || title,
          clientId: isForloeb ? null : appt.clientId || null,
          clientEmail: isForloeb ? '' : appt.clientEmail || '',
          clientPhone: isForloeb ? '' : appt.clientPhone || '',
          service: appt.service || '',
          serviceId: appt.serviceId || null,
          serviceType,
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

        if (isForloeb && payload.serviceId) {
          const key = `${startIso}|${endIso}|${payload.serviceId}`;
          const existing = forloebGroups.get(key);
          if (existing) {
            existing.participants = mergeParticipants(existing.participants, payload.participants);
            if (!existing.notes && payload.notes) existing.notes = payload.notes;
            if (!existing.color && payload.color) existing.color = payload.color;
            continue;
          }
          forloebGroups.set(key, {
            ...payload,
            participants: mergeParticipants(payload.participants),
          });
        } else {
          normalPayloads.push(payload);
        }
      }

      // Create normal (non-forløb) appointments
      for (const payload of normalPayloads) {
        console.log('[BookingPage] Creating appointment document', payload);
        await addDoc(appointmentsCollection, payload);
      }

      // Upsert forløb appointments (merge participants when same time+forløb)
      for (const payload of forloebGroups.values()) {
        const q = query(
          appointmentsCollection,
          where('serviceId', '==', payload.serviceId),
          where('serviceType', '==', 'forloeb'),
          where('start', '==', payload.start),
          where('end', '==', payload.end),
          limit(5)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          console.log('[BookingPage] Creating forløb appointment document', payload);
          await addDoc(appointmentsCollection, payload);
          continue;
        }

        const primary = snap.docs[0];
        const primaryData = primary.data() || {};
        const mergedParticipants = mergeParticipants(
          primaryData.participants,
          payload.participants
        );

        await updateDoc(primary.ref, {
          title: payload.title,
          client: payload.client,
          clientId: payload.clientId,
          clientEmail: payload.clientEmail,
          clientPhone: payload.clientPhone,
          service: payload.service,
          serviceId: payload.serviceId,
          serviceType: 'forloeb',
          serviceDuration: payload.serviceDuration,
          servicePrice: payload.servicePrice,
          servicePriceInclVat: payload.servicePriceInclVat,
          participants: mergedParticipants,
          notes: payload.notes || primaryData.notes || '',
          color: payload.color || primaryData.color || null,
          start: payload.start,
          end: payload.end,
          startDate: payload.startDate,
          startTime: payload.startTime,
          endDate: payload.endDate,
          endTime: payload.endTime,
          status: primaryData.status || payload.status || 'booked',
          updatedAt: serverTimestamp(),
        });

        if (snap.docs.length > 1) {
          const batch = writeBatch(db);
          snap.docs.slice(1).forEach((d) => batch.delete(d.ref));
          await batch.commit();
          console.log('[BookingPage] Deduplicated forløb appointments:', snap.docs.length);
        }
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

      const title = appointment.client || appointment.service || appointmentFallback;
      const calendarOwner =
        appointment.calendarOwner ||
        (selectedTeamMembers.length === 1
          ? selectedTeamMembers[0]
          : teamMembers[0]?.name || null);
      const docRef = doc(db, 'users', user.uid, 'appointments', appointment.id);

      await updateDoc(docRef, {
        title,
        calendarOwner,
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
            t(
              'booking.calendar.confirmDeleteProgram',
              'Dette er en del af et forløb.\n\nOK: Slet hele klientens forløb.\nAnnuller: Slet kun denne dato.'
            )
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
    if (calendarAddMode) {
      setCalendarAddMode(false);
      resetCalendarAddState();
    }
    setEditingAppointment(null);
    setNextAppointmentTemplate(null);
    const { startDate } = parseAppointmentDateTimes(appointment);
    if (startDate) {
      setCurrentDate(startDate);
    }
    const matchedClient = resolveClientMatch(appointment);
    const resolvedClientId = matchedClient?.id || appointment.clientId || null;
    const fallbackClient =
      matchedClient ||
      (appointment.client || appointment.clientEmail || appointment.clientPhone
        ? {
            id: resolvedClientId,
            navn: appointment.client || t('booking.calendar.unknownClient', 'Ukendt klient'),
            email: appointment.clientEmail || '',
            telefon: appointment.clientPhone || '',
            status: t('booking.calendar.status.active', 'Aktiv'),
            adresse: '',
            by: '',
            postnummer: '',
            land: 'Danmark',
          }
        : null);
    setSelectedClientId(resolvedClientId);
    setSelectedClientFallback(fallbackClient);
    setSelectedAppointment(
      resolvedClientId ? { ...appointment, clientId: resolvedClientId } : appointment
    );
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
    if (selectedAppointment?.participants) {
      setJournalEntryParticipants(selectedAppointment.participants);
    } else {
      setJournalEntryParticipants([]);
    }
    if (selectedAppointment?.startDate) {
      setJournalEntryDate(selectedAppointment.startDate);
    } else {
      setJournalEntryDate('');
    }
    setShowJournalEntryForm(true);
  };

  const handleJournalEntrySaved = (entry) => {
    console.log('[BookingPage] journal entry saved', entry);
    setShowJournalEntryForm(false);
    setJournalEntryParticipants([]);
    setJournalEntryDate('');
  };

  const handleCloseJournalEntry = () => {
    setShowJournalEntryForm(false);
    setJournalEntryParticipants([]);
    setJournalEntryDate('');
  };

  const userIdentity = useMemo(() => {
    if (!user) {
      return {
        name: t('booking.calendar.notLoggedIn', 'Ikke logget ind'),
        email: t('booking.calendar.loginToContinue', 'Log ind for at fortsætte'),
        initials: '?',
        photoURL: null,
      };
    }

    const name =
      user.displayName ||
      user.email ||
      t('booking.topbar.defaultUser', 'Selma bruger');
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
          const labelDayName = dayNameFormatter.format(dateObj);
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
                const dayAppointments = visibleAppointments.filter((appointment) => {
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
                            title={(() => {
                              const names = participantNames(appointment);
                              return names.length ? names.join(', ') : '';
                            })()}
                            style={{
                              cursor: 'pointer',
                              ...(appointment.color ? getSoftColorStyle(appointment.color) : {}),
                            }}
                          >
                            {getServiceLabel(appointment)}{' '}
                            {(() => {
                              const names = participantNames(appointment);
                              if (names.length > 1) {
                                return renderNamesPreview(names);
                              }
                              return appointment.client
                                ? `– ${appointment.client.split(' ')[0]}`
                                : `– ${appointmentFallback}`;
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
    const dayColumnWidth = currentView === 'day' ? 420 : 160;
    const gridStyle = {
      '--days-count': daysToRender.length,
      '--hour-height': `${hourHeight}px`,
      '--visible-hours': VISIBLE_HOURS,
      '--time-grid-height': `${VISIBLE_HOURS * hourHeight}px`,
      minWidth: `${80 + daysToRender.length * dayColumnWidth}px`,
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
            const labelDayName = dayNameFormatter.format(day);
            return (
              <button
                key={formatDateKey(day)}
                type="button"
                className={`time-grid-day-header ${isHighlighted ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                onClick={() => handleSelectDayFromWeek(day)}
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
              const ownerName = selectedTeamMembers[0] || primaryCalendarOwner;
              const isHoverMatch =
                calendarAddMode &&
                hoverSlot &&
                hoverSlot.dayKey === dayKey &&
                hoverSlot.ownerName === ownerName;
              const isPreviewMatch =
                calendarAddMode &&
                selectedSlot &&
                selectedService &&
                selectedSlot.dayKey === dayKey &&
                selectedSlot.ownerName === ownerName;
              const previewStyle = isPreviewMatch
                ? getEventPosition(
                    selectedSlot.startDate,
                    selectedSlot.endDate || selectedSlot.startDate
                  )
                : null;

              return (
                <div
                  key={dayKey}
                  className={`time-grid-day ${isHighlighted ? 'is-highlighted' : ''} ${isToday ? 'is-today' : ''}`}
                >
                  <div
                    className="time-grid-day-body"
                    style={{ height: `${VISIBLE_HOURS * hourHeight}px` }}
                    onMouseMove={
                      calendarAddMode
                        ? (event) => handleSlotHover(event, day, ownerName)
                        : undefined
                    }
                    onMouseLeave={calendarAddMode ? handleSlotLeave : undefined}
                    onClick={
                      calendarAddMode
                        ? (event) => handleSlotClick(event, day, ownerName)
                        : undefined
                    }
                  >
                    {showNowLine && (
                      <div className="time-indicator-line" style={{ top: `${nowTopPercent}%` }} />
                    )}
                    {isHoverMatch && (
                      <div
                        className="calendar-add-hover-label"
                        style={{ top: `${hoverSlot.topPercent}%` }}
                      >
                        {hoverSlot.label}
                      </div>
                    )}
                    {isPreviewMatch && previewStyle && (
                      <div
                        className="time-grid-event time-grid-event-preview"
                        style={{
                          ...previewStyle,
                          ...(selectedService?.color
                            ? getSoftColorStyle(selectedService.color)
                            : {}),
                        }}
                      >
                        <div className="time-grid-event-inner">
                          <span className="time-grid-event-time">
                            {selectedSlot.label}
                          </span>
                          <span className="time-grid-event-title">
                            {selectedService?.navn || appointmentFallback}
                          </span>
                        </div>
                      </div>
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
                              title={uniqNames.length ? uniqNames.join(', ') : ''}
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
                                    {uniqNames.slice(0, 2).map((n) => (
                                      <div key={n} className="time-grid-event-name">
                                        {n}
                                      </div>
                                    ))}
                                    {uniqNames.length > 2 && (
                                      <div className="time-grid-event-more">
                                        +{uniqNames.length - 2}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="time-grid-event-title">
                                    {first.client || first.title || appointmentFallback}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div
                            className={`time-grid-event service-type-${group.type} ${
                              isDragged ? 'is-dragging' : ''
                            }`}
                            title={uniqNames.length ? uniqNames.join(', ') : ''}
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
                                  {uniqNames.slice(0, 2).map((n) => (
                                    <div key={n} className="time-grid-event-name">
                                      {n}
                                    </div>
                                  ))}
                                  {uniqNames.length > 2 && (
                                    <div className="time-grid-event-more">
                                      +{uniqNames.length - 2}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="time-grid-event-title">
                                  {first.client || first.title || appointmentFallback}
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

  const getMemberMeta = (name) => {
    const match = teamMembers.find((member) => member.name === name);
    if (match) return match;
    return { id: name, name, avatarText: name?.charAt(0) || '?', avatarColor: '#0ea5e9' };
  };

  const renderTeamEvents = ({ memberName, dayKey, dayDate, nowTopPercent, showNowLine }) => {
    const dayEvents = (appointmentsByDay[dayKey] || [])
      .filter((appointment) => getAppointmentOwner(appointment) === memberName)
      .slice()
      .sort(
        (a, b) => (a.startDateObj?.getTime?.() || 0) - (b.startDateObj?.getTime?.() || 0)
      );

    const groupedEvents = groupDayEvents(dayEvents);
    const isHoverMatch =
      calendarAddMode &&
      hoverSlot &&
      hoverSlot.dayKey === dayKey &&
      hoverSlot.ownerName === memberName;
    const isPreviewMatch =
      calendarAddMode &&
      selectedSlot &&
      selectedService &&
      selectedSlot.dayKey === dayKey &&
      selectedSlot.ownerName === memberName;
    const previewStyle = isPreviewMatch
      ? getEventPosition(
          selectedSlot.startDate,
          selectedSlot.endDate || selectedSlot.startDate
        )
      : null;

    return (
      <div
        className="time-grid-day-body"
        style={{ height: `${VISIBLE_HOURS * HOUR_HEIGHT}px` }}
        onMouseMove={
          calendarAddMode
            ? (event) => handleSlotHover(event, dayDate, memberName)
            : undefined
        }
        onMouseLeave={calendarAddMode ? handleSlotLeave : undefined}
        onClick={
          calendarAddMode
            ? (event) => handleSlotClick(event, dayDate, memberName)
            : undefined
        }
      >
        {showNowLine && nowTopPercent !== null && (
          <div className="time-indicator-line" style={{ top: `${nowTopPercent}%` }} />
        )}
        {isHoverMatch && (
          <div
            className="calendar-add-hover-label"
            style={{ top: `${hoverSlot.topPercent}%` }}
          >
            {hoverSlot.label}
          </div>
        )}
        {isPreviewMatch && previewStyle && (
          <div
            className="time-grid-event time-grid-event-preview"
            style={{
              ...previewStyle,
              ...(selectedService?.color ? getSoftColorStyle(selectedService.color) : {}),
            }}
          >
            <div className="time-grid-event-inner">
              <span className="time-grid-event-time">{selectedSlot.label}</span>
              <span className="time-grid-event-title">
                {selectedService?.navn || appointmentFallback}
              </span>
            </div>
          </div>
        )}
        {groupedEvents.map((group, idx) => {
          const first = group.events[0];
          const allNames = group.events.flatMap(participantNames).filter(Boolean);
          const uniqNames = Array.from(new Set(allNames));
          const style = group.start ? getEventPosition(group.start, group.end || group.start) : {};
          return (
            <div
              key={`${dayKey}-${memberName}-${idx}`}
              className={`time-grid-event service-type-${group.type}`}
              title={uniqNames.length ? uniqNames.join(', ') : ''}
              style={{
                ...style,
                ...(first.color ? getSoftColorStyle(first.color) : {}),
              }}
              onClick={() => handleAppointmentClick(first)}
            >
              <div className="time-grid-event-inner">
                <span className="time-grid-event-time">{getServiceLabel(first)}</span>
                {uniqNames.length > 1 ? (
                  <div className="time-grid-event-names">
                    {uniqNames.slice(0, 2).map((n) => (
                      <div key={n} className="time-grid-event-name">
                        {n}
                      </div>
                    ))}
                    {uniqNames.length > 2 && (
                      <div className="time-grid-event-more">+{uniqNames.length - 2}</div>
                    )}
                  </div>
                ) : (
                  <span className="time-grid-event-title">
                    {first.client || first.title || appointmentFallback}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTeamDayGrid = () => {
    const membersToShow = selectedTeamMembers.map(getMemberMeta);
    const gridStyle = {
      '--members-count': membersToShow.length,
      '--hour-height': `${hourHeight}px`,
      '--visible-hours': VISIBLE_HOURS,
      '--time-grid-height': `${VISIBLE_HOURS * hourHeight}px`,
      minWidth: `${80 + membersToShow.length * 260}px`,
    };

    const nowMinutes = getMinutesFromMidnight(now);
    const nowTopPercent =
      nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60
        ? ((nowMinutes - START_HOUR * 60) / TOTAL_MINUTES) * 100
        : null;
    const isToday = isSameDate(currentDate, now);

    return (
      <div className="team-time-grid team-day-view" style={gridStyle}>
        <div className="team-time-grid-header">
          <div className="team-hours-spacer"></div>
          {membersToShow.map((member) => (
            <div key={member.name} className="team-member-header">
              <span
                className="team-calendar-avatar"
                style={{ backgroundColor: member.avatarColor || '#0ea5e9' }}
              >
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt={member.name} />
                ) : (
                  member.avatarText || member.name?.charAt(0)
                )}
              </span>
              <span className="team-member-name">{member.name}</span>
            </div>
          ))}
        </div>
        <div className="team-time-grid-body">
          <div className="time-grid-hours" style={{ height: `${VISIBLE_HOURS * hourHeight}px` }}>
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
          <div className="team-member-columns">
            {membersToShow.map((member) => {
              const dayKey = formatDateKey(currentDate);
              return (
                <div key={member.name} className="team-member-day">
                  {renderTeamEvents({
                    memberName: member.name,
                    dayKey,
                    dayDate: currentDate,
                    nowTopPercent,
                    showNowLine: isToday,
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderTeamWeekGrid = () => {
    const membersToShow = selectedTeamMembers.map(getMemberMeta);
    const daysToRender = weekDays;
    const gridStyle = {
      '--members-count': membersToShow.length,
      '--days-count': daysToRender.length,
      '--hour-height': `${hourHeight}px`,
      '--visible-hours': VISIBLE_HOURS,
      '--time-grid-height': `${VISIBLE_HOURS * hourHeight}px`,
      minWidth: `${110 + daysToRender.length * 150}px`,
    };

    const nowMinutes = getMinutesFromMidnight(now);
    const nowTopPercent =
      nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60
        ? ((nowMinutes - START_HOUR * 60) / TOTAL_MINUTES) * 100
        : null;

    return (
      <div className="team-week-grid" style={gridStyle}>
        <div className="team-week-header">
          <div className="team-week-member-spacer"></div>
          {daysToRender.map((day) => {
            const isHighlighted = isSameDate(day, currentDate);
            const isToday = isSameDate(day, now);
            const labelDayName = dayNameFormatter.format(day);
            return (
              <button
                key={formatDateKey(day)}
                type="button"
                className={`time-grid-day-header ${isHighlighted ? 'is-selected' : ''} ${
                  isToday ? 'is-today' : ''
                }`}
                onClick={() => handleSelectDayFromWeek(day)}
              >
                <span className="day-name">{labelDayName}</span>
                <span className="day-date">
                  {day.getDate()}/{day.getMonth() + 1}
                </span>
              </button>
            );
          })}
        </div>

        <div className="team-week-body">
          {membersToShow.map((member) => (
            <div key={member.name} className="team-week-row">
              <div className="team-week-member-cell">
                <span
                  className="team-calendar-avatar"
                  style={{ backgroundColor: member.avatarColor || '#0ea5e9' }}
                >
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.name} />
                  ) : (
                    member.avatarText || member.name?.charAt(0)
                  )}
                </span>
                <span className="team-week-member-name">{member.name}</span>
              </div>
              {daysToRender.map((day) => {
                const dayKey = formatDateKey(day);
                const isToday = isSameDate(day, now);
                return (
                  <div key={`${member.name}-${dayKey}`} className="team-week-day">
                    {renderTeamEvents({
                      memberName: member.name,
                      dayKey,
                      dayDate: day,
                      nowTopPercent,
                      showNowLine: isToday,
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTeamTimeGrid = () => {
    if (currentView === 'week') return renderTeamWeekGrid();
    return renderTeamDayGrid();
  };

  const slotDateLabel = selectedSlot
    ? slotDayFormatter.format(selectedSlot.startDate)
    : '';
  const slotTimeLabel = selectedSlot ? formatTime(selectedSlot.startDate) : '';
  const slotEndTimeLabel = selectedSlot?.endDate
    ? formatTime(selectedSlot.endDate)
    : '';
  const selectedServiceLabel = selectedService?.navn || appointmentFallback;
  const selectedServiceDuration =
    selectedService?.varighed || selectedSlot?.serviceDuration || '';
  const selectedServiceDurationLabel =
    formatServiceDuration(selectedServiceDuration, t) || selectedServiceDuration;
  const selectedServicePrice =
    typeof selectedService?.pris === 'number' ? selectedService.pris : null;
  const slotOwnerLabel = selectedSlot?.ownerName || ownerEntry.name;
  const additionalServicesTotal = additionalServices.reduce((sum, service) => {
    const price = typeof service?.pris === 'number' ? service.pris : 0;
    return sum + price;
  }, 0);
  const totalServicePrice =
    (typeof selectedServicePrice === 'number' ? selectedServicePrice : 0) +
    additionalServicesTotal;
  const hasServicePrice =
    typeof selectedServicePrice === 'number' || additionalServicesTotal > 0;
  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        {calendarAddMode && (
          <div className="calendar-add-banner">
            <div className="calendar-add-banner-title">
              {t('booking.calendar.addMode.title', 'Vælg en tid, der skal bookes')}
            </div>
            <div className="calendar-add-banner-actions">
              <button
                type="button"
                className="calendar-add-banner-btn calendar-add-banner-btn-ghost"
              >
                {t('booking.calendar.addMode.available', 'Se tilgængelige tidspunkter')}
              </button>
              <button
                type="button"
                className="calendar-add-banner-btn"
                onClick={handleCloseCalendarAddMode}
              >
                <X className="calendar-add-banner-icon" />
                {t('booking.calendar.addMode.close', 'Luk')}
              </button>
            </div>
          </div>
        )}
        {/* Top Navigation Bar */}
        <div className="booking-topbar booking-topbar-calendar">
          <div className="calendar-toolbar">
            <div className="calendar-toolbar-group">
              <button type="button" className="toolbar-pill" onClick={goToToday}>
                {t('booking.calendar.today', 'I dag')}
              </button>
              <div className="toolbar-pill toolbar-segment">
                <button
                  type="button"
                  className="toolbar-segment-btn"
                  onClick={() => navigateByView(-1)}
                  aria-label={t('booking.calendar.previous', 'Forrige')}
                >
                  <ChevronLeft className="toolbar-icon" />
                </button>
                <span className="toolbar-date-label">{toolbarDateLabel}</span>
                <button
                  type="button"
                  className="toolbar-segment-btn"
                  onClick={() => navigateByView(1)}
                  aria-label={t('booking.calendar.next', 'Næste')}
                >
                  <ChevronRight className="toolbar-icon" />
                </button>
              </div>
              {hasTeamAccess ? (
                <div className="team-filter-wrapper" ref={teamMenuRef}>
                  <button
                    type="button"
                    className="team-filter-trigger"
                    onClick={() => setTeamMenuOpen((open) => !open)}
                  >
                    <span className="team-filter-label">{selectedLabel}</span>
                    <ChevronDown className={`team-filter-caret ${teamMenuOpen ? 'open' : ''}`} />
                  </button>
                  {teamMenuOpen && (
                    <div className="team-filter-menu">
                      <button
                        type="button"
                        className={`team-filter-option ${teamFilter === 'all' ? 'active' : ''}`}
                        onClick={selectAllMembers}
                      >
                        👥 {entireTeamLabel}
                      </button>

                      <div className="team-filter-section">
                        <div className="team-filter-item">
                          <span
                            className="avatar avatar-small"
                            style={{ backgroundColor: ownerEntry.avatarColor || '#0ea5e9' }}
                          >
                            {ownerEntry.avatarUrl ? (
                              <img src={ownerEntry.avatarUrl} alt={ownerEntry.name} />
                            ) : (
                              ownerEntry.avatarText || ownerEntry.name?.charAt(0)
                            )}
                          </span>
                          <span>
                            {ownerEntry.name}{' '}
                            ({t('booking.calendar.you', 'Dig')})
                          </span>
                        </div>
                      </div>

                      <hr className="team-filter-divider" />

                      <div className="team-filter-section header">
                        <span className="section-title">
                          {t('booking.calendar.members', 'Medarbejdere')}
                        </span>
                        <button type="button" className="clear-link" onClick={clearMembers}>
                          {t('booking.calendar.clearAll', 'Ryd alle')}
                        </button>
                      </div>

                      <div className="team-filter-list">
                        {teamMembers.map((member) => {
                          const checked = selectedTeamMembers.includes(member.name);
                          return (
                            <button
                              key={member.id}
                              type="button"
                              className={`team-filter-member ${checked ? 'selected' : ''}`}
                              onClick={() => toggleMember(member.name)}
                            >
                              <span className="checkmark">{checked ? '✔' : ''}</span>
                              <span
                                className="avatar avatar-small"
                                style={{ backgroundColor: member.avatarColor || '#0ea5e9' }}
                              >
                                {member.avatarUrl ? (
                                  <img src={member.avatarUrl} alt={member.name} />
                                ) : (
                                  member.avatarText || member.name?.charAt(0)
                                )}
                              </span>
                              <span>{member.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="toolbar-pill toolbar-static">{selectedLabel}</div>
              )}
              <button
                type="button"
                className="toolbar-icon-btn"
                aria-label={t('booking.calendar.filters', 'Filtre')}
              >
                <SlidersHorizontal className="toolbar-icon" />
              </button>
              <button
                type="button"
                className="toolbar-icon-btn"
                aria-label={t('booking.calendar.freeze', 'Frys')}
              >
                <Snowflake className="toolbar-icon" />
              </button>
            </div>
            <div className="calendar-toolbar-group">
              <button
                type="button"
                className="toolbar-icon-btn"
                aria-label={t('booking.calendar.settings', 'Indstillinger')}
                onClick={() => navigate('/booking/settings')}
              >
                <Settings className="toolbar-icon" />
              </button>
              <button
                type="button"
                className="toolbar-icon-btn"
                aria-label={t('booking.calendar.refresh', 'Opdater')}
                onClick={handleRefresh}
              >
                <RefreshCw className="toolbar-icon" />
              </button>
              <div
                className="toolbar-view-toggle"
                role="group"
                aria-label={t('booking.calendar.viewLabel', 'Kalendervisning')}
              >
                <button
                  type="button"
                  className={`view-toggle-btn ${currentView === 'month' ? 'active' : ''}`}
                  onClick={() => setCurrentView('month')}
                >
                  {t('booking.calendar.view.month', 'Måned')}
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${currentView === 'week' ? 'active' : ''}`}
                  onClick={() => setCurrentView('week')}
                >
                  {t('booking.calendar.view.week', 'Uge')}
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${currentView === 'day' ? 'active' : ''}`}
                  onClick={() => setCurrentView('day')}
                >
                  {t('booking.calendar.view.day', 'Dag')}
                </button>
              </div>
              {!selectedAppointment && (
                <Dropdown
                  label={t('booking.calendar.add', 'Tilføj')}
                  onManual={handleOpenAppointmentForm}
                  onCalendar={handleStartCalendarAddMode}
                />
              )}
            </div>
          </div>
        </div>

        <div
          className={`booking-content ${
            showJournalEntryForm
              ? 'with-journal-entry'
              : showAppointmentForm || derivedSelectedClient
              ? 'with-appointment-form'
              : ''
          } ${
            calendarAddMode && selectedSlot && !showAppointmentForm && !derivedSelectedClient
              ? 'with-calendar-add'
              : ''
          }`}
        >
          {showJournalEntryForm ? (
            <div className="booking-main booking-main-full">
              <Indlæg
                clientId={journalEntryClient?.id}
                clientName={journalEntryClient?.navn}
                onClose={handleCloseJournalEntry}
                onSave={handleJournalEntrySaved}
                participants={journalEntryParticipants}
                initialDate={journalEntryDate}
              />
            </div>
          ) : (
            <>
              {/* Main Calendar Area */}
              <div className="booking-main">
                <div className={`calendar-container ${isMultiTeam ? 'calendar-compact' : ''}`}>
                  {currentView === 'month'
                    ? renderMonthView()
                    : isMultiTeam
                      ? renderTeamTimeGrid()
                      : renderTimeGrid()}
                </div>
              </div>

              {calendarAddMode && selectedSlot && !showAppointmentForm && !derivedSelectedClient && (
                <aside className="calendar-add-sidebar">
                  <div className="calendar-add-sidebar-header">
                    <button
                      type="button"
                      className="calendar-add-sidebar-close"
                      onClick={resetCalendarAddState}
                      aria-label={t('booking.calendar.addMode.closePanel', 'Luk')}
                    >
                      <X />
                    </button>
                  </div>
                  <div className="calendar-add-sidebar-content">
                    <div className="calendar-add-customer">
                      <button
                        type="button"
                        className="calendar-add-customer-btn"
                        onClick={() => setClientPickerOpen((open) => !open)}
                      >
                        <span className="calendar-add-customer-icon">
                          <UserPlus />
                        </span>
                        <span className="calendar-add-customer-text">
                          <span className="calendar-add-customer-title">
                            {t('booking.calendar.addCustomer', 'Tilføj kunde')}
                          </span>
                          <span className="calendar-add-customer-note">
                            {t(
                              'booking.calendar.addCustomerNote',
                              'Efterlad feltet tomt til drop-in'
                            )}
                          </span>
                        </span>
                      </button>
                      {selectedClient && (
                        <div className="calendar-add-customer-card">
                          <div className="calendar-add-customer-name">
                            {selectedClient.navn}
                          </div>
                          <div className="calendar-add-customer-meta">
                            {selectedClient.email || selectedClient.telefon || '—'}
                          </div>
                        </div>
                      )}
                      {clientPickerOpen && (
                        <div className="calendar-add-client-picker">
                          <div className="calendar-add-client-title">
                            {t('booking.calendar.selectClient', 'Vælg en kunde')}
                          </div>
                          <div className="calendar-add-client-search">
                            <Search className="calendar-add-client-search-icon" />
                            <input
                              type="text"
                              value={clientQuery}
                              onChange={(event) => setClientQuery(event.target.value)}
                              placeholder={t(
                                'booking.calendar.searchClients',
                                'Søg efter kunde'
                              )}
                            />
                          </div>
                          <div className="calendar-add-client-list">
                            <button
                              type="button"
                              className="calendar-add-client-item calendar-add-client-create"
                              onClick={handleOpenClientCreate}
                            >
                              <span className="calendar-add-client-create-icon">+</span>
                              <span className="calendar-add-client-create-text">
                                <span className="calendar-add-client-name">
                                  {t('booking.calendar.addNewClient', 'Tilføj ny kunde')}
                                </span>
                                <span className="calendar-add-client-meta">
                                  {t('booking.calendar.createNewClient', 'Opret en ny kunde')}
                                </span>
                              </span>
                            </button>
                            {clientsLoading && (
                              <div className="calendar-add-muted">
                                {t('booking.calendar.clients.loading', 'Indlæser kunder...')}
                              </div>
                            )}
                            {clientsError && (
                              <div className="calendar-add-error">{clientsError}</div>
                            )}
                            {!clientsLoading && !clientsError && filteredClients.length === 0 && (
                              <div className="calendar-add-muted">
                                {t('booking.calendar.clients.empty', 'Ingen kunder fundet')}
                              </div>
                            )}
                            {filteredClients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                className="calendar-add-client-item"
                                onClick={() => handleSelectClient(client)}
                              >
                                <span className="calendar-add-client-name">{client.navn}</span>
                                <span className="calendar-add-client-meta">
                                  {client.email || client.telefon || '—'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {calendarStep === 'services' ? (
                      <div className="calendar-add-services">
                        <div className="calendar-add-services-header">
                          <h3>{t('booking.calendar.services.title', 'Vælg en tjeneste')}</h3>
                        </div>
                        <div className="calendar-add-search">
                          <Search className="calendar-add-search-icon" />
                          <input
                            type="text"
                            value={serviceQuery}
                            onChange={(event) => setServiceQuery(event.target.value)}
                            placeholder={t(
                              'booking.calendar.services.search',
                              'Søg efter tjenestenavn'
                            )}
                          />
                        </div>
                        {servicesLoading && (
                          <div className="calendar-add-muted">
                            {t('booking.calendar.services.loading', 'Indlæser ydelser...')}
                          </div>
                        )}
                        {servicesError && (
                          <div className="calendar-add-error">{servicesError}</div>
                        )}
                        {!servicesLoading &&
                          !servicesError &&
                          groupedServices.map((group) => (
                            <div key={group.name} className="calendar-add-service-group">
                              <div className="calendar-add-service-group-header">
                                <span>{group.name}</span>
                                <span className="calendar-add-service-count">
                                  {group.items.length}
                                </span>
                              </div>
                              <div className="calendar-add-service-list">
                                {group.items.map((service) => (
                                  <button
                                    key={service.id}
                                    type="button"
                                    className="calendar-add-service-card"
                                    onClick={() => handleSelectService(service)}
                                  >
                                    <span className="calendar-add-service-info">
                                      <span className="calendar-add-service-name">
                                        {service.navn}
                                      </span>
                                      <span className="calendar-add-service-meta">
                                        {formatServiceDuration(service.varighed, t) ||
                                          service.varighed}
                                      </span>
                                    </span>
                                    <span className="calendar-add-service-price">
                                      {formatCurrency(service.pris)} kr.
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="calendar-add-confirm">
                        <div className="calendar-add-confirm-header">
                          <div className="calendar-add-confirm-day">{slotDateLabel}</div>
                          <div className="calendar-add-confirm-time">
                            {slotTimeLabel} •{' '}
                            {t('booking.calendar.addMode.repeat', 'Gentages ikke')}
                          </div>
                        </div>
                        <div className="calendar-add-confirm-section">
                          <div className="calendar-add-confirm-title">
                            {t('booking.calendar.services.section', 'Tjenester')}
                          </div>
                          <div className="calendar-add-selected-service">
                            <span className="calendar-add-service-indicator" />
                            <div className="calendar-add-selected-info">
                              <div className="calendar-add-selected-name">
                                {selectedServiceLabel}
                              </div>
                              <div className="calendar-add-selected-meta">
                                {slotTimeLabel}
                                {slotEndTimeLabel ? ` - ${slotEndTimeLabel}` : ''} •{' '}
                                {selectedServiceDurationLabel} • {slotOwnerLabel}
                              </div>
                            </div>
                            <div className="calendar-add-selected-price">
                              {selectedServicePrice !== null
                                ? `${formatCurrency(selectedServicePrice)} kr.`
                                : '—'}
                            </div>
                          </div>
                          {additionalServices.map((service) => (
                            <div
                              key={service.id}
                              className="calendar-add-selected-service calendar-add-selected-service-extra"
                            >
                              <span className="calendar-add-service-indicator" />
                              <div className="calendar-add-selected-info">
                                <div className="calendar-add-selected-name">
                                  {service.navn}
                                </div>
                                <div className="calendar-add-selected-meta">
                                  {formatServiceDuration(service.varighed, t) ||
                                    service.varighed ||
                                    '—'}{' '}
                                  • {slotOwnerLabel}
                                </div>
                              </div>
                              <div className="calendar-add-selected-price">
                                {typeof service.pris === 'number'
                                  ? `${formatCurrency(service.pris)} kr.`
                                  : '—'}
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="calendar-add-secondary-btn"
                            onClick={handleAddAnotherService}
                          >
                            <Plus className="calendar-add-secondary-icon" />
                            {t('booking.calendar.addService', 'Tilføj tjeneste')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {calendarStep === 'confirm' && (
                    <div className="calendar-add-sidebar-footer">
                      <div className="calendar-add-total">
                        <span>{t('booking.calendar.total', 'I alt')}</span>
                        <span>
                          {hasServicePrice
                            ? `${formatCurrency(totalServicePrice)} kr.`
                            : '—'}
                        </span>
                      </div>
                      <div className="calendar-add-footer-actions">
                        <button type="button" className="calendar-add-secondary-btn">
                          {t('booking.calendar.payment', 'Betaling')}
                        </button>
                        <button
                          type="button"
                          className="calendar-add-primary-btn"
                          onClick={handleSaveCalendarAppointment}
                          disabled={!selectedService}
                        >
                          {t('booking.calendar.save', 'Gem')}
                        </button>
                      </div>
                    </div>
                  )}
                </aside>
              )}

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
                    teamMembers={teamMembers}
                    hasTeamAccess={hasTeamAccess}
                    defaultOwnerName={ownerEntry.name}
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

        {showClientCreate && (
          <AddKlient
            isOpen={showClientCreate}
            onClose={() => setShowClientCreate(false)}
            onSave={handleClientCreated}
            mode="create"
          />
        )}
      </div>
    </BookingSidebarLayout>
  );
}

export default BookingPage;
