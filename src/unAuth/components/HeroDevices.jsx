import React from 'react';
import './HeroDevices.css';

function HeroDevices() {
  const columns = 5;
  const rows = 6;
  const highlightCells = new Set(['0-1', '1-3', '2-2', '3-4', '4-1', '2-5']);
  const isHighlighted = (c, r) => highlightCells.has(`${c}-${r}`);

  return (
    <section className="hero-devices">
      <div className="hero-devices__inner">
        <div className="hero-devices__text">
          <p className="hero-devices__eyebrow">Selma+ platform</p>
          <h1>Booking, journal og overblik i ét roligt workspace.</h1>
          <p className="hero-devices__sub">
            En kalender der ligner dit faktiske produkt: klare blokke, rolige farver og klinisk
            ro. Designet til fysioterapeuter, der vil have færre klik og mere tid til patienter.
          </p>
          <div className="hero-devices__cta">
            <button className="hero-devices__button">Prøv Selma+ booking</button>
            <span className="hero-devices__hint">Ingen installation. Se demo på 2 minutter.</span>
          </div>
        </div>

        <div className="hero-devices__visual">
          <div className="hero-devices__glow" />
          <div className="hero-tablet">
            <div className="hero-tablet__frame">
              <div className="hero-tablet__camera" />
              <div className="hero-tablet__screen">
                <div className="hero-tablet__calendar-bg">
                  <div className="calendar-bg__header">
                    <span>Uge 24 · Booking</span>
                    <span className="calendar-bg__pill">Team-view</span>
                  </div>
                  <div className="calendar-bg__grid">
                    {[...Array(columns)].map((_, col) => (
                      <div key={col} className="calendar-bg__col">
                        {[...Array(rows)].map((_, row) => (
                          <div
                            key={row}
                            className={`calendar-bg__cell ${
                              isHighlighted(col, row) ? 'calendar-bg__cell--filled' : ''
                            }`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="active-session">
                  <div className="active-session__badge">Aktiv session</div>

                  <div className="active-session__header">
                    <div>
                      <span className="active-session__label">Patient</span>
                      <span className="active-session__value">Lars Jensen</span>
                    </div>
                    <div>
                      <span className="active-session__label">Tid</span>
                      <span className="active-session__value">14:00 - 14:45</span>
                    </div>
                  </div>

                  <div className="active-session__summary">
                    <span className="active-session__section-title">Resume fra sidst</span>
                    <p>
                      Patient oplevede bedring i lænd efter øvelser. Smerte niveau faldet fra 7/10
                      til 4/10. Fokus i dag: Progression af styrke.
                    </p>
                  </div>

                  <div className="active-session__listener">
                    <div className="listener__top">
                      <span className="listener__pill">Live recording</span>
                      <span className="listener__status">
                        <span className="listener__dot" />
                        Factr lytter...
                      </span>
                    </div>
                    <div className="listener__wave">
                      {[...Array(12)].map((_, index) => (
                        <span
                          key={index}
                          className="wave-bar"
                          style={{ animationDelay: `${index * 0.07}s` }}
                        />
                      ))}
                    </div>
                    <div className="listener__note">Transkriberer samtale i realtid</div>
                  </div>

                  <div className="active-session__insight">
                    <div className="insight__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="img">
                        <path
                          d="M12 3.5l1.9 4.2 4.6.6-3.3 3.2.8 4.6-4-2.2-4 2.2.8-4.6-3.3-3.2 4.6-.6L12 3.5z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div className="insight__content">
                      <span className="insight__label">Ally Insight</span>
                      <p>
                        Forslag: Overvej McKenzie-øvelser baseret på dagens symptomer. Skal jeg
                        klargøre en øvelsesplan?
                      </p>
                    </div>
                  </div>

                  <button className="active-session__cta">Afslut &amp; Journaliser</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroDevices;
