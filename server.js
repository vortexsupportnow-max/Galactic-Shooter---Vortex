const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/database');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public auth routes
app.use('/api/auth', authRoutes);

// Protected game routes
app.use('/api/game', authMiddleware, gameRoutes);

// Public leaderboard routes
app.use('/api/leaderboard', leaderboardRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB();

app.listen(PORT, () => {
  console.log(`Galactic Shooter server running on port ${PORT}`);
});

module.exports = app;
