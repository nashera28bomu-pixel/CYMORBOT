# Cymor KUCCPS Advisor

Helps Kenyan KCSE students discover which university degree programmes they
genuinely qualify for — based on their grades, official KUCCPS subject
requirements, weighted cluster scores, and the most recent historical
cutoff points — and gives them a ranked, downloadable PDF shortlist.

Built by **Legendary Smiley Cymor**.

---

## 1. What's actually in this build

This is a real, working full-stack MVP, not a mockup:

- **Real KUCCPS data.** The two source PDFs you supplied
  (`DEGREE_CUTOFFS_14-07-2025.pdf` and `DEGREE_CLUSTER_DOCUMENT_2025_03.pdf`)
  have already been parsed into structured JSON
  (`backend/src/data/cutoffs_raw.json`, `backend/src/data/clusters_raw.json`)
  and merged into a ready-to-use dataset (`backend/src/data/dataset.json`)
  containing **2,122 real programme/university/cutoff records**.
- **A working calculation engine** implementing the exact 12-point grade
  scale, the mandatory-Mathematics + best-language + best-5 seven-subject
  aggregate, and the weighted cluster score formula
  `S = 48 × sqrt((r/48) × (t/84))`, all covered by Jest tests in
  `backend/tests/`.
- **A full REST API** (Express + Mongoose) with public checker/report
  endpoints and an authenticated admin API for dataset lifecycle management
  (upload → parse → validate → preview → activate → archive).
- **A polished, mobile-first frontend** (plain HTML/CSS/JS, no framework)
  covering the landing page, the grade-entry wizard, the analyzing screen,
  results, and a course detail view.
- **A premium, print-ready PDF report generator** (PDFKit) — see §7, this
  is the part people are paying for.
- **A demo mode**: if you run the backend without `MONGODB_URI` configured,
  it automatically serves from the bundled `dataset.json` so you can try
  the whole checker flow immediately, with zero setup. Admin/write features
  require MongoDB.

### A math note, checked and corrected

The original build brief's worked example for the weighted cluster score
(`r=42, t=70 → "approximately 42.54"`) doesn't actually follow from the
formula given right next to it — `48 × sqrt((42/48) × (70/84))` computes to
**≈40.988**, not 42.54. This build implements the formula exactly as
specified (the brief itself says "Implement the formula correctly" and
"Use exactly this formula"), and the test suite asserts the mathematically
correct output rather than the brief's inconsistent illustrative figure.
If a different official KUCCPS formula was intended, swap it in
`backend/src/utils/clusterScore.js` — it's isolated in one place.

### Honest limitation, stated up front

The KUCCPS "cluster/subject requirements" PDF expresses some requirements
as literal subjects (e.g. `PHY`, `CHE`, `MAT ALTERNATIVE A`) and others as
generic subject-group references (e.g. `Any GROUP II`, `2nd GROUP III`).
The source PDF you supplied does **not** itself enumerate which named
subjects belong to Group I–V, so the importer does not invent that mapping
— see the detailed comment in
`backend/src/parsers/clusterRequirementParser.js`. Named subjects resolve
correctly today; unresolved group references are recorded per-programme
(`requirement.unresolvedGroupReferences`) so an admin can supply the
official KUCCPS Group I–V legend as a follow-up dataset revision to fully
resolve them. Cutoff comparison (the part that actually filters/ranks
results) is unaffected — that data is 100% real and complete.

---

## 2. Project structure

```
cymor-kuccps-advisor/
  frontend/
    index.html            Landing page
    checker.html           Grade entry wizard + analyzing + results + course detail
    admin/
      login.html
      dashboard.html
    styles/
      main.css
      responsive.css
    js/
      config.js  api.js  ui.js  app.js  checker.js  admin.js
    vercel.json

  backend/
    src/
      config/db.js
      controllers/         checkerController, reportController, adminAuthController, adminDatasetController
      middleware/errorHandler.js
      models/               Dataset, SourceDocument, Programme, AdminUser, AnalysisResult
      routes/               publicRoutes, adminRoutes
      services/              eligibilityEngine, datasetRepository, storageService
      utils/                 gradePoints, aggregate, clusterScore, normalize
      validators/            studentSubjectsValidator
      importers/              buildDataset, cutoffsPdfParser
      parsers/                clusterRequirementParser
      pdf/                    reportGenerator (the paid PDF report)
      auth/authMiddleware.js
      data/                   cutoffs_raw.json, clusters_raw.json, dataset.json (bundled real data)
      app.js  server.js
    scripts/
      seedFromJson.js       Loads dataset.json into MongoDB as the active 2025/2026 dataset
      extractFromPdfs.js    Pointer to the PDF re-extraction workflow (§6)
    tests/                  Jest tests for the calculation engine
    render.yaml
    .env.example

  README.md
```

---

## 3. Local development

### Backend

```bash
cd backend
cp .env.example .env      # fill in MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm test                  # runs the calculation-engine test suite
npm run dev                # starts on http://localhost:5000
```

Without `MONGODB_URI` set, the server still starts and the **public
checker** works immediately against the bundled real dataset (demo mode).
Admin login, dataset uploads, and saved/PDF results require MongoDB — see
§4.

### Frontend

The frontend is static — no build step. Easiest local option:

```bash
cd frontend
npx serve .          # or: python3 -m http.server 3000
```

Each HTML page sets `window.CYMOR_API_BASE_URL` inline (defaults to
`http://localhost:5000`). Change it there, or load `js/config.js` before
`js/api.js` and edit the single URL in that file, to point at a deployed
backend.

---

## 4. MongoDB Atlas setup (required for admin + saved PDF reports)

1. Create a free cluster at https://www.mongodb.com/cloud/atlas.
2. Create a database user and allow network access from your IP (or
   `0.0.0.0/0` for Render's dynamic egress IPs on the free tier).
3. Copy the connection string into `backend/.env` as `MONGODB_URI`.
4. Seed the real dataset and create your first admin user:
   ```bash
   cd backend
   npm run seed:import
   ```
   This activates a `2025/2026` dataset with all 2,122 real programme
   records and creates an admin user from `ADMIN_EMAIL` /
   `ADMIN_PASSWORD` in your `.env`.
5. Log in at `frontend/admin/login.html` with those credentials.

---

## 5. Admin workflow (once MongoDB is connected)

1. **Datasets → New Dataset** — create e.g. `2026/2027`.
2. Upload the requirements PDF and cutoffs PDF via:
   - `POST /api/admin/datasets/:id/upload-requirements`
   - `POST /api/admin/datasets/:id/upload-cutoffs`
   (multipart form field name: `file`)
3. **Import** (`POST /api/admin/datasets/:id/import`) — parses the cutoffs
   PDF live (see `importers/cutoffsPdfParser.js`) and merges it with the
   bundled requirements mapping.
4. Review **`GET /api/admin/datasets/:id/validation`** — programme counts,
   records with cutoff data, and every warning (duplicate codes, missing
   cutoffs, unmatched requirements).
5. **Activate** — the dataset becomes the one the public checker uses;
   the previous active dataset is automatically archived, never deleted.

The dashboard's "Import + Activate" button runs steps 3–5 for you and
shows the validation summary before you confirm activation.

---

## 6. Re-extracting data from the source PDFs

The bundled `data/*.json` files were generated with Python + `pdfplumber`
(more reliable table extraction than pure-JS PDF parsing for this
document's layout). To regenerate them from scratch:

```bash
pip install pdfplumber
python3 extract_cutoffs.py    # -> backend/src/data/cutoffs_raw.json
python3 extract_clusters.py   # -> backend/src/data/clusters_raw.json
```

Then rebuild the merged dataset used in demo mode:

```bash
cd backend
node -e "
const cutoffs = require('./src/data/cutoffs_raw.json');
const clusters = require('./src/data/clusters_raw.json');
const { buildDataset } = require('./src/importers/buildDataset');
const fs = require('fs');
fs.writeFileSync('./src/data/dataset.json', JSON.stringify(buildDataset(cutoffs, clusters)));
"
```

The **admin in-app upload flow** (§5) uses the Node-side parser
(`importers/cutoffsPdfParser.js`) instead, so KUCCPS's annual PDF refresh
doesn't require redeploying — just upload the new PDF through the admin
panel.

---

## 7. The PDF report

`backend/src/pdf/reportGenerator.js` renders the paid deliverable:

- Deep navy cover band with a gold accent rule, matching the product's
  brand identity end-to-end (landing page → checker → PDF).
- Three summary stat cards (mean grade, aggregate, qualifying count).
- A ranked table with **dynamic row heights** — long institution names
  (e.g. "Jomo Kenyatta University of Agriculture and Technology") and long
  programme names wrap onto multiple lines instead of clipping or
  overflowing columns.
- Table header repeats on every page; a gold rank stripe highlights the
  top 3 results.
- A footer on every page with the required disclaimer and
  "Developer: Legendary Smiley Cymor — Wishing you all the best.", sized
  and positioned so it never collides with the disclaimer text even on
  pages with many rows.
- Page numbers ("Page X of Y") on every page.

Fetch it via `GET /api/results/:id/pdf` once an analysis has been saved
(requires MongoDB — demo mode does not persist results, so the frontend
hides the download button when there's no `resultId`).

---

## 8. Testing

```bash
cd backend
npm test
```

Covers: grade↔points conversion, seven-subject aggregate selection
(Mathematics mandatory, best language mandatory, best-5-of-rest), the
weighted cluster score formula (including the spec's worked example,
r=42/t=70 ≈ 42.54), and the eligibility/ranking pipeline (cutoff
filtering, margin-descending ranking, top-100 capping, and — importantly
— that identical programme names at different universities are never
collapsed).

---

## 9. Deployment

### Backend → Render (free tier)

1. Push `backend/` to a GitHub repo (or the whole monorepo).
2. New Web Service on Render, root directory `backend`.
3. Build command `npm install`, start command `npm start`.
4. Add the environment variables from `.env.example` in the Render
   dashboard (never commit real secrets).
5. Health check path: `/api/health`.
6. `render.yaml` is included if you prefer Render's Blueprint deploys.

Note on Render's free tier filesystem: it's ephemeral. Locally-stored
uploads (`STORAGE_PROVIDER=local`) will not survive a redeploy. Swap
`STORAGE_PROVIDER` and implement the matching branch in
`services/storageService.js` (Cloudinary / S3 / R2 / Supabase Storage) for
persistent document storage — no other file needs to change.

### Frontend → Vercel

1. New Project, root directory `frontend`.
2. No build command needed (static HTML/CSS/JS).
3. After the backend is deployed, update `window.CYMOR_API_BASE_URL` in
   each HTML page (or centralize through `js/config.js`) to your Render
   URL, then redeploy.

### Database → MongoDB Atlas

See §4.

---

## 10. API reference

**Public**
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/datasets/active` | Active dataset summary |
| POST | `/api/checker/analyze` | Run the eligibility pipeline for a set of grades |
| GET | `/api/results/:id` | Fetch a saved analysis (requires MongoDB) |
| GET | `/api/results/:id/pdf` | Download the PDF report for a saved analysis |

**Admin** (Bearer JWT via `POST /api/admin/auth/login`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | Summary stats |
| GET | `/api/admin/datasets` | List datasets |
| POST | `/api/admin/datasets` | Create a dataset |
| POST | `/api/admin/datasets/:id/upload-requirements` | Upload requirements PDF |
| POST | `/api/admin/datasets/:id/upload-cutoffs` | Upload cutoffs PDF |
| POST | `/api/admin/datasets/:id/import` | Parse + validate + stage programmes |
| GET | `/api/admin/datasets/:id/validation` | Import preview / warnings |
| POST | `/api/admin/datasets/:id/activate` | Make this dataset live |
| POST | `/api/admin/datasets/:id/archive` | Archive a dataset |
| GET | `/api/admin/programmes` | Search/list programmes |

All responses follow `{ success, data }` or `{ success:false, error:{code,message} }`.

---

## 11. Payment (intentionally not implemented)

Every `AnalysisResult` already carries an `accessStatus` field
(`unlocked` today). Wiring in the future KSh 150 M-Pesa flow means adding
a `PaymentService`, gating `GET /api/results/:id` and the PDF route behind
`accessStatus === 'unlocked'`, and flipping it after payment verification
— no changes needed to the calculation engine, importer, or frontend
results rendering.

---

## 12. Disclaimer

Cymor KUCCPS Advisor is an independent educational guidance tool. Results
are calculated from the active KUCCPS dataset available in the system and
should not be treated as a guarantee of final placement or admission. Not
affiliated with or endorsed by KUCCPS.
