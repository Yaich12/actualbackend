import React, { useState } from 'react';
import './ai.css';
import { Brain, BookOpenCheck, Route, UserCircle2, ArrowRight } from 'lucide-react';

function AiPanel() {
  const mockPatients = [
    { id: 'p1', name: 'Monique' },
    { id: 'p2', name: 'Lars Petersen' },
    { id: 'p3', name: 'Ny patient' },
  ];

  const agents = [
    {
      id: 'reasoner',
      name: 'Agent 1 · Ræsonnering',
      short: 'Dybt klinisk ræsonnement',
      icon: <Brain className="ai-icon" />,
      description:
        'Bruges når du vil have hjælp til at strukturere fund, differentialdiagnoser og næste skridt.',
      superpowers: [
        'Tænker højt sammen med dig',
        'Vender for og imod forskellige hypoteser',
        'Hjælper med at prioritere næste tiltag',
      ],
    },
    {
      id: 'guidelines',
      name: 'Agent 2 · Evidens & retningslinjer',
      short: 'Guidelines og anbefalinger',
      icon: <BookOpenCheck className="ai-icon" />,
      description:
        'Bruges når du vil have koblet patientens situation til kliniske retningslinjer og anbefalinger.',
      superpowers: [
        'Finder relevante anbefalinger',
        'Sammenholder guideline med din case',
        'Foreslår realistiske tilpasninger',
      ],
    },
    {
      id: 'planner',
      name: 'Agent 3 · Forløbsplanlægger',
      short: 'Plan for hele forløbet',
      icon: <Route className="ai-icon" />,
      description:
        'Bruges når du vil have et overskueligt forløb med sessioner, progression og hjemmetræning.',
      superpowers: [
        'Foreslår struktur for forløb',
        'Fordeler fokus over flere sessioner',
        'Hjælper med realistiske mål og milepæle',
      ],
    },
  ];

  const [selectedPatients, setSelectedPatients] = useState({
    reasoner: '',
    guidelines: '',
    planner: '',
  });

  const handleSelectPatient = (agentId, value) => {
    setSelectedPatients((prev) => ({
      ...prev,
      [agentId]: value,
    }));
  };

  const handleOpenAgent = (agent) => {
    const patientId = selectedPatients[agent.id];
    if (!patientId) {
      alert(`Vælg en patient før du åbner ${agent.name}.`);
      return;
    }
    const patientName = mockPatients.find((p) => p.id === patientId)?.name || 'ukendt';
    alert(`Åbner ${agent.name} for patient: ${patientName} (funktionalitet kommer senere).`);
  };

  return (
    <div className="ai-panel">
      <div className="ai-topbar">
        <div className="ai-topbar-left">
          <Brain className="ai-topbar-icon" />
          <div>
            <div className="ai-topbar-title">AI-agenter</div>
            <div className="ai-topbar-subtitle">
              Vælg agent og patient – funktionalitet kommer snart.
            </div>
          </div>
        </div>
      </div>

      <div className="ai-banner">
        <div className="ai-banner-left">
          <div className="ai-avatar">
            <UserCircle2 className="ai-avatar-icon" />
          </div>
          <div>
            <div className="ai-banner-title">Vælg agent · Vælg patient · Start dialog</div>
            <div className="ai-banner-subtitle">
              Du kan skifte agent undervejs, men altid med samme patient i fokus.
            </div>
          </div>
        </div>
        <div className="ai-banner-right">
          <span>Kommer snart</span>
          <ArrowRight className="ai-banner-arrow" />
        </div>
      </div>

      <div className="ai-cards">
        {agents.map((agent) => (
          <div key={agent.id} className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-icon">{agent.icon}</div>
              <div className="ai-card-titles">
                <div className="ai-card-name">{agent.name}</div>
                <div className="ai-card-short">{agent.short}</div>
              </div>
            </div>

            <p className="ai-card-description">{agent.description}</p>

            <div className="ai-card-section">
              <div className="ai-card-section-title">Styrker</div>
              <ul className="ai-list">
                {agent.superpowers.map((s, idx) => (
                  <li key={idx} className="ai-list-item">
                    <span className="ai-bullet" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ai-card-section ai-card-footer">
              <label className="ai-select-label">Patient til denne agent</label>
              <select
                className="ai-select"
                value={selectedPatients[agent.id] || ''}
                onChange={(e) => handleSelectPatient(agent.id, e.target.value)}
              >
                <option value="">Vælg patient…</option>
                {mockPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="button" className="ai-open-btn" onClick={() => handleOpenAgent(agent)}>
                Åbn {agent.shortName || agent.name}
                <ArrowRight className="ai-open-arrow" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AiPanel;

