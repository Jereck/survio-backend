const pool = require('../config/database');

// ✅ Create a New Survey
const createSurvey = async (req, res) => {
  const { title, description, team_id } = req.body;  // Team is optional
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `INSERT INTO surveys (title, description, created_by, team_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [title, description, userId, team_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating survey: ", error);
    res.status(500).json({ message: 'Failed to create survey' });
  }
}

// ✅ Get surveys for User (or their Team)
const getSurveys = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT surveys.* FROM surveys 
       LEFT JOIN team_members ON surveys.team_id = team_members.team_id 
       WHERE surveys.created_by = $1 OR team_members.user_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching surveys: ", error);
    res.status(500).json({ message: 'Failed to fetch surveys' });
  }
}

// ✅ Get a Survey
const getSurvey = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching survey: ", error);
    res.status(500).json({ message: 'Failed to fetch survey' });
  }
}

// ✅ Update a Survey
const updateSurvey = async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE surveys SET title = $1, description = $2 WHERE id = $3 RETURNING *`,
      [title, description, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating survey: ", error);
    res.status(500).json({ message: 'Failed to update survey' });
  }
}

// ✅ Delete a Survey (Only Owners Can Delete)
const deleteSurvey = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM surveys WHERE id = $1', [id]);
    res.status(200).json({ message: 'Survey deleted' });
  } catch (error) {
    console.error("Error deleting survey: ", error);
    res.status(500).json({ message: 'Failed to delete survey' });
  }
}

const addQuestion = async (req, res) => {
  const { id: survey_id } = req.params;
  const { question, type } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO survey_questions (survey_id, question, type) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [survey_id, question, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding question: ", error);
    res.status(500).json({ message: 'Failed to add question' });
  }
}

// ✅ Get all questions for survey
const getAllQuestions = async (req, res) => {
  const { id: survey_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM survey_questions WHERE survey_id = $1`,
      [survey_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching questions: ", error);
    res.status(500).json({ message: 'Failed to fetch questions' });
  }
}

// ✅ Submit a Survey Response
const submitResponse = async (req, res) => {
  const { id: survey_id } = req.params;
  const { answers } = req.body; // Array of { question_id, answer }
  const userId = req.user?.userId || null; // Allow anonymous responses

  try {
    // Create a response entry
    const responseResult = await pool.query(
      `INSERT INTO survey_responses (survey_id, user_id) VALUES ($1, $2) RETURNING id`,
      [survey_id, userId]
    );

    const responseId = responseResult.rows[0].id;

    // Insert all answers
    const answerPromises = answers.map((answer) => {
      return pool.query(
        `INSERT INTO survey_answers (response_id, question_id, answer) VALUES ($1, $2, $3)`,
        [responseId, answer.question_id, answer.answer]
      );
    });

    await Promise.all(answerPromises);

    res.status(201).json({ message: 'Response submitted successfully!' });
  } catch (error) {
    console.error("Error submitting response: ", error);
    res.status(500).json({ message: 'Failed to submit response' });
  }
}

// ✅ Get Responses for a Survey
const getSurveyResponses = async (req, res) => {
  const { id: survey_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT survey_responses.*, survey_answers.question_id, survey_answers.answer
       FROM survey_responses 
       LEFT JOIN survey_answers ON survey_responses.id = survey_answers.response_id
       WHERE survey_responses.survey_id = $1`,
      [survey_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching responses: ", error);
    res.status(500).json({ message: 'Failed to fetch responses' });
  }
}

module.exports = {
  createSurvey,
  getSurveys,
  getSurvey,
  updateSurvey,
  deleteSurvey,
  addQuestion,
  getAllQuestions,
  submitResponse,
  getSurveyResponses
};