import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './usersettings.css';
import './bookingpage.css';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';

const THEME_STORAGE_KEY = 'selma_theme_mode';
const NIGHT_START_HOUR = 18; // 18:00
const NIGHT_END_HOUR = 5;    // 05:00

function UserSettings() {
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [colorMode, setColorMode] = useState('system');
  const [isSaving, setIsSaving] = useState(false);
  const [activeNav, setActiveNav] = useState('indstillinger');

  const userIdentity = useMemo(() => {
    if (!user) {
      return {
        name: 'Ikke logget ind',
        email: 'Log ind for at fortsætte',
        initials: '?',
        photoURL: null,
      };
    }

    const name = user.displayName || user.email || 'Selma bruger';
    const emailValue = user.email || '—';
    const initialsSource = (user.displayName || user.email || '?').trim();
    const initials = initialsSource
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return {
      name,
      email: emailValue,
      initials,
      photoURL: user.photoURL || null,
    };
  }, [user]);

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
          setJobTitle(data.jobTitle || '');
          if (data.themeMode === 'light' || data.themeMode === 'dark' || data.themeMode === 'system') {
            setColorMode(data.themeMode);
            applyTheme(data.themeMode);
            localStorage.setItem(THEME_STORAGE_KEY, data.themeMode);
          }
        } else {
          setFullName(user.displayName || '');
          setEmail(user.email || '');
          setJobTitle('');
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
      await updateUserProfile({ fullName, jobTitle });
      const ref = doc(db, 'users', user.uid);
      await setDoc(
        ref,
        {
          themeMode: colorMode,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('[UserSettings] Failed to save profile', error);
    } finally {
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
    <div className="booking-page">
      {/* Top Navigation Bar */}
      <div className="booking-topbar">
        <div className="topbar-left">
          <button
            className="topbar-logo-btn"
            onClick={() => navigate('/booking')}
          >
            Forside
          </button>
        </div>
        <div className="topbar-right" />
      </div>

      <div className="booking-content">
        {/* Left Sidebar */}
        <div className="booking-sidebar">
          <div className="sidebar-search">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Søg" className="search-input" />
          </div>

          <div className="sidebar-notifications">
            <span className="bell-icon">🔔</span>
            <span>Notifikationer</span>
          </div>

          <div className="sidebar-section">
            <div className="section-label">KLINIK</div>
            <nav className="sidebar-nav">
              <button
                className={`nav-item ${activeNav === 'kalender' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('kalender');
                  navigate('/booking');
                }}
              >
                <span className="nav-icon calendar-icon">📅</span>
                <span className="nav-text">Kalender</span>
              </button>
              <button
                className={`nav-item ${activeNav === 'klienter' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('klienter');
                  navigate('/booking/klienter');
                }}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">Klienter</span>
              </button>
              <button
                className={`nav-item ${activeNav === 'ydelser' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('ydelser');
                  navigate('/booking/ydelser');
                }}
              >
                <span className="nav-icon">🏷️</span>
                <span className="nav-text">Ydelser</span>
              </button>
              <button
                className={`nav-item ${activeNav === 'indstillinger' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('indstillinger');
                  navigate('/booking/settings');
                }}
              >
                <span className="nav-icon">⚙️</span>
                <span className="nav-text">Indstillinger</span>
              </button>
            </nav>
          </div>

          <button
            type="button"
            className="sidebar-clinic"
            onClick={() => navigate('/booking/settings')}
          >
            {userIdentity.photoURL ? (
              <img
                src={userIdentity.photoURL}
                alt={userIdentity.name}
                className="clinic-avatar"
              />
            ) : (
              <div className="clinic-avatar clinic-avatar-placeholder">
                {userIdentity.initials}
              </div>
            )}
            <div className="clinic-user-details">
              <div className="clinic-user-name">{userIdentity.name}</div>
              <div className="clinic-user-email">{userIdentity.email}</div>
            </div>
          </button>
        </div>

        {/* Main Content */}
        <div className="usersettings-main">
          <div className="usersettings-page">
            <div className="usersettings-card">
              <div className="usersettings-header">
                <div className="usersettings-title">Profil</div>
                <div className="usersettings-subtitle">Opdater dine brugeroplysninger</div>
              </div>

              <div className="usersettings-section">
                <label className="usersettings-label">Fulde navn</label>
                <input
                  className="usersettings-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Indtast dit fulde navn"
                />
              </div>

              <div className="usersettings-section">
                <label className="usersettings-label">E-mail</label>
                <input
                  className="usersettings-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Indtast din e-mail"
                />
              </div>

              <div className="usersettings-section">
                <label className="usersettings-label">Jobtitel</label>
                <input
                  className="usersettings-input"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Angiv din jobtitel"
                />
              </div>

              <div className="usersettings-divider" />

              <div className="usersettings-header">
                <div className="usersettings-title">Appearance</div>
                <div className="usersettings-subtitle">Vælg hvordan Selma skal se ud</div>
              </div>

              <div className="usersettings-theme-grid">
                {renderThemeCard('light', 'Light', 'theme-light')}
                {renderThemeCard('system', 'Match system', 'theme-system')}
                {renderThemeCard('dark', 'Dark', 'theme-dark')}
              </div>

              <div className="usersettings-actions">
                <button
                  type="button"
                  className="usersettings-save-btn"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  aria-busy={isSaving}
                >
                  {isSaving ? 'Gemmer...' : 'Gem profil'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserSettings;
