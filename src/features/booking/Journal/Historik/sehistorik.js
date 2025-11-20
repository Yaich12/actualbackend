import React, { useEffect, useMemo, useState } from 'react';
import './sehistorik.css';
import Indlæg from '../indlæg/indlæg';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

const sanitizeIdentifier = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const deriveUserIdentifier = (user) => {
  if (!user) {
    return 'unknown-user';
  }

  const baseIdentifier =
    (user.displayName && user.displayName.trim()) ||
    (user.email && user.email.trim()) ||
    user.uid ||
    'unknown-user';

  const sanitized = sanitizeIdentifier(baseIdentifier);
  if (sanitized) {
    return sanitized;
  }

  if (user.uid) {
    return sanitizeIdentifier(user.uid);
  }

  return 'unknown-user';
};

function SeHistorik({ clientName, onClose }) {
  const [showCreateEntry, setShowCreateEntry] = useState(false);
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
    let isCancelled = false;

    const fetchEntries = async () => {
      if (!user) {
        setEntries([]);
        setIsLoadingEntries(false);
        setLoadError('Du skal være logget ind for at se journaler.');
        return;
      }

      setIsLoadingEntries(true);
      setLoadError('');

      try {
        const userIdentifier = deriveUserIdentifier(user);
        const folderCandidates = Array.from(
          new Set(
            [userIdentifier, user.uid].filter(
              (candidate) => typeof candidate === 'string' && candidate.trim().length > 0
            )
          )
        );

        const fetchEntriesFromFolder = async (folderName) => {
          if (!folderName) {
            return [];
          }

          const folderRef = ref(storage, `userindlæg/${folderName}`);
          const listResult = await listAll(folderRef);

          const entries = await Promise.all(
            listResult.items.map(async (itemRef) => {
              try {
                const url = await getDownloadURL(itemRef);
                const response = await fetch(url);
                if (!response.ok) {
                  throw new Error(`Failed to fetch ${itemRef.fullPath}`);
                }
                const data = await response.json();
                return {
                  id: itemRef.fullPath,
                  storagePath: itemRef.fullPath,
                  ...data,
                };
              } catch (entryError) {
                console.error('Failed to load journal entry:', entryError);
                return null;
              }
            })
          );

          return entries.filter(Boolean);
        };

        const fetchedEntriesArrays = await Promise.all(
          folderCandidates.map((folderName) => fetchEntriesFromFolder(folderName))
        );

        const fetchedEntries = fetchedEntriesArrays
          .flat()
          .filter(Boolean)
          .sort((a, b) => {
            const first = new Date(a.createdAt || a.date || 0).getTime();
            const second = new Date(b.createdAt || b.date || 0).getTime();
            return second - first;
          });

        if (!isCancelled) {
          setEntries(fetchedEntries);
        }
      } catch (error) {
        if (!isCancelled) {
          if (error?.code === 'storage/object-not-found') {
            setEntries([]);
            setLoadError('');
          } else {
            console.error('Failed to list journal entries:', error);
            setLoadError('Kunne ikke hente journalindlæg. Prøv igen senere.');
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingEntries(false);
        }
      }
    };

    fetchEntries();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const filteredEntries = useMemo(() => {
    if (!clientName) {
      return entries;
    }
    return entries.filter(
      (entry) => (entry.clientName || '').toLowerCase() === clientName.toLowerCase()
    );
  }, [entries, clientName]);

  const handleCreateEntry = () => {
    setShowCreateEntry(true);
  };

  const handleSaveEntry = (newEntry) => {
    setEntries((prev) => {
      const updated = [newEntry, ...prev];
      return updated.sort((a, b) => {
        const first = new Date(a.createdAt || a.date || 0).getTime();
        const second = new Date(b.createdAt || b.date || 0).getTime();
        return second - first;
      });
    });
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
