import React from 'react';
import './demo.css';
import { Rocket, Layers, LineChart, NotebookPen } from 'lucide-react';
import RadialOrbitalTimeline from 'components/ui/radial-orbital-timeline';
import { TextGenerateEffect } from '../../components/ui/text-generate-effect';
import { useLanguage } from '../language/LanguageProvider';

function Demo() {
  const { t, getArray } = useLanguage();
  // Transform steps data into timeline format
  const timelineCopy = getArray('landing.demo.timeline', []);
  const timelineBase = [
    {
      id: 1,
      icon: Rocket,
      relatedIds: [2],
      status: 'completed',
      energy: 100,
    },
    {
      id: 2,
      icon: Layers,
      relatedIds: [1, 3],
      status: 'in-progress',
      energy: 75,
    },
    {
      id: 3,
      icon: NotebookPen,
      relatedIds: [2, 4],
      status: 'pending',
      energy: 50,
    },
    {
      id: 4,
      icon: LineChart,
      relatedIds: [3],
      status: 'pending',
      energy: 25,
    },
  ];

  const timelineData = timelineBase.map((item, index) => ({
    ...item,
    title: timelineCopy[index]?.title ?? '',
    date: timelineCopy[index]?.date ?? '',
    content: timelineCopy[index]?.content ?? '',
    category: timelineCopy[index]?.category ?? '',
  }));

  const words = t('landing.demo.words');

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
