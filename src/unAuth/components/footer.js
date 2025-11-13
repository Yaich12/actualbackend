import React from 'react';
import './footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-cta">
        <div className="footer-cta-container">
          <div className="footer-cta-content">
            <h2 className="footer-cta-title">Ready to take it to the next level?</h2>
            <p className="footer-cta-subtitle">Explore how Selma could work for you.</p>
          </div>
          <a href="#demo" className="footer-cta-button">
            Request Demo
            <span className="footer-cta-arrow">↗</span>
          </a>
        </div>
      </div>

      <div className="footer-links">
        <div className="footer-links-container">
          <div className="footer-column">
            <h3 className="footer-column-title">Product</h3>
            <ul className="footer-column-list">
              <li><a href="#daily">Daily Assistance</a></li>
              <li><a href="#monitoring">Monitoring</a></li>
              <li><a href="#mentor">Mentor</a></li>
              <li><a href="#clinical-buddy">Clinical Buddy</a></li>
              <li><a href="#time-creator">Time Creator</a></li>
              <li><a href="#events">Events</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-column-title">Markets</h3>
            <ul className="footer-column-list">
              <li><a href="#eu">European Union</a></li>
              <li><a href="#denmark">Denmark</a></li>
              <li><a href="#uk">United Kingdom</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-column-title">Solutions</h3>
            <ul className="footer-column-list">
              <li><a href="#clinical">Clinical Assistance</a></li>
              <li><a href="#consultations">Consultations</a></li>
              <li><a href="#more">Much More</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-column-title">About</h3>
            <ul className="footer-column-list">
              <li><a href="#cases">Cases</a></li>
              <li><a href="#company">Company</a></li>
              <li><a href="#linkedin">LinkedIn</a></li>
              <li><a href="#privacy">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

