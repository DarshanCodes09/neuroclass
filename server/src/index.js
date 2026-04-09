// server/src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Route registration ───────────────────────────────────────────────────────
app.use('/api/files',   require('./routes/files'));
app.use('/api/queries', require('./routes/queries'));

// Existing routes (keep whatever was already present)
try { app.use('/api/courses',      require('./routes/course.routes')); }      catch(_){}
try { app.use('/api/lms',          require('./routes/lms.routes')); }          catch(_){}
try { app.use('/api/ai',           require('./routes/ai.routes')); }            catch(_){}
try { app.use('/api/training',     require('./routes/training.routes')); }     catch(_){}
try { app.use('/api/notification', require('./routes/notification.routes')); } catch(_){}

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`NeuroClass server running on port ${PORT}`));

module.exports = app;
