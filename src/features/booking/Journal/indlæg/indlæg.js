import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
import {
  CORTI_SPEECH_FALLBACK,
  normalizeToCortiLocale,
  resolveSpeechLanguage,
} from '../../../../utils/cortiLanguages';
import { buildApiUrl, buildWsUrl } from '../../../../utils/runtimeUrls';
import { getIdToken } from '../../../../utils/auth';

const DEFAULT_LANGUAGE = 'en';
const HEADING_INSTRUCTION =
  'Use Markdown headings starting with ### for each section. Do not return a single block without headings.';
const FREE_TEXT_FAST_INSTRUCTION =
  'Svar kort og direkte paa brugerens spoergsmaal. Maks 5 bullets eller 5 korte linjer. Ingen kilder. Ingen lange forklaringer.';
const FREE_TEXT_TITLE_INSTRUCTION =
  'Start altid svaret med en Markdown-overskrift paa formatet "### <kort svar>" (maks 8 ord), og skriv derefter et meget kort svar under overskriften.';
const SOURCE_TEXT_WORD_LIMIT_ACTIONS = new Set([
  'objectiveTests',
  'exerciseSuggestions',
  'guidelines',
  'latestEvidence',
]);
const SOURCE_TEXT_WORD_LIMIT = 100;
const UNSUPPORTED_LANGUAGE_RE = /unsupported language|language unavailable/i;

const apiUrl = (path) => buildApiUrl(path);
const buildTranscribeWsUrl = () => buildWsUrl('/ws/corti/transcribe');

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

const truncateToWords = (value = '', wordLimit = 0) => {
  const limit = Number(wordLimit);
  const text = `${value || ''}`.trim();
  if (!Number.isFinite(limit) || limit <= 0 || !text) {
    return { text, truncated: false };
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return { text, truncated: false };
  }
  return {
    text: words.slice(0, limit).join(' '),
    truncated: true,
  };
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const plainTextToRichContent = (value = '') => escapeHtml(value).replace(/\n/g, '<br>');

const richContentToPlainText = (value = '') => {
  if (!value) return '';
  if (typeof document === 'undefined') {
    return String(value).replace(/<[^>]+>/g, '');
  }

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '');

  const container = document.createElement('div');
  container.innerHTML = normalized;
  return (container.textContent || '').replace(/\u00a0/g, ' ');
};

const isRichContentEmpty = (value = '') =>
  !String(value)
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<\/?div>/gi, '')
    .replace(/<\/?p>/gi, '')
    .replace(/&nbsp;/gi, '')
    .trim();

const getEntryPlainContent = (entry) => {
  if (typeof entry?.content === 'string') {
    return entry.content;
  }
  if (typeof entry?.contentRich === 'string') {
    return richContentToPlainText(entry.contentRich);
  }
  return '';
};

const getEntryRichContent = (entry) => {
  if (typeof entry?.contentRich === 'string' && entry.contentRich.trim() && !isRichContentEmpty(entry.contentRich)) {
    return entry.contentRich;
  }
  return plainTextToRichContent(getEntryPlainContent(entry));
};

const buildSaveSnapshot = ({
  entryId = null,
  dateValue = '',
  contentValue = '',
  contentRichValue = '',
  templateKeyValue = '',
}) =>
  JSON.stringify({
    entryId: entryId || null,
    date: `${dateValue || ''}`.trim(),
    content: `${contentValue || ''}`.trim(),
    contentRich: `${contentRichValue || ''}`.trim(),
    templateKey: `${templateKeyValue || ''}`.trim(),
  });

function Indlæg({
  clientId,
  clientName,
  onClose,
  onSave,
  onOpenEntry,
  initialDate = '',
  initialEntry = null, // Existing entry to edit
  appointmentId = null,
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

  const originalEntryRef = useRef(initialEntry);
  const previousEntryRef = useRef(null);
  // used when user starts a brand new entry (unsaved) and navigates away to a past session
  const previousDraftRef = useRef(null);
  const initialResolvedDate = initialEntry?.date || initialDate || '14-11-2025';
  const initialPlainContent = getEntryPlainContent(initialEntry);
  const initialRichContent = getEntryRichContent(initialEntry);
  const [activeEntry, setActiveEntry] = useState(initialEntry);
  const [date, setDate] = useState(initialResolvedDate);
  const [content, setContent] = useState(initialPlainContent);
  const [contentRich, setContentRich] = useState(initialRichContent);
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
  const [dictationLanguage, setDictationLanguage] = useState('auto');

  const [agentIds, setAgentIds] = useState({});
  const [agentReady, setAgentReady] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [agentMessages, setAgentMessages] = useState([]);
  const [agentInput, setAgentInput] = useState('');
  const [agentChatLoading, setAgentChatLoading] = useState(false);
  const [activeAgentPreset, setActiveAgentPreset] = useState('');
  const [expandedNoteHeight, setExpandedNoteHeight] = useState(null);
  const [manualNoteHeight, setManualNoteHeight] = useState(null);
  const [isManualNoteResize, setIsManualNoteResize] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle');
  const [noteTextFormat, setNoteTextFormat] = useState('normal');

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const noteTextareaRef = useRef(null);
  const noteBaseHeightRef = useRef(null);
  const noteResizeStartHeightRef = useRef(null);
  const copyResetTimeoutRef = useRef(null);
  const isRecordingRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const configAcceptedRef = useRef(false);
  const recorderStartedRef = useRef(false);
  const awaitingFlushRef = useRef(false);
  const awaitingEndRef = useRef(false);
  const cleanupInProgressRef = useRef(false);
  const transcribeFallbackRef = useRef(false);

  const dictationRecorderRef = useRef(null);
  const dictationStreamRef = useRef(null);
  const dictationChunksRef = useRef([]);
  const dictationStopRequestedRef = useRef(false);
  const prewarmedAgentKeysRef = useRef(new Set());
  const lastSavedSnapshotRef = useRef(
    buildSaveSnapshot({
      entryId: initialEntry?.id || null,
      dateValue: initialResolvedDate,
      contentValue: initialPlainContent,
      contentRichValue: initialRichContent,
      templateKeyValue: initialEntry?.templateKey || '',
    })
  );

  const { user, userDoc } = useAuth();
  const { language, preferredLanguage, locale, t } = useLanguage();
  const resolvedLanguage = preferredLanguage || DEFAULT_LANGUAGE;
  const browserLocale = typeof navigator !== 'undefined' ? navigator.language : '';
  const explicitSpeechLanguage =
    dictationLanguage && dictationLanguage !== 'auto' ? dictationLanguage : '';
  const dateLocale = useMemo(
    () => locale || resolvedLanguage || DEFAULT_LANGUAGE,
    [locale, resolvedLanguage]
  );
  // Normalize UI locale to Corti-supported locale codes (see utils/cortiLanguages).
  const templateLanguage = useMemo(
    () => normalizeToCortiLocale(resolvedLanguage),
    [resolvedLanguage]
  );
  const speechLanguage = useMemo(
    () =>
      resolveSpeechLanguage({
        uiLanguage: resolvedLanguage,
        speechLanguage: explicitSpeechLanguage,
        browserLocale,
      }),
    [resolvedLanguage, explicitSpeechLanguage, browserLocale]
  );

  const userAvatarSrc = useMemo(() => {
    const candidates = [userDoc?.photoURL, user?.photoURL];
    const resolved = candidates.find((value) => typeof value === 'string' && value.trim());
    return resolved ? resolved.trim() : '';
  }, [userDoc?.photoURL, user?.photoURL]);

  const userAvatarFallback = useMemo(() => {
    const source =
      `${userDoc?.fullName || userDoc?.displayName || user?.displayName || user?.email || user?.uid || ''}`.trim();
    if (!source) return 'U';
    return source
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [userDoc?.displayName, userDoc?.fullName, user?.displayName, user?.email, user?.uid]);

  const CHAT_AVATARS = useMemo(
    () => ({
      user: userAvatarSrc,
      userFallback: userAvatarFallback,
      ai: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&q=80&crop=faces&fit=crop',
    }),
    [userAvatarFallback, userAvatarSrc]
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

  const parseDateValue = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return null;
      const dmYMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s|$)/);
      if (dmYMatch) {
        const day = Number.parseInt(dmYMatch[1], 10);
        const month = Number.parseInt(dmYMatch[2], 10);
        const year = Number.parseInt(dmYMatch[3], 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          return new Date(year, month - 1, day);
        }
      }
      const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
      if (isoMatch) {
        const year = Number.parseInt(isoMatch[1], 10);
        const month = Number.parseInt(isoMatch[2], 10);
        const day = Number.parseInt(isoMatch[3], 10);
        return new Date(year, month - 1, day);
      }
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
      return null;
    }
    if (typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    try {
      const dateObj = parseDateValue(value);
      if (!dateObj || Number.isNaN(dateObj.getTime())) return String(value);
      return dateObj.toLocaleString(dateLocale, {
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

  const handleCopyJournal = useCallback(async () => {
    const text = content ?? '';
    if (!text) return;

    const markCopied = () => {
      setCopyStatus('copied');
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = setTimeout(() => {
        setCopyStatus('idle');
      }, 2000);
    };

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        markCopied();
        return;
      }
    } catch (error) {
      console.warn('[Indlæg] Clipboard API failed, falling back:', error);
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      markCopied();
    } catch (error) {
      console.error('[Indlæg] Copy fallback failed:', error);
    }
  }, [content]);

  const syncNoteContentFromEditor = useCallback(() => {
    const editor = noteTextareaRef.current;
    if (!editor) return;
    const nextRich = editor.innerHTML || '';
    if (isRichContentEmpty(nextRich)) {
      setContent('');
      setContentRich('');
      if (editor.innerHTML) {
        editor.innerHTML = '';
      }
      return;
    }
    const nextPlain = richContentToPlainText(nextRich);
    setContent(nextPlain);
    setContentRich(nextRich);
  }, []);

  const refreshNoteTextFormat = useCallback(() => {
    const editor = noteTextareaRef.current;
    if (!editor || typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    if (!editor.contains(selection.anchorNode)) return;
    try {
      const isBold =
        typeof document.queryCommandState === 'function' &&
        document.queryCommandState('bold');
      setNoteTextFormat(isBold ? 'bold' : 'normal');
    } catch {
      setNoteTextFormat('normal');
    }
  }, []);

  const handleApplyNoteTextFormat = useCallback(
    (nextFormat) => {
      const editor = noteTextareaRef.current;
      if (!editor || typeof window === 'undefined') return;

      editor.focus();

      const selection = window.getSelection();
      const hasSelection =
        selection &&
        selection.rangeCount > 0 &&
        !selection.isCollapsed &&
        editor.contains(selection.anchorNode) &&
        editor.contains(selection.focusNode);

      try {
        if (nextFormat === 'bold') {
          if (typeof document.execCommand === 'function') {
            if (hasSelection) {
              document.execCommand('bold', false, null);
            } else {
              const isBold =
                typeof document.queryCommandState === 'function' &&
                document.queryCommandState('bold');
              if (!isBold) {
                document.execCommand('bold', false, null);
              }
            }
          }
        } else if (typeof document.execCommand === 'function') {
          if (hasSelection) {
            document.execCommand('removeFormat', false, null);
          } else {
            const isBold =
              typeof document.queryCommandState === 'function' &&
              document.queryCommandState('bold');
            if (isBold) {
              document.execCommand('bold', false, null);
            }
          }
        }
      } catch (error) {
        console.warn('[Indlæg] Could not apply note text format:', error);
      }

      syncNoteContentFromEditor();
      setNoteTextFormat(nextFormat === 'bold' ? 'bold' : 'normal');
    },
    [syncNoteContentFromEditor]
  );

  const formatDateOnly = (value) => {
    if (!value) return '';
    try {
      const dateObj = parseDateValue(value);
      if (!dateObj || Number.isNaN(dateObj.getTime())) return String(value);
      return dateObj.toLocaleDateString(dateLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
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
        const token = await getIdToken().catch(() => null);
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(url, {
          method: 'POST',
          headers,
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

  const prewarmAssistantAgents = useCallback(() => {
    const agentKeys = ['educationFast', 'education', 'improvement'];
    agentKeys.forEach((agentKey) => {
      if (prewarmedAgentKeysRef.current.has(agentKey)) return;
      void ensureAgentId(agentKey).then((agentId) => {
        if (agentId) {
          prewarmedAgentKeysRef.current.add(agentKey);
        }
      });
    });
  }, [ensureAgentId]);

  const handleOpenAssistant = useCallback(() => {
    setIsAssistantOpen(true);
    prewarmAssistantAgents();
  }, [prewarmAssistantAgents]);

  const resolvedAppointmentId = useMemo(
    () =>
      appointmentId ||
      initialEntry?.appointmentId ||
      initialEntry?.appointment?.id ||
      null,
    [appointmentId, initialEntry]
  );

  const getAssistantMessagesRef = useCallback(() => {
    if (!user?.uid || !resolvedAppointmentId) {
      return null;
    }
    return collection(
      db,
      'users',
      user.uid,
      'appointments',
      resolvedAppointmentId,
      'assistantChats'
    );
  }, [resolvedAppointmentId, user?.uid]);

  const appendAssistantMessage = useCallback(
    async (message) => {
      setAgentMessages((prev) => [...prev, message]);
      const messagesRef = getAssistantMessagesRef();
      if (!messagesRef) return;
      try {
        await addDoc(messagesRef, {
          ...message,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('[Indlæg] Failed to persist assistant message:', error);
      }
    },
    [getAssistantMessagesRef]
  );

  const updateNoteHeight = useCallback(() => {
    if (isManualNoteResize) return;
    const textarea = noteTextareaRef.current;
    if (!textarea) return;
    const currentHeight = textarea.clientHeight;
    if (!noteBaseHeightRef.current || expandedNoteHeight === null) {
      noteBaseHeightRef.current = currentHeight;
    }
    const baseHeight = noteBaseHeightRef.current || currentHeight;
    const isOverflowing = textarea.scrollHeight > baseHeight + 4;
    if (isOverflowing) {
      setExpandedNoteHeight(Math.ceil(baseHeight * 1.5));
    } else {
      noteBaseHeightRef.current = currentHeight;
      setExpandedNoteHeight(null);
    }
  }, [expandedNoteHeight, isManualNoteResize]);

  const handleTextareaPointerDown = useCallback(() => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;
    noteResizeStartHeightRef.current = textarea.offsetHeight;
  }, []);

  const handleTextareaPointerUp = useCallback(() => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;
    const startHeight = noteResizeStartHeightRef.current;
    const nextHeight = textarea.offsetHeight;
    if (!startHeight || Math.abs(nextHeight - startHeight) < 4) return;
    setIsManualNoteResize(true);
    setManualNoteHeight(nextHeight);
  }, []);


  const sendAgentMessage = useCallback(
    async (
      overrideMessage = null,
      _overrideAgentType = null,
      agentKey = 'education',
      displayMessage = null,
      sourceTextWordLimit = null,
      useHeadingInstruction = true
    ) => {
      const finalMessage = `${overrideMessage ?? agentInput}`.trim();
      if (!finalMessage) return;
      let resolvedAgentKey = agentKey;
      let resolvedAgentId = await ensureAgentId(resolvedAgentKey);
      if (!resolvedAgentId && resolvedAgentKey === 'educationFast') {
        resolvedAgentKey = 'education';
        resolvedAgentId = await ensureAgentId(resolvedAgentKey);
      }
      if (!resolvedAgentId) {
        setAgentError(t('indlaeg.errors.agentNotReady', 'Agent not ready.'));
        return;
      }
      const baseText =
        (content && content.trim()) ||
        (generatedDocument?.sections?.length ? buildDocumentText(generatedDocument.sections) : '') ||
        (transcribeMode === MODE_DICTATE ? dictationText : transcriptText);
      let sourceText = (baseText || '').trim() || finalMessage;
      const truncatedSource = truncateToWords(sourceText, sourceTextWordLimit);
      sourceText = truncatedSource.text;
      if (truncatedSource.truncated) {
        const limitLabel = Number(sourceTextWordLimit) || SOURCE_TEXT_WORD_LIMIT;
        sourceText = `${sourceText}\n\n[Truncated to ${limitLabel} words for faster response]`;
      }
      const contextSource = (content && content.trim()) ? 'note' : generatedDocument?.sections?.length ? 'generated' : 'transcript';
      console.log('[AGENT UI] key=', resolvedAgentKey, 'ctx source=', contextSource, 'len=', sourceText.length);

      const payload = {
        message: useHeadingInstruction
          ? `${finalMessage}\n\n${HEADING_INSTRUCTION}`.trim()
          : finalMessage,
        sourceText: sourceText,
        preferredLanguage: resolvedLanguage,
      };

      setAgentError('');
      setAgentChatLoading(true);
      const visibleMessage = `${displayMessage ?? finalMessage}`.trim() || finalMessage;
      await appendAssistantMessage({
        role: 'user',
        text: visibleMessage,
        ts: Date.now(),
      });

      try {
        const token = await getIdToken().catch(() => null);
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(
          apiUrl(`/api/agents/${encodeURIComponent(resolvedAgentKey)}/chat`),
          {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          }
        );
        const raw = await response.text();
        const temporaryUnavailableError = t(
          'indlaeg.errors.agentTemporaryUnavailable',
          'Agenten er midlertidigt utilgaengelig. Proev igen om lidt.'
        );
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (parseErr) {
          const isLikelyHtml = /^\s*<!doctype html/i.test(raw) || /^\s*<html/i.test(raw);
          if (!response.ok && (response.status >= 500 || isLikelyHtml)) {
            throw new Error(temporaryUnavailableError);
          }
          throw new Error(`Agent chat parse failed (${response.status}).`);
        }
        if (!response.ok || !data?.ok) {
          if (response.status >= 500) {
            throw new Error(temporaryUnavailableError);
          }
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
        await appendAssistantMessage({
          role: 'assistant',
          text: replyText,
          sections,
          ts: Date.now(),
        });
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
      appendAssistantMessage,
      resolvedLanguage,
      t,
    ]
  );

  const ACTION_TO_AGENT = useMemo(
    () => ({
      missingInfo: 'improvement',
      redFlags: 'education',
      objectiveTests: 'education',
      exerciseSuggestions: 'education',
      freeText: 'educationFast',
    }),
    []
  );

  const ACTION_PROMPTS = useMemo(
    () => ({
      missingInfo: t(
        'prompts.missingInfoInstruction',
        'Find missing clinical information in the patient history and suggest relevant follow-up questions. Do not include sections or content named "Encounter Summary", "Dokumentationsmæssig betydning", or "Coding Specificity Checklist". Return your answer in Danish. Format with Markdown headings using ### for each section.'
      ),
      redFlags: t(
        'prompts.redFlagsInstruction',
        'Svar kun med praecis to afsnit med disse overskrifter i denne raekkefoelge: "### Red flags i dette konkrete tilfaelde" og "### Kilder". I foerste afsnit skal du starte med "Ja" eller "Nej" paa om der er roede flag i notatet, efterfulgt af en kort begrundelse og kun konkrete fund fra dette konkrete tilfaelde samt relevante opfoelgende spoergsmaal. Ingen separate afsnit om akut eskalering/akut udredning. I andet afsnit "### Kilder" skal du angive korte relevante kilder/retningslinjer. Return your answer in Danish.'
      ),
      objectiveTests: t(
        'prompts.objectiveTestsInstruction',
        'Suggest relevant clinical objective tests based on the patient note. Do not recommend imaging or paraclinical investigations (for example X-ray, MRI, CT, ultrasound, blood tests, or other laboratory tests). For each recommended test, briefly explain why it is relevant for this specific patient and what positive and negative findings could indicate. Return your answer in Danish. Format with Markdown headings using ### for each section.'
      ),
      exerciseSuggestions: t(
        'prompts.exerciseSuggestions',
        'Provide exactly 3 evidence-based exercise suggestions tailored to the patient context. For each exercise include: purpose, dosage, load tolerance guidance, and progression/regression options. Keep each exercise very short and clinically usable. Use only information from the provided note and general clinical knowledge. Do not perform external web searches and do not include citations/sources.'
      ),
    }),
    [t]
  );

  const handleAssistantSendMessage = useCallback(
    (message, agentType, actionId, displayMessage = null) => {
      const resolvedAction = actionId || 'freeText';
      const agentKey = ACTION_TO_AGENT[resolvedAction] || 'education';
      const isFreeText = resolvedAction === 'freeText';
      const rawInput = `${message ?? agentInput ?? ''}`.trim();
      const finalMessage = isFreeText
        ? `${rawInput}\n\n${FREE_TEXT_FAST_INSTRUCTION}\n${FREE_TEXT_TITLE_INSTRUCTION}`.trim()
        : `${ACTION_PROMPTS[resolvedAction] || message || ''}`.trim();
      if (!finalMessage) return;
      const visibleMessage = isFreeText
        ? `${displayMessage ?? rawInput}`.trim() || rawInput
        : `${displayMessage ?? finalMessage}`.trim() || finalMessage;
      const sourceTextWordLimit = SOURCE_TEXT_WORD_LIMIT_ACTIONS.has(resolvedAction)
        ? SOURCE_TEXT_WORD_LIMIT
        : null;
      const useHeadingInstruction = !isFreeText;
      sendAgentMessage(
        finalMessage,
        agentType,
        agentKey,
        visibleMessage,
        sourceTextWordLimit,
        useHeadingInstruction
      );
    },
    [ACTION_PROMPTS, ACTION_TO_AGENT, agentInput, sendAgentMessage]
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
      const nextDate = activeEntry.date || initialDate || '';
      const nextContent = getEntryPlainContent(activeEntry);
      const nextContentRich = getEntryRichContent(activeEntry);
      const nextTemplateKey = activeEntry.templateKey || '';
      setDate(nextDate);
      setContent(nextContent);
      setContentRich(nextContentRich);
      setSelectedTemplateKey(nextTemplateKey);
      setNoteTextFormat('normal');
      lastSavedSnapshotRef.current = buildSaveSnapshot({
        entryId: activeEntry?.id || initialEntry?.id || null,
        dateValue: nextDate,
        contentValue: nextContent,
        contentRichValue: nextContentRich,
        templateKeyValue: nextTemplateKey,
      });
    } else if (initialEntry) {
      const nextDate = initialEntry.date || initialDate || '';
      const nextContent = getEntryPlainContent(initialEntry);
      const nextContentRich = getEntryRichContent(initialEntry);
      const nextTemplateKey = initialEntry.templateKey || '';
      setDate(nextDate);
      setContent(nextContent);
      setContentRich(nextContentRich);
      setSelectedTemplateKey(nextTemplateKey);
      setNoteTextFormat('normal');
      lastSavedSnapshotRef.current = buildSaveSnapshot({
        entryId: initialEntry?.id || null,
        dateValue: nextDate,
        contentValue: nextContent,
        contentRichValue: nextContentRich,
        templateKeyValue: nextTemplateKey,
      });
    } else if (initialDate) {
      setDate(initialDate);
      setNoteTextFormat('normal');
      lastSavedSnapshotRef.current = buildSaveSnapshot({
        entryId: null,
        dateValue: initialDate,
        contentValue: '',
        contentRichValue: '',
        templateKeyValue: '',
      });
    }
  }, [activeEntry, initialEntry, initialDate]);

  useEffect(() => {
    const editor = noteTextareaRef.current;
    if (!editor) return;
    const nextRich = contentRich || '';
    if (editor.innerHTML !== nextRich) {
      editor.innerHTML = nextRich;
    }
  }, [contentRich]);

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
            content: getEntryPlainContent(data),
            contentRich: getEntryRichContent(data),
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

  const persistDictationLanguage = useCallback(
    async (nextLanguage) => {
      if (!user?.uid) return;
      const resolved = typeof nextLanguage === 'string' ? nextLanguage.trim() : '';
      await setDoc(
        doc(db, 'users', user.uid),
        { settings: { dictationLanguage: resolved || 'auto' } },
        { merge: true }
      );
    },
    [user?.uid]
  );

  useEffect(() => {
    if (!user?.uid) {
      setDictationLanguage('auto');
      return;
    }
    const loadDictationLanguage = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : null;
        const stored =
          data?.settings?.dictationLanguage ||
          data?.dictationLanguage ||
          'auto';
        if (typeof stored === 'string' && stored.trim()) {
          setDictationLanguage(stored.trim());
        } else {
          setDictationLanguage('auto');
        }
      } catch (error) {
        console.error('[Indlæg] Failed to load dictation language', error);
        setDictationLanguage('auto');
      }
    };
    void loadDictationLanguage();
  }, [user?.uid]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const token = await getIdToken().catch(() => null);
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(
        apiUrl(`/api/corti/templates?lang=${encodeURIComponent(templateLanguage)}`),
        { headers }
      );
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
      const token = await getIdToken().catch(() => null);
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(apiUrl(`/api/corti/templates/${encodeURIComponent(templateKey)}`), {
        headers,
      });
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

  useLayoutEffect(() => {
    updateNoteHeight();
  }, [content, updateNoteHeight]);

  useEffect(() => {
    const handleResize = () => updateNoteHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateNoteHeight]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const messagesRef = getAssistantMessagesRef();
    if (!messagesRef) {
      return undefined;
    }

    const messagesQuery = query(messagesRef, orderBy('ts', 'asc'));
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            role: data.role || 'assistant',
            text: data.text || '',
            sections: Array.isArray(data.sections) ? data.sections : null,
            ts: data.ts || Date.now(),
          };
        });
        setAgentMessages(nextMessages);
      },
      (error) => {
        console.error('[Indlæg] Failed to load assistant chat:', error);
      }
    );

    return () => unsubscribe();
  }, [getAssistantMessagesRef]);

  const ensureInteraction = useCallback(async () => {
    if (interactionId) {
      return interactionId;
    }

    const token = await getIdToken().catch(() => null);
    if (!token) {
      throw new Error(t('indlaeg.errors.mustBeLoggedIn', 'You must be logged in to save the entry.'));
    }

    const response = await fetch(apiUrl('/api/corti/interactions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
      const token = await getIdToken().catch(() => null);
      if (!token) {
        throw new Error(t('indlaeg.errors.mustBeLoggedIn', 'You must be logged in to save the entry.'));
      }
      const response = await fetch(apiUrl(`/api/corti/interactions/${resolvedInteractionId}/documents`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        setContentRich(plainTextToRichContent(nextContent));
      } else if (data) {
        const nextContent = JSON.stringify(data, null, 2);
        setContent(nextContent);
        setContentRich(plainTextToRichContent(nextContent));
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
        const uiLocale = preferredLanguage || language || locale || '';
        const browserLocale =
          typeof navigator !== 'undefined' ? navigator.language : '';
        const explicitSpeechLanguage =
          dictationLanguage && dictationLanguage !== 'auto' ? dictationLanguage : '';
        const formData = new FormData();
        formData.append('audio', blob, 'dictation.webm');
        formData.append('dictationLanguage', dictationLanguage || 'auto');
        if (explicitSpeechLanguage) {
          formData.append('speechLanguage', explicitSpeechLanguage);
        }
        formData.append('uiLocale', uiLocale);
        formData.append('browserLocale', browserLocale);

        const token = await getIdToken().catch(() => null);
        if (!token) {
          throw new Error(t('indlaeg.errors.mustBeLoggedIn', 'You must be logged in to save the entry.'));
        }

        const response = await fetch(apiUrl('/api/corti/dictate'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        setDictationStatus(DICTATION_STATUS.transcribing);
        const raw = await response.text();
        if (!response.ok) {
          const errorPayload = (() => {
            try {
              return raw ? JSON.parse(raw) : null;
            } catch (_) {
              return null;
            }
          })();
          const detail =
            errorPayload?.detail ||
            errorPayload?.message ||
            errorPayload?.error ||
            raw ||
            `Serverfejl (${response.status})`;
          console.error('[Indlæg] Dictation upload failed (raw):', raw);
          if (
            response.status === 400 &&
            (errorPayload?.code === 'UNSUPPORTED_LANGUAGE' || /unsupported language/i.test(detail))
          ) {
            const attempted = errorPayload?.attempted || errorPayload?.attemptedLanguage || 'valgt sprog';
            const fallback = errorPayload?.fallback || CORTI_SPEECH_FALLBACK;
            const message = `Corti understøtter ikke ${attempted} i denne konto – prøv ${fallback}.`;
            setDictationError(message);
            setDictationStatus(DICTATION_STATUS.error);
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
              window.alert(message);
            }
            return;
          }
          if (response.status >= 500) {
            throw new Error(t('indlaeg.errors.dictationServerError', 'Server error, try again.'));
          }
          throw new Error(detail);
        }

        let data = null;
        try {
          data = JSON.parse(raw);
        } catch (parseErr) {
          console.error('[Indlæg] Dictation JSON parse failed:', raw);
          throw new Error('Response was not JSON: ' + raw.slice(0, 120));
        }

        console.info('[Indlæg] Dictation response:', data);

        if (data?.fallbackUsed || data?.usedFallback) {
          const attempted = data?.attempted || data?.attemptedLanguage || speechLanguage;
          const fallback = data?.fallback || data?.language || CORTI_SPEECH_FALLBACK;
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(
              `Corti understøtter ikke ${attempted} i denne konto – vi skifter til English (en-US).`
            );
          }
          console.warn('[Corti] Dictation language fallback', {
            attempted,
            fallback,
          });
        }

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
    [
      DICTATION_STATUS.done,
      DICTATION_STATUS.error,
      DICTATION_STATUS.transcribing,
      DICTATION_STATUS.uploading,
      dictationLanguage,
      language,
      locale,
      preferredLanguage,
      t,
    ]
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
      if (!prev) {
        setContentRich(plainTextToRichContent(dictationText));
        return dictationText;
      }
      const trimmed = prev.trim();
      const nextPlain = trimmed ? `${trimmed}\n\n${dictationText}` : dictationText;
      setContentRich(plainTextToRichContent(nextPlain));
      return nextPlain;
    });
  }, [dictationText]);

  const handleReplaceNoteWithDictation = useCallback(() => {
    if (!dictationText) return;
    setContent(dictationText);
    setContentRich(plainTextToRichContent(dictationText));
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
    transcribeFallbackRef.current = false;

    if (!navigator.mediaDevices || typeof window.MediaRecorder === 'undefined') {
      setRecordingError(t('indlaeg.errors.recordingBrowserUnsupported', 'Recording not supported.'));
      cleanupRecording(RECORDING_STATUS.error);
      return;
    }

    const wsUrl = buildTranscribeWsUrl();
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
            primaryLanguage: speechLanguage,
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
        if (message.type === 'warning' && message.code === 'FALLBACK_LANGUAGE') {
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(
              `Corti understøtter ikke ${message.attempted || 'valgt sprog'} i denne konto – vi skifter til English (en-US).`
            );
          }
          console.warn('[Corti] WS language fallback', {
            attempted: message.attempted,
            fallback: message.fallback,
          });
          return;
        }
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
          if (
            !transcribeFallbackRef.current &&
            UNSUPPORTED_LANGUAGE_RE.test(reason || '') &&
            ws.readyState === WebSocket.OPEN
          ) {
            transcribeFallbackRef.current = true;
            const fallbackConfig = {
              type: 'config',
              configuration: {
                primaryLanguage: CORTI_SPEECH_FALLBACK,
                automaticPunctuation: true,
              },
            };
            try {
              ws.send(JSON.stringify(fallbackConfig));
              setLastWs({ type: 'SENT_CONFIG_FALLBACK', reason });
              setRecordingStatus(RECORDING_STATUS.config);
              if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('Language not supported by Corti, switched to English (en-US).');
              }
              console.warn('[Corti] WS language fallback', {
                attempted: speechLanguage,
                fallback: CORTI_SPEECH_FALLBACK,
              });
              return;
            } catch (_) {}
          }

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
  }, [RECORDING_STATUS, cleanupRecording, startMediaRecorder, t, speechLanguage]);

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

  const buildCurrentSnapshot = useCallback(
    () =>
      buildSaveSnapshot({
        entryId: activeEntry?.id || initialEntry?.id || null,
        dateValue: date,
        contentValue: content,
        contentRichValue: contentRich,
        templateKeyValue: selectedTemplateKey || '',
      }),
    [activeEntry?.id, initialEntry?.id, date, content, contentRich, selectedTemplateKey]
  );

  const hasPersistableContent = useCallback(() => {
    const plain = `${content || ''}`.trim();
    const richAsPlain = richContentToPlainText(contentRich || '').trim();
    return Boolean(plain || richAsPlain);
  }, [content, contentRich]);

  const handleSave = useCallback(
    async ({ silent = false, force = false } = {}) => {
      if (isSaving) {
        return { ok: false, skipped: true };
      }

      const currentSnapshot = buildCurrentSnapshot();
      const targetEntry = activeEntry || initialEntry;
      if (!force && currentSnapshot === lastSavedSnapshotRef.current) {
        return { ok: true, skipped: true };
      }
      if (!targetEntry?.id && !hasPersistableContent()) {
        return { ok: true, skipped: true };
      }

      if (!silent) {
        setSaveError('');
      }

      if (!user) {
        if (!silent) {
          setSaveError(t('indlaeg.errors.mustBeLoggedIn', 'You must be logged in to save.'));
        }
        return { ok: false };
      }

      if (!clientId) {
        if (!silent) {
          setSaveError(
            t(
              'indlaeg.errors.missingClientId',
              'Missing client id — could not attach the entry to a client.'
            )
          );
        }
        return { ok: false };
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
        contentRich: contentRich || plainTextToRichContent(content),
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
        appointmentId: resolvedAppointmentId || null,
      };

      setIsSaving(true);

      try {
        const upsertRecentEntry = (entry) => {
          setRecentEntries((prev) => {
            const next = [entry, ...prev.filter((item) => item.id !== entry.id)];
            return next.slice(0, 10);
          });
        };

        let savedEntry = null;

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

          savedEntry = {
            id: targetEntry.id,
            ...entryPayload,
            createdAt: targetEntry.createdAt || targetEntry.createdAtIso || nowIso,
            createdAtIso: targetEntry.createdAtIso || targetEntry.createdAt || nowIso,
          };
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

          savedEntry = {
            id: docRef.id,
            ...entryPayload,
            createdAt: nowIso,
          };
        }

        setActiveEntry(savedEntry);
        upsertRecentEntry(savedEntry);

        lastSavedSnapshotRef.current = buildSaveSnapshot({
          entryId: savedEntry?.id || null,
          dateValue: savedEntry?.date || '',
          contentValue: savedEntry?.content || '',
          contentRichValue: savedEntry?.contentRich || '',
          templateKeyValue: savedEntry?.templateKey || '',
        });

        if (typeof onSave === 'function') {
          onSave(savedEntry);
        }

        return { ok: true, savedEntry };
      } catch (error) {
        console.error('Failed to save journal entry:', error);
        if (!silent) {
          setSaveError(t('indlaeg.errors.saveFailed', 'Could not save entry.'));
        }
        return { ok: false, error };
      } finally {
        setIsSaving(false);
      }
    },
    [
      isSaving,
      buildCurrentSnapshot,
      activeEntry,
      initialEntry,
      hasPersistableContent,
      user,
      clientId,
      selectedTemplate,
      clientName,
      date,
      t,
      content,
      contentRich,
      selectedTemplateKey,
      resolvedAppointmentId,
      onSave,
    ]
  );

  const handleManualSave = useCallback(() => {
    void handleSave({ force: true });
  }, [handleSave]);

  const handleCloseWithAutosave = useCallback(async () => {
    const saveResult = await handleSave({ silent: true });
    if (saveResult?.ok === false) return;
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [handleSave, onClose]);

  const handleGlobalButtonClickCapture = useCallback(
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button');
      if (!button || button.disabled) return;
      if (button.dataset.skipAutosave === 'true') return;
      void handleSave({ silent: true });
    },
    [handleSave]
  );

  useEffect(() => {
    if (isSaving) return undefined;
    const currentSnapshot = buildCurrentSnapshot();
    if (currentSnapshot === lastSavedSnapshotRef.current) return undefined;
    const timeoutId = setTimeout(() => {
      void handleSave({ silent: true });
    }, 1200);
    return () => clearTimeout(timeoutId);
  }, [isSaving, buildCurrentSnapshot, handleSave]);

  const templateSelectionLabel = useMemo(() => {
    if (selectedTemplate) {
      const translation = getTranslation(selectedTemplate.translations, templateLanguage);
      return translation?.name || selectedTemplate?.name || selectedTemplate?.key || '';
    }
    return selectedTemplateMeta?.name || '';
  }, [selectedTemplate, selectedTemplateMeta, templateLanguage]);

  const noteEditorStyle = manualNoteHeight
    ? { height: `${manualNoteHeight}px` }
    : expandedNoteHeight
    ? { height: `${expandedNoteHeight}px` }
    : undefined;

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
        id: 'redFlags',
        label: t('actions.redFlags', 'Red flags'),
        agentType: 'education',
        message: t(
          'prompts.redFlags',
          'Identificer mulige røde flag'
        ),
        displayMessage: t('prompts.redFlags', 'Identificer mulige røde flag'),
      },
      {
        id: 'missingInfo',
        label: t('actions.missingInfo', 'Missing info'),
        agentType: 'education',
        message: t(
          'prompts.missingInfo',
          'Find manglende information'
        ),
        displayMessage: t('prompts.missingInfo', 'Find manglende information'),
      },
      {
        id: 'objectiveTests',
        label: t('actions.objectiveTests', 'Objective tests'),
        agentType: 'education',
        message: t(
          'prompts.objectiveTests',
          'Foreslå relevante tests'
        ),
        displayMessage: t('prompts.objectiveTests', 'Foreslå relevante tests'),
      },
      {
        id: 'exerciseSuggestions',
        label: t('actions.exerciseSuggestions', 'Øvelsesforslag'),
        agentType: 'education',
        message: t(
          'prompts.exerciseSuggestions',
          'Foreslaa praecis 3 evidensbaserede ovelser tilpasset patientens kontekst. For hver ovelse: formaal, dosering, belastningstolerance og progression/regression. Hold hvert punkt meget kort og klinisk anvendeligt. Brug kun oplysninger fra notatet og generel klinisk viden. Ingen ekstern websoegning og ingen kilder.'
        ),
        displayMessage: t(
          'assistant.requestExerciseSuggestions',
          'Foreslå evidensbaseret øvelser'
        ),
      },
      {
        id: 'guidelines',
        label: t('actions.guidelines', 'Retningslinjer'),
        agentType: 'education',
        message: t(
          'prompts.guidelines',
          'What do current clinical practice guidelines recommend for this patient group (diagnosis/condition/load management)? Include cutoff values, recommended interventions, and any contraindications. Provide citations where possible.'
        ),
        displayMessage: t('assistant.requestGuidelines', 'Hent retningslinjer'),
      },
      {
        id: 'latestEvidence',
        label: t('actions.latestEvidence', 'Nyeste forskning'),
        agentType: 'education',
        message: t(
          'prompts.latestEvidence',
          'What does the most recent research (RCTs, systematic reviews, high-quality studies) show about interventions, outcomes, and mechanisms relevant to this patient group? Summarize key findings and effect sizes if available.'
        ),
        displayMessage: t('assistant.requestLatestEvidence', 'Hent nyeste forskning'),
      },
    ],
    [t]
  );

  return (
    <div className="indlæg-container" onClickCapture={handleGlobalButtonClickCapture}>
      <div className="indlæg-layout">
        <div className="indlæg-main-pane">
          <div className={`indlæg-content${isAssistantOpen ? ' indlæg-content--drawer-open' : ''}`}>
            <div className="indlæg-workspace">
              <aside className="indlæg-column indlæg-column--left">
                <div className="indlæg-header-actions">
                  <button
                    type="button"
                    className="indlæg-close-btn"
                    onClick={handleCloseWithAutosave}
                    data-skip-autosave="true"
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
                        onClick={async () => {
                          const saveResult = await handleSave({ silent: true });
                          if (saveResult?.ok === false) return;
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
                            setContentRich(
                              target.contentRich || plainTextToRichContent(target.content || '')
                            );
                            setNoteTextFormat('normal');
                          } else {
                            setActiveEntry(target);
                            setSelectedTemplateKey(target?.templateKey || '');
                            setDate(target?.date || initialDate || '');
                            const targetPlain = getEntryPlainContent(target);
                            setContent(targetPlain);
                            setContentRich(getEntryRichContent(target));
                            setNoteTextFormat('normal');
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
                            onClick={async () => {
                              const saveResult = await handleSave({ silent: true });
                              if (saveResult?.ok === false) return;
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
                                  contentRich,
                                  templateKey: selectedTemplateKey,
                                };
                              }
                              setActiveEntry(entry);
                              setSelectedTemplateKey(entry.templateKey || '');
                              setDate(entry.date || initialDate || '');
                              const entryPlain = getEntryPlainContent(entry);
                              setContent(entryPlain);
                              setContentRich(getEntryRichContent(entry));
                              setNoteTextFormat('normal');
                            }}
                          >
                            <div className="indlæg-history-item-main indlæg-history-item-main--date">
                              <span className="indlæg-history-date indlæg-history-date--only">
                                {formatDateOnly(entry.date)}
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
                    <div className="indlæg-card-header-actions">
                      <div
                        className="indlæg-note-style-controls indlæg-note-style-controls--header"
                        role="group"
                        aria-label={t('indlaeg.textStyle', 'Text style')}
                      >
                        <button
                          type="button"
                          className={`indlæg-note-style-btn${noteTextFormat === 'normal' ? ' is-active' : ''}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleApplyNoteTextFormat('normal')}
                          aria-pressed={noteTextFormat === 'normal'}
                        >
                          {t('indlaeg.textNormal', 'Normal')}
                        </button>
                        <button
                          type="button"
                          className={`indlæg-note-style-btn indlæg-note-style-btn--bold${noteTextFormat === 'bold' ? ' is-active' : ''}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleApplyNoteTextFormat('bold')}
                          aria-pressed={noteTextFormat === 'bold'}
                        >
                          {t('indlaeg.textBold', 'Bold')}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="indlæg-action-btn"
                        onClick={handleCopyJournal}
                        aria-live="polite"
                      >
                        {copyStatus === 'copied'
                          ? t('indlaeg.copiedEntry', 'Copied')
                          : t('indlaeg.copyEntry', 'Copy journal')}
                      </button>
                      <button
                        type="button"
                        className="indlæg-action-btn"
                        onClick={handleManualSave}
                        data-skip-autosave="true"
                        disabled={isSaving}
                        aria-busy={isSaving}
                      >
                        {isSaving
                          ? t('indlaeg.saving', 'Saving...')
                          : t('indlaeg.saveEntry', 'Save entry')}
                      </button>
                    </div>
                  </div>
                  <div className="indlæg-card-body indlæg-note-area">
                    <div
                      className="indlæg-textarea indlæg-textarea--lg indlæg-rich-textarea"
                      ref={noteTextareaRef}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      data-placeholder={t(
                        'indlaeg.generatedNotePlaceholder',
                        'The generated note appears here. You can edit freely.'
                      )}
                      onInput={syncNoteContentFromEditor}
                      onFocus={refreshNoteTextFormat}
                      onKeyUp={refreshNoteTextFormat}
                      onMouseUp={refreshNoteTextFormat}
                      onPointerDown={handleTextareaPointerDown}
                      onPointerUp={handleTextareaPointerUp}
                      style={noteEditorStyle}
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
                    {transcribeMode !== MODE_NONE ? (
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
                    ) : null}
                    <div className="indlæg-card-body">
                      {transcribeMode === MODE_NONE && (
                        <p className="indlæg-muted">
                          {t('indlaeg.chooseMode', 'Choose a mode to record or transcribe.')}
                        </p>
                      )}

                      {transcribeMode === MODE_NONE && (
                        <div className="indlæg-selma-launch indlæg-selma-launch--after-hint">
                          <AnimatedGenerateButton
                            type="button"
                            className="indlæg-selma-btn w-full"
                            labelIdle="Selma"
                            labelActive="Selma"
                            onClick={handleOpenAssistant}
                            disabled={isAssistantOpen}
                          >
                          </AnimatedGenerateButton>
                        </div>
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
                        <div className="indlæg-selma-launch indlæg-selma-launch--after-hint">
                          <AnimatedGenerateButton
                            type="button"
                            className="indlæg-selma-btn w-full"
                            labelIdle="Selma"
                            labelActive="Selma"
                            onClick={handleOpenAssistant}
                            disabled={isAssistantOpen}
                          >
                          </AnimatedGenerateButton>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
          {isAssistantOpen && (
            <div className="indlæg-assistant-drawer">
              <div className="indlæg-drawer-header">
                <h3 className="indlæg-card-title">
                  {t('indlaeg.assistantTitle', 'Selma Assistant')}
                </h3>
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
                chatAvatars={CHAT_AVATARS}
                placeholder={t(
                  'indlaeg.assistantPlaceholder',
                  'Ask Selma assistant a question...'
                )}
                onClose={() => setIsAssistantOpen(false)}
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
