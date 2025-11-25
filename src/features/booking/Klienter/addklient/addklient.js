import React, { useState, useRef, useMemo } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import './addklient.css';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';

const libraries = ['places'];

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

function AddKlient({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    navn: '',
    cpr: '',
    email: '',
    telefon: '',
    telefonLand: '+45',
    adresse: '',
    adresse2: '',
    postnummer: '',
    by: '',
    land: 'Danmark',
  });

  const [showAddressLine2, setShowAddressLine2] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { user } = useAuth();

  // Google Maps / Places
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    id: 'google-places-autocomplete',
    googleMapsApiKey: googleMapsApiKey || '',
    libraries,
  });
  const autocompleteRef = useRef(null);
  const isAutocompleteReady = Boolean(googleMapsApiKey) && isLoaded && !loadError;
  const autocompleteStatus = useMemo(() => {
    if (!googleMapsApiKey) {
      return {
        text: 'Tilføj REACT_APP_GOOGLE_MAPS_API_KEY i din .env og genstart udviklingsserveren.',
        tone: 'error',
      };
    }
    if (loadError) {
      return {
        text: 'Kunne ikke hente Google Maps. Tjek at API-nøglen er korrekt, at Places API er aktiveret, og at der er tilknyttet billing.',
        tone: 'error',
      };
    }
    if (!isLoaded) {
      return {
        text: 'Indlæser Google Maps…',
        tone: 'info',
      };
    }
    return { text: '', tone: 'info' };
  }, [googleMapsApiKey, isLoaded, loadError]);
  const showAutocompleteStatus = Boolean(autocompleteStatus.text) && !isAutocompleteReady;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Når bruger vælger adresse fra Google-forslag
  const handlePlaceChanged = () => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place || !place.address_components) return;

    // Sæt selve adresse-feltet til den formaterede adresse
    const formattedAddress = place.formatted_address || '';
    let postnummer = '';
    let by = '';

    place.address_components.forEach((comp) => {
      const types = comp.types;
      if (types.includes('postal_code')) {
        postnummer = comp.long_name;
      }
      if (types.includes('locality') || types.includes('postal_town')) {
        by = comp.long_name;
      }
    });

    setFormData((prev) => ({
      ...prev,
      adresse: formattedAddress,
      postnummer: postnummer || prev.postnummer,
      by: by || prev.by,
    }));
  };

  const addressInputProps = {
    type: 'text',
    id: 'adresse',
    name: 'adresse',
    value: formData.adresse,
    onChange: handleChange,
    className: 'addklient-input',
    placeholder: 'Begynd at skrive adressen...',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSaving) {
      return;
    }

    if (!user) {
      setSaveError('Du skal være logget ind for at gemme en klient.');
      return;
    }

    setSaveError('');
    setIsSaving(true);

    try {
      const nowIso = new Date().toISOString();
      const ownerIdentifier = deriveUserIdentifier(user);
      const { telefonLand, telefon, land, ...restFormData } = formData;

      const clientPayload = {
        ...restFormData,
        land: land || 'Danmark',
        telefonLand,
        telefon,
        telefonKomplet: telefon ? `${telefonLand || '+45'} ${telefon}` : '',
        ownerUid: user.uid,
        ownerEmail: user.email ?? null,
        ownerIdentifier,
        status: 'Aktiv',
        createdAt: serverTimestamp(),
        createdAtIso: nowIso,
        updatedAt: serverTimestamp(),
      };

      const clientsCollection = collection(db, 'users', user.uid, 'clients');
      const docRef = await addDoc(clientsCollection, clientPayload);

      const savedClientForList = {
        id: docRef.id,
        navn: formData.navn,
        status: 'Aktiv',
        email: formData.email,
        telefon: clientPayload.telefonKomplet,
        cpr: formData.cpr,
        adresse: formData.adresse,
        by: formData.by,
        postnummer: formData.postnummer,
        land: land || 'Danmark',
        createdAt: nowIso,
      };

      if (typeof onSave === 'function') {
        onSave(savedClientForList);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save client data:', error);
      setSaveError('Kunne ikke gemme klienten. Prøv igen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="addklient-modal-overlay" onClick={handleCancel}>
      <div className="addklient-modal" onClick={(e) => e.stopPropagation()}>
        <div className="addklient-modal-header">
          <h2 className="addklient-modal-title">Tilføj klient</h2>
          <button className="addklient-close-btn" onClick={handleCancel}>
            ×
          </button>
        </div>

        <form className="addklient-form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="navn">
              Navn
            </label>
            <input
              type="text"
              id="navn"
              name="navn"
              value={formData.navn}
              onChange={handleChange}
              className="addklient-input"
              required
            />
          </div>

          {/* CPR */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="cpr">
              CPR
            </label>
            <input
              type="text"
              id="cpr"
              name="cpr"
              value={formData.cpr}
              onChange={handleChange}
              className="addklient-input"
            />
          </div>

          {/* Email */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="email">
              E-mail
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="addklient-input"
              required
            />
          </div>

          {/* Phone */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="telefon">
              Telefon
            </label>
            <div className="addklient-phone-group">
              <select
                name="telefonLand"
                value={formData.telefonLand}
                onChange={handleChange}
                className="addklient-phone-country"
              >
                <option value="+45">+45</option>
                <option value="+46">+46</option>
                <option value="+47">+47</option>
                <option value="+358">+358</option>
              </select>
              <input
                type="tel"
                id="telefon"
                name="telefon"
                value={formData.telefon}
                onChange={handleChange}
                className="addklient-input addklient-phone-input"
              />
            </div>
          </div>

          {/* Address + Google Autocomplete */}
          <div className="addklient-form-section">
            <label className="addklient-form-label" htmlFor="adresse">
              Adresse
            </label>
            {isAutocompleteReady ? (
              <Autocomplete
                onLoad={(autocomplete) => (autocompleteRef.current = autocomplete)}
                onPlaceChanged={handlePlaceChanged}
              >
                <input {...addressInputProps} />
              </Autocomplete>
            ) : (
              <>
                <input {...addressInputProps} />
                {showAutocompleteStatus && (
                  <p
                    className={`addklient-status-hint${
                      autocompleteStatus.tone === 'error' ? ' error' : ''
                    }`}
                  >
                    {autocompleteStatus.text}
                  </p>
                )}
              </>
            )}

            {!showAddressLine2 && (
              <button
                type="button"
                className="addklient-add-line-btn"
                onClick={() => setShowAddressLine2(true)}
              >
                Tilføj 2. linje
              </button>
            )}
            {showAddressLine2 && (
              <input
                type="text"
                name="adresse2"
                value={formData.adresse2}
                onChange={handleChange}
                className="addklient-input addklient-input-margin-top"
                placeholder="Adresse 2. linje"
              />
            )}
          </div>

          {/* Postal Code and City */}
          <div className="addklient-form-row">
            <div className="addklient-form-section addklient-form-section-half">
              <label className="addklient-form-label" htmlFor="postnummer">
                Postnummer
              </label>
              <input
                type="text"
                id="postnummer"
                name="postnummer"
                value={formData.postnummer}
                onChange={handleChange}
                className="addklient-input"
              />
            </div>
            <div className="addklient-form-section addklient-form-section-half">
              <label className="addklient-form-label" htmlFor="by">
                By
              </label>
              <input
                type="text"
                id="by"
                name="by"
                value={formData.by}
                onChange={handleChange}
                className="addklient-input"
              />
            </div>
          </div>

          {/* Error Message */}
          {saveError && (
            <p className="addklient-error" role="alert">
              {saveError}
            </p>
          )}

          {/* Action Buttons */}
          <div className="addklient-form-actions">
            <button
              type="button"
              className="addklient-cancel-btn"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Annuller
            </button>
            <button
              type="submit"
              className="addklient-save-btn"
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? 'Gemmer...' : 'Gem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddKlient;

