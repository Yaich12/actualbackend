import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import './indlæg.css';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

const TEMPLATE_LANGUAGE = 'da';

const getBackendHttpBase = () => {
  const envBase = process.env.REACT_APP_BACKEND_URL;
  if (envBase && typeof envBase === 'string') {
    return envBase.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost') return 'http://localhost:4000';
    return window.location.origin;
  }

  return 'http://localhost:4000';
};

const toWsBase = (httpBase) => {
  try {
    const url = new URL(httpBase);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${url.host}`;
  } catch (_) {
    return httpBase.replace(/^http/, 'ws');
  }
};

const buildWsUrl = () => {
  const httpBase = getBackendHttpBase();
  const wsBase = toWsBase(httpBase);
  return `${wsBase}/ws/corti/transcribe`;
};

const sanitizeIdentifier = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const deriveUserIdentifier = (user) => {
  if (!user) {
    return 'unknown-user';
  }

  const baseIdentifier =
    (user.displayName && user.displayName.trim()) ||
    (user.email && user.email.trim()) ||
    user.uid ||
    'unknown-user';

  const sanitized = sanitizeIdentifier(baseIdentifier);
  if (sanitized) {
    return sanitized;
  }

  if (user.uid) {
    return sanitizeIdentifier(user.uid);
  }

  return 'unknown-user';
};

const getTranslation = (translations, lang) => {
  if (!Array.isArray(translations) || translations.length === 0) {
    return null;
  }

  const normalizedLang = String(lang || '').toLowerCase();
  return (
    translations.find((translation) =>
      String(translation?.languagesId || '')
        .toLowerCase()
        .startsWith(normalizedLang)
    ) || translations[0]
  );
};

const buildDocumentText = (sections) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return '';
  }

  return [...sections]
    .sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0))
    .map((section) => {
      const heading = section?.name || section?.key || 'Sektion';
      const text = String(section?.text || '').trim();
      if (!heading && !text) return '';
      if (!text) return heading;
      return `${heading}\n${text}`;
    })
    .filter(Boolean)
    .join('\n\n');
};

function Indlæg({
  clientId,
  clientName,
  onClose,
  onSave,
  onOpenEntry,
  initialDate = '',
  initialEntry = null, // Existing entry to edit
}) {
  const originalEntryRef = useRef(initialEntry);
  const previousEntryRef = useRef(null);
  // used when user starts a brand new entry (unsaved) and navigates away to a past session
  const previousDraftRef = useRef(null);
  const [activeEntry, setActiveEntry] = useState(initialEntry);
  const [date, setDate] = useState(initialEntry?.date || initialDate || '14-11-2025');
  const [content, setContent] = useState(initialEntry?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [recentEntries, setRecentEntries] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(initialEntry?.templateKey || '');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateDetails, setShowTemplateDetails] = useState(true);
  const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false);
  const [templateDetailsError, setTemplateDetailsError] = useState('');

  const [interactionId, setInteractionId] = useState('');
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedDocument, setGeneratedDocument] = useState(null);

  const [recordingStatus, setRecordingStatus] = useState('Idle');
  const [recordingError, setRecordingError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [livePartial, setLivePartial] = useState('');
  const [lastWs, setLastWs] = useState({ type: '—', reason: '' });

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const isRecordingRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const configAcceptedRef = useRef(false);
  const recorderStartedRef = useRef(false);
  const awaitingFlushRef = useRef(false);
  const awaitingEndRef = useRef(false);
  const cleanupInProgressRef = useRef(false);

  const { user } = useAuth();

  const transcriptText = useMemo(() => {
    if (!finalTranscript && !livePartial) return '';
    if (finalTranscript && livePartial) return `${finalTranscript} ${livePartial}`.trim();
    return finalTranscript || livePartial;
  }, [finalTranscript, livePartial]);

  const wordCount = useMemo(() => {
    return finalTranscript.trim().split(/\s+/).filter(Boolean).length;
  }, [finalTranscript]);

  const formatDateTime = (value) => {
    if (!value) return '';
    try {
      const dateObj =
        typeof value?.toDate === 'function'
          ? value.toDate()
          : typeof value === 'string'
          ? new Date(value)
          : value;
      if (Number.isNaN(dateObj.getTime())) return String(value);
      return dateObj.toLocaleString('da-DK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(value);
    }
  };

  const statusClass = useMemo(() => {
    return recordingStatus
      .toLowerCase()
      .replace(/[^a-z]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }, [recordingStatus]);

  const selectedTemplateSections = useMemo(() => {
    if (!selectedTemplate?.templateSections) return [];
    return [...selectedTemplate.templateSections].sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0));
  }, [selectedTemplate]);

  const selectedTemplateMeta = useMemo(() => {
    if (!selectedTemplateKey) return null;
    const match = templates.find((template) => template.key === selectedTemplateKey);
    if (!match) return null;
    const translation = getTranslation(match.translations, TEMPLATE_LANGUAGE);
    return {
      name: translation?.name || match.name || match.key || '',
      description: translation?.description || match.description || '',
    };
  }, [selectedTemplateKey, templates]);

  useEffect(() => {
    if (activeEntry) {
      setDate(activeEntry.date || initialDate || '');
      setContent(activeEntry.content || '');
      setSelectedTemplateKey(activeEntry.templateKey || '');
    } else if (initialEntry) {
      setDate(initialEntry.date || initialDate || '');
      setContent(initialEntry.content || '');
      setSelectedTemplateKey(initialEntry.templateKey || '');
    } else if (initialDate) {
      setDate(initialDate);
    }
  }, [activeEntry, initialEntry, initialDate]);

  useEffect(() => {
    const loadRecent = async () => {
      if (!user?.uid || !clientId) return;
      setIsLoadingHistory(true);
      setHistoryError('');
      try {
        const entriesRef = collection(db, 'users', user.uid, 'clients', clientId, 'journalEntries');
        const entriesQuery = query(entriesRef, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(entriesQuery);
        const mapped = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const createdAt =
            typeof data.createdAt?.toDate === 'function'
              ? data.createdAt.toDate()
              : data.createdAtIso
              ? new Date(data.createdAtIso)
              : null;
          return {
            id: docSnap.id,
            title: data.title || data.templateKey || 'Session',
            date: data.date || createdAt || '',
            content: data.content || '',
          };
        });
        setRecentEntries(mapped);
      } catch (error) {
        console.error('[Indlæg] Failed to load recent entries', error);
        setHistoryError('Kunne ikke hente seneste sessioner.');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadRecent();
  }, [user?.uid, clientId]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const response = await fetch(`/api/corti/templates?lang=${TEMPLATE_LANGUAGE}`);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Server ${response.status}`);
      }
      const data = await response.json();
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setTemplates(items);
    } catch (error) {
      console.error('Template fetch failed:', error);
      setTemplatesError('Kunne ikke hente skabeloner. Prøv igen senere.');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchTemplateDetails = useCallback(async (templateKey) => {
    if (!templateKey) {
      setSelectedTemplate(null);
      return;
    }

    setTemplateDetailsLoading(true);
    setTemplateDetailsError('');

    try {
      const response = await fetch(`/api/corti/templates/${encodeURIComponent(templateKey)}`);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Server ${response.status}`);
      }
      const data = await response.json();
      setSelectedTemplate(data || null);
    } catch (error) {
      console.error('Template detail fetch failed:', error);
      setTemplateDetailsError('Kunne ikke hente skabelondetaljer.');
      setSelectedTemplate(null);
    } finally {
      setTemplateDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchTemplateDetails(selectedTemplateKey);
  }, [fetchTemplateDetails, selectedTemplateKey]);

  const ensureInteraction = useCallback(async () => {
    if (interactionId) {
      return interactionId;
    }

    const response = await fetch('/api/corti/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: clientName ? `Journal: ${clientName}` : 'Journal session',
        encounterIdentifier: clientId ? `journal-${clientId}-${Date.now()}` : `journal-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Server ${response.status}`);
    }

    const data = await response.json();
    if (!data?.interactionId) {
      throw new Error('Mangler interactionId fra serveren.');
    }

    setInteractionId(data.interactionId);
    return data.interactionId;
  }, [clientId, clientName, interactionId]);

  const handleGenerateDocument = useCallback(async () => {
    if (!transcriptText || !transcriptText.trim()) {
      setGenerationError('Ingen transskription tilgængelig endnu.');
      return;
    }

    if (!selectedTemplateKey) {
      setGenerationError('Vælg en skabelon før du skriver notat.');
      return;
    }

    setGenerationLoading(true);
    setGenerationError('');

    try {
      const resolvedInteractionId = await ensureInteraction();
      const response = await fetch(`/api/corti/interactions/${resolvedInteractionId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptText,
          templateKey: selectedTemplateKey,
          outputLanguage: TEMPLATE_LANGUAGE,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Server ${response.status}`);
      }

      const data = await response.json();
      setGeneratedDocument(data || null);

      if (Array.isArray(data?.sections)) {
        const nextContent = buildDocumentText(data.sections);
        setContent(nextContent);
      } else if (data) {
        setContent(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('Document generation failed:', error);
      setGenerationError('Kunne ikke generere notat. Prøv igen.');
    } finally {
      setGenerationLoading(false);
    }
  }, [ensureInteraction, selectedTemplateKey, transcriptText]);

  const cleanupRecording = useCallback((finalStatus = 'Idle') => {
    if (cleanupInProgressRef.current) return;
    cleanupInProgressRef.current = true;

    isRecordingRef.current = false;
    isStartingRef.current = false;
    if (finalStatus !== 'Ended') {
      isStoppingRef.current = false;
    }
    setIsRecording(false);
    setLivePartial('');
    configAcceptedRef.current = false;
    recorderStartedRef.current = false;
    awaitingFlushRef.current = false;
    awaitingEndRef.current = false;
    setRecordingStatus(finalStatus);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (_) {}
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
    }
    wsRef.current = null;

    cleanupInProgressRef.current = false;
  }, []);

  const startMediaRecorder = useCallback((stream, ws) => {
    if (recorderStartedRef.current) return;
    if (!stream) return;

    const preferred = 'audio/webm;codecs=opus';
    const options =
      typeof window !== 'undefined' &&
      window.MediaRecorder &&
      window.MediaRecorder.isTypeSupported(preferred)
        ? { mimeType: preferred }
        : undefined;

    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;
    recorderStartedRef.current = true;

    recorder.ondataavailable = async (event) => {
      if (!event.data || event.data.size === 0) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        const buffer = await event.data.arrayBuffer();
        ws.send(buffer);
      } catch (error) {
        console.error('Audio chunk send failed:', error);
      }
    };

    recorder.start(250);
  }, []);

  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    isRecordingRef.current = false;
    setIsRecording(false);
    setRecordingStatus('Flushing');

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch (_) {}
      try {
        recorder.stop();
      } catch (_) {}
    }

    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      awaitingFlushRef.current = true;
      try {
        ws.send(JSON.stringify({ type: 'flush' }));
      } catch (_) {}
    } else {
      cleanupRecording('Ended');
      isStoppingRef.current = false;
    }
  }, [cleanupRecording]);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current || isRecordingRef.current || isStoppingRef.current) {
      return;
    }
    isStartingRef.current = true;
    isStoppingRef.current = false;

    setRecordingError('');
    setRecordingStatus('Requesting mic…');
    setLastWs({ type: '—', reason: '' });
    setFinalTranscript('');
    setLivePartial('');
    configAcceptedRef.current = false;
    recorderStartedRef.current = false;
    awaitingFlushRef.current = false;
    awaitingEndRef.current = false;

    if (!navigator.mediaDevices || typeof window.MediaRecorder === 'undefined') {
      setRecordingError('Din browser understøtter ikke optagelse.');
      cleanupRecording('Error');
      return;
    }

    const wsUrl = buildWsUrl();
    if (!wsUrl) {
      setRecordingError('Manglende transskriptionsforbindelse.');
      cleanupRecording('Error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStatus('Connecting…');

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      mediaStreamRef.current = stream;
      wsRef.current = ws;
      isRecordingRef.current = true;
      setIsRecording(true);

      ws.onopen = () => {
        if (isStoppingRef.current) {
          ws.close();
          return;
        }
        console.log('[UI] WS OPEN');
        setRecordingStatus('Config');
        const configMessage = {
          type: 'config',
          configuration: {
            primaryLanguage: 'da',
            automaticPunctuation: true,
          },
        };
        const configString = JSON.stringify(configMessage);
        console.log('[UI] SENT_CONFIG', configString);
        ws.send(configString);
        setLastWs({ type: 'SENT_CONFIG', reason: null });
      };

      ws.onmessage = (event) => {
        if (!event?.data) return;
        let message = null;
        try {
          message = JSON.parse(event.data);
        } catch (_) {
          return;
        }

        if (!message?.type) return;
        if (message.type === 'DEBUG') {
          setLastWs({
            type: message.event || 'DEBUG',
            reason: message.reason || '',
          });
          return;
        }
        const messageReason =
          message.reason ||
          message.error?.details ||
          message.error?.title ||
          (typeof message.error === 'string' ? message.error : null);
        setLastWs({
          type: message.type,
          reason: messageReason,
        });

        if (message?.type === 'CONFIG_ACCEPTED') {
          configAcceptedRef.current = true;
          setRecordingStatus('Listening');
          startMediaRecorder(stream, ws);
          return;
        }

        if (message?.type === 'CONFIG_TIMEOUT' || message?.type === 'CONFIG_DENIED') {
          const reason = messageReason || 'No reason';
          setRecordingStatus('Error');
          setRecordingError(`${message.type}: ${reason}`);
          cleanupRecording('Error');
          return;
        }

        if (message?.type === 'flushed' || message?.type === 'FLUSHED') {
          if (awaitingFlushRef.current && ws.readyState === WebSocket.OPEN) {
            awaitingFlushRef.current = false;
            awaitingEndRef.current = true;
            try {
              ws.send(JSON.stringify({ type: 'end' }));
            } catch (_) {}
          }
          return;
        }

        if (message?.type === 'ended' || message?.type === 'ENDED') {
          cleanupRecording('Ended');
          return;
        }

        if (message?.type === 'transcript') {
          const text = String(message?.data?.text || '').trim();
          if (!text) return;
          if (message?.data?.isFinal) {
            setFinalTranscript((current) => (current ? `${current} ${text}` : text));
            setLivePartial('');
          } else {
            setLivePartial(text);
          }
          return;
        }

        if (message?.type === 'error') {
          const details = messageReason || 'No reason';
          setRecordingStatus('Error');
          setRecordingError(`error: ${details}`);
          cleanupRecording('Error');
        }
      };

      ws.onerror = () => {
        setRecordingStatus('Error');
        setRecordingError('WebSocket error');
        cleanupRecording('Error');
      };

      ws.onclose = (evt) => {
        if (!isStoppingRef.current) {
          setRecordingStatus('Error');
          setRecordingError(`WS closed: code=${evt.code} reason=${evt.reason || ''}`.trim());
          cleanupRecording('Error');
          return;
        }

        setRecordingStatus('Ended');
        cleanupRecording('Ended');
        isStoppingRef.current = false;
      };
    } catch (error) {
      console.error('Microphone error:', error);
      setRecordingStatus('Error');
      setRecordingError('Kunne ikke få adgang til mikrofonen.');
      cleanupRecording('Error');
    } finally {
      isStartingRef.current = false;
    }
  }, [cleanupRecording, startMediaRecorder]);

  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, [cleanupRecording]);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setSaveError('');

    if (!user) {
      setSaveError('Du skal være logget ind for at gemme indlæg.');
      return;
    }

    if (!clientId) {
      setSaveError('Manglende klient-id – kunne ikke knytte indlægget til en klient.');
      return;
    }

    const nowIso = new Date().toISOString();
    const ownerIdentifier = deriveUserIdentifier(user);
    const templateTitle =
      typeof selectedTemplate?.name === 'string' ? selectedTemplate.name.trim() : '';
    const fallbackTitle =
      [clientName, date].filter(Boolean).join(' - ') || 'Journalnotat';
    const resolvedTitle = templateTitle || fallbackTitle;

    const entryPayload = {
      title: resolvedTitle,
      date,
      content: content.trim(),
      isPrivate: false,
      isStarred: false,
      isLocked: false,
      clientName,
      clientId,
      ownerUid: user.uid,
      ownerEmail: user.email ?? null,
      ownerIdentifier,
      createdAtIso: nowIso,
      templateKey: selectedTemplateKey || null,
    };

    setIsSaving(true);

    try {
      const targetEntry = activeEntry || initialEntry;

      if (targetEntry?.id) {
        // Update existing entry
        const entryRef = doc(
          db,
          'users',
          user.uid,
          'clients',
          clientId,
          'journalEntries',
          targetEntry.id
        );
        await updateDoc(entryRef, {
          ...entryPayload,
          updatedAt: serverTimestamp(),
        });

        const savedEntry = {
          id: targetEntry.id,
          ...entryPayload,
          createdAt: targetEntry.createdAt || targetEntry.createdAtIso || nowIso,
          createdAtIso: targetEntry.createdAtIso || targetEntry.createdAt || nowIso,
        };

        if (typeof onSave === 'function') {
          onSave(savedEntry);
        }

        onClose();
      } else {
        // Create new entry
        const entriesCollection = collection(
          db,
          'users',
          user.uid,
          'clients',
          clientId,
          'journalEntries'
        );
        const docRef = await addDoc(entriesCollection, {
          ...entryPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const savedEntry = {
          id: docRef.id,
          ...entryPayload,
          createdAt: nowIso,
        };

        if (typeof onSave === 'function') {
          onSave(savedEntry);
        }

        onClose();
      }
    } catch (error) {
      console.error('Failed to save journal entry:', error);
      setSaveError('Kunne ikke gemme indlægget. Prøv igen senere.');
    } finally {
      setIsSaving(false);
    }
  };

  const templateSelectionLabel = useMemo(() => {
    if (selectedTemplate) {
      const translation = getTranslation(selectedTemplate.translations, TEMPLATE_LANGUAGE);
      return translation?.name || selectedTemplate?.name || selectedTemplate?.key || '';
    }
    return selectedTemplateMeta?.name || '';
  }, [selectedTemplate, selectedTemplateMeta]);

  return (
    <div className="indlæg-container">
      <div className="indlæg-layout">
        <div className="indlæg-main-pane">
            <div className="indlæg-header">
            <div className="indlæg-header-top">
              <div className="indlæg-title-block">
                <h2 className="indlæg-title">{clientName || 'Ukendt klient'}</h2>
                <span className="indlæg-title-date">{date || '—'}</span>
              </div>
                {originalEntryRef.current &&
                  activeEntry?.id &&
                  originalEntryRef.current?.id &&
                  activeEntry.id !== originalEntryRef.current.id && (
                    <button
                      type="button"
                      className="indlæg-history-link"
                      onClick={() => {
                        setActiveEntry(originalEntryRef.current);
                        setSelectedTemplateKey(originalEntryRef.current?.templateKey || '');
                        setDate(originalEntryRef.current?.date || initialDate || '');
                        setContent(originalEntryRef.current?.content || '');
                      }}
                    >
                      Tilbage til nuværende
                    </button>
                  )}
            </div>

          </div>

          <div className="indlæg-content">
            <div className="indlæg-workspace">
              <aside className="indlæg-column indlæg-column--left">
                <div className="indlæg-card">
                  <div className="indlæg-card-header indlæg-card-header--row">
                    <h3 className="indlæg-card-title">Seneste sessioner</h3>
                    {true && (
                      <button
                        type="button"
                        className="indlæg-history-link"
                        onClick={() => {
                          // Always return to the originally opened entry if it exists
                          const target =
                            originalEntryRef.current ||
                            initialEntry ||
                            previousEntryRef.current ||
                            previousDraftRef.current;
                          if (!target) return;

                          if (target.draft) {
                            // restore unsaved draft
                            setActiveEntry(null);
                            setSelectedTemplateKey(target.templateKey || '');
                            setDate(target.date || initialDate || '');
                            setContent(target.content || '');
                          } else {
                            setActiveEntry(target);
                            setSelectedTemplateKey(target?.templateKey || '');
                            setDate(target?.date || initialDate || '');
                            setContent(target?.content || '');
                          }
                        }}
                      >
                        Tilbage til nuværende
                      </button>
                    )}
                  </div>
                  <div className="indlæg-card-body">
                    {isLoadingHistory && (
                      <p className="indlæg-history-status">Henter seneste sessioner...</p>
                    )}

                    {historyError && !isLoadingHistory && (
                      <p className="indlæg-history-error">{historyError}</p>
                    )}

                    {!isLoadingHistory && !historyError && recentEntries.length === 0 && (
                      <p className="indlæg-history-empty">
                        Ingen tidligere sessioner for denne borger endnu.
                      </p>
                    )}

                    {!isLoadingHistory && !historyError && recentEntries.length > 0 && (
                      <ul className="indlæg-history-list">
                        {recentEntries.map((entry) => (
                          <li
                            key={entry.id}
                            className="indlæg-history-item"
                            onClick={() => {
                              // remember where we came from to allow "Tilbage til nuværende"
                              const current = activeEntry || originalEntryRef.current;
                              if (current) {
                                previousEntryRef.current = current;
                              } else if (!previousDraftRef.current) {
                                // store the unsaved draft state
                                previousDraftRef.current = {
                                  draft: true,
                                  date,
                                  content,
                                  templateKey: selectedTemplateKey,
                                };
                              }
                              setActiveEntry(entry);
                              setSelectedTemplateKey(entry.templateKey || '');
                              setDate(entry.date || initialDate || '');
                              setContent(entry.content || '');
                            }}
                          >
                            <div className="indlæg-history-item-main">
                              <span className="indlæg-history-title">
                                {entry.title || 'Uden titel'}
                              </span>
                              <span className="indlæg-history-date">
                                {formatDateTime(entry.date)}
                              </span>
                            </div>
                            <div className="indlæg-history-meta">
                              <span className="indlæg-history-status-badge">Aktiv</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </aside>

              <section className="indlæg-column indlæg-column--center">
                <div className="indlæg-card">
                  <div className="indlæg-card-header">
                    <h3 className="indlæg-card-title">Skabeloner</h3>
                  </div>
                  <div className="indlæg-card-body">
                    {templatesLoading && <p className="indlæg-muted">Henter skabeloner...</p>}
                    {templatesError && <p className="indlæg-inline-error">{templatesError}</p>}
                    {!templatesLoading && !templatesError && templates.length === 0 && (
                      <p className="indlæg-muted">Ingen skabeloner fundet.</p>
                    )}
                    <div className="indlæg-form-group">
                      <label className="indlæg-label" htmlFor="indlaeg-template-select">
                        Vælg skabelon
                      </label>
                      <select
                        id="indlaeg-template-select"
                        className="indlæg-input indlæg-template-select"
                        value={selectedTemplateKey}
                        onChange={(event) => {
                          setSelectedTemplateKey(event.target.value);
                          setGenerationError('');
                        }}
                        disabled={templatesLoading || !!templatesError || templates.length === 0}
                      >
                        <option value="">Vælg skabelon</option>
                        {templates.map((template) => {
                          const translation = getTranslation(
                            template.translations,
                            TEMPLATE_LANGUAGE
                          );
                          const name = translation?.name || template.name || template.key;
                          return (
                            <option key={template.key} value={template.key}>
                              {name}
                            </option>
                          );
                        })}
                      </select>
                      {selectedTemplateMeta?.description ? (
                        <p className="indlæg-template-help">{selectedTemplateMeta.description}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="indlæg-card">
                  <div className="indlæg-card-header indlæg-card-header--row">
                    <h3 className="indlæg-card-title">
                      Valgt skabelon:{' '}
                      <span className="indlæg-card-title-value">
                        {templateSelectionLabel || 'Ingen valgt'}
                      </span>
                    </h3>
                    <button
                      type="button"
                      className="indlæg-history-toggle indlæg-card-toggle"
                      aria-expanded={showTemplateDetails}
                      onClick={() => setShowTemplateDetails((open) => !open)}
                    >
                      <span className="indlæg-card-toggle-icon">
                        {showTemplateDetails ? '⌃' : '⌄'}
                      </span>
                    </button>
                  </div>
                  {showTemplateDetails && (
                    <div className="indlæg-card-body">
                      {templateDetailsLoading && <p className="indlæg-muted">Henter detaljer...</p>}
                      {templateDetailsError && (
                        <p className="indlæg-inline-error">{templateDetailsError}</p>
                      )}
                      {!selectedTemplateKey && (
                        <p className="indlæg-muted">Vælg en skabelon for at se sektionerne.</p>
                      )}
                      {!templateDetailsLoading && selectedTemplateKey && selectedTemplate && (
                        <div className="indlæg-template-sections">
                          {selectedTemplateSections.length === 0 ? (
                            <p className="indlæg-muted">Skabelonen har ingen sektioner.</p>
                          ) : (
                            selectedTemplateSections.map((section) => {
                              const sectionMeta = section?.sectionsId || section;
                              const translation = getTranslation(
                                sectionMeta?.translations,
                                TEMPLATE_LANGUAGE
                              );
                              const sectionName = translation?.name || sectionMeta?.name || 'Sektion';
                              const sectionDescription =
                                translation?.description || sectionMeta?.description || '';
                              return (
                                <div key={`${sectionMeta?.key}-${section?.sort}`} className="indlæg-template-section">
                                  <div className="indlæg-template-section-title">{sectionName}</div>
                                  {sectionDescription ? (
                                    <div className="indlæg-template-section-desc">
                                      {sectionDescription}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="indlæg-card">
                  <div className="indlæg-card-header">
                    <h3 className="indlæg-card-title">Genereret notat</h3>
                  </div>
                  <div className="indlæg-card-body">
                    {generationLoading && <p className="indlæg-muted">Genererer notat...</p>}
                    {generationError && <p className="indlæg-inline-error">{generationError}</p>}
                    {!generationLoading && !generationError && !generatedDocument && (
                      <p className="indlæg-muted">Ingen notat genereret endnu.</p>
                    )}
                    {generatedDocument?.sections && Array.isArray(generatedDocument.sections) ? (
                      <div className="indlæg-generated-sections">
                        {generatedDocument.sections
                          .slice()
                          .sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0))
                          .map((section) => (
                            <div key={section.key || section.name} className="indlæg-generated-section">
                              <div className="indlæg-generated-title">{section.name || section.key}</div>
                              <div className="indlæg-generated-text">{section.text}</div>
                            </div>
                          ))}
                      </div>
                    ) : null}
                    {generatedDocument && !generatedDocument?.sections ? (
                      <pre className="indlæg-generated-raw">
                        {JSON.stringify(generatedDocument, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </div>

                <div className="indlæg-card">
                  <div className="indlæg-card-header">
                    <h3 className="indlæg-card-title">Notat (redigerbart)</h3>
                  </div>
                  <div className="indlæg-card-body">
                    <textarea
                      className="indlæg-textarea indlæg-textarea--lg"
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder="Her vises det genererede notat. Du kan redigere frit."
                      rows={12}
                    />
                    <div className="indlæg-card-actions">
                      <button
                        type="button"
                        className="indlæg-save-btn"
                        onClick={handleSave}
                        disabled={isSaving}
                        aria-busy={isSaving}
                      >
                        {isSaving ? 'Gemmer...' : 'Gem indlæg'}
                      </button>
                    </div>
                    {saveError && (
                      <p className="indlæg-save-error" role="alert">
                        {saveError}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <aside className="indlæg-column indlæg-column--right indlæg-sidePanel">
                <div className="indlæg-card">
                  <div className="indlæg-card-header">
                    <h3 className="indlæg-card-title">Live transskription</h3>
                    <span className={`indlæg-status-pill indlæg-status-pill--${statusClass}`}>
                      {recordingStatus}
                    </span>
                  </div>
                  <div className="indlæg-card-body">
                    <div className="indlæg-record-actions">
                      <button
                        type="button"
                        className={`indlæg-mikrofon-btn${isRecording ? ' active' : ''}`}
                        onClick={() => (isRecording ? stopRecording() : startRecording())}
                        aria-pressed={isRecording}
                      >
                        <span className="indlæg-mikrofon-icon">🎤</span>
                        {isRecording ? 'Stop' : 'Optag'}
                      </button>
                      <button
                        type="button"
                        className="indlæg-save-btn"
                        onClick={handleGenerateDocument}
                        disabled={
                          generationLoading ||
                          !transcriptText.trim() ||
                          !selectedTemplateKey
                        }
                      >
                        {generationLoading ? 'Skriver notat...' : 'Skriv notat'}
                      </button>
                    </div>

                    <div className="indlæg-metrics">
                      <div className="indlæg-metric">
                        <span className="indlæg-metric-label">Status</span>
                        <span className="indlæg-metric-value">{recordingStatus}</span>
                      </div>
                      <div className="indlæg-metric">
                        <span className="indlæg-metric-label">Ord opfanget</span>
                        <span className="indlæg-metric-value">{wordCount}</span>
                      </div>
                    </div>

                    <div className="indlæg-metrics">
                      <div className="indlæg-metric">
                        <span className="indlæg-metric-label">Last WS message</span>
                        <span className="indlæg-metric-value">{lastWs.type || '—'}</span>
                      </div>
                      <div className="indlæg-metric">
                        <span className="indlæg-metric-label">Reason</span>
                        <span className="indlæg-metric-value">{lastWs.reason || '—'}</span>
                      </div>
                    </div>

                    {recordingError && (
                      <p className="indlæg-inline-error" role="alert">
                        {recordingError}
                      </p>
                    )}

                    <div className="indlæg-transcript-block">
                      <div className="indlæg-transcript-title">Live transcript</div>
                      <div className="indlæg-transcript-box">
                        {transcriptText || 'Ingen tekst endnu.'}
                      </div>
                    </div>

                    {!selectedTemplateKey && (
                      <p className="indlæg-muted">
                        Vælg en skabelon i midten før du skriver notat.
                      </p>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Indlæg;
