import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { RainbowButton } from '../../../../components/ui/rainbow-button';
import AnimatedGenerateButton from '../../../../components/ui/animated-generate-button-shadcn-tailwind';
import { GradientButton } from '../../../../components/ui/gradient-button';
import { QuantumPulseLoader } from '../../../../components/ui/quantum-pulse-loade';
import CortiAssistantPanel, { parseAssistantSections } from '../../components/CortiAssistantPanel';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';
import { useLanguage } from '../../../../LanguageContext';

const DEFAULT_LANGUAGE = 'en';
const HEADING_INSTRUCTION =
  'Use Markdown headings starting with ### for each section. Do not return a single block without headings.';
const TRANSCRIPTION_LOCALES = {
  en: 'en-US',
  da: 'da-DK',
  ar: 'ar',
  sv: 'sv-SE',
  no: 'nb-NO',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-PT',
  it: 'it-IT',
};

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

const backendBase = getBackendHttpBase();
const apiUrl = (path) => `${backendBase}${path.startsWith('/') ? '' : '/'}${path}`;

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

const buildDocumentText = (sections, fallbackHeading = 'Section') => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return '';
  }

  return [...sections]
    .sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0))
    .map((section) => {
      const heading = section?.name || section?.key || fallbackHeading;
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
  const MODE_NONE = 'none';
  const MODE_TRANSCRIBE = 'transcribe';
  const MODE_DICTATE = 'dictate';
  const RECORDING_STATUS = {
    idle: 'idle',
    requestingMic: 'requestingMic',
    connecting: 'connecting',
    config: 'config',
    listening: 'listening',
    flushing: 'flushing',
    ended: 'ended',
    error: 'error',
  };
  const DICTATION_STATUS = {
    idle: 'idle',
    recording: 'recording',
    uploading: 'uploading',
    transcribing: 'transcribing',
    done: 'done',
    error: 'error',
  };
  const CHAT_AVATARS = {
    user:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&q=80&crop=faces&fit=crop',
    ai: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&q=80&crop=faces&fit=crop',
  };

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
  const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false);
  const [isGeneratedSheetOpen, setIsGeneratedSheetOpen] = useState(false);
  const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false);
  const [templateDetailsError, setTemplateDetailsError] = useState('');

  const [interactionId, setInteractionId] = useState('');
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedDocument, setGeneratedDocument] = useState(null);

  const [transcribeMode, setTranscribeMode] = useState(MODE_NONE);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState(RECORDING_STATUS.idle);
  const [recordingError, setRecordingError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [livePartial, setLivePartial] = useState('');
  const [lastWs, setLastWs] = useState({ type: '—', reason: '' });

  const [dictationStatus, setDictationStatus] = useState(DICTATION_STATUS.idle);
  const [dictationError, setDictationError] = useState('');
  const [dictationText, setDictationText] = useState('');

  const [agentIds, setAgentIds] = useState({});
  const [agentReady, setAgentReady] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [agentMessages, setAgentMessages] = useState([]);
  const [agentInput, setAgentInput] = useState('');
  const [agentChatLoading, setAgentChatLoading] = useState(false);
  const [activeAgentPreset, setActiveAgentPreset] = useState('');

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

  const dictationRecorderRef = useRef(null);
  const dictationStreamRef = useRef(null);
  const dictationChunksRef = useRef([]);
  const dictationStopRequestedRef = useRef(false);

  const { user } = useAuth();
  const { preferredLanguage, locale, t } = useLanguage();
  const resolvedLanguage = preferredLanguage || DEFAULT_LANGUAGE;
  const templateLanguage = resolvedLanguage;
  const transcriptionLocale = useMemo(
    () => TRANSCRIPTION_LOCALES[resolvedLanguage] || TRANSCRIPTION_LOCALES[DEFAULT_LANGUAGE],
    [resolvedLanguage]
  );

  const transcriptText = useMemo(() => {
    if (!finalTranscript && !livePartial) return '';
    if (finalTranscript && livePartial) return `${finalTranscript} ${livePartial}`.trim();
    return finalTranscript || livePartial;
  }, [finalTranscript, livePartial]);

  const activeTranscriptText = useMemo(() => {
    if (transcribeMode === MODE_DICTATE) return dictationText;
    if (transcribeMode === MODE_TRANSCRIBE) return transcriptText;
    return '';
  }, [dictationText, transcriptText, transcribeMode]);

  const wordCount = useMemo(() => {
    return activeTranscriptText.trim().split(/\s+/).filter(Boolean).length;
  }, [activeTranscriptText]);

  const agentContextText = useMemo(() => {
    const note = (content || '').trim();
    if (note) return { text: note, source: 'note' };
    if (generatedDocument?.sections?.length) {
      return {
        text: buildDocumentText(
          generatedDocument.sections,
          t('indlaeg.sectionFallback', 'Section')
        ),
        source: 'generated',
      };
    }
    const raw = (activeTranscriptText || '').trim();
    return { text: raw, source: 'transcript' };
  }, [content, generatedDocument, activeTranscriptText, t]);

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
      return dateObj.toLocaleString(locale || TRANSCRIPTION_LOCALES[DEFAULT_LANGUAGE], {
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
    const rawStatus =
      transcribeMode === MODE_DICTATE
        ? dictationStatus
        : transcribeMode === MODE_TRANSCRIBE
        ? recordingStatus
        : RECORDING_STATUS.idle;
    return rawStatus.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }, [dictationStatus, recordingStatus, transcribeMode, RECORDING_STATUS.idle]);

  const modeStatusKey = useMemo(() => {
    if (transcribeMode === MODE_DICTATE) return dictationStatus;
    if (transcribeMode === MODE_TRANSCRIBE) return recordingStatus;
    return RECORDING_STATUS.idle;
  }, [dictationStatus, recordingStatus, transcribeMode, RECORDING_STATUS.idle]);

  const modeStatusLabel = useMemo(
    () => t(`indlaeg.status.${modeStatusKey}`, modeStatusKey),
    [modeStatusKey, t]
  );

  const isDictationMode = transcribeMode === MODE_DICTATE;
  const isWorkspaceModeSelected = transcribeMode !== MODE_NONE;

  const handleModeToggle = (mode) => {
    setTranscribeMode((prev) => {
      const next = prev === mode ? MODE_NONE : mode;
      // Close assistant panel when leaving modes
      if (next === MODE_NONE) setIsAssistantOpen(false);
      return next;
    });
  };

  const selectedTemplateSections = useMemo(() => {
    if (!selectedTemplate?.templateSections) return [];
    return [...selectedTemplate.templateSections].sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0));
  }, [selectedTemplate]);

  const ensureAgentId = useCallback(
    async (agentKey) => {
      if (!agentKey) return null;
      if (agentIds[agentKey]) return agentIds[agentKey];
      setAgentLoading(true);
      setAgentError('');
      try {
        const url = apiUrl(`/api/agents/${encodeURIComponent(agentKey)}/init`);
        console.log('[Indlæg] agent init', agentKey, url);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const raw = await response.text();
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (parseErr) {
          throw new Error(`Agent init parse failed (${response.status}): ${raw.slice(0, 200)}`);
        }
        if (!response.ok || !data?.ok || !data?.agentId) {
          throw new Error(data?.error || raw.slice(0, 200) || `Agent init fejlede (${response.status})`);
        }
        setAgentIds((prev) => ({ ...prev, [agentKey]: data.agentId }));
        setAgentReady(true);
        console.log('[Indlæg] agent init ok', agentKey, data.agentId);
        return data.agentId;
      } catch (error) {
        console.error('[Indlæg] Agent init error:', error);
        setAgentError(error?.message || t('indlaeg.errors.agentInitFailed', 'Could not init agent.'));
        setAgentReady(false);
        return null;
      } finally {
        setAgentLoading(false);
      }
    },
    [agentIds, t]
  );

  const sendAgentMessage = useCallback(
    async (overrideMessage = null, _overrideAgentType = null, agentKey = 'education') => {
      const finalMessage = `${overrideMessage ?? agentInput}`.trim();
      if (!finalMessage) return;
      const resolvedAgentId = await ensureAgentId(agentKey);
      if (!resolvedAgentId) {
        setAgentError(t('indlaeg.errors.agentNotReady', 'Agent not ready.'));
        return;
      }
      const baseText =
        (content && content.trim()) ||
        (generatedDocument?.sections?.length ? buildDocumentText(generatedDocument.sections) : '') ||
        (transcribeMode === MODE_DICTATE ? dictationText : transcriptText);
      const sourceText = (baseText || '').trim() || finalMessage;
      const contextSource = (content && content.trim()) ? 'note' : generatedDocument?.sections?.length ? 'generated' : 'transcript';
      console.log('[AGENT UI] key=', agentKey, 'ctx source=', contextSource, 'len=', sourceText.length);

      const payload = {
        message: `${finalMessage}\n\n${HEADING_INSTRUCTION}`.trim(),
        sourceText: sourceText,
        preferredLanguage: resolvedLanguage,
      };

      setAgentError('');
      setAgentChatLoading(true);
      setAgentMessages((prev) => [...prev, { role: 'user', text: finalMessage, ts: Date.now() }]);

      try {
        const response = await fetch(apiUrl(`/api/agents/${encodeURIComponent(agentKey)}/chat`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const raw = await response.text();
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (parseErr) {
          throw new Error(`Agent chat parse failed (${response.status}): ${raw.slice(0, 200)}`);
        }
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || raw.slice(0, 200) || `Agent svar fejlede (${response.status})`);
        }
        const replyText = data?.reply || data?.text || '(tomt svar fra agent)';
        if (!data?.reply && !data?.text) {
          setAgentError(t('indlaeg.errors.agentNoText', 'Agent returned no text.'));
        }
        const sections = parseAssistantSections(
          replyText,
          t('assistant.replyTitle', 'Answer')
        );
        setAgentMessages((prev) => [
          ...prev,
          { role: 'assistant', text: replyText, sections, ts: Date.now() },
        ]);
      } catch (error) {
        console.error('[Indlæg] Agent chat error:', error);
        setAgentError(error?.message || t('indlaeg.errors.agentFailed', 'Agent failed.'));
      } finally {
        setAgentChatLoading(false);
        setAgentInput('');
      }
    },
    [
      agentInput,
      clientName,
      date,
      dictationText,
      initialDate,
      selectedTemplateKey,
      content,
      transcriptText,
      transcribeMode,
      generatedDocument,
      ensureAgentId,
      resolvedLanguage,
      t,
    ]
  );

  const resolveRehabSourceText = useCallback(() => {
    const noteText = (content || '').trim();
    if (noteText) return noteText;
    if (generatedDocument?.sections?.length) {
      return buildDocumentText(
        generatedDocument.sections,
        t('indlaeg.sectionFallback', 'Section')
      );
    }
    return (activeTranscriptText || '').trim();
  }, [content, generatedDocument, activeTranscriptText, t]);

  const sendRehabPlanMessage = useCallback(
    async (displayMessage) => {
      const sourceText = resolveRehabSourceText();
      if (!sourceText) {
        setAgentMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: t(
              'indlaeg.errors.rehabNoText',
              'No text found — write a note or enter text first.'
            ),
            ts: Date.now(),
          },
        ]);
        return;
      }

      const resolvedDisplayMessage =
        displayMessage || t('actions.planHep', 'Plan + HEP');
      const questionPrompt = t(
        'prompts.planHep',
        'Create a clinical plan with a short HEP (home exercises) and key patient points.'
      );
      const questionWithStructure = `${questionPrompt}\n\n${HEADING_INSTRUCTION}`.trim();

      setAgentError('');
      setAgentChatLoading(true);
      setAgentMessages((prev) => [
        ...prev,
        { role: 'user', text: resolvedDisplayMessage, ts: Date.now() },
      ]);

      try {
        await ensureAgentId('rehab');
        const response = await fetch(apiUrl('/api/agents/rehab/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText,
            question: questionWithStructure,
            preferredLanguage: resolvedLanguage,
          }),
        });
        const raw = await response.text();
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (parseErr) {
          throw new Error(`Rehab chat parse failed (${response.status}): ${raw.slice(0, 200)}`);
        }
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || raw.slice(0, 200) || `Rehab svar fejlede (${response.status})`);
        }
        const replyText = data?.text || '(tomt svar fra agent)';
        if (!data?.text) {
          setAgentError(t('indlaeg.errors.agentNoText', 'Agent returned no text.'));
        }
        const sections = parseAssistantSections(
          replyText,
          t('assistant.replyTitle', 'Answer')
        );
        setAgentMessages((prev) => [
          ...prev,
          { role: 'assistant', text: replyText, sections, ts: Date.now() },
        ]);
      } catch (error) {
        console.error('[Indlæg] Rehab agent chat error:', error);
        setAgentError(error?.message || t('indlaeg.errors.agentFailed', 'Agent failed.'));
      } finally {
        setAgentChatLoading(false);
        setAgentInput('');
      }
    },
    [ensureAgentId, resolveRehabSourceText, resolvedLanguage, t]
  );

  const ACTION_TO_AGENT = useMemo(
    () => ({
      missingInfo: 'improvement',
      redFlags: 'education',
      objectiveTests: 'education',
      planHep: 'rehab',
      summarizePatient: 'education',
      freeText: 'education',
    }),
    []
  );

  const ACTION_PROMPTS = useMemo(
    () => ({
      missingInfo: t(
        'prompts.missingInfo',
        'Find missing clinical information in the history and suggest relevant follow-up questions.'
      ),
      redFlags: t(
        'prompts.redFlags',
        'Identify possible red flags and what questions/actions should follow.'
      ),
      objectiveTests: t(
        'prompts.objectiveTests',
        'Suggest relevant objective tests and what they can reveal.'
      ),
      summarizePatient: t(
        'prompts.summarizePatient',
        'Summarize this patient’s full history across all notes.'
      ),
    }),
    [t]
  );

  const handleAssistantSendMessage = useCallback(
    (message, agentType, actionId) => {
      const resolvedAction = actionId || 'freeText';
      if (resolvedAction === 'planHep') {
        sendRehabPlanMessage(t('actions.planHep', 'Plan + HEP'));
        return;
      }
      const agentKey = ACTION_TO_AGENT[resolvedAction] || 'education';
      const finalMessage =
        resolvedAction === 'freeText' ? message : ACTION_PROMPTS[resolvedAction] || message;
      sendAgentMessage(finalMessage, agentType, agentKey);
    },
    [ACTION_PROMPTS, ACTION_TO_AGENT, sendAgentMessage, sendRehabPlanMessage, t]
  );

  const selectedTemplateMeta = useMemo(() => {
    if (!selectedTemplateKey) return null;
    const match = templates.find((template) => template.key === selectedTemplateKey);
    if (!match) return null;
    const translation = getTranslation(match.translations, templateLanguage);
    return {
      name: translation?.name || match.name || match.key || '',
      description: translation?.description || match.description || '',
    };
  }, [selectedTemplateKey, templateLanguage, templates]);

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
            title:
              data.title || data.templateKey || t('indlaeg.session', 'Session'),
            date: data.date || createdAt || '',
            content: data.content || '',
          };
        });
        setRecentEntries(mapped);
      } catch (error) {
        console.error('[Indlæg] Failed to load recent entries', error);
        setHistoryError(t('indlaeg.historyError', 'Could not load recent sessions.'));
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadRecent();
  }, [user?.uid, clientId, t]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const response = await fetch(apiUrl(`/api/corti/templates?lang=${templateLanguage}`));
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Server ${response.status}`);
      }
      const data = await response.json();
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setTemplates(items);
    } catch (error) {
      console.error('Template fetch failed:', error);
      setTemplatesError(t('indlaeg.templatesError', 'Could not load templates.'));
    } finally {
      setTemplatesLoading(false);
    }
  }, [t, templateLanguage]);

  const fetchTemplateDetails = useCallback(async (templateKey) => {
    if (!templateKey) {
      setSelectedTemplate(null);
      return;
    }

    setTemplateDetailsLoading(true);
    setTemplateDetailsError('');

    try {
      const response = await fetch(apiUrl(`/api/corti/templates/${encodeURIComponent(templateKey)}`));
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Server ${response.status}`);
      }
      const data = await response.json();
      setSelectedTemplate(data || null);
    } catch (error) {
      console.error('Template detail fetch failed:', error);
      setTemplateDetailsError(t('indlaeg.errors.templateDetailsFailed', 'Could not load template details.'));
      setSelectedTemplate(null);
    } finally {
      setTemplateDetailsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchTemplateDetails(selectedTemplateKey);
  }, [fetchTemplateDetails, selectedTemplateKey]);

  useEffect(() => {
    if (!isTemplateSheetOpen && !isGeneratedSheetOpen) return;
    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        setIsTemplateSheetOpen(false);
        setIsGeneratedSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isGeneratedSheetOpen, isTemplateSheetOpen]);

  useEffect(() => {
    if (!isTemplateSheetOpen && !isGeneratedSheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isGeneratedSheetOpen, isTemplateSheetOpen]);

  const ensureInteraction = useCallback(async () => {
    if (interactionId) {
      return interactionId;
    }

    const response = await fetch(apiUrl('/api/corti/interactions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: clientName
          ? `${t('indlaeg.title', 'Journal')}: ${clientName}`
          : t('indlaeg.session', 'Session'),
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
  }, [clientId, clientName, interactionId, t]);

  const handleGenerateDocument = useCallback(async () => {
    if (!activeTranscriptText || !activeTranscriptText.trim()) {
      setGenerationError(t('indlaeg.errors.generationNoTranscript', 'No transcription available yet.'));
      return;
    }

    if (!selectedTemplateKey) {
      setGenerationError(t('indlaeg.errors.generationNeedTemplate', 'Select a template before writing a note.'));
      return;
    }

    setGenerationLoading(true);
    setGenerationError('');

    try {
      const resolvedInteractionId = await ensureInteraction();
      const response = await fetch(apiUrl(`/api/corti/interactions/${resolvedInteractionId}/documents`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptText: activeTranscriptText,
          templateKey: selectedTemplateKey,
          outputLanguage: resolvedLanguage,
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
      setGenerationError(t('indlaeg.errors.generationFailed', 'Could not generate note.'));
    } finally {
      setGenerationLoading(false);
    }
  }, [activeTranscriptText, ensureInteraction, resolvedLanguage, selectedTemplateKey, t]);

  const cleanupRecording = useCallback((finalStatus = RECORDING_STATUS.idle) => {
    if (cleanupInProgressRef.current) return;
    cleanupInProgressRef.current = true;

    isRecordingRef.current = false;
    isStartingRef.current = false;
    if (finalStatus !== RECORDING_STATUS.ended) {
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
  }, [RECORDING_STATUS.ended, RECORDING_STATUS.idle]);

  const resetDictationRecording = useCallback((nextStatus = null) => {
    dictationStopRequestedRef.current = false;
    dictationChunksRef.current = [];
    if (typeof nextStatus === 'string') {
      setDictationStatus(nextStatus);
    }
    const recorder = dictationRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (_) {}
    }
    dictationRecorderRef.current = null;
    if (dictationStreamRef.current) {
      dictationStreamRef.current.getTracks().forEach((t) => t.stop());
      dictationStreamRef.current = null;
    }
  }, []);

  const uploadDictation = useCallback(
    async (blob) => {
      if (!blob || blob.size === 0) {
        setDictationError(t('indlaeg.errors.dictationNoAudio', 'No audio recorded.'));
        setDictationStatus(DICTATION_STATUS.error);
        return;
      }

      setDictationStatus(DICTATION_STATUS.uploading);
      try {
        const formData = new FormData();
        formData.append('audio', blob, 'dictation.webm');
        formData.append('language', transcriptionLocale);

        const response = await fetch(apiUrl('/api/corti/dictate'), {
          method: 'POST',
          body: formData,
        });

        setDictationStatus(DICTATION_STATUS.transcribing);
        const raw = await response.text();
        if (!response.ok) {
          console.error('[Indlæg] Dictation upload failed (raw):', raw);
          throw new Error(raw || `Serverfejl (${response.status})`);
        }

        let data = null;
        try {
          data = JSON.parse(raw);
        } catch (parseErr) {
          console.error('[Indlæg] Dictation JSON parse failed:', raw);
          throw new Error('Response was not JSON: ' + raw.slice(0, 120));
        }

        console.info('[Indlæg] Dictation response:', data);

        const nextText = data?.text || '';
        setDictationText(nextText);
        const normalizedStatus =
          data?.status === 'completed' || data?.status === 'done'
            ? DICTATION_STATUS.done
            : data?.status === 'failed' || data?.status === 'error'
            ? DICTATION_STATUS.error
            : data?.status === 'transcribing'
            ? DICTATION_STATUS.transcribing
            : data?.status === 'uploading'
            ? DICTATION_STATUS.uploading
            : DICTATION_STATUS.done;
        setDictationStatus(normalizedStatus);
        setDictationError(data?.error || '');
      } catch (error) {
        console.error('[Indlæg] Dictation upload failed:', error);
        setDictationError(error?.message || t('indlaeg.errors.dictationFailed', 'Dictation failed.'));
        setDictationStatus(DICTATION_STATUS.error);
      }
    },
    [DICTATION_STATUS.done, DICTATION_STATUS.error, DICTATION_STATUS.transcribing, DICTATION_STATUS.uploading, t, transcriptionLocale]
  );

  const startDictationRecording = useCallback(async () => {
    if (
      dictationStatus === DICTATION_STATUS.recording ||
      dictationStatus === DICTATION_STATUS.uploading ||
      dictationStatus === DICTATION_STATUS.transcribing
    ) {
      return;
    }

    if (!navigator.mediaDevices || typeof window.MediaRecorder === 'undefined') {
      setDictationError(t('indlaeg.errors.dictationBrowserUnsupported', 'Recording not supported.'));
      setDictationStatus(DICTATION_STATUS.error);
      return;
    }

    setDictationError('');
    resetDictationRecording(DICTATION_STATUS.recording);
    setDictationText('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      dictationStreamRef.current = stream;

      const preferred = 'audio/webm;codecs=opus';
      const options =
        typeof window !== 'undefined' &&
        window.MediaRecorder &&
        window.MediaRecorder.isTypeSupported(preferred)
          ? { mimeType: preferred }
          : undefined;

      const recorder = new MediaRecorder(stream, options);
      dictationRecorderRef.current = recorder;
      dictationChunksRef.current = [];
      dictationStopRequestedRef.current = false;

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        dictationChunksRef.current.push(event.data);
      };

      recorder.onerror = (event) => {
        const message = event?.error?.message || t('indlaeg.status.error', 'Error');
        setDictationError(message);
        setDictationStatus(DICTATION_STATUS.error);
        resetDictationRecording(DICTATION_STATUS.error);
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(dictationChunksRef.current, { type: mimeType });
        dictationChunksRef.current = [];
        await uploadDictation(blob);
        resetDictationRecording();
      };

      recorder.start();
    } catch (error) {
      console.error('[Indlæg] Dictation start failed:', error);
      setDictationError(t('indlaeg.errors.dictationMicAccess', 'Could not access microphone.'));
      setDictationStatus(DICTATION_STATUS.error);
      resetDictationRecording(DICTATION_STATUS.error);
    }
  }, [DICTATION_STATUS.error, DICTATION_STATUS.recording, DICTATION_STATUS.transcribing, DICTATION_STATUS.uploading, dictationStatus, resetDictationRecording, t, uploadDictation]);

  const stopDictationRecording = useCallback(() => {
    if (!dictationRecorderRef.current || dictationStopRequestedRef.current) return;
    dictationStopRequestedRef.current = true;
    setDictationStatus(DICTATION_STATUS.uploading);

    try {
      dictationRecorderRef.current.stop();
    } catch (error) {
      console.error('[Indlæg] Dictation stop failed:', error);
      setDictationError(t('indlaeg.errors.dictationStopFailed', 'Could not stop recording.'));
      setDictationStatus(DICTATION_STATUS.error);
      resetDictationRecording(DICTATION_STATUS.error);
    }
  }, [DICTATION_STATUS.error, DICTATION_STATUS.uploading, resetDictationRecording, t]);

  const handleAppendDictationToNote = useCallback(() => {
    if (!dictationText) return;
    setContent((prev) => {
      if (!prev) return dictationText;
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n\n${dictationText}` : dictationText;
    });
  }, [dictationText]);

  const handleReplaceNoteWithDictation = useCallback(() => {
    if (!dictationText) return;
    setContent(dictationText);
  }, [dictationText]);

  useEffect(() => {
    if (transcribeMode === MODE_DICTATE) {
      cleanupRecording(RECORDING_STATUS.idle);
      setRecordingError('');
      setLastWs({ type: '—', reason: '' });
    } else if (transcribeMode === MODE_TRANSCRIBE) {
      resetDictationRecording(DICTATION_STATUS.idle);
      setDictationError('');
    } else {
      cleanupRecording(RECORDING_STATUS.idle);
      resetDictationRecording(DICTATION_STATUS.idle);
      setRecordingError('');
      setDictationError('');
      setLastWs({ type: '—', reason: '' });
    }
  }, [
    DICTATION_STATUS.idle,
    RECORDING_STATUS.idle,
    cleanupRecording,
    resetDictationRecording,
    transcribeMode,
  ]);

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
    setRecordingStatus(RECORDING_STATUS.flushing);

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
      cleanupRecording(RECORDING_STATUS.ended);
      isStoppingRef.current = false;
    }
  }, [RECORDING_STATUS.ended, RECORDING_STATUS.flushing, cleanupRecording]);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current || isRecordingRef.current || isStoppingRef.current) {
      return;
    }
    isStartingRef.current = true;
    isStoppingRef.current = false;

    setRecordingError('');
    setRecordingStatus(RECORDING_STATUS.requestingMic);
    setLastWs({ type: '—', reason: '' });
    setFinalTranscript('');
    setLivePartial('');
    configAcceptedRef.current = false;
    recorderStartedRef.current = false;
    awaitingFlushRef.current = false;
    awaitingEndRef.current = false;

    if (!navigator.mediaDevices || typeof window.MediaRecorder === 'undefined') {
      setRecordingError(t('indlaeg.errors.recordingBrowserUnsupported', 'Recording not supported.'));
      cleanupRecording(RECORDING_STATUS.error);
      return;
    }

    const wsUrl = buildWsUrl();
    if (!wsUrl) {
      setRecordingError(t('indlaeg.errors.recordingMissingConnection', 'Missing transcription connection.'));
      cleanupRecording(RECORDING_STATUS.error);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStatus(RECORDING_STATUS.connecting);

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
        setRecordingStatus(RECORDING_STATUS.config);
        const configMessage = {
          type: 'config',
          configuration: {
            primaryLanguage: transcriptionLocale,
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
          setRecordingStatus(RECORDING_STATUS.listening);
          startMediaRecorder(stream, ws);
          return;
        }

        if (message?.type === 'CONFIG_TIMEOUT' || message?.type === 'CONFIG_DENIED') {
          const reason = messageReason || 'No reason';
          setRecordingStatus(RECORDING_STATUS.error);
          setRecordingError(`${message.type}: ${reason}`);
          cleanupRecording(RECORDING_STATUS.error);
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
          cleanupRecording(RECORDING_STATUS.ended);
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
          setRecordingStatus(RECORDING_STATUS.error);
          setRecordingError(`error: ${details}`);
          cleanupRecording(RECORDING_STATUS.error);
        }
      };

      ws.onerror = () => {
        setRecordingStatus(RECORDING_STATUS.error);
        setRecordingError(t('indlaeg.errors.recordingWebsocketError', 'WebSocket error'));
        cleanupRecording(RECORDING_STATUS.error);
      };

      ws.onclose = (evt) => {
        if (!isStoppingRef.current) {
          setRecordingStatus(RECORDING_STATUS.error);
          setRecordingError(`WS closed: code=${evt.code} reason=${evt.reason || ''}`.trim());
          cleanupRecording(RECORDING_STATUS.error);
          return;
        }

        setRecordingStatus(RECORDING_STATUS.ended);
        cleanupRecording(RECORDING_STATUS.ended);
        isStoppingRef.current = false;
      };
    } catch (error) {
      console.error('Microphone error:', error);
      setRecordingStatus(RECORDING_STATUS.error);
      setRecordingError(t('indlaeg.errors.recordingMicAccess', 'Could not access microphone.'));
      cleanupRecording(RECORDING_STATUS.error);
    } finally {
      isStartingRef.current = false;
    }
  }, [RECORDING_STATUS, cleanupRecording, startMediaRecorder, t, transcriptionLocale]);

  const cleanupTranscribe = useCallback(() => {
    cleanupRecording(RECORDING_STATUS.idle);
  }, [RECORDING_STATUS.idle, cleanupRecording]);

  const cleanupDictation = useCallback(() => {
    resetDictationRecording(DICTATION_STATUS.idle);
  }, [DICTATION_STATUS.idle, resetDictationRecording]);

  useEffect(() => {
    return () => cleanupTranscribe();
  }, [cleanupTranscribe]);

  useEffect(() => {
    return () => cleanupDictation();
  }, [cleanupDictation]);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setSaveError('');

    if (!user) {
      setSaveError(t('indlaeg.errors.mustBeLoggedIn', 'You must be logged in to save.'));
      return;
    }

    if (!clientId) {
      setSaveError(
        t(
          'indlaeg.errors.missingClientId',
          'Missing client id — could not attach the entry to a client.'
        )
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const ownerIdentifier = deriveUserIdentifier(user);
    const templateTitle =
      typeof selectedTemplate?.name === 'string' ? selectedTemplate.name.trim() : '';
    const fallbackTitle =
      [clientName, date].filter(Boolean).join(' - ') ||
      t('indlaeg.journalNote', 'Journal note');
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
      setSaveError(t('indlaeg.errors.saveFailed', 'Could not save entry.'));
    } finally {
      setIsSaving(false);
    }
  };

  const templateSelectionLabel = useMemo(() => {
    if (selectedTemplate) {
      const translation = getTranslation(selectedTemplate.translations, templateLanguage);
      return translation?.name || selectedTemplate?.name || selectedTemplate?.key || '';
    }
    return selectedTemplateMeta?.name || '';
  }, [selectedTemplate, selectedTemplateMeta, templateLanguage]);

  const generatedDocumentText = useMemo(() => {
    if (generatedDocument?.sections?.length) {
      return buildDocumentText(generatedDocument.sections);
    }
    if (generatedDocument) {
      return JSON.stringify(generatedDocument, null, 2);
    }
    return '';
  }, [generatedDocument]);

  const handleCopyGenerated = useCallback(async () => {
    if (!generatedDocumentText) return;
    try {
      await navigator.clipboard.writeText(generatedDocumentText);
    } catch (error) {
      console.error('Failed to copy generated note:', error);
    }
  }, [generatedDocumentText]);

  const assistantStatusText = useMemo(() => {
    if (agentError) return t('indlaeg.agentStatus.error', 'Agent: error');
    if (agentLoading) return t('indlaeg.agentStatus.loading', 'Agent: loading');
    if (agentReady) return t('indlaeg.agentStatus.ready', 'Agent: ready');
    return t('indlaeg.agentStatus.notReady', 'Agent: not ready');
  }, [agentError, agentLoading, agentReady, t]);

  const isTranscriptionProcessing = recordingStatus === RECORDING_STATUS.flushing;
  const isDictationProcessing =
    dictationStatus === DICTATION_STATUS.uploading ||
    dictationStatus === DICTATION_STATUS.transcribing;

  const assistantQuickActions = useMemo(
    () => [
      {
        id: 'missingInfo',
        label: t('actions.missingInfo', 'Missing info'),
        agentType: 'improvement',
        message: t(
          'prompts.missingInfo',
          'Find missing clinical information in the history and suggest relevant follow-up questions.'
        ),
      },
      {
        id: 'redFlags',
        label: t('actions.redFlags', 'Red flags'),
        agentType: 'education',
        message: t(
          'prompts.redFlags',
          'Identify possible red flags and what questions/actions should follow.'
        ),
      },
      {
        id: 'objectiveTests',
        label: t('actions.objectiveTests', 'Objective tests'),
        agentType: 'education',
        message: t(
          'prompts.objectiveTests',
          'Suggest relevant objective tests and what they can reveal.'
        ),
      },
      {
        id: 'planHep',
        label: t('actions.planHep', 'Plan + HEP'),
        agentType: 'rehab',
        message: t(
          'prompts.planHep',
          'Propose a clinical plan with a short HEP (home exercises) and key patient points.'
        ),
      },
      {
        id: 'summarizePatient',
        label: t('actions.summarizePatient', 'Summarize patient'),
        agentType: 'education',
        message: t(
          'prompts.summarizePatient',
          'Summarize this patient’s full history across all notes.'
        ),
      },
    ],
    [t]
  );

  return (
    <div className="indlæg-container">
      <div className="indlæg-layout">
        <div className="indlæg-main-pane">
          <div className={`indlæg-content${isAssistantOpen ? ' indlæg-content--drawer-open' : ''}`}>
            <div className="indlæg-workspace">
              <aside className="indlæg-column indlæg-column--left">
                <div className="indlæg-header-actions">
                  <button
                    type="button"
                    className="indlæg-close-btn"
                    onClick={onClose}
                    aria-label={t('indlaeg.backToCalendar', 'Back to booking calendar')}
                  >
                    ←
                  </button>
                </div>
                <div className="indlæg-card">
                  <div className="indlæg-card-body indlæg-recent-summary">
                    <div className="indlæg-title-block">
                      <h2 className="indlæg-title">
                        {clientName || t('indlaeg.unknownClient', 'Unknown client')}
                      </h2>
                      <span className="indlæg-title-date">{date || '—'}</span>
                    </div>
                  </div>
                  <div className="indlæg-card-header indlæg-card-header--row">
                    <h3 className="indlæg-card-title">
                      {t('indlaeg.recentSessions', 'Recent sessions')}
                    </h3>
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
                        {t('indlaeg.backToCurrent', 'Back to current')}
                      </button>
                    )}
                  </div>
                  <div className="indlæg-card-body">
                    {isLoadingHistory && (
                      <p className="indlæg-history-status">
                        {t('indlaeg.loadingSessions', 'Loading recent sessions...')}
                      </p>
                    )}

                    {historyError && !isLoadingHistory && (
                      <p className="indlæg-history-error">{historyError}</p>
                    )}

                    {!isLoadingHistory && !historyError && recentEntries.length === 0 && (
                      <p className="indlæg-history-empty">
                        {t('indlaeg.noSessions', 'No previous sessions for this client yet.')}
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
                                {entry.title || t('indlaeg.untitled', 'Untitled')}
                              </span>
                              <span className="indlæg-history-date">
                                {formatDateTime(entry.date)}
                              </span>
                            </div>
                            <div className="indlæg-history-meta">
                              <span className="indlæg-history-status-badge">
                                {t('indlaeg.active', 'Active')}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </aside>

              <section className={`indlæg-column indlæg-column--center${isAssistantOpen ? ' indlæg-column--shifted' : ''}`}>
                <div className="indlæg-card indlæg-card--journal">
                  <div className="indlæg-card-header indlæg-card-header--journal">
                    <h3 className="indlæg-card-title font-bold">
                      {t('indlaeg.title', 'Journal')}
                    </h3>
                    <button
                      type="button"
                      className="indlæg-action-btn"
                      onClick={handleSave}
                      disabled={isSaving}
                      aria-busy={isSaving}
                    >
                      {isSaving
                        ? t('indlaeg.saving', 'Saving...')
                        : t('indlaeg.saveEntry', 'Save entry')}
                    </button>
                  </div>
                  <div className="indlæg-card-body indlæg-note-area">
                    <textarea
                      className="indlæg-textarea indlæg-textarea--lg"
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder={t(
                        'indlaeg.generatedNotePlaceholder',
                        'The generated note appears here. You can edit freely.'
                      )}
                      rows={12}
                    />
                    {generationLoading && (
                      <div className="indlæg-note-loader">
                        <QuantumPulseLoader />
                      </div>
                    )}
                    {saveError && (
                      <p className="indlæg-save-error" role="alert">
                        {saveError}
                      </p>
                    )}
                  </div>
                </div>

                {isWorkspaceModeSelected && (
                  <>
                    <div className="indlæg-card indlæg-card--templates">
                      <div className="indlæg-card-header">
                        <h3 className="indlæg-card-title">
                          {t('indlaeg.templates', 'Templates')}
                        </h3>
                      </div>
                      <div className="indlæg-card-body">
                        {templatesLoading && (
                          <p className="indlæg-muted">
                            {t('indlaeg.loadingTemplates', 'Loading templates...')}
                          </p>
                        )}
                        {templatesError && <p className="indlæg-inline-error">{templatesError}</p>}
                        {!templatesLoading && !templatesError && templates.length === 0 && (
                          <p className="indlæg-muted">
                            {t('indlaeg.templatesEmpty', 'No templates found.')}
                          </p>
                        )}
                        <div className="indlæg-form-group">
                          <label className="indlæg-label" htmlFor="indlaeg-template-select">
                            {t('indlaeg.selectTemplate', 'Select template')}
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
                            <option value="">
                              {t('indlaeg.selectTemplatePlaceholder', 'Select template')}
                            </option>
                            {templates.map((template) => {
                              const translation = getTranslation(
                                template.translations,
                                templateLanguage
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
                      <button
                        type="button"
                        className="indlæg-card-header indlæg-card-header--row indlæg-template-trigger"
                        onClick={() => setIsTemplateSheetOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={isTemplateSheetOpen}
                      >
                        <h3 className="indlæg-card-title">
                          {t('indlaeg.selectedTemplate', 'Selected template')}:{' '}
                          <span className="indlæg-card-title-value">
                            {templateSelectionLabel || t('indlaeg.noneSelected', 'None selected')}
                          </span>
                        </h3>
                      </button>
                    </div>

                    <div className="indlæg-card">
                      <button
                        type="button"
                        className="indlæg-card-header indlæg-card-header--row indlæg-template-trigger"
                        onClick={() => setIsGeneratedSheetOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={isGeneratedSheetOpen}
                      >
                        <h3 className="indlæg-card-title">
                          {t('indlaeg.generatedNote', 'Generated note')}
                        </h3>
                      </button>
                      <div className="indlæg-card-body">
                        {generationLoading && (
                          <p className="indlæg-muted">
                            {t('indlaeg.generatingNote', 'Generating note...')}
                          </p>
                        )}
                        {generationError && <p className="indlæg-inline-error">{generationError}</p>}
                        {!generationLoading && !generationError && !generatedDocument && (
                          <p className="indlæg-muted">
                            {t('indlaeg.noNoteYet', 'No note generated yet.')}
                          </p>
                        )}
                        {!generationLoading && !generationError && generatedDocument && (
                          <p className="indlæg-muted">
                            {t('indlaeg.openGeneratedNote', 'Open generated note')}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>

              <aside className="indlæg-column indlæg-column--right indlæg-sidePanel">
                <div className="indlæg-sideStack">
                  <div className="indlæg-card">
                    <div className="indlæg-card-body indlæg-mode-options">
                      <GradientButton
                        type="button"
                        className={`w-full${transcribeMode === MODE_TRANSCRIBE ? ' indlæg-mode-gradient-active' : ''}`}
                        onClick={() => handleModeToggle(MODE_TRANSCRIBE)}
                        aria-pressed={transcribeMode === MODE_TRANSCRIBE}
                      >
                        {t('indlaeg.transcription', 'Transcription')}
                      </GradientButton>
                      <GradientButton
                        type="button"
                        className={`w-full${transcribeMode === MODE_DICTATE ? ' indlæg-mode-gradient-active' : ''}`}
                        onClick={() => handleModeToggle(MODE_DICTATE)}
                        aria-pressed={transcribeMode === MODE_DICTATE}
                      >
                        {t('indlaeg.dictation', 'Dictation')}
                      </GradientButton>
                    </div>
                  </div>

                  <div className="indlæg-card">
                    <div className="indlæg-card-header">
                      <h3 className="indlæg-card-title">
                        {isDictationMode
                          ? t('indlaeg.dictation', 'Dictation')
                          : t('indlaeg.transcription', 'Transcription')}
                      </h3>
                      <span className={`indlæg-status-pill indlæg-status-pill--${statusClass}`}>
                        {modeStatusLabel}
                      </span>
                    </div>
                    <div className="indlæg-card-body">
                      {transcribeMode === MODE_NONE && (
                        <p className="indlæg-muted">
                          {t('indlaeg.chooseMode', 'Choose a mode to record or transcribe.')}
                        </p>
                      )}

                      {transcribeMode === MODE_TRANSCRIBE && (
                        <>
                          <div className="indlæg-record-actions">
                            {isTranscriptionProcessing ? (
                              <div className="indlæg-processing-card" role="status" aria-live="polite">
                                <div className="indlæg-processing-loader">
                                  <span className="indlæg-processing-label">loading</span>
                                  <div className="indlæg-processing-words">
                                    <span className="indlæg-processing-word">Symptom</span>
                                    <span className="indlæg-processing-word">Diagnose</span>
                                    <span className="indlæg-processing-word">Trauma</span>
                                    <span className="indlæg-processing-word">Patient</span>
                                    <span className="indlæg-processing-word">History</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <RainbowButton
                                type="button"
                                className={`indlæg-mikrofon-btn${isRecording ? ' active' : ''}`}
                                onClick={() => (isRecording ? stopRecording() : startRecording())}
                                aria-pressed={isRecording}
                              >
                                {isRecording
                                  ? t('indlaeg.stop', 'Stop')
                                  : t('indlaeg.startConsultation', 'Start consultation')}
                              </RainbowButton>
                            )}
                            <button
                              type="button"
                              className="indlæg-save-btn"
                              onClick={handleGenerateDocument}
                              disabled={
                                generationLoading ||
                                !activeTranscriptText.trim() ||
                                !selectedTemplateKey
                              }
                            >
                              {generationLoading
                                ? t('indlaeg.writingNote', 'Writing note...')
                                : t('indlaeg.writeNote', 'Write note')}
                            </button>
                          </div>

                          <div className="indlæg-metrics">
                            <div className="indlæg-metric">
                              <span className="indlæg-metric-label">
                                {t('indlaeg.wordsCaptured', 'Words captured')}
                              </span>
                              <span className="indlæg-metric-value">{wordCount}</span>
                            </div>
                          </div>

                          {recordingError && (
                            <p className="indlæg-inline-error" role="alert">
                              {recordingError}
                            </p>
                          )}
                        </>
                      )}

                      {transcribeMode === MODE_DICTATE && (
                        <>
                          <div className="indlæg-record-actions">
                            {isDictationProcessing ? (
                              <div className="indlæg-processing-card" role="status" aria-live="polite">
                                <div className="indlæg-processing-loader">
                                  <span className="indlæg-processing-label">loading</span>
                                  <div className="indlæg-processing-words">
                                    <span className="indlæg-processing-word">Symptom</span>
                                    <span className="indlæg-processing-word">Diagnose</span>
                                    <span className="indlæg-processing-word">Trauma</span>
                                    <span className="indlæg-processing-word">Patient</span>
                                    <span className="indlæg-processing-word">History</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <RainbowButton
                                type="button"
                                className={`indlæg-mikrofon-btn${
                                  dictationStatus === DICTATION_STATUS.recording ? ' active' : ''
                                }`}
                                onClick={() =>
                                  dictationStatus === DICTATION_STATUS.recording
                                    ? stopDictationRecording()
                                    : startDictationRecording()
                                }
                                aria-pressed={dictationStatus === DICTATION_STATUS.recording}
                                disabled={
                                  dictationStatus === DICTATION_STATUS.uploading ||
                                  dictationStatus === DICTATION_STATUS.transcribing
                                }
                              >
                                {dictationStatus === DICTATION_STATUS.recording
                                  ? t('indlaeg.stop', 'Stop')
                                  : t('indlaeg.startConsultation', 'Start consultation')}
                              </RainbowButton>
                            )}
                            <button
                              type="button"
                              className="indlæg-save-btn"
                              onClick={handleGenerateDocument}
                              disabled={
                                generationLoading ||
                                !activeTranscriptText.trim() ||
                                !selectedTemplateKey ||
                                dictationStatus === DICTATION_STATUS.uploading ||
                                dictationStatus === DICTATION_STATUS.transcribing
                              }
                            >
                              {generationLoading
                                ? t('indlaeg.writingNote', 'Writing note...')
                                : t('indlaeg.writeNote', 'Write note')}
                            </button>
                          </div>

                          <div className="indlæg-metrics">
                            <div className="indlæg-metric">
                              <span className="indlæg-metric-label">
                                {t('indlaeg.wordsCaptured', 'Words captured')}
                              </span>
                              <span className="indlæg-metric-value">{wordCount}</span>
                            </div>
                          </div>

                          {dictationError && (
                            <p className="indlæg-inline-error" role="alert">
                              {dictationError}
                            </p>
                          )}

                        </>
                      )}

                      {!selectedTemplateKey && transcribeMode !== MODE_NONE && (
                        <p className="indlæg-muted">
                          {t(
                            'indlaeg.selectTemplateHint',
                            'Select a template in the middle before writing a note.'
                          )}
                        </p>
                      )}

                      {transcribeMode !== MODE_NONE && (
                        <div className="indlæg-selma-launch indlæg-selma-launch--inline">
                          <AnimatedGenerateButton
                            type="button"
                            className="indlæg-selma-btn w-full"
                            labelIdle="Selma"
                            labelActive="Selma"
                            onClick={() => setIsAssistantOpen(true)}
                            disabled={isAssistantOpen}
                          >
                          </AnimatedGenerateButton>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {transcribeMode === MODE_NONE && (
                  <div className="indlæg-selma-launch">
                    <AnimatedGenerateButton
                      type="button"
                      className="indlæg-selma-btn w-full"
                      labelIdle="Selma"
                      labelActive="Selma"
                      onClick={() => setIsAssistantOpen(true)}
                      disabled={isAssistantOpen}
                    >
                    </AnimatedGenerateButton>
                  </div>
                )}
              </aside>
            </div>
          </div>
          {isAssistantOpen && (
            <div className="indlæg-assistant-drawer">
            <button
              type="button"
              className="indlæg-drawer-edge-close indlæg-drawer-edge-close--selma"
              onClick={() => setIsAssistantOpen(false)}
              aria-label={t('indlaeg.assistantClose', 'Close Selma assistant panel')}
            >
              <span className="indlæg-dot-arrow" aria-hidden="true">
                <span className="indlæg-dot-line indlæg-dot-line--one">
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                </span>
                <span className="indlæg-dot-line indlæg-dot-line--two">
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                </span>
                <span className="indlæg-dot-line indlæg-dot-line--three">
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                </span>
                <span className="indlæg-dot-line indlæg-dot-line--four">
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                </span>
                <span className="indlæg-dot-line indlæg-dot-line--five">
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                </span>
                <span className="indlæg-dot-line indlæg-dot-line--six">
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                </span>
                <span className="indlæg-dot-line indlæg-dot-line--seven">
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                  <span className="indlæg-dot-round" />
                </span>
              </span>
            </button>
              <div className="indlæg-drawer-header">
                <h3 className="indlæg-card-title">
                  {t('indlaeg.assistantTitle', 'Selma Assistant')}
                </h3>
                <button
                  type="button"
                  className="indlæg-drawer-close"
                  onClick={() => setIsAssistantOpen(false)}
                  aria-label={t('indlaeg.assistantCloseShort', 'Close assistant')}
                >
                  →
                </button>
              </div>

              <CortiAssistantPanel
                statusText={assistantStatusText}
                quickActions={assistantQuickActions}
                activeQuickAction={activeAgentPreset}
                onQuickAction={(actionId) => setActiveAgentPreset(actionId)}
                onSendMessage={handleAssistantSendMessage}
                messages={agentMessages}
                isSending={agentChatLoading}
                actionsDisabled={agentChatLoading || agentLoading}
                errorText={agentError}
                inputValue={agentInput}
                onInputChange={setAgentInput}
                inputDisabled={agentLoading}
                sendDisabled={agentLoading || agentChatLoading || !agentInput.trim()}
                showEmptyHint={!activeTranscriptText.trim()}
                emptyHintText={t('indlaeg.emptyHint', 'No text yet — you can still ask generally.')}
                chatAvatars={CHAT_AVATARS}
                placeholder={t(
                  'indlaeg.assistantPlaceholder',
                  'Ask Selma assistant a question...'
                )}
              />
            </div>
          )}
          {isTemplateSheetOpen &&
            createPortal(
              <>
                <div
                  className="indlæg-template-sheet-overlay"
                  role="presentation"
                  onClick={() => setIsTemplateSheetOpen(false)}
                />
                <div
                  className="indlæg-template-sheet-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t('indlaeg.templateSheetLabel', 'Selected template')}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="indlæg-template-sheet">
                    <div className="indlæg-template-sheet-header">
                      <div className="indlæg-template-sheet-title">
                        <h3 className="indlæg-card-title">
                          {templateSelectionLabel ||
                            t('indlaeg.templateNoneSelected', 'No template selected')}
                        </h3>
                        {selectedTemplateMeta?.description ? (
                          <p className="indlæg-template-sheet-subtitle">
                            {selectedTemplateMeta.description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="indlæg-template-sheet-close"
                        onClick={() => setIsTemplateSheetOpen(false)}
                        aria-label={t('indlaeg.closeTemplate', 'Close template')}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="indlæg-template-sheet-body">
                      {templateDetailsLoading && (
                        <p className="indlæg-muted">
                          {t('indlaeg.templateDetailsLoading', 'Loading details...')}
                        </p>
                      )}
                      {templateDetailsError && (
                        <p className="indlæg-inline-error">{templateDetailsError}</p>
                      )}
                      {!selectedTemplateKey && (
                        <p className="indlæg-muted">
                          {t('indlaeg.templateDetailsEmpty', 'Select a template to see sections.')}
                        </p>
                      )}
                      {!templateDetailsLoading && selectedTemplateKey && selectedTemplate && (
                        <div className="indlæg-template-sections">
                          {selectedTemplateSections.length === 0 ? (
                            <p className="indlæg-muted">
                              {t('indlaeg.templateNoSections', 'Template has no sections.')}
                            </p>
                          ) : (
                            selectedTemplateSections.map((section) => {
                              const sectionMeta = section?.sectionsId || section;
                              const translation = getTranslation(
                                sectionMeta?.translations,
                                templateLanguage
                              );
                              const sectionName =
                                translation?.name ||
                                sectionMeta?.name ||
                                t('indlaeg.sectionFallback', 'Section');
                              const sectionDescription =
                                translation?.description || sectionMeta?.description || '';
                              return (
                                <div
                                  key={`${sectionMeta?.key}-${section?.sort}`}
                                  className="indlæg-template-section"
                                >
                                  <div className="indlæg-template-section-title">
                                    {sectionName}
                                  </div>
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
                  </div>
                </div>
              </>,
              document.body
            )}
          {isGeneratedSheetOpen &&
            createPortal(
              <>
                <div
                  className="indlæg-template-sheet-overlay"
                  role="presentation"
                  onClick={() => setIsGeneratedSheetOpen(false)}
                />
                <div
                  className="indlæg-template-sheet-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t('indlaeg.generatedSheetLabel', 'Generated note')}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="indlæg-template-sheet">
                    <div className="indlæg-template-sheet-header">
                      <div className="indlæg-template-sheet-title">
                        <h3 className="indlæg-card-title">
                          {t('indlaeg.generatedNote', 'Generated note')}
                        </h3>
                      </div>
                      <div className="indlæg-template-sheet-actions">
                        <button
                          type="button"
                          className="indlæg-action-btn"
                          onClick={handleCopyGenerated}
                          disabled={!generatedDocumentText}
                        >
                          {t('indlaeg.copyGenerated', 'Copy')}
                        </button>
                        <button
                          type="button"
                          className="indlæg-template-sheet-close"
                          onClick={() => setIsGeneratedSheetOpen(false)}
                          aria-label={t('indlaeg.closeGenerated', 'Close generated note')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="indlæg-template-sheet-body">
                      {generationLoading && (
                        <p className="indlæg-muted">
                          {t('indlaeg.generatingNote', 'Generating note...')}
                        </p>
                      )}
                      {generationError && <p className="indlæg-inline-error">{generationError}</p>}
                      {!generationLoading && !generationError && !generatedDocument && (
                        <p className="indlæg-muted">
                          {t('indlaeg.noNoteYet', 'No note generated yet.')}
                        </p>
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
                </div>
              </>,
              document.body
            )}
        </div>
      </div>
    </div>
  );
}

export default Indlæg;
