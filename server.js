require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const util = require('util');
const crypto = require('crypto');
const { execFile } = require('child_process');
const http = require('http');
const axios = require('axios');
const { CortiClient, CortiEnvironment, CortiAuth, CortiError } = require('@corti/sdk');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const OpenAI = require('openai');
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

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const OpenAIClient = OpenAI?.default || OpenAI;
  return new OpenAIClient({ apiKey });
};

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
app.use('/uploads', express.static(uploadDir));
// Accept any single file field (frontend has used both "audio" and "file" historically)
const upload = multer({ dest: uploadDir }).any();

// --- Builder uploads (practitioner photo) ---
const builderImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const original = `${file?.originalname || ''}`;
      const ext = path.extname(original).toLowerCase() || '.jpg';
      const safeExt = ext.startsWith('.') ? ext : '.jpg';
      const id = crypto.randomBytes(8).toString('hex');
      cb(null, `builder-${Date.now()}-${id}${safeExt}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = `${file?.mimetype || ''}`.toLowerCase();
    if (mime.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Unsupported image type. Please upload an image file.'));
  },
});

app.options('/api/builder/upload-photo', (_req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  return res.sendStatus(204);
});

app.post('/api/builder/upload-photo', (req, res) => {
  builderImageUpload.single('file')(req, res, (err) => {
    if (err) {
      const isTooLarge = err?.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        error: isTooLarge ? 'Billedet er for stort (max 12MB).' : err?.message || 'Upload failed',
      });
    }
    if (!req.file?.filename) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    return res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// --- Builder image generation helpers ---
const ensureBuilderAiDir = () => {
  const dir = path.join(uploadDir, 'builder-ai');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const saveBase64ImageToUploads = (base64, { prefix = 'builder-ai', ext = '.png' } = {}) => {
  if (!base64 || typeof base64 !== 'string') return '';
  const safeExt = ext && ext.startsWith('.') ? ext : '.png';
  const id = crypto.randomBytes(8).toString('hex');
  const filename = `${prefix}-${Date.now()}-${id}${safeExt}`;
  const dir = ensureBuilderAiDir();
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return `/uploads/builder-ai/${filename}`;
};

// DALL·E 3 supports `response_format: b64_json` reliably for our OpenAI key.
const getOpenAiImageModel = () => `${process.env.OPENAI_IMAGE_MODEL || 'dall-e-3'}`.trim() || 'dall-e-3';

const generateOpenAiImageUrl = async (prompt) => {
  const client = getOpenAIClient();
  if (!client) return '';
  const resp = await client.images.generate({
    model: getOpenAiImageModel(),
    prompt,
    size: '1024x1024',
    n: 1,
    response_format: 'b64_json',
  });
  const b64 = resp?.data?.[0]?.b64_json || '';
  if (!b64) return '';
  return saveBase64ImageToUploads(b64, { prefix: 'builder-ai', ext: '.png' });
};

const selectBuilderHeroImage = (profession = '') => {
  const p = `${profession}`.toLowerCase();
  if (p.includes('psykolog') || p.includes('terapi') || p.includes('coach')) return '/hero-2/psych-hero-01.jpg';
  if (p.includes('fysio') || p.includes('fysioter')) return '/hero-2/physio-hero-02.jpg';
  return '/hero-2/pexels-cottonbro-7581072.jpg';
};

const selectBuilderGalleryImages = (profession = '') => {
  const p = `${profession}`.toLowerCase();
  if (p.includes('psykolog') || p.includes('terapi') || p.includes('coach')) {
    return [
      { url: '/hero-2/psych-gallery-01.jpg', alt: 'Roligt terapirum' },
      { url: '/hero-2/psych-gallery-02.jpg', alt: 'Samtalerum' },
      { url: '/hero-2/psych-gallery-03.jpg', alt: 'Stemningsbillede fra klinikken' },
    ];
  }
  if (p.includes('fysio') || p.includes('fysioter')) {
    return [
      { url: '/hero-2/physio-gallery-02.jpg', alt: 'Behandling' },
      { url: '/hero-2/physio-gallery-03.jpg', alt: 'Klinikmiljø' },
      { url: '/hero-2/physio-gallery-01.jpg', alt: 'Træning og vejledning' },
    ];
  }
  return [
    { url: '/hero-2/pexels-cottonbro-7581072.jpg', alt: 'Klinikmiljø' },
    { url: '/hero-2/pexels-thirdman-5060985.jpg', alt: 'Stemningsbillede' },
    { url: '/hero-2/pexels-eberhardgross-1743364.jpg', alt: 'Rolig stemning' },
  ];
};

const buildBuilderImagePrompts = ({ clinicName = '', profession = '', services = [], city = '', tone = '' }) => {
  const role = `${profession}`.trim() || 'clinician';
  const servicesText = Array.isArray(services) ? services.filter(Boolean).join(', ') : '';
  const baseStyle =
    'bright natural light, minimal Scandinavian clinic, soft neutral palette, clean, modern, professional, calm mood, high-resolution photography, no text, no logos';
  const location = city ? `in ${city}` : '';
  const focus = servicesText ? `Focus on ${servicesText}.` : '';
  const toneHint = tone ? `Tone: ${tone}.` : '';
  return {
    hero: `Wide hero photo for ${clinicName || 'a clinic'} (${role}) ${location}. ${baseStyle}. ${focus} ${toneHint}`,
    gallery: [
      `A ${role} guiding a patient during a session. ${baseStyle}. ${focus}`,
      `Minimalist consultation room with soft daylight. ${baseStyle}.`,
      `Close-up of clean clinic details and equipment. ${baseStyle}.`,
    ],
  };
};

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

app.options('/api/builder/generate', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  return res.sendStatus(204);
});

app.post('/api/builder/generate', async (req, res) => {
  try {
    const {
      clinicName = '',
      profession = '',
      services = [],
      city = '',
      tone = 'professionel/rolig',
      language = 'da',
      practitionerName = '',
      yearsExperience = '',
      targetAudience = '',
      approach = '',
      languages = '',
      practitionerPhotoUrl = '',
      aboutBullets = [],
    } = req.body || {};

    const normalizedServices = Array.isArray(services)
      ? services.map((s) => `${s || ''}`.trim()).filter(Boolean).slice(0, 3)
      : [];
    const normalizedAboutBullets = Array.isArray(aboutBullets)
      ? aboutBullets.map((b) => `${b || ''}`.trim()).filter(Boolean).slice(0, 5)
      : [];

    if (!`${clinicName}`.trim() || !`${profession}`.trim() || !`${city}`.trim()) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'clinicName, profession and city are required',
      });
    }

    const hasCustomPractitionerPhoto =
      `${practitionerPhotoUrl}`.trim() &&
      !`${practitionerPhotoUrl}`.trim().startsWith('data:') &&
      !`${practitionerPhotoUrl}`.trim().startsWith('/hero-2/');

    const fallbackHeroImageUrl = selectBuilderHeroImage(profession);
    const fallbackGalleryImages = selectBuilderGalleryImages(profession);

    let finalHeroImageUrl = fallbackHeroImageUrl;
    let finalGalleryImages = fallbackGalleryImages;
    const imageClient = getOpenAIClient();
    if (imageClient) {
      const prompts = buildBuilderImagePrompts({
        clinicName,
        profession,
        services: normalizedServices,
        city,
        tone,
      });
      try {
        const [heroUrl, g1, g2, g3] = await Promise.all([
          generateOpenAiImageUrl(prompts.hero),
          generateOpenAiImageUrl(prompts.gallery[0]),
          generateOpenAiImageUrl(prompts.gallery[1]),
          generateOpenAiImageUrl(prompts.gallery[2]),
        ]);
        if (heroUrl) finalHeroImageUrl = heroUrl;
        const generatedGallery = [g1, g2, g3];
        finalGalleryImages = fallbackGalleryImages.map((fallback, idx) => ({
          url: generatedGallery[idx] || fallback.url,
          alt: fallback.alt,
        }));
      } catch (imgErr) {
        console.warn('Builder image generation failed (continuing with fallbacks):', imgErr?.message || imgErr);
      }
    }

    const finalAboutPhotoUrl = hasCustomPractitionerPhoto
      ? `${practitionerPhotoUrl}`.trim()
      : `${practitionerPhotoUrl}`.trim() || finalHeroImageUrl || '/hero-2/pexels-yankrukov-5793991.jpg';

    const fallbackConfig = {
      version: 1,
      locale: language,
      clinicName: `${clinicName}`.trim(),
      profession: `${profession}`.trim(),
      city: `${city}`.trim(),
      tone: `${tone}`.trim(),
      theme: {
        background: '#f7f3ec',
        surface: '#ffffff',
        text: '#1f1f1f',
        mutedText: '#5b5b5b',
        accent: '#7a8b6a',
        accentText: '#ffffff',
      },
      nav: {
        links: ['Om mig', 'Terapiformer', 'Klinikken'],
      },
      hero: {
        headline: `${clinicName}`.trim(),
        subheadline: `${profession}`.trim() + (city ? ` i ${`${city}`.trim()}` : ''),
        ctaPrimary: 'Book Tid',
        ctaSecondary: 'Læs mere',
        ctaText: 'Book Tid',
        imageUrl: finalHeroImageUrl,
        imageAlt: `Stemningsbillede for ${`${clinicName}`.trim()}`,
      },
      about: {
        eyebrow: 'Om mig',
        name: `${`${practitionerName}`.trim() || `${clinicName}`.trim()}`,
        titleLine: `${profession}`.trim(),
        photoUrl: finalAboutPhotoUrl,
        bio:
          `Professionel ${`${profession}`.trim().toLowerCase()} i ${`${city}`.trim()} med fokus på trygge rammer, ` +
          `evidensbaserede metoder og konkrete redskaber.`,
        bullets: normalizedAboutBullets,
        credentialsTitle: 'Uddannelse & Certificeringer',
        credentials: [
          `Autoriseret ${`${profession}`.trim()}`,
          `${`${yearsExperience}`.trim() ? `${`${yearsExperience}`.trim()} års erfaring` : 'Faglig og rolig tilgang'}`,
          `${`${languages}`.trim() ? `Sprog: ${`${languages}`.trim()}` : 'Individuelt tilpassede forløb'}`,
        ].map((x) => `${x || ''}`.trim()).filter(Boolean).slice(0, 5),
        bulletsTitle: 'Om mig',
      },
      gallery: {
        heading: 'Klinikken',
        images: finalGalleryImages,
      },
      services: normalizedServices.length
        ? normalizedServices.map((title) => ({ title, description: '' }))
        : [
            { title: 'Behandling', description: '' },
            { title: 'Forløb', description: '' },
            { title: 'Vejledning', description: '' },
          ],
      trust: {
        bullets: ['Hurtig svartid', 'Tryghed og faglighed', 'Centralt i byen'],
      },
      contact: {
        phone: '',
        email: '',
        address: '',
        openingHours: '',
      },
      booking: {
        ctaText: 'Book tid',
        note: 'Online booking åbner efter du har gemt og oprettet konto.',
      },
    };

    const client = getOpenAIClient();
    if (!client) {
      return res.json({ config: fallbackConfig, provider: 'fallback', model: null });
    }

    const system = `Du genererer en "kliniksides" JSON-config til en landingpage preview.
Returnér KUN gyldig JSON. Ingen markdown. Ingen forklaring.

Regler:
- Sprog: ${language}
- Tone: ${tone}
- Profession og by skal nævnes i hero.
- Returnér felter der matcher følgende shape:
  - theme: { background, surface, text, mutedText, accent, accentText } (hex)
  - nav: { links: [3 korte menupunkter] }
  - hero: { headline, subheadline, ctaPrimary, ctaSecondary, ctaText, imageAlt }
  - about: { eyebrow, name, titleLine, bio, bullets: [3-5 korte punkter], credentialsTitle, credentials: [3-5] }
  - gallery: { heading, images: [{ alt }] } (vi udfylder imageUrl på serveren)
- services skal være 3 items (brug input hvis muligt).
- trust.bullets: 3 korte bullets.
- contact: efterlad tomme strings for phone/email/address/openingHours (vi udfylder senere).
- booking.note: nævn at login kræves for at gemme/publish.`;

    const user = {
      clinicName: `${clinicName}`.trim(),
      profession: `${profession}`.trim(),
      city: `${city}`.trim(),
      services: normalizedServices,
      tone: `${tone}`.trim(),
      practitionerName: `${practitionerName}`.trim(),
      targetAudience: `${targetAudience}`.trim(),
      approach: `${approach}`.trim(),
      yearsExperience: `${yearsExperience}`.trim(),
      languages: `${languages}`.trim(),
      aboutBullets: normalizedAboutBullets,
    };

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_BUILDER_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user) },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content || '';
    let config = null;
    try {
      config = JSON.parse(raw);
    } catch (_) {
      config = null;
    }

    if (!config || typeof config !== 'object') {
      return res.json({ config: fallbackConfig, provider: 'openai_parse_failed', model: completion?.model });
    }

    config.version = 1;
    config.locale = config.locale || language;
    config.clinicName = config.clinicName || fallbackConfig.clinicName;
    config.profession = config.profession || fallbackConfig.profession;
    config.city = config.city || fallbackConfig.city;
    config.tone = config.tone || fallbackConfig.tone;

    config.theme = {
      background: `${config?.theme?.background || fallbackConfig.theme.background}`.trim(),
      surface: `${config?.theme?.surface || fallbackConfig.theme.surface}`.trim(),
      text: `${config?.theme?.text || fallbackConfig.theme.text}`.trim(),
      mutedText: `${config?.theme?.mutedText || fallbackConfig.theme.mutedText}`.trim(),
      accent: `${config?.theme?.accent || fallbackConfig.theme.accent}`.trim(),
      accentText: `${config?.theme?.accentText || fallbackConfig.theme.accentText}`.trim(),
    };

    config.nav = {
      links:
        Array.isArray(config?.nav?.links) && config.nav.links.length
          ? config.nav.links.slice(0, 3).map((x) => `${x || ''}`.trim()).filter(Boolean)
          : fallbackConfig.nav.links,
    };
    if (config.nav.links.length < 3) config.nav.links = fallbackConfig.nav.links;

    if (!Array.isArray(config.services) || config.services.length !== 3) {
      config.services = fallbackConfig.services;
    } else {
      config.services = config.services.map((s) => ({
        title: `${s?.title || ''}`.trim() || 'Ydelse',
        description: `${s?.description || ''}`.trim(),
      }));
    }

    config.hero = {
      headline: `${config?.hero?.headline || fallbackConfig.hero.headline}`.trim(),
      subheadline: `${config?.hero?.subheadline || fallbackConfig.hero.subheadline}`.trim(),
      ctaPrimary: `${config?.hero?.ctaPrimary || fallbackConfig.hero.ctaPrimary}`.trim(),
      ctaSecondary: `${config?.hero?.ctaSecondary || fallbackConfig.hero.ctaSecondary}`.trim(),
      ctaText: `${config?.hero?.ctaPrimary || config?.hero?.ctaText || fallbackConfig.hero.ctaText}`.trim(),
      imageUrl: finalHeroImageUrl,
      imageAlt: `${config?.hero?.imageAlt || fallbackConfig.hero.imageAlt}`.trim(),
    };

    config.about = {
      eyebrow: `${config?.about?.eyebrow || fallbackConfig.about.eyebrow}`.trim(),
      name: `${`${practitionerName}`.trim() || config?.about?.name || fallbackConfig.about.name}`.trim(),
      titleLine: `${config?.about?.titleLine || fallbackConfig.about.titleLine}`.trim(),
      photoUrl: finalAboutPhotoUrl,
      bio: `${config?.about?.bio || fallbackConfig.about.bio}`.trim(),
      bullets:
        normalizedAboutBullets.length
          ? normalizedAboutBullets
          : Array.isArray(config?.about?.bullets) && config.about.bullets.length
            ? config.about.bullets.slice(0, 5).map((x) => `${x || ''}`.trim()).filter(Boolean)
            : fallbackConfig.about.bullets,
      credentialsTitle: `${config?.about?.credentialsTitle || fallbackConfig.about.credentialsTitle}`.trim(),
      credentials:
        Array.isArray(config?.about?.credentials) && config.about.credentials.length
          ? config.about.credentials.slice(0, 5).map((x) => `${x || ''}`.trim()).filter(Boolean)
          : fallbackConfig.about.credentials,
      bulletsTitle: `${config?.about?.bulletsTitle || fallbackConfig.about.bulletsTitle || 'Om mig'}`.trim(),
    };

    config.gallery = {
      heading: `${config?.gallery?.heading || fallbackConfig.gallery.heading}`.trim(),
      images:
        Array.isArray(config?.gallery?.images) && config.gallery.images.length
          ? config.gallery.images.slice(0, 3).map((img, idx) => ({
              url: finalGalleryImages[idx]?.url || finalGalleryImages[0]?.url,
              alt: `${img?.alt || finalGalleryImages[idx]?.alt || 'Billede'}`.trim(),
            }))
          : finalGalleryImages,
    };

    config.trust = {
      bullets: Array.isArray(config?.trust?.bullets) && config.trust.bullets.length
        ? config.trust.bullets.slice(0, 3).map((b) => `${b || ''}`.trim()).filter(Boolean)
        : fallbackConfig.trust.bullets,
    };
    if (config.trust.bullets.length < 3) {
      config.trust.bullets = fallbackConfig.trust.bullets;
    }

    config.contact = {
      phone: `${config?.contact?.phone || ''}`,
      email: `${config?.contact?.email || ''}`,
      address: `${config?.contact?.address || ''}`,
      openingHours: `${config?.contact?.openingHours || ''}`,
    };
    config.booking = {
      ctaText: `${config?.booking?.ctaText || fallbackConfig.booking.ctaText}`.trim(),
      note: `${config?.booking?.note || fallbackConfig.booking.note}`.trim(),
    };

    return res.json({ config, provider: 'openai', model: completion?.model });
  } catch (error) {
    console.error('Builder generate error:', error?.response?.data || error);
    return res.status(error?.response?.status || 500).json({
      error: error?.message || 'Failed to generate builder config',
      details: error?.response?.data || error?.stack || error,
    });
  }
});

// Chat for builder preview (AI receptionist)
app.post('/api/builder/chat', async (req, res) => {
  try {
    const { message, clinicContext } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const client = getOpenAIClient();
    if (!client) {
      return res.status(500).json({ error: 'OpenAI API key is missing' });
    }

    const context = clinicContext && typeof clinicContext === 'object' ? clinicContext : {};
    const clinicName = `${context.clinicName || 'klinikken'}`.trim();
    const profession = `${context.profession || 'behandler'}`.trim();
    const city = `${context.city || ''}`.trim();
    const tone = `${context.tone || ''}`.trim();
    const services = Array.isArray(context.services) ? context.services.filter(Boolean).slice(0, 6) : [];
    const servicesLine = services.length ? services.join(', ') : 'Generelle behandlinger';

    const system = `Du er en hjælpsom receptionist for klinikken ${clinicName}. ` +
      `Din tone er venlig og professionel. Du svarer kort på spørgsmål. ` +
      `Dit mål er at få patienten til at booke en tid. ` +
      `Hvis de spørger om pris, så opfind en realistisk pris for en ${profession} (brug DKK). ` +
      `Kontekst: Profession: ${profession}. ` +
      `${city ? `By: ${city}. ` : ''}` +
      `Ydelser: ${servicesLine}. ` +
      `${tone ? `Tone: ${tone}. ` : ''}` +
      `Svar på dansk med mindre brugeren skriver engelsk.`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 200,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message.trim() },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(500).json({ error: 'Empty response from OpenAI' });
    }

    return res.json({ reply });
  } catch (error) {
    console.error('Builder chat error:', error?.response?.data || error);
    return res.status(error?.response?.status || 500).json({
      error: error?.message || 'Failed to generate chat response',
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
