import React from 'react';
import './scroll.css';
import { DemoOne } from '../../components/ui/text-parallax-content-demo';
import HeroDevices from './HeroDevices';

function ScrollSection() {
  return (
    <section className="scroll-section" id="scroll-parallax">
      <DemoOne />
      <HeroDevices />
    </section>
  );
}

export default ScrollSection;
