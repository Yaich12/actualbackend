import FeatureShowcase from '../../components/sections/FeatureShowcase';
import { useLanguage } from '../language/LanguageProvider';

const LAPTOP_IMAGES = ['/hero-4/clinic-overview.png', '/hero-4/calendar-week.png'];

function HeroDevices() {
  const { t } = useLanguage();

  return (
    <FeatureShowcase
      eyebrow={t('landing.heroDevices.eyebrow')}
      title={t('landing.heroDevices.title')}
      description={t('landing.heroDevices.description')}
      primaryCtaLabel={t('landing.heroDevices.cta')}
      primaryCtaHref=""
      hint={t('landing.heroDevices.hint')}
      media={{ type: 'carousel', images: LAPTOP_IMAGES }}
    />
  );
}

export default HeroDevices;
