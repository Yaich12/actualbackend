const express = require('express');
const crypto = require('crypto');
const { createCortiClient } = require('../../cortiAuth');
const { extractTextFromTask, getOrCreateAgentId, resolveAgentConfig } = require('../corti/agentRegistry');

const router = express.Router();

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
    const status = error?.response?.status || 500;
    const msg = error?.message || 'Failed to init agent';
    console.error('[AgentRegistry] init error:', msg);
    return res.status(status).json({ ok: false, error: msg });
  }
});

router.post('/:key/chat', async (req, res) => {
  try {
    const { key } = req.params;
    if (!resolveAgentConfig(key)) {
      return res.status(404).json({ ok: false, error: 'Unknown agent key' });
    }
    const { message, sourceText } = req.body || {};
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
${finalMessage}
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
    const status = error?.response?.status || 500;
    const msg = error?.message || 'Failed to send agent message';
    console.error('[AgentRegistry] chat error:', msg);
    return res.status(status).json({ ok: false, error: msg });
  }
});

module.exports = router;
