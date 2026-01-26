const express = require('express');
const crypto = require('crypto');
const { createCortiClient } = require('../../cortiAuth');
const { extractTextFromTask, getOrCreateAgentId } = require('../corti/agentRegistry');

const router = express.Router();
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


router.get('/ping', (_req, res) => {
  return res.json({ ok: true });
});

router.post('/init', async (_req, res) => {
  try {
    const cortiClient = await createCortiClient();
    const agentId = await getOrCreateAgentId('rehab', cortiClient);
    return res.json({ ok: true, agentId });
  } catch (error) {
    const status = error?.response?.status || 500;
    const msg = error?.message || 'Failed to init rehab agent';
    console.error('[REHAB_AGENT_INIT] error:', msg);
    return res.status(status).json({ ok: false, error: msg });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { sourceText, question, preferredLanguage } = req.body || {};
    const ctx = `${sourceText || ''}`.trim();
    if (!ctx) {
      return res.status(400).json({ ok: false, error: 'Missing sourceText' });
    }

    const cortiClient = await createCortiClient();
    const agentId = await getOrCreateAgentId('rehab', cortiClient);
    const task = `${question || 'Create Plan + HEP based on the notes.'}`.trim();

    const prompt = `
SOURCE TEXT:
<<<
${ctx}
>>>

REQUEST:
${appendOutputLanguage(task, preferredLanguage)}
`.trim();

    const payload = {
      message: {
        role: 'user',
        kind: 'message',
        messageId: crypto.randomUUID(),
        parts: [{ kind: 'text', text: prompt }],
      },
    };

    const resp = await cortiClient.agents.messageSend(agentId, payload, {
      tenantName: process.env.CORTI_TENANT_NAME,
    });

    const text =
      extractTextFromTask(resp?.task || resp) ||
      extractTextFromTask(resp?.task?.status || resp?.status) ||
      resp?.text ||
      '';

    if (!text) {
      throw new Error('Empty response from Corti');
    }

    return res.json({ ok: true, text });
  } catch (error) {
    const status = error?.response?.status || 500;
    const msg = error?.message || 'Failed to send rehab agent message';
    console.error('[REHAB_AGENT_CHAT] error:', msg);
    return res.status(status).json({ ok: false, error: msg });
  }
});

module.exports = router;
