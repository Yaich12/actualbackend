import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import '../bookingpage.css';
import './klientoversigt.css';
import AddKlient from './addklient/addklient';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { useLanguage } from '../../../LanguageContext';
import { db } from '../../../firebase';
import { useUserClients } from './hooks/useUserClients';
import useAppointments from '../../../hooks/useAppointments';
import { ChevronDown } from 'lucide-react';

const getClientInitials = (client) => {
  const source = (client?.navn || client?.email || '').trim();
  if (!source) return '?';
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const ClientDetails = ({
  client,
  onBack,
  onEdit,
  onDelete,
  onCombine,
  onRequestStatusChange,
  onRequestConsent,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState('journal');
  const [goalDraft, setGoalDraft] = useState([]); // Array of { text: string, date: string }
  const [goalError, setGoalError] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { appointments = [], loading: appointmentsLoading } = useAppointments(userId || null);

  const tabs = [
    { id: 'journal', label: 'Journal' },
    { id: 'messages', label: 'Beskeder' },
    { id: 'events', label: 'Begivenheder' },
    { id: 'appointments', label: 'Aftaler' },
    { id: 'invoices', label: 'Fakturaer' },
    { id: 'goals', label: 'Mål' },
    { id: 'programs', label: 'Behandlingsforløb' },
  ];

  const location = [client?.by, client?.land].filter(Boolean).join(', ');
  const emailValue = client?.email || '—';
  const phoneValue = client?.telefon || '—';
  const addressValue = client?.adresse || '—';
  const statusValue = client?.status || 'Aktiv';

  useEffect(() => {
    // Load goals from client data - support both old format (string) and new format (array)
    const goalsData = client?.clientensoplysninger?.maalForForloebet || client?.maalForForloebet;
    if (Array.isArray(goalsData)) {
      setGoalDraft(goalsData);
    } else if (typeof goalsData === 'string' && goalsData.trim()) {
      // Migrate old string format to new array format
      setGoalDraft([{ text: goalsData, date: '' }]);
    } else {
      setGoalDraft([]);
    }
    setGoalError('');
  }, [client?.clientensoplysninger?.maalForForloebet, client?.maalForForloebet, client?.id]);

  useEffect(() => {
    if (!userId || !client?.id) {
      setJournalEntries([]);
      setJournalLoading(false);
      setJournalError('');
      return;
    }

    setJournalLoading(true);
    setJournalError('');

    const entriesRef = collection(
      db,
      'users',
      userId,
      'clients',
      client.id,
      'journalEntries'
    );
    const entriesQuery = query(entriesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((entryDoc) => {
          const data = entryDoc.data();
          const createdAt =
            typeof data.createdAt?.toDate === 'function'
              ? data.createdAt.toDate()
              : data.createdAtIso
              ? new Date(data.createdAtIso)
              : null;
          return {
            id: entryDoc.id,
            title: data.title || 'Journalnotat',
            date: data.date || '',
            content: data.content || data.summary || '',
            createdAt,
          };
        });
        setJournalEntries(mapped);
        setJournalLoading(false);
      },
      (error) => {
        console.error('[ClientDetails] Failed to load journal entries', error);
        setJournalEntries([]);
        setJournalLoading(false);
        setJournalError('Kunne ikke hente journalindlæg.');
      }
    );

    return () => unsubscribe();
  }, [userId, client?.id]);

  const normalizeValue = (value) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';

  const normalizePhone = (value) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : '';

  const clientAppointments = useMemo(() => {
    if (!client) return [];
    const clientEmail = normalizeValue(client.email);
    const clientPhone = normalizePhone(client.telefon);
    const clientName = normalizeValue(client.navn);

    return appointments
      .filter((appointment) => {
        if (!appointment) return false;
        if (client.id && appointment.clientId === client.id) return true;
        if (clientEmail && normalizeValue(appointment.clientEmail) === clientEmail) return true;
        if (clientPhone && normalizePhone(appointment.clientPhone) === clientPhone) return true;
        if (clientName && normalizeValue(appointment.client) === clientName) return true;
        return false;
      })
      .sort((a, b) => {
        const dateA = new Date(a.startIso || a.start || 0).getTime();
        const dateB = new Date(b.startIso || b.start || 0).getTime();
        return dateB - dateA;
      });
  }, [appointments, client]);

  const formatAppointmentDate = (appointment) => {
    if (!appointment) return '';
    if (appointment.startDate && appointment.startTime) {
      return `${appointment.startDate} · ${appointment.startTime}`;
    }
    if (appointment.startIso) {
      const parsed = new Date(appointment.startIso);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('da-DK', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }
    return '—';
  };

  const formatJournalDate = (entry) => {
    if (!entry) return '';
    if (entry.date) return entry.date;
    if (entry.createdAt instanceof Date && !Number.isNaN(entry.createdAt.getTime())) {
      return entry.createdAt.toLocaleDateString('da-DK');
    }
    return '';
  };

  const handleSaveGoals = async () => {
    if (!userId || !client?.id) {
      setGoalError('Manglende klient for at gemme mål.');
      return;
    }

    setGoalSaving(true);
    setGoalError('');

    try {
      // Filter out empty goals and trim text
      const goalsToSave = goalDraft
        .map((goal) => ({
          text: goal.text?.trim() || '',
          date: goal.date || '',
        }))
        .filter((goal) => goal.text.length > 0);

      await updateDoc(doc(db, 'users', userId, 'clients', client.id), {
        'clientensoplysninger.maalForForloebet': goalsToSave,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[ClientDetails] Failed to save goals', error);
      setGoalError('Kunne ikke gemme mål.');
    } finally {
      setGoalSaving(false);
    }
  };

  const handleAddGoal = () => {
    setGoalDraft([...goalDraft, { text: '', date: '' }]);
  };

  const handleUpdateGoal = (index, field, value) => {
    const updated = [...goalDraft];
    updated[index] = { ...updated[index], [field]: value };
    setGoalDraft(updated);
  };

  const handleRemoveGoal = (index) => {
    const updated = goalDraft.filter((_, i) => i !== index);
    setGoalDraft(updated);
  };

  const handleSummarizePatient = async () => {
    if (!client?.id || !userId) {
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
        body: JSON.stringify({ clientId: client.id }),
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

  return (
    <div className="client-details">
      <div className="client-details-header">
        <button type="button" className="client-details-back" onClick={onBack}>
          Tilbage
        </button>
        <div className="client-details-breadcrumb">
          <span>Klienter</span>
          <span className="client-details-breadcrumb-sep">{'>'}</span>
          <span>{client?.navn || 'Klient'}</span>
        </div>
      </div>

      <div className="client-details-actions">
        <button type="button" className="client-details-action primary" onClick={onEdit}>
          Rediger
        </button>
        <button type="button" className="client-details-action" onClick={onCombine}>
          Kombiner klienter
        </button>
        <button type="button" className="client-details-action danger" onClick={onDelete}>
          Slet
        </button>
      </div>

      <div className="client-details-body">
        <aside className="client-details-sidebar">
          <div className="client-details-card client-details-card--profile">
            <div className="client-details-avatar">{getClientInitials(client)}</div>
            <div className="client-details-name">{client?.navn || 'Klient'}</div>
            <div className="client-details-subtitle">{location || '—'}</div>
          </div>

          <div className="client-details-card">
            <div className="client-details-card-title">Kontakt</div>
            <div className="client-details-contact">
              <div>
                <div className="client-details-label">E-mail</div>
                <a
                  className="client-details-link"
                  href={emailValue !== '—' ? `mailto:${emailValue}` : undefined}
                >
                  {emailValue}
                </a>
              </div>
              <div>
                <div className="client-details-label">Telefon</div>
                <a
                  className="client-details-link"
                  href={phoneValue !== '—' ? `tel:${phoneValue}` : undefined}
                >
                  {phoneValue}
                </a>
              </div>
              <div>
                <div className="client-details-label">Adresse</div>
                <div className="client-details-value">{addressValue}</div>
              </div>
            </div>
          </div>

          <div className="client-details-card client-details-card--status">
            <div className="client-details-status-icon">OK</div>
            <div className="client-details-status-title">{statusValue}</div>
            <div className="client-details-status-text">Klientens status</div>
            <button type="button" className="client-details-link-button" onClick={onRequestStatusChange}>
              Skift status
            </button>
          </div>

          <div className="client-details-card client-details-card--status">
            <div className="client-details-status-icon secondary">i</div>
            <div className="client-details-status-title">Samtykke</div>
            <div className="client-details-status-text">Samtykke ikke indhentet endnu</div>
            <button type="button" className="client-details-link-button" onClick={onRequestConsent}>
              Indhent samtykke
            </button>
          </div>
        </aside>

        <section className="client-details-content">
          <div className="client-details-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`client-details-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="client-details-panel">
            {activeTab === 'journal' ? (
              <>
                <div className="client-details-toolbar">
                  <button
                    type="button"
                    className="client-details-primary-button"
                    onClick={handleSummarizePatient}
                    disabled={isSummarizing}
                  >
                    {isSummarizing ? 'Opsummerer…' : 'Opsummér patient'}
                  </button>
                </div>
                {(summaryError || summaryText) && (
                  <div className="client-details-summary">
                    {summaryError && (
                      <div className="client-details-summary-error" role="alert">
                        {summaryError}
                      </div>
                    )}
                    {summaryText && (
                      <div className="client-details-summary-card">
                        <h3>Opsummering af journal</h3>
                        <pre>{summaryText}</pre>
                      </div>
                    )}
                  </div>
                )}
                {journalLoading ? (
                  <div className="client-details-empty">
                    <p>Henter journalindlæg...</p>
                  </div>
                ) : journalError ? (
                  <div className="client-details-empty">
                    <p>{journalError}</p>
                  </div>
                ) : journalEntries.length === 0 ? (
                  <div className="client-details-empty">
                    <h4>Ingen journalindlæg endnu</h4>
                    <p>Der er endnu ikke oprettet journalnotater for {client?.navn || 'klienten'}.</p>
                  </div>
                ) : (
                  <div className="client-details-list">
                    {journalEntries.map((entry) => (
                      <div key={entry.id} className="client-details-entry">
                        <div className="client-details-entry-title">
                          {entry.title}
                        </div>
                        <div className="client-details-entry-meta">
                          {formatJournalDate(entry)}
                        </div>
                        {entry.content ? (
                          <div className="client-details-entry-body">
                            {entry.content}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === 'appointments' ? (
              <>
                {appointmentsLoading ? (
                  <div className="client-details-empty">
                    <p>Henter aftaler...</p>
                  </div>
                ) : clientAppointments.length === 0 ? (
                  <div className="client-details-empty">
                    <h4>Ingen aftaler endnu</h4>
                    <p>Der er endnu ikke registreret aftaler for {client?.navn || 'klienten'}.</p>
                  </div>
                ) : (
                  <div className="client-details-list">
                    {clientAppointments.map((appointment) => (
                      <div key={appointment.id} className="client-details-entry">
                        <div className="client-details-entry-title">
                          {appointment.service || appointment.title || 'Aftale'}
                        </div>
                        <div className="client-details-entry-meta">
                          {formatAppointmentDate(appointment)}
                        </div>
                        {appointment.notes ? (
                          <div className="client-details-entry-body">
                            {appointment.notes}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === 'goals' ? (
              <div className="client-details-goals">
                <div className="client-details-goals-header">
                  <label className="client-details-label">Borgerens mål</label>
                  <button
                    type="button"
                    className="client-details-add-goal-button"
                    onClick={handleAddGoal}
                  >
                    + Tilføj mål
                  </button>
                </div>
                {goalDraft.length === 0 ? (
                  <div className="client-details-goals-empty">
                    <p>Ingen mål oprettet endnu. Klik på "Tilføj mål" for at oprette et nyt mål.</p>
                  </div>
                ) : (
                  <div className="client-details-goals-list">
                    {goalDraft.map((goal, index) => (
                      <div key={index} className="client-details-goal-card">
                        <div className="client-details-goal-content">
                          <textarea
                            className="client-details-goal-textarea"
                            rows={3}
                            value={goal.text || ''}
                            onChange={(event) => handleUpdateGoal(index, 'text', event.target.value)}
                            placeholder="Skriv mål for borgeren her..."
                          />
                          <div className="client-details-goal-date-wrapper">
                            <label className="client-details-goal-date-label">Dato</label>
                            <input
                              type="date"
                              className="client-details-goal-date-input"
                              value={goal.date || ''}
                              onChange={(event) => handleUpdateGoal(index, 'date', event.target.value)}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="client-details-goal-remove"
                          onClick={() => handleRemoveGoal(index)}
                          title="Fjern mål"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {goalError ? <p className="client-details-error">{goalError}</p> : null}
                <button
                  type="button"
                  className="client-details-primary-button"
                  onClick={handleSaveGoals}
                  disabled={goalSaving}
                >
                  {goalSaving ? 'Gemmer...' : 'Gem mål'}
                </button>
              </div>
            ) : (
              <div className="client-details-empty">
                <h4>{tabs.find((tab) => tab.id === activeTab)?.label}</h4>
                <p>Indhold for {client?.navn || 'klienten'} vises her, når det er klar.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

function Klientoversigt() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const {
    clients,
    loading: isLoadingClients,
    error: clientsLoadError,
  } = useUserClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [showAddClient, setShowAddClient] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editView, setEditView] = useState('forloeb'); // 'personal' or 'forloeb'
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortOption, setSortOption] = useState('alphabetical'); // 'newest', 'oldest', 'alphabetical'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [detailClientId, setDetailClientId] = useState(null);
  const [clientMenuPosition, setClientMenuPosition] = useState({ x: 0, y: 0 });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredClients = useMemo(() => {
    const queryValue = searchQuery.trim().toLowerCase();
    let result = clients;
    
    if (queryValue) {
      result = clients.filter((client) => {
        const name = client.navn?.toLowerCase?.() || '';
        const email = client.email?.toLowerCase?.() || '';
        const city = client.by?.toLowerCase?.() || '';
        return (
          name.includes(queryValue) ||
          email.includes(queryValue) ||
          city.includes(queryValue)
        );
      });
    }

    // Apply sorting based on sortOption
    return [...result].sort((a, b) => {
      if (sortOption === 'alphabetical') {
        const nameA = (a.navn || '').toLowerCase();
        const nameB = (b.navn || '').toLowerCase();
        return nameA.localeCompare(nameB, locale);
      } else if (sortOption === 'newest') {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return dateB - dateA;
      } else if (sortOption === 'oldest') {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return dateA - dateB;
      }
      return 0;
    });
  }, [clients, searchQuery, sortOption]);

  const detailClient = useMemo(() => {
    if (!detailClientId) return null;
    return clients.find((client) => client.id === detailClientId) || null;
  }, [clients, detailClientId]);

  useEffect(() => {
    if (detailClientId && !detailClient) {
      setDetailClientId(null);
    }
  }, [detailClient, detailClientId]);

  const openCreateClient = () => {
    setEditingClient(null);
    setShowAddClient(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setShowAddClient(true);
  };

  const openClientDetails = (client) => {
    setDetailClientId(client.id);
    setSelectedClientId(null);
    setShowSortDropdown(false);
  };

  const handleAddClientSave = () => {
    setShowAddClient(false);
    setEditingClient(null);
  };

  const handleDeleteClient = () => {
    setShowAddClient(false);
    setEditingClient(null);
  };

  const handleSortOptionSelect = (option) => {
    setSortOption(option);
    setShowSortDropdown(false);
  };

  const getSortLabel = () => {
    switch (sortOption) {
      case 'newest':
        return t('booking.clients.sort.newest', 'Nyeste');
      case 'oldest':
        return t('booking.clients.sort.oldest', 'Ældste');
      case 'alphabetical':
        return t('booking.clients.sort.alphabetical', 'Alfabetisk');
      default:
        return t('booking.clients.sort.label', 'Sortér');
    }
  };

  const handleClientRowClick = (e, client) => {
    // Ignore clicks on checkbox
    if (e.target.type === 'checkbox') {
      return;
    }

    // Get position for menu
    const rect = e.currentTarget.getBoundingClientRect();
    setClientMenuPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 4,
    });
    setSelectedClientId(client.id);
  };

  const handleEditClientInfo = (client) => {
    setEditView('personal');
    openEditClient(client);
    setSelectedClientId(null);
  };

  const handleAddForloebInfo = (client) => {
    setEditView('forloeb');
    openEditClient(client);
    setSelectedClientId(null);
  };

  const handleCloseMenu = () => {
    setSelectedClientId(null);
  };

  const handleBackToList = () => {
    setDetailClientId(null);
  };

  const handleCombineClients = () => {
    alert('Kombiner klienter er ikke klar endnu.');
  };

  const handleCreateJournalEntry = () => {
    alert('Journalindlæg kommer snart.');
  };

  const handleRequestStatusChange = () => {
    alert('Status-ændring kommer snart.');
  };

  const handleRequestConsent = () => {
    alert('Samtykke-flowet kommer snart.');
  };

  const handleDeleteFromDetails = async () => {
    if (!user?.uid || !detailClient?.id) {
      alert('Kunne ikke finde klienten.');
      return;
    }

    const shouldDelete = window.confirm(
      `Er du sikker på, at du vil slette ${detailClient.navn || 'klienten'}?`
    );

    if (!shouldDelete) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'clients', detailClient.id));
      setDetailClientId(null);
    } catch (error) {
      console.error('[Klientoversigt] Failed to delete client', error);
      alert('Kunne ikke slette klienten. Prøv igen.');
    }
  };

  const userIdentity = useMemo(() => {
    if (!user) {
      return {
        name: t('booking.calendar.notLoggedIn', 'Ikke logget ind'),
        email: t('booking.calendar.loginToContinue', 'Log ind for at fortsætte'),
        initials: '?',
        photoURL: null,
      };
    }

    const name =
      user.displayName ||
      user.email ||
      t('booking.topbar.defaultUser', 'Selma bruger');
    const email = user.email || '—';
    const initialsSource = (user.displayName || user.email || '?').trim();
    const initials = initialsSource
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return {
      name,
      email,
      initials,
      photoURL: user.photoURL || null,
    };
  }, [user]);

  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        <div className="booking-content">
          {/* Main Content Area - Client Overview */}
          <div className="klientoversigt-main">
            {detailClient ? (
              <ClientDetails
                client={detailClient}
                onBack={handleBackToList}
                onEdit={() => handleEditClientInfo(detailClient)}
                onDelete={handleDeleteFromDetails}
                onCombine={handleCombineClients}
                onRequestStatusChange={handleRequestStatusChange}
                onRequestConsent={handleRequestConsent}
                userId={user?.uid || null}
              />
            ) : (
              <>
                {/* Page Header */}
                <div className="klientoversigt-header">
                  <div className="header-left">
                    <div className="header-title">
                      <h2 className="page-title">
                        {t('booking.clients.title', 'Klientoversigt')}
                      </h2>
                    </div>
                  </div>
                  <div className="header-right">
                    <button
                      type="button"
                      className="toolbar-pill toolbar-primary"
                      onClick={openCreateClient}
                    >
                      {t('booking.clients.actions.add', 'Tilføj klient')}
                      <ChevronDown className="toolbar-caret" />
                    </button>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="filter-bar">
                  <div className="sort-dropdown-container">
                    <button 
                      className="edit-columns-btn"
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                    >
                      {t('booking.clients.sort.label', 'Sortér')}: {getSortLabel()}
                      <span className="dropdown-arrow">{showSortDropdown ? '▲' : '▼'}</span>
                    </button>
                    {showSortDropdown && (
                      <div className="sort-dropdown-menu">
                        <button 
                          className={`sort-dropdown-item ${sortOption === 'newest' ? 'active' : ''}`}
                          onClick={() => handleSortOptionSelect('newest')}
                        >
                          {t('booking.clients.sort.newest', 'Nyeste')}
                        </button>
                        <button 
                          className={`sort-dropdown-item ${sortOption === 'oldest' ? 'active' : ''}`}
                          onClick={() => handleSortOptionSelect('oldest')}
                        >
                          {t('booking.clients.sort.oldest', 'Ældste')}
                        </button>
                        <button 
                          className={`sort-dropdown-item ${sortOption === 'alphabetical' ? 'active' : ''}`}
                          onClick={() => handleSortOptionSelect('alphabetical')}
                        >
                          {t('booking.clients.sort.alphabetical', 'Alfabetisk')}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="search-bar">
                    <span className="search-icon-small">🔍</span>
                    <input 
                      type="text" 
                      placeholder={t('booking.clients.search.placeholder', 'Søg')}
                      className="search-input-large"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Client status */}
                {(isLoadingClients || clientsLoadError) && (
                  <div
                    className={`client-status-message${
                      clientsLoadError ? ' error' : ''
                    }`}
                  >
                    {clientsLoadError
                      ? clientsLoadError
                      : t('booking.clients.loading', 'Henter klienter...')}
                  </div>
                )}

                {/* Client Table */}
                <div className="table-container">
                  <table className="clients-table">
                    <thead>
                      <tr>
                        <th className="checkbox-col">
                          <input type="checkbox" />
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('navn')}
                        >
                          {t('booking.clients.columns.name', 'Navn')}
                          {sortColumn === 'navn' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('status')}
                        >
                          {t('booking.clients.columns.status', 'Status')}
                          {sortColumn === 'status' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('email')}
                        >
                          {t('booking.clients.columns.email', 'E-mail')}
                          {sortColumn === 'email' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('telefon')}
                        >
                          {t('booking.clients.columns.phone', 'Telefon')}
                          {sortColumn === 'telefon' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('cpr')}
                        >
                          {t('booking.clients.columns.cpr', 'CPR')}
                          {sortColumn === 'cpr' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('adresse')}
                        >
                          {t('booking.clients.columns.address', 'Adresse')}
                          {sortColumn === 'adresse' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('by')}
                        >
                          {t('booking.clients.columns.city', 'By')}
                          {sortColumn === 'by' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('postnummer')}
                        >
                          {t('booking.clients.columns.postalCode', 'Postnummer')}
                          {sortColumn === 'postnummer' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('land')}
                        >
                          {t('booking.clients.columns.country', 'Land')}
                          {sortColumn === 'land' && (
                            <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client) => (
                        <tr 
                          key={client.id}
                          onClick={(e) => handleClientRowClick(e, client)}
                          className={selectedClientId === client.id ? 'row-selected' : ''}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={false}
                              readOnly
                              onClick={() => openClientDetails(client)}
                            />
                          </td>
                          <td>{client.navn}</td>
                          <td>
                            <span className={`status-badge ${client.status.toLowerCase()}`}>
                              {client.status}
                            </span>
                          </td>
                          <td>{client.email}</td>
                          <td>{client.telefon || '-'}</td>
                          <td>{client.cpr || '-'}</td>
                          <td>{client.adresse}</td>
                          <td>{client.by}</td>
                          <td>{client.postnummer}</td>
                          <td>{client.land}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Client Action Menu */}
        {!detailClientId && selectedClientId && (() => {
        const client = filteredClients.find((c) => c.id === selectedClientId);
        if (!client) return null;
        
        return (
          <>
            <div 
              className="client-menu-overlay" 
              onClick={handleCloseMenu}
            />
            <div 
              className="client-menu"
              style={{
                left: `${clientMenuPosition.x}px`,
                top: `${clientMenuPosition.y}px`,
              }}
            >
              <button
                className="client-menu-item"
                onClick={() => handleEditClientInfo(client)}
              >
                {t('booking.clients.actions.edit', 'Ændre klientoplysninger')}
              </button>
              <button
                className="client-menu-item"
                onClick={() => handleAddForloebInfo(client)}
              >
                {t('booking.clients.actions.addProgram', 'Tilføj forløbsoplysninger')}
              </button>
            </div>
          </>
        );
      })()}

        {/* Add Klient Modal */}
        {showAddClient && (
          <AddKlient
            isOpen={showAddClient}
            mode={editingClient ? 'edit' : 'create'}
            clientId={editingClient?.id || null}
            initialClient={editingClient || null}
            editView={editView}
            onClose={() => {
              setShowAddClient(false);
              setEditingClient(null);
              setEditView('forloeb');
            }}
            onSave={handleAddClientSave}
            onDelete={handleDeleteClient}
          />
        )}
      </div>
    </BookingSidebarLayout>
  );
}

export default Klientoversigt;
