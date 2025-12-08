import React from 'react';
import './demo.css';
import { Rocket, Layers, LineChart, NotebookPen } from 'lucide-react';
import RadialOrbitalTimeline from 'components/ui/radial-orbital-timeline';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';

function Demo() {
  // Transform steps data into timeline format
  const timelineData = [
    {
      id: 1,
      title: 'Find din lokation',
      date: 'Trin 1',
      content:
        'Bliv guidet til at finde et fysisk sted, hvor du kan udøve din praksis – klinik, lejet lokale eller samarbejde med andre behandlere.',
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

  const words = `Selma+ is for practitioners who feel there might be more and think: "Why not me?"\n\nWe give you calm, structure, and a clear overview, so the step you've been thinking about starts to feel possible.`;

  return (
    <div className="demo-root">
      <div className="demo-text-overlay">
        <TextGenerateEffect words={words} duration={0.5} filter={true} />
      </div>
      <RadialOrbitalTimeline timelineData={timelineData} />
    </div>
  );
}

export default Demo;

