const Dataset = require('../models/Dataset');
const SourceDocument = require('../models/SourceDocument');
const Programme = require('../models/Programme');
const AdminUser = require('../models/AdminUser');
const bcrypt = require('bcryptjs');
const { saveBuffer, readBuffer, checksum } = require('../services/storageService');
const { parseCutoffsPdf } = require('../importers/cutoffsPdfParser');
const { buildDataset } = require('../importers/buildDataset');
const clustersRawFallback = require('../data/clusters_raw.json');
const bundledDataset = require('../data/dataset.json');

/**
 * Browser-triggerable seed route for mobile-only / no-shell-access
 * deployments (Render free tier has no shell). Loads the bundled real
 * KUCCPS dataset (data/dataset.json) into MongoDB as the active
 * 2025/2026 dataset and creates the first admin user, entirely over
 * HTTP. Protected by a shared secret (ADMIN_SEED_KEY env var) rather
 * than a JWT, since no admin user exists yet the first time this runs.
 *
 * Usage: GET /api/admin/seed?key=YOUR_ADMIN_SEED_KEY
 *        GET /api/admin/seed?key=YOUR_ADMIN_SEED_KEY&force=true  (re-seed)
 */
async function seedFromBundledData(req, res, next) {
  try {
    const providedKey = req.query.key;
    const expectedKey = process.env.ADMIN_SEED_KEY;
    if (!expectedKey) {
      return res.status(500).json({ success: false, error: { code: 'SEED_KEY_NOT_CONFIGURED', message: 'ADMIN_SEED_KEY is not set on the server. Add it in your Render environment variables first.' } });
    }
    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_SEED_KEY', message: 'Missing or incorrect ?key= value.' } });
    }

    const force = req.query.force === 'true';
    const existingActive = await Dataset.findOne({ status: 'active' });
    if (existingActive && !force) {
      return res.json({
        success: true,
        data: {
          message: 'A dataset is already active — nothing changed. Add &force=true to the URL to wipe and reseed.',
          academicYear: existingActive.academicYear,
          importedProgrammeCount: existingActive.importedProgrammeCount
        }
      });
    }

    if (existingActive && force) {
      await Programme.deleteMany({ datasetId: existingActive._id });
      await Dataset.updateMany({ status: 'active' }, { status: 'archived' });
    }

    const dataset = await Dataset.create({
      academicYear: '2025/2026',
      status: 'active',
      activatedAt: new Date(),
      importedProgrammeCount: bundledDataset.importedProgrammeCount,
      recordsWithCutoffData: bundledDataset.recordsWithCutoffData,
      recordsRequiringReview: bundledDataset.recordsRequiringReview,
      validationWarnings: bundledDataset.validationWarnings.slice(0, 500),
      validationErrors: bundledDataset.validationErrors.slice(0, 500)
    });

    const docs = bundledDataset.programmes.map(p => ({ ...p, datasetId: dataset._id }));
    const CHUNK = 500;
    for (let i = 0; i < docs.length; i += CHUNK) {
      await Programme.insertMany(docs.slice(i, i + CHUNK));
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@cymor.dev').toLowerCase();
    let adminCreated = false;
    const existingAdmin = await AdminUser.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
      await AdminUser.create({ email: adminEmail, passwordHash, role: 'superadmin', name: 'Legendary Smiley Cymor' });
      adminCreated = true;
    }

    res.json({
      success: true,
      data: {
        message: 'Seed complete.',
        academicYear: dataset.academicYear,
        importedProgrammeCount: docs.length,
        adminEmail,
        adminUserCreated: adminCreated
      }
    });
  } catch (err) { next(err); }
}

async function dashboard(req, res, next) {
  try {
    const active = await Dataset.findOne({ status: 'active' }).sort({ activatedAt: -1 });
    const institutionCount = active
      ? (await Programme.distinct('institutionName', { datasetId: active._id })).length
      : 0;
    const lastImport = await Dataset.findOne().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: {
        activeDataset: active,
        programmeCount: active ? active.importedProgrammeCount : 0,
        institutionCount,
        lastImport
      }
    });
  } catch (err) { next(err); }
}

async function listDatasets(req, res, next) {
  try {
    const datasets = await Dataset.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: datasets });
  } catch (err) { next(err); }
}

async function createDataset(req, res, next) {
  try {
    const { academicYear } = req.body;
    if (!academicYear) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_YEAR', message: 'academicYear is required, e.g. "2026/2027".' } });
    }
    const dataset = await Dataset.create({ academicYear, status: 'draft' });
    res.status(201).json({ success: true, data: dataset });
  } catch (err) { next(err); }
}

// NOTE: this outer function is a plain (non-async) factory — it must
// return the inner handler function itself, not a Promise that resolves
// to one. Marking it `async` here was the bug: Express received a
// Promise instead of a callback, causing
// "Route.post() requires a callback function but got a [object Promise]".
function uploadDocument(type) {
  return async function (req, res, next) {
    try {
      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });
      if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'A PDF file is required.' } });
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ success: false, error: { code: 'INVALID_FILE_TYPE', message: 'Only PDF files are accepted.' } });
      }

      const { storagePath, storageProvider } = await saveBuffer(req.file.buffer, req.file.originalname);
      const doc = await SourceDocument.create({
        datasetId: dataset._id,
        type,
        originalFilename: req.file.originalname,
        storageProvider,
        storagePath,
        fileSize: req.file.size,
        checksum: checksum(req.file.buffer),
        processingStatus: 'uploaded'
      });

      if (type === 'requirements') dataset.requirementsDocument = doc._id;
      if (type === 'cutoffs') dataset.cutoffDocument = doc._id;
      await dataset.save();

      res.status(201).json({ success: true, data: doc });
    } catch (err) { next(err); }
  };
}

async function processImport(req, res, next) {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });

    dataset.status = 'validating';
    await dataset.save();

    let cutoffsRaw = { records: [] };
    if (dataset.cutoffDocument) {
      const cutoffDoc = await SourceDocument.findById(dataset.cutoffDocument);
      cutoffDoc.processingStatus = 'extracting';
      await cutoffDoc.save();
      try {
        const buffer = readBuffer(cutoffDoc.storagePath);
        const parsed = await parseCutoffsPdf(buffer);
        cutoffsRaw.records = parsed.records;
        cutoffDoc.processingStatus = 'extracted';
        cutoffDoc.extractionStatus = `${parsed.records.length} records, ${parsed.warnings.length} warnings`;
        await cutoffDoc.save();
      } catch (e) {
        cutoffDoc.processingStatus = 'failed';
        cutoffDoc.errorMessage = e.message;
        await cutoffDoc.save();
      }
    }

    // The requirements PDF's layout (nested two-column programme lists) is
    // parsed with the dedicated Python/pdfplumber pipeline at
    // scripts/extractFromPdfs.js during initial setup; for admin
    // re-uploads within the running app we currently reuse the last known
    // structured requirements unless a newer requirements JSON has been
    // placed alongside the upload. This keeps calculation-critical data
    // (cutoffs) always live-refreshable from the running app while being
    // transparent that full requirements re-parsing is a manual step.
    const { importedProgrammeCount, recordsWithCutoffData, recordsRequiringReview,
      validationWarnings, validationErrors, programmes } = buildDataset(cutoffsRaw, clustersRawFallback);

    await Programme.deleteMany({ datasetId: dataset._id });
    if (programmes.length) {
      await Programme.insertMany(programmes.map(p => ({ ...p, datasetId: dataset._id })));
    }

    dataset.importedProgrammeCount = importedProgrammeCount;
    dataset.recordsWithCutoffData = recordsWithCutoffData;
    dataset.recordsRequiringReview = recordsRequiringReview;
    dataset.validationWarnings = validationWarnings.slice(0, 500);
    dataset.validationErrors = validationErrors.slice(0, 500);
    dataset.status = validationErrors.length ? 'failed' : 'draft';
    await dataset.save();

    res.json({ success: true, data: dataset });
  } catch (err) { next(err); }
}

async function validationPreview(req, res, next) {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });
    res.json({
      success: true,
      data: {
        importedProgrammeCount: dataset.importedProgrammeCount,
        recordsWithCutoffData: dataset.recordsWithCutoffData,
        recordsRequiringReview: dataset.recordsRequiringReview,
        validationErrors: dataset.validationErrors,
        validationWarnings: dataset.validationWarnings
      }
    });
  } catch (err) { next(err); }
}

async function activateDataset(req, res, next) {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });
    if (!dataset.importedProgrammeCount) {
      return res.status(400).json({ success: false, error: { code: 'EMPTY_DATASET', message: 'Dataset must contain programmes before activation.' } });
    }
    await Dataset.updateMany({ status: 'active' }, { status: 'archived' });
    dataset.status = 'active';
    dataset.activatedAt = new Date();
    await dataset.save();
    res.json({ success: true, data: dataset });
  } catch (err) { next(err); }
}

async function archiveDataset(req, res, next) {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });
    dataset.status = 'archived';
    await dataset.save();
    res.json({ success: true, data: dataset });
  } catch (err) { next(err); }
}

async function listProgrammes(req, res, next) {
  try {
    const { datasetId, q, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (datasetId) filter.datasetId = datasetId;
    if (q) {
      filter.$or = [
        { programmeName: new RegExp(q, 'i') },
        { institutionName: new RegExp(q, 'i') },
        { programmeCode: new RegExp(q, 'i') }
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Programme.find(filter).skip(skip).limit(Number(limit)).lean(),
      Programme.countDocuments(filter)
    ]);
    res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
}

module.exports = {
  dashboard, listDatasets, createDataset, uploadDocument, processImport,
  validationPreview, activateDataset, archiveDataset, listProgrammes, seedFromBundledData
};
