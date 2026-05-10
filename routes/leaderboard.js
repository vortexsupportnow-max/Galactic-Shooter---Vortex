const express = require('express');
const { getDB } = require('../db/database');

const router = express.Router();

// Returns { clause, params } for safe parameterized date filtering
function buildDateFilter(filter) {
  if (filter === 'daily') {
    return { clause: 'AND s.created_at >= ?', params: [new Date(Date.now() - 86400000).toISOString()] };
  }
  if (filter === 'weekly') {
    return { clause: 'AND s.created_at >= ?', params: [new Date(Date.now() - 7 * 86400000).toISOString()] };
  }
  return { clause: '', params: [] };
}

router.get('/scores', (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const { clause, params } = buildDateFilter(filter);
    const db = getDB();
    const rows = db.prepare(
      `SELECT s.nickname, MAX(s.score) as score, s.wave, s.enemies_killed, s.created_at, s.user_id
       FROM scores s
       WHERE 1=1 ${clause}
       GROUP BY s.user_id
       ORDER BY score DESC
       LIMIT 100`
    ).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get('/waves', (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const { clause, params } = buildDateFilter(filter);
    const db = getDB();
    const rows = db.prepare(
      `SELECT s.nickname, MAX(s.wave) as wave, s.score, s.enemies_killed, s.created_at, s.user_id
       FROM scores s
       WHERE 1=1 ${clause}
       GROUP BY s.user_id
       ORDER BY wave DESC
       LIMIT 100`
    ).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
