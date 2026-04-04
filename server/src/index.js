require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/ai.routes');

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('NeuroClass Backend API is running!');
});

app.use('/api', aiRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
