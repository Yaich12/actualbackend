import React from 'react';
import './landingpage.css';
import Navbar from './components/navbar';
import Frontpage from './components/frontpage';
import { KalenderScrollDemo } from '../components/ui/kalender-scroll';
import Both from './components/Both';
import Footer from './components/footer';

const LandingDivider = () => (
  <div className="landing-divider" aria-label="Divider: from physios to physios">
    <span className="landing-divider-text">from physios to physios</span>
  </div>
);

function LandingPage() {
  return (
    <div className="landing-page">
      <Navbar />
      <LandingDivider />
      <main className="landing-page-main">
        <section className="landing-section landing-section-hero" id="hero">
          <Frontpage />
        </section>
        <LandingDivider />
        <section className="landing-section landing-section-panel" id="kalender">
          <KalenderScrollDemo />
        </section>
        <LandingDivider />
        <section className="landing-section landing-section-full" id="suite">
          <Both />
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
