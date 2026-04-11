// server/src/index.js
require('dotenv').config();
// Server Entry Point - Fully Restarted
const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve locally uploaded files (rubrics, submissions, etc.)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// ── Route registration ───────────────────────────────────────────────────────
app.use('/api/files',   require('./routes/files'));
app.use('/api/queries', require('./routes/queries'));

// Existing routes
try {
  app.use('/api/courses',      require('./routes/course.routes'));
  app.use('/api/lms',          require('./routes/lms.routes'));
  app.use('/api/ai',           require('./routes/ai.routes'));
  app.use('/api/training',     require('./routes/training.routes'));
  app.use('/api/notification', require('./routes/notification.routes'));
  app.use('/api/evaluator',    require('./routes/evaluator.routes'));
  app.use('/api/leaderboard',  require('./routes/leaderboard.routes'));
} catch (err) {
  console.error('[routes] Failed to load route:', err.message);
  console.error(err.stack);
}

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`NeuroClass server running on port ${PORT}`));

module.exports = app;
