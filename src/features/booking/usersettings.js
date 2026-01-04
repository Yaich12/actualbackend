import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './usersettings.css';
import './bookingpage.css';
import { BookingSidebarLayout } from '../../components/ui/BookingSidebarLayout';
import { auth, db, storage } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { updateProfile } from 'firebase/auth';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

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
  const { language, setLanguage, languageOptions, t } = useLanguage();
  const [activeSection, setActiveSection] = useState('profile'); // profile | account | appearance | language | ai
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [colorMode, setColorMode] = useState('system');
  const [audioRetention, setAudioRetention] = useState('30d');
  const [transcriptRetention, setTranscriptRetention] = useState('30d');
  const [agentCommsRetention, setAgentCommsRetention] = useState('30d');
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

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
          setFullName(data.displayName || user.displayName || '');
          setEmail(data.email || user.email || '');
          setClinicName(data.clinicName || '');
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
          if (data.themeMode === 'light' || data.themeMode === 'dark' || data.themeMode === 'system') {
            setColorMode(data.themeMode);
            applyTheme(data.themeMode);
            localStorage.setItem(THEME_STORAGE_KEY, data.themeMode);
          }
        } else {
          setFullName(user.displayName || '');
          setEmail(user.email || '');
          setClinicName('');
          setWebsite('');
          setPhotoURL(user.photoURL || '');
          setAvatarPreviewUrl('');
          setAvatarFile(null);
          setRemoveAvatar(false);
          setCategory('');
          setAddress('');
          setCurrency('');
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
                    onClick={() => setActiveSection('profile')}
                  >
                    {t('settings.sections.profile', 'Profil')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'account' ? 'active' : ''}`}
                    onClick={() => setActiveSection('account')}
                  >
                    {t('settings.sections.account', 'Kontoopsætning')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'appearance' ? 'active' : ''}`}
                    onClick={() => setActiveSection('appearance')}
                  >
                    {t('settings.sections.appearance', 'Appearance')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'language' ? 'active' : ''}`}
                    onClick={() => setActiveSection('language')}
                  >
                    {t('settings.sections.language', 'Sprog')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveSection('ai')}
                  >
                    {t('settings.sections.ai', 'AI indstillinger')}
                  </button>
                </aside>

                <main className="usersettings-panel">
                  {activeSection === 'profile' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.profile.title', 'Rediger din onlineprofil')}
                        </div>
                      </div>

                      <div className="usersettings-avatar-row">
                        <div className="usersettings-avatar-meta">
                          <div className="usersettings-title">
                            {t('settings.profile.avatarTitle', 'Din avatar')}
                          </div>
                          <div className="usersettings-subtitle">
                            {t(
                              'settings.profile.avatarSubtitle',
                              'Opdater din avatar til din professionelle profil.'
                            )}
                          </div>
                        </div>

                        <div className="usersettings-avatar-control">
                          <div className="usersettings-avatar-circle">
                            {avatarPreviewUrl || photoURL ? (
                              <img
                                src={avatarPreviewUrl || photoURL}
                                alt="Din avatar"
                                className="usersettings-avatar-img"
                              />
                            ) : (
                              <span className="usersettings-avatar-fallback">
                                {(fullName || email || 'S').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="usersettings-avatar-actions">
                            <label className="usersettings-avatar-btn">
                              {t('settings.profile.changePhoto', 'Skift billede')}
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  if (!file) return;
                                  if (avatarPreviewUrl) {
                                    URL.revokeObjectURL(avatarPreviewUrl);
                                  }
                                  setAvatarFile(file);
                                  setAvatarPreviewUrl(URL.createObjectURL(file));
                                  setRemoveAvatar(false);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="usersettings-avatar-btn ghost"
                              onClick={() => {
                                if (avatarPreviewUrl) {
                                  URL.revokeObjectURL(avatarPreviewUrl);
                                }
                                setAvatarPreviewUrl('');
                                setAvatarFile(null);
                                setRemoveAvatar(true);
                                setPhotoURL('');
                              }}
                              disabled={!photoURL && !avatarPreviewUrl}
                            >
                              {t('settings.profile.remove', 'Fjern')}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="usersettings-divider" />

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
                    </>
                  )}

                  {activeSection === 'account' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.account.title', 'Kontoopsætning')}
                        </div>
                      </div>

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

                      <div className="usersettings-section">
                        <label className="usersettings-label">
                          {t('settings.language.label', 'Foretrukket sprog')}
                        </label>
                        <select
                          className="usersettings-input"
                          value={language}
                          onChange={(e) => {
                            void setLanguage(e.target.value);
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
                    </>
                  )}

                  {activeSection === 'ai' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.ai.title', 'AI indstillinger')}
                        </div>
                      </div>

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
                    </>
                  )}
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
                  disabled={isSaving || isAvatarUploading}
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
