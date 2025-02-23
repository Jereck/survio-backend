const express = require("express");
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const pool = require("../config/database");

const router = express.Router();


// ✅ Submit a survey response (Public Access)
router.post("/:surveyId", async (req, res) => {
  const { surveyId } = req.params;
  const { answers } = req.body; // Expecting { question_id: answer_text }

  try {
    // Create a new response entry
    const response = await pool.query(
      "INSERT INTO responses (survey_id) VALUES ($1) RETURNING id",
      [surveyId]
    );

    const responseId = response.rows[0].id;

    // Insert each answer into response_answers table
    for (const [questionId, answerText] of Object.entries(answers)) {
      await pool.query(
        "INSERT INTO response_answers (response_id, question_id, answer_text) VALUES ($1, $2, $3)",
        [responseId, questionId, answerText]
      );
    }

    res.status(201).json({ message: "Response submitted successfully!" });
  } catch (error) {
    console.error("Error submitting response:", error);
    res.status(500).json({ error: "Failed to submit response" });
  }
});

// Only Researchers, Admins, and Owners can view survey responses
router.get("/:surveyId", authMiddleware, roleMiddleware(["researcher", "admin", "owner"]), async (req, res) => {
  const { surveyId } = req.params;

  try {
    const responses = await pool.query("SELECT * FROM responses WHERE survey_id = $1", [surveyId]);
    res.json(responses.rows);
  } catch (error) {
    console.error("Error fetching responses:", error);
    res.status(500).json({ error: "Failed to fetch responses" });
  }
});


module.exports = router;
