import React from 'react';
import { Box, Cog, Lock, Search, Sparkles } from 'lucide-react';
import './both.css';

const cards = [
  {
    id: 'atlas',
    label: 'Atlas · Klinisk sparring',
    title: 'Differentier på få sekunder',
    description: 'Atlas foreslår differentialdiagnoser, kliniske tests og behandlingsplaner på dansk.',
    icon: Sparkles,
  },
  {
    id: 'axis',
    label: 'Axis · Journal & dokumentation',
    title: 'Journalen er skrevet, før du siger farvel',
    description: 'Axis transskriberer samtaler live, foreslår ICD/ICF-koder og organiserer progression.',
    icon: Cog,
  },
  {
    id: 'admin',
    label: 'Administration · Digital sekretær',
    title: 'Telefon, booking og betalinger behandlet automatisk',
    description: 'Afbud, ventelister og reminder-flow kører i baggrunden, så kalenderen altid er opdateret.',
    icon: Box,
  },
  {
    id: 'compliance',
    label: 'Sikkerhed & compliance',
    title: 'Bygget til sundhedsdata i EU',
    description: 'Krypterede pipelines, adgangsroller og audit-logs, så du overholder krav uden ekstra arbejde.',
    icon: Lock,
  },
  {
    id: 'marketplace',
    label: 'Selma Labs',
    title: 'Snart: Personlige automations',
    description: 'Vi bygger færdige flows til henvisninger, genkald og outcome-tracking – klar til din klinik.',
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
