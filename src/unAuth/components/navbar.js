import React, { useMemo } from 'react';
import {
  Bot,
  CalendarDays,
  LayoutTemplate,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import './navbar.css';
import { Navbar1 } from '../../components/blocks/shadcnblocks-com-navbar1';

function Navbar() {
  const { user } = useAuth();
  const ctaPath = user ? '/booking' : '/signup';
  const ctaLabel = user ? 'Go to booking' : 'Try For Free';

  const menu = useMemo(
    () => [
      {
        title: 'Solutions',
        url: '#solutions',
        itemsHeader: 'By business size',
        items: [
          {
            title: 'Individuals',
            description: 'For solo practitioners',
            url: '#solutions-individuals',
            icon: <UserRound className="h-5 w-5" />,
          },
          {
            title: 'Small business',
            description: 'For growing clinics',
            url: '#solutions-small-business',
            icon: <Users className="h-5 w-5" />,
          },
        ],
        featured: {
          title: 'For healthcare practitioners',
          description: 'Patient-first workflows for modern clinics.',
          url: '#healthcare',
          image: '/hero-2/pexels-yankrukov-5793904.jpg',
          alt: 'Physiotherapist working with a patient',
          syncWithHeroVideo: true,
        },
      },
      {
        title: 'Features',
        url: '#features',
        itemsHeader: 'Features',
        itemsColumns: 2,
        items: [
          {
            title: 'Transsscprition and FactsR',
            url: '/transcription-factsr#factsr-section',
            icon: <Sparkles className="h-5 w-5" />,
          },
          {
            title: 'Intelligent booking system',
            url: '/features',
            icon: <CalendarDays className="h-5 w-5" />,
          },
          {
            title: 'Selma Copilot',
            url: '/selma-copilot',
            icon: <Bot className="h-5 w-5" />,
          },
          {
            title: 'Klinik-hjemmeside',
            url: '/website-builder#booking-flow',
            icon: <LayoutTemplate className="h-5 w-5" />,
          },
        ],
      },
      {
        title: 'Supported professions for now',
        url: '#professions',
        itemsHeader: 'Supported professions (for now)',
        itemsNote: 'Only these three for now. More professions coming soon.',
        items: [
          { title: 'Physiotherapists', url: '#profession-physio' },
          { title: 'Osteopaths', url: '#profession-osteo' },
          { title: 'Chiropractors', url: '#profession-chiro' },
        ],
      },
      { title: 'Pricing', url: '#pricing' },
    ],
    []
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
            alt: 'Selma+',
            title: 'Selma+',
            tagline: 'Much more than just a booking system.',
          }}
          menu={menu}
          mobileExtraLinks={[]}
          auth={{
            login: { text: 'Contact', url: '#contact' },
            signup: { text: ctaLabel, url: ctaPath },
          }}
        />
      </div>
    </nav>
  );
}

export default Navbar;
