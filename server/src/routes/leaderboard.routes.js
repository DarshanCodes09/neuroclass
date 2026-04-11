// server/src/routes/leaderboard.routes.js
const express = require('express');
const router = express.Router();
const leaderboardService = require('../services/leaderboard.service');

// GET /api/leaderboard - Global leaderboard
router.get('/', async (req, res) => {
  try {
    const data = await leaderboardService.getLeaderboardData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/leaderboard/:course_id - Course-specific leaderboard
router.get('/:course_id', async (req, res) => {
  try {
    const { course_id } = req.params;
    const data = await leaderboardService.getLeaderboardData(course_id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
