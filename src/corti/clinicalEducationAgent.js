const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const client = require('./cortiClient');

const readCachedAgentId = () => {
  try {
    const cachePath = path.resolve(__dirname, '..', '..', '.corti-agent-cache.json');
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, 'utf8');
    const json = JSON.parse(raw);
    return json?.clinicalEducationAgentId || null;
  } catch (_) {
    return null;
  }
};

const writeCachedAgentId = (agentId) => {
  try {
    const cachePath = path.resolve(__dirname, '..', '..', '.corti-agent-cache.json');
    fs.writeFileSync(
      cachePath,
      JSON.stringify({ clinicalEducationAgentId: agentId }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('[AGENT] cache write failed:', err);
  }
};

const extractAgentId = (resp) =>
  resp?.agentId || resp?.id || resp?.agent?.id || resp?.agent?.agentId || null;

const SYSTEM_PROMPT = `
You are the Corti Clinical Education Agent for physiotherapists.
Respond in the OUTPUT_LANGUAGE provided by the user, concise, structured, and clinically relevant.
Use bullet points and clear headings.
Identify key findings, red flags, required assessments, and patient education suggestions.
Use only the provided context; if something is missing, mention it under "Missing info".
`.trim();

const DEFAULT_LANGUAGE = 'en';

const resolvePreferredLanguage = (value) => {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;
  const trimmed = value.trim();
  return trimmed || DEFAULT_LANGUAGE;
};

const appendOutputLanguage = (message, preferredLanguage) => {
  const language = resolvePreferredLanguage(preferredLanguage);
  return `${message}\n\nOUTPUT_LANGUAGE: ${language}\nPlease respond in this language.\nUse Markdown headings starting with ### for each section. Do not return a single block without headings.`.trim();
};

async function getOrCreateClinicalEducationAgent() {
  if (process.env.CORTI_AGENT_ID) {
    return process.env.CORTI_AGENT_ID;
  }

  const cached = readCachedAgentId();
  if (cached) return cached;

  const body = {
    name: 'Clinical Education Agent',
    experts: [
      { name: 'web-search-expert', type: 'reference' },
      { name: 'amboss-expert', type: 'reference' },
      { name: 'pubmed-expert', type: 'reference' },
    ],
    description:
      'En agent der hjælper klinikere med kort, struktureret klinisk feedback, uddannelse og beslutningsstøtte.',
    systemPrompt: SYSTEM_PROMPT,
  };

  const resp = await client.agents.create(body, {
    tenantName: process.env.CORTI_TENANT_NAME,
  });
  const agentId = extractAgentId(resp);
  if (!agentId) {
    throw new Error('No agentId returned when creating Clinical Education Agent');
  }
  writeCachedAgentId(agentId);
  return agentId;
}

const extractReplyText = (data) => {
  const candidateParts =
    data?.task?.status?.message?.parts ||
    data?.message?.parts ||
    data?.parts ||
    [];
  if (Array.isArray(candidateParts) && candidateParts.length) {
    const textPart = candidateParts.find((p) => p?.kind === 'text') || candidateParts[0];
    if (textPart?.text) return textPart.text;
    const joined = candidateParts.map((p) => p?.text || '').filter(Boolean).join('\n').trim();
    if (joined) return joined;
  }
  return (
    data?.task?.status?.message?.text ||
    data?.message?.text ||
    data?.text ||
    ''
  );
};

async function sendClinicalEducationMessage(
  agentId,
  {
    message,
    contextText,
    patientName,
    sessionDate,
    templateKey,
    contextSource,
    preferredLanguage,
  }
) {
  const ctx = `${contextText || ''}`.trim();
  const task = appendOutputLanguage(`${message || ''}`.trim(), preferredLanguage);
  const prompt = `
You are the Corti Clinical Education Agent. Respond in OUTPUT_LANGUAGE, concise and clinically concrete.
Brug konteksten nedenfor (kilde: ${contextSource || 'ukendt'}).

KONTEKST:
<<<
${ctx}
>>>

PATIENT: ${patientName || '—'}
DATO: ${sessionDate || '—'}
TEMPLATE: ${templateKey || '—'}

SPØRGSMÅL/OPGAVE:
${task}

FORMAT:
- Brug bullets og korte overskrifter
- Afslut med "Manglende info:" hvis noget mangler
`.trim();

  const payload = {
    message: {
      role: 'user',
      kind: 'message',
      messageId: crypto.randomUUID(),
      parts: [{ kind: 'text', text: prompt }],
    },
  };

  const resp = await client.agents.messageSend(agentId, payload, {
    tenantName: process.env.CORTI_TENANT_NAME,
  });

  const replyText = extractReplyText(resp);
  return replyText || '(ingen tekst)';
}

module.exports = {
  getOrCreateClinicalEducationAgent,
  sendClinicalEducationMessage,
};
