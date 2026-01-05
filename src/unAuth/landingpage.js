import React from 'react';
import './landingpage.css';
import Navbar from './components/navbar';
import Frontpage from './components/frontpage';
import Demo from './components/demo';
import Footer from './components/footer';
import ScrollSection from './components/scroll';
import Manifesto from './components/Manifesto';
import Pricing from '../pricing/pricing';
import { Stats } from '../components/ui/stats-section-with-text';
import { useLanguage } from './language/LanguageProvider';

const LandingDivider = ({ text, ariaLabel }) => (
  <div className="landing-divider" aria-label={ariaLabel}>
    <span className="landing-divider-text">{text}</span>
  </div>
);

function LandingPage() {
  const { t } = useLanguage();
  const showManifesto = false;
  const dividerText = t('landing.divider.text');
  const dividerLabel = t('landing.divider.aria');

  return (
    <div className="landing-page">
      <Navbar />
      <main className="landing-page-main">
        <section className="landing-section landing-section-hero" id="hero">
          <div className="landing-section-inner landing-section-inner-hero">
            <Frontpage />
          </div>
        </section>
        <section className="landing-section landing-section-full" id="parallax-demo">
          <ScrollSection />
        </section>
        <section className="landing-section landing-section-full" id="stats">
          <div className="bg-white">
            <Stats />
          </div>
        </section>
        <section
          className="landing-section landing-section-full landing-section-demo landing-section-hidden"
          id="demo"
        >
          <Demo />
        </section>
        {showManifesto && (
          <>
            <LandingDivider text={dividerText} ariaLabel={dividerLabel} />
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
