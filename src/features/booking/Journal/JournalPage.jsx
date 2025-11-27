import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Journal from './journal';
import { useUserClients } from '../Klienter/hooks/useUserClients';

function JournalPage() {
  const navigate = useNavigate();
  const { clients, loading, error } = useUserClients();
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    if (clients.length && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

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

  return (
    <Journal
      selectedClient={selectedClient}
      selectedAppointment={selectedAppointment}
      onClose={handleClose}
      onCreateAppointment={handleCreateAppointment}
    />
  );
}

export default JournalPage;

