import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import './landingpage.css';
import Navbar from './components/navbar';
import Frontpage from './components/frontpage';
import Demo from './components/demo';
import Footer from './components/footer';
import Manifesto from './components/Manifesto';
import { useLanguage } from './language/LanguageProvider';

const LazyScrollSection = lazy(() => import('./components/scroll'));
const LazyPricing = lazy(() => import('../pricing/pricing'));
const LazyStats = lazy(() =>
  import('../components/ui/stats-section-with-text').then((mod) => ({ default: mod.Stats }))
);

const LandingDivider = ({ text, ariaLabel }) => (
  <div className="landing-divider" aria-label={ariaLabel}>
    <span className="landing-divider-text">{text}</span>
  </div>
);

const SectionPlaceholder = ({ minHeight = 320 }) => (
  <div aria-hidden="true" style={{ minHeight }} />
);

function useNearViewport(rootMargin = '600px 0px') {
  const ref = useRef(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    if (isNear) return undefined;
    const target = ref.current;
    if (!target) return undefined;

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsNear(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry?.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isNear, rootMargin]);

  return [ref, isNear];
}

function DeferredSection({ id, className, minHeight, children }) {
  const [sectionRef, shouldLoad] = useNearViewport();

  return (
    <section ref={sectionRef} className={className} id={id}>
      {shouldLoad ? (
        <Suspense fallback={<SectionPlaceholder minHeight={minHeight} />}>
          {children}
        </Suspense>
      ) : (
        <SectionPlaceholder minHeight={minHeight} />
      )}
    </section>
  );
}

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
        <DeferredSection
          className="landing-section landing-section-full"
          id="parallax-demo"
          minHeight={900}
        >
          <LazyScrollSection />
        </DeferredSection>
        <DeferredSection className="landing-section landing-section-full" id="stats" minHeight={320}>
          <div className="bg-white">
            <LazyStats />
          </div>
        </DeferredSection>
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
        <DeferredSection className="landing-section landing-section-full" id="pricing" minHeight={780}>
          <LazyPricing />
        </DeferredSection>
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
