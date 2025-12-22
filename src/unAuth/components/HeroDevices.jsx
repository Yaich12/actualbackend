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
          <h1>Overblikket der kommer til dig.</h1>
          <p className="hero-devices__sub">
            Glem at klikke rundt efter information inden næste konsultation. Når en patient nærmer
            sig, serverer Selma+ automatisk det hele for dig: Hvem der kommer, et AI-resume af sidste
            session og en klar plan for i dag. Du er klar, før patienten træder ind ad døren.
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
                <div className="calendar-bg__content">
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
                <div className="calendar-bg__veil" aria-hidden="true" />
              </div>

              <div className="session-card">
                <div className="session-card__header">
                  <div className="session-card__avatar" aria-hidden="true">
                    MH
                  </div>
                  <div className="session-card__identity">
                    <div className="session-card__name">Mette Hansen</div>
                    <div className="session-card__meta">
                      10:00 - 10:45 • Fysioterapi - Opfølgning
                    </div>
                  </div>
                </div>

                <div className="session-card__insight">
                  <div className="session-card__insight-header">
                    <span className="session-card__spark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="img">
                        <path
                          d="M12 3.5l1.9 4.2 4.6.6-3.3 3.2.8 4.6-4-2.2-4 2.2.8-4.6-3.3-3.2 4.6-.6L12 3.5z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span>AI Resume &amp; Fokus</span>
                  </div>
                  <p>
                    Sidste session: Smerter i lænd reduceret. Patienten har lavet hjemmeøvelser.
                    Fokus i dag: Øvelsesprogression + Manuelle greb omkring L4/L5.
                  </p>
                </div>

                <div className="session-card__footer">
                  <div className="session-card__status">
                    <span className="status-dot status-dot--warning" />
                    Betaling: Ikke betalt
                  </div>
                  <button className="session-card__cta">Start Journal / Optagelse</button>
                </div>
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
