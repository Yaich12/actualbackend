import React from 'react';
import { Link } from 'react-router-dom';
import './frontpage.css';

function Frontpage() {
  return (
    <section className="frontpage">
      <div className="frontpage-container">
        <h1 className="frontpage-title">
          <span className="frontpage-title-line">Stay focused on your patients.</span>
          <span className="frontpage-title-line">We'll handle the rest<span className="frontpage-dot">.</span></span>
        </h1>
        <p className="frontpage-subtitle">Det eneste redskab du skal bruge, til at klare alt.</p>
        <p className="frontpage-description">
          Din AI-assistent transskriberer journaler, hjælper med cases, tager opkald og styrer booking – så du kan være den fysioterapeut du blev uddannet til og udvikle dig til en bedre.
        </p>
        <div className="frontpage-buttons">
          <Link to="/booking" className="frontpage-button primary">Start for free</Link>
          <a href="#demo" className="frontpage-button secondary">Book a demo</a>
        </div>
      </div>
    </section>
  );
}

export default Frontpage;

