import React from 'react';
import './scroll.css';
import { DemoOne } from '../../components/ui/text-parallax-content-demo';
import LivingPlusDemo from 'components/ui/living-plus-demo';

function ScrollSection() {
  return (
    <section className="scroll-section" id="scroll-parallax">
      <DemoOne />
      <div className="scroll-featured">
        <LivingPlusDemo />
      </div>
    </section>
  );
}

export default ScrollSection;

