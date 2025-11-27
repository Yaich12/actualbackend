import React, { useEffect, useMemo, useState } from 'react';
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
  const { user, signOutUser } = useAuth();
  const { services: remoteServices, loading: isLoadingServices, error: servicesLoadError } = useUserServices();
  const [activeNav, setActiveNav] = useState('ydelser');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceList, setServiceList] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);

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

  const openCreateService = () => {
    setEditingService(null);
    setShowServiceModal(true);
  };

  const openEditService = (service) => {
    setEditingService(service);
    setShowServiceModal(true);
  };

  const handleServiceModalClose = () => {
    setShowServiceModal(false);
    setEditingService(null);
  };

  const handleServiceModalSubmit = (maybeService) => {
    if (!maybeService) {
      handleServiceModalClose();
      return;
    }

    if (maybeService.deleted) {
      setServiceList((prev) => prev.filter((service) => service.id !== maybeService.id));
      handleServiceModalClose();
      return;
    }

    const normalized = normalizeService(maybeService || {});
    setServiceList((prev) => {
      const withoutDuplicate = prev.filter((service) => service.id !== normalized.id);
      return [normalized, ...withoutDuplicate];
    });
    handleServiceModalClose();
  };

  useEffect(() => {
    setServiceList(remoteServices);
    setSelectedServices((prevSelected) =>
      prevSelected.filter((serviceId) =>
        remoteServices.some((service) => service.id === serviceId)
      )
    );
  }, [remoteServices]);

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
        <div className="topbar-right" />
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

        {/* Main Content Area - Services */}
        <div className="ydelser-main">
          {/* Page Header */}
          <div className="ydelser-header">
            <div className="header-left">
              <h2 className="page-title">Ydelser</h2>
            </div>
            <div className="header-right">
              <button
                className="create-service-btn"
                type="button"
                onClick={openCreateService}
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
                    checked={false}
                    readOnly
                    onChange={() => openEditService(service)}
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
        isOpen={showServiceModal}
        onClose={handleServiceModalClose}
        onSubmit={handleServiceModalSubmit}
        mode={editingService ? 'edit' : 'create'}
        serviceId={editingService?.id || null}
        initialService={editingService || null}
      />
    </div>
  );
}

export default Ydelser;
