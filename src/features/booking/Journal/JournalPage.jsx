import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Journal from './journal';
import Indlæg from './indlæg/indlæg';
import { useUserClients } from '../Klienter/hooks/useUserClients';

function JournalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clients, loading, error } = useUserClients();
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showJournalEntry, setShowJournalEntry] = useState(false);
  const [journalEntryData, setJournalEntryData] = useState(null);

  useEffect(() => {
    // Check if we have entry data from navigation state
    if (location.state?.entry && location.state?.clientId) {
      setSelectedClientId(location.state.clientId);
      setJournalEntryData(location.state.entry);
      setShowJournalEntry(true);
    } else if (clients.length && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId, location.state]);

  if (loading) {
    return <div style={{ padding: 24 }}>Henter klienter...</div>;
  }

  if (error) {
    return <div style={{ padding: 24 }}>{error}</div>;
  }

  if (!clients.length) {
    return <div style={{ padding: 24 }}>Du har ingen klienter endnu.</div>;
  }

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) || null;

  const handleClose = () => {
    navigate('/booking', { replace: true });
  };

  const handleCreateAppointment = () => {
    console.log('[JournalPage] Create appointment for:', selectedClient?.navn);
  };

  const handleOpenJournalEntry = (payload) => {
    if (payload?.entry) {
      setJournalEntryData(payload.entry);
      setShowJournalEntry(true);
    } else {
      setJournalEntryData(null);
      setShowJournalEntry(true);
    }
  };

  const handleJournalEntrySaved = (entry) => {
    console.log('[JournalPage] journal entry saved', entry);
    if (entry) {
      setJournalEntryData(entry);
    }
  };

  const handleCloseJournalEntry = () => {
    setShowJournalEntry(false);
    setJournalEntryData(null);
  };

  if (showJournalEntry) {
    return (
      <Indlæg
        clientId={journalEntryData?.clientId || selectedClient?.id}
        clientName={journalEntryData?.clientName || selectedClient?.navn}
        onClose={handleCloseJournalEntry}
        onSave={handleJournalEntrySaved}
        initialDate={journalEntryData?.date || ''}
        initialEntry={journalEntryData}
        appointmentId={
          journalEntryData?.appointmentId || journalEntryData?.appointment?.id || null
        }
      />
    );
  }

  return (
    <Journal
      selectedClient={selectedClient}
      selectedAppointment={selectedAppointment}
      onClose={handleClose}
      onCreateAppointment={handleCreateAppointment}
      onCreateJournalEntry={handleOpenJournalEntry}
    />
  );
}

export default JournalPage;
