const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDB } = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'galactic-shooter-secret-2024';

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
router.use(authLimiter);

router.post('/register', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    if (!nickname || !password) {
      return res.json({ success: false, error: 'Nickname and password required' });
    }
    if (nickname.length < 3 || nickname.length > 20) {
      return res.json({ success: false, error: 'Nickname must be 3-20 characters' });
    }
    if (password.length < 4) {
      return res.json({ success: false, error: 'Password must be at least 4 characters' });
    }
    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE nickname = ?').get(nickname);
    if (existing) {
      return res.json({ success: false, error: 'Nickname already taken' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (nickname, password_hash) VALUES (?, ?)'
    ).run(nickname, hash);
    const token = jwt.sign({ userId: result.lastInsertRowid, nickname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, nickname } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    if (!nickname || !password) {
      return res.json({ success: false, error: 'Nickname and password required' });
    }
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE nickname = ?').get(nickname);
    if (!user) {
      return res.json({ success: false, error: 'Invalid nickname or password' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.json({ success: false, error: 'Invalid nickname or password' });
    }
    const token = jwt.sign({ userId: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, nickname: user.nickname } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.json({ success: false, error: 'No token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDB();
    const user = db.prepare(
      'SELECT id, nickname, coins, gems, games_played, max_score, max_wave, created_at FROM users WHERE id = ?'
    ).get(decoded.userId);
    if (!user) return res.json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.json({ success: false, error: 'Invalid token' });
  }
});

module.exports = router;
