require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

pool.connect()
  .then(() => console.log('Connected to Neon DB'))
  .catch(err => console.error('Error connecting to Neon DB: ', err));

// Keeps the Renderer connection alive 
setInterval(async () => {
  try {
    await pool.query("SELECT 1"); // Keeps the connection alive
    console.log("✅ Database connection kept alive.");
  } catch (error) {
    console.error("⚠️ Database keep-alive error:", error);
  }
}, 60000);

const authRoutes = require('./routes/authRoutes');
const teamRoutes = require('./routes/teamRoutes');
const userRoutes = require('./routes/userRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const questionRoutes = require('./routes/questionRoutes');
const responseRoutes = require('./routes/responseRoutes');

app.use('/auth', authRoutes);
app.use('/teams', teamRoutes);
app.use('/users', userRoutes);
app.use('/surveys', surveyRoutes);
app.use('/questions', questionRoutes);
app.use('/responses', responseRoutes);

app.get("/", (req, res) => {
  res.send("Survur.io API is running!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
})