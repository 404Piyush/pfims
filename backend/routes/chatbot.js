const express = require('express');
const { body } = require('express-validator');
const fetch = global.fetch || require('node-fetch');
const { auth } = require('../middleware/auth');
const { handleValidationErrors, apiRateLimit, expensiveOperationSlowDown, sanitizeRequest } = require('../middleware/validation');
const ChatSession = require('../models/ChatSession');

const router = express.Router();

// Static system context describing PFIMS capabilities
const SYSTEM_PROMPT = `You are PFIMS Assistant, an AI-powered budget management chatbot.
You help users manage personal finances inside the PFIMS app.
Capabilities:
- Explain budgets, categories (income/expense), and transactions
- Suggest budget allocations and savings strategies
- Provide spending insights using user data when provided
- Answer questions about PFIMS features and how to use them

Guidelines:
- Be concise, accurate, and helpful
- When giving numbers, state assumptions if data is missing
- Never reveal secrets, tokens, or internal IDs
- Do not repeat the greeting. Respond directly to the user's latest message.
- If the user greets, acknowledge briefly and proceed to answer or ask clarifying questions.
- If a request is outside financial guidance, respond briefly and steer back to budgeting.
`;

const INITIAL_GREETING = "Hi! I'm your PFIMS budget assistant. How can I help today?";
const MAX_HISTORY_ITEMS_DEFAULT = 12;
const ENABLE_ATLAS_FALLBACK = process.env.ENABLE_ATLAS_FALLBACK === 'true';
// Add global debug flag that can be toggled via env
const DEBUG_LOG = process.env.CHATBOT_DEBUG === 'true';

// Add a safe fetch timeout helper
const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const extractAssistantMessage = (data) => {
  return (
    data?.message?.content ||
    data?.content ||
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    ''
  );
};

const extractFinishReason = (data) => {
  return (
    data?.choices?.[0]?.finish_reason ||
    data?.choices?.[0]?.finishReason ||
    data?.done_reason ||
    data?.doneReason ||
    data?.finish_reason ||
    data?.finishReason ||
    ''
  );
};

const looksTruncated = (text) => {
  const t = String(text || '').trim();
  if (t.length < 200) return false;
  if (/[.!?]["')\]]?\s*$/.test(t)) return false;
  if (t.endsWith('```')) return false;
  if (/Actionable Next Steps\s*:\s*$/i.test(t)) return true;
  if (/3\)\s*Actionable Next Steps\s*:\s*$/i.test(t)) return true;
  const actionIdx = t.toLowerCase().lastIndexOf('actionable next steps:');
  if (actionIdx !== -1) {
    const after = t.slice(actionIdx + 'actionable next steps:'.length).trim();
    if (!after) return true;
  }
  if (t.endsWith(':')) return true;
  const lastLine = t.split('\n').slice(-1)[0] || '';
  if (lastLine.length > 0 && lastLine.length < 20) return true;
  return true;
};

// Helper to derive a concise title from the first user message
const deriveTitle = (text) => {
  if (!text) return 'New Chat';
  let clean = String(text);
  // If message contains a Context/Question format, prefer the question part
  const lower = clean.toLowerCase();
  const qIdx = lower.indexOf('question:');
  if (qIdx !== -1) {
    clean = clean.slice(qIdx + 'question:'.length);
  }
  // Remove leading "Context:" if present
  if (clean.trim().toLowerCase().startsWith('context:')) {
    clean = clean.replace(/^context:\s*/i, '');
  }
  // Normalize whitespace and trim
  clean = clean.replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').slice(0, 8).join(' ');
  return words || 'New Chat';
};

// POST /api/chatbot/message
router.post(
  '/message',
  sanitizeRequest,
  apiRateLimit,
  expensiveOperationSlowDown,
  [
    body('message')
      .trim()
      .isLength({ min: 1, max: 8000 })
      .withMessage('Message must be between 1 and 8000 characters'),
    body('extraContext')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 60000 })
      .withMessage('extraContext must be at most 60000 characters'),
    body('history')
      .optional()
      .isArray()
      .withMessage('History must be an array of { role, content }'),
    body('includeContext')
      .optional()
      .isBoolean()
      .withMessage('includeContext must be a boolean'),
    body('debug')
      .optional()
      .isBoolean()
      .withMessage('debug must be a boolean'),
    body('lite')
      .optional()
      .isBoolean()
      .withMessage('lite must be a boolean'),
    body('provider')
      .optional()
      .isString()
      .withMessage('provider must be a string ("ollama" or "openrouter")'),
    body('sessionId')
      .optional({ nullable: true, checkFalsy: true })
      .isMongoId()
      .withMessage('sessionId must be a valid Mongo ID')
  ],
  handleValidationErrors,
  auth,
  async (req, res) => {
    try {
      const { message, extraContext = '', history = [], includeContext = true, debug = false, lite = false, sessionId: clientSessionId } = req.body;
      const shouldDebug = debug || DEBUG_LOG;
      const userId = req.user?._id || req.user?.id || 'unknown';
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
      const baseModel = process.env.OLLAMA_MODEL || 'meta-llama-3-8b-instruct-q4km';
      const liteModel = process.env.OLLAMA_MODEL_LITE || baseModel;
      const openrouterUrl = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
      const openrouterApiKey = process.env.OPENROUTER_API_KEY || process.env.ATLASCLOUD_API_KEY;
      const openrouterBaseModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
      const openrouterReferer = process.env.OPENROUTER_REFERER || process.env.CLIENT_URL;
      const openrouterAppName = process.env.OPENROUTER_APP_NAME || 'PFIMS';

      const requestedProvider = String(req.body?.provider || '').trim().toLowerCase();
      const provider =
        requestedProvider === 'ollama'
          ? 'ollama'
          : (requestedProvider === 'atlas' || requestedProvider === 'openrouter')
            ? 'openrouter'
            : (openrouterApiKey ? 'openrouter' : 'ollama');

      const model = lite
        ? (provider === 'openrouter' ? openrouterBaseModel : liteModel)
        : (provider === 'openrouter' ? openrouterBaseModel : baseModel);

      // Timeouts tuned with frontend's chatbot request timeout
      const openrouterTimeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || process.env.ATLAS_TIMEOUT_MS || 55000);
      const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);
      const fallbackTimeoutMs = Number(process.env.FALLBACK_TIMEOUT_MS || 30000);

      // Load or create chat session and build history from DB
      let session;
      if (clientSessionId) {
        session = await ChatSession.findOne({ _id: clientSessionId, user: userId });
        if (!session) {
          return res.status(404).json({ success: false, message: 'Chat session not found' });
        }
      } else {
        session = new ChatSession({ user: userId, title: deriveTitle(message) });
      }

      // Build history from session messages
      let filteredHistory = (Array.isArray(session?.messages) ? session.messages : [])
        .filter(m => typeof m?.content === 'string' && ['user', 'assistant', 'system'].includes(m.role))
        .filter((m, idx) => {
          if (m.role === 'assistant') {
            const isInitialGreeting = m.content.trim() === INITIAL_GREETING;
            const isDebugLine = m.content.trim().startsWith('Debug:');
            const isErrorPlaceholder = m.content.trim() === 'I hit an error. Please try again.';
            return !(isInitialGreeting || isDebugLine || isErrorPlaceholder);
          }
          return true;
        })
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

      // Cap conversation history to last N turns to keep context focused
      const maxHistory = lite ? 6 : MAX_HISTORY_ITEMS_DEFAULT;
      if (filteredHistory.length > maxHistory) {
        filteredHistory = filteredHistory.slice(-maxHistory);
      }

      // Optionally drop context entirely if requested
      if (!includeContext) {
        filteredHistory = [];
      }

      // Compose messages for provider call (append current user message at the end)
      const combinedUserMessage = extraContext
        ? `${message}\n\n---\nAdditional data (do not repeat verbatim; use for analysis only):\n${String(extraContext).slice(0, 60000)}`
        : message;
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...filteredHistory,
        { role: 'user', content: combinedUserMessage }
      ];

      const options = {
        temperature: Number(process.env.OLLAMA_TEMPERATURE || 0.7),
        num_ctx: Number(process.env.OLLAMA_NUM_CTX || (lite ? 512 : 2048)),
        num_batch: Number(process.env.OLLAMA_NUM_BATCH || (lite ? 16 : 32))
      };

      const openrouterOptions = {
        temperature: Number(process.env.OPENROUTER_TEMPERATURE || 0.7),
        max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS || (lite ? 2048 : 4096)),
        top_p: Number(process.env.OPENROUTER_TOP_P || 0.9),
        top_k: Number(process.env.OPENROUTER_TOP_K || 50),
        repetition_penalty: Number(process.env.OPENROUTER_REPETITION_PENALTY || 1.1)
      };

      if (shouldDebug) {
        console.info('Chatbot request received', {
          userId,
          provider,
          lite,
          includeContext,
          openrouterTimeoutMs,
          historyCount: Array.isArray(filteredHistory) ? filteredHistory.length : 0
        });
      }

      const start = Date.now();
      let response;
      let openrouterReqStart;
      let openrouterReqEnd;
      const aiEndpoint = provider === 'openrouter' ? openrouterUrl : ollamaUrl;

      // Replace provider-specific fetches with timeout-wrapped calls and Atlas fallback on timeout
      if (provider === 'openrouter') {
        if (!openrouterApiKey) {
          return res.status(500).json({
            success: false,
            message: 'OpenRouter API key not configured'
          });
        }
        try {
          openrouterReqStart = Date.now();
          if (shouldDebug) {
            console.info('Chatbot[openrouter] request start', {
              userId,
              model,
              timeoutMs: openrouterTimeoutMs,
              historyCount: Array.isArray(filteredHistory) ? filteredHistory.length : 0,
              lite
            });
          }
          const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterApiKey}`
          };
          if (openrouterReferer) headers['HTTP-Referer'] = String(openrouterReferer);
          if (openrouterAppName) headers['X-Title'] = String(openrouterAppName);

          response = await fetchWithTimeout(openrouterUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model,
              messages,
              max_tokens: openrouterOptions.max_tokens,
              temperature: openrouterOptions.temperature,
              top_p: openrouterOptions.top_p,
              top_k: openrouterOptions.top_k,
              repetition_penalty: openrouterOptions.repetition_penalty,
              stream: false,
            })
          }, openrouterTimeoutMs);
          openrouterReqEnd = Date.now();
          if (shouldDebug) {
            console.info('Chatbot[openrouter] response received', {
              status: response.status,
              durationMs: openrouterReqEnd - openrouterReqStart
            });
          }
        } catch (openrouterErr) {
          const elapsed = openrouterReqStart ? Date.now() - openrouterReqStart : undefined;
          console.warn('Chatbot[openrouter] timeout/abort', {
            name: openrouterErr?.name,
            message: openrouterErr?.message,
            elapsedMs: elapsed,
            timeoutMs: openrouterTimeoutMs
          });
          if (!ENABLE_ATLAS_FALLBACK) {
            return res.status(502).json({
              success: false,
              message: 'AI service error (OpenRouter timeout)',
              details: openrouterErr?.message || 'OpenRouter request timed out',
              sessionId: session?._id,
              meta: shouldDebug ? {
                userId,
                provider: 'openrouter',
                aiEndpoint: openrouterUrl,
                model,
                mode: lite ? 'lite' : 'default',
                maxHistory: lite ? 6 : MAX_HISTORY_ITEMS_DEFAULT,
                durationMs: elapsed,
                timeouts: { openrouterTimeoutMs, fallbackTimeoutMs, ollamaTimeoutMs },
                timings: { start, requestStart: openrouterReqStart, requestEnd: Date.now() },
                error: { name: openrouterErr?.name, message: openrouterErr?.message }
              } : undefined
            });
          }
          // Timeout or network error contacting OpenRouter: fallback to Ollama with a shorter timeout
          try {
            const fbStart = Date.now();
            const fbResp = await fetchWithTimeout(ollamaUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: lite ? liteModel : baseModel,
                messages: messages,
                stream: false,
                options
              })
            }, fallbackTimeoutMs);
            const fbDurationMs = Date.now() - fbStart;
            if (fbResp.ok) {
              const fbData = await fbResp.json();
              const fbAssistantMessage = fbData?.message?.content || fbData?.content || fbData?.choices?.[0]?.message?.content || fbData?.choices?.[0]?.text || '';
              return res.json({
                success: true,
                data: {
                  reply: fbAssistantMessage,
                  meta: shouldDebug ? {
                    userId,
                    model: lite ? liteModel : baseModel,
                    options,
                    aiEndpoint: ollamaUrl,
                    provider: 'ollama',
                    durationMs: fbDurationMs,
                    mode: lite ? 'lite' : 'default',
                    maxHistory: lite ? 6 : MAX_HISTORY_ITEMS_DEFAULT,
                    timeouts: { openrouterTimeoutMs, fallbackTimeoutMs, ollamaTimeoutMs },
                    fallback: {
                      from: 'openrouter',
                      reason: `exception=${openrouterErr?.name || 'error'}:${(openrouterErr?.message || '').slice(0,64)}`
                    },
                    stats: {
                      prompt_eval_count: fbData?.prompt_eval_count,
                      eval_count: fbData?.eval_count,
                      done_reason: fbData?.done_reason,
                      usage: fbData?.usage
                    }
                  } : undefined
                }
              });
            } else {
              const fbErrText = await fbResp.text();
              console.error('Chatbot fallback error (timeout path)', {
                userId,
                status: fbResp.status,
                aiEndpoint: ollamaUrl,
                provider: 'ollama',
                errText: fbErrText?.slice(0, 1000)
              });
            }
          } catch (fbError) {
            console.error('Chatbot fallback exception (timeout path)', { message: fbError?.message });
          }
          return res.status(502).json({
            success: false,
            message: 'AI service error (OpenRouter timeout)',
            details: openrouterErr?.message || 'OpenRouter request timed out',
            sessionId: session?._id
          });
        }
      } else {
        response = await fetchWithTimeout(ollamaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: messages,
            stream: false,
            options
          })
        }, ollamaTimeoutMs);
      }

      // Append user message to session and save
      if (session) {
        session.messages.push({ role: 'user', content: message });
        session.lastActivityAt = new Date();
        await session.save();
      }

      const durationMs = Date.now() - start;
      if (!response.ok) {
        const errText = await response.text();
        const statusCode = response.status;
        const contentType = response.headers?.get ? (response.headers.get('content-type') || '') : '';
        const shouldFallback = ENABLE_ATLAS_FALLBACK && provider === 'openrouter' && (
          statusCode === 402 ||
          statusCode >= 500 ||
          contentType.includes('text/html')
        );

        if (shouldFallback) {
          try {
            const fbStart = Date.now();
            const fbResp = await fetchWithTimeout(ollamaUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: lite ? liteModel : baseModel,
                messages: messages,
                stream: false,
                options
              })
            }, fallbackTimeoutMs);
            const fbDurationMs = Date.now() - fbStart;
            if (fbResp.ok) {
              const fbData = await fbResp.json();
              const fbAssistantMessage = fbData?.message?.content || fbData?.content || fbData?.choices?.[0]?.message?.content || fbData?.choices?.[0]?.text || '';
              return res.json({
                success: true,
                data: {
                  reply: fbAssistantMessage,
                  meta: shouldDebug ? {
                    userId,
                    model: lite ? liteModel : baseModel,
                    options,
                    aiEndpoint: ollamaUrl,
                    provider: 'ollama',
                    durationMs: fbDurationMs,
                    mode: lite ? 'lite' : 'default',
                    maxHistory: lite ? 6 : MAX_HISTORY_ITEMS_DEFAULT,
                    timeouts: { openrouterTimeoutMs, fallbackTimeoutMs, ollamaTimeoutMs },
                    fallback: {
                      from: 'openrouter',
                      reason: `status=${statusCode}; contentType=${contentType.slice(0,64)}`
                    },
                    stats: {
                      prompt_eval_count: fbData?.prompt_eval_count,
                      eval_count: fbData?.eval_count,
                      done_reason: fbData?.done_reason,
                      usage: fbData?.usage
                    }
                  } : undefined
                }
              });
            } else {
              const fbErr = await fbResp.text();
              console.error('Chatbot fallback error', {
                userId,
                status: fbResp.status,
                aiEndpoint: ollamaUrl,
                provider: 'ollama',
                errText: fbErr?.slice(0, 1000)
              });
            }
          } catch (fbError) {
            console.error('Chatbot fallback exception', { message: fbError?.message });
          }
        }

        console.error('Chatbot error response', {
          userId,
          status: response.status,
          durationMs,
          model,
          options: provider === 'openrouter' ? openrouterOptions : options,
          aiEndpoint,
          provider,
          errText: errText?.slice(0, 1000)
        });
        return res.status(502).json({
          success: false,
          message: 'AI service error',
          details: errText,
          sessionId: session?._id,
          meta: shouldDebug ? { userId, model, options: provider === 'openrouter' ? openrouterOptions : options, aiEndpoint, provider, status: response.status, durationMs, mode: lite ? 'lite' : 'default', maxHistory: lite ? 6 : MAX_HISTORY_ITEMS_DEFAULT, timeouts: { openrouterTimeoutMs, fallbackTimeoutMs, ollamaTimeoutMs } } : undefined
        });
      }

      const data = await response.json();
      const assistantMessage = extractAssistantMessage(data);
      const finishReason = extractFinishReason(data);
      const shouldAutoContinue = ['length', 'max_tokens', 'max_tokens_reached'].includes(String(finishReason || '').toLowerCase()) || looksTruncated(assistantMessage);

      let fullAssistantMessage = assistantMessage;
      if (shouldAutoContinue && assistantMessage) {
        try {
          const contMessages = [
            ...messages,
            { role: 'assistant', content: assistantMessage },
            { role: 'user', content: 'Continue exactly where you left off. Do not repeat any previous text.' },
          ];

          const contResponse =
            provider === 'openrouter'
              ? await fetchWithTimeout(openrouterUrl, {
                  method: 'POST',
                  headers: (() => {
                    const headers = {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${openrouterApiKey}`
                    };
                    if (openrouterReferer) headers['HTTP-Referer'] = String(openrouterReferer);
                    if (openrouterAppName) headers['X-Title'] = String(openrouterAppName);
                    return headers;
                  })(),
                  body: JSON.stringify({
                    model,
                    messages: contMessages,
                    max_tokens: Math.min(2048, openrouterOptions.max_tokens),
                    temperature: openrouterOptions.temperature,
                    top_p: openrouterOptions.top_p,
                    top_k: openrouterOptions.top_k,
                    repetition_penalty: openrouterOptions.repetition_penalty,
                    stream: false,
                  })
                }, openrouterTimeoutMs)
              : await fetchWithTimeout(ollamaUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model,
                    messages: contMessages,
                    stream: false,
                    options
                  })
                }, ollamaTimeoutMs);

          if (contResponse.ok) {
            const contData = await contResponse.json();
            const continuation = extractAssistantMessage(contData);
            if (continuation) {
              fullAssistantMessage = `${assistantMessage.trim()}\n\n${continuation.trim()}`;
            }
          }
        } catch (e) {
        }
      }

      // Append assistant reply to session
      if (fullAssistantMessage && session) {
        const contentToStore = fullAssistantMessage.length > 30000 ? fullAssistantMessage.slice(0, 30000) : fullAssistantMessage;
        session.messages.push({ role: 'assistant', content: contentToStore });
        session.lastActivityAt = new Date();
        await session.save();
      }

      if (shouldDebug) {
        console.log('Chatbot success', {
          userId,
          durationMs,
          model,
          options: provider === 'openrouter' ? openrouterOptions : options,
          aiEndpoint,
          provider,
          prompt_eval_count: data?.prompt_eval_count,
          eval_count: data?.eval_count,
          done_reason: data?.done_reason,
          usage: data?.usage
        });
      }

      res.json({
        success: true,
        data: {
          reply: fullAssistantMessage,
          sessionId: session?._id,
          meta: shouldDebug ? {
            userId,
            model,
            options: provider === 'openrouter' ? openrouterOptions : options,
            aiEndpoint,
            provider,
            durationMs,
            mode: lite ? 'lite' : 'default',
            maxHistory: lite ? 6 : MAX_HISTORY_ITEMS_DEFAULT,
            timeouts: { openrouterTimeoutMs, fallbackTimeoutMs, ollamaTimeoutMs },
            timings: { start, requestStart: openrouterReqStart, requestEnd: openrouterReqEnd },
            stats: {
              prompt_eval_count: data?.prompt_eval_count,
              eval_count: data?.eval_count,
              done_reason: data?.done_reason,
              finish_reason: finishReason,
              usage: data?.usage
            }
          } : undefined
        }
      });
    } catch (error) {
      console.error('Chatbot error (exception):', {
        message: error?.message,
        stack: (process.env.NODE_ENV === 'development' ? error?.stack : undefined)
      });
      res.status(500).json({
        success: false,
        message: 'Failed to process chatbot message'
      });
    }
  }
);

// Sessions CRUD
// List sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const offsetRaw = Number(req.query.offset);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    const total = await ChatSession.countDocuments({ user: req.user.id, archived: false });
    const sessions = await ChatSession.find({ user: req.user.id, archived: false })
      .sort({ lastActivityAt: -1 })
      .skip(offset)
      .limit(limit)
      .select('_id title createdAt updatedAt lastActivityAt messages');
    res.json({
      success: true,
      data: sessions.map(s => ({
        id: s._id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastActivityAt: s.lastActivityAt,
        messageCount: Array.isArray(s.messages) ? s.messages.length : 0
      })),
      paging: {
        total,
        limit,
        offset,
        returned: sessions.length,
        hasMore: offset + sessions.length < total,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list sessions' });
  }
});

// Create session
router.post('/sessions', auth, [
  body('title').optional().trim().isLength({ min: 1, max: 120 }).withMessage('Title must be 1-120 chars')
], handleValidationErrors, async (req, res) => {
  try {
    const title = req.body.title || 'New Chat';
    const session = await ChatSession.create({ user: req.user.id, title });
    res.json({ success: true, data: { id: session._id, title: session.title } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create session' });
  }
});

// Get single session
router.get('/sessions/:id', auth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: { id: session._id, title: session.title, messages: session.messages } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get session' });
  }
});

// Rename session
router.patch('/sessions/:id', auth, [
  body('title').trim().isLength({ min: 1, max: 120 }).withMessage('Title must be 1-120 chars')
], handleValidationErrors, async (req, res) => {
  try {
    const session = await ChatSession.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { title: req.body.title } },
      { new: true }
    );
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: { id: session._id, title: session.title } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to rename session' });
  }
});

// Delete session
router.delete('/sessions/:id', auth, async (req, res) => {
  try {
    const result = await ChatSession.deleteOne({ _id: req.params.id, user: req.user.id });
    if (!result?.deletedCount) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete session' });
  }
});

module.exports = router;
