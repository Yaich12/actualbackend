import React from 'react';
import './landingpage.css';
import Navbar from './components/navbar';
import Atlas from './components/atlas';
import Axis from './components/axis';
import Footer from './components/footer';

function LandingPage() {
  return (
    <div className="landing-page">
      <Navbar />
      <Atlas />
      <Axis />
      <Footer />
    </div>
  );
}

export default LandingPage;
