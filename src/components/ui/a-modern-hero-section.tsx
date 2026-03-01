import FeatureShowcase from '../sections/FeatureShowcase';
import LoomEmbed from './LoomEmbed';
import { HERO_6_IMAGES } from '../../assets/hero6Images';
import { useLanguage } from '../../unAuth/language/LanguageProvider';

const JournalDescription = ({ description }: { description: string }) => {
  const blocks = description.split(/\n\s*\n/).filter(Boolean);
  const intro = blocks[0] ?? '';
  const subheading = blocks[1] ?? '';
  const bulletItems = blocks.slice(2, 5);
  const closingBlocks = blocks.slice(5);

  return (
    <div className="hero-devices__body">
      {intro && <p className="hero-devices__body-text">{intro}</p>}
      {subheading && <p className="hero-devices__body-heading">{subheading}</p>}
      {bulletItems.length > 0 && (
        <ul className="hero-devices__body-list">
          {bulletItems.map((item, index) => {
            const [label, ...rest] = item.split(' – ');
            const remainder = rest.join(' – ');
            return (
              <li key={`${label}-${index}`} className="hero-devices__body-item">
                {remainder ? (
                  <>
                    <strong className="hero-devices__body-label">{label}</strong>
                    <span>{` – ${remainder}`}</span>
                  </>
                ) : (
                  <span>{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {closingBlocks.map((block, index) => (
        <p
          key={`closing-${index}`}
          className={`hero-devices__body-text${
            index === closingBlocks.length - 1 ? ' hero-devices__body-closing' : ''
          }`}
        >
          {block}
        </p>
      ))}
    </div>
  );
};

type JournalVideoItem = {
  id: string;
  title: string;
};

const JournalVideoStack = ({ videos }: { videos: JournalVideoItem[] }) => (
  <div className="hero-devices__journal-videos">
    {videos.map((video) => (
      <figure key={video.id} className="hero-devices__journal-video-card">
        <figcaption className="hero-devices__journal-video-title">{video.title}</figcaption>
        <LoomEmbed videoId={video.id} title={video.title} />
      </figure>
    ))}
  </div>
);

export default function HeroSection() {
  const { t } = useLanguage();
  const description = t('landing.heroJournal.description');
  const mediaType = HERO_6_IMAGES.length > 1 ? 'carousel' : 'image';
  const journalVideos = [
    {
      id: '875ff0de7fd948d5ac07859fabc35ed8',
      title: t('landing.heroJournal.videoTitles.dictation'),
    },
    {
      id: '823b210c7dca4000a0ee4e8896f9495c',
      title: t('landing.heroJournal.videoTitles.transcriptionFirstConsultation'),
    },
  ];

  return (
    <FeatureShowcase
      eyebrow={t('landing.heroJournal.eyebrow')}
      title={t('landing.heroJournal.title')}
      description={description}
      descriptionContent={<JournalDescription description={description} />}
      primaryCtaLabel={t('landing.heroJournal.cta')}
      primaryCtaHref="/signup"
      hint={t('landing.heroJournal.hint')}
      variant="journal"
      visualContent={<JournalVideoStack videos={journalVideos} />}
      media={{ type: mediaType, images: HERO_6_IMAGES }}
    />
  );
}
