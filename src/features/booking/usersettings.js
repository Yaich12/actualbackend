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

function UserSettings() {
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage, languageOptions, t } = useLanguage();
  const [activeSection, setActiveSection] = useState('profile'); // profile | account | appearance | language
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [colorMode, setColorMode] = useState('system');
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
        }
      } catch (error) {
        console.error('[UserSettings] Failed to load profile', error);
      }
    };

    loadProfile();
  }, [user]);

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

      await setDoc(
        ref,
        {
          themeMode: colorMode,
          displayName: fullName,
          photoURL: resolvedPhotoURL || null,
          jobTitle: jobTitleForSave,
          clinicName,
          website,
          categories: category ? [category] : [],
          address,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
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
              <div className="usersettings-header">
                <div className="usersettings-header-title">
                  {t('settings.title', 'Indstillinger')}
                </div>
                <div className="usersettings-top-actions">
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
                    </>
                  )}
                </main>
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
