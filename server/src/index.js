require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/ai.routes');
const courseRoutes = require('./routes/course.routes');
const trainingRoutes = require('./routes/training.routes');
const notificationRoutes = require('./routes/notification.routes');
const lmsRoutes = require('./routes/lms.routes');
const { bootstrapDatabase } = require('./bootstrap');

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.send('NeuroClass Backend API is running!'));

app.use('/api', aiRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/lms', lmsRoutes);

bootstrapDatabase()
  .then(() => {
    app.listen(port, () => console.log(`Server listening on port ${port}`));
  })
  .catch((err) => {
    console.error('[startup] Supabase connection failed:', err.message);
    // Still start server (will error on DB calls)
    app.listen(port, () => console.log(`Server listening on port ${port} (degraded mode)`));
  });
