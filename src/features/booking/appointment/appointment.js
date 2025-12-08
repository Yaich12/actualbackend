import React, { useEffect, useMemo, useRef, useState } from 'react';
import './appointments.css';
import { useUserClients } from '../Klienter/hooks/useUserClients';
import ServiceSelector from '../Ydelser/ServiceSelector';

const getAutoEndTime = (startTime, timeSlots) => {
  if (!startTime || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    return startTime;
  }

  const [h, m] = startTime.split(':').map(Number);
  const baseDate = new Date(2000, 0, 1, h, m + 60);
  const hh = String(baseDate.getHours()).padStart(2, '0');
  const mm = String(baseDate.getMinutes()).padStart(2, '0');
  const candidate = `${hh}:${mm}`;

  if (timeSlots.includes(candidate)) {
    return candidate;
  }
  return timeSlots[timeSlots.length - 1];
};

function AppointmentForm({
  onClose,
  onCreate,
  onUpdate,
  initialAppointment,
  mode = 'create',
}) {
  const {
    clients,
    loading: clientsLoading,
    error: clientsError,
  } = useUserClients();
  const defaultDate = useMemo(() => {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    return `${day}-${month}-${year}`;
  }, []);
  const [startDate, setStartDate] = useState(
    initialAppointment?.startDate || defaultDate
  );
  const [startTime, setStartTime] = useState(
    initialAppointment?.startTime || '10:00'
  );
  const [endDate, setEndDate] = useState(initialAppointment?.endDate || defaultDate);
  const [endTime, setEndTime] = useState(initialAppointment?.endTime || '11:00');
  const [selectedClientId, setSelectedClientId] = useState(
    initialAppointment?.clientId || ''
  );
  const [selectedServiceId, setSelectedServiceId] = useState(
    initialAppointment?.serviceId || ''
  );
  const [availableServices, setAvailableServices] = useState([]);
  const [notes, setNotes] = useState(initialAppointment?.notes || '');
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

  useEffect(() => {
    setStartDate(initialAppointment?.startDate || defaultDate);
    setStartTime(initialAppointment?.startTime || '10:00');
    setEndDate(initialAppointment?.endDate || defaultDate);
    setEndTime(initialAppointment?.endTime || '11:00');
    setSelectedClientId(initialAppointment?.clientId || '');
    setSelectedServiceId(initialAppointment?.serviceId || '');
    setNotes(initialAppointment?.notes || '');
    setShowStartDropdown(false);
    setShowEndDropdown(false);
  }, [initialAppointment, defaultDate]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!selectedServiceId) return;
    if (!startTime) return;

    const autoEnd = getAutoEndTime(startTime, timeSlots);
    setEndTime(autoEnd);
    setEndDate(startDate);
  }, [selectedServiceId, startTime, mode, timeSlots, startDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const base = initialAppointment || {};
    const selectedClientData =
      clients.find((client) => client.id === selectedClientId) || null;
    const selectedServiceData =
      availableServices.find((service) => service.id === selectedServiceId) || null;

    const appointmentPayload = {
      ...base,
      id: base.id || Date.now(),
      startDate,
      startTime,
      endDate,
      endTime,
      clientId: selectedClientId || base.clientId || null,
      client: selectedClientData?.navn || base.client || '',
      clientEmail: selectedClientData?.email || base.clientEmail || '',
      clientPhone: selectedClientData?.telefon || base.clientPhone || '',
      serviceId: selectedServiceId || base.serviceId || null,
      service: selectedServiceData?.navn || base.service || '',
      serviceDuration: selectedServiceData?.varighed || base.serviceDuration || '',
      servicePrice:
        typeof selectedServiceData?.pris === 'number'
          ? selectedServiceData.pris
          : typeof base.servicePrice === 'number'
            ? base.servicePrice
            : null,
      servicePriceInclVat:
        typeof selectedServiceData?.prisInklMoms === 'number'
          ? selectedServiceData.prisInklMoms
          : typeof base.servicePriceInclVat === 'number'
            ? base.servicePriceInclVat
            : null,
      notes,
    };

    if (mode === 'edit' && typeof onUpdate === 'function') {
      onUpdate(appointmentPayload);
    } else if (typeof onCreate === 'function') {
      onCreate(appointmentPayload);
    }

    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="appointment-form-container">
      <div className="appointment-form-header">
        <h2 className="appointment-form-title">
          {mode === 'edit' ? 'Rediger aftale' : 'Opret aftale'}
        </h2>
      </div>

      <form className="appointment-form" onSubmit={handleSubmit}>
        {/* Start and End Date/Time */}
        <div className="form-section">
          <div className="datetime-row">
            <div className="datetime-group">
              <label className="form-label">Start tidspunkt</label>
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
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                disabled={clientsLoading}
              >
                <option value="">Vælg klient</option>
                {clientsLoading && (
                  <option value="loading" disabled>
                    Henter klienter…
                  </option>
                )}
                {!clientsLoading &&
                  clients.map((client) => (
                    <option key={client.id} value={client.id}>
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
          {clientsError && (
            <p className="client-select-error" role="alert">
              {clientsError}
            </p>
          )}
          {!clientsError && !clientsLoading && clients.length === 0 && (
            <p className="client-select-empty">
              Du har ingen klienter endnu. Tilføj en ny for at fortsætte.
            </p>
          )}
        </div>

        {/* Select Service */}
        <div className="form-section">
          <ServiceSelector
            value={selectedServiceId}
            onChange={setSelectedServiceId}
            onServicesChange={setAvailableServices}
          />
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
            {mode === 'edit' ? 'Opdater aftale' : 'Opret aftale'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AppointmentForm;
