import React, { useMemo, useState } from 'react';
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
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
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
  const derivedSelectedClient = useMemo(() => {
    if (selectedClientId) {
      const match = clients.find((client) => client.id === selectedClientId);
      if (match) {
        return match;
      }
    }
    return selectedClientFallback;
  }, [clients, selectedClientId, selectedClientFallback]);


  const monthNames = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december'
  ];

  const dayNames = ['MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR', 'SØN'];

  const isSameDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const toDate = (dayObj) => new Date(dayObj.year, dayObj.month, dayObj.day);

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
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

  const calendarWeeks = getCalendarWeeks();
  let displayedWeeks = calendarWeeks;

  if (viewMode === 'week') {
    const weekForCurrent = calendarWeeks.find((week) =>
      week.some((day) => isSameDate(toDate(day), currentDate))
    );
    displayedWeeks = weekForCurrent ? [weekForCurrent] : [];
  }

  if (viewMode === 'day') {
    const allDays = calendarWeeks.flat();
    const dayForCurrent = allDays.find((day) =>
      isSameDate(toDate(day), currentDate)
    );
    displayedWeeks = dayForCurrent ? [[dayForCurrent]] : [];
  }

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
            <button className="nav-arrow" onClick={() => navigateMonth(-1)}>←</button>
            <button className="nav-today" onClick={goToToday}>i dag</button>
            <button className="nav-arrow" onClick={() => navigateMonth(1)}>→</button>
          </div>
          <div className="topbar-view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Måned
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Uge
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'day' ? 'active' : ''}`}
              onClick={() => setViewMode('day')}
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
              <div className="calendar-header">
                <div className="week-number-header"></div>
                {(displayedWeeks[0] || []).map((day, index) => {
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
                {displayedWeeks.map((week, weekIndex) => {
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
