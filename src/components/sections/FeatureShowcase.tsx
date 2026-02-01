import { useEffect, useState, type ReactNode } from 'react';
import { Mac } from '../ui/mac';
import '../../unAuth/components/HeroDevices.css';

const CAROUSEL_INTERVAL_MS = 3000;

type FeatureShowcaseMedia = {
  type: 'image' | 'carousel';
  images: string[];
};

type FeatureShowcaseProps = {
  eyebrow: string;
  title: string;
  description: string;
  descriptionContent?: ReactNode;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  media: FeatureShowcaseMedia;
  hint?: string;
  variant?: 'default' | 'journal';
};

export default function FeatureShowcase({
  eyebrow,
  title,
  description,
  descriptionContent,
  primaryCtaLabel,
  primaryCtaHref,
  media,
  hint,
  variant = 'default',
}: FeatureShowcaseProps) {
  const images = media?.images ?? [];
  const isCarousel = media?.type === 'carousel' && images.length > 1;
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
  }, [media?.type, images.length]);

  useEffect(() => {
    if (!isCarousel) return undefined;
    const interval = setInterval(() => {
      setActiveImage((current) => (current + 1) % images.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isCarousel, images.length]);

  const displayImages = media?.type === 'image' ? images.slice(0, 1) : images;
  const handlePrimaryClick = () => {
    if (!primaryCtaHref || typeof window === 'undefined') return;
    window.location.assign(primaryCtaHref);
  };

  const descriptionNode = descriptionContent ?? (
    <p className="hero-devices__sub">{description}</p>
  );

  return (
    <section className={`hero-devices${variant === 'journal' ? ' hero-devices--journal' : ''}`}>
      <div className="hero-devices__inner">
        <div className="hero-devices__text">
          <p className="hero-devices__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {descriptionNode}
          <div className="hero-devices__cta">
            <button
              type="button"
              className="hero-devices__button"
              onClick={primaryCtaHref ? handlePrimaryClick : undefined}
            >
              {primaryCtaLabel}
            </button>
            {hint ? <span className="hero-devices__hint">{hint}</span> : null}
          </div>
        </div>

        <div className="hero-devices__visual">
          <div className="hero-devices__glow" />
          <div className="hero-device-stack">
            {displayImages.map((src, index) => (
              <Mac
                key={src}
                src={src}
                className={`hero-mac ${activeImage === index ? 'hero-mac--active' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
