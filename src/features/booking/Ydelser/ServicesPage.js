import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AddNewServiceModal from './addnew/addnew';
import { useUserServices } from './hooks/useUserServices';
import './ydelser.css';
import { useLanguage } from '../../../LanguageContext';
import { formatServiceDuration } from '../../../utils/serviceLabels';

function ServicesPage() {
  const { services, loading, error } = useUserServices();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localServices, setLocalServices] = useState([]);
  const { t, locale } = useLanguage();

  const formatPrice = (price) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price ?? 0);

  useEffect(() => {
    setLocalServices(services);
  }, [services]);

  const handleAddServiceToList = (newServiceForList) => {
    if (!newServiceForList) {
      return;
    }
    setLocalServices((prev) => {
      if (prev.some((service) => service.id === newServiceForList.id)) {
        return prev;
      }
      return [...prev, newServiceForList];
    });
  };

  return (
    <div className="services-page">
      <div className="services-header">
        <h1>{t('booking.services.list.title', 'Dine ydelser')}</h1>
        <button
          type="button"
          className="toolbar-pill toolbar-primary"
          onClick={() => setIsModalOpen(true)}
        >
          {t('booking.services.actions.createFull', 'Opret ny ydelse')}
          <ChevronDown className="toolbar-caret" />
        </button>
      </div>

      <AddNewServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddServiceToList}
      />

      {loading && (
        <p className="services-status-message">
          {t('booking.services.loading', 'Henter ydelser…')}
        </p>
      )}
      {error && <p className="services-status-message error">{error}</p>}

      {!loading && !localServices.length && (
        <p className="services-empty">
          {t(
            'booking.services.empty',
            'Du har ingen ydelser endnu. Opret din første ydelse.'
          )}
        </p>
      )}

      <ul className="services-list">
        {localServices.map((service) => (
          <li key={service.id} className="services-item">
            <div>
              <strong>{service.navn}</strong>
              <div>{formatServiceDuration(service.varighed, t) || service.varighed}</div>
            </div>
            <div>
              {t('booking.services.price.currency', 'DKK')} {formatPrice(service.pris)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ServicesPage;
