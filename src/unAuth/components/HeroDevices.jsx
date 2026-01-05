import React, { useEffect, useState } from 'react';
import { Mac } from '../../components/ui/mac';
import { useLanguage } from '../language/LanguageProvider';
import './HeroDevices.css';

const LAPTOP_IMAGES = ['/hero-4/clinic-overview.png', '/hero-4/calendar-week.png'];

function HeroDevices() {
  const [activeImage, setActiveImage] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveImage((current) => (current + 1) % LAPTOP_IMAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="hero-devices">
      <div className="hero-devices__inner">
        <div className="hero-devices__text">
          <p className="hero-devices__eyebrow">{t('landing.heroDevices.eyebrow')}</p>
          <h1>{t('landing.heroDevices.title')}</h1>
          <p className="hero-devices__sub">
            {t('landing.heroDevices.description')}
          </p>
          <div className="hero-devices__cta">
            <button className="hero-devices__button">{t('landing.heroDevices.cta')}</button>
            <span className="hero-devices__hint">{t('landing.heroDevices.hint')}</span>
          </div>
        </div>

        <div className="hero-devices__visual">
          <div className="hero-devices__glow" />
          <div className="hero-device-stack">
            {LAPTOP_IMAGES.map((src, index) => (
              <Mac
                key={src}
                src={src}
                className={`hero-mac ${activeImage === index ? 'hero-mac--active' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroDevices;
