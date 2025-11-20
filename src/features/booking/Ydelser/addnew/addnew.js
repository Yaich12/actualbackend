import React, { useEffect, useState } from 'react';
import { ref, uploadString } from 'firebase/storage';
import './addnew.css';
import { storage } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

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

function AddNewServiceModal({ isOpen, onClose, onSubmit }) {
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { user } = useAuth();

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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (!user) {
      setSaveError('Du skal være logget ind for at gemme en ydelse.');
      return;
    }

    setSaveError('');
    setIsSaving(true);

    try {
      const nowIso = new Date().toISOString();
      const ownerIdentifier = deriveUserIdentifier(user);
      const serviceIdentifier =
        sanitizeIdentifier(formValues.name) || `ydelse-${Date.now()}`;
      const storageFileName = `${serviceIdentifier}-${Date.now()}.json`;
      const storagePath = `ydelser/${ownerIdentifier}/${storageFileName}`;
      const priceParsed = parseFloat(
        (formValues.price || '').toString().replace(',', '.')
      );
      const price = Number.isNaN(priceParsed) ? 0 : priceParsed;
      const priceInclVat = formValues.includeVat ? price : price * 1.25;

      const payload = {
        ...formValues,
        price,
        priceInclVat,
        ownerUid: user.uid,
        ownerEmail: user.email ?? null,
        ownerIdentifier,
        createdAt: nowIso,
        updatedAt: nowIso,
        storagePath,
      };

      await uploadString(
        ref(storage, storagePath),
        JSON.stringify(payload),
        'raw',
        {
          contentType: 'application/json; charset=utf-8',
        }
      );

      const newServiceForList = {
        id: storagePath,
        navn: payload.name?.trim() || 'Ny ydelse',
        varighed: payload.duration || '1 time',
        pris: payload.price,
        prisInklMoms: payload.priceInclVat,
        description: payload.description || '',
        createdAt: nowIso,
        storagePath,
      };

      if (onSubmit) {
        onSubmit(newServiceForList);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save service:', error);
      setSaveError('Kunne ikke gemme ydelsen. Prøv igen.');
    } finally {
      setIsSaving(false);
    }
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

          {saveError && (
            <p className="addnew-error" role="alert">
              {saveError}
            </p>
          )}

          <div className="addnew-modal-footer">
            <button
              type="button"
              className="addnew-secondary-btn"
              onClick={onClose}
              disabled={isSaving}
            >
              Annuller
            </button>
            <button
              type="submit"
              className="addnew-primary-btn"
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? 'Gemmer...' : (
                <>
                  Næste <span className="addnew-btn-arrow">›</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddNewServiceModal;
