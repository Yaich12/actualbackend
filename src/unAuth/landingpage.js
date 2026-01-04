import React from 'react';
import './landingpage.css';
import Navbar from './components/navbar';
import Frontpage from './components/frontpage';
import Demo from './components/demo';
import Footer from './components/footer';
import Preview from './components/preview';
import ScrollSection from './components/scroll';
import Manifesto from './components/Manifesto';
import Pricing from '../pricing/pricing';

const LandingDivider = () => (
  <div className="landing-divider" aria-label="Divider: from physios to physios">
    <span className="landing-divider-text">from physios to physios</span>
  </div>
);

function LandingPage() {
  const showManifesto = false;

  return (
    <div className="landing-page">
      <Navbar />
      <main className="landing-page-main">
        <section className="landing-section landing-section-hero" id="hero">
          <div className="landing-section-inner landing-section-inner-hero">
            <Frontpage />
          </div>
        </section>
        <section className="landing-section landing-section-full" id="preview">
          <Preview />
        </section>
        <section className="landing-section landing-section-full" id="parallax-demo">
          <ScrollSection />
        </section>
        <section
          className="landing-section landing-section-full landing-section-demo landing-section-hidden"
          id="demo"
        >
          <Demo />
        </section>
        {showManifesto && (
          <>
            <LandingDivider />
            <section className="landing-section landing-section-full" id="manifesto">
              <Manifesto />
            </section>
          </>
        )}
        <section className="landing-section landing-section-full" id="pricing">
          <Pricing />
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
