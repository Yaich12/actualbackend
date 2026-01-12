const express = require('express');
const { createCortiClient, getAccessToken } = require('../cortiAuth');

const router = express.Router();

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
