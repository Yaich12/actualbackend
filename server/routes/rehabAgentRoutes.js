const express = require('express');
const crypto = require('crypto');
const { createCortiClient } = require('../../cortiAuth');
const { extractTextFromTask, getOrCreateAgentId } = require('../corti/agentRegistry');

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

const TERMINAL_STATES = new Set([
  'completed',
  'failed',
  'canceled',
  'rejected',
  'input-required',
  'auth-required',
  'unknown',
]);
const RETRYABLE_STATES = new Set(['submitted', 'working']);
const POLL_TIMEOUT_MS = Number.parseInt(process.env.CORTI_AGENT_POLL_TIMEOUT_MS || '', 10) || 120000;
const POLL_INTERVAL_MS = Number.parseInt(process.env.CORTI_AGENT_POLL_INTERVAL_MS || '', 10) || 1000;

const resolveTaskId = (resp) =>
  resp?.task?.id ||
  resp?.taskId ||
  resp?.task?.taskId ||
  resp?.task?.status?.taskId ||
  resp?.message?.taskId ||
  (Array.isArray(resp?.message?.referenceTaskIds) ? resp.message.referenceTaskIds[0] : null) ||
  (resp?.kind === 'task' ? resp?.id : null) ||
  null;

const resolveContextId = (resp, task = null) =>
  task?.contextId ||
  resp?.task?.contextId ||
  resp?.message?.contextId ||
  resp?.contextId ||
  null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pollTaskUntilDone = async (
  client,
  agentId,
  taskId,
  timeoutMs = POLL_TIMEOUT_MS,
  intervalMs = POLL_INTERVAL_MS
) => {
  const startedAt = Date.now();
  let lastTask = null;
  let lastState = 'unknown';

  while (Date.now() - startedAt < timeoutMs) {
    const task = await client.agents.getTask(agentId, taskId, {
      tenantName: process.env.CORTI_TENANT_NAME,
    });
    lastTask = task;
    const state = `${task?.status?.state || task?.state || 'unknown'}`.toLowerCase();
    lastState = state || 'unknown';

    const text =
      extractTextFromTask(task) ||
      extractTextFromTask(task?.status) ||
      '';
    if (text) {
      return { task, text, state: lastState };
    }

    if (TERMINAL_STATES.has(lastState) || !RETRYABLE_STATES.has(lastState)) {
      return { task, text: '', state: lastState };
    }

    await sleep(intervalMs);
  }

  const timeoutError = new Error('Task polling timed out');
  timeoutError.code = 'TASK_POLL_TIMEOUT';
  timeoutError.task = lastTask;
  timeoutError.taskState = lastState;
  timeoutError.taskId = taskId;
  throw timeoutError;
};

const tryExtractReplyFromContext = async (client, agentId, contextId) => {
  if (!contextId) return '';
  try {
    const context = await client.agents.getContext(
      agentId,
      contextId,
      { limit: 100, offset: 0 },
      { tenantName: process.env.CORTI_TENANT_NAME }
    );
    const items = Array.isArray(context?.items) ? context.items : [];
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const text =
        extractTextFromTask(items[i]) ||
        extractTextFromTask(items[i]?.status) ||
        '';
      if (text) return text;
    }
  } catch (error) {
    console.warn('[REHAB_AGENT_CHAT] context fetch failed:', error?.message);
  }
  return '';
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
    const status = getStatusCode(error);
    const detail = getErrorDetail(error);
    const requestId = getRequestId(error);
    const code = getErrorCode(error) || (status >= 500 ? 'UPSTREAM_ERROR' : 'REQUEST_FAILED');
    console.error('[REHAB_AGENT_INIT] error:', detail);
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

    let text =
      extractTextFromTask(resp?.task || resp) ||
      extractTextFromTask(resp?.task?.status || resp?.status) ||
      resp?.text ||
      '';

    if (!text) {
      const taskId = resolveTaskId(resp);
      let pollTimedOut = false;
      if (taskId) {
        try {
          const polled = await pollTaskUntilDone(cortiClient, agentId, taskId);
          const task = polled?.task || null;
          text =
            polled?.text ||
            extractTextFromTask(task) ||
            extractTextFromTask(task?.status) ||
            '';
        } catch (pollError) {
          if (pollError?.code !== 'TASK_POLL_TIMEOUT') {
            throw pollError;
          }
          pollTimedOut = true;
          const contextId = resolveContextId(resp, pollError?.task);
          text = await tryExtractReplyFromContext(cortiClient, agentId, contextId);
          if (!text) {
            const timeoutError = new Error('Task polling timed out');
            timeoutError.code = 'TASK_POLL_TIMEOUT';
            throw timeoutError;
          }
        }
      }
      if (!text && !pollTimedOut) {
        const contextId = resolveContextId(resp);
        text = await tryExtractReplyFromContext(cortiClient, agentId, contextId);
      }
    }

    if (!text) {
      throw new Error('Empty response from Corti');
    }

    return res.json({ ok: true, text });
  } catch (error) {
    const status = error?.code === 'TASK_POLL_TIMEOUT' ? 504 : getStatusCode(error);
    const detail = getErrorDetail(error);
    const requestId = getRequestId(error);
    const code = getErrorCode(error) || (status >= 500 ? 'UPSTREAM_ERROR' : 'REQUEST_FAILED');
    console.error('[REHAB_AGENT_CHAT] error:', detail);
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
