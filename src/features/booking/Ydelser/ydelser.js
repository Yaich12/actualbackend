import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../bookingpage.css';
import './ydelser.css';
import { services } from './servicesData';
import AddNewServiceModal from './addnew/addnew';
import { useAuth } from '../../../AuthContext';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase';

const sanitizeIdentifier = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const deriveUserIdentifier = (user) => {
  if (!user) {
    return 'unknown-user';
  }

  const baseIdentifier =
    (user.displayName && user.displayName.trim()) ||
    (user.email && user.email.trim()) ||
    user.uid ||
    'unknown-user';

  const sanitized = sanitizeIdentifier(baseIdentifier);
  if (sanitized) {
    return sanitized;
  }

  if (user.uid) {
    return sanitizeIdentifier(user.uid);
  }

  return 'unknown-user';
};

const mapStoredServiceToRow = (stored) => {
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
      stored.storagePath ||
      stored.id ||
      `${stored.navn || stored.name || 'ydelse'}-${stored.createdAt || Date.now()}`,
    navn: stored.navn || stored.name || 'Ny ydelse',
    varighed: stored.varighed || stored.duration || '1 time',
    pris: price,
    prisInklMoms: priceIncl,
    description: stored.description || '',
    createdAt: stored.createdAt || null,
    storagePath: stored.storagePath,
  };
};

function Ydelser() {
  const navigate = useNavigate();
  const { signOutUser, user } = useAuth();
  const [activeNav, setActiveNav] = useState('ydelser');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceList, setServiceList] = useState(services);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [servicesLoadError, setServicesLoadError] = useState('');


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
    const normalized = mapStoredServiceToRow(serviceData || {});
    setServiceList((prev) => [normalized, ...prev]);
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchServicesFromStorage = async () => {
      if (!user) {
        setServiceList(services);
        setServicesLoadError('');
        setIsLoadingServices(false);
        return;
      }

      setIsLoadingServices(true);
      setServicesLoadError('');

      try {
        const identifier = deriveUserIdentifier(user);
        const folderCandidates = Array.from(
          new Set(
            [identifier, user.uid].filter(
              (candidate) =>
                typeof candidate === 'string' && candidate.trim().length > 0
            )
          )
        );

        const fetchedArrays = await Promise.all(
          folderCandidates.map(async (folderName) => {
            try {
              const folderRef = ref(storage, `ydelser/${folderName}`);
              const listResult = await listAll(folderRef);

              const entries = await Promise.all(
                listResult.items.map(async (itemRef) => {
                  try {
                    const url = await getDownloadURL(itemRef);
                    const response = await fetch(url);
                    if (!response.ok) {
                      throw new Error(`Failed to fetch ${itemRef.fullPath}`);
                    }
                    const data = await response.json();
                    return mapStoredServiceToRow({
                      ...data,
                      storagePath: itemRef.fullPath,
                    });
                  } catch (entryError) {
                    console.error('Failed to load service:', entryError);
                    return null;
                  }
                })
              );

              return entries.filter(Boolean);
            } catch (error) {
              if (error?.code === 'storage/object-not-found') {
                return [];
              }
              throw error;
            }
          })
        );

        const fetchedServices = fetchedArrays
          .flat()
          .sort((a, b) => {
            const first = new Date(a.createdAt || 0).getTime();
            const second = new Date(b.createdAt || 0).getTime();
            return second - first;
          });

        if (!isCancelled) {
          const fetchedIds = new Set(fetchedServices.map((svc) => svc.id));
          setServiceList((prev) => {
            const combined = [...fetchedServices];
            prev.forEach((svc) => {
              if (!fetchedIds.has(svc.id)) {
                combined.push(svc);
              }
            });
            return combined;
          });
        }
      } catch (error) {
        console.error('Failed to load services from storage:', error);
        if (!isCancelled) {
          setServicesLoadError('Kunne ikke hente ydelser. Prøv igen senere.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingServices(false);
        }
      }
    };

    fetchServicesFromStorage();

    return () => {
      isCancelled = true;
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
