const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDB } = require('../db/database');
const { JWT_SECRET } = require('../config');
const { containsProfanity } = require('../middleware/profanityFilter');
const { fail } = require('../lib/respond');
const authMiddleware = require('../middleware/auth');
const { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode } = require('../lib/recoveryCode');

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

    // Issued once, shown once, stored only as a hash
    const recoveryCode = generateRecoveryCode();
    const recoveryHash = await hashRecoveryCode(recoveryCode);

    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert({ nickname, password_hash: hash, recovery_hash: recoveryHash })
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
    res.json({ success: true, data: { token, nickname, recoveryCode } });
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
      .select('id, nickname, password_hash, recovery_hash')
      .eq('nickname', nickname)
      .maybeSingle();

    // Always run a comparison so unknown and known nicknames take the same time.
    const valid = await bcrypt.compare(password, (user && user.password_hash) || DUMMY_HASH);

    if (!user || !valid) {
      return res.json({ success: false, error: 'Invalid nickname or password' });
    }

    // Accounts that predate recovery codes get one on their next login. This must
    // never block a login, so any failure here is swallowed.
    let recoveryCode = null;
    if (!user.recovery_hash) {
      try {
        const code = generateRecoveryCode();
        const { error } = await supabase
          .from('users')
          .update({ recovery_hash: await hashRecoveryCode(code) })
          .eq('id', user.id);
        if (!error) recoveryCode = code;
      } catch (e) {
        recoveryCode = null;
      }
    }

    const token = jwt.sign({ userId: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, nickname: user.nickname, recoveryCode } });
  } catch (err) {
    return fail(res, err, 'auth/login');
  }
});

// Forgotten password: prove ownership with the recovery code, set a new password.
// The used code is replaced immediately, so it works exactly once.
router.post('/recover', async (req, res) => {
  try {
    const { nickname, code, newPassword } = req.body || {};
    if (!isNonEmptyString(nickname) || !isNonEmptyString(code) || !isNonEmptyString(newPassword)) {
      return res.json({ success: false, error: 'Nickname, codice e nuova password sono richiesti' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.json({ success: false, error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` });
    }

    const supabase = getDB();
    const { data: user } = await supabase
      .from('users')
      .select('id, nickname, recovery_hash')
      .eq('nickname', nickname)
      .maybeSingle();

    // Always compare, so an unknown nickname costs the same as a wrong code, and
    // the message never reveals which of the two was wrong.
    const valid = await verifyRecoveryCode(code, (user && user.recovery_hash) || DUMMY_HASH);
    if (!user || !user.recovery_hash || !valid) {
      return res.json({ success: false, error: 'Nickname o codice di recupero non valido' });
    }

    const nextCode = generateRecoveryCode();
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        password_hash: await bcrypt.hash(newPassword, 10),
        recovery_hash: await hashRecoveryCode(nextCode)
      })
      .eq('id', user.id);
    if (updateErr) throw new Error(updateErr.message);

    const token = jwt.sign({ userId: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, nickname: user.nickname, recoveryCode: nextCode } });
  } catch (err) {
    return fail(res, err, 'auth/recover');
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

// schema.sql cascades this deletion to the player's progress and scores.
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { password, confirmation } = req.body || {};
    if (confirmation !== 'ELIMINA' || !isNonEmptyString(password) || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, error: 'Inserisci la password e conferma la cancellazione.' });
    }
    const supabase = getDB();
    const { data: user, error } = await supabase.from('users')
      .select('id, password_hash').eq('id', req.user.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!user) return res.status(401).json({ success: false, error: 'Account non trovato.' });
    if (!await bcrypt.compare(password, user.password_hash)) {
      return res.status(403).json({ success: false, error: 'Password non corretta.' });
    }
    const { data: deleted, error: deleteError } = await supabase.from('users')
      .delete().eq('id', req.user.userId).eq('password_hash', user.password_hash).select('id');
    if (deleteError) throw new Error(deleteError.message);
    if (!deleted || deleted.length !== 1) {
      return res.status(409).json({ success: false, error: 'Account non eliminato. Accedi di nuovo e riprova.' });
    }
    return res.json({ success: true });
  } catch (err) {
    return fail(res, err, 'auth/delete-account');
  }
});

module.exports = router;
