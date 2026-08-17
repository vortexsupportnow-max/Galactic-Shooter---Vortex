require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDB, getDB } = require('./db/database');
const {
  ALLOWED_ORIGINS, isProduction, isTest, NODE_ENV,
  USING_SERVICE_ROLE_KEY, JWT_SECRET_IS_WEAK
} = require('./config');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const authMiddleware = require('./middleware/auth');
const securityHeaders = require('./middleware/securityHeaders');

const app = express();
const PORT = process.env.PORT || 3000;

// On Vercel the app is invoked as a serverless function: there is no port to
// listen on, and exiting the process on a startup hiccup turns every request —
// static pages included — into FUNCTION_INVOCATION_FAILED.
const IS_SERVERLESS = Boolean(process.env.VERCEL);

// Behind Vercel/any reverse proxy every request arrives from the proxy IP. Without
// this, express-rate-limit buckets the whole planet into a single counter: one busy
// user locks everyone out, and per-IP limits mean nothing. '1' = trust one hop only
// (trusting every hop would let clients spoof X-Forwarded-For to dodge the limits).
app.set('trust proxy', 1);
app.disable('x-powered-by');

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const staticLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

// Same-origin by default; set ALLOWED_ORIGINS to opt specific front-ends in.
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // same-origin / native clients
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
};

app.use(securityHeaders);
app.use(cors(corsOptions));

// Cap request bodies: every endpoint here takes a handful of small fields, and an
// unbounded parser is a cheap way to exhaust memory.
app.use(express.json({ limit: '16kb' }));

// Malformed JSON / oversized bodies should answer in the API's own shape.
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err instanceof SyntaxError)) {
    return res.status(400).json({ success: false, error: 'Invalid request body' });
  }
  return next(err);
});

app.use(staticLimiter, express.static(path.join(__dirname, 'public')));

// Public auth routes (stricter authLimiter applied within the router)
app.use('/api/auth', apiLimiter, authRoutes);

// Protected game routes
app.use('/api/game', apiLimiter, authMiddleware, gameRoutes);

// Public leaderboard routes
app.use('/api/leaderboard', apiLimiter, leaderboardRoutes);

// Deployment diagnostics. Deliberately says whether things work, never why in
// detail and never a secret — the reasons go to the server logs.
app.get('/api/health', apiLimiter, async (req, res) => {
  let dbReachable = false;
  try {
    const { error } = await getDB().from('users').select('id').limit(1);
    dbReachable = !error;
    if (error) console.error('[health] database check failed:', error.message);
  } catch (err) {
    console.error('[health] database check threw:', err && err.message);
  }

  res.json({
    success: true,
    data: {
      env: NODE_ENV,
      serverless: IS_SERVERLESS,
      database: { reachable: dbReachable, key: USING_SERVICE_ROLE_KEY ? 'service_role' : 'anon' },
      jwt: { weak: JWT_SECRET_IS_WEAK }
    }
  });
});

// Unknown API paths must not fall through to the SPA shell
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// SPA fallback
app.get('*', staticLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Last-resort handler: log the real error, return a generic one.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[unhandled]', err && (err.stack || err.message || err));
  if (res.headersSent) return;
  res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
});

// Tests import the routers directly; don't bind a port under Jest.
if (!isTest) {
  initDB()
    .then(() => {
      if (IS_SERVERLESS) return; // nothing to listen on
      app.listen(PORT, () => {
        console.log(`Galactic Shooter server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
      });
    })
    .catch(err => {
      console.error('Failed to initialise database:', err.message);
      // Locally a dead database means a broken dev setup, so fail fast. On
      // serverless the app must stay up: static pages keep working and
      // /api/health reports the problem instead of a blank 500.
      if (!IS_SERVERLESS) process.exit(1);
    });
}

module.exports = app;
