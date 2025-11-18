import React from 'react';
import './landingpage.css';
import Navbar from './components/navbar';
import Frontpage from './components/frontpage';
import Axis from './components/kalender';
import Both from './components/Both';
import Footer from './components/footer';

function LandingPage() {
  return (
    <div className="landing-page">
      <Navbar />
      <Frontpage />
      <Axis />
      <Both />
      <Footer />
    </div>
  );
}

export default LandingPage;
