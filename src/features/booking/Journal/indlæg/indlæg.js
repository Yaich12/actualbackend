import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import './indlæg.css';
import Whisper from './whisper';
import Prompt from './prompt';
import FactsRPanel from './FactsRPanel';
import { useFactsRStream } from './useFactsRStream';
import { db } from '../../../../firebase';
import { useAuth } from '../../../../AuthContext';

const PROJECT_ID = process.env.REACT_APP_PROJECT_ID || '';
const FUNCTION_REGION = process.env.REACT_APP_FUNCTION_REGION || 'us-central1';
const FUNCTIONS_PORT = process.env.REACT_APP_FUNCTIONS_PORT || '5601';

// Transcription endpoint resolution:
// 1) Explicit override: REACT_APP_TRANSCRIBE_URL (e.g., http://localhost:4000/api/transcribe or prod backend)
// 2) If project id present, build default Cloud Functions URL (local emulator when on localhost, otherwise hosted)
const buildDefaultTranscribeUrl = () => {
  if (!PROJECT_ID) return '';
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return `http://127.0.0.1:${FUNCTIONS_PORT}/${PROJECT_ID}/${FUNCTION_REGION}/transcribe_audio`;
  }
  return `https://${FUNCTION_REGION}-${PROJECT_ID}.cloudfunctions.net/transcribe_audio`;
};

const TRANSCRIBE_FUNCTION_URL =
  process.env.REACT_APP_TRANSCRIBE_URL || buildDefaultTranscribeUrl();

const ANAMNESIS_SECTION_KEYS = ['subjective', 'objective', 'assessment', 'plan'];
const ANAMNESIS_SECTION_LABELS = {
  subjective: 'Subjektivt',
  objective: 'Objektivt',
  assessment: 'Vurdering',
  plan: 'Plan',
};

const ANAMNESIS_TEMPLATES = {
  first: {
    subjective: '(Årsag til henvendelse, debut/forløb, symptomer, lindrende/forværrende, tidligere behandling)',
    objective: '(Observationer/inspektion, tests og fund)',
    assessment: '(Foreløbig vurdering/diagnose, risici/red flags)',
    plan: '(Tiltag i dag, hjemmeøvelser/vejledning, opfølgning)',
  },
  follow_up: {
    subjective: '(Siden sidst, ændringer, symptomer, respons på forrige tiltag, aktuelle mål/bekymringer)',
    objective: '(Status på fund/test, progression/forværring)',
    assessment: '(Klinisk vurdering, hvad peger det på, hvad skal justeres)',
    plan: '(Tiltag i dag, nye/justerede øvelser, plan for næste besøg)',
  },
};

const normalizeBulletText = (line) =>
  (line || '')
    .replace(/^\s*[-•]\s*/, '')
    .trim()
    .toLowerCase();

const isBulletLine = (line) => /^\s*[-•]\s+/.test(line || '');

const parseBulletItems = (text) =>
  (text || '')
    .split('\n')
    .map((ln) => ln.trim())
    .filter((ln) => isBulletLine(ln))
    .map((ln) => ln.replace(/^\s*[-•]\s+/, '').trim())
    .filter(Boolean);

const extractSuggestionItems = (text) => {
  const bullets = parseBulletItems(text);
  if (bullets.length) return bullets;
  const lines = (text || '')
    .split('\n')
    .map((l) => (l || '').trim())
    .filter(Boolean)
    // Ignore "template prompt" style lines like "(...)" to avoid noisy suggestions.
    .filter((l) => !(l.startsWith('(') && l.endsWith(')') && l.length > 2));
  return lines.slice(0, 6);
};

const uniqLimit = (items, limit = 6) => {
  const out = [];
  const seen = new Set();
  (items || []).forEach((it) => {
    const key = normalizeBulletText(it);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(it);
  });
  return out.slice(0, limit);
};

const toBulletItems = (text) => {
  if (!text || typeof text !== 'string') return [];
  const items = parseBulletItems(text);
  if (items.length) return items;
  const cleaned = text.replace(/^\s*[-•]\s+/, '').trim();
  return cleaned ? [cleaned] : [];
};

const appendBulletsDedup = (current, newItems) => {
  const items = (Array.isArray(newItems) ? newItems : [newItems])
    .map((l) => (typeof l === 'string' ? l : l?.text))
    .map((l) => (l || '').trim())
    .filter(Boolean);
  if (!items.length) return current || '';

  const existing = new Set(parseBulletItems(current).map(normalizeBulletText));
  const additions = items.filter((item) => !existing.has(normalizeBulletText(item)));
  if (!additions.length) return current || '';

  const prefix = (current || '').trimEnd();
  const needsSpacer = prefix && !prefix.endsWith('\n');
  const spacer = prefix ? (needsSpacer ? '\n' : '') : '';
  const block = additions.map((item) => `- ${item}`).join('\n');
  return `${prefix}${spacer}${block}`.trimStart();
};

const serializeAnamnesisSections = (sections) => {
  const s = sections || {};
  const parts = [];
  ANAMNESIS_SECTION_KEYS.forEach((key) => {
    const label = ANAMNESIS_SECTION_LABELS[key];
    const body = (s[key] || '').trim();
    if (!body) return;
    parts.push(`${label}:\n${body}`);
  });
  return parts.join('\n\n').trim();
};

const humanizeConsultationType = (t) => (t === 'follow_up' ? 'Efterfølgende' : 'Første konsultation');

const buildCombinedText = ({
  consultationType,
  anamnesisSections,
  conclusionFocusAreas,
  conclusionSessionContent,
  conclusionTasksNext,
  conclusionReflection,
}) => {
  const lines = [];
  lines.push('Anamnese / Journal:');
  lines.push('');
  lines.push(`Konsultationstype: ${humanizeConsultationType(consultationType)}`);
  lines.push('');
  lines.push('Anamnese:');
  const anamnese = serializeAnamnesisSections(anamnesisSections);
  if (anamnese) lines.push(anamnese);
  else lines.push('(ingen anamnesenoter endnu)');
  lines.push('');
  lines.push('Konklusion af sessionen:');
  if (conclusionFocusAreas?.trim()) {
    lines.push('');
    lines.push('Fokusområder:');
    lines.push(conclusionFocusAreas.trim());
  }
  if (conclusionSessionContent?.trim()) {
    lines.push('');
    lines.push('Sessionens indhold:');
    lines.push(conclusionSessionContent.trim());
  }
  if (conclusionTasksNext?.trim()) {
    lines.push('');
    lines.push('Opgaver til næste gang:');
    lines.push(conclusionTasksNext.trim());
  }
  if (conclusionReflection?.trim()) {
    lines.push('');
    lines.push('Refleksion:');
    lines.push(conclusionReflection.trim());
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const mapFactGroupToHeading = (fact, fallbackHeading) => {
  const group = (fact?.group || fallbackHeading || '').toLowerCase();
  if (
    group.includes('subjective') ||
    group.includes('subjekt') ||
    group.includes('history') ||
    group.includes('chief') ||
    group.includes('symptom')
  ) {
    return 'subjective';
  }
  if (
    group.includes('objective') ||
    group.includes('objekt') ||
    group.includes('finding') ||
    group.includes('exam') ||
    group.includes('vital')
  ) {
    return 'objective';
  }
  if (
    group.includes('assessment') ||
    group.includes('vurder') ||
    group.includes('diagnos') ||
    group.includes('impression')
  ) {
    return 'assessment';
  }
  if (group.includes('plan') || group.includes('recommend') || group.includes('follow')) {
    return 'plan';
  }
  return 'subjective';
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

function Indlæg({ clientId, clientName, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('14-11-2025');
  const [consultationType, setConsultationType] = useState('first');
  const [isPrivate, setIsPrivate] = useState(false);
  const [content, setContent] = useState('');
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
  const [isDictating, setIsDictating] = useState(false);
  const [dictationStatus, setDictationStatus] = useState('');
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveError, setSaveError] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const { user } = useAuth();
  const factsR = useFactsRStream();
  const factsPendingAudioRef = useRef([]);
  const [factsInsertTarget, setFactsInsertTarget] = useState('auto');
  const [assistantTab, setAssistantTab] = useState('facts'); // facts | agent | transcript
  const [highlightField, setHighlightField] = useState(null);
  const anamnesisSubjectiveRef = useRef(null);
  const anamnesisObjectiveRef = useRef(null);
  const anamnesisAssessmentRef = useRef(null);
  const anamnesisPlanRef = useRef(null);
  const conclusionFocusRef = useRef(null);
  const conclusionContentRef = useRef(null);
  const conclusionTasksRef = useRef(null);
  const conclusionReflectionRef = useRef(null);
  const combinedRef = useRef(null);
  const lastAutoCombinedRef = useRef('');

  const anamnesisContent = useMemo(
    () => serializeAnamnesisSections(anamnesisSections),
    [anamnesisSections]
  );

  const activeAnamnesisTemplate = useMemo(() => {
    return consultationType === 'follow_up' ? ANAMNESIS_TEMPLATES.follow_up : ANAMNESIS_TEMPLATES.first;
  }, [consultationType]);

  const konklusionSuggestions = useMemo(() => {
    const subj = extractSuggestionItems(anamnesisSections.subjective);
    const obj = extractSuggestionItems(anamnesisSections.objective);
    const assess = extractSuggestionItems(anamnesisSections.assessment);
    const plan = extractSuggestionItems(anamnesisSections.plan);

    const reflectionSignals = assess.filter((l) => {
      const s = l.toLowerCase();
      return s.includes('red flag') || s.includes('bekym') || s.includes('alarm') || s.includes('risiko');
    });

    return {
      focusAreas: uniqLimit([...subj.slice(0, 3), ...assess.slice(0, 3)], 6),
      sessionContent: uniqLimit([...obj.slice(0, 5)], 6),
      tasksNext: uniqLimit([...plan.slice(0, 6)], 6),
      reflection: uniqLimit([...reflectionSignals, ...assess.slice(0, 4)], 6),
    };
  }, [anamnesisSections]);

  // Auto-generate "samlet tekst" as long as the user hasn't manually edited it.
  useEffect(() => {
    const nextCombined = buildCombinedText({
      consultationType,
      anamnesisSections,
      conclusionFocusAreas,
      conclusionSessionContent,
      conclusionTasksNext,
      conclusionReflection,
    });
    const isUntouched = !content.trim() || content === lastAutoCombinedRef.current;
    if (!isUntouched) return;
    lastAutoCombinedRef.current = nextCombined;
    setContent(nextCombined);
  }, [
    consultationType,
    anamnesisSections,
    conclusionFocusAreas,
    conclusionSessionContent,
    conclusionTasksNext,
    conclusionReflection,
    content,
  ]);

  useEffect(() => {
    if (!factsR.accepted) return;
    const pending = factsPendingAudioRef.current;
    if (!pending.length) return;
    pending.forEach((buf) => factsR.sendAudio(buf));
    factsPendingAudioRef.current = [];
  }, [factsR.accepted, factsR]);

  const highlightAndScroll = (target) => {
    const refMap = {
      anamnesis_subjective: anamnesisSubjectiveRef,
      anamnesis_objective: anamnesisObjectiveRef,
      anamnesis_assessment: anamnesisAssessmentRef,
      anamnesis_plan: anamnesisPlanRef,
      conclusion_focus: conclusionFocusRef,
      conclusion_content: conclusionContentRef,
      conclusion_tasks: conclusionTasksRef,
      conclusion_reflection: conclusionReflectionRef,
      combined: combinedRef,
    };
    const ref = refMap[target];
    try {
      ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
    setHighlightField(target);
    window.clearTimeout(highlightAndScroll._t);
    highlightAndScroll._t = window.setTimeout(() => setHighlightField(null), 1600);
  };

  const insertFactsIntoAnamnesis = (incomingFacts, fallbackHeading) => {
    const factsList = Array.isArray(incomingFacts) ? incomingFacts : [incomingFacts];
    const grouped = new Map();

    factsList.forEach((fact) => {
      const rawText = typeof fact === 'string' ? fact : fact?.text;
      if (!rawText || !rawText.trim()) return;
      const sectionKey = mapFactGroupToHeading(fact, fallbackHeading);
      const cleanText = rawText.trim();
      if (!grouped.has(sectionKey)) grouped.set(sectionKey, []);
      grouped.get(sectionKey).push(cleanText);
    });

    if (!grouped.size) return;

    setAnamnesisSections((current) => {
      const next = { ...current };
      grouped.forEach((lines, key) => {
        const existing = current?.[key] || '';
        next[key] = appendBulletsDedup(existing, lines);
      });
      return next;
    });

    // Highlight first updated section
    const firstKey = grouped.keys().next().value;
    if (firstKey) {
      highlightAndScroll(`anamnesis_${firstKey}`);
    }
  };

  const insertIntoJournal = (texts, target) => {
    const t = target || factsInsertTarget;
    const lines = Array.isArray(texts) ? texts.filter(Boolean) : [texts].filter(Boolean);
    if (!lines.length) return;
    if (t === 'anamnesis') {
      insertFactsIntoAnamnesis(lines, 'subjective');
      return;
    }
    const block = lines.map((l) => `- ${l}`).join('\n');

    const append = (setter) => setter((cur) => (cur ? `${cur}\n${block}` : block));

    if (t === 'conclusion_focus') append(setConclusionFocusAreas);
    else if (t === 'conclusion_content') append(setConclusionSessionContent);
    else if (t === 'conclusion_tasks') append(setConclusionTasksNext);
    else if (t === 'conclusion_reflection') append(setConclusionReflection);
    else if (t === 'combined') append(setContent);

    highlightAndScroll(t);
  };

  const suggestTargetForFact = (fact) => {
    const sectionKey = mapFactGroupToHeading(fact);
    const label = ANAMNESIS_SECTION_LABELS[sectionKey] || 'Anamnese';
    return { key: 'anamnesis', label: `Anamnese: ${label}` };
  };

  const insertFactsAuto = (facts) => {
    const list = Array.isArray(facts) ? facts : [];
    const validFacts = list.filter((f) => f && !f.isDiscarded && f.text);
    if (!validFacts.length) return;
    insertFactsIntoAnamnesis(validFacts);
  };

  const handleInsertTemplate = () => {
    const anyContent = ANAMNESIS_SECTION_KEYS.some((k) => (anamnesisSections?.[k] || '').trim());
    if (anyContent) {
      highlightAndScroll('anamnesis_subjective');
      return;
    }
    const template =
      consultationType === 'follow_up' ? ANAMNESIS_TEMPLATES.follow_up : ANAMNESIS_TEMPLATES.first;
    setAnamnesisSections({
      subjective: template.subjective || '',
      objective: template.objective || '',
      assessment: template.assessment || '',
      plan: template.plan || '',
    });
    highlightAndScroll('anamnesis_subjective');
  };

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
      dictationStatus,
      transcriptionResult,
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

  const handleSaveDraft = async () => {
    if (isSavingDraft || isSaving) {
      return;
    }

    setSaveError('');

    if (!user) {
      setSaveError('Du skal være logget ind for at gemme en kladde.');
      return;
    }

    if (!clientId) {
      setSaveError('Manglende klient-id – kunne ikke knytte kladden til en klient.');
      return;
    }

    const nowIso = new Date().toISOString();
    const ownerIdentifier = deriveUserIdentifier(user);

    const draftPayload = {
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
      isDraft: true,
      clientName,
      clientId,
      searchQuery,
      dictationStatus,
      transcriptionResult,
      ownerUid: user.uid,
      ownerEmail: user.email ?? null,
      ownerIdentifier,
      createdAtIso: nowIso,
    };

    setIsSavingDraft(true);
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
        ...draftPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const savedDraft = {
        id: docRef.id,
        ...draftPayload,
        createdAt: nowIso,
      };

      if (typeof onSave === 'function') {
        onSave(savedDraft);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save draft journal entry:', error);
      setSaveError('Kunne ikke gemme kladden. Prøv igen senere.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleAddFile = () => {
    // Handle add journal file
    console.log('Add journal file');
  };

  const handleUpload = () => {
    // Handle upload
    console.log('Upload');
  };

  const handlePrint = () => {
    // Handle print
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
      setAssistantTab('facts');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Start FactsR in parallel (auto when dictation starts)
      try {
        const ownerIdentifier = deriveUserIdentifier(user);
        await factsR.start({
          primaryLanguage: 'da',
          outputLocale: 'da',
          encounterIdentifier: `journal-${clientId || 'unknown'}-${Date.now()}`,
          title: `Journal ${clientName || ''} (${ownerIdentifier})`,
        });
      } catch (e) {
        // FactsR should never block dictation
        console.warn('FactsR start failed:', e?.message || e);
      }

      // Prefer webm/opus chunks for streaming; keep final blob for transcription.
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      const chosenMime =
        mimeCandidates.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';

      const mediaRecorder = new MediaRecorder(stream, chosenMime ? { mimeType: chosenMime } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      factsPendingAudioRef.current = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Stream to FactsR (binary chunks). Buffer until CONFIG_ACCEPTED.
          try {
            const buf = await event.data.arrayBuffer();
            if (factsR.accepted) {
              factsR.sendAudio(buf);
            } else {
              factsPendingAudioRef.current.push(buf);
            }
          } catch (_) {}
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
          // End FactsR session after last audio chunk is emitted
          try {
            factsR.end();
          } catch (_) {}
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        }
      };

      // 500ms chunks recommended for /stream
      mediaRecorder.start(500);
      setIsDictating(true);
      setDictationStatus('Lytter....');
    } catch (error) {
      console.error('Microphone error:', error);
      setDictationStatus('Kunne ikke få adgang til mikrofonen.');
      setIsDictating(false);
      try {
        factsR.clear();
      } catch (_) {}
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
          appendContentFromExternalSource(parsedResult.text, parsedResult.facts);
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
      try {
        recorder.requestData?.();
      } catch (_) {}
      recorder.stop();
      setDictationStatus('Stopper optagelse...');
    }
    setIsDictating(false);
  };

  const handleMikrofonClick = () => {
    if (isDictating) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  return (
    <div className="indlæg-container">
      {/* Header */}
      <div className="indlæg-header">
        <div className="indlæg-header-top">
          <h2 className="indlæg-title">Journal for {clientName}</h2>
          <div className="indlæg-header-actions">
            <button className="indlæg-action-btn" title="Nyt indlæg">
              <span className="indlæg-action-icon">−</span>
              Nyt indlæg
            </button>
            <button className="indlæg-action-btn" onClick={handleAddFile} title="Tilføj Journalfil">
              <span className="indlæg-action-icon">📁</span>
              Tilføj Journalfil
            </button>
            <button className="indlæg-icon-btn" onClick={handleUpload} title="Upload">
              ☁️
            </button>
            <button className="indlæg-icon-btn" onClick={handlePrint} title="Print">
              🖨️
            </button>
            <button className="indlæg-close-btn" onClick={handleCancel}>✕</button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="indlæg-search-bar">
          <input
            type="text"
            placeholder="Søg..."
            className="indlæg-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
              <label className="indlæg-label">Titel</label>
              <input
                type="text"
                className="indlæg-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Indtast titel..."
              />
            </div>
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
              <button className="indlæg-help-btn" title="Hjælp">?</button>
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
            <button className="indlæg-toolbar-btn" title="Fortryd">↶</button>
            <button className="indlæg-toolbar-btn" title="Gentag">↷</button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Fed">B</button>
            <button className="indlæg-toolbar-btn" title="Kursiv">I</button>
            <button className="indlæg-toolbar-btn" title="Understreg">U</button>
            <button className="indlæg-toolbar-btn" title="Gennemstreg">S</button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Punktliste">•</button>
            <button className="indlæg-toolbar-btn" title="Nummereret liste">1.</button>
            <div className="indlæg-toolbar-divider"></div>
            <button className="indlæg-toolbar-btn" title="Venstrejuster">◀</button>
            <button className="indlæg-toolbar-btn" title="Centrer">⬌</button>
            <button className="indlæg-toolbar-btn" title="Højrejuster">▶</button>
            <div className="indlæg-toolbar-divider"></div>
            <select className="indlæg-toolbar-select">
              <option>Afsnit</option>
            </select>
            <button className="indlæg-toolbar-btn" title="Indsæt link">🔗</button>
            <button className="indlæg-toolbar-btn" title="Indsæt tabel">⊞</button>
            <button className="indlæg-toolbar-btn" title="Indsæt billede">🖼️</button>
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
        </div>
        </div>

        <aside className="indlæg-sidePanel" aria-label="Assistentpanel">
          <div className="indlæg-assistantShell">
            <div className="indlæg-assistantTabs" role="tablist" aria-label="Assistent tabs">
              <button
                type="button"
                className={`indlæg-assistantTab ${assistantTab === 'facts' ? 'active' : ''}`}
                onClick={() => setAssistantTab('facts')}
                role="tab"
                aria-selected={assistantTab === 'facts'}
              >
                FactsR
              </button>
              <button
                type="button"
                className={`indlæg-assistantTab ${assistantTab === 'agent' ? 'active' : ''}`}
                onClick={() => setAssistantTab('agent')}
                role="tab"
                aria-selected={assistantTab === 'agent'}
              >
                Klinisk agent
              </button>
              <button
                type="button"
                className={`indlæg-assistantTab ${assistantTab === 'transcript' ? 'active' : ''}`}
                onClick={() => setAssistantTab('transcript')}
                role="tab"
                aria-selected={assistantTab === 'transcript'}
              >
                Transskription
              </button>
              <div className="indlæg-assistantTabSpacer" />
              <span className="indlæg-assistantMiniStatus">{isDictating ? 'Optager' : 'Klar'}</span>
            </div>

            <div className="indlæg-assistantBody">
              {assistantTab === 'facts' && (
                <FactsRPanel
                  status={factsR.status}
                  interactionId={factsR.interactionId}
                  error={factsR.error}
                  transcripts={factsR.transcripts}
                  facts={factsR.facts}
                  isRecording={isDictating}
                  recordingStatus={dictationStatus}
                  onToggleRecording={handleMikrofonClick}
                  insertTarget={factsInsertTarget}
                  onChangeInsertTarget={(t) => setFactsInsertTarget(t)}
                  suggestionForFact={suggestTargetForFact}
                  onInsertSelected={(texts) => {
                    if (factsInsertTarget === 'auto') {
                      const selectedFacts = (factsR.facts || []).filter((f) => (texts || []).includes(f.text));
                      insertFactsAuto(selectedFacts);
                      return;
                    }
                    insertIntoJournal(texts, factsInsertTarget);
                  }}
                  onInsertAll={(texts) => {
                    if (factsInsertTarget === 'auto') {
                      insertFactsAuto(factsR.facts || []);
                      return;
                    }
                    insertIntoJournal(texts, factsInsertTarget);
                  }}
                  onInsertOne={(text, targetKey) => {
                    if (factsInsertTarget === 'auto') {
                      const factMatch = (factsR.facts || []).find((f) => f.text === text);
                      if (factMatch) {
                        insertFactsAuto([factMatch]);
                        return;
                      }
                      insertFactsIntoAnamnesis([{ text, group: targetKey }], targetKey);
                      return;
                    }
                    insertIntoJournal(text, factsInsertTarget);
                  }}
                  onFlush={factsR.flush}
                  onClear={factsR.clear}
                />
              )}

              {assistantTab === 'agent' && <Prompt onResult={appendContentFromExternalSource} />}

              {assistantTab === 'transcript' && (
                <div className="indlæg-transcriptionCard">
                  <div className="indlæg-transcriptionTitle">Transskription</div>
                  {transcriptionResult ? (
                    <Whisper data={transcriptionResult} />
                  ) : (
                    <div className="indlæg-transcriptionEmpty">Ingen transskription endnu.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
        </div>
      </div>

      {saveError && (
        <p className="indlæg-save-error" role="alert">
          {saveError}
        </p>
      )}

      {/* Footer Actions */}
      <div className="indlæg-footer">
        <button className="indlæg-cancel-btn" onClick={handleCancel}>
          ✕ Annuller
        </button>
        <button className="indlæg-draft-btn" onClick={handleSaveDraft} disabled={isSavingDraft}>
          {isSavingDraft ? 'Gemmer kladde...' : 'Gem som kladde'}
        </button>
        <button
          className="indlæg-save-btn"
          onClick={handleSave}
          disabled={isSaving}
          aria-busy={isSaving}
        >
          <span className="indlæg-save-icon">💾</span>
          {isSaving ? 'Gemmer...' : 'Gem og luk'}
        </button>
      </div>
    </div>
  );
}

export default Indlæg;
