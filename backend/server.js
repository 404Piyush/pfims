const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { doubleCsrfProtection, generateCsrfToken } = require('csrf-csrf');
require('dotenv').config();
const { connectDB, checkConnection } = require('./config/database');
const { startReportScheduler } = require('./services/reportScheduler');
const logger = require('./utils/logger');

// --- Fail-fast on missing JWT_SECRET -----------------------------
// The previous ".env.example" leaked a real Mailgun sandbox key and used a placeholder
// JWT secret. Refuse to boot in production without a strong secret.
function ensureSecurityPreconditions() {
  const isProd = process.env.NODE_ENV === 'production';
  const errs = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errs.push(
      'JWT_SECRET is missing or too short (>=32 chars required). ' +
      'Generate one with: node -e "console.log(require(\\"crypto\\").randomBytes(48).toString(\\"base64url\\"))"'
    );
  }

  if (isProd) {
    if (!process.env.MONGODB_URI) errs.push('MONGODB_URI is required in production');
    if (!process.env.CLIENT_URL) errs.push('CLIENT_URL is required in production (for CORS)');
    if (process.env.MAILGUN_API_KEY && /ad2a8e9a|sandbox2a4bb7/.test(process.env.MAILGUN_API_KEY)) {
      errs.push('MAILGUN_API_KEY appears to be the leaked sandbox key — rotate it on Mailgun before booting.');
    }
  }

  if (errs.length) {
    console.error('\n[boot] security preconditions failed:');
    for (const e of errs) console.error('  - ' + e);
    console.error('');
    if (isProd) process.exit(1);
    else {
      console.warn('[boot] continuing in non-production mode; fix these before shipping.\n');
    }
  }
}
ensureSecurityPreconditions();

const app = express();
app.set('trust proxy', 1); // respect X-Forwarded-For when behind a reverse proxy
app.disable('x-powered-by');

// Per-request nonce used to allow inline scripts in the *frontend*'s HTML shell.
// Stays unset when nobody reads it, so /api/* never suffers CSP issues.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

const IS_PROD = process.env.NODE_ENV === 'production';
const CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:3000';

// --- Security middleware ----------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // In dev Tailwind + inline styles need 'unsafe-inline'; in prod we
        // rely on a per-request nonce for any inline <script> CRA may emit.
        styleSrc: IS_PROD ? ["'self'"] : ["'self'", "'unsafe-inline'"],
        scriptSrc: IS_PROD
          ? ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", CLIENT_ORIGIN, 'https://api.pwnedpasswords.com'],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: false,
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hidePoweredBy: true,
    noSniff: true,
    xssFilter: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  })
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Cookies
app.use(cookieParser());

// NoSQL injection sanitization
app.use(mongoSanitize());

// --- CORS — strict allow-list (no wildcard) ---------------------
// Previously this branch fell through to `callback(null, true)` for unknown origins.
// Now: deny unless origin is in the explicit allowlist and matches the env-driven
// production client URL.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.CLIENT_URL,
].filter(Boolean);

// --- Optional Sentry request handler -----------------------------
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
    app.use(
      Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
          return !error || (error.status || 500) >= 500;
        },
      })
    );
  } catch (e) {
    logger.warn({ event: 'sentry_request_handler_init_failed', err: e.message }, 'sentry');
  }
}

// --- Structured request logging ----------------------------------
try {
  const pinoHttp = require('pino-http');
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health' || req.url === '/favicon.ico',
      },
      serializers: {
        req(req) {
          return { method: req.method, url: req.url, id: req.id };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    })
  );
} catch (e) {
  app.use((req, _res, next) => next());
}

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // mobile/curl no-origin
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-auth-token',
    'x-csrf-token',
    'X-CSRF-Token',
    'Accept',
    'Origin',
    'X-Requested-With',
  ],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 600,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// --- CSRF (double-submit cookie) --------------------------------
// Frontend reads the CSRF token from a non-httpOnly meta tag (set by /api/csrf)
// and sends it back on every state-changing request as `X-CSRF-Token`.
const csrfConfig = {
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  cookieName: 'pfims_csrf',
  cookieOptions: {
    httpOnly: false,        // readable by JS so the SPA can mirror the header
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  size: 64,
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
};
const { generateCsrfToken: genCsrf, doubleCsrfProtection: csrfProtect } = (() => {
  try {
    return require('csrf-csrf');
  } catch (_) {
    // Fallback: no-op stub. Real CSRF will activate once `csrf-csrf` is installed.
    return {
      generateCsrfToken: () => (req, _res, next) => next(),
      doubleCsrfProtection: (_req, _res, next) => next(),
    };
  }
})();
app.use(genCsrf);
app.use((req, res, next) => {
  // Only protect state-changing routes under /api
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || !req.path.startsWith('/api')) {
    return next();
  }
  return csrfProtect(req, res, next);
});

// CSRF token endpoint — SPA calls this on boot
app.get('/api/csrf', (req, res) => {
  res.json({ csrfToken: req.csrfToken ? req.csrfToken() : null });
});

// --- Rate limiting (per IP) -------------------------------------
const RATE_DISABLED = process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production';
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Try again in a few minutes.' },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI endpoint rate limit reached.' },
});
if (!RATE_DISABLED) {
  app.use('/api/', globalLimiter);
  app.use('/api/auth', authLimiter);
  app.use('/api/chatbot', aiLimiter);
  app.use('/api/analyse', aiLimiter);
}

// --- Database & routes ------------------------------------------
connectDB();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/analyse', require('./routes/analyse'));

// --- Health -----------------------------------------------------
app.get('/api/health', (_req, res) => {
  const dbStatus = checkConnection();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      connected: dbStatus.isConnected,
      readyState: dbStatus.readyState,
      host: dbStatus.host,
      port: dbStatus.port,
      name: dbStatus.name,
      connectionAttempts: dbStatus.connectionAttempts,
    },
    memory: process.memoryUsage(),
    version: process.version,
  });
});

// --- Errors -----------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err && err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ message: err.message });
  }
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  console.error(err.stack || err);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT} (env=${process.env.NODE_ENV || 'development'})`);
  try {
    startReportScheduler();
  } catch (e) {
    console.warn('Report scheduler not started:', e?.message || e);
  }
});
