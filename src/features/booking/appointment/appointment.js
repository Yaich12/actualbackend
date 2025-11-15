import React, { useEffect, useMemo, useRef, useState } from 'react';
import './appointments.css';
import { clients } from '../Klienter/clientsData';
import { services } from '../Ydelser/servicesData';

function AppointmentForm({ onClose, onCreate }) {
  const [startDate, setStartDate] = useState('14-11-2025');
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState('14-11-2025');
  const [endTime, setEndTime] = useState('11:00');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [notes, setNotes] = useState('');
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [showEndDropdown, setShowEndDropdown] = useState(false);

  const startDropdownRef = useRef(null);
  const endDropdownRef = useRef(null);

  const timeSlots = useMemo(() => {
    const times = [];
    const startHour = 8;
    const endHour = 17;
    for (let hour = startHour; hour <= endHour; hour += 1) {
      for (let minutes = 0; minutes < 60; minutes += 15) {
        if (hour === endHour && minutes > 0) {
          continue;
        }
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        times.push(`${formattedHour}:${formattedMinutes}`);
      }
    }
    return times;
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        startDropdownRef.current &&
        !startDropdownRef.current.contains(event.target)
      ) {
        setShowStartDropdown(false);
      }
      if (
        endDropdownRef.current &&
        !endDropdownRef.current.contains(event.target)
      ) {
        setShowEndDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newAppointment = {
      id: Date.now(),
      startDate,
      startTime,
      endDate,
      endTime,
      client: selectedClient,
      service: selectedService,
      notes,
    };

    if (typeof onCreate === 'function') {
      onCreate(newAppointment);
    }

    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const formatServicePrice = (price) =>
    new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

  return (
    <div className="appointment-form-container">
      <div className="appointment-form-header">
        <h2 className="appointment-form-title">Opret aftale</h2>
      </div>

      <form className="appointment-form" onSubmit={handleSubmit}>
        {/* Start and End Date/Time */}
        <div className="form-section">
          <div className="datetime-row">
            <div className="datetime-group">
              <label className="form-label">Start</label>
              <div className="datetime-inputs">
                <input
                  type="text"
                  className="date-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="dd-mm-yyyy"
                />
                <div
                  className={`time-input-wrapper ${showStartDropdown ? 'open' : ''}`}
                  ref={startDropdownRef}
                >
                  <input
                    type="text"
                    className="time-input"
                    value={startTime}
                    placeholder="HH:mm"
                    readOnly
                    onClick={() => setShowStartDropdown((prev) => !prev)}
                    onFocus={() => setShowStartDropdown(true)}
                  />
                  <span className="dropdown-arrow">▼</span>
                  {showStartDropdown && (
                    <div className="time-dropdown">
                      <div className="time-dropdown-list">
                        {timeSlots.map((time) => (
                          <button
                            type="button"
                            key={time}
                            className={`time-option ${time === startTime ? 'selected' : ''}`}
                            onClick={() => {
                              setStartTime(time);
                              setShowStartDropdown(false);
                            }}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="arrow-icon">→</div>

            <div className="datetime-group">
              <label className="form-label">Slut tidspunkt</label>
              <div className="datetime-inputs">
                <input
                  type="text"
                  className="date-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="dd-mm-yyyy"
                />
                <div
                  className={`time-input-wrapper ${showEndDropdown ? 'open' : ''}`}
                  ref={endDropdownRef}
                >
                  <input
                    type="text"
                    className="time-input"
                    value={endTime}
                    placeholder="HH:mm"
                    readOnly
                    onClick={() => setShowEndDropdown((prev) => !prev)}
                    onFocus={() => setShowEndDropdown(true)}
                  />
                  <span className="dropdown-arrow">▼</span>
                  <button type="button" className="reset-icon" onClick={() => setEndTime(startTime)}>↻</button>
                  {showEndDropdown && (
                    <div className="time-dropdown">
                      <div className="time-dropdown-list">
                        {timeSlots.map((time) => (
                          <button
                            type="button"
                            key={time}
                            className={`time-option ${time === endTime ? 'selected' : ''}`}
                            onClick={() => {
                              setEndTime(time);
                              setShowEndDropdown(false);
                            }}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Select Client */}
        <div className="form-section">
          <label className="form-label">Vælg klient</label>
          <div className="client-select-row">
            <div className="select-wrapper">
              <select
                className="select-input"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                <option value="">Vælg klient</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.navn}>
                    {client.navn} – {client.email}
                  </option>
                ))}
              </select>
              <span className="dropdown-arrow">▼</span>
            </div>
            <button type="button" className="add-client-btn-small">
              Tilføj klient
            </button>
          </div>
        </div>

        {/* Select Service */}
        <div className="form-section">
          <label className="form-label">Ydelse</label>
          <div className="select-wrapper">
            <select
              className="select-input"
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
            >
              <option value="">Ingen ydelse valgt</option>
              {services.map((service) => (
                <option key={service.id} value={service.navn}>
                  {service.navn} – {service.varighed} – DKK {formatServicePrice(service.pris)}
                </option>
              ))}
            </select>
            <span className="dropdown-arrow">▼</span>
          </div>
        </div>

        {/* Notes */}
        <div className="form-section">
          <label className="form-label">Noter</label>
          <textarea
            className="notes-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tilføj noter..."
            rows={6}
          />
          <p className="notes-hint">
            Noterne er private og vil ikke kunne ses af din klient.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={handleCancel}>
            Annuller
          </button>
          <button type="submit" className="submit-btn">
            Opret aftale
          </button>
        </div>
      </form>
    </div>
  );
}

export default AppointmentForm;
