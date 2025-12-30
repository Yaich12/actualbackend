import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import './addklient.css';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';

const libraries = ['places'];

const getEmptyClientensOplysninger = () => ({
  diagnose: '',
  foersteKonsultation: '',
  maalForForloebet: '',
  tilknyttetTerapeut: '',
  startdato: '',
  forventetSlutdato: '',
});

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

const splitNameParts = (value) => {
  if (!value || typeof value !== 'string') {
    return { fornavn: '', efternavn: '' };
  }
  const parts = value.trim().split(/\s+/);
  if (!parts.length) {
    return { fornavn: '', efternavn: '' };
  }
  return {
    fornavn: parts[0] || '',
    efternavn: parts.slice(1).join(' '),
  };
};

const getInitialFormData = (mode, initialClient) => {
  const base = {
    navn: '',
    fornavn: '',
    efternavn: '',
    cpr: '',
    email: '',
    telefon: '',
    telefonLand: '+45',
    adresse: '',
    adresse2: '',
    postnummer: '',
    by: '',
    land: 'Danmark',
    status: 'Aktiv',
    foedselsdag: '',
    foedselsaar: '',
    koen: '',
    pronomer: '',
    kundekilde: '',
    henvistAf: '',
  };

  if (mode === 'edit' && initialClient) {
    const telefonLand = initialClient.telefonLand || '+45';
    const telefonValue = initialClient.telefon || '';
    const telefonUdenLand = telefonValue.startsWith(telefonLand)
      ? telefonValue.slice(telefonLand.length).trim().replace(/^\s+/, '')
      : telefonValue;
    const nameParts = splitNameParts(initialClient.navn || '');

    return {
      ...base,
      navn: initialClient.navn || '',
      fornavn: initialClient.fornavn || nameParts.fornavn,
      efternavn: initialClient.efternavn || nameParts.efternavn,
      cpr: initialClient.cpr || '',
      email: initialClient.email || '',
      telefon: telefonUdenLand || '',
      telefonLand,
      adresse: initialClient.adresse || '',
      adresse2: initialClient.adresse2 || '',
      postnummer: initialClient.postnummer || '',
      by: initialClient.by || '',
      land: initialClient.land || 'Danmark',
      status: initialClient.status || 'Aktiv',
      foedselsdag: initialClient.foedselsdag || '',
      foedselsaar: initialClient.foedselsaar || '',
      koen: initialClient.koen || '',
      pronomer: initialClient.pronomer || '',
      kundekilde: initialClient.kundekilde || '',
      henvistAf: initialClient.henvistAf || '',
    };
  }

  return base;
};

function AddKlient({
  isOpen = true,
  onClose,
  onSave,
  mode = 'create',
  initialClient = null,
  clientId = null,
  onDelete,
  editView = 'forloeb', // 'personal' or 'forloeb' - only used when mode === 'edit'
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(mode, initialClient));
  const [clientensOplysninger, setClientensOplysninger] = useState(() =>
    getEmptyClientensOplysninger()
  );

  const [showAddressLine2, setShowAddressLine2] = useState(Boolean(initialClient?.adresse2));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingClientensOplysninger, setIsLoadingClientensOplysninger] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { user } = useAuth();
  const isDev = process.env.NODE_ENV !== 'production';

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
      ...(name === 'navn'
        ? {
            navn: value,
            ...splitNameParts(value),
          }
        : {
            [name]: value,
          }),
      ...(name === 'fornavn' || name === 'efternavn'
        ? {
            navn: `${name === 'fornavn' ? value : prev.fornavn} ${
              name === 'efternavn' ? value : prev.efternavn
            }`.trim(),
          }
        : {}),
    }));
  };

  const handleClientensOplysningerChange = (e) => {
    const { name, value } = e.target;
    setClientensOplysninger((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  useEffect(() => {
    setFormData(getInitialFormData(mode, initialClient));
    setShowAddressLine2(Boolean(initialClient?.adresse2));
    setClientensOplysninger(getEmptyClientensOplysninger());
    setSaveError('');
  }, [mode, initialClient]);

  useEffect(() => {
    if (mode !== 'edit') {
      setIsLoadingClientensOplysninger(false);
      return;
    }

    if (!user?.uid || !clientId) {
      setSaveError('Manglende klient-id – kunne ikke hente klientens oplysninger.');
      setIsLoadingClientensOplysninger(false);
      return;
    }

    let cancelled = false;

    const loadClientData = async () => {
      setIsLoadingClientensOplysninger(true);
      setSaveError('');

      try {
        const clientRef = doc(db, 'users', user.uid, 'clients', clientId);
        const snapshot = await getDoc(clientRef);

        if (!snapshot.exists()) {
          setSaveError('Klienten blev ikke fundet.');
          return;
        }

        const data = snapshot.data() || {};

        if (cancelled) return;

        if (editView === 'personal') {
          // Load personal information
          const telefonLand = data.telefonLand || '+45';
          const telefonValue = data.telefon || '';
          const telefonUdenLand = telefonValue.startsWith(telefonLand)
            ? telefonValue.slice(telefonLand.length).trim().replace(/^\s+/, '')
            : telefonValue;

          setFormData({
            navn: data.navn || '',
            cpr: data.cpr || '',
            email: data.email || '',
            telefon: telefonUdenLand || '',
            telefonLand,
            adresse: data.adresse || '',
            adresse2: data.adresse2 || '',
            postnummer: data.postnummer || '',
            by: data.by || '',
            land: data.land || 'Danmark',
            status: data.status || 'Aktiv',
          });
          setShowAddressLine2(Boolean(data.adresse2));
        } else {
          // Load forløbsoplysninger
          const stored = data.clientensoplysninger || {};
          setClientensOplysninger({
            ...getEmptyClientensOplysninger(),
            diagnose: typeof stored.diagnose === 'string' ? stored.diagnose : '',
            foersteKonsultation:
              typeof stored.foersteKonsultation === 'string' ? stored.foersteKonsultation : '',
            maalForForloebet:
              typeof stored.maalForForloebet === 'string' ? stored.maalForForloebet : '',
            tilknyttetTerapeut:
              typeof stored.tilknyttetTerapeut === 'string' ? stored.tilknyttetTerapeut : '',
            startdato: typeof stored.startdato === 'string' ? stored.startdato : '',
            forventetSlutdato:
              typeof stored.forventetSlutdato === 'string' ? stored.forventetSlutdato : '',
          });
        }
      } catch (error) {
        console.error('[AddKlient] Failed to load client data', error);
        if (!cancelled) {
          setSaveError('Kunne ikke hente klientens oplysninger. Prøv igen.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClientensOplysninger(false);
        }
      }
    };

    loadClientData();

    return () => {
      cancelled = true;
    };
  }, [clientId, mode, user?.uid, editView]);

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
      const fullName =
        formData.navn?.trim() ||
        `${formData.fornavn || ''} ${formData.efternavn || ''}`.trim();
      const normalizedFormData = {
        ...formData,
        navn: fullName,
      };

      if (mode === 'edit') {
        if (!clientId) {
          setSaveError('Manglende klient-id – kunne ikke gemme.');
          return;
        }

        const clientRef = doc(db, 'users', user.uid, 'clients', clientId);

        if (editView === 'personal') {
          // Save personal information
          const { telefonLand, telefon, land, ...restFormData } = normalizedFormData;
          const telefonLandValue = (telefonLand || '+45').trim();
          const telefonValue = (telefon || '').trim();

          await updateDoc(clientRef, {
            ...restFormData,
            land: land || 'Danmark',
            telefonLand: telefonLandValue,
            telefon: telefonValue,
            telefonKomplet: telefonValue ? `${telefonLandValue} ${telefonValue}` : '',
            status: formData.status || 'Aktiv',
            updatedAt: serverTimestamp(),
          });
        } else {
          // Save forløbsoplysninger
          const cleaned = {
            diagnose: (clientensOplysninger.diagnose || '').trim(),
            foersteKonsultation: clientensOplysninger.foersteKonsultation || '',
            maalForForloebet: (clientensOplysninger.maalForForloebet || '').trim(),
            tilknyttetTerapeut: (clientensOplysninger.tilknyttetTerapeut || '').trim(),
            startdato: clientensOplysninger.startdato || '',
            forventetSlutdato: clientensOplysninger.forventetSlutdato || '',
          };

          await updateDoc(clientRef, {
            'clientensoplysninger.diagnose': cleaned.diagnose,
            'clientensoplysninger.foersteKonsultation': cleaned.foersteKonsultation,
            'clientensoplysninger.maalForForloebet': cleaned.maalForForloebet,
            'clientensoplysninger.tilknyttetTerapeut': cleaned.tilknyttetTerapeut,
            'clientensoplysninger.startdato': cleaned.startdato,
            'clientensoplysninger.forventetSlutdato': cleaned.forventetSlutdato,
            updatedAt: serverTimestamp(),
          });
        }

        if (typeof onSave === 'function') {
          onSave();
        }

        onClose();
        return;
      }

      const nowIso = new Date().toISOString();
      const ownerIdentifier = deriveUserIdentifier(user);
      const { telefonLand, telefon, land, ...restFormData } = normalizedFormData;
      const telefonLandValue = (telefonLand || '+45').trim();
      const telefonValue = (telefon || '').trim();

      const clientPayload = {
        ...restFormData,
        land: land || 'Danmark',
        telefonLand: telefonLandValue,
        telefon: telefonValue,
        telefonKomplet: telefonValue ? `${telefonLandValue} ${telefonValue}` : '',
        ownerUid: user.uid,
        ownerEmail: user.email ?? null,
        ownerIdentifier,
        status: formData.status || 'Aktiv',
        updatedAt: serverTimestamp(),
        ...(mode === 'create'
          ? {
              createdAt: serverTimestamp(),
              createdAtIso: nowIso,
            }
          : {}),
      };

      if (mode === 'create') {
        const clientsCollection = collection(db, 'users', user.uid, 'clients');
        const clientPath = `users/${user.uid}/clients`;
        const docRef = await addDoc(clientsCollection, clientPayload);
        if (isDev) {
          console.log('[AddKlient] Created client', {
            path: clientPath,
            uid: user.uid,
            clientId: docRef.id,
          });
        }

        const savedClientForList = {
          id: docRef.id,
          navn: normalizedFormData.navn,
          status: formData.status || 'Aktiv',
          email: normalizedFormData.email,
          telefon: clientPayload.telefonKomplet,
          cpr: normalizedFormData.cpr,
          adresse: normalizedFormData.adresse,
          by: normalizedFormData.by,
          postnummer: normalizedFormData.postnummer,
          land: land || 'Danmark',
          createdAt: nowIso,
        };

        if (typeof onSave === 'function') {
          onSave(savedClientForList);
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to save client data:', error);
      if (isDev) {
        console.error('[AddKlient] Client creation failed', {
          path: user?.uid ? `users/${user.uid}/clients` : 'unknown',
          uid: user?.uid || 'unknown',
          errorCode: error?.code || 'unknown',
        });
      }
      setSaveError('Kunne ikke gemme klienten. Prøv igen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDelete = async () => {
    if (!user?.uid || !clientId) return;
    const confirmed = window.confirm(
      'Er du sikker på, at du vil slette denne klient? Dette kan ikke fortrydes.'
    );
    if (!confirmed) return;

    try {
      const clientRef = doc(db, 'users', user.uid, 'clients', clientId);
      await deleteDoc(clientRef);
      if (typeof onDelete === 'function') {
        onDelete(clientId);
      }
      onClose?.();
    } catch (error) {
      console.error('[AddKlient] Failed to delete client', error);
      alert('Kunne ikke slette klienten. Prøv igen.');
    }
  };

  if (mode === 'create') {
    const initialsSource = `${formData.fornavn || ''} ${formData.efternavn || ''}`.trim() ||
      formData.navn ||
      '?';
    const initials = initialsSource
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="addklient-modal-overlay" onClick={handleCancel}>
        <div
          className="addklient-modal addklient-modal-create"
          onClick={(e) => e.stopPropagation()}
        >
          <form className="addklient-form addklient-form-create" onSubmit={handleSubmit}>
            <div className="addklient-create-header">
              <h2 className="addklient-create-title">Tilføj en ny kunde</h2>
              <div className="addklient-create-actions">
                <button
                  type="button"
                  className="addklient-create-btn addklient-create-btn-secondary"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Luk
                </button>
                <button
                  type="submit"
                  className="addklient-create-btn addklient-create-btn-primary"
                  disabled={isSaving}
                  aria-busy={isSaving}
                >
                  {isSaving ? 'Gemmer...' : 'Gem'}
                </button>
              </div>
            </div>

            {saveError && (
              <p className="addklient-error" role="alert">
                {saveError}
              </p>
            )}

            <div className="addklient-create-body">
              <aside className="addklient-create-nav">
                <div className="addklient-create-nav-title">Personligt</div>
                <button type="button" className="addklient-create-nav-item active">
                  Profil
                </button>
                <button type="button" className="addklient-create-nav-item">
                  Adresse
                </button>
                <button type="button" className="addklient-create-nav-item">
                  Nødkontakter
                </button>
                <div className="addklient-create-nav-divider" />
                <button type="button" className="addklient-create-nav-item">
                  Indstillinger
                </button>
              </aside>

              <div className="addklient-create-panel">
                <div className="addklient-profile-header">
                  <div>
                    <h3>Profil</h3>
                    <p>Administer din kundes personlige profil</p>
                  </div>
                  <div className="addklient-profile-avatar">
                    <div className="addklient-profile-avatar-circle">{initials}</div>
                    <button
                      type="button"
                      className="addklient-profile-avatar-edit"
                      aria-label="Skift billede"
                    >
                      E
                    </button>
                  </div>
                </div>

                <div className="addklient-form-grid">
                  <div className="addklient-field">
                    <label htmlFor="fornavn">Fornavn</label>
                    <input
                      type="text"
                      id="fornavn"
                      name="fornavn"
                      value={formData.fornavn}
                      onChange={handleChange}
                      className="addklient-input"
                      placeholder="f.eks. Peter"
                      required
                      disabled={isSaving}
                    />
                  </div>
                  <div className="addklient-field">
                    <label htmlFor="efternavn">Efternavn</label>
                    <input
                      type="text"
                      id="efternavn"
                      name="efternavn"
                      value={formData.efternavn}
                      onChange={handleChange}
                      className="addklient-input"
                      placeholder="f.eks. Andersen"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="addklient-form-grid">
                  <div className="addklient-field">
                    <label htmlFor="email">E-mail</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="addklient-input"
                      placeholder="example@domain.com"
                      required
                      disabled={isSaving}
                    />
                  </div>
                  <div className="addklient-field">
                    <label htmlFor="telefon">Telefon</label>
                    <div className="addklient-phone-group">
                      <select
                        name="telefonLand"
                        value={formData.telefonLand}
                        onChange={handleChange}
                        className="addklient-phone-country"
                        disabled={isSaving}
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
                        placeholder="f.eks. +1234 567 890"
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>

                <div className="addklient-form-grid">
                  <div className="addklient-field">
                    <label htmlFor="cpr">CPR</label>
                    <input
                      type="text"
                      id="cpr"
                      name="cpr"
                      value={formData.cpr}
                      onChange={handleChange}
                      className="addklient-input"
                      disabled={isSaving}
                    />
                  </div>
                  <div className="addklient-field">
                    <label htmlFor="foedselsdag">Fødselsdag</label>
                    <input
                      type="text"
                      id="foedselsdag"
                      name="foedselsdag"
                      value={formData.foedselsdag}
                      onChange={handleChange}
                      className="addklient-input"
                      placeholder="Dag og måned"
                      disabled={isSaving}
                    />
                  </div>
                  <div className="addklient-field">
                    <label htmlFor="foedselsaar">År</label>
                    <input
                      type="text"
                      id="foedselsaar"
                      name="foedselsaar"
                      value={formData.foedselsaar}
                      onChange={handleChange}
                      className="addklient-input"
                      placeholder="År"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="addklient-form-grid">
                  <div className="addklient-field">
                    <label htmlFor="koen">Køn</label>
                    <select
                      id="koen"
                      name="koen"
                      value={formData.koen}
                      onChange={handleChange}
                      className="addklient-select"
                      disabled={isSaving}
                    >
                      <option value="">Vælg en mulighed</option>
                      <option value="kvinde">Kvinde</option>
                      <option value="mand">Mand</option>
                      <option value="andet">Andet</option>
                      <option value="vil-ikke-oplyse">Vil ikke oplyse</option>
                    </select>
                  </div>
                  <div className="addklient-field">
                    <label htmlFor="pronomer">Pronomen</label>
                    <select
                      id="pronomer"
                      name="pronomer"
                      value={formData.pronomer}
                      onChange={handleChange}
                      className="addklient-select"
                      disabled={isSaving}
                    >
                      <option value="">Vælg en mulighed</option>
                      <option value="hun-hende">Hun/hende</option>
                      <option value="han-ham">Han/ham</option>
                      <option value="de-dem">De/dem</option>
                    </select>
                  </div>
                </div>

                <div className="addklient-section">
                  <div className="addklient-section-header">
                    <h4>Adresse</h4>
                    <p>Administrer kundens adresseoplysninger.</p>
                  </div>
                  <div className="addklient-form-section">
                    <label className="addklient-form-label" htmlFor="adresse">
                      Adresse
                    </label>
                    {isAutocompleteReady ? (
                      <Autocomplete
                        onLoad={(autocomplete) => (autocompleteRef.current = autocomplete)}
                        onPlaceChanged={handlePlaceChanged}
                      >
                        <input {...addressInputProps} disabled={isSaving} />
                      </Autocomplete>
                    ) : (
                      <>
                        <input {...addressInputProps} disabled={isSaving} />
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
                        disabled={isSaving}
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
                        disabled={isSaving}
                      />
                    )}
                  </div>
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
                        disabled={isSaving}
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
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>

                <div className="addklient-section">
                  <div className="addklient-section-header">
                    <h4>Yderligere oplysninger</h4>
                    <p>Administer din kundes oplysninger.</p>
                  </div>
                  <div className="addklient-form-grid">
                    <div className="addklient-field">
                      <label htmlFor="kundekilde">Kundekilde</label>
                      <select
                        id="kundekilde"
                        name="kundekilde"
                        value={formData.kundekilde}
                        onChange={handleChange}
                        className="addklient-select"
                        disabled={isSaving}
                      >
                        <option value="">Vælg en mulighed</option>
                        <option value="ind-fra-gaden">Ind fra gaden</option>
                        <option value="sociale-medier">Sociale medier</option>
                        <option value="anbefaling">Anbefaling</option>
                        <option value="annoncer">Annoncer</option>
                      </select>
                    </div>
                    <div className="addklient-field">
                      <label htmlFor="henvistAf">Henvist af</label>
                      <div className="addklient-inline-input">
                        <input
                          type="text"
                          id="henvistAf"
                          name="henvistAf"
                          value={formData.henvistAf}
                          onChange={handleChange}
                          className="addklient-input"
                          placeholder="Vælg en kunde"
                          disabled={isSaving}
                        />
                        <button type="button" className="addklient-inline-btn">
                          Tilføj
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="addklient-modal-overlay" onClick={handleCancel}>
      <div className="addklient-modal" onClick={(e) => e.stopPropagation()}>
        <div className="addklient-modal-header">
          <h2 className="addklient-modal-title">
            {mode === 'edit' && editView === 'personal'
              ? 'Ændre klientoplysninger'
              : mode === 'edit' && editView === 'forloeb'
              ? 'Tilføj forløbsoplysninger'
              : 'Tilføj klient'}
          </h2>
          <button className="addklient-close-btn" onClick={handleCancel}>
            ×
          </button>
        </div>

        <form className="addklient-form" onSubmit={handleSubmit}>
          {mode === 'edit' && editView === 'forloeb' ? (
            <>
              {isLoadingClientensOplysninger && (
                <p className="addklient-status-hint">Henter klientens oplysninger…</p>
              )}

              <div className="addklient-form-section">
                <label className="addklient-form-label" htmlFor="diagnose">
                  Diagnose
                </label>
                <input
                  type="text"
                  id="diagnose"
                  name="diagnose"
                  value={clientensOplysninger.diagnose}
                  onChange={handleClientensOplysningerChange}
                  className="addklient-input"
                  disabled={isSaving || isLoadingClientensOplysninger}
                />
              </div>

              <div className="addklient-form-section">
                <label className="addklient-form-label" htmlFor="foersteKonsultation">
                  Førstekonsultation
                </label>
                <textarea
                  id="foersteKonsultation"
                  name="foersteKonsultation"
                  value={clientensOplysninger.foersteKonsultation}
                  onChange={handleClientensOplysningerChange}
                  className="addklient-textarea"
                  disabled={isSaving || isLoadingClientensOplysninger}
                />
              </div>

              <div className="addklient-form-section">
                <label className="addklient-form-label" htmlFor="tilknyttetTerapeut">
                  Tilknyttet terapeut
                </label>
                <input
                  type="text"
                  id="tilknyttetTerapeut"
                  name="tilknyttetTerapeut"
                  value={clientensOplysninger.tilknyttetTerapeut}
                  onChange={handleClientensOplysningerChange}
                  className="addklient-input"
                  disabled={isSaving || isLoadingClientensOplysninger}
                />
              </div>

              <div className="addklient-form-section">
                <label className="addklient-form-label" htmlFor="maalForForloebet">
                  Mål for forløbet
                </label>
                <textarea
                  id="maalForForloebet"
                  name="maalForForloebet"
                  value={clientensOplysninger.maalForForloebet}
                  onChange={handleClientensOplysningerChange}
                  className="addklient-textarea"
                  disabled={isSaving || isLoadingClientensOplysninger}
                />
              </div>

              <div className="addklient-form-row">
                <div className="addklient-form-section addklient-form-section-half">
                  <label className="addklient-form-label" htmlFor="startdato">
                    Startdato
                  </label>
                  <input
                    type="date"
                    id="startdato"
                    name="startdato"
                    value={clientensOplysninger.startdato}
                    onChange={handleClientensOplysningerChange}
                    className="addklient-input"
                    disabled={isSaving || isLoadingClientensOplysninger}
                  />
                </div>
                <div className="addklient-form-section addklient-form-section-half">
                  <label className="addklient-form-label" htmlFor="forventetSlutdato">
                    Forventet slutdato
                  </label>
                  <input
                    type="date"
                    id="forventetSlutdato"
                    name="forventetSlutdato"
                    value={clientensOplysninger.forventetSlutdato}
                    onChange={handleClientensOplysningerChange}
                    className="addklient-input"
                    disabled={isSaving || isLoadingClientensOplysninger}
                  />
                </div>
              </div>
            </>
          ) : mode === 'edit' && editView === 'personal' ? (
            <>
              {isLoadingClientensOplysninger && (
                <p className="addklient-status-hint">Henter klientens oplysninger…</p>
              )}

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
                  disabled={isSaving || isLoadingClientensOplysninger}
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
                  disabled={isSaving || isLoadingClientensOplysninger}
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
                  disabled={isSaving || isLoadingClientensOplysninger}
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
                    disabled={isSaving || isLoadingClientensOplysninger}
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
                    disabled={isSaving || isLoadingClientensOplysninger}
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
                    <input {...addressInputProps} disabled={isSaving || isLoadingClientensOplysninger} />
                  </Autocomplete>
                ) : (
                  <>
                    <input {...addressInputProps} disabled={isSaving || isLoadingClientensOplysninger} />
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
                    disabled={isSaving || isLoadingClientensOplysninger}
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
                    disabled={isSaving || isLoadingClientensOplysninger}
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
                    disabled={isSaving || isLoadingClientensOplysninger}
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
                    disabled={isSaving || isLoadingClientensOplysninger}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

          {/* Error Message */}
          {saveError && (
            <p className="addklient-error" role="alert">
              {saveError}
            </p>
          )}

          {/* Action Buttons */}
          <div className="addklient-form-actions">
            {mode === 'edit' && (
              <button
                type="button"
                className="addklient-delete-btn"
                onClick={handleDelete}
                disabled={isSaving}
              >
                Slet klient
              </button>
            )}
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
              disabled={isSaving || (mode === 'edit' && isLoadingClientensOplysninger)}
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
