import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';
import './dropdown.css';

function Dropdown({ label = '', onManual, onCalendar, disabled = false }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const resolvedLabel = label || t('booking.dropdown.add', 'Tilføj');

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (type) => {
    setOpen(false);
    if (type === 'calendar') {
      onCalendar?.();
      return;
    }
    onManual?.();
  };

  return (
    <div className="booking-add-dropdown" ref={menuRef}>
      <button
        type="button"
        className="toolbar-pill toolbar-primary"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
      >
        {resolvedLabel}
        <ChevronDown className="toolbar-caret" />
      </button>
      {open && (
        <div className="booking-add-dropdown-menu">
          <button
            type="button"
            className="booking-add-dropdown-item"
            onClick={() => handleSelect('calendar')}
          >
            {t('booking.dropdown.calendar', 'I kalenderen')}
          </button>
          <button
            type="button"
            className="booking-add-dropdown-item"
            onClick={() => handleSelect('manual')}
          >
            {t('booking.dropdown.manual', 'Manuelt')}
          </button>
        </div>
      )}
    </div>
  );
}

export default Dropdown;
