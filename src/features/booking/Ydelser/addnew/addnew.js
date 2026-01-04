import React, { useEffect, useState } from 'react';
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import './addnew.css';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';
import { useLanguage } from '../../../../LanguageContext';
import { getServiceDurationOptions } from '../../../../utils/serviceLabels';

const DEFAULT_FORM_VALUES = {
  name: '',
  description: '',
  duration: '1 time',
  price: '',
  includeVat: false,
  currency: 'DKK',
  color: '#3B82F6',
};

const COLOR_OPTIONS = [
  { value: '#F59E0B', key: 'booking.services.colors.amber', fallback: 'Rav / Amber' },
  { value: '#06B6D4', key: 'booking.services.colors.teal', fallback: 'Turkis / Teal' },
  { value: '#3B82F6', key: 'booking.services.colors.softBlue', fallback: 'Blød blå' },
  { value: '#8B5CF6', key: 'booking.services.colors.violet', fallback: 'Violet' },
  { value: '#EF4444', key: 'booking.services.colors.red', fallback: 'Rød' },
  { value: '#EC4899', key: 'booking.services.colors.pink', fallback: 'Lyserød' },
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

function AddNewServiceModal({
  isOpen,
  onClose,
  onSubmit,
  mode = 'create',
  initialService = null,
  serviceId = null,
}) {
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { user } = useAuth();
  const { t } = useLanguage();
  const durationOptions = getServiceDurationOptions(t);
  const colorOptions = COLOR_OPTIONS.map((option) => ({
    ...option,
    label: t(option.key, option.fallback),
  }));

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialService) {
      setFormValues({
        name: initialService.name || initialService.navn || '',
        description: initialService.description || '',
        duration: initialService.duration || initialService.varighed || '1 time',
        price:
          typeof initialService.price === 'number'
            ? initialService.price
            : typeof initialService.pris === 'number'
              ? initialService.pris
              : '',
        includeVat: (() => {
          const price =
            typeof initialService.price === 'number'
              ? initialService.price
              : typeof initialService.pris === 'number'
                ? initialService.pris
                : null;
          const incl =
            typeof initialService.priceInclVat === 'number'
              ? initialService.priceInclVat
              : typeof initialService.prisInklMoms === 'number'
                ? initialService.prisInklMoms
                : null;
          if (price == null || incl == null) {
            return Boolean(initialService.includeVat);
          }
          return incl !== price ? true : Boolean(initialService.includeVat);
        })(),
        currency: initialService.currency || 'DKK',
        color: initialService.color || '#3B82F6',
      });
      setSaveError('');
      setIsSaving(false);
      return;
    }

    setFormValues(DEFAULT_FORM_VALUES);
    setSaveError('');
    setIsSaving(false);
  }, [isOpen, mode, initialService]);

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
      setSaveError(
        t('booking.services.addNew.errors.notLoggedIn', 'Du skal være logget ind for at gemme en ydelse.')
      );
      return;
    }

    setSaveError('');
    setIsSaving(true);

    try {
      const nowIso = new Date().toISOString();
      const ownerIdentifier = deriveUserIdentifier(user);
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
        createdAtIso: nowIso,
      };

      if (mode === 'edit' && serviceId) {
        const serviceRef = doc(db, 'users', user.uid, 'services', serviceId);
        await updateDoc(serviceRef, {
          ...payload,
          updatedAt: serverTimestamp(),
        });

        if (onSubmit) {
          onSubmit({
            id: serviceId,
            navn: payload.name?.trim() || 'Ny ydelse',
            varighed: payload.duration || '1 time',
            pris: payload.price,
            prisInklMoms: payload.priceInclVat,
            description: payload.description || '',
            color: payload.color || '#3B82F6',
            updatedAt: nowIso,
          });
        }
      } else {
        const servicesCollection = collection(db, 'users', user.uid, 'services');
        const docRef = await addDoc(servicesCollection, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const newServiceForList = {
          id: docRef.id,
          navn: payload.name?.trim() || 'Ny ydelse',
          varighed: payload.duration || '1 time',
          pris: payload.price,
          prisInklMoms: payload.priceInclVat,
          description: payload.description || '',
          color: payload.color || '#3B82F6',
          createdAt: nowIso,
        };

        if (onSubmit) {
          onSubmit(newServiceForList);
        }
      }
      onClose();
    } catch (error) {
      console.error('Failed to save service:', error);
      setSaveError(
        t('booking.services.addNew.errors.saveFailed', 'Kunne ikke gemme ydelsen. Prøv igen.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.uid || !serviceId) return;
    const confirmed = window.confirm(
      t(
        'booking.services.addNew.confirmDelete',
        'Er du sikker på, at du vil slette denne ydelse? Dette kan ikke fortrydes.'
      )
    );
    if (!confirmed) return;

    try {
      const serviceRef = doc(db, 'users', user.uid, 'services', serviceId);
      await deleteDoc(serviceRef);
      if (onSubmit) {
        onSubmit({ id: serviceId, deleted: true });
      }
      onClose?.();
    } catch (error) {
      console.error('Failed to delete service:', error);
      setSaveError(
        t('booking.services.addNew.errors.deleteFailed', 'Kunne ikke slette ydelsen. Prøv igen.')
      );
    }
  };

  return (
    <div className="addnew-modal-overlay" onClick={onClose}>
      <div className="addnew-modal" onClick={(event) => event.stopPropagation()}>
        <div className="addnew-modal-header">
          <h2>
            {mode === 'edit'
              ? t('booking.services.addNew.title.edit', 'Rediger ydelse')
              : t('booking.services.addNew.title.create', 'Opret ny ydelse')}
          </h2>
          <button
            type="button"
            className="addnew-close-btn"
            onClick={onClose}
            aria-label={t('booking.services.addNew.actions.close', 'Luk')}
          >
            ×
          </button>
        </div>

        <form className="addnew-form" onSubmit={handleSubmit}>
          <div className="addnew-field-group">
            <label htmlFor="service-name">
              {t('booking.services.addNew.fields.name.label', 'Navn')}
            </label>
            <input
              id="service-name"
              type="text"
              value={formValues.name}
              onChange={handleChange('name')}
              placeholder={t(
                'booking.services.addNew.fields.name.placeholder',
                'Angiv navn på ydelsen'
              )}
            />
          </div>

          <div className="addnew-field-group">
            <label htmlFor="service-description">
              {t('booking.services.addNew.fields.description.label', 'Beskrivelse')}
            </label>
            <textarea
              id="service-description"
              value={formValues.description}
              onChange={handleChange('description')}
              placeholder={t(
                'booking.services.addNew.fields.description.placeholder',
                'Tilføj en beskrivelse (valgfrit)'
              )}
              rows={4}
            />
          </div>

          <div className="addnew-inline-fields">
            <div className="addnew-field-group">
              <label htmlFor="service-duration">
                {t('booking.services.addNew.fields.duration.label', 'Varighed')}
              </label>
              <select
                id="service-duration"
                value={formValues.duration}
                onChange={handleChange('duration')}
              >
                {durationOptions.map((duration) => (
                  <option key={duration.value} value={duration.value}>
                    {duration.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="addnew-field-group">
              <label htmlFor="service-color">
                {t('booking.services.addNew.fields.color.label', 'Farve')}
              </label>
              <select
                id="service-color"
                value={formValues.color}
                onChange={handleChange('color')}
              >
                {colorOptions.map((color) => (
                  <option key={color.value} value={color.value}>
                    {color.label}
                  </option>
                ))}
              </select>
              <p className="addnew-color-hint">
                {t(
                  'booking.services.addNew.fields.color.hint',
                  'Vælg farve til visning i kalenderen.'
                )}
              </p>
            </div>
          </div>

          <div className="addnew-inline-fields addnew-price-row">
            <div className="addnew-field-group">
              <label>{t('booking.services.addNew.fields.price.label', 'Pris')}</label>
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
                  placeholder={t('booking.services.addNew.fields.price.placeholder', '0,00')}
                />
              </div>
            </div>

            <div className="addnew-field-group addnew-tax-toggle">
              <label>{t('booking.services.addNew.fields.vat.label', 'Moms')}</label>
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
            {mode === 'edit' && (
              <button
                type="button"
                className="addnew-secondary-btn addnew-delete-btn"
                onClick={handleDelete}
                disabled={isSaving}
              >
                {t('booking.services.addNew.actions.delete', 'Slet ydelse')}
              </button>
            )}
            <button
              type="button"
              className="addnew-secondary-btn"
              onClick={onClose}
              disabled={isSaving}
            >
              {t('booking.services.addNew.actions.cancel', 'Annuller')}
            </button>
            <button
              type="submit"
              className="addnew-primary-btn"
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? t('booking.services.addNew.actions.saving', 'Gemmer...') : (
                <>
                  {t('booking.services.addNew.actions.next', 'Næste')}{' '}
                  <span className="addnew-btn-arrow">›</span>
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
