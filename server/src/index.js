require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/ai.routes');
const courseRoutes = require('./routes/course.routes');
const trainingRoutes = require('./routes/training.routes');
const notificationRoutes = require('./routes/notification.routes');
const lmsRoutes = require('./routes/lms.routes');
const { bootstrapDatabase } = require('./bootstrap');
const { uploadRoot } = require('./utils/upload');

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadRoot));

app.get('/', (req, res) => {
  res.send('NeuroClass Backend API is running!');
});

app.use('/api', aiRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/lms', lmsRoutes);

bootstrapDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Database bootstrap failed, falling back to local store:', error.message);
    app.listen(port, () => {
      console.log(`Server listening on port ${port} (local store mode)`);
    });
  });
