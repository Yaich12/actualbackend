import React, { useEffect, useMemo, useRef, useState } from 'react';
import './appointments.css';
import { useUserClients } from '../Klienter/hooks/useUserClients';
import ServiceSelector from '../Ydelser/ServiceSelector';
import AddKlient from '../Klienter/addklient/addklient';

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
  teamMembers = [],
  hasTeamAccess = false,
  defaultOwnerName = '',
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
  const [selectedClientIds, setSelectedClientIds] = useState(
    initialAppointment?.participants?.map(p => p.id).filter(Boolean) ||
    (initialAppointment?.clientId ? [initialAppointment.clientId] : [])
  );
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef(null);
  const [selectedServiceId, setSelectedServiceId] = useState(
    initialAppointment?.serviceId || ''
  );
  const [availableServices, setAvailableServices] = useState([]);
  const [notes, setNotes] = useState(initialAppointment?.notes || '');
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [showEndDropdown, setShowEndDropdown] = useState(false);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(
    initialAppointment?.serviceType === 'forloeb'
  );
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(8);
  const [recurrenceDays, setRecurrenceDays] = useState(['1', '3']); // default Mon/Wed (Mon=1)
  const [selectedColor, setSelectedColor] = useState(initialAppointment?.color || null);
  const [selectedMemberId, setSelectedMemberId] = useState(
    initialAppointment?.calendarOwnerId ||
      teamMembers[0]?.id ||
      null
  );
  const selectedServiceData = useMemo(
    () => availableServices.find((service) => service.id === selectedServiceId) || null,
    [availableServices, selectedServiceId]
  );
  const [showAddClient, setShowAddClient] = useState(false);

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
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target)
      ) {
        setShowClientDropdown(false);
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
    setSelectedClientIds(
      initialAppointment?.participants?.map(p => p.id).filter(Boolean) ||
      (initialAppointment?.clientId ? [initialAppointment.clientId] : [])
    );
    setSelectedServiceId(initialAppointment?.serviceId || '');
    setNotes(initialAppointment?.notes || '');
    setShowStartDropdown(false);
    setShowEndDropdown(false);
    setShowClientDropdown(false);
    setSelectedColor(initialAppointment?.color || null);
    setSelectedMemberId(
      initialAppointment?.calendarOwnerId ||
        initialAppointment?.therapistId ||
        teamMembers[0]?.id ||
        null
    );
  }, [initialAppointment, defaultDate, teamMembers]);

  useEffect(() => {
    if (selectedServiceData?.color) {
      setSelectedColor(selectedServiceData.color);
    }
  }, [selectedServiceData]);

  const selectedMember = useMemo(() => {
    if (!hasTeamAccess) return null;
    return teamMembers.find((m) => m.id === selectedMemberId) || teamMembers[0] || null;
  }, [hasTeamAccess, selectedMemberId, teamMembers]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!selectedServiceId) return;
    if (!startTime) return;

    const autoEnd = getAutoEndTime(startTime, timeSlots);
    setEndTime(autoEnd);
    setEndDate(startDate);
  }, [selectedServiceId, startTime, mode, timeSlots, startDate]);

  const parseDateStr = (dateStr) => {
    if (!dateStr) return null;
    const [dd, mm, yyyy] = dateStr.split('-').map((n) => parseInt(n, 10));
    if ([dd, mm, yyyy].some((n) => Number.isNaN(n))) return null;
    return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  };

  const formatDateStr = (dateObj) => {
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const generateSeries = (basePayload, selectedDays, weeksCount) => {
    const anchor = parseDateStr(startDate);
    if (!anchor) return [basePayload];
    const anchorWeekday = anchor.getDay(); // 0 = Sun
    const daysInt = selectedDays.map((d) => parseInt(d, 10));
    const results = [];
    for (let w = 0; w < weeksCount; w += 1) {
      daysInt.forEach((weekday) => {
        const offset = ((weekday - anchorWeekday + 7) % 7) + w * 7;
        const dateObj = new Date(anchor);
        dateObj.setDate(anchor.getDate() + offset);
        results.push({
          ...basePayload,
          startDate: formatDateStr(dateObj),
          endDate: formatDateStr(dateObj),
        });
      });
    }
    return results;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const base = initialAppointment || {};
    const selectedClientsData = clients.filter((client) => 
      selectedClientIds.includes(client.id)
    );
    const selectedServiceData =
      availableServices.find((service) => service.id === selectedServiceId) || null;

    // Build participants array from all selected clients
    const participants = selectedClientsData.map((client) => ({
      id: client.id,
      name: client.navn || 'Klient',
      email: client.email || '',
      phone: client.telefon || '',
    }));

    // Use first client as primary for backwards compatibility
    const primaryClient = selectedClientsData[0] || null;
    const ownerName = hasTeamAccess
      ? selectedMember?.name || defaultOwnerName
      : defaultOwnerName || base.calendarOwner || base.ownerName || '';
    const ownerColor =
      selectedMember?.calendarColor ||
      selectedMember?.avatarColor ||
      selectedColor ||
      base.color ||
      '#3B82F6';

    const appointmentPayload = {
      ...base,
      id: base.id || Date.now(),
      startDate,
      startTime,
      endDate,
      endTime,
      clientId: primaryClient?.id || base.clientId || null,
      client: primaryClient?.navn || base.client || '',
      clientEmail: primaryClient?.email || base.clientEmail || '',
      clientPhone: primaryClient?.telefon || base.clientPhone || '',
      serviceId: selectedServiceId || base.serviceId || null,
      service: selectedServiceData?.navn || base.service || '',
      serviceType: selectedServiceData?.type || 'service',
      forloebId: selectedServiceData?.forloebId || null,
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
      color:
        selectedServiceData?.color ||
        selectedColor ||
        base.color ||
        '#3B82F6',
      notes,
      calendarOwner: ownerName,
      calendarOwnerId: hasTeamAccess ? selectedMember?.id || null : null,
      ownerName,
      calendarColor: ownerColor,
      participants: participants.length > 0 ? participants : [
        {
          id: base.clientId || 'client-1',
          name: base.client || 'Klient',
          email: base.clientEmail || '',
          phone: base.clientPhone || '',
        },
      ],
    };

    if (appointmentPayload.serviceType === 'forloeb' && recurrenceEnabled) {
      const days = recurrenceDays.length ? recurrenceDays : ['1']; // fallback Monday
      const weeksCount = Math.max(1, Number(recurrenceWeeks) || 1);
      const series = generateSeries(appointmentPayload, days, weeksCount);
      if (mode === 'edit' && typeof onUpdate === 'function') {
        // For edit, just update single (to avoid accidental bulk overwrite)
        onUpdate(appointmentPayload);
      } else if (typeof onCreate === 'function') {
        onCreate(series);
      }
    } else {
      if (mode === 'edit' && typeof onUpdate === 'function') {
        onUpdate(appointmentPayload);
      } else if (typeof onCreate === 'function') {
        onCreate(appointmentPayload);
      }
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
        {hasTeamAccess && (
          <div className="form-section">
            <label className="form-label">Vælg medarbejder</label>
            <select
              className="form-select"
              value={selectedMemberId || ''}
              onChange={(e) => setSelectedMemberId(e.target.value || null)}
            >
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Select Client */}
        <div className="form-section">
          <label className="form-label">Vælg klienter</label>
          
          {/* Selected clients chips */}
          {selectedClientIds.length > 0 && (
            <div className="selected-clients-chips">
              {selectedClientIds.map((clientId) => {
                const client = clients.find((c) => c.id === clientId);
                if (!client) return null;
                return (
                  <span key={clientId} className="client-chip">
                    {client.navn}
                    <button
                      type="button"
                      className="client-chip-remove"
                      onClick={() => setSelectedClientIds((prev) => 
                        prev.filter((id) => id !== clientId)
                      )}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="client-select-row">
            <div className="client-multiselect-wrapper" ref={clientDropdownRef}>
              <button
                type="button"
                className={`client-multiselect-trigger ${showClientDropdown ? 'open' : ''}`}
                onClick={() => setShowClientDropdown((prev) => !prev)}
                disabled={clientsLoading}
              >
                <span className="client-multiselect-text">
                  {clientsLoading 
                    ? 'Henter klienter…' 
                    : selectedClientIds.length === 0 
                      ? 'Vælg klienter' 
                      : `${selectedClientIds.length} klient${selectedClientIds.length > 1 ? 'er' : ''} valgt`
                  }
                </span>
                <span className="dropdown-arrow">{showClientDropdown ? '▲' : '▼'}</span>
              </button>
              
              {showClientDropdown && !clientsLoading && (
                <div className="client-multiselect-dropdown">
                  <div className="client-multiselect-list">
                    {clients.map((client) => {
                      const isSelected = selectedClientIds.includes(client.id);
                      return (
                        <label
                          key={client.id}
                          className={`client-multiselect-option ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClientIds((prev) => [...prev, client.id]);
                              } else {
                                setSelectedClientIds((prev) => 
                                  prev.filter((id) => id !== client.id)
                                );
                              }
                            }}
                          />
                          <span className="client-option-info">
                            <span className="client-option-name">{client.navn}</span>
                            <span className="client-option-email">{client.email}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              className="add-client-btn-small"
              onClick={() => setShowAddClient(true)}
            >
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


        {selectedServiceData?.type === 'forloeb' && (
          <div className="form-section forloeb-planner">
            <div className="forloeb-planner__header">
              <label className="form-label">Planlæg forløb (gentagende tider)</label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={recurrenceEnabled}
                  onChange={(e) => setRecurrenceEnabled(e.target.checked)}
                />
                Aktivér gentagelse
              </label>
            </div>
            {recurrenceEnabled && (
              <div className="forloeb-planner__body">
                <div className="planner-row">
                  <div className="planner-group">
                    <label className="form-label">Uger (antal)</label>
                    <input
                      type="number"
                      min="1"
                      value={recurrenceWeeks}
                      onChange={(e) => setRecurrenceWeeks(e.target.value)}
                      className="date-input"
                    />
                  </div>
                  <div className="planner-group">
                    <label className="form-label">Dage pr. uge</label>
                    <div className="weekday-grid">
                      {[
                        { val: '1', label: 'Man' },
                        { val: '2', label: 'Tir' },
                        { val: '3', label: 'Ons' },
                        { val: '4', label: 'Tor' },
                        { val: '5', label: 'Fre' },
                        { val: '6', label: 'Lør' },
                        { val: '0', label: 'Søn' },
                      ].map((d) => (
                        <label key={d.val} className={`weekday-chip ${recurrenceDays.includes(d.val) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={recurrenceDays.includes(d.val)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRecurrenceDays((prev) => [...prev, d.val]);
                              } else {
                                setRecurrenceDays((prev) => prev.filter((x) => x !== d.val));
                              }
                            }}
                          />
                          {d.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="planner-hint">
                  Alle valgte dage oprettes fra startdatoen i {recurrenceWeeks || 1} uger med tiderne herover.
                </p>
              </div>
            )}
          </div>
        )}

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

      {showAddClient && (
        <AddKlient
          isOpen={showAddClient}
          onClose={() => setShowAddClient(false)}
          onSave={(newClient) => {
            if (newClient?.id) {
              setSelectedClientIds((prev) => [...prev, newClient.id]);
            }
            setShowAddClient(false);
          }}
          mode="create"
        />
      )}
    </div>
  );
}

export default AppointmentForm;
