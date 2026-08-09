/**
 * Storage abstraction. For the MVP this writes to local disk (Render's
 * ephemeral filesystem is fine for short-lived generated PDFs and for
 * documents that get re-uploaded on redeploy). Swap STORAGE_PROVIDER to
 * 'cloudinary' | 's3' | 'r2' | 'supabase' and implement the matching
 * branch below when moving to persistent object storage — no other part
 * of the app needs to change because everything goes through this file.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROVIDER = process.env.STORAGE_PROVIDER || 'local';
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function saveBuffer(buffer, filename) {
  if (PROVIDER === 'local') {
    const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${filename}`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(filePath, buffer);
    return { storagePath: filePath, storageProvider: 'local' };
  }
  throw new Error(`Storage provider "${PROVIDER}" is not yet implemented. Configure STORAGE_PROVIDER=local, or implement this branch for your chosen provider.`);
}

function readBuffer(storagePath) {
  return fs.readFileSync(storagePath);
}

function checksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = { saveBuffer, readBuffer, checksum, UPLOAD_DIR };
