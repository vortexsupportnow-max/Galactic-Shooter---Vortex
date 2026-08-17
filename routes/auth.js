const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDB } = require('../db/database');
const { JWT_SECRET } = require('../config');
const { containsProfanity } = require('../middleware/profanityFilter');
const { fail } = require('../lib/respond');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
router.use(authLimiter);

// Nicknames are rendered in the leaderboard and profile, so keep them to a charset
// that can't carry markup. Also blocks look-alike padding with control characters.
const NICKNAME_PATTERN = /^[A-Za-z0-9 ._-]{3,20}$/;

// bcrypt only reads the first 72 bytes; longer input is pointless, and hashing
// megabyte-long strings is an easy way to burn server CPU.
const MAX_PASSWORD_LENGTH = 72;
const MIN_PASSWORD_LENGTH = 8;

// Used to spend the same time on a wrong nickname as on a wrong password, so the
// response time can't be used to enumerate registered accounts.
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isUniqueViolation(err) {
  const code = err && err.code;
  const message = (err && err.message) || '';
  return code === '23505' || /duplicate key|already exists/i.test(message);
}

router.post('/register', async (req, res) => {
  try {
    const { nickname, password } = req.body || {};

    // Type checks first: a non-string here would flow straight into a DB filter.
    if (!isNonEmptyString(nickname) || !isNonEmptyString(password)) {
      return res.json({ success: false, error: 'Nickname and password required' });
    }
    if (nickname.length < 3 || nickname.length > 20) {
      return res.json({ success: false, error: 'Nickname must be 3-20 characters' });
    }
    if (!NICKNAME_PATTERN.test(nickname)) {
      return res.json({ success: false, error: 'Nickname can only contain letters, numbers, spaces, . _ -' });
    }
    if (containsProfanity(nickname)) {
      return res.json({ success: false, error: 'Nickname contains inappropriate language' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.json({ success: false, error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` });
    }

    const supabase = getDB();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('nickname', nickname)
      .maybeSingle();

    if (existing) {
      return res.json({ success: false, error: 'Nickname already taken' });
    }

    const hash = await bcrypt.hash(password, 10);

    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert({ nickname, password_hash: hash })
      .select('id')
      .single();

    if (insertErr) {
      // Covers the case-insensitive unique index (see db/schema.sql) and the race
      // between the check above and this insert.
      if (isUniqueViolation(insertErr)) {
        return res.json({ success: false, error: 'Nickname already taken' });
      }
      throw new Error(insertErr.message);
    }

    const token = jwt.sign({ userId: newUser.id, nickname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, nickname } });
  } catch (err) {
    return fail(res, err, 'auth/register');
  }
});

router.post('/login', async (req, res) => {
  try {
    const { nickname, password } = req.body || {};
    if (!isNonEmptyString(nickname) || !isNonEmptyString(password)) {
      return res.json({ success: false, error: 'Nickname and password required' });
    }
    if (nickname.length > 20 || password.length > MAX_PASSWORD_LENGTH) {
      return res.json({ success: false, error: 'Invalid nickname or password' });
    }

    const supabase = getDB();

    const { data: user } = await supabase
      .from('users')
      .select('id, nickname, password_hash')
      .eq('nickname', nickname)
      .maybeSingle();

    // Always run a comparison so unknown and known nicknames take the same time.
    const valid = await bcrypt.compare(password, (user && user.password_hash) || DUMMY_HASH);

    if (!user || !valid) {
      return res.json({ success: false, error: 'Invalid nickname or password' });
    }

    const token = jwt.sign({ userId: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, nickname: user.nickname } });
  } catch (err) {
    return fail(res, err, 'auth/login');
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.json({ success: false, error: 'No token' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const supabase = getDB();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, nickname, coins, gems, games_played, max_score, max_wave, created_at')
      .eq('id', decoded.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!user) return res.json({ success: false, error: 'User not found' });

    res.json({ success: true, data: user });
  } catch (err) {
    res.json({ success: false, error: 'Invalid token' });
  }
});

module.exports = router;
