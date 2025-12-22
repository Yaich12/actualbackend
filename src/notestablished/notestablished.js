import React, { useEffect, useMemo, useState } from 'react';
import './notestablished.css';
import { useNavigate } from 'react-router-dom';
import { Rocket, Layers, LineChart, NotebookPen } from 'lucide-react';
import RadialOrbitalTimeline from 'components/ui/radial-orbital-timeline';

function NotEstablishedPage() {
  const navigate = useNavigate();
  const [launchPlannerDone, setLaunchPlannerDone] = useState(false);
  const [digitalFrontDone, setDigitalFrontDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setLaunchPlannerDone(window.localStorage.getItem('selmaLaunchPlannerComplete') === '1');
      setDigitalFrontDone(window.localStorage.getItem('selmaDigitalFrontComplete') === '1');
    } catch (_) {}
  }, []);

  // Transform steps data into timeline format
  const timelineData = useMemo(() => {
    const step3Status = digitalFrontDone ? 'in-progress' : 'pending';
    const step3Energy = digitalFrontDone ? 65 : 50;

    return [
      {
        id: 1,
        title: 'Go-independent Launch Planner',
        date: 'Trin 1',
        content:
          'Find ud af hvem du er, hvem du vil hjælpe, og hvad din klinik skal være kendt for. Vi omsætter dine svar til en klar plan, der er nem at følge.',
        category: 'Setup',
        icon: Rocket,
        relatedIds: [2],
        status: launchPlannerDone ? 'completed' : 'in-progress',
        energy: 100,
        cta: {
          label: 'Start your journey',
          to: '/getting-started/start',
          description: '10–15 min · Guided spørgsmål · Klar plan bagefter',
          variant: 'default',
        },
      },
      {
        id: 2,
        title: 'Byg din digitale front',
        date: 'Trin 2',
        content:
          'Lav en enkel klinikside (hero, ydelser, trust, kontakt og booking-CTA) ud fra dine svar – og se den live med det samme.',
        category: 'Digital',
        icon: Layers,
        relatedIds: [1, 3],
        status: !launchPlannerDone ? 'pending' : digitalFrontDone ? 'completed' : 'in-progress',
        energy: digitalFrontDone ? 95 : 75,
        cta: {
          label: 'Byg din digitale front',
          to: '/getting-started/digital-front',
          description: launchPlannerDone
            ? 'Mini-builder · Live preview · Gem når du er klar'
            : 'Fuldfør trin 1 først',
          disabled: !launchPlannerDone,
          variant: 'secondary',
        },
      },
      {
        id: 3,
        title: 'Gør din kalender levende',
        date: 'Trin 3',
        content:
          'Brug et simpelt, skræddersyet bookingsystem, der er nemt at navigere i, og som indeholder smarte AI-funktioner til journal, opfølgning og overblik over dine klienter.',
        category: 'System',
        icon: NotebookPen,
        relatedIds: [2, 4],
        status: step3Status,
        energy: step3Energy,
      },
      {
        id: 4,
        title: 'Tænd for markedsføringen (valgfrit)',
        date: 'Trin 4',
        content:
          'Bliv taget i hånden af vores samarbejdspartnere til den bedste pris. Få annoncer på flere sociale medier, så de rigtige klienter finder dig – uden at du skal være marketingekspert.',
        category: 'Marketing',
        icon: LineChart,
        relatedIds: [3],
        status: 'pending',
        energy: 25,
      },
    ];
  }, [digitalFrontDone, launchPlannerDone]);

  return (
    <div className="ne-root">
      <button
        type="button"
        className="ne-back-btn"
        onClick={() => navigate('/welcome')}
      >
        ← Tilbage
      </button>
      <div className="ne-header-overlay">
        <header className="ne-header">
          <p className="ne-eyebrow">Onboarding</p>
          <h1 className="ne-title">Du er endnu ikke fuldt etableret</h1>
          <p className="ne-subtitle">
            Byg din klinik stille og roligt – vi hjælper dig med struktur, booking og de første klienter.
          </p>
          <div className="ne-stats">
            <p className="ne-stat">+1.000 værktøjer downloadet</p>
            <p className="ne-stat">Bedømt 5/5 af klinikejere</p>
          </div>
          <div className="ne-cta-row">
            <button
              type="button"
              className="ne-button primary big"
              onClick={() => navigate('/getting-started/start')}
            >
              Start your journey
            </button>
            <button
              type="button"
              className="ne-button ghost big"
              disabled={!launchPlannerDone}
              onClick={() => navigate('/getting-started/digital-front')}
            >
              Byg din digitale front
            </button>
          </div>
        </header>
      </div>
      <RadialOrbitalTimeline timelineData={timelineData} />
    </div>
  );
}

export default NotEstablishedPage;
