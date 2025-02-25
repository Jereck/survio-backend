const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const {
  createSurvey,
  getSurveys,
  getSurvey,
  deleteSurvey,
  addQuestion,
  getAllQuestions,
  submitResponse,
  getSurveyResponses,
  updateSurvey
} = require('../controllers/survey.controller');

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware(["owner", "admin"]), createSurvey);
router.get('/', authMiddleware, getSurveys);
router.get('/:id', authMiddleware, getSurvey);
router.put('/:id', authMiddleware, updateSurvey);
router.delete('/:id', authMiddleware, roleMiddleware(["owner"]), deleteSurvey);

router.post('/:id/questions', authMiddleware, roleMiddleware(["owner", "admin"]), addQuestion);
router.get('/:id/questions', authMiddleware, getAllQuestions);


router.post('/:id/responses', authMiddleware, submitResponse);
router.get('/:id/responses', authMiddleware, getSurveyResponses);

module.exports = router;
