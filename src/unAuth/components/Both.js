import React from 'react';
import { FeatureCarousel } from '../../components/ui/animated-feature-carousel';

// Steps data matching the original Both cards
const customSteps = [
  {
    id: '1',
    name: 'Atlas · CLINICAL SPARRING',
    title: 'Differentiate in seconds',
    description: 'Atlas suggests differential diagnoses, relevant clinical tests, and clear treatment pathways — in every language',
  },
  {
    id: '2',
    name: 'Axis · NOTES & DOCUMENTATION',
    title: 'The note is done before you say goodbye',
    description: 'Axis transcribes sessions live, proposes ICD/ICF codes, and structures progression automatically.',
  },
  {
    id: '3',
    name: 'Action Planner',
    title: 'Personalized next steps for every patient',
    description: 'Action Planner turns your findings into clear, tailored recommendations — exercises, progression, and follow-ups — so each patient leaves with a concrete plan that fits their needs.',
  },
  {
    id: '4',
    name: 'Guideline Guide',
    title: 'Built for EU healthcare compliance',
    description: 'Encrypted data pipelines, role-based access, and audit logs — so you meet GDPR and health-data requirements while staying clinically safe.',
  },
];

const images = {
  alt: 'Feature screenshot',
  step1img1: `${process.env.PUBLIC_URL || ''}/hero-2/pexels-thirdman-5060985.jpg`,
  step1img2: `${process.env.PUBLIC_URL || ''}/hero-2/pexels-thirdman-5060985.jpg`,
  step2img1: `${process.env.PUBLIC_URL || ''}/hero-2/pexels-shkrabaanthony-5217850.jpg`,
  step2img2: `${process.env.PUBLIC_URL || ''}/hero-2/pexels-shkrabaanthony-5217850.jpg`,
  step3img: `${process.env.PUBLIC_URL || ''}/hero-2/pexels-yankrukov-5793798.jpg`,
  step4img: `${process.env.PUBLIC_URL || ''}/hero-2/pexels-eberhardgross-1743364.jpg`,
};

function Both() {
  return (
    <section className="both" id="produkter">
      <div className="both-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 clamp(1.25rem, 3vw, 2.5rem)' }}>
        <FeatureCarousel image={images} steps={customSteps} />
      </div>
    </section>
  );
}

export default Both;
