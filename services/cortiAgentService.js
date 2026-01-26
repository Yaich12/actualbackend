const { CortiClient } = require('@corti/sdk');
const { SYSTEM_PROMPT } = require('../cortiAgentSystemPrompt');

const env = process.env.CORTI_ENVIRONMENT || process.env.CORTI_ENV || 'eu';
const tenantName = process.env.CORTI_TENANT_NAME || 'base';
const clientId = process.env.CORTI_CLIENT_ID || process.env.CORTI_CLIENTID;
const clientSecret = process.env.CORTI_CLIENT_SECRET || process.env.CORTI_CLIENTSECRET;

let cachedAgentId = null;
let cachedClient = null;

const FORMAT_INSTRUCTION = `
OUTPUT FORMAT (required):
Write in Markdown with headings and bullet points.
Use these sections (translate headings to OUTPUT_LANGUAGE and include only those that make sense):

### Brief summary
- (3-6 bullets)

### Missing information / follow-up questions
- (3-8 bullets)

### Red flags (what to watch for)
- (3-6 bullets)

### Objective tests (suggestions)
- (3-8 bullets)

### Plan + HEP (concrete)
- (3-8 bullets)

### Next steps
- (3-6 bullets)

Rules:
- No long paragraphs.
- Max 2 lines per bullet.
- Use only Markdown headings and bullet points.
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

const getClient = () => {
  if (cachedClient) return cachedClient;
  cachedClient = new CortiClient({
    environment: env,
    credentials: {
      clientId,
      clientSecret,
    },
  });
  return cachedClient;
};

const createAgentConfig = () => ({
  name: 'Selma Clinical Education Agent',
  description: 'Assistant for preparing patient sessions based on patient notes.',
  systemPrompt: SYSTEM_PROMPT,
  experts: [
    { name: 'web-search-expert', type: 'reference' },
    { name: 'amboss-expert', type: 'reference' },
    { name: 'pubmed-expert', type: 'reference' },
  ],
});

const extractReplyText = (task) => {
  const msg = task?.status?.message;
  const parts = msg?.parts || [];
  const textPart = parts.find((p) => p?.text) || parts.find((p) => p?.content?.text);
  if (textPart?.text) return textPart.text;
  if (textPart?.content?.text) return textPart.content.text;
  if (typeof msg?.text === 'string') return msg.text;
  return '';
};

const initAgent = async () => {
  if (cachedAgentId) return cachedAgentId;
  const client = getClient();
  const agent = await client.agents.create(createAgentConfig(), { tenantName });
  const agentId = agent?.agentId || agent?.id;
  if (!agentId) {
    throw new Error('Agent ID missing from creation response');
  }
  cachedAgentId = agentId;
  return agentId;
};

const chatWithAgent = async ({
  agentId,
  message,
  patientName,
  clientId: clientIdValue,
  notesContext,
  sourceText,
  mode,
  preferredLanguage,
}) => {
  const userMessage = `${message || ''}`.trim();
  const formattedMessage = `${FORMAT_INSTRUCTION}\n\nUSER INPUT:\n${appendOutputLanguage(
    userMessage,
    preferredLanguage
  )}`.trim();
  const finalMessage = formattedMessage;
  if (!finalMessage) throw new Error('Missing message');

  const agentToUse = agentId || cachedAgentId || (await initAgent());

  const contextText = notesContext || sourceText || '';
  const meta = `Patient: ${patientName || 'Ukendt'}\nClientId: ${clientIdValue || '—'}\nMode: ${mode || 'patient_overview'}`;
  const finalText = `
${meta}

PATIENT CONTEXT (journal notes):
${contextText}

USER QUESTION:
${finalMessage}
`.trim();

  const payload = {
    message: {
      role: 'user',
      kind: 'message',
      parts: [{ kind: 'text', text: finalText }],
    },
  };

  const client = getClient();
  const sendResp = await client.agents.messageSend(agentToUse, payload, { tenantName });

  const text =
    extractReplyText(sendResp?.task || sendResp) ||
    extractReplyText(sendResp?.task?.status || sendResp?.status) ||
    '(tomt svar fra agent)';

  return { text, agentId: agentToUse };
};

module.exports = {
  initAgent,
  chatWithAgent,
};
