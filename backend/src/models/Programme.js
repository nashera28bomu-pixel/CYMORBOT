const mongoose = require('mongoose');

const GroupReferenceSchema = new mongoose.Schema({
  groupName: String,
  ordinal: Number
}, { _id: false });

const ClusterSubjectSlotSchema = new mongoose.Schema({
  slot: Number,
  raw: String,
  resolvedSubjects: [String],
  resolved: Boolean,
  groupReference: GroupReferenceSchema
}, { _id: false });

const SubjectMinimumSchema = new mongoose.Schema({
  raw: String,
  type: { type: String, enum: ['subjects', 'group', 'unparseable'] },
  resolved: Boolean,
  resolvedSubjects: [String],
  groupReference: GroupReferenceSchema,
  minimumGrade: String
}, { _id: false });

const RequirementSchema = new mongoose.Schema({
  cluster: String,
  subCluster: String,
  // The literal 4-subject weighted-cluster definition used for the r/S
  // formula — only populated when the source data actually defines it
  // for this programme's cluster (see clusterRequirementParser.js).
  clusterSubjectSlots: [ClusterSubjectSlotSchema],
  clusterSubjectSlotsResolved: Boolean,
  unresolvedGroupReferences: [String],
  // The minimum subject-grade pass/fail requirements — a separate check
  // from the weighted cluster score.
  subjectMinimums: [SubjectMinimumSchema],
  unresolvedMinimumSegments: [String]
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
