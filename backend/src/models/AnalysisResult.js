const mongoose = require('mongoose');

const AnalysisResultSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
  datasetAcademicYear: String,
  inputGrades: [{ subject: String, grade: String }],
  selectedSevenSubjects: [{ subject: String, grade: String, points: Number }],
  aggregatePoints: Number,
  meanGrade: String,
  qualifyingCount: Number,
  qualifyingProgrammes: [{
    rank: Number,
    programmeCode: String,
    programmeName: String,
    institutionName: String,
    latestCutoff: Number,
    latestCutoffYear: Number,
    learnerScore: Number,
    margin: Number,
    approximate: Boolean
  }],
  accessStatus: { type: String, enum: ['unlocked', 'locked'], default: 'unlocked' } // future payment gate hook
}, { timestamps: true });

module.exports = mongoose.models.AnalysisResult || mongoose.model('AnalysisResult', AnalysisResultSchema);
