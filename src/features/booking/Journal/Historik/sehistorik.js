import React, { useEffect, useState } from 'react';
import './sehistorik.css';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

function SeHistorik({ clientId, clientName, onClose }) {
  const [entries, setEntries] = useState([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryError, setSummaryError] = useState('');
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

  const handleSummarizePatient = async () => {
    if (!clientId || !user) {
      setSummaryError('Mangler klient eller bruger.');
      return;
    }

    if (!process.env.REACT_APP_SUMMARIZE_JOURNAL_URL) {
      setSummaryError('Manglende opsummerings-URL (REACT_APP_SUMMARIZE_JOURNAL_URL).');
      return;
    }

    try {
      setIsSummarizing(true);
      setSummaryError('');
      setSummaryText('');

      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setSummaryError('Kunne ikke hente login-token.');
        setIsSummarizing(false);
        return;
      }

      const res = await fetch(process.env.REACT_APP_SUMMARIZE_JOURNAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('summarize error', data);
        setSummaryError(data?.error || 'Ukendt fejl ved opsummering.');
        return;
      }

      setSummaryText(data?.summary || '');
    } catch (err) {
      console.error(err);
      setSummaryError('Der opstod en fejl. Prøv igen.');
    } finally {
      setIsSummarizing(false);
    }
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

  useEffect(() => {
    setSummaryText('');
    setSummaryError('');
    setIsSummarizing(false);
  }, [clientId]);

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
              onClick={handleSummarizePatient}
              disabled={isSummarizing}
            >
              {isSummarizing ? 'Opsummerer…' : 'Opsummér patient'}
            </button>
            <button className="sehistorik-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="sehistorik-content">
        {(summaryError || summaryText) && (
          <div className="sehistorik-summary">
            {summaryError && (
              <div className="sehistorik-summary-error" role="alert">
                {summaryError}
              </div>
            )}
            {summaryText && (
              <div className="sehistorik-summary-card">
                <h3>Opsummering af journal</h3>
                <pre>{summaryText}</pre>
              </div>
            )}
          </div>
        )}
        {isLoadingEntries ? (
          <div className="sehistorik-empty">
            <p>Henter journalindlæg...</p>
          </div>
        ) : loadError ? (
          <div className="sehistorik-empty">
            <p>{loadError}</p>
          </div>
        ) : entries.length === 0 ? (
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
                      {entry.title} {formatDate(entry.date)} {entry.isDraft ? '(kladde)' : ''}
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
