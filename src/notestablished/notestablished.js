import React from 'react';
import './notestablished.css';
import { useNavigate } from 'react-router-dom';
import { Rocket, Layers, LineChart, NotebookPen } from 'lucide-react';
import RadialOrbitalTimeline from 'components/ui/radial-orbital-timeline';

function NotEstablishedPage() {
  const navigate = useNavigate();

  // Transform steps data into timeline format
  const timelineData = [
    {
      id: 1,
      title: 'Go-independent Launch Planner',
      date: 'Trin 1',
      content:
        'The Go-independent Launch Planner helps health professionals turn a vague idea into a concrete, launch-ready practice. In a few focused steps you define who you serve, what you offer, how you structure your business, and what you need in place to work safely and professionally.',
      category: 'Setup',
      icon: Rocket,
      relatedIds: [2],
      status: 'completed',
      energy: 100,
    },
    {
      id: 2,
      title: 'Byg din digitale front',
      date: 'Trin 2',
      content:
        'Få en enkel hjemmeside og landingsside, hvor klienter kan læse om dig, dine forløb og booke tid – samt erhvervsprofiler på relevante platforme, der kan opdateres automatisk eller nudger dig til at poste nyt indhold.',
      category: 'Digital',
      icon: Layers,
      relatedIds: [1, 3],
      status: 'in-progress',
      energy: 75,
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
      status: 'pending',
      energy: 50,
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
        </header>
      </div>
      <RadialOrbitalTimeline timelineData={timelineData} />
    </div>
  );
}

export default NotEstablishedPage;
