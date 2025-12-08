import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './bookingpage.css';
import AppointmentForm from './appointment/appointment';
import Journal from './Journal/journal';
import Indlæg from './Journal/indlæg/indlæg';
import { useAuth } from '../../AuthContext';
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  const [activeNav, setActiveNav] = useState('kalender');
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [nextAppointmentTemplate, setNextAppointmentTemplate] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClientFallback, setSelectedClientFallback] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showJournalEntryForm, setShowJournalEntryForm] = useState(false);
  const [journalEntryClient, setJournalEntryClient] = useState(null);
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

    try {
      const startIso = combineDateAndTimeToIso(appointment.startDate, appointment.startTime);
      const endIso = combineDateAndTimeToIso(appointment.endDate, appointment.endTime);

      if (!startIso || !endIso) {
        throw new Error('Invalid start or end time');
      }

      const title = appointment.client || appointment.service || 'Aftale';

      const payload = {
        therapistId: user.uid,
        title,
        client: appointment.client || title,
        clientId: appointment.clientId || null,
        clientEmail: appointment.clientEmail || '',
        clientPhone: appointment.clientPhone || '',
        service: appointment.service || '',
        serviceId: appointment.serviceId || null,
        serviceDuration: appointment.serviceDuration || '',
        servicePrice:
          typeof appointment.servicePrice === 'number' ? appointment.servicePrice : null,
        servicePriceInclVat:
          typeof appointment.servicePriceInclVat === 'number'
            ? appointment.servicePriceInclVat
            : null,
        notes: appointment.notes || '',
        start: startIso,
        end: endIso,
        startDate: appointment.startDate,
        startTime: appointment.startTime,
        endDate: appointment.endDate,
        endTime: appointment.endTime,
        status: 'booked',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const appointmentsCollection = collection(db, 'users', user.uid, 'appointments');
      console.log('[BookingPage] Creating appointment document', payload);
      await addDoc(appointmentsCollection, payload);
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
        serviceDuration: appointment.serviceDuration || '',
        servicePrice:
          typeof appointment.servicePrice === 'number' ? appointment.servicePrice : null,
        servicePriceInclVat:
          typeof appointment.servicePriceInclVat === 'number'
            ? appointment.servicePriceInclVat
            : null,
        notes: appointment.notes || '',
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
      const ref = doc(db, 'users', user.uid, 'appointments', appointment.id);
      await deleteDoc(ref);
      console.log('[BookingPage] Deleted appointment', appointment.id);
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
                            className="day-appointment-chip"
                            onClick={() => handleAppointmentClick(appointment)}
                            style={{ cursor: 'pointer' }}
                          >
                            {appointment.startTime} {appointment.client ? `– ${appointment.client.split(' ')[0]}` : '– Aftale'}
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

    return (
      <div className="time-grid" style={gridStyle}>
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
          <div className="time-grid-days">
            {daysToRender.map((day) => {
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
                    {dayEvents.map((appointmentItem) => {
                      const { startDateObj, endDateObj, id } = appointmentItem;
                      const style = startDateObj
                        ? getEventPosition(startDateObj, endDateObj || startDateObj)
                        : {};
                      return (
                        <div
                          key={id}
                          className="time-grid-event"
                          style={style}
                          onClick={() => handleAppointmentClick(appointmentItem)}
                        >
                          <span className="time-grid-event-time">
                            {appointmentItem.startTime || formatTime(startDateObj)}
                            {appointmentItem.endTime || endDateObj
                              ? ` – ${appointmentItem.endTime || formatTime(endDateObj)}`
                              : ''}
                          </span>
                          <span className="time-grid-event-title">
                            {appointmentItem.client || appointmentItem.title || 'Aftale'}
                          </span>
                        </div>
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
        {/* Left Sidebar */}
        <div className="booking-sidebar">
          <div className="sidebar-search">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Søg" className="search-input" />
          </div>

          <div className="sidebar-notifications">
            <span className="bell-icon">🔔</span>
            <span>Notifikationer</span>
          </div>

          <div className="sidebar-section">
            <div className="section-label">KLINIK</div>
            <nav className="sidebar-nav">
              <button 
                className={`nav-item ${activeNav === 'kalender' ? 'active' : ''}`}
                onClick={() => setActiveNav('kalender')}
              >
                <span className="nav-icon calendar-icon">📅</span>
                <span className="nav-text">Kalender</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'klienter' ? 'active' : ''}`}
                onClick={() => navigate('/booking/klienter')}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">Klienter</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'ydelser' ? 'active' : ''}`}
                onClick={() => navigate('/booking/ydelser')}
              >
                <span className="nav-icon">🏷️</span>
                <span className="nav-text">Ydelser</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'fakturaer' ? 'active' : ''}`}
                onClick={() => setActiveNav('fakturaer')}
              >
                <span className="nav-icon">📄</span>
                <span className="nav-text">Fakturaer</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'statistik' ? 'active' : ''}`}
                onClick={() => setActiveNav('statistik')}
              >
                <span className="nav-icon">📊</span>
                <span className="nav-text">Statistik</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'indstillinger' ? 'active' : ''}`}
                onClick={() => setActiveNav('indstillinger')}
              >
                <span className="nav-icon">⚙️</span>
                <span className="nav-text">Indstillinger</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'apps' ? 'active' : ''}`}
                onClick={() => setActiveNav('apps')}
              >
                <span className="nav-icon">📱</span>
                <span className="nav-text">Apps</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
            </nav>
          </div>

          {/* Clinic Section */}
          <button
            type="button"
            className="sidebar-clinic"
            onClick={() => navigate('/booking/settings')}
          >
            {userIdentity.photoURL ? (
              <img
                src={userIdentity.photoURL}
                alt={userIdentity.name}
                className="clinic-avatar"
              />
            ) : (
              <div className="clinic-avatar clinic-avatar-placeholder">
                {userIdentity.initials}
              </div>
            )}
            <div className="clinic-user-details">
              <div className="clinic-user-name">{userIdentity.name}</div>
              <div className="clinic-user-email">{userIdentity.email}</div>
            </div>
          </button>
        </div>

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
  );
}

export default BookingPage;
