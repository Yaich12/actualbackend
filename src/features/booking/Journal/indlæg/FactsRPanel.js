import React, { useMemo, useState } from 'react';

const statusLabel = (status) => {
  switch (status) {
    case 'connecting':
      return 'Forbinder…';
    case 'streaming':
      return 'Live';
    case 'finalizing':
      return 'Afslutter…';
    case 'ended':
      return 'Afsluttet';
    case 'error':
      return 'Fejl';
    default:
      return 'Klar';
  }
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
}) {
  const [tab, setTab] = useState('facts'); // facts | transcript
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const factGroups = useMemo(() => {
    const grouped = new Map();
    (facts || []).forEach((f) => {
      const k = f.group || 'andet';
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(f);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [facts]);

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
            FactsR™ <span className="factsR-powered">Powered by Corti</span>
          </div>
          <div className="factsR-right">
            <span className={`factsR-pill factsR-pill--${status || 'idle'}`}>{statusLabel(status)}</span>
            <button
              type="button"
              className={`factsR-recordBtn ${isRecording ? 'active' : ''}`}
              onClick={onToggleRecording}
            >
              <span className="factsR-recordDot" aria-hidden="true" />
              {isRecording ? 'Stop optagelse' : 'Optag'}
            </button>
          </div>
        </div>
        <div className="factsR-meta">
          <span className="factsR-metaLabel">Interaction:</span>{' '}
          <span className="factsR-mono">{interactionId || '—'}</span>
        </div>
        {latestTranscript ? <div className="factsR-peek">Seneste: “{latestTranscript}”</div> : null}
        {recordingStatus ? <div className="factsR-recordingStatus">{recordingStatus}</div> : null}
        {error ? <div className="factsR-error">{error}</div> : null}
      </div>

      <div className="factsR-insertBar" aria-label="Indsæt i journal">
        <div className="factsR-insertTitle">Indsæt i journal:</div>
        <div className="factsR-targets">
          {[
            ['auto', 'Auto'],
            ['anamnesis', 'Anamnese'],
            ['conclusion_focus', 'Fokusområder'],
            ['conclusion_content', 'Sessionens indhold'],
            ['conclusion_tasks', 'Opgaver'],
            ['conclusion_reflection', 'Refleksion'],
            ['combined', 'Samlet'],
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
            title="Indsæt de markerede facts"
          >
            Indsæt i journal{selectedCount ? ` (${selectedCount})` : ''}
          </button>
          <button
            type="button"
            className="factsR-insertSecondary"
            onClick={() => onInsertAll?.((facts || []).filter((f) => !f.isDiscarded).map((f) => f.text).filter(Boolean))}
            disabled={!(facts?.length)}
            title="Indsæt alle facts i valgt felt"
          >
            Indsæt alle
          </button>
        </div>
      </div>

      <div className="factsR-tabs">
        <button
          type="button"
          className={`factsR-tab ${tab === 'facts' ? 'active' : ''}`}
          onClick={() => setTab('facts')}
        >
          Fakta <span className="factsR-count">{facts?.length || 0}</span>
        </button>
        <button
          type="button"
          className={`factsR-tab ${tab === 'transcript' ? 'active' : ''}`}
          onClick={() => setTab('transcript')}
        >
          Transkript <span className="factsR-count">{transcripts?.length || 0}</span>
        </button>
        <div className="factsR-spacer" />
        <button type="button" className="factsR-ghostBtn" onClick={onFlush} disabled={status !== 'streaming'}>
          Flush
        </button>
        <button type="button" className="factsR-ghostBtn" onClick={onClear}>
          Ryd
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
                      title="Klik for at indsætte i det anbefalede felt"
                    >
                      <div className="factsR-itemTop">
                        <label className="factsR-check">
                          <input
                            type="checkbox"
                            checked={!!(f?.id && selectedIds.has(f.id))}
                            onChange={() => f?.id && toggleSelected(f.id)}
                            disabled={!f?.id || f.isDiscarded}
                          />
                          <span>Marker</span>
                        </label>
                        <span className="factsR-suggest">
                          {typeof suggestionForFact === 'function'
                            ? `Anbefalet: ${suggestionForFact(f)?.label || 'Anamnese'}`
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
                          title="Indsæt dette statement i valgt felt"
                        >
                          Indsæt
                        </button>
                      </div>
                      <div className="factsR-itemText">{f.text}</div>
                      <div className="factsR-itemMeta">
                        {f.source ? <span>source: {f.source}</span> : null}
                        {f.isDiscarded ? <span>discarded</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="factsR-empty">
                Ingen fakta endnu. Typisk kommer første “facts” efter ~60 sek. Brug dem som forslag og gennemgå altid klinisk.
              </div>
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
              <div className="factsR-empty">Ingen transkript endnu.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


