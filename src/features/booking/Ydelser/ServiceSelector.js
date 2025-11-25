import React, { useEffect } from 'react';
import { useUserServices } from './hooks/useUserServices';

const formatPrice = (price) =>
  new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price ?? 0);

function ServiceSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Ingen ydelse valgt',
  onServicesChange,
}) {
  const { services, loading, error } = useUserServices();

  useEffect(() => {
    if (typeof onServicesChange === 'function') {
      onServicesChange(services);
    }
  }, [services, onServicesChange]);

  if (loading) {
    return <p className="service-selector__status">Henter ydelser…</p>;
  }

  if (error) {
    return <p className="service-selector__status error">{error}</p>;
  }

  if (!services.length) {
    return <p className="service-selector__status">Du har ingen ydelser endnu.</p>;
  }

  return (
    <label className="service-selector">
      Vælg behandling
      <div className="select-wrapper">
        <select
          className="select-input"
          value={value || ''}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.navn} – {service.varighed} – DKK {formatPrice(service.pris)}
            </option>
          ))}
        </select>
        <span className="dropdown-arrow">▼</span>
      </div>
    </label>
  );
}

export default ServiceSelector;

