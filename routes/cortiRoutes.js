const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { execFile } = require('child_process');
const { createCortiClient } = require('../cortiAuth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir }).any();
const execFileAsync = util.promisify(execFile);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const transcodeToWav = async (inputPath, outputPath) => {
  // Convert to 16kHz mono PCM WAV (same format as /api/transcribe)
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

router.post('/interactions', async (req, res) => {
  try {
    const cortiClient = await createCortiClient();
    const encounterIdentifier = req.body?.encounterIdentifier || `interaction-${Date.now()}`;
    const title = req.body?.title || 'Corti interaction';

    const interaction = await cortiClient.interactions.create(
      {
        encounter: {
          identifier: encounterIdentifier,
          status: 'planned',
          type: 'consultation',
          title,
        },
      },
      { tenantName: process.env.CORTI_TENANT_NAME }
    );

    const interactionId = interaction?.interactionId;
    if (!interactionId) {
      return res.status(502).json({ error: 'Missing interactionId from Corti.' });
    }

    return res.json({ interactionId });
  } catch (error) {
    console.error('Corti interaction create error:', error?.response?.data || error);
    return res.status(error?.response?.status || 500).json({
      error: error?.message || 'Failed to create Corti interaction',
      details: error?.response?.data || error?.body || error?.stack || null,
    });
  }
});

router.get('/templates', async (req, res) => {
  try {
    const cortiClient = await createCortiClient();
    const lang = req.query?.lang || 'da';
    const status = req.query?.status || undefined;
    const org = req.query?.org || undefined;

    const response = await cortiClient.templates.list(
      { lang, status, org },
      { tenantName: process.env.CORTI_TENANT_NAME }
    );

    return res.json(response?.data || response);
  } catch (error) {
    console.error('Corti templates list error:', error?.response?.data || error);
    return res.status(error?.response?.status || 500).json({
      error: error?.message || 'Failed to list templates',
      details: error?.response?.data || error?.body || error?.stack || null,
    });
  }
});

router.get('/templates/:key', async (req, res) => {
  try {
    const cortiClient = await createCortiClient();
    const templateKey = req.params?.key;
    if (!templateKey) {
      return res.status(400).json({ error: 'Missing template key' });
    }

    const response = await cortiClient.templates.get(templateKey, {
      tenantName: process.env.CORTI_TENANT_NAME,
    });

    return res.json(response?.data || response);
  } catch (error) {
    console.error('Corti template get error:', error?.response?.data || error);
    return res.status(error?.response?.status || 500).json({
      error: error?.message || 'Failed to fetch template',
      details: error?.response?.data || error?.body || error?.stack || null,
    });
  }
});

router.post('/dictate', upload, async (req, res) => {
  console.info(
    'Received /api/corti/dictate: files=%s fields=%s',
    (req.files || []).length,
    Object.keys(req.body || {}).join(',')
  );

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

  const incomingFile = (req.files && req.files[0]) || req.file || null;
  if (!incomingFile) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const language = req.body?.language || 'da';
  const encounterIdentifier = req.body?.encounterIdentifier || `dictate-${Date.now()}`;
  const encounterTitle = req.body?.title || incomingFile.originalname || 'Dictation';
  const filePath = incomingFile.path;

  const isWav =
    (incomingFile.mimetype && incomingFile.mimetype.includes('wav')) ||
    /\.wav$/i.test(incomingFile.originalname || '');
  let wavPath = isWav ? filePath : path.join(uploadDir, `${Date.now()}-dictate.wav`);
  let transcodeFailed = false;

  if (!isWav) {
    try {
      await transcodeToWav(filePath, wavPath);
    } catch (err) {
      console.error('ffmpeg transcode failed (continuing with original file):', err);
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
    if (!interactionId) {
      return res.status(502).json({ error: 'Missing interactionId from Corti.' });
    }
    console.info(`[DICTATE] interactionId=${interactionId}`);

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
    const recordingId = recordingResponse?.recordingId || recordingResponse?.id;
    console.info(`[DICTATE] recordingId=${recordingId}`);

    await wait(1200);

    const transcriptResponse = await cortiClient.transcripts.create(
      interactionId,
      {
        recordingId,
        primaryLanguage: language,
        isDictation: true,
      },
      { tenantName: process.env.CORTI_TENANT_NAME }
    );

    const transcriptId = transcriptResponse?.id || transcriptResponse?.transcriptId;
    console.info(`[DICTATE] transcriptId=${transcriptId}`);

    let transcriptData = transcriptResponse;
    let segments = transcriptData?.transcripts || [];
    let status = transcriptResponse?.status || transcriptResponse?.state || 'completed';

    if ((!segments || segments.length === 0) && transcriptId) {
      status = 'processing';
      const maxAttempts = 10;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await wait(1500);
        const polled = await cortiClient.transcripts.get(interactionId, transcriptId, {
          tenantName: process.env.CORTI_TENANT_NAME,
        });
        const polledSegments = polled?.transcripts || [];
        status = polled?.status || polled?.state || status;
        if (polledSegments.length) {
          transcriptData = polled;
          segments = polledSegments;
          break;
        }
      }
    }

    const text = (segments || [])
      .map((segment) => segment.text)
      .join(' ')
      .trim();

    console.info(`[DICTATE] status=${status}`);

    return res.json({
      text,
      interactionId,
      recordingId,
      transcriptId: transcriptId || null,
      status,
    });
  } catch (error) {
    console.error('Corti dictation error:', error?.response?.data || error);
    return res.status(500).json({
      error: error?.message || 'Dictation failed',
      details: error?.response?.data || error?.body || error?.stack || null,
    });
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

router.post('/interactions/:id/documents', async (req, res) => {
  try {
    const cortiClient = await createCortiClient();
    const interactionId = req.params?.id;
    const transcriptText = String(req.body?.transcriptText || '').trim();
    const templateKey = String(req.body?.templateKey || '').trim();
    const outputLanguage = req.body?.outputLanguage || 'da';

    if (!interactionId) {
      return res.status(400).json({ error: 'Missing interaction id' });
    }
    if (!transcriptText) {
      return res.status(400).json({ error: 'Missing transcriptText' });
    }
    if (!templateKey) {
      return res.status(400).json({ error: 'Missing templateKey' });
    }

    const response = await cortiClient.documents.create(
      interactionId,
      {
        context: [
          {
            type: 'transcript',
            data: { text: transcriptText },
          },
        ],
        templateKey,
        outputLanguage,
      },
      { tenantName: process.env.CORTI_TENANT_NAME }
    );

    return res.json(response?.data || response);
  } catch (error) {
    console.error('Corti documents create error:', error?.response?.data || error);
    return res.status(error?.response?.status || 500).json({
      error: error?.message || 'Failed to create document',
      details: error?.response?.data || error?.body || error?.stack || null,
    });
  }
});

router.get('/ping-token', async (_req, res) => {
  try {
    const token = await getAccessToken();
    return res.json({ ok: true, tokenLength: token ? token.length : 0 });
  } catch (error) {
    console.error('Corti ping-token error:', error?.response?.data || error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Failed to get token',
    });
  }
});

module.exports = router;
