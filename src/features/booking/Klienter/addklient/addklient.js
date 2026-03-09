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

const normalizeDigits = (value) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : '';

const isValidDateParts = (day, month, year) => {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const resolveCprBirthYear = (yy, serialFirstDigit) => {
  const currentYear = new Date().getFullYear();
  const serial = Number(serialFirstDigit);

  if (!Number.isInteger(serial)) {
    const year2000 = 2000 + yy;
    return year2000 <= currentYear ? year2000 : 1900 + yy;
  }

  if (serial >= 0 && serial <= 3) {
    return 1900 + yy;
  }

  if (serial === 4 || serial === 9) {
    if (yy <= 36) {
      const year2000 = 2000 + yy;
      return year2000 <= currentYear ? year2000 : 1900 + yy;
    }
    return 1900 + yy;
  }

  if (serial >= 5 && serial <= 8) {
    if (yy <= 57) {
      const year2000 = 2000 + yy;
      return year2000 <= currentYear ? year2000 : 1800 + yy;
    }
    return 1800 + yy;
  }

  const year2000 = 2000 + yy;
  return year2000 <= currentYear ? year2000 : 1900 + yy;
};

const extractBirthFieldsFromCpr = (value) => {
  const digits = normalizeDigits(value);
  if (digits.length < 6) {
    return null;
  }

  const dayText = digits.slice(0, 2);
  const monthText = digits.slice(2, 4);
  const yearText = digits.slice(4, 6);

  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const serialFirstDigit = digits.length >= 7 ? digits[6] : undefined;
  const fullYear = resolveCprBirthYear(year, serialFirstDigit);

  if (!isValidDateParts(day, month, fullYear)) {
    return null;
  }

  return {
    foedselsdag: `${dayText}-${monthText}`,
    foedselsaar: String(fullYear),
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
    kundekilde: '',
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
      kundekilde: initialClient.clientensoplysninger?.kundekilde || initialClient.kundekilde || '',
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
  const [foedselsdagPlaceholder, setFoedselsdagPlaceholder] = useState('DD-MM');
  const [foedselsaarPlaceholder, setFoedselsaarPlaceholder] = useState('YYYY');
  const { user, workspaceUid, activeClinicId } = useAuth();
  const clinicId = `${activeClinicId || ''}`.trim();
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

    if (name === 'cpr') {
      const normalizedCpr = normalizeDigits(value);
      const derivedBirthFields = extractBirthFieldsFromCpr(value);

      setFormData((prev) => ({
        ...prev,
        cpr: value,
        ...(derivedBirthFields
          ? {
              foedselsdag: derivedBirthFields.foedselsdag,
              foedselsaar: derivedBirthFields.foedselsaar,
            }
          : normalizedCpr.length < 6
          ? {
              foedselsdag: '',
              foedselsaar: '',
            }
          : {}),
      }));

      if (derivedBirthFields) {
        setFoedselsdagPlaceholder('');
        setFoedselsaarPlaceholder('');
      } else if (normalizedCpr.length < 6) {
        setFoedselsdagPlaceholder('DD-MM');
        setFoedselsaarPlaceholder('YYYY');
      }

      return;
    }
    
    // Handle placeholder fade for birth date fields
    if (name === 'foedselsdag') {
      if (value.length === 0) {
        setFoedselsdagPlaceholder('DD-MM');
      } else {
        // Show remaining characters from the start
        const remainingPlaceholder = 'DD-MM'.slice(value.length);
        setFoedselsdagPlaceholder(remainingPlaceholder);
      }
    } else if (name === 'foedselsaar') {
      if (value.length === 0) {
        setFoedselsaarPlaceholder('YYYY');
      } else {
        // Show remaining characters from the start
        const remainingPlaceholder = 'YYYY'.slice(value.length);
        setFoedselsaarPlaceholder(remainingPlaceholder);
      }
    }
    
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
  
  const handleBirthDateFocus = (field) => {
    if (field === 'foedselsdag') {
      if (!formData.foedselsdag) {
        setFoedselsdagPlaceholder('DD-MM');
      } else {
        setFoedselsdagPlaceholder('DD-MM'.slice(formData.foedselsdag.length));
      }
    } else if (field === 'foedselsaar') {
      if (!formData.foedselsaar) {
        setFoedselsaarPlaceholder('YYYY');
      } else {
        setFoedselsaarPlaceholder('YYYY'.slice(formData.foedselsaar.length));
      }
    }
  };
  
  const handleBirthDateBlur = (field) => {
    if (field === 'foedselsdag') {
      if (!formData.foedselsdag) {
        setFoedselsdagPlaceholder('DD-MM');
      }
    } else if (field === 'foedselsaar') {
      if (!formData.foedselsaar) {
        setFoedselsaarPlaceholder('YYYY');
      }
    }
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
    // Reset placeholders
    setFoedselsdagPlaceholder('DD-MM');
    setFoedselsaarPlaceholder('YYYY');
  }, [mode, initialClient]);

  useEffect(() => {
    if (mode !== 'edit') {
      setIsLoadingClientensOplysninger(false);
      return;
    }

    if ((!clinicId && !workspaceUid) || !clientId) {
      setSaveError('Manglende klient-id – kunne ikke hente klientens oplysninger.');
      setIsLoadingClientensOplysninger(false);
      return;
    }

    let cancelled = false;

    const loadClientData = async () => {
      setIsLoadingClientensOplysninger(true);
      setSaveError('');

      try {
        const clientRef = clinicId
          ? doc(db, 'clinics', clinicId, 'clients', clientId)
          : doc(db, 'users', workspaceUid, 'clients', clientId);
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

          // Split name into first and last name if not already split
          const nameParts = splitNameParts(data.navn || '');

          setFormData({
            navn: data.navn || '',
            fornavn: data.fornavn || nameParts.fornavn,
            efternavn: data.efternavn || nameParts.efternavn,
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
            foedselsdag: data.foedselsdag || '',
            foedselsaar: data.foedselsaar || '',
            kundekilde: data.clientensoplysninger?.kundekilde || data.kundekilde || '',
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
  }, [clinicId, clientId, editView, mode, workspaceUid]);

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

    if (!user || (!clinicId && !workspaceUid)) {
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

        const clientRef = clinicId
          ? doc(db, 'clinics', clinicId, 'clients', clientId)
          : doc(db, 'users', workspaceUid, 'clients', clientId);

        if (editView === 'personal') {
          // Save personal information
          const { telefonLand, telefon, land, kundekilde, ...restFormData } = normalizedFormData;
          const telefonLandValue = (telefonLand || '+45').trim();
          const telefonValue = (telefon || '').trim();

          await updateDoc(clientRef, {
            ...restFormData,
            land: land || 'Danmark',
            telefonLand: telefonLandValue,
            telefon: telefonValue,
            telefonKomplet: telefonValue ? `${telefonLandValue} ${telefonValue}` : '',
            status: formData.status || 'Aktiv',
            'clientensoplysninger.kundekilde': kundekilde || '',
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
      const { telefonLand, telefon, land, kundekilde, ...restFormData } = normalizedFormData;
      const telefonLandValue = (telefonLand || '+45').trim();
      const telefonValue = (telefon || '').trim();

      const clientPayload = {
        ...restFormData,
        land: land || 'Danmark',
        telefonLand: telefonLandValue,
        telefon: telefonValue,
        telefonKomplet: telefonValue ? `${telefonLandValue} ${telefonValue}` : '',
        clinicId: clinicId || null,
        ownerUid: workspaceUid || null,
        ownerEmail: user.email ?? null,
        ownerIdentifier,
        createdByUid: user.uid || null,
        status: formData.status || 'Aktiv',
        clientensoplysninger: {
          kundekilde: kundekilde || '',
        },
        updatedAt: serverTimestamp(),
        ...(mode === 'create'
          ? {
              createdAt: serverTimestamp(),
              createdAtIso: nowIso,
            }
          : {}),
      };

      if (mode === 'create') {
        const clientsCollection = clinicId
          ? collection(db, 'clinics', clinicId, 'clients')
          : collection(db, 'users', workspaceUid, 'clients');
        const clientPath = clinicId
          ? `clinics/${clinicId}/clients`
          : `users/${workspaceUid}/clients`;
        const docRef = await addDoc(clientsCollection, clientPayload);
        if (isDev) {
          console.log('[AddKlient] Created client', {
            path: clientPath,
            uid: clinicId || workspaceUid,
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
          path: clinicId
            ? `clinics/${clinicId}/clients`
            : workspaceUid
            ? `users/${workspaceUid}/clients`
            : 'unknown',
          uid: clinicId || workspaceUid || 'unknown',
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
    if ((!clinicId && !workspaceUid) || !clientId) return;
    const confirmed = window.confirm(
      'Er du sikker på, at du vil slette denne klient? Dette kan ikke fortrydes.'
    );
    if (!confirmed) return;

    try {
      const clientRef = clinicId
        ? doc(db, 'clinics', clinicId, 'clients', clientId)
        : doc(db, 'users', workspaceUid, 'clients', clientId);
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

  if (mode === 'create' || (mode === 'edit' && editView === 'personal')) {
    const initialsSource = `${formData.fornavn || ''} ${formData.efternavn || ''}`.trim() ||
      formData.navn ||
      '?';
    const initials = initialsSource
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    
    const isFormDisabled = isSaving || (mode === 'edit' && isLoadingClientensOplysninger);

    return (
      <div className="addklient-modal-overlay" onClick={handleCancel}>
        <div
          className="addklient-modal addklient-modal-create"
          onClick={(e) => e.stopPropagation()}
        >
          <form className="addklient-form addklient-form-create" onSubmit={handleSubmit}>
            <div className="addklient-create-header">
              <h2 className="addklient-create-title">
                {mode === 'edit' ? 'Rediger klient' : 'Tilføj en ny kunde'}
              </h2>
              <div className="addklient-create-actions">
                {mode === 'edit' && (
                  <button
                    type="button"
                    className="addklient-create-btn addklient-create-btn-danger"
                    onClick={handleDelete}
                    disabled={isFormDisabled}
                  >
                    Slet klient
                  </button>
                )}
                <button
                  type="button"
                  className="addklient-create-btn addklient-create-btn-secondary"
                  onClick={handleCancel}
                  disabled={isFormDisabled}
                >
                  Luk
                </button>
                <button
                  type="submit"
                  className="addklient-create-btn addklient-create-btn-primary"
                  disabled={isFormDisabled}
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
                      disabled={isFormDisabled}
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
                      disabled={isFormDisabled}
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
                      disabled={isFormDisabled}
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
                        disabled={isFormDisabled}
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
                        disabled={isFormDisabled}
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
                      disabled={isFormDisabled}
                    />
                  </div>
                  <div className="addklient-field">
                    <label htmlFor="foedselsdag">Fødselsdag</label>
                    <div className="addklient-input-wrapper">
                      <input
                        type="text"
                        id="foedselsdag"
                        name="foedselsdag"
                        value={formData.foedselsdag}
                        onChange={handleChange}
                        onFocus={() => handleBirthDateFocus('foedselsdag')}
                        onBlur={() => handleBirthDateBlur('foedselsdag')}
                        className="addklient-input"
                        placeholder=""
                        disabled={isFormDisabled}
                        maxLength={5}
                      />
                      {foedselsdagPlaceholder && (
                        <span 
                          className="addklient-placeholder-overlay"
                          style={{ 
                            left: `${12 + (formData.foedselsdag ? formData.foedselsdag.length * 8.4 : 0)}px` 
                          }}
                        >
                          {foedselsdagPlaceholder}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="addklient-field">
                    <label htmlFor="foedselsaar">År</label>
                    <div className="addklient-input-wrapper">
                      <input
                        type="text"
                        id="foedselsaar"
                        name="foedselsaar"
                        value={formData.foedselsaar}
                        onChange={handleChange}
                        onFocus={() => handleBirthDateFocus('foedselsaar')}
                        onBlur={() => handleBirthDateBlur('foedselsaar')}
                        className="addklient-input"
                        placeholder=""
                        disabled={isFormDisabled}
                        maxLength={4}
                      />
                      {foedselsaarPlaceholder && (
                        <span 
                          className="addklient-placeholder-overlay"
                          style={{ 
                            left: `${12 + (formData.foedselsaar ? formData.foedselsaar.length * 8.4 : 0)}px` 
                          }}
                        >
                          {foedselsaarPlaceholder}
                        </span>
                      )}
                    </div>
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
                        disabled={isFormDisabled}
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
                        disabled={isFormDisabled}
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
                        disabled={isFormDisabled}
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
                        disabled={isFormDisabled}
                      />
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
          <div className="addklient-create-actions">
            {mode === 'edit' && (
              <button
                type="button"
                className="addklient-create-btn addklient-create-btn-danger"
                onClick={handleDelete}
                disabled={isSaving || isLoadingClientensOplysninger}
              >
                Slet klient
              </button>
            )}
            <button
              type="button"
              className="addklient-create-btn addklient-create-btn-secondary"
              onClick={handleCancel}
              disabled={isSaving || (mode === 'edit' && isLoadingClientensOplysninger)}
            >
              Luk
            </button>
            <button
              type="submit"
              className="addklient-create-btn addklient-create-btn-primary"
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
