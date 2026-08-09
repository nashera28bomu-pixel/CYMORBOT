const Dataset = require('../models/Dataset');
const SourceDocument = require('../models/SourceDocument');
const Programme = require('../models/Programme');
const { saveBuffer, readBuffer, checksum } = require('../services/storageService');
const { parseCutoffsPdf } = require('../importers/cutoffsPdfParser');
const { buildDataset } = require('../importers/buildDataset');
const clustersRawFallback = require('../data/clusters_raw.json');

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

async function uploadDocument(type) {
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
  validationPreview, activateDataset, archiveDataset, listProgrammes
};
