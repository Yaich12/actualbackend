import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import './usersettings.css';
import './bookingpage.css';
import { BookingSidebarLayout } from '../../components/ui/BookingSidebarLayout';
import { auth, db, storage } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { updateProfile } from 'firebase/auth';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import Transfer from './transfer/transfer';
import {
  WORK_HOURS_DAYS,
  buildWorkHoursPayload,
  createDefaultWorkHours,
  getWorkHoursValidation,
  resolveWorkHours,
} from '../../utils/workHours';
import { CORTI_LANGS, getCortiLanguageLabel } from '../../utils/cortiLanguages';

const THEME_STORAGE_KEY = 'selma_theme_mode';
const NIGHT_START_HOUR = 18; // 18:00
const NIGHT_END_HOUR = 5;    // 05:00

const CATEGORY_OPTIONS = ['Physiotherapist', 'Osteopath', 'Chiropractor'];
const CURRENCY_OPTIONS = [
  { value: 'DKK', label: 'DKK' },
  { value: 'EUR', label: 'EURO' },
  { value: 'USD', label: 'USD' },
  { value: 'NOK', label: 'NOK' },
  { value: 'SEK', label: 'SEK' },
  { value: 'AED', label: 'AED' },
];

function UserSettings() {
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, preferredLanguage, setPreferredLanguage, languageOptions, t } = useLanguage();
  const resolveSectionFromPath = (pathname) => {
    if (pathname.startsWith('/settings/transfer')) {
      return 'transfer';
    }
    return 'profile';
  };
  const [activeSection, setActiveSection] = useState(() =>
    resolveSectionFromPath(location.pathname)
  ); // profile | account | workHours | appearance | language | ai | transfer
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [publicClinicName, setPublicClinicName] = useState('');
  const [publicClinicSlug, setPublicClinicSlug] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [workHours, setWorkHours] = useState(() => createDefaultWorkHours());
  const [colorMode, setColorMode] = useState('system');
  const [audioRetention, setAudioRetention] = useState('30d');
  const [transcriptRetention, setTranscriptRetention] = useState('30d');
  const [agentCommsRetention, setAgentCommsRetention] = useState('30d');
  const [dictationLanguage, setDictationLanguage] = useState('auto');
  const [settingsSnapshot, setSettingsSnapshot] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isClaimingSlug, setIsClaimingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null);

  const sanitizeSlug = (value) => {
    if (!value) return '';
    const normalized = String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized.slice(0, 40);
  };

  const previewSlug = useMemo(() => sanitizeSlug(clinicName), [clinicName]);

  const previewUrl = previewSlug ? `/book/${previewSlug}` : '';
  const defaultWorkHours = useMemo(() => createDefaultWorkHours(), []);
  const workHoursErrors = useMemo(
    () => getWorkHoursValidation(workHours),
    [workHours]
  );
  const hasWorkHoursErrors = Object.keys(workHoursErrors).length > 0;
  const workHoursDayLabels = useMemo(
    () => ({
      monday: t('settings.workHours.days.monday', 'Mandag'),
      tuesday: t('settings.workHours.days.tuesday', 'Tirsdag'),
      wednesday: t('settings.workHours.days.wednesday', 'Onsdag'),
      thursday: t('settings.workHours.days.thursday', 'Torsdag'),
      friday: t('settings.workHours.days.friday', 'Fredag'),
      saturday: t('settings.workHours.days.saturday', 'Lørdag'),
      sunday: t('settings.workHours.days.sunday', 'Søndag'),
    }),
    [t]
  );
  const workHoursErrorMessages = useMemo(
    () => ({
      missing: t('settings.workHours.errors.missing', 'Angiv start og slut'),
      order: t('settings.workHours.errors.order', 'Starttid skal være før sluttid'),
    }),
    [t]
  );
  const dictationLanguageOptions = useMemo(
    () => CORTI_LANGS.map((locale) => ({ value: locale, label: getCortiLanguageLabel(locale) })),
    []
  );

  const applyTheme = (mode) => {
    let resolvedMode = mode;

    if (mode === 'system') {
      const hour = new Date().getHours();
      const isNight = hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
      resolvedMode = isNight ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', resolvedMode);
  };

  useEffect(() => {
    const storedMode = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
      setColorMode(storedMode);
      applyTheme(storedMode);
    } else {
      applyTheme('system');
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setSettingsSnapshot(data.settings || {});
          setFullName(data.displayName || user.displayName || '');
          setEmail(data.email || user.email || '');
          setClinicName(data.clinicName || '');
          setPublicClinicName(data.publicClinicName || data.clinicName || '');
          setPublicClinicSlug(data.publicClinicSlug || '');
          setWebsite(data.website || '');
          setPhotoURL(data.photoURL || user.photoURL || '');
          setAvatarPreviewUrl('');
          setAvatarFile(null);
          setRemoveAvatar(false);
          const loadedCategory =
            (Array.isArray(data.categories) && data.categories[0]) ||
            data.category ||
            '';
          setCategory(loadedCategory || '');
          setAddress(data.address || '');
          const loadedCurrency =
            (typeof data.currency === 'string' && data.currency.trim()) ||
            (typeof data.settings?.currency === 'string' && data.settings.currency.trim()) ||
            '';
          setCurrency(loadedCurrency);
          setWorkHours(resolveWorkHours(data));
          const storedDictationLanguage =
            typeof data.settings?.dictationLanguage === 'string' && data.settings.dictationLanguage.trim()
              ? data.settings.dictationLanguage.trim()
              : 'auto';
          setDictationLanguage(storedDictationLanguage);
          if (data.themeMode === 'light' || data.themeMode === 'dark' || data.themeMode === 'system') {
            setColorMode(data.themeMode);
            applyTheme(data.themeMode);
            localStorage.setItem(THEME_STORAGE_KEY, data.themeMode);
          }
        } else {
          setSettingsSnapshot({});
          setFullName(user.displayName || '');
          setEmail(user.email || '');
          setClinicName('');
          setPublicClinicName('');
          setPublicClinicSlug('');
          setWebsite('');
          setPhotoURL(user.photoURL || '');
          setAvatarPreviewUrl('');
          setAvatarFile(null);
          setRemoveAvatar(false);
          setCategory('');
          setAddress('');
          setCurrency('');
          setWorkHours(createDefaultWorkHours());
          setDictationLanguage('auto');
        }
      } catch (error) {
        console.error('[UserSettings] Failed to load profile', error);
      }
    };

    loadProfile();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) {
      setAudioRetention('30d');
      setTranscriptRetention('30d');
      setAgentCommsRetention('30d');
      return;
    }

    const loadAiSettings = async () => {
      try {
        const settingsRef = doc(db, 'users', user.uid, 'settings', 'aiSettings');
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data() || {};
          setAudioRetention(data.audioRetention || '30d');
          setTranscriptRetention(data.transcriptRetention || '30d');
          setAgentCommsRetention(data.agentCommsRetention || '30d');
          return;
        }
        setAudioRetention('30d');
        setTranscriptRetention('30d');
        setAgentCommsRetention('30d');
      } catch (error) {
        console.error('[UserSettings] Failed to load AI settings', error);
      }
    };

    loadAiSettings();
  }, [user?.uid]);

  useEffect(() => {
    setSettingsSnapshot((prev) => ({ ...prev, dictationLanguage }));
  }, [dictationLanguage]);

  const handleSaveAiSettings = async () => {
    if (!user?.uid) return;
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'aiSettings');
    const payload = {
      audioRetention: audioRetention || '30d',
      transcriptRetention: transcriptRetention || '30d',
      agentCommsRetention: agentCommsRetention || '30d',
      updatedAt: serverTimestamp(),
    };
    await setDoc(settingsRef, payload, { merge: true });
  };

  useEffect(() => {
    applyTheme(colorMode);
    localStorage.setItem(THEME_STORAGE_KEY, colorMode);
  }, [colorMode]);

  useEffect(() => {
    if (location.pathname.startsWith('/settings/transfer')) {
      setActiveSection('transfer');
    }
  }, [location.pathname]);

  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (section === 'transfer') {
      if (!location.pathname.startsWith('/settings/transfer')) {
        navigate('/settings/transfer');
      }
      return;
    }
    if (location.pathname.startsWith('/settings/transfer')) {
      navigate('/booking/settings');
    }
  };

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    if (colorMode !== 'system') return;

    const update = () => applyTheme('system');
    update();
    const intervalId = setInterval(update, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [colorMode]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (hasWorkHoursErrors) {
      return;
    }
    setIsSaving(true);
    try {
      const jobTitleForSave = category || '';
      const ref = doc(db, 'users', user.uid);

      let resolvedPhotoURL = photoURL || '';
      if (removeAvatar) {
        resolvedPhotoURL = '';
      }

      if (avatarFile) {
        setIsAvatarUploading(true);
        const ext = avatarFile.name?.split('.').pop() || 'jpg';
        const path = `userprofilepictures/${user.uid}/avatar-${Date.now()}.${ext}`;
        const uploadRef = storageRef(storage, path);
        await uploadBytes(uploadRef, avatarFile, { contentType: avatarFile.type || 'image/jpeg' });
        resolvedPhotoURL = await getDownloadURL(uploadRef);
        setIsAvatarUploading(false);
        setAvatarFile(null);
        setRemoveAvatar(false);
        setAvatarPreviewUrl('');
        setPhotoURL(resolvedPhotoURL);
      }

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: fullName || auth.currentUser.displayName || null,
          photoURL: resolvedPhotoURL || null,
        });
      }

      // Best-effort sync with legacy helper (keeps other parts of the app consistent).
      try {
        await updateUserProfile({ fullName, jobTitle: jobTitleForSave });
      } catch (error) {
        console.error('[UserSettings] Failed to sync auth profile helper', error);
      }

      const updatePayload = {
        themeMode: colorMode,
        displayName: fullName,
        photoURL: resolvedPhotoURL || null,
        jobTitle: jobTitleForSave,
        clinicName,
        website,
        categories: category ? [category] : [],
        address,
        workHours: buildWorkHoursPayload(workHours),
        preferredLanguage: preferredLanguage || language,
        settings: {
          ...settingsSnapshot,
          dictationLanguage: dictationLanguage || 'auto',
        },
        updatedAt: serverTimestamp(),
      };

      if (currency) {
        updatePayload.currency = currency;
      }

      await setDoc(ref, updatePayload, { merge: true });

      if (activeSection === 'ai') {
        await handleSaveAiSettings();
      }
    } catch (error) {
      console.error('[UserSettings] Failed to save profile', error);
    } finally {
      setIsAvatarUploading(false);
      setIsSaving(false);
    }
  };

  const handleClaimSlug = async () => {
    if (!user?.uid) return;
    const nameValue = (clinicName || '').trim();
    const sanitizedSlug = sanitizeSlug(clinicName);

    if (!nameValue) {
      setSlugStatus({
        tone: 'error',
        message: t('settings.publicBooking.errors.missingName', 'Angiv et kliniknavn.'),
      });
      return;
    }

    if (!sanitizedSlug) {
      setSlugStatus({
        tone: 'error',
        message: t(
          'settings.publicBooking.errors.missingSlug',
          'Kunne ikke generere et clinic slug.'
        ),
      });
      return;
    }

    setIsClaimingSlug(true);
    setSlugStatus(null);

    try {
      const clinicRef = doc(db, 'publicClinics', sanitizedSlug);
      const clinicSnap = await getDoc(clinicRef);
      if (clinicSnap.exists()) {
        const data = clinicSnap.data() || {};
        if (data.ownerUid && data.ownerUid !== user.uid) {
          setSlugStatus({
            tone: 'error',
            message: t('settings.publicBooking.errors.slugTaken', 'Slug er optaget. Prøv en anden.'),
          });
          return;
        }
      }

      const clinicPayload = {
        ownerUid: user.uid,
        clinicSlug: sanitizedSlug,
        clinicName: nameValue,
        isActive: true,
        updatedAt: serverTimestamp(),
      };

      if (!clinicSnap.exists()) {
        clinicPayload.createdAt = serverTimestamp();
      }

      await setDoc(clinicRef, clinicPayload, { merge: true });

      const generatedUrl = `/book/${sanitizedSlug}`;

      await setDoc(
        doc(db, 'users', user.uid),
        {
          publicClinicSlug: sanitizedSlug,
          publicClinicName: nameValue,
          website: generatedUrl,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPublicClinicSlug(sanitizedSlug);
      setPublicClinicName(nameValue);
      setWebsite(generatedUrl);
      setSlugStatus({
        tone: 'success',
        message: t(
          'settings.publicBooking.success',
          `Bookingsiden er aktiv: ${generatedUrl}`
        ),
      });
    } catch (error) {
      console.error('[UserSettings] Failed to claim clinic slug', error);
      setSlugStatus({
        tone: 'error',
        message: t('settings.publicBooking.errors.generic', 'Kunne ikke gemme bookingsiden. Prøv igen.'),
      });
    } finally {
      setIsClaimingSlug(false);
    }
  };

  const renderThemeCard = (mode, label, previewClass) => (
    <button
      type="button"
      className={`theme-card ${previewClass} ${colorMode === mode ? 'selected' : ''}`}
      onClick={() => setColorMode(mode)}
    >
      <div className="theme-card-preview" />
      <span className="theme-card-label">{label}</span>
    </button>
  );

  const updateWorkHoursField = (dayKey, field, value) => {
    setWorkHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value,
      },
    }));
  };

  const toggleWorkHoursDay = (dayKey) => {
    setWorkHours((prev) => {
      const current = prev[dayKey] || {};
      const nextEnabled = !current.enabled;
      const defaultDay = defaultWorkHours[dayKey] || {};
      const nextStart = nextEnabled ? current.start || defaultDay.start || '' : current.start;
      const nextEnd = nextEnabled ? current.end || defaultDay.end || '' : current.end;
      return {
        ...prev,
        [dayKey]: {
          ...current,
          enabled: nextEnabled,
          start: nextStart,
          end: nextEnd,
        },
      };
    });
  };

  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        <div className="booking-content">
          {/* Main Content */}
          <div className="usersettings-main">
          <div className="usersettings-page">
            <div className="usersettings-card">
              <div className="usersettings-layout">
                <aside className="usersettings-nav">
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'profile' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('profile')}
                  >
                    {t('settings.sections.profile', 'Profil')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'account' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('account')}
                  >
                    {t('settings.sections.account', 'Kontoopsætning')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'workHours' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('workHours')}
                  >
                    {t('settings.sections.workHours', 'Arbejdstid')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'appearance' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('appearance')}
                  >
                    {t('settings.sections.appearance', 'Appearance')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'language' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('language')}
                  >
                    {t('settings.sections.language', 'Sprog')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'ai' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('ai')}
                  >
                    {t('settings.sections.ai', 'AI indstillinger')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'transfer' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('transfer')}
                  >
                    {t('settings.sections.transfer', 'Transfer')}
                  </button>
                </aside>

                <main className="usersettings-panel">
                  {activeSection === 'profile' && (
                    <>
                      <div className="usersettings-profile-fields">
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.profile.fullName', 'Fulde navn')}
                          </label>
                          <input
                            className="usersettings-input"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder={t(
                              'settings.profile.fullNamePlaceholder',
                              'Indtast dit fulde navn'
                            )}
                          />
                        </div>

                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.profile.email', 'E-mail')}
                          </label>
                          <input className="usersettings-input" value={email} readOnly />
                        </div>

                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.profile.clinicName', 'Kliniknavn')}
                          </label>
                          <input
                            className="usersettings-input"
                            value={clinicName}
                            onChange={(e) => setClinicName(e.target.value)}
                            placeholder={t(
                              'settings.profile.clinicPlaceholder',
                              'Angiv navnet på klinikken'
                            )}
                          />
                        </div>

                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.account.address', 'Adresse')}
                          </label>
                          <input
                            className="usersettings-input"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder={t('settings.account.addressPlaceholder', 'Indtast adresse')}
                          />
                        </div>
                      </div>

                    </>
                  )}

                  {activeSection === 'account' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.account.title', 'Kontoopsætning')}
                        </div>
                      </div>

                      <div className="usersettings-profile-fields">
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.account.website', 'Websted')}
                          </label>
                          <input
                            className="usersettings-input"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder={t('settings.account.websitePlaceholder', 'www.ditwebsted.com')}
                          />
                        </div>

                        <div className="usersettings-divider" />

                        <div className="usersettings-section">
                          <div className="usersettings-title">
                            {t('settings.publicBooking.title', 'Bookingside')}
                          </div>
                          <div className="usersettings-subtitle">
                            {t(
                              'settings.publicBooking.subtitle',
                              'Aktivér en offentlig booking-side til dine klienter.'
                            )}
                          </div>
                        </div>

                        <div className="usersettings-grid">
                          <div className="usersettings-section">
                            <label className="usersettings-label">
                              {t('settings.publicBooking.clinicNameLabel', 'Kliniknavn')}
                            </label>
                            <input
                              className="usersettings-input"
                              value={clinicName}
                              readOnly
                            />
                          </div>
                          <div className="usersettings-section">
                            <label className="usersettings-label">
                              {t('settings.publicBooking.urlLabel', 'Bookingside URL')}
                            </label>
                            <input
                              className="usersettings-input"
                              value={previewUrl}
                              readOnly
                              placeholder={t(
                                'settings.publicBooking.urlPlaceholder',
                                '/book/din-klinik'
                              )}
                            />
                          </div>
                        </div>

                        <div className="usersettings-claim-row">
                          <button
                            type="button"
                            className="usersettings-claim-btn"
                            onClick={handleClaimSlug}
                            disabled={isClaimingSlug || !clinicName.trim()}
                          >
                            {isClaimingSlug
                              ? t('settings.publicBooking.claiming', 'Aktiverer...')
                              : t('settings.publicBooking.activate', 'Aktiver bookingside')}
                          </button>
                          <span className="usersettings-slug-preview">
                            {previewUrl
                              ? t(
                                  'settings.publicBooking.urlPreview',
                                  `URL: ${previewUrl}`
                                )
                              : t('settings.publicBooking.urlPreviewEmpty', 'URL: /book/...')}
                          </span>
                        </div>

                        {slugStatus?.message ? (
                          <div className={`usersettings-status ${slugStatus.tone || ''}`}>
                            {slugStatus.message}
                          </div>
                        ) : null}

                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.account.category', 'Kategori')}
                          </label>
                          <select
                            className="usersettings-input"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                          >
                            <option value="">
                              {t('settings.account.categoryPlaceholder', 'Vælg kategori')}
                            </option>
                            {CATEGORY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                    </>
                  )}

                  {activeSection === 'workHours' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.workHours.title', 'Arbejdstid')}
                        </div>
                        <div className="usersettings-subtitle">
                          {t(
                            'settings.workHours.subtitle',
                            'Angiv hvornår du kan bookes. Du kan justere tiderne når som helst.'
                          )}
                        </div>
                      </div>

                      <div className="usersettings-profile-fields">
                        <div className="usersettings-workhours">
                          {WORK_HOURS_DAYS.map((day) => {
                            const dayData = workHours[day.key] || {};
                            const errorCode = workHoursErrors[day.key];
                            const errorMessage = errorCode ? workHoursErrorMessages[errorCode] : '';
                            const isEnabled = Boolean(dayData.enabled);
                            return (
                              <div
                                key={day.key}
                                className={`usersettings-workhours-row ${
                                  errorCode ? 'has-error' : ''
                                }`}
                              >
                                <div className="usersettings-workhours-day">
                                  <span className="usersettings-workhours-label">
                                    {workHoursDayLabels[day.key] || day.key}
                                  </span>
                                  <label className="usersettings-workhours-toggle">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => toggleWorkHoursDay(day.key)}
                                    />
                                    <span>
                                      {isEnabled
                                        ? t('settings.workHours.open', 'Åben')
                                        : t('settings.workHours.closed', 'Lukket')}
                                    </span>
                                  </label>
                                </div>
                                <div className="usersettings-workhours-time">
                                  <input
                                    type="time"
                                    className={`usersettings-workhours-input ${
                                      errorCode ? 'is-error' : ''
                                    }`}
                                    value={dayData.start || ''}
                                    onChange={(e) =>
                                      updateWorkHoursField(day.key, 'start', e.target.value)
                                    }
                                    disabled={!isEnabled}
                                    aria-invalid={Boolean(errorCode)}
                                  />
                                  <span className="usersettings-workhours-separator">–</span>
                                  <input
                                    type="time"
                                    className={`usersettings-workhours-input ${
                                      errorCode ? 'is-error' : ''
                                    }`}
                                    value={dayData.end || ''}
                                    onChange={(e) =>
                                      updateWorkHoursField(day.key, 'end', e.target.value)
                                    }
                                    disabled={!isEnabled}
                                    aria-invalid={Boolean(errorCode)}
                                  />
                                </div>
                                {errorMessage ? (
                                  <div className="usersettings-workhours-error" role="alert">
                                    {errorMessage}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {activeSection === 'appearance' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.appearance.title', 'Appearance')}
                        </div>
                        <div className="usersettings-subtitle">
                          {t('settings.appearance.subtitle', 'Vælg hvordan Selma skal se ud')}
                        </div>
                      </div>

                      <div className="usersettings-theme-grid">
                        {renderThemeCard('light', t('settings.appearance.light', 'Light'), 'theme-light')}
                        {renderThemeCard('system', t('settings.appearance.system', 'Match system'), 'theme-system')}
                        {renderThemeCard('dark', t('settings.appearance.dark', 'Dark'), 'theme-dark')}
                      </div>
                    </>
                  )}

                  {activeSection === 'language' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.language.title', 'Sprog')}
                        </div>
                      </div>

                      <div className="usersettings-profile-fields">
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.language.label', 'Foretrukket sprog')}
                          </label>
                          <select
                            className="usersettings-input"
                            value={language}
                            onChange={(e) => {
                              void setPreferredLanguage(e.target.value, { persist: false });
                            }}
                          >
                            {languageOptions.map((option) => (
                              <option key={option.code} value={option.code}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.language.dictationLabel', 'Dictation language')}
                          </label>
                          <select
                            className="usersettings-input"
                            value={dictationLanguage}
                            onChange={(e) => setDictationLanguage(e.target.value)}
                          >
                            <option value="auto">
                              {t('settings.language.dictationAuto', 'Auto (recommended)')}
                            </option>
                            {dictationLanguageOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.currency.label', 'Valuta')}
                          </label>
                          <select
                            className="usersettings-input"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                          >
                            <option value="">
                              {t('settings.currency.placeholder', 'Vælg valuta')}
                            </option>
                            {CURRENCY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {activeSection === 'ai' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.ai.title', 'AI indstillinger')}
                        </div>
                      </div>

                      <div className="usersettings-profile-fields">
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.ai.audio.title', 'Lydoptagelse')}
                          </label>
                          <p className="usersettings-subtitle">
                            {t(
                              'settings.ai.audio.description',
                              'Selve lyden som optaget af mikrofonen. Lydfilen kan være hjælpsom, hvis vi efterfølgende skal ind og høre efter, om der er bestemte ord, udtaler eller dialekter vi misforstår.'
                            )}
                          </p>
                          <select
                            className="usersettings-input"
                            value={audioRetention}
                            onChange={(e) => setAudioRetention(e.target.value)}
                          >
                            <option value="immediate">
                              {t('settings.ai.retention.immediate', 'Slet med det samme')}
                            </option>
                            <option value="30d">
                              {t('settings.ai.retention.30d', 'Gem 30 dage')}
                            </option>
                          </select>
                        </div>

                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.ai.transcript.title', 'Transkription')}
                          </label>
                          <p className="usersettings-subtitle">
                            {t(
                              'settings.ai.transcript.description',
                              'Tekstudgaven af hvad systemet har "hørt". Vi har brug for transkriptionen, hvis vi skal hjælpe dig med "redningsforsøg", hvis en optagelse afbrydes, eller hvis der opstår andre tekniske problemer.'
                            )}
                          </p>
                          <select
                            className="usersettings-input"
                            value={transcriptRetention}
                            onChange={(e) => setTranscriptRetention(e.target.value)}
                          >
                            <option value="immediate">
                              {t('settings.ai.retention.immediate', 'Slet med det samme')}
                            </option>
                            <option value="30d">
                              {t('settings.ai.retention.30d', 'Gem 30 dage')}
                            </option>
                          </select>
                        </div>

                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.ai.agentComms.title', 'AI-genereret kommunikation')}
                          </label>
                          <p className="usersettings-subtitle">
                            {t(
                              'settings.ai.agentComms.description',
                              'Tekst og svar der bliver genereret i dialogen med vores AI-agenter (fx forslag til journalnotat, opsummeringer og anbefalinger). Gemning kan være nyttig, hvis du vil kunne genfinde tidligere samtaler, dokumentere beslutningsgrundlag eller fortsætte et igangværende forløb.'
                            )}
                          </p>
                          <select
                            className="usersettings-input"
                            value={agentCommsRetention}
                            onChange={(e) => setAgentCommsRetention(e.target.value)}
                          >
                            <option value="immediate">
                              {t('settings.ai.retention.immediate', 'Slet med det samme')}
                            </option>
                            <option value="30d">
                              {t('settings.ai.retention.30d', 'Gem 30 dage')}
                            </option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {activeSection === 'transfer' && <Transfer />}
                </main>
              </div>
              <div className="usersettings-actions">
                <button
                  type="button"
                  className="usersettings-top-btn ghost"
                  onClick={() => navigate('/booking')}
                >
                  {t('settings.close', 'Luk')}
                </button>
                <button
                  type="button"
                  className="usersettings-top-btn primary"
                  onClick={handleSaveProfile}
                  disabled={isSaving || isAvatarUploading || hasWorkHoursErrors}
                  aria-busy={isSaving || isAvatarUploading}
                >
                  {isSaving || isAvatarUploading
                    ? t('settings.saving', 'Gemmer…')
                    : t('settings.save', 'Gem')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </BookingSidebarLayout>
  );
}

export default UserSettings;
