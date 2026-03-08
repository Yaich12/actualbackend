import React from 'react';
import './footer.css';
import Featured_05 from '../../components/ui/globe-feature-section';
import { useLanguage } from '../language/LanguageProvider';

const SELMA_LINKEDIN_URL = 'https://www.linkedin.com/company/selmaplus/';

function Footer() {
  const { t } = useLanguage();
  const landingLinks = [
    { key: 'hero', href: '#hero' },
    { key: 'platform', href: '#parallax-demo' },
    { key: 'workflow', href: '#scroll-parallax' },
    { key: 'about', href: '#about' },
    { key: 'stats', href: '#stats' },
    { key: 'pricing', href: '#pricing' },
  ];
  const featureLinks = [
    { key: 'transcription', href: '/transcription-factsr#factsr-section' },
    { key: 'copilot', href: '/selma-copilot' },
    { key: 'website', href: '/website-builder#booking-flow' },
  ];
  const aboutLinks = [
    { key: 'company', href: '#about' },
    { key: 'pricing', href: '#pricing' },
    { key: 'linkedin', href: SELMA_LINKEDIN_URL, external: true },
  ];

  return (
    <footer className="footer">
      <Featured_05 />

      <div className="footer-links">
        <div className="footer-links-container">
          <div className="footer-column">
            <h3 className="footer-column-title">{t('landing.footer.columns.landing.title')}</h3>
            <ul className="footer-column-list">
              {landingLinks.map((link) => (
                <li key={link.key}>
                  <a href={link.href}>{t(`landing.footer.columns.landing.items.${link.key}`)}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-column-title">{t('landing.footer.columns.features.title')}</h3>
            <ul className="footer-column-list">
              {featureLinks.map((link) => (
                <li key={link.key}>
                  <a href={link.href}>{t(`landing.footer.columns.features.items.${link.key}`)}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-column-title">{t('landing.footer.columns.about.title')}</h3>
            <ul className="footer-column-list">
              {aboutLinks.map((link) => (
                <li key={link.key}>
                  <a
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                  >
                    {t(`landing.footer.columns.about.items.${link.key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
