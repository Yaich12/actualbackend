import React, { useEffect, useMemo, useState } from 'react';
import './sehistorik.css';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

function SeHistorik({ clientId, clientName, onClose, onCreateEntry }) {
  const [entries, setEntries] = useState([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { user } = useAuth();

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

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setIsLoadingEntries(false);
      setLoadError('Du skal være logget ind for at se journaler.');
      return;
    }

    if (!clientId) {
      setEntries([]);
      setIsLoadingEntries(false);
      setLoadError('Manglende klient-id for at hente journaler.');
      return;
    }

    setIsLoadingEntries(true);
    setLoadError('');

    const entriesRef = collection(
      db,
      'users',
      user.uid,
      'clients',
      clientId,
      'journalEntries'
    );
    const entriesQuery = query(entriesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((doc) => {
          const data = doc.data();
          const createdAt =
            typeof data.createdAt?.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : data.createdAtIso || null;
          return {
            id: doc.id,
            ...data,
            createdAt,
          };
        });
        setEntries(mapped);
        setIsLoadingEntries(false);
      },
      (error) => {
        console.error('Failed to list journal entries:', error);
        setEntries([]);
        setLoadError('Kunne ikke hente journalindlæg. Prøv igen senere.');
        setIsLoadingEntries(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, clientId]);

  const filteredEntries = useMemo(() => {
    if (!clientName) {
      return entries;
    }
    return entries.filter(
      (entry) => (entry.clientName || '').toLowerCase() === clientName.toLowerCase()
    );
  }, [entries, clientName]);

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
            <button
              className="sehistorik-create-entry-btn"
              onClick={() => onCreateEntry && onCreateEntry()}
            >
              <span className="sehistorik-plus-icon">+</span>
              Opret indlæg
            </button>
            <button className="sehistorik-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="sehistorik-content">
        {isLoadingEntries ? (
          <div className="sehistorik-empty">
            <p>Henter journalindlæg...</p>
          </div>
        ) : loadError ? (
          <div className="sehistorik-empty">
            <p>{loadError}</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="sehistorik-empty">
            <p>Ingen journalindlæg endnu</p>
          </div>
        ) : (
          <div className="sehistorik-entries">
            {filteredEntries.map((entry) => (
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
