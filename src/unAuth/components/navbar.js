import React, { useMemo } from 'react';
import { useAuth } from '../../AuthContext';
import './navbar.css';
import { Navbar1 } from '../../components/blocks/shadcnblocks-com-navbar1';

function Navbar() {
  const { user } = useAuth();
  const ctaPath = user ? '/booking' : '/signup';
  const ctaLabel = user ? 'Go to booking' : 'Try For Free';

  const menu = useMemo(
    () => [
      { title: 'Features', url: '#benefits' },
      { title: 'Pricing', url: '#specifications' },
      { title: 'Contact Us', url: '#contact' },
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
