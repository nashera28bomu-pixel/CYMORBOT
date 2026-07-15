# Cymor Course Checker

Grade entry -> KUCCPS-style cluster point calculation -> minimum subject requirement
check -> matching degree courses -> downloadable PDF report.

## Run it
```
npm install
node server.js
```
Then open http://localhost:3000 (or your Render URL).

## Data
- `data/courses.json` - 2,122 programme/institution/cutoff records extracted directly
  from the KUCCPS 2025/2026 Degree Cutoffs document (2018-2024 cutoff history), each
  tagged with a cluster + minimum subject requirements.
- `data/clusterRules.json` - the 20 KUCCPS clusters and ~50 subclusters with their
  minimum subject grade requirements, taken from the official Cluster Document.
- `data/programmeClusterMap.json` - maps every one of the 1,017 distinct programme
  titles in the cutoffs data to its cluster/subcluster. Built with a keyword classifier;
  ~89% matched with high confidence, the rest fall back to a generic Bachelor of
  Science requirement (9A) - worth spot-checking against the official cluster document
  for niche programmes before fully trusting an edge-case result.

## How the numbers work
- **Cluster points**: sum of your best 4 relevant subject grade-points (0-48 scale),
  same scale as the published cutoffs - this is an estimate, not KUCCPS's exact
  proprietary formula (which isn't public).
- **Minimum subject requirements**: hard gate, checked before cluster points - a
  student failing a required subject/grade never sees that course, regardless of
  points.
- **Mean grade C+ gate**: below C+ overall, no degree courses are shown at all
  (matches real KUCCPS eligibility rules).
- **Probability**: High (your points beat the cutoff by 1.5+), Medium (within 1
  point either side), Low (below cutoff by more than 1 point).

## To extend
- Re-run the classifier (see conversation) if KUCCPS revises cluster rules.
- Swap `data/courses.json` for MongoDB Atlas storage later if you want to manage
  data without redeploying - the schema is flat and Mongo-ready as-is.
