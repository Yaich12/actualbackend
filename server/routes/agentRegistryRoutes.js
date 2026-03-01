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
    console.warn('[AgentRegistry] context fetch failed:', error?.message);
  }
  return '';
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

    let task = resp?.task || null;
    let reply =
      extractTextFromTask(task) ||
      extractTextFromTask(resp?.task || resp) ||
      extractTextFromTask(resp?.task?.status || resp?.status) ||
      resp?.text ||
      '';

    if (!reply) {
      const taskId = resolveTaskId(resp);
      let pollTimedOut = false;
      if (taskId) {
        try {
          const polled = await pollTaskUntilDone(cortiClient, agentId, taskId);
          task = polled?.task || task;
          reply =
            polled?.text ||
            extractTextFromTask(task) ||
            extractTextFromTask(task?.status) ||
            resp?.text ||
            '';
        } catch (pollError) {
          if (pollError?.code !== 'TASK_POLL_TIMEOUT') {
            throw pollError;
          }
          pollTimedOut = true;
          task = pollError?.task || task;
        }
      }
      if (!reply) {
        const contextId = resolveContextId(resp, task);
        reply = await tryExtractReplyFromContext(cortiClient, agentId, contextId);
      }
      if (!reply && pollTimedOut) {
        const timeoutError = new Error('Task polling timed out');
        timeoutError.code = 'TASK_POLL_TIMEOUT';
        throw timeoutError;
      }
    }

    if (!reply) {
      console.warn('[AgentRegistry] empty reply', {
        key,
        agentId,
        taskId: resolveTaskId(resp),
        taskState: task?.status?.state || task?.state || null,
        hasTask: Boolean(task),
        hasRespMessage: Boolean(resp?.message),
        hasRespTask: Boolean(resp?.task),
      });
      throw new Error('Empty response from Corti');
    }

    return res.json({ ok: true, reply });
  } catch (error) {
    if (error?.code === 'AGENT_ID_MISSING') {
      return res.status(502).json({ ok: false, error: 'agentId missing', raw: error.raw });
    }
    const status = error?.code === 'TASK_POLL_TIMEOUT' ? 504 : getStatusCode(error);
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
