import React from 'react';
import './both.css';

function Both() {
  return (
    <section className="both">
      <div className="both-container">
        <div className="both-divider">
          <span className="both-divider-text">FOR FYSIOTERAPEUTER</span>
        </div>

        <div className="both-cards">
          <div className="both-card">
            <div className="both-card-icon atlas-icon">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="60" height="60" rx="12" fill="#B794F6"/>
                <path d="M30 15C22.27 15 16 21.27 16 29C16 36.73 22.27 43 30 43C37.73 43 44 36.73 44 29C44 21.27 37.73 15 30 15ZM30 19C35.52 19 40 23.48 40 29C40 34.52 35.52 39 30 39C24.48 39 20 34.52 20 29C20 23.48 24.48 19 30 19Z" fill="white" fillOpacity="0.9"/>
                <path d="M26 24C25.17 24 24.5 24.67 24.5 25.5C24.5 26.33 25.17 27 26 27C26.83 27 27.5 26.33 27.5 25.5C27.5 24.67 26.83 24 26 24ZM34 24C33.17 24 32.5 24.67 32.5 25.5C32.5 26.33 33.17 27 34 27C34.83 27 35.5 26.33 35.5 25.5C35.5 24.67 34.83 24 34 24Z" fill="white" fillOpacity="0.9"/>
                <path d="M30 31.5C28.34 31.5 27 32.84 27 34.5C27 36.16 28.34 37.5 30 37.5C31.66 37.5 33 36.16 33 34.5C33 32.84 31.66 31.5 30 31.5Z" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <h3 className="both-card-title">Atlas</h3>
            <p className="both-card-description">Din AI-drevne kliniske sparringspartner til alle tilfælde i daglig praksis</p>
            <ul className="both-card-features">
              <li>Differentialdiagnostik</li>
              <li>Kliniske tests og vejledning</li>
              <li>Behandlingsplanlægning</li>
            </ul>
            <a href="#atlas" className="both-card-cta">Lær mere →</a>
          </div>

          <div className="both-card">
            <div className="both-card-icon axis-icon">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="60" height="60" rx="12" fill="#3b82f6"/>
                <path d="M30 20C26.69 20 24 22.69 24 26V34C24 37.31 26.69 40 30 40C33.31 40 36 37.31 36 34V26C36 22.69 33.31 20 30 20ZM30 24C31.1 24 32 24.9 32 26V34C32 35.1 31.1 36 30 36C28.9 36 28 35.1 28 34V26C28 24.9 28.9 24 30 24Z" fill="white" fillOpacity="0.9"/>
                <ellipse cx="30" cy="26" rx="4" ry="6" fill="white" fillOpacity="0.9"/>
                <path d="M22 34C22 34 24 38 30 38C36 38 38 34 38 34" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9"/>
              </svg>
            </div>
            <h3 className="both-card-title">Axis</h3>
            <p className="both-card-description">Automatisk journalføring via AI - omsæt samtaler til strukturerede journaler</p>
            <ul className="both-card-features">
              <li>Automatisk transskribering</li>
              <li>Spar tid på administration</li>
              <li>Fokus på patienten</li>
            </ul>
            <a href="#axis" className="both-card-cta">Lær mere →</a>
          </div>

          <div className="both-card">
            <div className="both-card-icon administration-icon">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="administrationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <rect width="60" height="60" rx="12" fill="url(#administrationGradient)"/>
                <g transform="translate(10, 8)">
                  <rect x="6" y="2" width="18" height="24" rx="2" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.9"/>
                  <circle cx="15" cy="14" r="7" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5" strokeOpacity="0.9"/>
                  <circle cx="15" cy="14" r="6" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.9"/>
                  <line x1="15" y1="14" x2="15" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9"/>
                  <line x1="15" y1="14" x2="20" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9"/>
                  <rect x="4" y="26" width="5" height="2.5" rx="1" fill="white" fillOpacity="0.9"/>
                  <rect x="21" y="26" width="5" height="2.5" rx="1" fill="white" fillOpacity="0.9"/>
                  <circle cx="5" cy="3" r="2" fill="white" fillOpacity="0.9"/>
                  <circle cx="25" cy="3" r="2" fill="white" fillOpacity="0.9"/>
                </g>
              </svg>
            </div>
            <h3 className="both-card-title">Administration</h3>
            <p className="both-card-description">Mød Suzan - din digitale sekretær der holder styr på alt det administrative. Hun sikrer professionel håndtering af bookinger, påmindelser og kommunikation. Bedst af alt? Hun koster ikke en krone.</p>
            <ul className="both-card-features">
              <li>Automatisk booking-håndtering</li>
              <li>Smart håndtering af afbud og påmindelser</li>
              <li>Proaktive notificationer til dig og dine kunder</li>
            </ul>
            <a href="#administration" className="both-card-cta">Lær mere →</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Both;
