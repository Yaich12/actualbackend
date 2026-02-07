const express = require('express');
const crypto = require('crypto');
const { createCortiClient } = require('../../cortiAuth');
const { extractTextFromTask, getOrCreateAgentId, resolveAgentConfig } = require('../corti/agentRegistry');

const router = express.Router();
const DEFAULT_LANGUAGE = 'en';

const getStatusCode = (err) =>
  err?.statusCode ||
  err?.status ||
  err?.response?.status ||
  err?.response?.statusCode ||
  err?.details?.status ||
  500;

const getErrorDetail = (err) =>
  err?.body?.detail ||
  err?.details?.detail ||
  err?.response?.data?.detail ||
  err?.message ||
  'Unknown error';

const getRequestId = (err) =>
  err?.body?.requestid ||
  err?.rawResponse?.headers?.get?.('x-request-id') ||
  err?.response?.headers?.['x-request-id'] ||
  err?.response?.headers?.['x-corti-request-id'] ||
  err?.response?.headers?.['x-requestid'] ||
  null;

const getErrorCode = (err) => err?.body?.code || err?.code || null;

const resolvePreferredLanguage = (value) => {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;
  const trimmed = value.trim();
  return trimmed || DEFAULT_LANGUAGE;
};

const appendOutputLanguage = (message, preferredLanguage) => {
  const language = resolvePreferredLanguage(preferredLanguage);
  return `${message}\n\nOUTPUT_LANGUAGE: ${language}\nPlease respond in this language.\nUse Markdown headings starting with ### for each section. Do not return a single block without headings.`.trim();
};

router.post('/:key/init', async (req, res) => {
  try {
    const { key } = req.params;
    if (!resolveAgentConfig(key)) {
      return res.status(404).json({ ok: false, error: 'Unknown agent key' });
    }
    const cortiClient = await createCortiClient();
    const agentId = await getOrCreateAgentId(key, cortiClient);
    console.log('[AgentRegistry] init', key, agentId);
    return res.json({ ok: true, agentId });
  } catch (error) {
    if (error?.code === 'AGENT_ID_MISSING') {
      return res.status(502).json({ ok: false, error: 'agentId missing', raw: error.raw });
    }
    const status = getStatusCode(error);
    const detail = getErrorDetail(error);
    const requestId = getRequestId(error);
    const code = getErrorCode(error) || (status >= 500 ? 'UPSTREAM_ERROR' : 'REQUEST_FAILED');
    console.error('[AgentRegistry] init error:', detail);
    return res.status(status).json({
      ok: false,
      code,
      detail,
      requestId,
      error: detail,
      howToFix: error?.body?.howToFix || null,
      details: error?.body || error?.response?.data || null,
    });
  }
});

router.post('/:key/chat', async (req, res) => {
  try {
    const { key } = req.params;
    if (!resolveAgentConfig(key)) {
      return res.status(404).json({ ok: false, error: 'Unknown agent key' });
    }
    const { message, sourceText, preferredLanguage } = req.body || {};
    const finalMessage = `${message || ''}`.trim();
    if (!finalMessage) {
      return res.status(400).json({ ok: false, error: 'Missing message' });
    }
    const ctx = `${sourceText || ''}`.trim() || finalMessage;
    const cortiClient = await createCortiClient();
    const agentId = await getOrCreateAgentId(key, cortiClient);
    console.log('[AgentRegistry] chat', key, 'len=', ctx.length);

    const prompt = `
SOURCE TEXT:
<<<
${ctx}
>>>

REQUEST:
${appendOutputLanguage(finalMessage, preferredLanguage)}
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

    const reply =
      extractTextFromTask(resp?.task || resp) ||
      extractTextFromTask(resp?.task?.status || resp?.status) ||
      resp?.text ||
      '';

    if (!reply) {
      throw new Error('Empty response from Corti');
    }

    return res.json({ ok: true, reply });
  } catch (error) {
    if (error?.code === 'AGENT_ID_MISSING') {
      return res.status(502).json({ ok: false, error: 'agentId missing', raw: error.raw });
    }
    const status = getStatusCode(error);
    const detail = getErrorDetail(error);
    const requestId = getRequestId(error);
    const code = getErrorCode(error) || (status >= 500 ? 'UPSTREAM_ERROR' : 'REQUEST_FAILED');
    console.error('[AgentRegistry] chat error:', detail);
    return res.status(status).json({
      ok: false,
      code,
      detail,
      requestId,
      error: detail,
      howToFix: error?.body?.howToFix || null,
      details: error?.body || error?.response?.data || null,
    });
  }
});

module.exports = router;
