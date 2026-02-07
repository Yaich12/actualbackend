const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { execFile } = require('child_process');
const { createCortiClient } = require('../cortiAuth');
const {
  CORTI_SPEECH_ALLOWLIST,
  CORTI_SPEECH_FALLBACK,
  resolveSpeechLanguage,
} = require('../server/utils/cortiLanguages');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir }).any();
const execFileAsync = util.promisify(execFile);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const UNSUPPORTED_LANGUAGE_RE = /unsupported language|language unavailable/i;
let ffmpegMissingLogged = false;

const isUnsupportedLanguageError = (detail) =>
  typeof detail === 'string' && UNSUPPORTED_LANGUAGE_RE.test(detail);

const getStatusCode = (err) => {
  const status =
    err?.statusCode ??
    err?.status ??
    err?.response?.status ??
    err?.response?.statusCode ??
    err?.details?.status;
  return typeof status === 'number' ? status : 500;
};

const getErrorDetail = (err) =>
  err?.body?.detail ||
  err?.details?.detail ||
  err?.response?.data?.detail ||
  err?.message ||
  'Unknown error';

const getRequestId = (err) => {
  if (err?.body?.requestid) return err.body.requestid;
  const rawHeaders = err?.rawResponse?.headers;
  if (rawHeaders?.get) {
    return (
      rawHeaders.get('x-request-id') ||
      rawHeaders.get('x-corti-request-id') ||
      rawHeaders.get('x-requestid') ||
      null
    );
  }
  return (
    err?.response?.headers?.['x-request-id'] ||
    err?.response?.headers?.['x-corti-request-id'] ||
    err?.response?.headers?.['x-requestid'] ||
    null
  );
};

const isFfmpegMissing = (err) =>
  err?.code === 'ENOENT' || /ffmpeg/i.test(String(err?.message || ''));

const buildLanguageCandidates = (language) => {
  const candidates = [];
  const push = (value) => {
    if (!value) return;
    if (!candidates.includes(value)) candidates.push(value);
  };
  push(language);
  if (typeof language === 'string' && language.includes('-')) {
    const base = language.split('-')[0];
    push(base);
  }
  push(CORTI_SPEECH_FALLBACK);
  return candidates;
};

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

router.get('/health', (_req, res) => {
  return res.json({ ok: true, service: 'corti', ts: new Date().toISOString() });
});

router.get('/capabilities', (_req, res) => {
  return res.json({
    ok: true,
    allowlist: CORTI_SPEECH_ALLOWLIST,
    fallback: CORTI_SPEECH_FALLBACK,
    speechLanguages: CORTI_SPEECH_ALLOWLIST,
    fallbackLanguage: CORTI_SPEECH_FALLBACK,
  });
});

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
    const rawLang = req.query?.lang || 'da';
    const normalizedLang = String(rawLang || '').trim().replace(/_/g, '-');
    const baseLang = normalizedLang.includes('-')
      ? normalizedLang.split('-')[0]
      : normalizedLang;
    const lang = baseLang || 'da';
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

  const rawDictationLanguage =
    req.body?.dictationLanguage || req.body?.speechLanguage || req.body?.language || req.body?.locale || req.body?.lang || '';
  const uiLocale = req.body?.uiLocale || '';
  const browserLocale = req.body?.browserLocale || '';
  const explicitSpeechLanguage =
    rawDictationLanguage && rawDictationLanguage !== 'auto' ? rawDictationLanguage : '';
  const chosenLanguage = resolveSpeechLanguage({
    speechLanguage: explicitSpeechLanguage,
    browserLocale,
  });
  const languageCandidates = buildLanguageCandidates(chosenLanguage);
  const attemptedLanguage = languageCandidates[0] || CORTI_SPEECH_FALLBACK;
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
      if (isFfmpegMissing(err)) {
        if (!ffmpegMissingLogged && !global.__ffmpegMissingLogged) {
          console.warn('[ffmpeg] not found; skipping transcode and using original audio.');
        }
        ffmpegMissingLogged = true;
        global.__ffmpegMissingLogged = true;
      } else {
        console.error('ffmpeg transcode failed (continuing with original file):', err);
      }
      transcodeFailed = true;
      wavPath = filePath;
    }
  }

  try {
    console.log('[corti] dictate language', {
      raw: rawDictationLanguage,
      uiLocale,
      browserLocale,
      chosen: chosenLanguage,
      candidates: languageCandidates,
    });
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

    const createTranscript = async (languageToUse) =>
      cortiClient.transcripts.create(
        interactionId,
        {
          recordingId,
          primaryLanguage: languageToUse,
          isDictation: true,
        },
        { tenantName: process.env.CORTI_TENANT_NAME }
      );

    let transcriptResponse = null;
    let usedLanguage = null;
    let fallbackUsed = false;
    let lastRequestId = null;

    for (let i = 0; i < languageCandidates.length; i += 1) {
      const candidate = languageCandidates[i];
      try {
        transcriptResponse = await createTranscript(candidate);
        usedLanguage = candidate;
        fallbackUsed = i > 0;
        if (fallbackUsed) {
          console.info('[DICTATE] fallback_used', {
            attempted: attemptedLanguage,
            used: usedLanguage,
            requestId: lastRequestId || null,
          });
        }
        break;
      } catch (error) {
        const detail = getErrorDetail(error);
        const requestId = getRequestId(error);
        lastRequestId = requestId || lastRequestId;
        if (isUnsupportedLanguageError(detail)) {
          const nextCandidate = languageCandidates[i + 1];
          if (nextCandidate) {
            console.warn('[corti] unsupported language, retry', {
              attempted: candidate,
              next: nextCandidate,
              requestId: requestId || null,
            });
            continue;
          }
          return res.status(400).json({
            ok: false,
            code: 'UNSUPPORTED_LANGUAGE',
            detail,
            attempted: attemptedLanguage,
            fallback: CORTI_SPEECH_FALLBACK,
            requestId: requestId || lastRequestId,
          });
        }
        throw error;
      }
    }

    if (!transcriptResponse) {
      return res.status(502).json({
        ok: false,
        code: 'TRANSCRIPT_CREATE_FAILED',
        detail: 'Failed to create transcript.',
        attempted: attemptedLanguage,
        fallback: CORTI_SPEECH_FALLBACK,
      });
    }

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
      ok: true,
      text,
      interactionId,
      recordingId,
      transcriptId: transcriptId || null,
      status,
      usedLanguage: usedLanguage || chosenLanguage,
      attemptedLanguage,
      fallbackUsed,
      language: usedLanguage || chosenLanguage,
      usedFallback: fallbackUsed,
      attempted: attemptedLanguage,
      fallback: CORTI_SPEECH_FALLBACK,
    });
  } catch (error) {
    console.error('Corti dictation error:', error?.response?.data || error);
    const status = getStatusCode(error);
    const detail = getErrorDetail(error);
    const requestId = getRequestId(error);
    if (isUnsupportedLanguageError(detail)) {
      return res.status(400).json({
        ok: false,
        code: 'UNSUPPORTED_LANGUAGE',
        detail,
        attempted: attemptedLanguage,
        fallback: CORTI_SPEECH_FALLBACK,
        requestId,
      });
    }
    return res.status(status).json({
      ok: false,
      code: status >= 500 ? 'UPSTREAM_ERROR' : 'REQUEST_FAILED',
      detail,
      requestId,
      error: detail,
      details: error?.details || error?.body || error?.response?.data || null,
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
    const status = getStatusCode(error);
    const detail = getErrorDetail(error);
    const requestId = getRequestId(error);
    return res.status(status).json({
      ok: false,
      code: status >= 500 ? 'UPSTREAM_ERROR' : 'REQUEST_FAILED',
      detail,
      requestId,
      error: detail || error?.message || 'Failed to create document',
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
