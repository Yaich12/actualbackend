const { CortiClient } = require('@corti/sdk');
const { SYSTEM_PROMPT } = require('../cortiAgentSystemPrompt');

const env = process.env.CORTI_ENVIRONMENT || process.env.CORTI_ENV || 'eu';
const tenantName = process.env.CORTI_TENANT_NAME || 'base';
const clientId = process.env.CORTI_CLIENT_ID || process.env.CORTI_CLIENTID;
const clientSecret = process.env.CORTI_CLIENT_SECRET || process.env.CORTI_CLIENTSECRET;

let cachedAgentId = null;
let cachedClient = null;

const FORMAT_INSTRUCTION = `
SVARFORMAT (obligatorisk):
Skriv altid i MARKDOWN med underoverskrifter og bulletpoints.
Brug disse sektioner (brug kun dem der giver mening):

### Kort opsummering
- (3-6 bullets)

### Manglende information / spørgsmål til næste gang
- (3-8 bullets)

### Røde flag (hvad skal jeg være obs på?)
- (3-6 bullets)

### Objektive tests (forslag)
- (3-8 bullets)

### Plan + HEP (konkret)
- (3-8 bullets)

### Næste skridt
- (3-6 bullets)

Regler:
- INGEN lange afsnit.
- Max 2 linjer per bullet.
- Brug kun Markdown headings og bulletpoints.
`.trim();

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
}) => {
  const userMessage = `${message || ''}`.trim();
  const formattedMessage = `${FORMAT_INSTRUCTION}\n\nBRUGERENS INPUT:\n${userMessage}`.trim();
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
