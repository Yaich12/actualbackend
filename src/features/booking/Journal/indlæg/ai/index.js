import React, { useState } from 'react';
import { Component as AiAssistantCard } from 'components/ui/ai-assistant-card';
import './ai.css';
import { Brain, BookOpenCheck, Route, ShieldCheck } from 'lucide-react';

function AiPanel({ clientId, clientName, draftText, onInsert }) {
  const [activeAgent, setActiveAgent] = useState(null);
  const agentCards = [
    {
      id: 'reasoner',
      name: 'Agent 1 · Ræsonnering',
      description: 'Hjælp mig med at strukturere fund, hypoteser og næste skridt.',
      icon: <Brain className="ai-agent-card-icon-svg" />,
    },
    {
      id: 'guidelines',
      name: 'Agent 2 · Evidens',
      description: 'Hent relevante guidelines og kvalitetstjek plan og træning.',
      icon: <BookOpenCheck className="ai-agent-card-icon-svg" />,
    },
    {
      id: 'planner',
      name: 'Agent 3 · Planlægning',
      description: 'Lav en tydelig plan med træning, progression og hjemmeprogram.',
      icon: <Route className="ai-agent-card-icon-svg" />,
    },
  ];

  const openAgent = (agentId) => {
    setActiveAgent(agentId);
  };

  const agentLabel = (id) => {
    if (id === 'reasoner') return 'Agent 1 · Ræsonnering';
    if (id === 'guidelines') return 'Agent 2 · Evidens & retningslinjer';
    if (id === 'planner') return 'Agent 3 · Forløbsplanlægger';
    return '';
  };

  return (
    <div className="ai-panel">
      {!activeAgent ? (
        <div className="ai-action-grid">
          {agentCards.map((agent) => (
            <div key={agent.id} className="ai-action-card">
              <div className="ai-action-card-header">
                <div className="ai-action-card-icon">{agent.icon}</div>
                <div className="ai-action-card-title">{agent.name}</div>
              </div>
              <p className="ai-action-card-description">{agent.description}</p>
              <button
                className="ai-action-card-btn"
                type="button"
                onClick={() => openAgent(agent.id)}
              >
                Åbn
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="ai-agent-wrapper">
          <div className="ai-agent-header">
            <span className="ai-agent-title">{agentLabel(activeAgent)}</span>
            <button className="ai-agent-close" onClick={() => setActiveAgent(null)}>
              Luk
            </button>
          </div>
          <div className="ai-agent-card">
            <AiAssistantCard
              agentId={activeAgent}
              clientId={clientId}
              draftText={draftText}
              onInsert={onInsert}
              agentTitle={agentLabel(activeAgent)}
              clientName={clientName || null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AiPanel;
