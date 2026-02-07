const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { getAccessToken } = require('../cortiAuth');
const {
  resolveSpeechLanguage,
  CORTI_SPEECH_FALLBACK,
  isSpeechLanguageAllowed,
} = require('../server/utils/cortiLanguages');

const UNSUPPORTED_LANGUAGE_RE = /unsupported language|language unavailable/i;

const MAX_PREVIEW_LEN = 120;

const sanitizePreview = (value) =>
  String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, MAX_PREVIEW_LEN);

function createCortiTranscribeWss() {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  wss.on('connection', async (client) => {
    let cortiSocket = null;
    let configured = false;
    let configLocked = false;
    let lastConfig = null;
    let attemptedLanguage = null;
    let fallbackAttempted = false;
    const queue = [];

    const sendDebug = (event) => {
      try {
        client.send(JSON.stringify({ type: 'DEBUG', event }));
      } catch (_) {}
    };

    const forwardToCorti = (data, isBinary, isConfig = false) => {
      if (cortiSocket && cortiSocket.readyState === WebSocket.OPEN) {
        cortiSocket.send(data, { binary: isBinary });
        if (isConfig) {
          console.log('[TRANSCRIBE] FORWARDED_CONFIG_TO_CORTI');
          sendDebug('FORWARDED_CONFIG_TO_CORTI');
        }
        return true;
      }
      queue.push({ data, isBinary, isConfig });
      return false;
    };

    client.on('message', (data, isBinary) => {
      const byteLen = typeof data === 'string' ? Buffer.byteLength(data) : data?.length || 0;
      console.log(`[TRANSCRIBE] from client isBinary=${isBinary} len=${byteLen}`);

      if (!isBinary) {
        const text =
          typeof data === 'string'
            ? data
            : Buffer.isBuffer(data)
            ? data.toString('utf8')
            : String(data);
        const trimmed = text.trim();
        if (!trimmed) return;
        console.log('[TRANSCRIBE] FROM_CLIENT_TEXT', sanitizePreview(text));

        let parsed = null;
        if (trimmed.startsWith('{')) {
          try {
            parsed = JSON.parse(text);
          } catch (_) {}
        }

        if (parsed?.type === 'config') {
          console.log('[TRANSCRIBE] CLIENT_CONFIG_RECEIVED', parsed?.configuration || null);
          sendDebug('CLIENT_CONFIG_RECEIVED');
          if (configLocked) {
            console.log('[TRANSCRIBE] CONFIG_IGNORED');
            sendDebug('CONFIG_IGNORED');
            return;
          }
          configLocked = true;
          const requestedLanguage = parsed?.configuration?.primaryLanguage || null;
          const browserLocale = parsed?.configuration?.browserLocale || '';
          const resolvedLanguage = resolveSpeechLanguage({
            speechLanguage: requestedLanguage,
            browserLocale,
          });
          const allowlistedLanguage = isSpeechLanguageAllowed(resolvedLanguage)
            ? resolvedLanguage
            : CORTI_SPEECH_FALLBACK;
          attemptedLanguage = allowlistedLanguage;
          parsed.configuration = {
            ...(parsed.configuration || {}),
            primaryLanguage: allowlistedLanguage,
          };
          lastConfig = parsed;
          const normalizedConfig = JSON.stringify(parsed);
          forwardToCorti(normalizedConfig, false, true);
          return;
        }

        forwardToCorti(text, false, parsed?.type === 'config');
        return;
      }

      forwardToCorti(data, true, false);
    });

    try {
      const token = await getAccessToken();
      const env = (process.env.CORTI_ENVIRONMENT || process.env.CORTI_ENV || 'eu').toLowerCase();
      const tenant = process.env.CORTI_TENANT_NAME;

      if (!tenant) {
        throw new Error('Missing CORTI_TENANT_NAME');
      }

      const wsUrl =
        `wss://api.${env}.corti.app/audio-bridge/v2/transcribe` +
        `?tenant-name=${encodeURIComponent(tenant)}` +
        `&token=${encodeURIComponent(`Bearer ${token}`)}`;

      cortiSocket = new WebSocket(wsUrl, { perMessageDeflate: false });

      cortiSocket.on('open', () => {
        queue.splice(0).forEach((msg) => {
          try {
            cortiSocket.send(msg.data, { binary: msg.isBinary });
            if (msg.isConfig) {
              console.log('[TRANSCRIBE] FORWARDED_CONFIG_TO_CORTI');
              sendDebug('FORWARDED_CONFIG_TO_CORTI');
            }
          } catch (_) {}
        });

        console.log('[TRANSCRIBE] UPSTREAM_OPEN -> proxy_ready');
        try {
          client.send(JSON.stringify({ type: 'proxy_ready' }));
        } catch (_) {}
      });

      cortiSocket.on('message', (data, isBinary) => {
        if (client.readyState !== WebSocket.OPEN) return;

        if (isBinary) {
          client.send(data, { binary: true });
          return;
        }

        const payload = typeof data === 'string' ? data : data.toString();
        try {
          const parsed = JSON.parse(payload);
          if (parsed?.type === 'CONFIG_ACCEPTED') {
            console.log('[TRANSCRIBE] FROM_CORTI', parsed?.type, parsed?.reason || '');
            configured = true;
          } else if (parsed?.type === 'CONFIG_DENIED' || parsed?.type === 'CONFIG_TIMEOUT') {
            console.log('[TRANSCRIBE] FROM_CORTI', parsed?.type, parsed?.reason || '');
            const reason =
              parsed?.reason ||
              parsed?.error?.details ||
              parsed?.error?.detail ||
              parsed?.error?.message ||
              parsed?.error?.title ||
              '';
            if (
              !fallbackAttempted &&
              UNSUPPORTED_LANGUAGE_RE.test(String(reason || '')) &&
              lastConfig &&
              cortiSocket?.readyState === WebSocket.OPEN
            ) {
              fallbackAttempted = true;
              const fallbackConfig = {
                ...lastConfig,
                configuration: {
                  ...(lastConfig.configuration || {}),
                  primaryLanguage: CORTI_SPEECH_FALLBACK,
                },
              };
              try {
                cortiSocket.send(JSON.stringify(fallbackConfig));
                client.send(
                  JSON.stringify({
                    type: 'warning',
                    code: 'FALLBACK_LANGUAGE',
                    attempted: attemptedLanguage || null,
                    fallback: CORTI_SPEECH_FALLBACK,
                  })
                );
                console.log('[TRANSCRIBE] RETRY_FALLBACK', {
                  attempted: attemptedLanguage,
                  fallback: CORTI_SPEECH_FALLBACK,
                });
                return;
              } catch (_) {}
            }
          }
        } catch (_) {}

        client.send(payload);
      });

      const closeBoth = () => {
        try {
          client.close();
        } catch (_) {}
        try {
          cortiSocket?.close();
        } catch (_) {}
      };

      client.on('close', closeBoth);
      client.on('error', closeBoth);
      cortiSocket.on('close', closeBoth);
      cortiSocket.on('error', (err) => {
        try {
          client.send(
            JSON.stringify({
              type: 'error',
              error: { title: 'Corti WS error', details: err?.message || String(err) },
            })
          );
        } catch (_) {}
        closeBoth();
      });
    } catch (error) {
      try {
        client.send(
          JSON.stringify({
            type: 'error',
            error: { title: 'Proxy init failed', details: error?.message || String(error) },
          })
        );
      } catch (_) {}
      try {
        client.close();
      } catch (_) {}
      try {
        cortiSocket?.close();
      } catch (_) {}
    }
  });

  return wss;
}

module.exports = { createCortiTranscribeWss };
