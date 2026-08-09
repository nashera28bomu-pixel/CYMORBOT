const mongoose = require('mongoose');

const DatasetSchema = new mongoose.Schema({
  academicYear: { type: String, required: true }, // e.g. "2025/2026"
  status: {
    type: String,
    enum: ['draft', 'validating', 'active', 'archived', 'failed'],
    default: 'draft'
  },
  requirementsDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'SourceDocument' },
  cutoffDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'SourceDocument' },
  importedProgrammeCount: { type: Number, default: 0 },
  recordsWithCutoffData: { type: Number, default: 0 },
  recordsRequiringReview: { type: Number, default: 0 },
  validationErrors: [{ type: String }],
  validationWarnings: [{ type: String }],
  activatedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.models.Dataset || mongoose.model('Dataset', DatasetSchema);
