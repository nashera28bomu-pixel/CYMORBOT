const mongoose = require('mongoose');

const SourceDocumentSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
  type: { type: String, enum: ['requirements', 'cutoffs'], required: true },
  originalFilename: { type: String, required: true },
  storageProvider: { type: String, default: 'local' }, // local | cloudinary | s3 | r2 | supabase
  storagePath: { type: String, required: true },
  fileSize: { type: Number },
  checksum: { type: String },
  processingStatus: {
    type: String,
    enum: ['uploaded', 'extracting', 'extracted', 'failed'],
    default: 'uploaded'
  },
  extractionStatus: { type: String },
  errorMessage: { type: String }
}, { timestamps: { createdAt: 'uploadedAt', updatedAt: true } });

module.exports = mongoose.models.SourceDocument || mongoose.model('SourceDocument', SourceDocumentSchema);
