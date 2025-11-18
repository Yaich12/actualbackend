import React, { useState } from 'react';
import './sehistorik.css';
import Indlæg from '../indlæg/indlæg';

// Mock data for journal entries - in a real app, this would come from a database
const initialJournalEntries = [
  {
    id: 1,
    title: 'første konsultation',
    date: '14-11-2025',
    content: 'hej jeg elsker pizza',
    isStarred: false,
    isLocked: false,
  },
  {
    id: 2,
    title: 'Opfølgning',
    date: '13-11-2025',
    content: 'Patienten reagerede godt på behandlingen. Fortsæt med samme tilgang.',
    isStarred: true,
    isLocked: false,
  },
  {
    id: 3,
    title: 'Indledende samtale',
    date: '10-11-2025',
    content: 'Gennemgik patientens historie og nuværende symptomer. Planlagt opfølgning.',
    isStarred: false,
    isLocked: true,
  },
];

function SeHistorik({ clientName, onClose }) {
  const [showCreateEntry, setShowCreateEntry] = useState(false);
  const [entries, setEntries] = useState(initialJournalEntries);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  const handleEdit = (entryId) => {
    // Handle edit functionality
    console.log('Edit entry:', entryId);
  };

  const handleStar = (entryId) => {
    // Handle star functionality
    console.log('Star entry:', entryId);
  };

  const handleLock = (entryId) => {
    // Handle lock functionality
    console.log('Lock entry:', entryId);
  };

  const handleMoreOptions = (entryId) => {
    // Handle more options
    console.log('More options for entry:', entryId);
  };

  const handleOpenOverview = (entryId) => {
    // Handle open overview
    console.log('Open overview for entry:', entryId);
  };

  const handleCreateEntry = () => {
    setShowCreateEntry(true);
  };

  const handleSaveEntry = (newEntry) => {
    setEntries((prev) => [newEntry, ...prev]);
    setShowCreateEntry(false);
  };

  // If showing create entry form, render Indlæg component
  if (showCreateEntry) {
    return (
      <Indlæg
        clientName={clientName}
        onClose={() => setShowCreateEntry(false)}
        onSave={handleSaveEntry}
      />
    );
  }

  return (
    <div className="sehistorik-container">
      {/* Header */}
      <div className="sehistorik-header">
        <div className="sehistorik-header-top">
          <div className="sehistorik-title-section">
            <h2 className="sehistorik-title">Journal</h2>
            <span className="sehistorik-client-name">{clientName}</span>
          </div>
          <div className="sehistorik-header-actions">
            <button className="sehistorik-create-entry-btn" onClick={handleCreateEntry}>
              <span className="sehistorik-plus-icon">+</span>
              Opret indlæg
            </button>
            <button className="sehistorik-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="sehistorik-content">
        {entries.length === 0 ? (
          <div className="sehistorik-empty">
            <p>Ingen journalindlæg endnu</p>
          </div>
        ) : (
          <div className="sehistorik-entries">
            {entries.map((entry) => (
              <div key={entry.id} className="sehistorik-entry-card">
                <div className="sehistorik-entry-header">
                  <div className="sehistorik-entry-title-section">
                    <h3 className="sehistorik-entry-title">
                      {entry.title} {formatDate(entry.date)}
                    </h3>
                  </div>
                  <div className="sehistorik-entry-actions">
                    <button 
                      className={`sehistorik-icon-btn ${entry.isStarred ? 'starred' : ''}`}
                      onClick={() => handleStar(entry.id)}
                      title="Markér som favorit"
                    >
                      ⭐
                    </button>
                    <button 
                      className={`sehistorik-icon-btn ${entry.isLocked ? 'locked' : ''}`}
                      onClick={() => handleLock(entry.id)}
                      title="Lås/oplås indlæg"
                    >
                      🔒
                    </button>
                    <button 
                      className="sehistorik-icon-btn"
                      onClick={() => handleEdit(entry.id)}
                      title="Rediger"
                    >
                      ✏️
                    </button>
                    <button 
                      className="sehistorik-icon-btn"
                      onClick={() => handleMoreOptions(entry.id)}
                      title="Flere muligheder"
                    >
                      ⋯
                    </button>
                  </div>
                </div>
                <div className="sehistorik-entry-content">
                  {entry.content}
                </div>
                <div className="sehistorik-entry-footer">
                  <button 
                    className="sehistorik-open-overview-btn"
                    onClick={() => handleOpenOverview(entry.id)}
                  >
                    Åben oversigt
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SeHistorik;
