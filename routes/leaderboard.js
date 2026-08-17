const express = require('express');
const { getDB } = require('../db/database');
const { fail } = require('../lib/respond');

const router = express.Router();

// Only these three values ever reach the RPC — anything else is treated as 'all'.
function filterDate(filter) {
  if (filter === 'daily') return new Date(Date.now() - 86400000).toISOString();
  if (filter === 'weekly') return new Date(Date.now() - 7 * 86400000).toISOString();
  return null;
}

router.get('/scores', async (req, res) => {
  try {
    const supabase = getDB();
    const date = filterDate(req.query.filter || 'all');
    const { data, error } = await supabase.rpc('get_score_leaderboard', { filter_date: date });
    if (error) throw new Error(error.message);
    res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'leaderboard/scores');
  }
});

router.get('/waves', async (req, res) => {
  try {
    const supabase = getDB();
    const date = filterDate(req.query.filter || 'all');
    const { data, error } = await supabase.rpc('get_wave_leaderboard', { filter_date: date });
    if (error) throw new Error(error.message);
    res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'leaderboard/waves');
  }
});

router.get('/boss-rush', async (req, res) => {
  try {
    const supabase = getDB();
    const { data, error } = await supabase.rpc('get_boss_rush_leaderboard');
    if (error) throw new Error(error.message);
    res.json({ success: true, data });
  } catch (err) {
    return fail(res, err, 'leaderboard/boss-rush');
  }
});

module.exports = router;
