import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../bookingpage.css';
import './ydelser.css';

function Ydelser() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('ydelser');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);

  // Dummy data
  const [services] = useState([
    {
      id: 1,
      navn: 'Eksempel på en ydelse',
      varighed: '45 minutter',
      pris: 10.00,
      prisInklMoms: 12.50
    },
    {
      id: 2,
      navn: 'fodmassage',
      varighed: '1 time',
      pris: 500.00,
      prisInklMoms: 625.00
    },
    {
      id: 3,
      navn: 'Konsultation',
      varighed: '1 time',
      pris: 600.00,
      prisInklMoms: 750.00
    },
    {
      id: 4,
      navn: 'massage',
      varighed: '1 time',
      pris: 400.00,
      prisInklMoms: 500.00
    },
    {
      id: 5,
      navn: 'Fysioterapi',
      varighed: '30 minutter',
      pris: 350.00,
      prisInklMoms: 437.50
    },
    {
      id: 6,
      navn: 'Akupunktur',
      varighed: '45 minutter',
      pris: 450.00,
      prisInklMoms: 562.50
    }
  ]);

  const handleNavClick = (navItem) => {
    setActiveNav(navItem);
    if (navItem === 'kalender') {
      navigate('/booking');
    } else if (navItem === 'klienter') {
      navigate('/booking/klienter');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedServices(services.map(s => s.id));
    } else {
      setSelectedServices([]);
    }
  };

  const handleSelectService = (serviceId) => {
    setSelectedServices(prev => 
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const filteredServices = services.filter(service =>
    service.navn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price) => {
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  return (
    <div className="booking-page">
      {/* Top Navigation Bar */}
      <div className="booking-topbar">
        <div className="topbar-left">
          <button className="topbar-logo-btn" onClick={() => navigate('/')}>
            Forside
          </button>
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
                onClick={() => handleNavClick('kalender')}
              >
                <span className="nav-icon calendar-icon">📅</span>
                <span className="nav-text">Kalender</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'klienter' ? 'active' : ''}`}
                onClick={() => handleNavClick('klienter')}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">Klienter</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'ydelser' ? 'active' : ''}`}
                onClick={() => handleNavClick('ydelser')}
              >
                <span className="nav-icon">🏷️</span>
                <span className="nav-text">Ydelser</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'fakturaer' ? 'active' : ''}`}
                onClick={() => handleNavClick('fakturaer')}
              >
                <span className="nav-icon">📄</span>
                <span className="nav-text">Fakturaer</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'statistik' ? 'active' : ''}`}
                onClick={() => handleNavClick('statistik')}
              >
                <span className="nav-icon">📊</span>
                <span className="nav-text">Statistik</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'indstillinger' ? 'active' : ''}`}
                onClick={() => handleNavClick('indstillinger')}
              >
                <span className="nav-icon">⚙️</span>
                <span className="nav-text">Indstillinger</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'apps' ? 'active' : ''}`}
                onClick={() => handleNavClick('apps')}
              >
                <span className="nav-icon">📱</span>
                <span className="nav-text">Apps</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content Area - Services */}
        <div className="ydelser-main">
          {/* Page Header */}
          <div className="ydelser-header">
            <div className="header-left">
              <h2 className="page-title">Ydelser</h2>
            </div>
            <div className="header-right">
              <button className="sort-btn">
                <span className="sort-icon">☰</span>
                Sorter ydelser
              </button>
              <button className="create-service-btn">
                <span className="plus-icon">+</span>
                Opret ny
              </button>
            </div>
          </div>

          {/* Selection Bar */}
          <div className="selection-bar">
            <div className="select-all-container">
              <input 
                type="checkbox" 
                id="select-all"
                checked={selectedServices.length === services.length && services.length > 0}
                onChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="select-all-label">
                Vælg ydelser
                <span className="dropdown-arrow">▼</span>
              </label>
            </div>
            <div className="search-bar-services">
              <span className="search-icon-small">🔍</span>
              <input 
                type="text" 
                placeholder="Søg" 
                className="search-input-services"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Services List */}
          <div className="services-list">
            {filteredServices.map((service) => (
              <div 
                key={service.id} 
                className="service-item"
                onClick={() => handleSelectService(service.id)}
              >
                <div className="service-checkbox">
                  <input 
                    type="checkbox" 
                    checked={selectedServices.includes(service.id)}
                    onChange={() => handleSelectService(service.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="service-name">
                  {service.navn}
                </div>
                <div className="service-duration">
                  {service.varighed}
                </div>
                <div className="service-price">
                  {service.pris === 10.00 ? (
                    <>
                      DKK {formatPrice(service.pris)} (DKK {formatPrice(service.prisInklMoms)} inkl. moms)
                    </>
                  ) : (
                    <>
                      DKK {formatPrice(service.pris)}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Ydelser;

