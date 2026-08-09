const AnalysisResult = require('../models/AnalysisResult');
const { generateReportPdf } = require('../pdf/reportGenerator');
const { isDbConnected } = require('../services/datasetRepository');

async function downloadReport(req, res, next) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'PDF report generation from saved results requires a database connection.' } });
    }
    const result = await AnalysisResult.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found.' } });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cymor-kuccps-report-${result._id}.pdf"`);

    generateReportPdf({
      studentSummary: {
        meanGrade: result.meanGrade,
        aggregatePoints: result.aggregatePoints,
        qualifyingCount: result.qualifyingCount
      },
      results: result.qualifyingProgrammes,
      datasetAcademicYear: result.datasetAcademicYear
    }, res);
  } catch (err) {
    next(err);
  }
}

module.exports = { downloadReport };
