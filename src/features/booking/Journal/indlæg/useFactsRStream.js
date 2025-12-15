import { useCallback, useMemo, useRef, useState } from 'react';

const getBackendHttpBase = () => {
  const envBase = process.env.REACT_APP_BACKEND_URL;
  if (envBase && typeof envBase === 'string') return envBase.replace(/\/+$/, '');

  // Reuse the same origin/host as transcription endpoint if present
  const transcribeUrl = process.env.REACT_APP_TRANSCRIBE_URL;
  if (transcribeUrl && typeof transcribeUrl === 'string') {
    try {
      const u = new URL(transcribeUrl);
      return `${u.protocol}//${u.host}`;
    } catch (_) {}
  }

  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost') return 'http://localhost:4000';
    return window.location.origin;
  }

  return 'http://localhost:4000';
};

const toWsBase = (httpBase) => {
  try {
    const u = new URL(httpBase);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${u.host}`;
  } catch (_) {
    return httpBase.replace(/^http/, 'ws');
  }
};

export function useFactsRStream() {
  const httpBase = useMemo(() => getBackendHttpBase(), []);
  const wsBase = useMemo(() => toWsBase(httpBase), [httpBase]);

  const wsRef = useRef(null);

  const [status, setStatus] = useState('idle'); // idle | connecting | streaming | finalizing | ended | error
  const [interactionId, setInteractionId] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [transcripts, setTranscripts] = useState([]);
  const [facts, setFacts] = useState([]);

  const resetState = useCallback(() => {
    setStatus('idle');
    setInteractionId(null);
    setAccepted(false);
    setError('');
    setTranscripts([]);
    setFacts([]);
  }, []);

  const closeSocket = useCallback(() => {
    try {
      wsRef.current?.close();
    } catch (_) {}
    wsRef.current = null;
  }, []);

  const clear = useCallback(() => {
    closeSocket();
    resetState();
  }, [closeSocket, resetState]);

  const start = useCallback(
    async ({
      primaryLanguage = 'da',
      outputLocale = 'da',
      encounterIdentifier,
      title,
    } = {}) => {
      // Close any previous run
      clear();
      setStatus('connecting');

      const resp = await fetch(`${httpBase}/api/facts-stream/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryLanguage,
          outputLocale,
          encounterIdentifier,
          title,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`FactsR init failed (${resp.status}): ${t}`);
      }

      const data = await resp.json();
      if (!data?.wsPath || !data?.interactionId) {
        throw new Error('FactsR init did not return wsPath/interactionId');
      }

      setInteractionId(data.interactionId);

      const wsUrl = `${wsBase}${data.wsPath}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        // We still wait for CONFIG_ACCEPTED before sending audio
      };

      ws.onmessage = (evt) => {
        let msg = null;
        try {
          msg = JSON.parse(evt.data);
        } catch (_) {
          return;
        }

        if (msg?.type === 'CONFIG_ACCEPTED') {
          setAccepted(true);
          setStatus('streaming');
          return;
        }

        if (msg?.type === 'transcript' && Array.isArray(msg?.data)) {
          setTranscripts((prev) => [...prev, ...msg.data]);
          return;
        }

        if (msg?.type === 'facts' && Array.isArray(msg?.fact)) {
          setFacts((prev) => [...prev, ...msg.fact]);
          return;
        }

        if (msg?.type === 'ENDED') {
          setStatus('ended');
          setAccepted(false);
          closeSocket();
          return;
        }

        if (msg?.type === 'error') {
          setError(msg?.error || 'FactsR stream error');
          setStatus('error');
          setAccepted(false);
          // keep socket open if possible, but usually safe to close
          closeSocket();
          return;
        }
      };

      ws.onerror = () => {
        setError('FactsR WebSocket error');
        setStatus('error');
        setAccepted(false);
      };

      ws.onclose = () => {
        // If we didn't explicitly end, revert to idle
        setAccepted(false);
        setStatus((s) => (s === 'finalizing' ? s : 'idle'));
      };
    },
    [clear, closeSocket, httpBase, wsBase]
  );

  const sendAudio = useCallback((arrayBuffer) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!accepted) return;
    try {
      ws.send(arrayBuffer);
    } catch (_) {}
  }, [accepted]);

  const flush = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: 'flush' }));
    } catch (_) {}
  }, []);

  const end = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      setStatus('finalizing');
      ws.send(JSON.stringify({ type: 'end' }));
    } catch (_) {}
  }, []);

  return {
    httpBase,
    wsBase,
    status,
    accepted,
    interactionId,
    error,
    transcripts,
    facts,
    start,
    sendAudio,
    flush,
    end,
    clear,
  };
}


