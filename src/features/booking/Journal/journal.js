import React, { useState } from 'react';
import './journal.css';
import { clients } from '../Klienter/clientsData';
import { services } from '../Ydelser/servicesData';
import SeHistorik from './Historik/sehistorik';

function Journal({ selectedClient, selectedAppointment, onClose, onCreateAppointment }) {
  const [showHistory, setShowHistory] = useState(false);

  if (!selectedClient) {
    return null;
  }

  // If showing history, render SeHistorik component
  if (showHistory) {
    return (
      <SeHistorik 
        clientName={selectedClient}
        onClose={() => setShowHistory(false)}
      />
    );
  }

  // Find client data
  const client = clients.find(c => c.navn === selectedClient) || clients[0];
  
  // Find service for the appointment
  const service = selectedAppointment?.service 
    ? services.find(s => s.navn === selectedAppointment.service)
    : null;

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

  return (
    <div className="journal-container">
      {/* Header */}
      <div className="journal-header">
        <div className="journal-header-top">
          <div className="journal-client-info">
            <span className="journal-client-icon">👤</span>
            <h2 className="journal-client-name">{client.navn}</h2>
          </div>
          <div className="journal-header-actions">
            <button className="journal-edit-client-btn">Rediger klient</button>
            <button className="journal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="journal-content">
        {/* Client Contact */}
        <div className="journal-section">
          <div className="journal-label">E-mail</div>
          <div className="journal-value">{client.email}</div>
        </div>

        {/* Create Next Appointment Button */}
        <div className="journal-section">
          <button className="journal-create-appointment-btn" onClick={onCreateAppointment}>
            Opret næste aftale
          </button>
        </div>

        {/* Selected Appointment Details */}
        {selectedAppointment && (
          <>
            <div className="journal-section journal-appointment-section">
              <div className="journal-appointment-date">
                {formatDate(selectedAppointment.startDate)}, {formatTime(selectedAppointment.startTime)} til {getEndTime(selectedAppointment.startTime)}
              </div>
              {service && (
                <>
                  <div className="journal-appointment-service">{service.navn}</div>
                  <div className="journal-appointment-price">DKK {formatPrice(service.pris)}</div>
                </>
              )}
              <div className="journal-appointment-actions">
                <button 
                  className="journal-action-btn"
                  onClick={() => setShowHistory(true)}
                >
                  Se journal
                </button>
                <button className="journal-action-btn">Opret ny faktura</button>
                <button className="journal-icon-btn">✏️</button>
                <button className="journal-icon-btn">⋯</button>
              </div>
            </div>

            {/* Booking Source */}
            <div className="journal-section">
              <div className="journal-booking-source">
                <span className="journal-booking-icon">🔗</span>
                <div>
                  <div className="journal-label">Bookingkilde</div>
                  <div className="journal-value">Denne aftale blev booket manuelt</div>
                </div>
              </div>
            </div>

            {/* Last Appointment */}
            <div className="journal-section">
              <div className="journal-label">Sidste aftale</div>
              <div className="journal-value">
                {getDayName(selectedAppointment.startDate)} d. {formatDate(selectedAppointment.startDate)}, {formatTime(selectedAppointment.startTime)} til {getEndTime(selectedAppointment.startTime)}
              </div>
              <button className="journal-view-all-btn">Se alle tidligere aftaler (2)</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Journal;

