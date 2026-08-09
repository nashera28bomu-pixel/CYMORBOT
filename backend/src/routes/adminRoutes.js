const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireAdmin } = require('../auth/authMiddleware');
const adminAuthController = require('../controllers/adminAuthController');
const adminDatasetController = require('../controllers/adminDatasetController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

router.post('/auth/login', adminAuthController.login);

router.get('/dashboard', requireAdmin, adminDatasetController.dashboard);

router.get('/datasets', requireAdmin, adminDatasetController.listDatasets);
router.post('/datasets', requireAdmin, adminDatasetController.createDataset);
router.post('/datasets/:id/upload-requirements', requireAdmin, upload.single('file'), adminDatasetController.uploadDocument('requirements'));
router.post('/datasets/:id/upload-cutoffs', requireAdmin, upload.single('file'), adminDatasetController.uploadDocument('cutoffs'));
router.post('/datasets/:id/import', requireAdmin, adminDatasetController.processImport);
router.get('/datasets/:id/validation', requireAdmin, adminDatasetController.validationPreview);
router.post('/datasets/:id/activate', requireAdmin, adminDatasetController.activateDataset);
router.post('/datasets/:id/archive', requireAdmin, adminDatasetController.archiveDataset);

router.get('/programmes', requireAdmin, adminDatasetController.listProgrammes);

module.exports = router;
