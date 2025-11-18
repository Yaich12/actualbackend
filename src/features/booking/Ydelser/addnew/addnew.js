import React, { useEffect, useState } from 'react';
import './addnew.css';

const DEFAULT_FORM_VALUES = {
  name: '',
  description: '',
  duration: '1 time',
  price: '',
  includeVat: false,
  currency: 'DKK',
};

const durationOptions = [
  '15 minutter',
  '30 minutter',
  '45 minutter',
  '1 time',
  '1 time 30 minutter',
  '2 timer',
];

function AddNewServiceModal({ isOpen, onClose, onSubmit }) {
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);

  useEffect(() => {
    if (isOpen) {
      setFormValues(DEFAULT_FORM_VALUES);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (field) => (event) => {
    const value = field === 'includeVat' ? event.target.checked : event.target.value;
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onSubmit) {
      onSubmit(formValues);
    }
    onClose();
  };

  return (
    <div className="addnew-modal-overlay" onClick={onClose}>
      <div className="addnew-modal" onClick={(event) => event.stopPropagation()}>
        <div className="addnew-modal-header">
          <h2>Opret ny ydelse</h2>
          <button type="button" className="addnew-close-btn" onClick={onClose} aria-label="Luk">
            ×
          </button>
        </div>

        <form className="addnew-form" onSubmit={handleSubmit}>
          <div className="addnew-field-group">
            <label htmlFor="service-name">Navn</label>
            <input
              id="service-name"
              type="text"
              value={formValues.name}
              onChange={handleChange('name')}
              placeholder="Angiv navn på ydelsen"
            />
          </div>

          <div className="addnew-field-group">
            <label htmlFor="service-description">Beskrivelse</label>
            <textarea
              id="service-description"
              value={formValues.description}
              onChange={handleChange('description')}
              placeholder="Tilføj en beskrivelse (valgfrit)"
              rows={4}
            />
          </div>

          <div className="addnew-inline-fields">
            <div className="addnew-field-group">
              <label htmlFor="service-duration">Varighed</label>
              <select
                id="service-duration"
                value={formValues.duration}
                onChange={handleChange('duration')}
              >
                {durationOptions.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="addnew-inline-fields addnew-price-row">
            <div className="addnew-field-group">
              <label>Pris</label>
              <div className="addnew-price-inputs">
                <select value={formValues.currency} onChange={handleChange('currency')}>
                  <option value="DKK">DKK</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formValues.price}
                  onChange={handleChange('price')}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="addnew-field-group addnew-tax-toggle">
              <label>Moms</label>
              <label className="addnew-switch">
                <input
                  type="checkbox"
                  checked={formValues.includeVat}
                  onChange={handleChange('includeVat')}
                />
                <span className="addnew-slider" />
              </label>
            </div>
          </div>

          <div className="addnew-modal-footer">
            <button type="button" className="addnew-secondary-btn" onClick={onClose}>
              Annuller
            </button>
            <button type="submit" className="addnew-primary-btn">
              Næste <span className="addnew-btn-arrow">›</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddNewServiceModal;
