import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../bookingpage.css';
import './ydelser.css';
import AddNewServiceModal from './addnew/addnew';
import { useAuth } from '../../../AuthContext';
import { useUserServices } from './hooks/useUserServices';

const normalizeService = (stored = {}) => {
  const price =
    typeof stored.pris === 'number'
      ? stored.pris
      : typeof stored.price === 'number'
      ? stored.price
      : 0;

  const priceIncl =
    typeof stored.prisInklMoms === 'number'
      ? stored.prisInklMoms
      : typeof stored.priceInclVat === 'number'
      ? stored.priceInclVat
      : price;

  return {
    id:
      stored.id ||
      `${stored.navn || stored.name || 'ydelse'}-${stored.createdAt || Date.now()}`,
    navn: stored.navn || stored.name || 'Ny ydelse',
    varighed: stored.varighed || stored.duration || '1 time',
    pris: price,
    prisInklMoms: priceIncl,
    description: stored.description || '',
    createdAt: stored.createdAt || stored.createdAtIso || null,
  };
};

function Ydelser() {
  const navigate = useNavigate();
  const { signOutUser } = useAuth();
  const { services: remoteServices, loading: isLoadingServices, error: servicesLoadError } = useUserServices();
  const [activeNav, setActiveNav] = useState('ydelser');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceList, setServiceList] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
      setSelectedServices(serviceList.map(s => s.id));
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

  const filteredServices = serviceList.filter(service =>
    service.navn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price) => {
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const handleAddNewService = (serviceData) => {
    const normalized = normalizeService(serviceData || {});
    setServiceList((prev) => {
      const withoutDuplicate = prev.filter((service) => service.id !== normalized.id);
      return [normalized, ...withoutDuplicate];
    });
  };

  useEffect(() => {
    setServiceList(remoteServices);
    setSelectedServices((prevSelected) =>
      prevSelected.filter((serviceId) =>
        remoteServices.some((service) => service.id === serviceId)
      )
    );
  }, [remoteServices]);

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
              <button
                className="create-service-btn"
                type="button"
                onClick={() => setIsAddModalOpen(true)}
              >
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
                checked={selectedServices.length === serviceList.length && serviceList.length > 0}
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

          {(isLoadingServices || servicesLoadError) && (
            <div
              className={`services-status-message${
                servicesLoadError ? ' error' : ''
              }`}
            >
              {servicesLoadError
                ? servicesLoadError
                : 'Henter ydelser...'}
            </div>
          )}

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
      <AddNewServiceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddNewService}
      />
    </div>
  );
}

export default Ydelser;
