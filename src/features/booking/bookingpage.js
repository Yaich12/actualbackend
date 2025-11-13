import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './bookingpage.css';

function BookingPage() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date(2027, 4, 1)); // May 2027
  const [viewMode, setViewMode] = useState('month');
  const [activeNav, setActiveNav] = useState('kalender');

  const monthNames = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december'
  ];

  const dayNames = ['SØN', 'MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

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

  const getWeekRange = () => {
    // Show the week that includes the transition from April to May
    // Starting from Monday April 26 to Sunday May 2
    const startDate = new Date(2027, 3, 26); // April 26, 2027 (month is 0-indexed)
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const weekDays = getWeekRange();
  const calendarDays = getDaysInMonth(currentDate);

  return (
    <div className="booking-page">
      {/* Top Navigation Bar */}
      <div className="booking-topbar">
        <div className="topbar-left">
          <button className="topbar-logo-btn" onClick={() => navigate('/')}>
            Forside
          </button>
        </div>
        <div className="topbar-center">
          <button className={`topbar-tab ${viewMode === 'calendars' ? 'active' : ''}`}>
            Kalendere
          </button>
          <button className={`topbar-tab ${viewMode === 'month' ? 'active' : ''}`}>
            måned
          </button>
          <div className="topbar-navigation">
            <button className="nav-arrow" onClick={() => navigateMonth(-1)}>←</button>
            <button className="nav-today" onClick={goToToday}>i dag</button>
            <button className="nav-arrow" onClick={() => navigateMonth(1)}>→</button>
          </div>
          <span className="current-month">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
        </div>
        <div className="topbar-right">
          <button className="create-appointment-btn">
            <span className="plus-icon">+</span>
            Opret aftale
          </button>
        </div>
      </div>

      <div className="booking-content">
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
        </div>

        {/* Main Calendar Area */}
        <div className="booking-main">
          <div className="calendar-container">
            <div className="calendar-header">
              {weekDays.map((day, index) => {
                const dayName = dayNames[day.getDay()];
                const dayNumber = day.getDate();
                const month = day.getMonth() + 1;
                return (
                  <div key={index} className="calendar-day-header">
                    {dayName} {dayNumber}/{month}
                  </div>
                );
              })}
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day, index) => (
                <div key={index} className="calendar-day-cell">
                  {day !== null && <span className="day-number">{day}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingPage;
