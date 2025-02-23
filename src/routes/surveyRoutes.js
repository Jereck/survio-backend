const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const pool = require('../config/database');

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware(["owner", "admin"]), async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.userId;

  try {
    const result = await pool.query('INSERT INTO surveys (title, description, user_id) VALUES ($1, $2, $3) RETURNING *', [title, description, userId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating survey: ", error);
    res.status(500).json({ message: 'Failed to create survey' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query('SELECT * FROM surveys WHERE user_id = $1', [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching surveys: ", error);
    res.status(500).json({ message: 'Failed to fetch surveys' });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware(["owner"]), async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM surveys WHERE id = $1', [id]);
    res.status(200).json({ message: 'Survey deleted' });
  } catch (error) {
    console.error("Error deleting survey: ", error);
    res.status(500).json({ message: 'Failed to delete survey' });
  }
});

module.exports = router;