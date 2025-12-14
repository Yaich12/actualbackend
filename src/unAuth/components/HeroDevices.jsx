import React from 'react';
import './HeroDevices.css';

function HeroDevices() {
  const columns = 5;
  const rows = 6;
  const booked = [
    { col: 1, row: 1, label: '08:00 · Maja' },
    { col: 2, row: 3, label: '11:30 · Jens' },
    { col: 3, row: 2, label: '14:00 · Sara' },
  ];

  const isBooked = (c, r) => booked.find((b) => b.col === c && b.row === r);

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
                <div className="hero-tablet__topbar">
                  <div className="hero-tablet__title">
                    <span className="dot dot--green" />
                    Uge 50 · Ugevisning
                  </div>
                  <div className="hero-tablet__avatars">
                    <div className="avatar">MH</div>
                    <div className="avatar avatar--soft">SJ</div>
                  </div>
                </div>

                <div className="hero-tablet__calendar">
                  {[...Array(columns)].map((_, col) => (
                    <div key={col} className="calendar-col">
                      {[...Array(rows)].map((_, row) => {
                        const booking = isBooked(col, row);
                        return (
                          <div
                            key={row}
                            className={`slot ${booking ? 'slot--booked' : ''}`}
                            style={booking ? {} : undefined}
                          >
                            {booking && (
                              <div className="slot__card">
                                <span className="slot__time">{booking.label.split('·')[0]}</span>
                                <span className="slot__name">{booking.label.split('·')[1]}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="hero-tablet__footer">
                  <div className="footer__left">
                    <span className="dot dot--amber" />
                    Næste patient 14:00 · Sara L.
                  </div>
                  <button className="footer__cta">Opret aftale</button>
                </div>
              </div>
            </div>

            <div className="hero-hand">
              <div className="hand__palm" />
              <div className="hand__thumb" />
              <div className="hand__finger finger-1" />
              <div className="hand__finger finger-2" />
              <div className="hand__finger finger-3" />
              <div className="hand__finger finger-4" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroDevices;

