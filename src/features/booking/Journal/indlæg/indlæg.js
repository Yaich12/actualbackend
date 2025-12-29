import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import './indlæg.css';
import Whisper from './whisper';
import Prompt from './prompt';
import FactsRPanel from './FactsRPanel';
import { useFactsRStream } from './useFactsRStream';
import { Component as AiAssistantCard } from '../../../../components/ui/ai-assistant-card';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

const PROJECT_ID = process.env.REACT_APP_PROJECT_ID || '';
const FUNCTION_REGION = process.env.REACT_APP_FUNCTION_REGION || 'us-central1';
const FUNCTIONS_PORT = process.env.REACT_APP_FUNCTIONS_PORT || '5601';

const buildDefaultTranscribeUrl = () => {
  if (!PROJECT_ID) {
    return '';
  }

  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    return `http://127.0.0.1:${FUNCTIONS_PORT}/${PROJECT_ID}/${FUNCTION_REGION}/transcribe_audio`;
  }

  return `https://${FUNCTION_REGION}-${PROJECT_ID}.cloudfunctions.net/transcribe_audio`;
};

const TRANSCRIBE_FUNCTION_URL =
  process.env.REACT_APP_TRANSCRIBE_URL || buildDefaultTranscribeUrl();

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

const ANAMNESIS_TEMPLATES = {
  first: {
    subjective: '- Hovedklage\n- Debut\n- Forvaerrende/lindrende',
    objective: '- Objektive fund\n- Relevante tests',
    assessment: '- Vurdering\n- Hypoteser',
    plan: '- Plan\n- Naeste skridt',
  },
  follow_up: {
    subjective: '- Status siden sidst\n- Aendringer i symptomer',
    objective: '- Nye fund\n- Progression',
    assessment: '- Vurdering af udvikling',
    plan: '- Justeret plan\n- Naeste skridt',
  },
};

const normalizeBullet = (value) =>
  String(value || '')
    .replace(/^[-•\s]+/, '')
    .trim();

const toBulletItems = (text) =>
  String(text || '')
    .split(/\r?\n+/)
    .map((line) => normalizeBullet(line))
    .filter(Boolean);

const appendBulletsDedup = (currentText, items) => {
  const existingItems = toBulletItems(currentText);
  const incomingItems = Array.isArray(items) ? items : toBulletItems(items);
  const seen = new Set(existingItems.map((item) => item.toLowerCase()));
  const merged = [...existingItems];

  incomingItems.forEach((item) => {
    const normalized = normalizeBullet(item);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  });

  return merged.map((item) => `- ${item}`).join('\n');
};

const FACTSR_SAMPLE_RATE = 16000;

const resampleBuffer = (input, inputRate, outputRate) => {
  if (inputRate === outputRate) {
    return input;
  }

  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, input.length - 1);
    const blend = position - leftIndex;
    output[i] = input[leftIndex] + (input[rightIndex] - input[leftIndex]) * blend;
  }

  return output;
};

const float32ToPcm16 = (input) => {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < input.length; i += 1) {
    let sample = Math.max(-1, Math.min(1, input[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, sample, true);
  }

  return buffer;
};

const toPcm16Buffer = (input, inputRate) => {
  const resampled = resampleBuffer(input, inputRate, FACTSR_SAMPLE_RATE);
  return float32ToPcm16(resampled);
};

function Indlæg({
  clientId,
  clientName,
  onClose,
  onSave,
  onOpenEntry,
  participants = [],
  initialDate = '',
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('14-11-2025');
  const [isPrivate, setIsPrivate] = useState(false);
  const [content, setContent] = useState('');
  const [consultationType, setConsultationType] = useState('first');
  const [anamnesisSections, setAnamnesisSections] = useState(() => ({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  }));
  const [conclusionFocusAreas, setConclusionFocusAreas] = useState('');
  const [conclusionSessionContent, setConclusionSessionContent] = useState('');
  const [conclusionTasksNext, setConclusionTasksNext] = useState('');
  const [conclusionReflection, setConclusionReflection] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [dictationStatus, setDictationStatus] = useState('');
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const [isDictating, setIsDictating] = useState(false);
  const [highlightField, setHighlightField] = useState('');
  const [factsInsertTarget, setFactsInsertTarget] = useState('auto');
  const [factsRecordingStatus, setFactsRecordingStatus] = useState('');
  const [isFactsRecording, setIsFactsRecording] = useState(false);

  // NYT: state til seneste sessioner
  const [recentEntries, setRecentEntries] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const factsMediaStreamRef = useRef(null);
  const factsAudioContextRef = useRef(null);
  const factsProcessorRef = useRef(null);
  const factsSourceRef = useRef(null);
  const factsSilenceRef = useRef(null);
  const anamnesisSubjectiveRef = useRef(null);
  const anamnesisObjectiveRef = useRef(null);
  const anamnesisAssessmentRef = useRef(null);
  const anamnesisPlanRef = useRef(null);
  const conclusionFocusRef = useRef(null);
  const conclusionContentRef = useRef(null);
  const conclusionTasksRef = useRef(null);
  const conclusionReflectionRef = useRef(null);
  const combinedRef = useRef(null);

  const { user } = useAuth();
  const {
    status: factsStatus,
    interactionId: factsInteractionId,
    error: factsError,
    transcripts: factsTranscripts,
    facts: factsItems,
    start: startFactsStream,
    sendAudio: sendFactsAudio,
    flush: flushFactsStream,
    end: endFactsStream,
    clear: clearFactsStream,
  } = useFactsRStream();

  const activeAnamnesisTemplate = useMemo(() => {
    return ANAMNESIS_TEMPLATES[consultationType] || ANAMNESIS_TEMPLATES.first;
  }, [consultationType]);

  const anamnesisContent = useMemo(() => {
    const sections = [
      ['Subjektivt', anamnesisSections.subjective],
      ['Objektivt', anamnesisSections.objective],
      ['Vurdering', anamnesisSections.assessment],
      ['Plan', anamnesisSections.plan],
    ];

    return sections
      .filter(([, value]) => value && value.trim())
      .map(([label, value]) => `${label}:\n${value.trim()}`)
      .join('\n\n');
  }, [anamnesisSections]);

  const konklusionSuggestions = useMemo(() => {
    const subjectiveItems = toBulletItems(anamnesisSections.subjective);
    const objectiveItems = toBulletItems(anamnesisSections.objective);
    const assessmentItems = toBulletItems(anamnesisSections.assessment);
    const planItems = toBulletItems(anamnesisSections.plan);

    return {
      focusAreas: subjectiveItems.slice(0, 6),
      sessionContent: objectiveItems.slice(0, 6),
      tasksNext: planItems.slice(0, 6),
      reflection: assessmentItems.slice(0, 6),
    };
  }, [anamnesisSections]);

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
    }
  }, [initialDate]);

  const flashHighlight = (field) => {
    setHighlightField(field);
    window.setTimeout(() => setHighlightField(''), 1200);
  };

  const handleInsertTemplate = () => {
    setAnamnesisSections((current) => ({
      subjective: current.subjective || activeAnamnesisTemplate.subjective,
      objective: current.objective || activeAnamnesisTemplate.objective,
      assessment: current.assessment || activeAnamnesisTemplate.assessment,
      plan: current.plan || activeAnamnesisTemplate.plan,
    }));
    flashHighlight('anamnesis_subjective');
  };

  const insertIntoJournal = (text, mode = 'append') => {
    if (!text) return;

    if (mode === 'replace') {
      setContent(text);
    } else {
      setContent((current) => (current ? `${current}\n${text}` : text));
    }

    flashHighlight('combined');
  };

  const handleMikrofonClick = () => {
    if (isDictating) {
      stopDictation();
      return;
    }
    startDictation();
  };

  const suggestionForFact = useCallback((fact) => {
    const group = (fact?.group || fact?.type || '').toLowerCase();

    if (group.includes('objective') || group.includes('objektiv') || group.includes('fund')) {
      return { key: 'anamnesis_objective', label: 'Objektivt' };
    }
    if (group.includes('assessment') || group.includes('vurdering')) {
      return { key: 'anamnesis_assessment', label: 'Vurdering' };
    }
    if (group.includes('plan') || group.includes('anbefaling')) {
      return { key: 'anamnesis_plan', label: 'Plan' };
    }
    if (group.includes('reflection') || group.includes('refleksion')) {
      return { key: 'conclusion_reflection', label: 'Refleksion' };
    }

    return { key: 'anamnesis_subjective', label: 'Subjektivt' };
  }, []);

  const insertFactText = useCallback(
    (text, targetKey) => {
      const safeText = String(text || '').trim();
      if (!safeText) return;

      const target = targetKey || 'anamnesis_subjective';

      if (target === 'combined') {
        insertIntoJournal(safeText, 'append');
        return;
      }

      if (target === 'conclusion_focus') {
        setConclusionFocusAreas((current) => appendBulletsDedup(current, safeText));
        flashHighlight('conclusion_focus');
        return;
      }
      if (target === 'conclusion_content') {
        setConclusionSessionContent((current) => appendBulletsDedup(current, safeText));
        flashHighlight('conclusion_content');
        return;
      }
      if (target === 'conclusion_tasks') {
        setConclusionTasksNext((current) => appendBulletsDedup(current, safeText));
        flashHighlight('conclusion_tasks');
        return;
      }
      if (target === 'conclusion_reflection') {
        setConclusionReflection((current) => appendBulletsDedup(current, safeText));
        flashHighlight('conclusion_reflection');
        return;
      }

      if (target === 'anamnesis_objective') {
        setAnamnesisSections((current) => ({
          ...current,
          objective: appendBulletsDedup(current.objective, safeText),
        }));
        flashHighlight('anamnesis_objective');
        return;
      }
      if (target === 'anamnesis_assessment') {
        setAnamnesisSections((current) => ({
          ...current,
          assessment: appendBulletsDedup(current.assessment, safeText),
        }));
        flashHighlight('anamnesis_assessment');
        return;
      }
      if (target === 'anamnesis_plan') {
        setAnamnesisSections((current) => ({
          ...current,
          plan: appendBulletsDedup(current.plan, safeText),
        }));
        flashHighlight('anamnesis_plan');
        return;
      }

      setAnamnesisSections((current) => ({
        ...current,
        subjective: appendBulletsDedup(current.subjective, safeText),
      }));
      flashHighlight('anamnesis_subjective');
    },
    [flashHighlight, insertIntoJournal]
  );

  const insertFactsList = useCallback(
    (texts, target) => {
      if (!Array.isArray(texts) || texts.length === 0) return;
      const resolvedTarget = target === 'auto' ? 'anamnesis_subjective' : target;
      texts.forEach((text) => insertFactText(text, resolvedTarget));
    },
    [insertFactText]
  );

  const handleInsertAllFacts = useCallback(
    (texts) => {
      if (factsInsertTarget === 'auto') {
        (factsItems || [])
          .filter((fact) => fact && !fact.isDiscarded)
          .forEach((fact) => {
            const suggestion = suggestionForFact(fact);
            insertFactText(fact.text, suggestion?.key);
          });
        return;
      }

      insertFactsList(texts, factsInsertTarget);
    },
    [factsInsertTarget, factsItems, insertFactText, insertFactsList, suggestionForFact]
  );

  const handleInsertSelectedFacts = useCallback(
    (texts) => {
      insertFactsList(texts, factsInsertTarget);
    },
    [factsInsertTarget, insertFactsList]
  );

  const handleInsertOneFact = useCallback(
    (text, targetKey) => {
      const resolvedTarget =
        targetKey || (factsInsertTarget === 'auto' ? 'anamnesis_subjective' : factsInsertTarget);
      insertFactText(text, resolvedTarget);
    },
    [factsInsertTarget, insertFactText]
  );

  const cleanupFactsAudio = useCallback(() => {
    if (factsProcessorRef.current) {
      factsProcessorRef.current.disconnect();
      factsProcessorRef.current.onaudioprocess = null;
    }
    if (factsSourceRef.current) {
      factsSourceRef.current.disconnect();
    }
    if (factsSilenceRef.current) {
      factsSilenceRef.current.disconnect();
    }
    if (factsMediaStreamRef.current) {
      factsMediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (factsAudioContextRef.current && factsAudioContextRef.current.state !== 'closed') {
      factsAudioContextRef.current.close();
    }

    factsProcessorRef.current = null;
    factsSourceRef.current = null;
    factsSilenceRef.current = null;
    factsMediaStreamRef.current = null;
    factsAudioContextRef.current = null;

    setIsFactsRecording(false);
  }, []);

  const startFactsRRecording = useCallback(async () => {
    if (isFactsRecording) return;

    if (!navigator.mediaDevices || typeof window === 'undefined') {
      setFactsRecordingStatus('Din browser understotter ikke FactsR optagelse.');
      return;
    }

    try {
      setFactsRecordingStatus('Starter FactsR...');
      await startFactsStream({
        primaryLanguage: 'da',
        outputLocale: 'da',
        encounterIdentifier: clientId ? `journal-${clientId}-${Date.now()}` : `journal-${Date.now()}`,
        title: clientName ? `Journal: ${clientName}` : 'Journal session',
      });

      if (isDictating) {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
        }
        setIsDictating(false);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      factsMediaStreamRef.current = stream;

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextCtor({ sampleRate: FACTSR_SAMPLE_RATE });
      factsAudioContextRef.current = audioContext;
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      factsSourceRef.current = source;
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      factsProcessorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!factsAudioContextRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        const buffer = toPcm16Buffer(input, audioContext.sampleRate || FACTSR_SAMPLE_RATE);
        sendFactsAudio(buffer);
      };

      const silence = audioContext.createGain();
      silence.gain.value = 0;
      factsSilenceRef.current = silence;

      source.connect(processor);
      processor.connect(silence);
      silence.connect(audioContext.destination);

      setIsFactsRecording(true);
      setFactsRecordingStatus('Optager...');
    } catch (error) {
      console.error('FactsR start error:', error);
      setFactsRecordingStatus('Kunne ikke starte FactsR.');
      cleanupFactsAudio();
      clearFactsStream();
    }
  }, [
    cleanupFactsAudio,
    clearFactsStream,
    clientId,
    clientName,
    isDictating,
    isFactsRecording,
    sendFactsAudio,
    startFactsStream,
  ]);

  const stopFactsRRecording = useCallback(() => {
    if (!isFactsRecording) return;
    endFactsStream();
    cleanupFactsAudio();
    setFactsRecordingStatus('');
  }, [cleanupFactsAudio, endFactsStream, isFactsRecording]);

  const handleToggleFactsR = useCallback(() => {
    if (isFactsRecording) {
      stopFactsRRecording();
      return;
    }
    startFactsRRecording();
  }, [isFactsRecording, startFactsRRecording, stopFactsRRecording]);

  const handleClearFactsR = useCallback(() => {
    stopFactsRRecording();
    clearFactsStream();
    setFactsRecordingStatus('');
  }, [clearFactsStream, stopFactsRRecording]);

  useEffect(() => {
    if (!isFactsRecording) return;

    if (factsStatus === 'connecting') {
      setFactsRecordingStatus('Forbinder...');
    } else if (factsStatus === 'streaming') {
      setFactsRecordingStatus('Live optagelse');
    } else if (factsStatus === 'finalizing') {
      setFactsRecordingStatus('Afslutter...');
    } else if (factsStatus === 'ended') {
      setFactsRecordingStatus('Afsluttet');
      cleanupFactsAudio();
    } else if (factsStatus === 'error') {
      setFactsRecordingStatus('Fejl i FactsR');
      cleanupFactsAudio();
    }
  }, [cleanupFactsAudio, factsStatus, isFactsRecording]);

  useEffect(() => {
    return () => {
      cleanupFactsAudio();
      clearFactsStream();
    };
  }, [cleanupFactsAudio, clearFactsStream]);

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

    const entryPayload = {
      title: title.trim(),
      date,
      content,
      consultationType,
      // New structure
      anamnesisContent,
      conclusion: {
        focusAreas: conclusionFocusAreas,
        sessionContent: conclusionSessionContent,
        tasksNext: conclusionTasksNext,
        reflection: conclusionReflection,
      },
      // Legacy fields kept for backwards compatibility (optional)
      subjectiveContent: anamnesisContent,
      objectiveContent: '',
      planContent: conclusionTasksNext,
      summaryContent: conclusionReflection,
      isPrivate,
      isStarred: false,
      isLocked: false,
      clientName,
      clientId,
      searchQuery,
      ownerUid: user.uid,
      ownerEmail: user.email ?? null,
      ownerIdentifier,
      createdAtIso: nowIso,
    };

    setIsSaving(true);

    try {
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
    } catch (error) {
      console.error('Failed to save journal entry:', error);
      setSaveError('Kunne ikke gemme indlægget. Prøv igen senere.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFile = () => {
    console.log('Add journal file');
  };

  const handleUpload = () => {
    console.log('Upload');
  };

  const handlePrint = () => {
    console.log('Print');
  };

  const formatTranscriptAsAnamnesis = (text, facts) => {
    // If Corti facts are available, prefer them for structure.
    if (facts && typeof facts === 'object') {
      const subj = [];
      const obj = [];
      const plan = [];

      if (facts.chief_complaint) subj.push(`- CC: ${facts.chief_complaint}`);
      if (facts.onset) subj.push(`- Debut: ${facts.onset}`);
      if (facts.location) subj.push(`- Lokation: ${facts.location}`);
      if (facts.severity) subj.push(`- Sværhedsgrad: ${facts.severity}`);
      if (facts.modulating_factors) subj.push(`- Lindrende/forværrende: ${facts.modulating_factors}`);

      if (facts.objective_findings) obj.push(`- Fund: ${facts.objective_findings}`);
      if (facts.red_flags) obj.push(`- Red flags: ${facts.red_flags}`);

      if (facts.plan) plan.push(`- Plan: ${facts.plan}`);
      if (facts.recommendations) plan.push(`- Anbefalinger: ${facts.recommendations}`);

      return [
        'Anamnese (fys/kiro):',
        '',
        'Subjektivt:',
        subj.length ? subj.join('\n') : '- (CC, debut, lokation, sværhedsgrad, lindrende/forværrende)',
        '',
        'Objektivt:',
        obj.length ? obj.join('\n') : '- (ROM, smerteprovokation, neurofund, palpation)',
        '',
        'Vurdering/plan:',
        plan.length ? plan.join('\n') : '- (tentativ vurdering og næste skridt)',
      ].join('\n');
    }

    // Fallback: bulletize plain text.
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';

    const fragments = cleaned
      .split(/[.!?]\s+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((p) => `- ${p}`);

    const subjektivt =
      fragments.length > 0
        ? fragments.join('\n')
        : '- (kort hovedklage, debut, forværrende/lindrende)';

    return [
      'Anamnese (fys/kiro):',
      '',
      'Subjektivt:',
      subjektivt,
      '',
      'Objektivt:',
      '- (ROM, smerteprovokation, neurofund, palpation)',
      '',
      'Vurdering/plan:',
      '- (tentativ vurdering og næste skridt)',
    ].join('\n');
  };

  // Enhanced formatter that returns structured sections
  const formatTranscriptStructured = (text, facts) => {
    if (facts && typeof facts === 'object') {
      const subj = [];
      const obj = [];
      const plan = [];
      const summary = [];

      if (facts.chief_complaint) subj.push(`- CC: ${facts.chief_complaint}`);
      if (facts.onset) subj.push(`- Debut: ${facts.onset}`);
      if (facts.location) subj.push(`- Lokation: ${facts.location}`);
      if (facts.severity) subj.push(`- Sværhedsgrad: ${facts.severity}`);
      if (facts.modulating_factors) subj.push(`- Lindrende/forværende: ${facts.modulating_factors}`);

      if (facts.objective_findings) obj.push(`- Fund: ${facts.objective_findings}`);
      if (facts.red_flags) obj.push(`- RED FLAG: ${facts.red_flags}`);

      if (facts.plan) plan.push(`- Plan: ${facts.plan}`);
      if (facts.recommendations) plan.push(`- Anbefalinger: ${facts.recommendations}`);

      if (subj.length) summary.push(subj[0].replace(/^- /, ''));
      if (obj.length) summary.push(obj[0].replace(/^- /, ''));
      if (plan.length) summary.push(plan[0].replace(/^- /, ''));

      return {
        subjective: subj.length ? subj.join('\n') : '- (CC, debut, lokation, sværhedsgrad, lindrende/forværende)',
        objective: obj.length ? obj.join('\n') : '- (ROM, smerteprovokation, neurofund, palpation)',
        plan: plan.length ? plan.join('\n') : '- (tentativ vurdering og næste skridt)',
        summary: summary.slice(0, 3).join(' · '),
      };
    }

    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return null;

    const fragments = cleaned
      .split(/[.!?]\s+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((p) => `- ${p}`);

    const subjektivt =
      fragments.length > 0
        ? fragments.join('\n')
        : '- (kort hovedklage, debut, forværende/lindrende)';

    return {
      subjective: subjektivt,
      objective: '- (ROM, smerteprovokation, neurofund, palpation)',
      plan: '- (tentativ vurdering og næste skridt)',
      summary: fragments.slice(0, 2).map((f) => f.replace(/^- /, '')).join(' · '),
    };
  };

  const appendContentFromExternalSource = (incomingText, facts) => {
    if (typeof incomingText !== 'string' || !incomingText.trim()) {
      return;
    }

    const formatted = formatTranscriptStructured(incomingText, facts);
    if (!formatted) return;

    // New journal structure mapping:
    // - subjective/objective facts → Anamnese
    // - plan → Opgaver til næste gang
    // - summary → Refleksion (kort)
    setAnamnesisSections((current) => {
      const next = { ...current };
      if (formatted.subjective) {
        const items = toBulletItems(formatted.subjective);
        next.subjective = appendBulletsDedup(current.subjective, items);
      }
      if (formatted.objective) {
        const items = toBulletItems(formatted.objective);
        next.objective = appendBulletsDedup(current.objective, items);
      }
      if (formatted.plan) {
        // If plan is included in dictation, it often maps to next visit tasks;
        // we still keep the editor's conclusion tasks field as the source of truth.
        const items = toBulletItems(formatted.plan);
        next.plan = appendBulletsDedup(current.plan, items);
      }
      return next;
    });
    if (formatted.plan) {
      setConclusionTasksNext((current) => (current ? `${current}\n\n${formatted.plan}` : formatted.plan));
    }
    if (formatted.summary) {
      setConclusionReflection((current) => (current ? `${current}\n${formatted.summary}` : formatted.summary));
    }
  };

  const startDictation = async () => {
    try {
      if (!navigator.mediaDevices || typeof window.MediaRecorder === 'undefined') {
        setDictationStatus('Din browser understøtter ikke diktering.');
        return;
      }

      if (!TRANSCRIBE_FUNCTION_URL) {
        setDictationStatus('Manglende transskriptions-endpoint.');
        return;
      }

      setDictationStatus('Starter mikrofon...');
      setTranscriptionResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setDictationStatus('Forbereder lyd...');
          await transcribeRecording(blob);
        } catch (error) {
          console.error('Transcription error:', error);
          setDictationStatus('Fejl under transskription.');
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        }
      };

      mediaRecorder.start();
      setIsDictating(true);
      setDictationStatus('Lytter....');
    } catch (error) {
      console.error('Microphone error:', error);
      setDictationStatus('Kunne ikke få adgang til mikrofonen.');
      setIsDictating(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const transcribeRecording = async (audioBlob) => {
    if (!TRANSCRIBE_FUNCTION_URL) {
      setDictationStatus('Manglende transskriptions-endpoint.');
      return;
    }

    setDictationStatus('Genererer tekst...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('response_format', 'text');

    try {
      const response = await fetch(TRANSCRIBE_FUNCTION_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(`Server ${response.status}: ${errorMessage}`);
      }

      const responseBody = await response.text();
      console.log('Transcribe response:', responseBody);

      let parsedResult = null;
      if (responseBody?.trim()) {
        try {
          parsedResult = JSON.parse(responseBody);
        } catch (jsonError) {
          parsedResult = { text: responseBody.trim() };
        }
      }

      if (parsedResult) {
        setTranscriptionResult(parsedResult);
        if (parsedResult.text) {
          appendContentFromExternalSource(parsedResult.text);
        }
        setDictationStatus('Transskription modtaget.');
      } else {
        setDictationStatus('Kunne ikke læse nogen tekst fra svaret.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setDictationStatus('Fejl under transskription.');
    }
  };

  const stopDictation = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setDictationStatus('Stopper optagelse...');
    }
    setIsDictating(false);
  };

  return (
    <div className="indlæg-container">
      <div className="indlæg-layout">
        <div className="indlæg-main-pane">
      {/* Header */}
      <div className="indlæg-header">
        <div className="indlæg-header-top">
          <h2 className="indlæg-title">Journal for {clientName}</h2>
        </div>

        {/* NYT: Seneste sessioner */}
        <div className="indlæg-history">
          <div className="indlæg-history-header">
                <button
                  type="button"
                  className="indlæg-history-toggle"
                  onClick={() => setIsHistoryOpen((open) => !open)}
                  aria-expanded={isHistoryOpen}
                >
            <span className="indlæg-label">Seneste sessioner</span>
                  <span className="indlæg-history-chevron">
                    {isHistoryOpen ? '▾' : '▸'}
                  </span>
                </button>
          </div>

              {isHistoryOpen && (
                <>
          {isLoadingHistory && (
            <p className="indlæg-history-status">Henter seneste sessioner...</p>
          )}

          {historyError && !isLoadingHistory && (
            <p className="indlæg-history-error">{historyError}</p>
          )}

                  {!isLoadingHistory &&
                    !historyError &&
                    recentEntries.length === 0 && (
            <p className="indlæg-history-empty">
              Ingen tidligere sessioner for denne borger endnu.
            </p>
          )}

                  {!isLoadingHistory &&
                    !historyError &&
                    recentEntries.length > 0 && (
            <ul className="indlæg-history-list">
              {recentEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="indlæg-history-item"
                  onClick={() => onOpenEntry && onOpenEntry(entry)}
                >
                  <div className="indlæg-history-item-main">
                    <span className="indlæg-history-title">
                      {entry.title || 'Uden titel'}
                    </span>
                    {entry.date && (
                      <span className="indlæg-history-date">
                        {entry.date}
                      </span>
                    )}
                  </div>
                  {entry.content && (
                    <p className="indlæg-history-snippet">
                      {String(entry.content).slice(0, 120)}
                      {String(entry.content).length > 120 ? '…' : ''}
                    </p>
                  )}
                  <span className="indlæg-history-link">Åbn session</span>
                </li>
              ))}
            </ul>
                    )}
                </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="indlæg-content">
        <div className="indlæg-workspace">
          <div className="indlæg-main">
        {/* Title and Date Section */}
        <div className="indlæg-form-section">
          <div className="indlæg-form-row">
            <div className="indlæg-form-group">
              <label className="indlæg-label">Dato</label>
              <input
                type="text"
                className="indlæg-input indlæg-date-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="dd-mm-yyyy"
              />
            </div>
          </div>
        </div>

        <div className="indlæg-form-section">
          <div className="indlæg-form-row">
            <div className="indlæg-form-group">
              <label className="indlæg-label">Konsultationstype</label>
              <select
                className="indlæg-input"
                value={consultationType}
                onChange={(e) => setConsultationType(e.target.value)}
              >
                <option value="first">Første konsultation</option>
                <option value="follow_up">Efterfølgende</option>
              </select>
            </div>
            <div className="indlæg-form-group">
              <label className="indlæg-label">Skabelon</label>
              <button type="button" className="indlæg-action-btn" onClick={handleInsertTemplate}>
                Indsæt skabelon
              </button>
            </div>
          </div>
        </div>

        {/* Private Journal Toggle */}
        <div className="indlæg-form-section">
          <div className="indlæg-toggle-group">
            <label className="indlæg-toggle-label">
              <input
                type="checkbox"
                className="indlæg-toggle-input"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span className="indlæg-toggle-slider"></span>
            </label>
            <div className="indlæg-toggle-text-group">
              <span className="indlæg-label">Privat journal</span>
              <button className="indlæg-help-btn" title="Hjælp">
                ?
              </button>
            </div>
          </div>
        </div>

        {/* Anamnese / Journal */}
        <div className="indlæg-section-title">Anamnese / Journal</div>

        <div className="indlæg-form-section">
          <label className="indlæg-label">Anamnese</label>
          <div className="indlæg-anamneseGrid" aria-label="Anamnese sektioner">
            <div className="indlæg-anamneseCard">
              <div className="indlæg-anamneseHeading">Subjektivt</div>
              <textarea
                className={`indlæg-textarea indlæg-textarea--md${
                  highlightField === 'anamnesis_subjective' ? ' indlæg-highlight' : ''
                }`}
                ref={anamnesisSubjectiveRef}
                rows={6}
                value={anamnesisSections.subjective}
                onChange={(e) =>
                  setAnamnesisSections((cur) => ({ ...cur, subjective: e.target.value }))
                }
                placeholder={activeAnamnesisTemplate.subjective || ''}
              />
            </div>

            <div className="indlæg-anamneseCard">
              <div className="indlæg-anamneseHeading">Objektivt</div>
              <textarea
                className={`indlæg-textarea indlæg-textarea--md${
                  highlightField === 'anamnesis_objective' ? ' indlæg-highlight' : ''
                }`}
                ref={anamnesisObjectiveRef}
                rows={6}
                value={anamnesisSections.objective}
                onChange={(e) =>
                  setAnamnesisSections((cur) => ({ ...cur, objective: e.target.value }))
                }
                placeholder={activeAnamnesisTemplate.objective || ''}
              />
            </div>

            <div className="indlæg-anamneseCard">
              <div className="indlæg-anamneseHeading">Vurdering</div>
              <textarea
                className={`indlæg-textarea indlæg-textarea--md${
                  highlightField === 'anamnesis_assessment' ? ' indlæg-highlight' : ''
                }`}
                ref={anamnesisAssessmentRef}
                rows={6}
                value={anamnesisSections.assessment}
                onChange={(e) =>
                  setAnamnesisSections((cur) => ({ ...cur, assessment: e.target.value }))
                }
                placeholder={activeAnamnesisTemplate.assessment || ''}
              />
            </div>

            <div className="indlæg-anamneseCard">
              <div className="indlæg-anamneseHeading">Plan</div>
              <textarea
                className={`indlæg-textarea indlæg-textarea--md${
                  highlightField === 'anamnesis_plan' ? ' indlæg-highlight' : ''
                }`}
                ref={anamnesisPlanRef}
                rows={6}
                value={anamnesisSections.plan}
                onChange={(e) => setAnamnesisSections((cur) => ({ ...cur, plan: e.target.value }))}
                placeholder={activeAnamnesisTemplate.plan || ''}
              />
            </div>
          </div>
        </div>

        <div className="indlæg-form-section">
          <label className="indlæg-label">Konklusion af sessionen</label>
          <div className="indlæg-subgrid">
            <div className="indlæg-subfield">
              <label className="indlæg-sublabel">Fokusområder</label>
              {konklusionSuggestions.focusAreas?.length ? (
                <div className="indlæg-suggestions" aria-label="Forslag til fokusområder">
                  <div className="indlæg-suggestionsTitle">Forslag fra anamnesen:</div>
                  <div className="indlæg-suggestionsChips">
                    {konklusionSuggestions.focusAreas.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="indlæg-suggestionChip"
                        onClick={() => setConclusionFocusAreas((cur) => appendBulletsDedup(cur, s))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <textarea
                className={`indlæg-textarea${highlightField === 'conclusion_focus' ? ' indlæg-highlight' : ''}`}
                ref={conclusionFocusRef}
                rows={3}
                value={conclusionFocusAreas}
                onChange={(e) => setConclusionFocusAreas(e.target.value)}
                placeholder="Hvad var fokus i sessionen?"
              />
            </div>
            <div className="indlæg-subfield">
              <label className="indlæg-sublabel">Sessionens indhold</label>
              {konklusionSuggestions.sessionContent?.length ? (
                <div className="indlæg-suggestions" aria-label="Forslag til sessionens indhold">
                  <div className="indlæg-suggestionsTitle">Forslag fra anamnesen:</div>
                  <div className="indlæg-suggestionsChips">
                    {konklusionSuggestions.sessionContent.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="indlæg-suggestionChip"
                        onClick={() => setConclusionSessionContent((cur) => appendBulletsDedup(cur, s))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <textarea
                className={`indlæg-textarea${highlightField === 'conclusion_content' ? ' indlæg-highlight' : ''}`}
                ref={conclusionContentRef}
                rows={3}
                value={conclusionSessionContent}
                onChange={(e) => setConclusionSessionContent(e.target.value)}
                placeholder="Kort opsummering af hvad der blev gjort/besluttet."
              />
            </div>
            <div className="indlæg-subfield">
              <label className="indlæg-sublabel">Opgaver til næste gang</label>
              {konklusionSuggestions.tasksNext?.length ? (
                <div className="indlæg-suggestions" aria-label="Forslag til opgaver">
                  <div className="indlæg-suggestionsTitle">Forslag fra anamnesen:</div>
                  <div className="indlæg-suggestionsChips">
                    {konklusionSuggestions.tasksNext.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="indlæg-suggestionChip"
                        onClick={() => setConclusionTasksNext((cur) => appendBulletsDedup(cur, s))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <textarea
                className={`indlæg-textarea${highlightField === 'conclusion_tasks' ? ' indlæg-highlight' : ''}`}
                ref={conclusionTasksRef}
                rows={3}
                value={conclusionTasksNext}
                onChange={(e) => setConclusionTasksNext(e.target.value)}
                placeholder="Hjemmeøvelser, aftaler, næste skridt."
              />
            </div>
            <div className="indlæg-subfield">
              <label className="indlæg-sublabel">Refleksion</label>
              {konklusionSuggestions.reflection?.length ? (
                <div className="indlæg-suggestions" aria-label="Forslag til refleksion">
                  <div className="indlæg-suggestionsTitle">Forslag fra anamnesen:</div>
                  <div className="indlæg-suggestionsChips">
                    {konklusionSuggestions.reflection.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="indlæg-suggestionChip"
                        onClick={() => setConclusionReflection((cur) => appendBulletsDedup(cur, s))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <textarea
                className={`indlæg-textarea${highlightField === 'conclusion_reflection' ? ' indlæg-highlight' : ''}`}
                ref={conclusionReflectionRef}
                rows={3}
                value={conclusionReflection}
                onChange={(e) => setConclusionReflection(e.target.value)}
                placeholder="Kliniske overvejelser, bekymringer, red flags, mm."
              />
            </div>
          </div>
        </div>

        {/* Rich Text Editor Toolbar */}
        <div className="indlæg-form-section">
          <label className="indlæg-label">Indhold (samlet tekst)</label>
          <div className="indlæg-editor-toolbar">
            <button className="indlæg-toolbar-btn" title="Fortryd">
              ↶
            </button>
            <button className="indlæg-toolbar-btn" title="Gentag">
              ↷
            </button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Fed">
              B
            </button>
            <button className="indlæg-toolbar-btn" title="Kursiv">
              I
            </button>
            <button className="indlæg-toolbar-btn" title="Understreg">
              U
            </button>
            <button className="indlæg-toolbar-btn" title="Gennemstreg">
              S
            </button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Punktliste">
              •
            </button>
            <button className="indlæg-toolbar-btn" title="Nummereret liste">
              1.
            </button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Venstrejuster">
              ◀
            </button>
            <button className="indlæg-toolbar-btn" title="Centrer">
              ⬌
            </button>
            <button className="indlæg-toolbar-btn" title="Højrejuster">
              ▶
            </button>
            <div className="indlæg-toolbar-divider"></div>
            <select className="indlæg-toolbar-select">
              <option>Afsnit</option>
            </select>
            <button className="indlæg-toolbar-btn" title="Indsæt link">
              🔗
            </button>
            <button className="indlæg-toolbar-btn" title="Indsæt tabel">
              ⊞
            </button>
            <button className="indlæg-toolbar-btn" title="Indsæt billede">
              🖼️
            </button>
          </div>

          {/* Content Textarea */}
          <textarea
            className={`indlæg-textarea${highlightField === 'combined' ? ' indlæg-highlight' : ''}`}
            ref={combinedRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Indtast indhold..."
            rows={15}
          />
          <div className="indlæg-mikrofon-container">
            <div className="indlæg-mikrofon-wrapper">
              <div className="indlæg-mikrofon-actions">
                <button
                  type="button"
                  className={`indlæg-mikrofon-btn${isDictating ? ' active' : ''}`}
                  onClick={handleMikrofonClick}
                  title={isDictating ? 'Stop diktering' : 'Start diktering'}
                  aria-pressed={isDictating}
                >
                  <span className="indlæg-mikrofon-icon">🎤</span>
                  Mikrofon
                </button>
                <button
                  type="button"
                  className="indlæg-save-btn indlæg-save-btn--inline"
                  onClick={handleSave}
                  disabled={isSaving}
                  aria-busy={isSaving}
                >
                  {isSaving ? 'Gemmer...' : 'Gem og luk'}
                </button>
              </div>
              {dictationStatus && (
                <p className="indlæg-dictation-status">{dictationStatus}</p>
              )}
            </div>
            <Prompt onResult={appendContentFromExternalSource} />
          </div>
          {transcriptionResult && <Whisper data={transcriptionResult} />}
          {saveError && (
            <p className="indlæg-save-error" role="alert">
              {saveError}
            </p>
          )}
        </div>
        <div className="indlæg-agents indlæg-agents--hidden">
          <div className="indlæg-agents-title">AI agenter</div>
          <div className="indlæg-agent-grid">
            <div className="indlæg-agent-card">
              <AiAssistantCard
                agentId="reasoner"
                agentTitle="Agent 1 · Ræsonnering"
                clientId={clientId || null}
                clientName={clientName || null}
                draftText={content}
                onInsert={insertIntoJournal}
              />
            </div>
            <div className="indlæg-agent-card">
              <AiAssistantCard
                agentId="guidelines"
                agentTitle="Agent 2 · Evidens"
                clientId={clientId || null}
                clientName={clientName || null}
                draftText={content}
                onInsert={insertIntoJournal}
              />
            </div>
            <div className="indlæg-agent-card">
              <AiAssistantCard
                agentId="planner"
                agentTitle="Agent 3 · Forløbsplanlægger"
                clientId={clientId || null}
                clientName={clientName || null}
                draftText={content}
                onInsert={insertIntoJournal}
              />
            </div>
          </div>
        </div>
      </div>
      <aside className="indlæg-sidePanel">
        <div className="indlæg-sideStack">
          <div className="indlæg-factsr-section">
            <FactsRPanel
              status={factsStatus}
              interactionId={factsInteractionId}
              error={factsError}
              transcripts={factsTranscripts}
              facts={factsItems}
              isRecording={isFactsRecording}
              recordingStatus={factsRecordingStatus}
              onToggleRecording={handleToggleFactsR}
              insertTarget={factsInsertTarget}
              onChangeInsertTarget={setFactsInsertTarget}
              suggestionForFact={suggestionForFact}
              onInsertSelected={handleInsertSelectedFacts}
              onInsertAll={handleInsertAllFacts}
              onInsertOne={handleInsertOneFact}
              onFlush={flushFactsStream}
              onClear={handleClearFactsR}
            />
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
