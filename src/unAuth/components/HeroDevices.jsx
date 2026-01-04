import React, { useEffect, useState } from 'react';
import { Mac } from '../../components/ui/mac';
import './HeroDevices.css';

const LAPTOP_IMAGES = ['/hero-4/clinic-overview.png', '/hero-4/calendar-week.png'];

function HeroDevices() {
  const [activeImage, setActiveImage] = useState(0);

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
          <p className="hero-devices__eyebrow">Selma+ platform</p>
          <h1>The overview that comes to you.</h1>
          <p className="hero-devices__sub">
            Forget clicking around for information before the next consultation. When a patient is
            about to arrive, Selma+ automatically serves everything for you: who’s coming, an AI
            summary of the last session, and a clear plan for today. You’re ready before the patient
            walks in the door.
          </p>
          <div className="hero-devices__cta">
            <button className="hero-devices__button">Try Selma+ booking</button>
            <span className="hero-devices__hint">Ingen installation. Se demo på 2 minutter.</span>
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
