import React from 'react';
import './navbar.css';

const menuItems = [
  { label: 'Benefits', href: '#benefits' },
  { label: 'Specifications', href: '#specifications' },
  { label: 'How-to', href: '#how-to' },
  { label: 'Contact Us', href: '#contact' },
];

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <a className="navbar-logo" href="/" aria-label="Selma home">
          <img
            src="/assets/selmalogo.png"
            alt="Selma logo"
            className="navbar-logo-img"
          />
        </a>

        <div className="navbar-right">
          <ul className="navbar-menu">
            {menuItems.map((item) => (
              <li key={item.label} className="navbar-item">
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>

          <a className="navbar-cta" href="#learn-more">
            Learn More
          </a>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
