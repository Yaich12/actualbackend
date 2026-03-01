import React from 'react';
import './scroll.css';
import HeroDevices from './HeroDevices';
import AboutSection3 from 'components/ui/about-section';
import Preview from './preview';

function ScrollSection() {
  return (
    <section className="scroll-section" id="scroll-parallax">
      <HeroDevices />
      <div id="about">
        <AboutSection3 />
      </div>
      <Preview />
    </section>
  );
}

export default ScrollSection;
