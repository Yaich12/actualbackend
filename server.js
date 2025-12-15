require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { execFile } = require('child_process');
const http = require('http');
const axios = require('axios');
const { CortiClient, CortiEnvironment, CortiAuth, CortiError } = require('@corti/sdk');
const cors = require('cors');
const { WebSocketServer } = require('ws');
// For facts/insights fetch
const CORTI_API_BASE =
  (process.env.CORTI_ENV || 'eu').toLowerCase() === 'us'
    ? 'https://api.us.corti.app/v2'
    : 'https://api.eu.corti.app/v2';

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
const execFileAsync = util.promisify(execFile);

// In-memory agent cache (per process). In production, persist in DB/redis.
let cachedAgentId = null;
let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;
const useTokenCaching = false; // force fresh token each call to avoid stale/invalid

const DEFAULT_AGENT_PROMPT = `Du er en specialiseret klinisk assistent for tværfaglige klinikker (Fysioterapi, Kiropraktik, Psykologi).
Din opgave er at assistere behandleren med journalføring, opsummering og faglig sparring.

**Dine Instruktioner:**
1. **Identificer Fagområde:**
   - Hvis input omhandler knogler, muskler, led, bevægelse (f.eks. 'lændesmerter', 'ROM', 'manipulation'): Ager som **Fysioterapeut/Kiropraktor**. Fokusér på biomekanik, funktionelle tests, smerteanamnese og objektive fund.
   - Hvis input omhandler tanker, følelser, adfærd (f.eks. 'stress', 'angst', 'samtale'): Ager som **Psykolog**. Fokusér på mentale tilstande, coping-strategier, og samtalens temaer.

2. **Struktur (Journalføring):**
   - Brug som udgangspunkt **SOAP-modellen** (Subjektivt, Objektivt, Analyse, Plan), men tilpas indholdet:
     - *Fys/Kiro:* Objektivt skal indeholde specifikke tests (Lasegue, ROM, Palpation).
     - *Psych:* Objektivt skal beskrive fremtoning, kontaktform, stemningsleje.

3. **Sikkerhed (Red Flags):**
   - Vær opmærksom på 'Røde Flag' i begge lejre (f.eks. Cauda Equina syndrom ved rygsmerter ELLER selvmordsrisiko ved depression). Hvis du spotter disse, skal du markere dem tydeligt til behandleren.

4. **Sprog:**
   - Brug korrekt dansk fagterminologi. Tillad latin for anatomiske begreber (f.eks. 'm. trapezius', 'columna').

Du må ikke stille diagnoser, kun komme med fagligt funderede forslag til journalnotatet.`;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// Accept any single file field (frontend has used both "audio" and "file" historically)
const upload = multer({ dest: uploadDir }).any();

const missingEnv = ['CORTI_CLIENT_ID', 'CORTI_CLIENT_SECRET', 'CORTI_TENANT_NAME'].filter(
  (key) => !process.env[key]
);
if (missingEnv.length) {
  console.warn(`Missing Corti config: ${missingEnv.join(', ')}`);
}

const resolvedEnvironment =
  (process.env.CORTI_ENV || 'eu').toLowerCase() === 'us'
    ? CortiEnvironment.Us
    : CortiEnvironment.Eu;

const createCortiClient = async () => {
  if (missingEnv.length) {
    throw new Error(`Missing Corti config: ${missingEnv.join(', ')}`);
  }

  const auth = new CortiAuth({
    environment: resolvedEnvironment,
    tenantName: process.env.CORTI_TENANT_NAME,
  });

  const { accessToken } = await auth.getToken({
    clientId: process.env.CORTI_CLIENT_ID,
    clientSecret: process.env.CORTI_CLIENT_SECRET,
  });

  return new CortiClient({
    environment: resolvedEnvironment,
    tenantName: process.env.CORTI_TENANT_NAME,
    auth: {
      accessToken,
    },
  });
};

// --- OAuth token for direct REST calls (Agentic endpoints) ---
const getCortiToken = async () => {
  const { CORTI_CLIENT_ID, CORTI_CLIENT_SECRET } = process.env;
  if (!CORTI_CLIENT_ID || !CORTI_CLIENT_SECRET) {
    throw new Error('Missing CORTI_CLIENT_ID or CORTI_CLIENT_SECRET');
  }
  const now = Date.now();
  if (useTokenCaching) {
    if (cachedAccessToken && cachedTokenExpiresAt > now + 30_000) {
      return cachedAccessToken;
    }
  }

  const auth = new CortiAuth({
    environment: resolvedEnvironment,
    tenantName: process.env.CORTI_TENANT_NAME,
  });

  const { accessToken, expiresIn } = await auth.getToken({
    clientId: CORTI_CLIENT_ID,
    clientSecret: CORTI_CLIENT_SECRET,
  });

  if (useTokenCaching) {
    cachedAccessToken = accessToken;
    cachedTokenExpiresAt = now + (expiresIn ? expiresIn * 1000 : 300_000);
    return cachedAccessToken;
  }
  return accessToken;
};

// Helper: create agent via REST
const createCortiAgent = async (
  accessToken,
  systemPrompt = 'You are a helpful assistant.'
) => {
  const { CORTI_ENV, CORTI_TENANT_NAME } = process.env;
  const envBase = (CORTI_ENV || 'eu').toLowerCase() === 'us'
    ? 'https://api.us.corti.app'
    : 'https://api.eu.corti.app';

  // Per Corti guidance: keep prompt in agent systemPrompt; leave experts empty unless MCP is used.
  const body = {
    name: 'Selma Agent',
    systemPrompt,
    description: 'Klinikagent til fys/kiro/psyk – journalstøtte, SOAP, røde flag.',
    experts: [],
  };

  const resp = await axios.post(
    `${envBase}/agents`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(CORTI_TENANT_NAME ? { 'Tenant-Name': CORTI_TENANT_NAME } : {}),
      },
    }
  );
  console.info('Corti create agent response status:', resp.status);
  console.info('Corti create agent response headers:', resp.headers);
  console.info('Corti create agent response data:', resp.data);

  let agentId =
    resp.data?.id ||
    resp.data?.agentId ||
    resp.data?.agent_id ||
    resp.data?.agent?.id ||
    resp.data?.agent?.agentId;

  if (!agentId && resp.headers) {
    const loc = resp.headers.location || resp.headers.Location;
    if (loc && typeof loc === 'string') {
      const parts = loc.split('/').filter(Boolean);
      agentId = parts[parts.length - 1];
    }
  }

  if (!agentId || `${agentId}`.trim() === '') {
    return null;
  }
  return agentId;
};

const listCortiAgents = async (accessToken) => {
  const { CORTI_ENV, CORTI_TENANT_NAME } = process.env;
  const envBase = (CORTI_ENV || 'eu').toLowerCase() === 'us'
    ? 'https://api.us.corti.app'
    : 'https://api.eu.corti.app';
  const resp = await axios.get(`${envBase}/agents`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(CORTI_TENANT_NAME ? { 'Tenant-Name': CORTI_TENANT_NAME } : {}),
    },
  });
  return resp.data || [];
};

// Helper: send message to agent
const sendAgentMessage = async (accessToken, agentId, text) => {
  const { CORTI_ENV, CORTI_TENANT_NAME } = process.env;
  const envBase = (CORTI_ENV || 'eu').toLowerCase() === 'us'
    ? 'https://api.us.corti.app'
    : 'https://api.eu.corti.app';
  const { randomUUID } = require('crypto');
  const messageId = randomUUID();
  const payload = {
    message: {
      messageId,
      kind: 'message',
      role: 'user',
      parts: [{ kind: 'text', text }],
    },
  };

  try {
    console.info('Agent send request ->', JSON.stringify(payload));
    const resp = await axios.post(
      `${envBase}/agents/${agentId}/v1/message:send`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(CORTI_TENANT_NAME ? { 'Tenant-Name': CORTI_TENANT_NAME } : {}),
        },
      }
    );
    console.info('Agent send payload:', JSON.stringify(payload));
    console.info('Agent send status:', resp.status);
    console.info('Agent send response:', resp.data);
    // Extract text part
    const parts = resp.data?.message?.parts || resp.data?.parts || [];
    const textPart = parts.find((p) => p.kind === 'text') || parts[0];
    return {
      raw: resp.data,
      text: textPart?.text || '',
    };
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('Agent send error status:', status);
    console.error('Agent send error body (raw):', data);
    try {
      console.error('Agent send error body (json):', JSON.stringify(data, null, 2));
    } catch (_) {}
    console.error('Agent send payload (failed):', JSON.stringify(payload, null, 2));
    throw err;
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const transcodeToWav = async (inputPath, outputPath) => {
  // Ensure ffmpeg is available; convert to 16kHz, mono, 16-bit PCM in WAV container.
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-sample_fmt',
    's16',
    outputPath,
  ]);
};

const fetchCortiFacts = async (interactionId, token) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(process.env.CORTI_TENANT_NAME ? { 'Tenant-Name': process.env.CORTI_TENANT_NAME } : {}),
  };
  const resp = await axios.get(`${CORTI_API_BASE}/interactions/${interactionId}/facts`, {
    headers,
  });
  return resp.data;
};

// Stateless Facts extraction (FactsR™) from transcript text (no persistence)
const extractFactsFromText = async (cortiClient, text, outputLanguage) => {
  if (!text || typeof text !== 'string' || text.trim() === '') return null;
  const resp = await cortiClient.facts.extract(
    {
      context: [{ type: 'text', text }],
      outputLanguage: outputLanguage || 'da',
    },
    { tenantName: process.env.CORTI_TENANT_NAME }
  );
  return resp;
};

app.options('/api/transcribe', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  return res.sendStatus(204);
});

app.post('/api/transcribe', upload, async (req, res) => {
  console.info('Received /api/transcribe request: files=%s fields=%s', (req.files || []).length, Object.keys(req.body || {}).join(','));
  let cortiClient;
  try {
    cortiClient = await createCortiClient();
  } catch (err) {
    console.error('Corti client init error:', err);
    return res.status(500).json({
      error: 'Corti credentials are not configured on the server.',
      details: err?.message,
    });
  }

  const incomingFile =
    (req.files && req.files[0]) || (req.file ? req.file : null);
  if (!incomingFile) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const filePath = incomingFile.path;
  const language = req.body?.language || 'da';
  const includeFacts =
    `${req.body?.includeFacts || req.query?.includeFacts || ''}`.toLowerCase() === 'true' ||
    `${req.body?.facts || req.query?.facts || ''}`.toLowerCase() === 'true';
  const encounterIdentifier =
    req.body?.encounterIdentifier || `booking-${Date.now()}`;
  const encounterTitle = req.body?.title || incomingFile.originalname || 'Recording';

  // If already WAV, skip transcode to avoid ffmpeg dependency for simple cases.
  const isWav =
    (incomingFile.mimetype && incomingFile.mimetype.includes('wav')) ||
    /\.wav$/i.test(incomingFile.originalname || '');
  let wavPath = isWav ? filePath : path.join(uploadDir, `${Date.now()}-converted.wav`);
  let transcodeFailed = false;
  if (!isWav) {
    try {
      await transcodeToWav(filePath, wavPath);
    } catch (err) {
      console.error('ffmpeg transcode failed:', err);
      // Fallback: use original file if ffmpeg is unavailable.
      transcodeFailed = true;
      wavPath = filePath;
    }
  }

  try {
    const interaction = await cortiClient.interactions.create(
      {
        encounter: {
          identifier: encounterIdentifier,
          status: 'planned',
          type: 'consultation',
          title: encounterTitle,
        },
      },
      { tenantName: process.env.CORTI_TENANT_NAME }
    );
    const interactionId = interaction?.interactionId;
    console.info('Corti interaction created:', interactionId);

    const recordingResponse = await cortiClient.recordings.upload(
      {
        path: wavPath,
        filename: (incomingFile.originalname || 'audio').replace(/\.[^/.]+$/, '') + '.wav',
        contentType:
          isWav || transcodeFailed
            ? incomingFile.mimetype || 'application/octet-stream'
            : 'audio/wav',
      },
      interactionId,
      { tenantName: process.env.CORTI_TENANT_NAME }
    );
    console.info('Corti recording uploaded:', recordingResponse);

    // Brief pause to allow Corti to process the recording before requesting a transcript.
    await wait(1200);

    const transcriptResponse = await cortiClient.transcripts.create(
      interactionId,
      {
        recordingId: recordingResponse.recordingId,
        primaryLanguage: language,
        isDictation: true,
      },
      { tenantName: process.env.CORTI_TENANT_NAME }
    );
    console.info('Corti transcript response (initial):', transcriptResponse);

    let transcriptData = transcriptResponse;

    if (!transcriptData?.transcripts?.length && transcriptData?.id) {
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await wait(1500);
        const polled = await cortiClient.transcripts.get(
          interactionId,
          transcriptData.id,
          { tenantName: process.env.CORTI_TENANT_NAME }
        );
        if (polled?.transcripts?.length) {
          transcriptData = polled;
          break;
        }
      }
    }

    const text = (transcriptData?.transcripts || [])
      .map((segment) => segment.text)
      .join(' ')
      .trim();

    // Fetch facts stored on the interaction (if any)
    let facts = null;
    try {
      const token = await getCortiToken();
      facts = await fetchCortiFacts(interactionId, token);
    } catch (factsErr) {
      console.error('Corti facts error:', factsErr?.response?.data || factsErr);
    }

    // Optional: Extract FactsR™ from transcript text (stateless, not stored)
    let extractedFacts = null;
    if (includeFacts) {
      try {
        extractedFacts = await extractFactsFromText(cortiClient, text, language);
      } catch (factsExtractErr) {
        console.error('Corti facts.extract error:', factsExtractErr?.response?.data || factsExtractErr);
      }
    }

    return res.json({
      text,
      interactionId,
      recordingId: recordingResponse.recordingId,
      transcriptId: transcriptData?.id ?? null,
      usage: transcriptData?.usageInfo ?? null,
      metadata: transcriptData?.metadata ?? null,
      facts,
      extractedFacts,
    });
  } catch (error) {
    console.error('Corti transcription error:', error);
    if (error?.body) {
      console.error('Corti error body:', error.body);
    }

    const status =
      error instanceof CortiError
        ? error.statusCode || 502
        : error?.status || error?.response?.status || 500;
    const message =
      error instanceof CortiError
        ? error.message
        : error?.message ||
      error?.response?.data?.error ||
      error?.response?.data ||
      'Transcription failed';
    const details =
      (error instanceof CortiError && error.body) ||
      error?.response?.data ||
      error?.body ||
      null;

    return res.status(status).json({ error: message, details });
  } finally {
    fs.promises
      .unlink(filePath)
      .catch((err) => console.error('Error deleting temp file:', err));
    if (wavPath && wavPath !== filePath) {
      fs.promises
        .unlink(wavPath)
        .catch((err) => console.error('Error deleting temp wav file:', err));
    }
  }
});

// --- FactsR realtime stream (foundation) ---
// Creates an interaction and returns a local websocket path that proxies Corti /stream.
// NOTE: For browser streaming you must send 16kHz mono PCM (s16le) chunks as binary messages.
app.post('/api/facts-stream/init', async (req, res) => {
  try {
    const cortiClient = await createCortiClient();
    const primaryLanguage = req.body?.primaryLanguage || 'da';
    const outputLocale = req.body?.outputLocale || 'da';
    const encounterIdentifier = req.body?.encounterIdentifier || `facts-stream-${Date.now()}`;
    const encounterTitle = req.body?.title || 'Realtime Facts Stream';

    const interaction = await cortiClient.interactions.create(
      {
        encounter: {
          identifier: encounterIdentifier,
          status: 'planned',
          type: 'consultation',
          title: encounterTitle,
        },
      },
      { tenantName: process.env.CORTI_TENANT_NAME }
    );

    const interactionId = interaction?.interactionId;
    if (!interactionId) {
      return res.status(502).json({ error: 'Missing interactionId from Corti interactions.create' });
    }

    const wsPath = `/ws/facts-stream?interactionId=${encodeURIComponent(interactionId)}&primaryLanguage=${encodeURIComponent(
      primaryLanguage
    )}&outputLocale=${encodeURIComponent(outputLocale)}`;

    return res.json({
      interactionId,
      wsPath,
      configurationHint: {
        transcription: {
          primaryLanguage,
          participants: [{ channel: 0, role: 'multiple' }],
        },
        mode: { type: 'facts', outputLocale },
      },
    });
  } catch (error) {
    console.error('facts-stream init error:', error?.response?.data || error);
    return res.status(error?.response?.status || 500).json({
      error: error?.message || 'Failed to init facts stream',
      details: error?.response?.data || error?.stack || error,
    });
  }
});

// --- Agent endpoints ---
// Initialize agent (create once and reuse)
app.post('/api/init-agent', async (req, res) => {
  try {
    console.info('Init-agent: starting');
    if (process.env.CORTI_AGENT_ID) {
      cachedAgentId = process.env.CORTI_AGENT_ID;
      return res.json({ agentId: cachedAgentId });
    }
    const token = await getCortiToken();
    console.info('Init-agent: token acquired');
    if (cachedAgentId) {
      return res.json({ agentId: cachedAgentId });
    }
    const systemPrompt = req.body?.systemPrompt || DEFAULT_AGENT_PROMPT;
    let agentId = null;
    // Try to list existing agents first
    try {
      const agents = await listCortiAgents(token);
      if (Array.isArray(agents) && agents.length > 0) {
        const first = agents.find((a) => a.id) || agents[0];
        agentId = first?.id;
        console.info('Init-agent: using existing agentId from list', agentId);
      }
    } catch (listErr) {
      console.error('List agents failed (continuing to create):', listErr.message || listErr);
    }
    // If none found, try create
    if (!agentId) {
      const createdId = await createCortiAgent(token, systemPrompt);
      if (createdId) {
        agentId = createdId;
        console.info('Init-agent: created agentId', agentId);
      } else {
        throw new Error('No agentId returned from create');
      }
    }
    if (!agentId || `${agentId}`.trim() === '') {
      throw new Error('AgentId empty after create/list');
    }
    cachedAgentId = agentId;
    return res.json({ agentId });
  } catch (error) {
    console.error('Init agent error:', error?.response?.data || error);
    return res
      .status(error?.response?.status || 500)
      .json({
        error: error?.message || 'Failed to init agent',
        details: error?.response?.data || error?.stack || error,
      });
  }
});

// Chat with agent
app.post('/api/chat', async (req, res) => {
  try {
    const { message, agentId: incomingAgentId, clientId, clientName, clientSummary } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }
    const token = await getCortiToken();
    const agentId = incomingAgentId || cachedAgentId;
    if (!agentId) {
      return res.status(400).json({ error: 'Agent not initialized' });
    }
    const contextLines = [];
    if (clientId || clientName) {
      contextLines.push(`Kontekst: Klient ${clientName || ''} (ID: ${clientId || 'ukendt'})`);
    }
    if (clientSummary) {
      contextLines.push(`Seneste noter/historik: ${clientSummary}`);
    } else {
      contextLines.push('Historik fra backend ikke vedhæftet i denne version.');
    }
    const finalText = contextLines.length ? `${contextLines.join('\n')}\n\n${message}` : message;

    const reply = await sendAgentMessage(token, agentId, finalText);
    return res.json({ agentId, text: reply.text, raw: reply.raw });
  } catch (error) {
    console.error('Chat error:', error?.response?.data || error);
    return res
      .status(error?.response?.status || 500)
      .json({ error: error?.message || 'Failed to send chat', details: error?.response?.data });
  }
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// WebSocket proxy server (same port as Express)
const wss = new WebSocketServer({ server, path: '/ws/facts-stream' });

wss.on('connection', async (clientWs, req) => {
  // Parse query params
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const interactionId = url.searchParams.get('interactionId');
  const primaryLanguage = url.searchParams.get('primaryLanguage') || 'da';
  const outputLocale = url.searchParams.get('outputLocale') || 'da';

  if (!interactionId) {
    clientWs.send(JSON.stringify({ type: 'error', error: 'Missing interactionId' }));
    clientWs.close();
    return;
  }

  let cortiSocket = null;
  try {
    // Fresh token per WS connection
    const accessToken = await getCortiToken();
    const cortiClient = new CortiClient({
      environment: resolvedEnvironment,
      tenantName: process.env.CORTI_TENANT_NAME,
      auth: { accessToken },
    });

    const configuration = {
      transcription: {
        primaryLanguage,
        isDiarization: false,
        isMultichannel: false,
        participants: [{ channel: 0, role: 'multiple' }],
      },
      mode: {
        type: 'facts',
        outputLocale,
      },
    };

    cortiSocket = await cortiClient.stream.connect({
      id: interactionId,
      configuration,
      debug: false,
    });

    cortiSocket.on('open', () => {
      clientWs.send(JSON.stringify({ type: 'open', interactionId }));
    });

    cortiSocket.on('message', (msg) => {
      try {
        clientWs.send(JSON.stringify(msg));
      } catch (_) {}
    });

    cortiSocket.on('error', (err) => {
      try {
        clientWs.send(JSON.stringify({ type: 'error', error: err?.message || String(err) }));
      } catch (_) {}
    });

    cortiSocket.on('close', () => {
      try {
        clientWs.close();
      } catch (_) {}
    });

    // Forward browser -> Corti
    clientWs.on('message', (data, isBinary) => {
      if (!cortiSocket) return;
      try {
        if (isBinary) {
          cortiSocket.sendAudio(data);
          return;
        }
        const txt = data.toString();
        let msg = null;
        try {
          msg = JSON.parse(txt);
        } catch (_) {
          // Non-JSON text: treat as base64 audio
          cortiSocket.sendAudio(txt);
          return;
        }
        if (msg?.type === 'flush') {
          cortiSocket.sendFlush({ type: 'flush' });
          return;
        }
        if (msg?.type === 'end') {
          cortiSocket.sendEnd({ type: 'end' });
          return;
        }
      } catch (_) {}
    });

    clientWs.on('close', () => {
      try {
        cortiSocket?.close();
      } catch (_) {}
    });
  } catch (e) {
    console.error('facts-stream ws proxy error:', e?.response?.data || e);
    try {
      clientWs.send(JSON.stringify({ type: 'error', error: e?.message || String(e) }));
    } catch (_) {}
    try {
      clientWs.close();
    } catch (_) {}
    try {
      cortiSocket?.close();
    } catch (_) {}
  }
});

server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

// Make port conflicts easier to diagnose (avoid unhandled 'error' crash)
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the other running server or set PORT to a free port (e.g. PORT=4001 npm run server).`
    );
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});
