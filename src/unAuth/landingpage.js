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
      <h1 className="landing-title">Hello Landing Page</h1>
      <Atlas />
      <Axis />
      <Footer />
    </div>
  );
}

export default LandingPage;

