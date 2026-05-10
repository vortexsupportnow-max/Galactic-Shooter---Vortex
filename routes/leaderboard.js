const express = require('express');
const { getDB } = require('../db/database');

const router = express.Router();

function buildQuery(filter) {
  let dateClause = '';
  if (filter === 'daily') {
    dateClause = "AND s.created_at >= datetime('now', '-1 day')";
  } else if (filter === 'weekly') {
    dateClause = "AND s.created_at >= datetime('now', '-7 days')";
  }
  return dateClause;
}

router.get('/scores', (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const dateClause = buildQuery(filter);
    const db = getDB();
    const rows = db.prepare(
      `SELECT s.nickname, MAX(s.score) as score, s.wave, s.enemies_killed, s.created_at, s.user_id
       FROM scores s
       WHERE 1=1 ${dateClause}
       GROUP BY s.user_id
       ORDER BY score DESC
       LIMIT 100`
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get('/waves', (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const dateClause = buildQuery(filter);
    const db = getDB();
    const rows = db.prepare(
      `SELECT s.nickname, MAX(s.wave) as wave, s.score, s.enemies_killed, s.created_at, s.user_id
       FROM scores s
       WHERE 1=1 ${dateClause}
       GROUP BY s.user_id
       ORDER BY wave DESC
       LIMIT 100`
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
