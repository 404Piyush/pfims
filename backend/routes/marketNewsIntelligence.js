const express = require('express');
const { query } = require('express-validator');
const { auth } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const marketNewsIntelligenceService = require('../services/marketNewsIntelligenceService');

const router = express.Router();

router.get(
  '/',
  [
    query('market')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 20 })
      .withMessage('Market is invalid'),
  ],
  auth,
  handleValidationErrors,
  async (req, res) => {
    try {
      const market = req.query.market || 'BSE';
      const payload = await marketNewsIntelligenceService.getIntelligence(market);
      return res.json(payload);
    } catch (error) {
      return res.status(400).json({
        message: error?.message || 'Failed to fetch market news intelligence',
      });
    }
  }
);

module.exports = router;
