import React, { useEffect, useMemo, useRef, useState } from 'react';
import './appointments.css';
import { useUserClients } from '../Klienter/hooks/useUserClients';
import ServiceSelector from '../Ydelser/ServiceSelector';
import AddKlient from '../Klienter/addklient/addklient';
import { normalizeDateString, parseDateString } from '../../../utils/appointmentFormat';
import { CalendarDays } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';

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

const createRecurrenceGroupId = () =>
  `forloeb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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
  const { t } = useLanguage();
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
  const recurrenceWeekdays = useMemo(
    () => [
      { val: '1', label: t('booking.appointmentForm.recurrence.weekdays.mon', 'Mon') },
      { val: '2', label: t('booking.appointmentForm.recurrence.weekdays.tue', 'Tue') },
      { val: '3', label: t('booking.appointmentForm.recurrence.weekdays.wed', 'Wed') },
      { val: '4', label: t('booking.appointmentForm.recurrence.weekdays.thu', 'Thu') },
      { val: '5', label: t('booking.appointmentForm.recurrence.weekdays.fri', 'Fri') },
      { val: '6', label: t('booking.appointmentForm.recurrence.weekdays.sat', 'Sat') },
      { val: '0', label: t('booking.appointmentForm.recurrence.weekdays.sun', 'Sun') },
    ],
    [t]
  );
  const [showAddClient, setShowAddClient] = useState(false);

  const startDropdownRef = useRef(null);
  const endDropdownRef = useRef(null);
  const datePickerRef = useRef(null);

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

  useEffect(() => {
    setEndDate((prev) => (prev === startDate ? prev : startDate));
  }, [startDate]);

  const parseDateStr = (dateStr) => {
    const parsed = parseDateString(dateStr);
    if (!parsed) return null;
    return new Date(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0);
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
    const recurrenceGroupId = createRecurrenceGroupId();
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
          recurrenceGroupId,
          isRecurringSeries: true,
        });
      });
    }
    const sortedResults = results.sort((left, right) => {
      const leftTime = parseDateStr(left.startDate)?.getTime() || 0;
      const rightTime = parseDateStr(right.startDate)?.getTime() || 0;
      return leftTime - rightTime;
    });
    return sortedResults.map((item, index) => ({
      ...item,
      recurrenceIndex: index,
      recurrenceCount: sortedResults.length,
      recurrenceAnchorDate: sortedResults[0]?.startDate || item.startDate,
    }));
  };

  const startDateNativeValue = useMemo(() => {
    const parsed = parseDateStr(startDate);
    if (!parsed) return '';
    const yyyy = parsed.getFullYear().toString().padStart(4, '0');
    const mm = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const dd = parsed.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [startDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const base = initialAppointment || {};
    const selectedClientsData = clients.filter((client) => 
      selectedClientIds.includes(client.id)
    );
    const selectedServiceData =
      availableServices.find((service) => service.id === selectedServiceId) || null;

    const normalizedStartDate = normalizeDateString(startDate);
    const normalizedEndDate = normalizeDateString(endDate);

    // Build participants array from all selected clients
    const participants = selectedClientsData.map((client) => ({
      id: client.id,
      name: client.navn || t('booking.appointmentForm.clientFallback', 'Client'),
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
      startDate: normalizedStartDate,
      startTime,
      endDate: normalizedEndDate,
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
        typeof selectedServiceData?.pris === 'number'
          ? selectedServiceData.pris
          : typeof base.servicePrice === 'number'
            ? base.servicePrice
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
          name: base.client || t('booking.appointmentForm.clientFallback', 'Client'),
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
          {mode === 'edit'
            ? t('booking.appointmentForm.title.edit', 'Edit appointment')
            : t('booking.appointmentForm.title.create', 'Create appointment')}
        </h2>
      </div>

      <form className="appointment-form" onSubmit={handleSubmit}>
        {/* Date and Time */}
        <div className="form-section">
          <div className="datetime-row">
            <div className="datetime-group">
              <label className="form-label">{t('booking.appointmentForm.fields.date', 'Date')}</label>
              <div className="datetime-inputs">
                <input
                  type="text"
                  className="date-input"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDate(e.target.value);
                  }}
                  placeholder="dd-mm-yyyy"
                />
                <div className="date-picker-inline">
                  <input
                    ref={datePickerRef}
                    type="date"
                    value={startDateNativeValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const [yyyy, mm, dd] = val.split('-').map((v) => Number(v));
                      const dateObj = new Date(yyyy, (mm || 1) - 1, dd || 1);
                      const formatted = formatDateStr(dateObj);
                      setStartDate(formatted);
                      setEndDate(formatted);
                    }}
                    className="hidden-native-date"
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      pointerEvents: 'none',
                      width: 0,
                      height: 0,
                    }}
                  />
                  <button
                    type="button"
                    className="date-picker-trigger"
                    onClick={() => {
                      if (datePickerRef.current) {
                        if (typeof datePickerRef.current.showPicker === 'function') {
                          datePickerRef.current.showPicker();
                        } else {
                          datePickerRef.current.focus();
                          datePickerRef.current.click();
                        }
                      }
                    }}
                    aria-label={t('booking.appointmentForm.datePickerLabel', 'Choose date')}
                    title={t('booking.appointmentForm.datePickerLabel', 'Choose date')}
                  >
                    <CalendarDays className="date-picker-icon" size={16} strokeWidth={1.9} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="datetime-row">
            <div className="datetime-group">
              <label className="form-label">{t('booking.appointmentForm.fields.startTime', 'Start time')}</label>
              <div className="datetime-inputs">
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
              <label className="form-label">{t('booking.appointmentForm.fields.endTime', 'End time')}</label>
              <div className="datetime-inputs">
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
            <label className="form-label">
              {t('booking.appointmentForm.fields.practitioner', 'Select practitioner')}
            </label>
            <div className="select-wrapper">
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
              <span className="dropdown-arrow">▼</span>
            </div>
          </div>
        )}

        {/* Select Client */}
        <div className="form-section">
          <label className="form-label">{t('booking.appointmentForm.fields.clients', 'Select clients')}</label>
          
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
                    ? t('booking.appointmentForm.clientsLoading', 'Loading clients…')
                    : selectedClientIds.length === 0 
                      ? t('booking.appointmentForm.clientsPlaceholder', 'Select clients')
                      : selectedClientIds.length > 1
                        ? t('booking.appointmentForm.clientsSelectedPlural', '{count} clients selected', {
                            count: selectedClientIds.length,
                          })
                        : t('booking.appointmentForm.clientsSelectedSingle', '{count} client selected', {
                            count: selectedClientIds.length,
                          })
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
              {t('booking.appointmentForm.addClient', 'Add client')}
            </button>
          </div>
          {clientsError && (
            <p className="client-select-error" role="alert">
              {clientsError}
            </p>
          )}
          {!clientsError && !clientsLoading && clients.length === 0 && (
            <p className="client-select-empty">
              {t(
                'booking.appointmentForm.clientsEmpty',
                'You have no clients yet. Add a new one to continue.'
              )}
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
              <label className="form-label">
                {t('booking.appointmentForm.recurrence.title', 'Plan program (recurring times)')}
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={recurrenceEnabled}
                  onChange={(e) => setRecurrenceEnabled(e.target.checked)}
                />
                {t('booking.appointmentForm.recurrence.enable', 'Enable recurrence')}
              </label>
            </div>
            {recurrenceEnabled && (
              <div className="forloeb-planner__body">
                <div className="planner-row">
                  <div className="planner-group">
                    <label className="form-label">
                      {t('booking.appointmentForm.recurrence.weeks', 'Weeks (count)')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={recurrenceWeeks}
                      onChange={(e) => setRecurrenceWeeks(e.target.value)}
                      className="date-input"
                    />
                  </div>
                  <div className="planner-group">
                    <label className="form-label">
                      {t('booking.appointmentForm.recurrence.daysPerWeek', 'Days per week')}
                    </label>
                    <div className="weekday-grid">
                      {recurrenceWeekdays.map((d) => (
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
                  {t(
                    'booking.appointmentForm.recurrence.summary',
                    'All selected days will be created from the start date for {weeks} weeks using the times above.',
                    { weeks: recurrenceWeeks || 1 }
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="form-section notes-section">
          <label className="form-label">{t('booking.appointmentForm.fields.notes', 'Notes')}</label>
          <textarea
            className="notes-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t(
              'booking.appointmentForm.notesPlaceholder',
              'Notes are private and are not visible to your client.'
            )}
            rows={6}
          />
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={handleCancel}>
            {t('booking.appointmentForm.actions.cancel', 'Cancel')}
          </button>
          <button type="submit" className="submit-btn">
            {mode === 'edit'
              ? t('booking.appointmentForm.actions.update', 'Update appointment')
              : t('booking.appointmentForm.actions.create', 'Create appointment')}
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
