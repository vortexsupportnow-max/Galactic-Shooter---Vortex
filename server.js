const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./db/database');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const staticLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

app.use(cors());
app.use(express.json());
app.use(staticLimiter, express.static(path.join(__dirname, 'public')));

// Public auth routes (authLimiter applied within router)
app.use('/api/auth', apiLimiter, authRoutes);

// Protected game routes
app.use('/api/game', apiLimiter, authMiddleware, gameRoutes);

// Public leaderboard routes
app.use('/api/leaderboard', apiLimiter, leaderboardRoutes);

// SPA fallback
app.get('*', staticLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Galactic Shooter server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err.message);
  process.exit(1);
});

module.exports = app;
