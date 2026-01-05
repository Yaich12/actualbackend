import React, { useMemo } from 'react';
import {
  Bot,
  CalendarDays,
  LineChart,
  LayoutTemplate,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../language/LanguageProvider';
import './navbar.css';
import { Navbar1 } from '../../components/blocks/shadcnblocks-com-navbar1';
import { LanguageSelectorDropdown } from '../../components/ui/language-selector-dropdown';

function Navbar() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const ctaPath = user ? '/booking' : '/signup';
  const ctaLabel = user
    ? t('navbar.cta.booking')
    : t('navbar.cta.tryFree');
  const brand = t('common.brand');
  const showCta = false;

  const languageOptions = [
    { code: 'da', label: t('navbar.languages.danish'), shortLabel: 'DA' },
    { code: 'en', label: t('navbar.languages.english'), shortLabel: 'EN' },
  ];

  const languageSelect = (
    <LanguageSelectorDropdown
      value={language}
      options={languageOptions}
      onChange={setLanguage}
      ariaLabel={t('navbar.languageLabel')}
    />
  );

  const menu = useMemo(
    () => [
      {
        title: t('navbar.menu.solutions.title'),
        url: '#solutions',
        itemsHeader: t('navbar.menu.solutions.itemsHeader'),
        items: [
          {
            title: t('navbar.menu.solutions.items.individuals.title'),
            description: t('navbar.menu.solutions.items.individuals.description'),
            url: '#solutions-individuals',
            icon: <UserRound className="h-5 w-5" />,
          },
          {
            title: t('navbar.menu.solutions.items.smallBusiness.title'),
            description: t('navbar.menu.solutions.items.smallBusiness.description'),
            url: '#solutions-small-business',
            icon: <Users className="h-5 w-5" />,
          },
        ],
        dualList: {
          left: {
            header: t('navbar.menu.professions.itemsHeader'),
            note: t('navbar.menu.professions.itemsNote'),
            items: [
              { title: t('navbar.menu.professions.items.physio'), url: '#profession-physio' },
              { title: t('navbar.menu.professions.items.osteo'), url: '#profession-osteo' },
              { title: t('navbar.menu.professions.items.chiro'), url: '#profession-chiro' },
            ],
          },
          right: {
            header: t('navbar.menu.solutions.itemsHeader'),
            items: [
              {
                title: t('navbar.menu.solutions.items.individuals.title'),
                description: t('navbar.menu.solutions.items.individuals.description'),
                url: '#solutions-individuals',
                icon: <UserRound className="h-5 w-5" />,
              },
              {
                title: t('navbar.menu.solutions.items.smallBusiness.title'),
                description: t('navbar.menu.solutions.items.smallBusiness.description'),
                url: '#solutions-small-business',
                icon: <Users className="h-5 w-5" />,
              },
            ],
          },
        },
      },
      {
        title: t('navbar.menu.features.title'),
        url: '#features',
        itemsHeader: t('navbar.menu.features.itemsHeader'),
        itemsColumns: 2,
        items: [
          {
            title: t('navbar.menu.features.items.transcription.title'),
            url: '/transcription-factsr#factsr-section',
            icon: <Sparkles className="h-5 w-5" />,
          },
          {
            title: t('navbar.menu.features.items.booking.title'),
            url: '/features',
            icon: <CalendarDays className="h-5 w-5" />,
          },
          {
            title: t('navbar.menu.features.items.operations.title'),
            url: '/features/operations',
            icon: <LineChart className="h-5 w-5" />,
          },
          {
            title: t('navbar.menu.features.items.copilot.title'),
            url: '/selma-copilot',
            icon: <Bot className="h-5 w-5" />,
          },
          {
            title: t('navbar.menu.features.items.website.title'),
            url: '/website-builder#booking-flow',
            icon: <LayoutTemplate className="h-5 w-5" />,
          },
        ],
      },
      { title: t('navbar.menu.pricing.title'), url: '#pricing' },
    ],
    [t]
  );

  return (
    <nav className="navbar">
      <div className="navbar-container" style={{ width: '100%' }}>
        <Navbar1
          className="w-full"
          containerClassName="w-full"
          logo={{
            url: '/',
            src: '',
            alt: brand,
            title: brand,
            tagline: t('navbar.logo.tagline'),
          }}
          menu={menu}
          mobileExtraLinks={[]}
          auth={{
            loginNode: languageSelect,
            signup: showCta ? { text: ctaLabel, url: ctaPath } : null,
          }}
        />
      </div>
    </nav>
  );
}

export default Navbar;
