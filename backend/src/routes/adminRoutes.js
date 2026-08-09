const express = require('express');
const multer = require('multer');

const router = express.Router();

const { requireAdmin } = require('../auth/authMiddleware');
const adminAuthController = require('../controllers/adminAuthController');
const adminDatasetController = require('../controllers/adminDatasetController');

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB
  }
});

// ============================================================
// ADMIN AUTHENTICATION
// ============================================================

router.post(
  '/auth/login',
  adminAuthController.login
);

// ============================================================
// ADMIN DASHBOARD
// ============================================================

router.get(
  '/dashboard',
  requireAdmin,
  adminDatasetController.dashboard
);

// ============================================================
// DATASET MANAGEMENT
// ============================================================

// List datasets
router.get(
  '/datasets',
  requireAdmin,
  adminDatasetController.listDatasets
);

// Create dataset
router.post(
  '/datasets',
  requireAdmin,
  adminDatasetController.createDataset
);

// ============================================================
// DATASET DOCUMENT UPLOADS
// ============================================================

// Upload minimum subject requirements PDF
router.post(
  '/datasets/:id/upload-requirements',
  requireAdmin,
  upload.single('file'),
  adminDatasetController.uploadDocument('requirements')
);

// Upload programme cutoff PDF
router.post(
  '/datasets/:id/upload-cutoffs',
  requireAdmin,
  upload.single('file'),
  adminDatasetController.uploadDocument('cutoffs')
);

// ============================================================
// DATASET IMPORT & VALIDATION
// ============================================================

// Process uploaded dataset
router.post(
  '/datasets/:id/import',
  requireAdmin,
  adminDatasetController.processImport
);

// Preview validation results
router.get(
  '/datasets/:id/validation',
  requireAdmin,
  adminDatasetController.validationPreview
);

// ============================================================
// DATASET STATUS
// ============================================================

// Activate dataset
router.post(
  '/datasets/:id/activate',
  requireAdmin,
  adminDatasetController.activateDataset
);

// Archive dataset
router.post(
  '/datasets/:id/archive',
  requireAdmin,
  adminDatasetController.archiveDataset
);

// ============================================================
// PROGRAMMES
// ============================================================

// List programmes
router.get(
  '/programmes',
  requireAdmin,
  adminDatasetController.listProgrammes
);

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;
