import React, { useEffect, useMemo, useState } from 'react';
import './journal.css';
import { useUserServices } from '../Ydelser/hooks/useUserServices';
import { useUserClients } from '../Klienter/hooks/useUserClients';
import SeHistorik from './Historik/sehistorik';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { useAuth } from '../../../AuthContext';
import { Button as MovingBorderButton } from '../../../components/ui/moving-border';
import { Trash2 } from 'lucide-react';

function Journal({
  selectedClient,
  selectedAppointment,
  onClose,
  onCreateAppointment,
  onCreateJournalEntry,
  onEditAppointment,
  onDeleteAppointment,
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [journalEntryCount, setJournalEntryCount] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null); // { id, navn }
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupNameError, setGroupNameError] = useState('');
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const { services: savedServices } = useUserServices();
  const { clients } = useUserClients();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !selectedClient?.id) {
      setJournalEntryCount(null);
      return () => {};
    }

    const entriesRef = collection(
      db,
      'users',
      user.uid,
      'clients',
      selectedClient.id,
      'journalEntries'
    );

    const unsubscribe = onSnapshot(
      entriesRef,
      (snap) => setJournalEntryCount(snap.size),
      () => setJournalEntryCount(null)
    );

    return () => unsubscribe();
  }, [user, selectedClient?.id]);

  const client = selectedClient;

  // Resolve service for the appointment
  const appointmentService = (() => {
    if (!selectedAppointment) {
      return null;
    }

    if (selectedAppointment.serviceId) {
      const saved = savedServices.find(
        (svc) => svc.id === selectedAppointment.serviceId
      );
      if (saved) {
        return saved;
      }
    }

    if (selectedAppointment.service) {
      const matchByName = savedServices.find(
        (svc) => svc.navn === selectedAppointment.service
      );
      if (matchByName) {
        return matchByName;
      }
      return {
        id: 'fallback',
        navn: selectedAppointment.service,
        varighed: selectedAppointment.serviceDuration || '1 time',
        pris: selectedAppointment.servicePrice ?? 0,
      };
    }

    return null;
  })();

  const additionalServices = Array.isArray(selectedAppointment?.additionalServices)
    ? selectedAppointment.additionalServices
    : [];

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('-');
    const monthNames = [
      'januar', 'februar', 'marts', 'april', 'maj', 'juni',
      'juli', 'august', 'september', 'oktober', 'november', 'december'
    ];
    return `${day}. ${monthNames[parseInt(month) - 1]} ${year}`;
  };

  // Format time
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr;
  };

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price || 0);
  };

  // Get day name
  const getDayName = (dateStr) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
    return dayNames[date.getDay()];
  };

  // Calculate end time (assuming 1 hour duration if not specified)
  const getEndTime = (startTime) => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + 1;
    const formattedEndHours = endHours.toString().padStart(2, '0');
    return `${formattedEndHours}:${minutes.toString().padStart(2, '0')}`;
  };

  const isForloeb =
    selectedAppointment &&
    (selectedAppointment.serviceType === 'forloeb' ||
      (typeof selectedAppointment.serviceId === 'string' && selectedAppointment.serviceId.startsWith('forloeb:')));

  const currentGroupName = useMemo(() => {
    if (!isForloeb) return '';
    return (
      appointmentService?.navn ||
      selectedAppointment?.service ||
      selectedAppointment?.title ||
      'Forløb'
    );
  }, [appointmentService?.navn, isForloeb, selectedAppointment?.service, selectedAppointment?.title]);

  const forloebDocId = useMemo(() => {
    const raw = selectedAppointment?.serviceId;
    if (!raw || typeof raw !== 'string') return null;
    if (!raw.startsWith('forloeb:')) return null;
    return raw.slice('forloeb:'.length) || null;
  }, [selectedAppointment?.serviceId]);

  const beginEditGroupName = () => {
    setGroupNameError('');
    setGroupNameDraft(currentGroupName || '');
    setIsEditingGroupName(true);
  };

  const cancelEditGroupName = () => {
    setIsEditingGroupName(false);
    setGroupNameDraft('');
    setGroupNameError('');
  };

  const saveGroupName = async () => {
    if (isSavingGroupName) return;
    setGroupNameError('');

    const nextName = (groupNameDraft || '').trim();
    if (!nextName) {
      setGroupNameError('Indtast et holdnavn.');
      return;
    }
    if (!user?.uid) {
      setGroupNameError('Du skal være logget ind for at gemme.');
      return;
    }
    if (!isForloeb || !selectedAppointment?.serviceId) {
      setGroupNameError('Mangler forløbs-id – kunne ikke gemme.');
      return;
    }

    setIsSavingGroupName(true);
    try {
      // 1) Rename the forløb definition (if we have a doc id)
      if (forloebDocId) {
        const forloebRef = doc(db, 'users', user.uid, 'forloeb', forloebDocId);
        await updateDoc(forloebRef, {
          name: nextName,
          updatedAt: serverTimestamp(),
        });
      }

      // 2) Update all appointments in this forløb so calendar + details reflect the new name
      const apptRef = collection(db, 'users', user.uid, 'appointments');
      const q = query(apptRef, where('serviceId', '==', selectedAppointment.serviceId));
      const snap = await getDocs(q);

      if (!snap.empty) {
        let batch = writeBatch(db);
        let opCount = 0;

        const flush = async () => {
          if (opCount === 0) return;
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        };

        for (const d of snap.docs) {
          batch.update(d.ref, {
            service: nextName,
            title: nextName,
            client: nextName,
            updatedAt: serverTimestamp(),
          });
          opCount += 1;
          if (opCount >= 450) {
            await flush();
          }
        }

        await flush();
      }

      setIsEditingGroupName(false);
      setGroupNameDraft('');
    } catch (err) {
      console.error('[Journal] Failed to rename group', err);
      setGroupNameError('Kunne ikke gemme holdnavnet. Prøv igen.');
    } finally {
      setIsSavingGroupName(false);
    }
  };

  const participantEntries = useMemo(() => {
    const extractName = (p) => {
      if (!p) return null;
      if (typeof p === 'string') return p.trim() || null;
      const firstLast =
        p.firstName || p.lastName ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null;
      return (
        p.name ||
        p.navn ||
        p.fullName ||
        p.client ||
        p.title ||
        p.label ||
        p.participantName ||
        p.displayName ||
        firstLast
      );
    };

    const items = [];
    if (Array.isArray(selectedAppointment?.participants)) {
      selectedAppointment.participants.forEach((p) => {
        const name = extractName(p);
        const id = typeof p === 'object' && p ? p.id : null;
        if (name) {
          items.push({ id: id || null, navn: name });
        }
      });
    }

    // For non-forløb, fall back to client name
    if (!isForloeb) {
    if (selectedAppointment?.client) {
        items.push({ id: selectedAppointment?.clientId || null, navn: selectedAppointment.client });
    }
    if (client?.navn) {
        items.push({ id: client?.id || null, navn: client.navn });
      }
    }

    // Deduplicate (prefer entries with ids)
    const byKey = new Map();
    items.forEach((item) => {
      const key = (item.navn || '').trim().toLowerCase();
      if (!key) return;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        return;
      }
      if (!existing.id && item.id) {
        byKey.set(key, item);
      }
    });
    return Array.from(byKey.values());
  }, [client?.id, client?.navn, isForloeb, selectedAppointment]);

  const openParticipantHistory = (participant) => {
    if (!participant?.navn) return;

    let clientId = participant.id || null;
    if (!clientId && Array.isArray(clients) && clients.length) {
      const match = clients.find(
        (c) => (c?.navn || '').trim().toLowerCase() === participant.navn.trim().toLowerCase()
      );
      clientId = match?.id || null;
    }

    setHistoryTarget({ id: clientId, navn: participant.navn });
    setShowHistory(true);
  };

  const toIsoFromDateAndTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;

    // Accepts both dd-mm-yyyy and yyyy-mm-dd
    let dd, mm, yyyy;
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      [dd, mm, yyyy] = dateStr.split('-').map(Number);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      [yyyy, mm, dd] = dateStr.split('-').map(Number);
    } else {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      dd = d.getDate();
      mm = d.getMonth() + 1;
      yyyy = d.getFullYear();
    }

    const [h, m] = String(timeStr).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;

    const d = new Date(yyyy, mm - 1, dd, h, m, 0, 0);
    return d.toISOString();
  };

  const handleSuggestNextAppointment = async () => {
    if (!selectedAppointment || !client || !user) {
      setSuggestError('Mangler aftale, klient eller bruger.');
      return;
    }

    if (!process.env.REACT_APP_SUGGEST_NEXT_APPOINTMENT_URL) {
      setSuggestError(
        'Manglende URL til forslag af næste aftale (REACT_APP_SUGGEST_NEXT_APPOINTMENT_URL).'
      );
      return;
    }

    const lastAppointmentIso = toIsoFromDateAndTime(
      selectedAppointment.startDate,
      selectedAppointment.startTime
    );
    if (!lastAppointmentIso) {
      setSuggestError('Kunne ikke beregne dato/tid for sidste aftale.');
      return;
    }

    const computeDurationMinutes = () => {
      const startIso = toIsoFromDateAndTime(
        selectedAppointment.startDate,
        selectedAppointment.startTime
      );
      const endIso = toIsoFromDateAndTime(
        selectedAppointment.endDate || selectedAppointment.startDate,
        selectedAppointment.endTime || selectedAppointment.startTime
      );
      if (!startIso || !endIso) return 60;
      const start = new Date(startIso);
      const end = new Date(endIso);
      const diff = Math.round((end.getTime() - start.getTime()) / 60000);
      return diff > 0 ? diff : 60;
    };

    try {
      setIsSuggesting(true);
      setSuggestError('');

      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setSuggestError('Kunne ikke hente login-token.');
        setIsSuggesting(false);
        return;
      }

      const diagnosis =
        selectedAppointment?.diagnose ||
        selectedAppointment?.diagnosis ||
        client?.diagnose ||
        client?.diagnosis ||
        '';

      const body = {
        clientId: client.id,
        diagnosis,
        lastAppointmentIso,
        sessionCount: selectedAppointment?.sessionCount || null,
        journalSummary: null,
        durationMinutes: computeDurationMinutes(),
      };

      const res = await fetch(process.env.REACT_APP_SUGGEST_NEXT_APPOINTMENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('suggestNextAppointment error', data);
        setSuggestError(data?.error || 'Ukendt fejl ved forslag af næste aftale.');
        return;
      }

      const { suggested, rationale, safetyNote, intervalDays } = data || {};
      if (!suggested?.startDate || !suggested?.startTime) {
        setSuggestError('Manglede forslag til dato/tid i svaret.');
        return;
      }

      if (!onCreateAppointment) return;

      const baseNotes = selectedAppointment.notes || '';
      const newNotes =
        (baseNotes ? baseNotes + '\n\n' : '') +
        'AI-forslag til næste tid' +
        (typeof intervalDays === 'number' ? ` (${intervalDays} dage):\n` : ':\n') +
        (rationale || '') +
        (safetyNote ? '\n\nSikkerhedsnote: ' + safetyNote : '');

      const nextAppointmentTemplate = {
        ...selectedAppointment,
        startDate: suggested.startDate,
        startTime: suggested.startTime,
        endDate: suggested.endDate || suggested.startDate,
        endTime: suggested.endTime || selectedAppointment.endTime,
        notes: newNotes,
      };

      onCreateAppointment({
        appointment: nextAppointmentTemplate,
        client,
        suggested: true,
      });
    } catch (err) {
      console.error(err);
      setSuggestError('Der opstod en fejl ved forslag af næste aftale. Prøv igen.');
    } finally {
      setIsSuggesting(false);
    }
  };

  // NOTE: Early returns must come AFTER all hooks to satisfy rules-of-hooks.
  if (!selectedClient) {
    return (
      <div className="journal-empty">
        Ingen klient valgt – vælg en klient for at se journalen.
      </div>
    );
  }

  // If showing history, render SeHistorik component
  if (showHistory) {
    const activeClient = historyTarget || selectedClient;
    return (
      <SeHistorik 
        clientId={activeClient?.id || null}
        clientName={activeClient?.navn || 'Ukendt klient'}
        onClose={() => {
          setShowHistory(false);
          setHistoryTarget(null);
        }}
      />
    );
  }

  return (
    <div className="journal-container">
      {/* Header */}
      <div className="journal-header">
        <div className="journal-header-top">
          <div className="journal-client-info">
            <h2 className="journal-client-name">
              {isForloeb ? (
                <>
                  <span className="journal-client-prefix">Forløb:</span>{' '}
                  {isEditingGroupName ? (
                    <span className="journal-inline-edit">
                      <input
                        className="journal-inline-input"
                        value={groupNameDraft}
                        onChange={(e) => setGroupNameDraft(e.target.value)}
                        placeholder="Holdnavn…"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="journal-inline-btn"
                        onClick={saveGroupName}
                        disabled={isSavingGroupName}
                      >
                        {isSavingGroupName ? 'Gemmer…' : 'Gem'}
                      </button>
                      <button
                        type="button"
                        className="journal-inline-btn secondary"
                        onClick={cancelEditGroupName}
                        disabled={isSavingGroupName}
                      >
                        Annuller
                      </button>
                    </span>
                  ) : (
                    <span className="journal-client-value">{currentGroupName}</span>
                  )}
                </>
              ) : (
                client?.navn || 'Ukendt klient'
              )}
            </h2>
          </div>
          <div className="journal-header-actions">
            <button className="journal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        {isForloeb && groupNameError && (
          <div className="journal-inline-error" role="alert">
            {groupNameError}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="journal-content">
        {/* Date and service info */}
        {selectedAppointment && (
          <div className="journal-section">
            <div className="journal-appointment-date">
              {formatDate(selectedAppointment.startDate)}, {formatTime(selectedAppointment.startTime)} til {getEndTime(selectedAppointment.startTime)}
            </div>
            {!isForloeb && appointmentService && (
              <>
                <div className="journal-appointment-service">
                  {appointmentService.navn}
                </div>
                <div className="journal-appointment-price">
                  DKK {formatPrice(appointmentService.pris)}
                </div>
                {additionalServices.length > 0 && (
                  <div className="journal-appointment-services">
                    {additionalServices.map((service, index) => (
                      <div
                        key={`${service.id || 'extra'}-${index}`}
                        className="journal-appointment-service-row"
                      >
                        <span className="journal-appointment-service-name">
                          {service.navn || 'Tillægstjeneste'}
                        </span>
                        <span className="journal-appointment-service-meta">
                          {typeof service.pris === 'number'
                            ? `DKK ${formatPrice(service.pris)}`
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {isForloeb && participantEntries.length > 0 && (
          <div className="journal-section">
            <div className="journal-label">Deltagere</div>
            <div className="journal-participants">
              {participantEntries.map((participant) => (
                <button
                  key={`${participant.id || 'no-id'}:${participant.navn}`}
                  type="button"
                  className="journal-participant-chip"
                  onClick={() => openParticipantHistory(participant)}
                >
                  {participant.navn}
                  <span className="journal-participant-link">Se journal</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create Journal Entry Button */}
        {(onCreateJournalEntry || selectedAppointment) && (
          <div className="journal-section">
            <div className="journal-create-actions">
              {selectedAppointment && (
                <button
                  className="journal-action-btn"
                  onClick={() => {
                    setHistoryTarget(null);
                    setShowHistory(true);
                  }}
                >
                  Se journal
                </button>
              )}
              {onCreateJournalEntry && (
                <button
                  className="journal-create-appointment-btn"
                  onClick={onCreateJournalEntry}
                >
                  <span className="journal-create-entry-icon">+</span>
                  Opret indlæg
                </button>
              )}
            </div>
          </div>
        )}

        {/* Selected Appointment Details */}
        {selectedAppointment && (
          <>
            <div className="journal-section journal-appointment-section">
              <div className="journal-appointment-actions">
                <button
                  className="journal-action-btn"
                  onClick={() => {
                    if (onEditAppointment && selectedAppointment) {
                      onEditAppointment(selectedAppointment);
                    }
                  }}
                >
                  Rediger aftale
                </button>
                <button
                  className="journal-action-btn"
                  onClick={() => {
                    if (!onCreateAppointment) return;
                    onCreateAppointment({
                      appointment: selectedAppointment || null,
                      client,
                    });
                  }}
                >
                  Opret næste aftale
                </button>
                <MovingBorderButton
                  borderRadius="0.75rem"
                  onClick={handleSuggestNextAppointment}
                  disabled={isSuggesting}
                  containerClassName="w-full h-12 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  className="bg-white text-slate-900 border-slate-200 font-medium"
                  borderClassName="bg-[radial-gradient(var(--violet-500)_40%,transparent_60%)]"
                >
                  {isSuggesting ? 'Foreslår…' : 'Foreslå næste aftale'}
                </MovingBorderButton>
                <button
                  className="journal-action-btn journal-delete-btn"
                  onClick={() => {
                    if (!selectedAppointment || !onDeleteAppointment) return;
                    const confirmed = window.confirm(
                      'Er du sikker på, at du vil slette denne aftale? Dette kan ikke fortrydes.'
                    );
                    if (confirmed) {
                      onDeleteAppointment(selectedAppointment);
                    }
                  }}
                >
                  <Trash2 className="journal-delete-icon" size={16} aria-hidden="true" />
                  Slet aftale
                </button>
              </div>
              {suggestError && (
                <div className="journal-summary">
                  <div className="journal-summary-error" role="alert">
                    {suggestError}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Journal;
