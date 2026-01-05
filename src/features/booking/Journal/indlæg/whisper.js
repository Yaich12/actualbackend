import React, { useMemo } from 'react';
import './whisper.css';

const DEFAULT_LABELS = {
  ariaLabel: 'Whisper transskription',
  title: 'Whisper transskription',
  subtitle: 'Seneste data fra transskription',
  excerptTitle: 'Tekstuddrag',
  placeholder: 'Ingen tekst tilgængelig.',
  usageTitle: 'Tokenforbrug',
  usageLabels: {
    type: 'Type',
    input: 'Input',
    output: 'Output',
    total: 'Total',
    textTokens: 'Teksttokens',
    audioTokens: 'Lydtokens',
  },
};

const mergeLabels = (overrides = {}) => ({
  ...DEFAULT_LABELS,
  ...overrides,
  usageLabels: { ...DEFAULT_LABELS.usageLabels, ...(overrides.usageLabels || {}) },
});

const Whisper = ({ data, labels }) => {
  const safeData = data || {};
  const copy = mergeLabels(labels);
  const { text = '', usage = {} } = safeData;

  const paragraphs = useMemo(() => {
    if (typeof text !== 'string') {
      return [];
    }

    const normalized = text.trim();
    if (!normalized) {
      return [];
    }

    const explicitParagraphs = normalized
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    if (explicitParagraphs.length > 1) {
      return explicitParagraphs;
    }

    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (sentences.length <= 2) {
      return [normalized];
    }

    const chunkSize = sentences.length > 5 ? 3 : 2;
    const chunked = [];
    for (let i = 0; i < sentences.length; i += chunkSize) {
      chunked.push(sentences.slice(i, i + chunkSize).join(' '));
    }
    return chunked;
  }, [text]);

  const inputDetails = usage?.input_token_details || {};
  const hasTextTokenDetails = Object.prototype.hasOwnProperty.call(
    inputDetails,
    'text_tokens'
  );
  const hasAudioTokenDetails = Object.prototype.hasOwnProperty.call(
    inputDetails,
    'audio_tokens'
  );
  const hasInputDetails = hasTextTokenDetails || hasAudioTokenDetails;
  const hasUsage = Object.keys(usage || {}).length > 0;

  if (!data) {
    return null;
  }

  return (
    <div className="whisper-panel" role="region" aria-label={copy.ariaLabel}>
      <div className="whisper-header">
        <div className="whisper-header-icon">🔊</div>
        <div>
          <p className="whisper-title">{copy.title}</p>
          <p className="whisper-subtitle">{copy.subtitle}</p>
        </div>
      </div>

      <div className="whisper-section">
        <p className="whisper-section-title">{copy.excerptTitle}</p>
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => (
            <p key={`whisper-paragraph-${index}`} className="whisper-paragraph">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="whisper-placeholder">{copy.placeholder}</p>
        )}
      </div>

      {hasUsage && (
        <div className="whisper-section">
          <p className="whisper-section-title">{copy.usageTitle}</p>
          <div className="whisper-usage-grid">
            <div className="whisper-usage-item">
              <span className="whisper-usage-label">{copy.usageLabels.type}</span>
              <span className="whisper-usage-value">{usage.type || '—'}</span>
            </div>
            <div className="whisper-usage-item">
              <span className="whisper-usage-label">{copy.usageLabels.input}</span>
              <span className="whisper-usage-value">{usage.input_tokens ?? '—'}</span>
            </div>
            <div className="whisper-usage-item">
              <span className="whisper-usage-label">{copy.usageLabels.output}</span>
              <span className="whisper-usage-value">{usage.output_tokens ?? '—'}</span>
            </div>
            <div className="whisper-usage-item">
              <span className="whisper-usage-label">{copy.usageLabels.total}</span>
              <span className="whisper-usage-value">{usage.total_tokens ?? '—'}</span>
            </div>
          </div>

          {hasInputDetails && (
            <div className="whisper-token-details">
              <div>
                <span className="whisper-usage-label">{copy.usageLabels.textTokens}</span>
                <span className="whisper-usage-value">{hasTextTokenDetails ? inputDetails.text_tokens : '—'}</span>
              </div>
              <div>
                <span className="whisper-usage-label">{copy.usageLabels.audioTokens}</span>
                <span className="whisper-usage-value">{hasAudioTokenDetails ? inputDetails.audio_tokens : '—'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Whisper;
