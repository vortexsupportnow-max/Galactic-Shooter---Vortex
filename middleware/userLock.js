'use strict';

// Every currency mutation in this app is a read-then-write against Supabase, so two
// requests that overlap can both read the same balance and both spend it (open two
// crates with the gems for one). Serialising per user + endpoint closes that window.
//
// Scope note: the lock lives in process memory, so it protects a single instance.
// On a multi-instance/serverless deployment the definitive fix is doing the balance
// update atomically in Postgres (UPDATE ... SET coins = coins - x WHERE coins >= x).
const ACTIVE = new Set();

function userLock(name) {
  return function userLockMiddleware(req, res, next) {
    const userId = req.user && req.user.userId;
    if (!userId) return next();

    const key = `${name}:${userId}`;
    if (ACTIVE.has(key)) {
      return res.json({ success: false, error: 'Request already in progress' });
    }

    ACTIVE.add(key);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      ACTIVE.delete(key);
    };
    res.on('finish', release);
    res.on('close', release);

    next();
  };
}

module.exports = userLock;
