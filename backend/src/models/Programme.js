const mongoose = require('mongoose');

const SubjectSlotSchema = new mongoose.Schema({
  slot: Number,
  raw: String,
  resolvedSubjects: [String],
  resolved: Boolean
}, { _id: false });

const SubjectMinimumSchema = new mongoose.Schema({
  raw: String,
  resolvedSubjects: [String],
  resolved: Boolean,
  minimumGrade: String
}, { _id: false });

const RequirementSchema = new mongoose.Schema({
  cluster: String,
  subCluster: String,
  subjectSlots: [SubjectSlotSchema],
  subjectMinimums: [SubjectMinimumSchema],
  unresolvedGroupReferences: [String]
}, { _id: false });

const CutoffYearSchema = new mongoose.Schema({
  year: Number,
  score: Number
}, { _id: false });

const ProgrammeSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  programmeCode: { type: String, required: true, index: true },
  programmeName: { type: String, required: true, index: true },
  institutionName: { type: String, required: true, index: true },
  category: String,
  requirement: RequirementSchema,
  requirementMatched: { type: Boolean, default: false },
  cutoffHistory: [CutoffYearSchema],
  latestCutoff: CutoffYearSchema,
  sourceReferences: {
    cutoffsSourcePage: Number
  }
}, { timestamps: true });

ProgrammeSchema.index({ datasetId: 1, programmeCode: 1 }, { unique: false });

module.exports = mongoose.models.Programme || mongoose.model('Programme', ProgrammeSchema);
