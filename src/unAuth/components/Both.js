import React from 'react';
import { Box, Cog, Lock, Search, Sparkles } from 'lucide-react';
import './both.css';

const cards = [
  {
    id: 'atlas',
    label: 'Atlas · CLINICAL SPARRING',
    title: 'Differentiate in seconds',
    description: 'Atlas suggests differential diagnoses, relevant clinical tests, and clear treatment pathways — in every language',
    icon: Sparkles,
  },
  {
    id: 'axis',
    label: 'Axis · NOTES & DOCUMENTATION',
    title: 'The note is done before you say goodbye',
    description: 'Axis transcribes sessions live, proposes ICD/ICF codes, and structures progression automatically.',
    icon: Cog,
  },
  {
    id: 'admnin',
    label: 'Action Planner',
    title: 'Personalized next steps for every patient',
    description: 'Action Planner turns your findings into clear, tailored recommendations — exercises, progression, and follow-ups — so each patient leaves with a concrete plan that fits their needs.',
    icon: Box,
  },
  {
    id: 'compliance',
    label: 'Guideline Guide ',
    title: 'Built for EU healthcare compliance',
    description: 'Encrypted data pipelines, role-based access, and audit logs — so you meet GDPR and health-data requirements while staying clinically safe.',
    icon: Lock,
  },
  {
    id: 'marketplace',
    label: 'Administration',
    title: 'Meet Suzan, your digital clinic secretary',
    description: 'Ready-made workflows for referrals, recalls, and outcome tracking — plug-and-play for your practice.',
    icon: Search,
    size: 'wide',
  },
];

function Both() {
  const handleMouseMove = (event) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--glow-x', `${x}%`);
    card.style.setProperty('--glow-y', `${y}%`);
    card.style.setProperty('--glow-active', '1');

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI + 180;
    card.style.setProperty('--glow-angle', `${angle}deg`);
  };

  const handleMouseLeave = (event) => {
    const card = event.currentTarget;
    card.style.removeProperty('--glow-x');
    card.style.removeProperty('--glow-y');
    card.style.setProperty('--glow-active', '0');
  };

  return (
    <section className="both" id="produkter">
      <div className="both-shell">
        <div className="both-grid">
          {cards.map((card) => {
            const Icon = card.icon;
            const classes = [
              'both-card',
              card.size === 'wide' ? 'both-card--wide' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <article
                key={card.id}
                className={classes}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <span className="both-card-spotlight" aria-hidden="true" />
                <div className="both-card-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <span className="both-card-label">{card.label}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Both;
