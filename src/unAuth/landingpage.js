import React from 'react';
import './landingpage.css';
import Navbar from './components/navbar';
import Frontpage from './components/frontpage';
import MacbookScrollDemo from '../components/ui/macbook-scroll-demo';
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
      <main className="landing-page-main">
        <section className="landing-section landing-section-hero" id="hero">
          <div className="landing-section-inner landing-section-inner-hero">
            <Frontpage />
          </div>
        </section>
        <section className="landing-section landing-section-panel" id="kalender">
          <div className="landing-section-inner">
            <MacbookScrollDemo />
          </div>
        </section>
        <section className="landing-section landing-section-full" id="suite">
          <div className="landing-section-inner">
            <Both />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
