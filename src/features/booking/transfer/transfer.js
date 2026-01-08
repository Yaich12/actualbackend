import React, { useMemo } from 'react';
import './transfer.css';
import { useLanguage } from '../../../LanguageContext';
import { DEFAULT_SOFTWARE_OPTIONS } from '../../../SignUp/costum/costum';

function Transfer() {
  const { t, getArray } = useLanguage();
  const platforms = useMemo(() => {
    const options = getArray(
      'onboarding.steps.software.options',
      DEFAULT_SOFTWARE_OPTIONS
    );
    return Array.isArray(options) ? options.filter(Boolean) : DEFAULT_SOFTWARE_OPTIONS;
  }, [getArray]);

  return (
    <div className="transfer-section">
      <div className="usersettings-header">
        <div className="usersettings-title">
          {t('settings.transfer.title', 'Transfer')}
        </div>
        <div className="usersettings-subtitle">
          {t(
            'settings.transfer.subtitle',
            'Overfør data fra din gamle platform til Selma+.'
          )}
        </div>
      </div>

      <div className="transfer-grid">
        {platforms.map((platform) => (
          <button key={platform} type="button" className="transfer-card">
            <span className="transfer-card-title">{platform}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Transfer;
