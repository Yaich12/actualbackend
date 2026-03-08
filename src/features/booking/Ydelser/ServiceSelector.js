import React, { useEffect, useMemo, useState } from 'react';
import { useUserServices } from './hooks/useUserServices';
import { useAuth } from '../../../AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useLanguage } from '../../../LanguageContext';
import { formatServiceDuration } from '../../../utils/serviceLabels';
import { migrateLegacyCollectionToClinic } from '../../../utils/workspaceContext';

const normalizeProgramPrice = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function ServiceSelector({
  value,
  onChange,
  disabled = false,
  placeholder = '',
  onServicesChange,
}) {
  const { services, loading, error } = useUserServices();
  const { workspaceUid, activeClinicId } = useAuth();
  const clinicId = `${activeClinicId || ''}`.trim();
  const { t, locale } = useLanguage();
  const resolvedPlaceholder =
    placeholder || t('booking.services.selector.placeholder', 'Ingen ydelse valgt');
  const formatPrice = (price) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price ?? 0);
  const [forloeb, setForloeb] = useState([]);
  const [forloebLoading, setForloebLoading] = useState(false);
  const [forloebError, setForloebError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadForloeb = async () => {
      if (!clinicId && !workspaceUid) {
        setForloeb([]);
        return;
      }
      setForloebLoading(true);
      setForloebError(null);
      try {
        if (clinicId && workspaceUid) {
          try {
            await migrateLegacyCollectionToClinic({
              clinicId,
              legacyOwnerUid: workspaceUid,
              collectionName: 'forloeb',
              transformDoc: ({ data }) => ({
                clinicId,
                createdByUid: data.createdByUid || data.therapistId || null,
              }),
            });
          } catch (migrationError) {
            console.error('[ServiceSelector] forløb migration error', migrationError);
          }
        }

        const ref = clinicId
          ? collection(db, 'clinics', clinicId, 'forloeb')
          : collection(db, 'users', workspaceUid, 'forloeb');
        const snap = await getDocs(ref);
        if (cancelled) return;
        const mapped = snap.docs.map((d) => {
          const data = d.data();
          const packagePrice = normalizeProgramPrice(data.packagePrice);
          return {
            id: `forloeb:${d.id}`,
            forloebId: d.id,
            type: 'forloeb',
            navn: data.name || t('booking.programs.defaultName', 'Forløb'),
            varighed: data.totalSessions
              ? t('booking.programs.sessionsCount', '{count} sessioner', {
                  count: data.totalSessions,
                })
              : t('booking.programs.weeksCount', '{count} uger', {
                  count: data.weeks || '?',
                }),
            pris: packagePrice,
            prisInklMoms: packagePrice,
            packagePrice,
            format: data.format,
            setting: data.setting,
          };
        });
        setForloeb(mapped);
      } catch (e) {
        if (!cancelled) {
          console.error('[ServiceSelector] forløb load error', e);
          setForloebError(t('booking.programs.loadError', 'Kunne ikke hente forløb'));
        }
      } finally {
        if (!cancelled) setForloebLoading(false);
      }
    };
    loadForloeb();
    return () => {
      cancelled = true;
    };
  }, [clinicId, t, workspaceUid]);

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
    return (
      <p className="service-selector__status">
        {t('booking.services.selector.loading', 'Henter ydelser…')}
      </p>
    );
  }

  if (error || forloebError) {
    return <p className="service-selector__status error">{error || forloebError}</p>;
  }

  if (!combinedItems.length) {
    return (
      <p className="service-selector__status">
        {t('booking.services.selector.empty', 'Du har ingen ydelser eller forløb endnu.')}
      </p>
    );
  }

  return (
    <label className="service-selector">
      {t('booking.services.selector.label', 'Vælg behandling')}
      <div className="select-wrapper">
        <select
          className="select-input"
          value={value || ''}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
        >
          <option value="">{resolvedPlaceholder}</option>
          <optgroup label={t('booking.services.selector.groups.services', 'Ydelser')}>
            {combinedItems
              .filter((i) => i.type === 'service')
              .map((service) => (
                <option key={service.id} value={service.id}>
                  [{t('booking.services.selector.tags.service', 'Ydelse')}] {service.navn} –{' '}
                  {formatServiceDuration(service.varighed, t) || service.varighed} –{' '}
                  {t('booking.services.price.currency', 'DKK')} {formatPrice(service.pris)}
                </option>
              ))}
          </optgroup>
          <optgroup label={t('booking.services.selector.groups.programs', 'Forløb')}>
            {combinedItems
              .filter((i) => i.type === 'forloeb')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  [{t('booking.services.selector.tags.program', 'Forløb')}] {item.navn} –{' '}
                  {item.varighed}
                  {typeof item.pris === 'number'
                    ? ` – ${t('booking.services.price.currency', 'DKK')} ${formatPrice(item.pris)}`
                    : ''}
                </option>
              ))}
          </optgroup>
        </select>
      </div>
    </label>
  );
}

export default ServiceSelector;
