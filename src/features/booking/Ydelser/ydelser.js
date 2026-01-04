import React, { useEffect, useMemo, useState } from 'react';
import '../bookingpage.css';
import './ydelser.css';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import AddNewServiceModal from './addnew/addnew';
import { useAuth } from '../../../AuthContext';
import { useLanguage } from '../../../LanguageContext';
import { useUserServices } from './hooks/useUserServices';
import { ChevronDown } from 'lucide-react';
import { formatServiceDuration } from '../../../utils/serviceLabels';

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
    color: stored.color || '#3B82F6',
  };
};

function Ydelser() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { services: remoteServices, loading: isLoadingServices, error: servicesLoadError } = useUserServices();
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceList, setServiceList] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);

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
    return new Intl.NumberFormat(locale, {
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

  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        <div className="booking-content">
          {/* Main Content Area - Services */}
          <div className="ydelser-main">
          {/* Page Header */}
          <div className="ydelser-header">
            <div className="header-left">
              <h2 className="page-title">{t('booking.services.title', 'Ydelser')}</h2>
            </div>
            <div className="header-right">
              <button
                type="button"
                className="toolbar-pill toolbar-primary"
                onClick={openCreateService}
              >
                {t('booking.services.actions.create', 'Opret ny')}
                <ChevronDown className="toolbar-caret" />
              </button>
            </div>
          </div>

          {/* Selection Bar (kun søgning) */}
          <div className="selection-bar">
            <div className="search-bar-services">
              <span className="search-icon-small">🔍</span>
              <input 
                type="text" 
                placeholder={t('booking.services.search.placeholder', 'Søg')}
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
                : t('booking.services.loading', 'Henter ydelser...')}
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
                  <span
                    className="service-color-dot"
                    style={{ backgroundColor: service.color || '#3B82F6' }}
                    aria-hidden="true"
                  />
                </div>
                <div className="service-name">{service.navn}</div>
                <div className="service-duration">
                  {formatServiceDuration(service.varighed, t) || service.varighed}
                </div>
                <div className="service-price">
                  {service.pris === 10.00 ? (
                    <>
                      {t('booking.services.price.currency', 'DKK')} {formatPrice(service.pris)} (
                      {t('booking.services.price.currency', 'DKK')} {formatPrice(service.prisInklMoms)}{' '}
                      {t('booking.services.price.inclVat', 'inkl. moms')})
                    </>
                  ) : (
                    <>
                      {t('booking.services.price.currency', 'DKK')} {formatPrice(service.pris)}
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
    </BookingSidebarLayout>
  );
}

export default Ydelser;
