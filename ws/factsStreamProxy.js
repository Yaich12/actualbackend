const { WebSocketServer } = require('ws');
const { CortiClient } = require('@corti/sdk');
const { getAccessToken, resolvedEnvironment } = require('../cortiAuth');

const isInvalidInteractionId = (value) => {
  if (!value) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  const lowered = trimmed.toLowerCase();
  if (['null', 'undefined', 'false', 'nan'].includes(lowered)) return true;
  if (/\s/.test(trimmed)) return true;
  return false;
};

function createFactsStreamWss() {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  wss.on('connection', async (clientWs, req) => {
    const url = new URL(req.url, 'http://localhost');
    const interactionId = url.searchParams.get('interactionId');
    const primaryLanguage = url.searchParams.get('primaryLanguage') || 'da';
    const outputLocale = url.searchParams.get('outputLocale') || 'da';

    if (isInvalidInteractionId(interactionId)) {
      clientWs.send(
        JSON.stringify({ type: 'error', error: 'Missing or invalid interactionId' })
      );
      clientWs.close();
      return;
    }

    let cortiSocket = null;
    try {
      const accessToken = await getAccessToken();
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
            cortiSocket.sendAudio(txt);
            return;
          }
          if (msg?.type === 'flush') {
            cortiSocket.sendFlush({ type: 'flush' });
            return;
          }
          if (msg?.type === 'end') {
            cortiSocket.sendEnd({ type: 'end' });
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

  return wss;
}

module.exports = { createFactsStreamWss };
