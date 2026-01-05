import React from 'react';
import './footer.css';
import Featured_05 from '../../components/ui/globe-feature-section';
import { useLanguage } from '../language/LanguageProvider';

function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="footer">
      <Featured_05 />

      <div className="footer-links">
        <div className="footer-links-container">
          <div className="footer-column">
            <h3 className="footer-column-title">{t('landing.footer.columns.product.title')}</h3>
            <ul className="footer-column-list">
              <li><a href="#daily">{t('landing.footer.columns.product.items.daily')}</a></li>
              <li><a href="#monitoring">{t('landing.footer.columns.product.items.monitoring')}</a></li>
              <li><a href="#mentor">{t('landing.footer.columns.product.items.mentor')}</a></li>
              <li><a href="#clinical-buddy">{t('landing.footer.columns.product.items.clinicalBuddy')}</a></li>
              <li><a href="#time-creator">{t('landing.footer.columns.product.items.timeCreator')}</a></li>
              <li><a href="#events">{t('landing.footer.columns.product.items.events')}</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-column-title">{t('landing.footer.columns.markets.title')}</h3>
            <ul className="footer-column-list">
              <li><a href="#eu">{t('landing.footer.columns.markets.items.eu')}</a></li>
              <li><a href="#denmark">{t('landing.footer.columns.markets.items.denmark')}</a></li>
              <li><a href="#uk">{t('landing.footer.columns.markets.items.uk')}</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-column-title">{t('landing.footer.columns.solutions.title')}</h3>
            <ul className="footer-column-list">
              <li><a href="#clinical">{t('landing.footer.columns.solutions.items.clinical')}</a></li>
              <li><a href="#consultations">{t('landing.footer.columns.solutions.items.consultations')}</a></li>
              <li><a href="#more">{t('landing.footer.columns.solutions.items.more')}</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-column-title">{t('landing.footer.columns.about.title')}</h3>
            <ul className="footer-column-list">
              <li><a href="#cases">{t('landing.footer.columns.about.items.cases')}</a></li>
              <li><a href="#company">{t('landing.footer.columns.about.items.company')}</a></li>
              <li><a href="#linkedin">{t('landing.footer.columns.about.items.linkedin')}</a></li>
              <li><a href="#privacy">{t('landing.footer.columns.about.items.privacy')}</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
