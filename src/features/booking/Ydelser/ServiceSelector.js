import React, { useEffect, useMemo, useState } from 'react';
import { useUserServices } from './hooks/useUserServices';
import { useAuth } from '../../../AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

const formatPrice = (price) =>
  new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price ?? 0);

function ServiceSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Ingen ydelse valgt',
  onServicesChange,
}) {
  const { services, loading, error } = useUserServices();
  const { user } = useAuth();
  const [forloeb, setForloeb] = useState([]);
  const [forloebLoading, setForloebLoading] = useState(false);
  const [forloebError, setForloebError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadForloeb = async () => {
      if (!user?.uid) {
        setForloeb([]);
        return;
      }
      setForloebLoading(true);
      setForloebError(null);
      try {
        const ref = collection(db, 'users', user.uid, 'forloeb');
        const snap = await getDocs(ref);
        if (cancelled) return;
        const mapped = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: `forloeb:${d.id}`,
            forloebId: d.id,
            type: 'forloeb',
            navn: data.name || 'Forløb',
            varighed: data.totalSessions
              ? `${data.totalSessions} sessioner`
              : `${data.weeks || '?'} uger`,
            pris:
              typeof data.pricePerSession === 'number'
                ? data.pricePerSession
                : typeof data.packagePrice === 'number'
                ? data.packagePrice
                : null,
            format: data.format,
            setting: data.setting,
          };
        });
        setForloeb(mapped);
      } catch (e) {
        if (!cancelled) {
          console.error('[ServiceSelector] forløb load error', e);
          setForloebError('Kunne ikke hente forløb');
        }
      } finally {
        if (!cancelled) setForloebLoading(false);
      }
    };
    loadForloeb();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const combinedItems = useMemo(() => {
    const svc = (services || []).map((s) => ({ ...s, type: 'service' }));
    return [...svc, ...forloeb];
  }, [services, forloeb]);

  useEffect(() => {
    if (typeof onServicesChange === 'function') {
      onServicesChange(combinedItems);
    }
  }, [combinedItems, onServicesChange]);

  if (loading || forloebLoading) {
    return <p className="service-selector__status">Henter ydelser…</p>;
  }

  if (error || forloebError) {
    return <p className="service-selector__status error">{error || forloebError}</p>;
  }

  if (!combinedItems.length) {
    return <p className="service-selector__status">Du har ingen ydelser eller forløb endnu.</p>;
  }

  return (
    <label className="service-selector">
      Vælg behandling
      <div className="select-wrapper">
        <select
          className="select-input"
          value={value || ''}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          <optgroup label="Ydelser">
            {combinedItems
              .filter((i) => i.type === 'service')
              .map((service) => (
                <option key={service.id} value={service.id}>
                  [Ydelse] {service.navn} – {service.varighed} – DKK {formatPrice(service.pris)}
                </option>
              ))}
          </optgroup>
          <optgroup label="Forløb">
            {combinedItems
              .filter((i) => i.type === 'forloeb')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  [Forløb] {item.navn} – {item.varighed}
                  {typeof item.pris === 'number' ? ` – DKK ${formatPrice(item.pris)}` : ''}
                </option>
              ))}
          </optgroup>
        </select>
        <span className="dropdown-arrow">▼</span>
      </div>
    </label>
  );
}

export default ServiceSelector;

