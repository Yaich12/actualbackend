import React, { useMemo, useState } from 'react';

const DEFAULT_LABELS = {
  title: 'FactsR™',
  poweredBy: 'Drevet af Selma',
  groupFallback: 'Andet',
  status: {
    connecting: 'Forbinder…',
    streaming: 'Live',
    finalizing: 'Afslutter…',
    ended: 'Afsluttet',
    error: 'Fejl',
    idle: 'Klar',
  },
  record: {
    start: 'Optag',
    stop: 'Stop optagelse',
  },
  interactionLabel: 'Interaktion:',
  latestLabel: 'Seneste',
  insertBarLabel: 'Indsæt i journal',
  insertBarTitle: 'Indsæt i journal:',
  insertTargets: {
    auto: 'Auto',
    anamnesis: 'Anamnese',
    conclusion_focus: 'Fokusområder',
    conclusion_content: 'Sessionens indhold',
    conclusion_tasks: 'Opgaver',
    conclusion_reflection: 'Refleksion',
    combined: 'Samlet',
  },
  insertSelected: 'Indsæt i journal',
  insertSelectedTitle: 'Indsæt de markerede fakta',
  insertAll: 'Indsæt alle',
  insertAllTitle: 'Indsæt alle fakta i valgt felt',
  tabs: {
    facts: 'Fakta',
    transcript: 'Transkript',
  },
  actions: {
    flush: 'Opdater',
    clear: 'Ryd',
  },
  item: {
    select: 'Marker',
    recommended: 'Anbefalet',
    insert: 'Indsæt',
    insertTitle: 'Indsæt denne sætning i valgt felt',
  },
  empty: {
    facts:
      'Ingen fakta endnu. Typisk kommer de første fakta efter ~60 sek. Brug dem som forslag og gennemgå altid klinisk.',
    transcript: 'Ingen transkript endnu.',
  },
  meta: {
    source: 'kilde',
    discarded: 'kasseret',
  },
};

const mergeLabels = (overrides = {}) => ({
  ...DEFAULT_LABELS,
  ...overrides,
  status: { ...DEFAULT_LABELS.status, ...(overrides.status || {}) },
  record: { ...DEFAULT_LABELS.record, ...(overrides.record || {}) },
  insertTargets: { ...DEFAULT_LABELS.insertTargets, ...(overrides.insertTargets || {}) },
  tabs: { ...DEFAULT_LABELS.tabs, ...(overrides.tabs || {}) },
  actions: { ...DEFAULT_LABELS.actions, ...(overrides.actions || {}) },
  item: { ...DEFAULT_LABELS.item, ...(overrides.item || {}) },
  empty: { ...DEFAULT_LABELS.empty, ...(overrides.empty || {}) },
  meta: { ...DEFAULT_LABELS.meta, ...(overrides.meta || {}) },
});

const statusLabel = (status, labels) => {
  if (!status) return labels.status.idle;
  return labels.status[status] || labels.status.idle;
};

export default function FactsRPanel({
  status,
  interactionId,
  error,
  transcripts,
  facts,
  isRecording,
  recordingStatus,
  onToggleRecording,
  insertTarget,
  onChangeInsertTarget,
  suggestionForFact,
  onInsertSelected,
  onInsertAll,
  onInsertOne,
  onFlush,
  onClear,
  labels,
}) {
  const copy = mergeLabels(labels);
  const [tab, setTab] = useState('facts'); // facts | transcript
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const factGroups = useMemo(() => {
    const grouped = new Map();
    (facts || []).forEach((f) => {
      const k = f.group || copy.groupFallback || '';
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(f);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [facts, copy.groupFallback]);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  const latestTranscript = useMemo(() => {
    const list = transcripts || [];
    const lastFinal = [...list].reverse().find((t) => t.final);
    return lastFinal?.transcript || (list[list.length - 1]?.transcript ?? '');
  }, [transcripts]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelected = () => setSelectedIds(new Set());

  const handleInsertSelected = () => {
    if (typeof onInsertSelected !== 'function') return;
    const texts =
      (facts || [])
        .filter((f) => f?.id && selectedIds.has(f.id) && !f.isDiscarded)
        .map((f) => f.text)
        .filter(Boolean) || [];
    onInsertSelected(texts);
    clearSelected();
  };

  return (
    <div className="factsR-panel">
      <div className="factsR-header">
        <div className="factsR-titleRow">
          <div className="factsR-title">
            {copy.title} <span className="factsR-powered">{copy.poweredBy}</span>
          </div>
          <div className="factsR-right">
            <span className={`factsR-pill factsR-pill--${status || 'idle'}`}>{statusLabel(status, copy)}</span>
            <button
              type="button"
              className={`factsR-recordBtn ${isRecording ? 'active' : ''}`}
              onClick={onToggleRecording}
            >
              <span className="factsR-recordDot" aria-hidden="true" />
              {isRecording ? copy.record.stop : copy.record.start}
            </button>
          </div>
        </div>
        <div className="factsR-meta">
          <span className="factsR-metaLabel">{copy.interactionLabel}</span>{' '}
          <span className="factsR-mono">{interactionId || '—'}</span>
        </div>
        {latestTranscript ? (
          <div className="factsR-peek">
            {copy.latestLabel}: “{latestTranscript}”
          </div>
        ) : null}
        {recordingStatus ? <div className="factsR-recordingStatus">{recordingStatus}</div> : null}
        {error ? <div className="factsR-error">{error}</div> : null}
      </div>

      <div className="factsR-insertBar" aria-label={copy.insertBarLabel}>
        <div className="factsR-insertTitle">{copy.insertBarTitle}</div>
        <div className="factsR-targets">
          {[
            ['auto', copy.insertTargets.auto],
            ['anamnesis', copy.insertTargets.anamnesis],
            ['conclusion_focus', copy.insertTargets.conclusion_focus],
            ['conclusion_content', copy.insertTargets.conclusion_content],
            ['conclusion_tasks', copy.insertTargets.conclusion_tasks],
            ['conclusion_reflection', copy.insertTargets.conclusion_reflection],
            ['combined', copy.insertTargets.combined],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`factsR-targetBtn ${insertTarget === key ? 'active' : ''}`}
              onClick={() => onChangeInsertTarget?.(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="factsR-insertActions">
          <button
            type="button"
            className="factsR-insertPrimary"
            onClick={handleInsertSelected}
            disabled={!selectedCount}
            title={copy.insertSelectedTitle}
          >
            {copy.insertSelected}{selectedCount ? ` (${selectedCount})` : ''}
          </button>
          <button
            type="button"
            className="factsR-insertSecondary"
            onClick={() => onInsertAll?.((facts || []).filter((f) => !f.isDiscarded).map((f) => f.text).filter(Boolean))}
            disabled={!(facts?.length)}
            title={copy.insertAllTitle}
          >
            {copy.insertAll}
          </button>
        </div>
      </div>

      <div className="factsR-tabs">
        <button
          type="button"
          className={`factsR-tab ${tab === 'facts' ? 'active' : ''}`}
          onClick={() => setTab('facts')}
        >
          {copy.tabs.facts} <span className="factsR-count">{facts?.length || 0}</span>
        </button>
        <button
          type="button"
          className={`factsR-tab ${tab === 'transcript' ? 'active' : ''}`}
          onClick={() => setTab('transcript')}
        >
          {copy.tabs.transcript} <span className="factsR-count">{transcripts?.length || 0}</span>
        </button>
        <div className="factsR-spacer" />
        <button
          type="button"
          className="factsR-ghostBtn"
          onClick={onFlush}
          disabled={status !== 'streaming'}
        >
          {copy.actions.flush}
        </button>
        <button type="button" className="factsR-ghostBtn" onClick={onClear}>
          {copy.actions.clear}
        </button>
      </div>

      <div className="factsR-body">
        {tab === 'facts' ? (
          <div className="factsR-scroll">
            {facts?.length ? (
              factGroups.map(([group, items]) => (
                <div key={group} className="factsR-group">
                  <div className="factsR-groupTitle">{group}</div>
                  {items.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`factsR-item factsR-itemButton ${f.isDiscarded ? 'discarded' : ''}`}
                      onClick={() => {
                        const suggestion = typeof suggestionForFact === 'function' ? suggestionForFact(f) : null;
                        onInsertOne?.(f?.text, suggestion?.key);
                      }}
                      disabled={!f?.text || f.isDiscarded}
                      title={copy.item.insertTitle}
                    >
                      <div className="factsR-itemTop">
                        <label className="factsR-check">
                          <input
                            type="checkbox"
                            checked={!!(f?.id && selectedIds.has(f.id))}
                            onChange={() => f?.id && toggleSelected(f.id)}
                            disabled={!f?.id || f.isDiscarded}
                          />
                          <span>{copy.item.select}</span>
                        </label>
                        <span className="factsR-suggest">
                          {typeof suggestionForFact === 'function'
                            ? `${copy.item.recommended}: ${suggestionForFact(f)?.label || copy.insertTargets.anamnesis}`
                            : ''}
                        </span>
                        <button
                          type="button"
                          className="factsR-insertOne"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const suggestion = typeof suggestionForFact === 'function' ? suggestionForFact(f) : null;
                            onInsertOne?.(f?.text, suggestion?.key);
                          }}
                          disabled={!f?.text || f.isDiscarded}
                          title={copy.item.insertTitle}
                        >
                          {copy.item.insert}
                        </button>
                      </div>
                      <div className="factsR-itemText">{f.text}</div>
                      <div className="factsR-itemMeta">
                        {f.source ? <span>{copy.meta.source}: {f.source}</span> : null}
                        {f.isDiscarded ? <span>{copy.meta.discarded}</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="factsR-empty">{copy.empty.facts}</div>
            )}
          </div>
        ) : (
          <div className="factsR-scroll factsR-mono">
            {transcripts?.length ? (
              transcripts.slice(-60).map((t, idx) => (
                <div key={t.id || idx} className="factsR-line">
                  <span className={`factsR-dot ${t.final ? 'final' : 'interim'}`} />
                  <span>{t.transcript}</span>
                </div>
              ))
            ) : (
              <div className="factsR-empty">{copy.empty.transcript}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
