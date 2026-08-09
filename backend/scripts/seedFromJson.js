require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const Dataset = require('../src/models/Dataset');
const Programme = require('../src/models/Programme');
const AdminUser = require('../src/models/AdminUser');

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Add it to backend/.env first.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const datasetJsonPath = path.join(__dirname, '..', 'src', 'data', 'dataset.json');
  const raw = JSON.parse(fs.readFileSync(datasetJsonPath, 'utf-8'));

  await Dataset.updateMany({ status: 'active' }, { status: 'archived' });
  const dataset = await Dataset.create({
    academicYear: '2025/2026',
    status: 'active',
    activatedAt: new Date(),
    importedProgrammeCount: raw.importedProgrammeCount,
    recordsWithCutoffData: raw.recordsWithCutoffData,
    recordsRequiringReview: raw.recordsRequiringReview,
    validationWarnings: raw.validationWarnings.slice(0, 500),
    validationErrors: raw.validationErrors.slice(0, 500)
  });

  const docs = raw.programmes.map(p => ({ ...p, datasetId: dataset._id }));
  const CHUNK = 500;
  for (let i = 0; i < docs.length; i += CHUNK) {
    await Programme.insertMany(docs.slice(i, i + CHUNK));
    console.log(`Inserted ${Math.min(i + CHUNK, docs.length)}/${docs.length} programmes`);
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@cymor.dev').toLowerCase();
  const existingAdmin = await AdminUser.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
    await AdminUser.create({ email: adminEmail, passwordHash, role: 'superadmin', name: 'Legendary Smiley Cymor' });
    console.log(`Created admin user: ${adminEmail}`);
  }

  console.log(`Dataset ${dataset.academicYear} activated with ${docs.length} programmes.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
