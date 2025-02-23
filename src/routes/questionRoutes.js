const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const { Pool } = require("pg");

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Add a question to a survey
router.post("/", authMiddleware, async (req, res) => {
  const { survey_id, question_text, question_type } = req.body;
  const userId = req.user.userId;

  try {
    // Check if the user owns the survey
    const surveyCheck = await pool.query("SELECT * FROM surveys WHERE id = $1 AND user_id = $2", [survey_id, userId]);
    if (surveyCheck.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized: You don't own this survey" });
    }

    const result = await pool.query(
      "INSERT INTO questions (survey_id, question_text, question_type) VALUES ($1, $2, $3) RETURNING *",
      [survey_id, question_text, question_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding question:", error);
    res.status(500).json({ error: "Failed to add question" });
  }
});

module.exports = router;
