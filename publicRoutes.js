const express = require('express');
const router = express.Router();
const { getActiveDatasetWithProgrammes } = require('../services/datasetRepository');
const checkerController = require('../controllers/checkerController');
const reportController = require('../controllers/reportController');

router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

router.get('/datasets/active', async (req, res, next) => {
  try {
    const active = await getActiveDatasetWithProgrammes();
    if (!active) {
      return res.status(503).json({ success: false, error: { code: 'NO_ACTIVE_DATASET', message: 'No active dataset available yet.' } });
    }
    res.json({
      success: true,
      data: {
        academicYear: active.dataset.academicYear,
        programmeCount: active.dataset.importedProgrammeCount,
        recordsWithCutoffData: active.dataset.recordsWithCutoffData
      }
    });
  } catch (err) { next(err); }
});

router.post('/checker/analyze', checkerController.analyze);
router.get('/results/:id', checkerController.getResult);
router.get('/results/:id/pdf', reportController.downloadReport);

module.exports = router;
