const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Dataset = require('../models/Dataset');
const Programme = require('../models/Programme');

const DEMO_DATASET_PATH = path.join(__dirname, '..', 'data', 'dataset.json');

function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

let demoCache = null;
function loadDemoDataset() {
  if (!demoCache) {
    demoCache = JSON.parse(fs.readFileSync(DEMO_DATASET_PATH, 'utf-8'));
  }
  return demoCache;
}

/**
 * Returns { dataset: {academicYear,...}, programmes: [...] } for the
 * currently active dataset, whichever backing store is in use.
 */
async function getActiveDatasetWithProgrammes() {
  if (isDbConnected()) {
    const dataset = await Dataset.findOne({ status: 'active' }).sort({ activatedAt: -1 });
    if (!dataset) return null;
    const programmes = await Programme.find({ datasetId: dataset._id }).lean();
    return { dataset, programmes };
  }
  const demo = loadDemoDataset();
  return {
    dataset: {
      _id: 'demo-2025-2026',
      academicYear: '2025/2026',
      status: 'active',
      importedProgrammeCount: demo.importedProgrammeCount,
      recordsWithCutoffData: demo.recordsWithCutoffData,
      recordsRequiringReview: demo.recordsRequiringReview
    },
    programmes: demo.programmes
  };
}

module.exports = { isDbConnected, getActiveDatasetWithProgrammes, loadDemoDataset };
