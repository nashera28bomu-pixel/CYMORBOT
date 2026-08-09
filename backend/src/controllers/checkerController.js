const { runEligibilityPipeline } = require('../services/eligibilityEngine');
const { getActiveDatasetWithProgrammes, isDbConnected } = require('../services/datasetRepository');
const AnalysisResult = require('../models/AnalysisResult');
const { validateStudentSubjects } = require('../validators/studentSubjectsValidator');

async function analyze(req, res, next) {
  try {
    const { subjects } = req.body;
    const validation = validateStudentSubjects(subjects);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_GRADES', message: validation.message } });
    }

    const active = await getActiveDatasetWithProgrammes();
    if (!active) {
      return res.status(503).json({ success: false, error: { code: 'NO_ACTIVE_DATASET', message: 'No active KUCCPS dataset is currently available. Please try again later.' } });
    }

    const pipelineResult = runEligibilityPipeline(subjects, active.programmes, { limit: 100 });

    let resultId = null;
    if (isDbConnected()) {
      const saved = await AnalysisResult.create({
        datasetId: active.dataset._id,
        datasetAcademicYear: active.dataset.academicYear,
        inputGrades: subjects,
        selectedSevenSubjects: pipelineResult.aggregate.selectedSubjects,
        aggregatePoints: pipelineResult.aggregate.totalPoints,
        meanGrade: pipelineResult.aggregate.meanGrade,
        qualifyingCount: pipelineResult.qualifyingCount,
        qualifyingProgrammes: pipelineResult.results
      });
      resultId = saved._id.toString();
    }

    res.json({
      success: true,
      data: {
        resultId,
        datasetAcademicYear: active.dataset.academicYear,
        summary: pipelineResult.aggregate,
        qualifyingCount: pipelineResult.qualifyingCount,
        results: pipelineResult.results
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getResult(req, res, next) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Saved results require a database connection. Run this in full mode with MONGODB_URI configured.' } });
    }
    const result = await AnalysisResult.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found.' } });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { analyze, getResult };
