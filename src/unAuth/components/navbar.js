import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import './navbar.css';

const menuItems = [
  { label: 'Features', href: '#benefits' },
  { label: 'Pricing', href: '#specifications' },
  { label: 'Contact Us', href: '#contact' },
];

function Navbar() {
  const { user } = useAuth();
  const ctaPath = user ? '/dashboard' : '/signup';
  const ctaLabel = user ? 'Go to dashboard' : 'Try For Free';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <a className="navbar-logo" href="/" aria-label="Selma home">
          <img
            src="/assets/selmalogo.png"
            alt="Selma logo"
            className="navbar-logo-img"
          />
          <span className="navbar-logo-text">meget mere end bare et booking system</span>
        </a>

        <div className="navbar-right">
          <ul className="navbar-menu">
            {menuItems.map((item) => (
              <li key={item.label} className="navbar-item">
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>

          <Link to={ctaPath} className="navbar-cta">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
