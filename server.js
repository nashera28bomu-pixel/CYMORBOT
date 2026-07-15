const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const engine = require("./engine");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const COURSES = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "courses.json"), "utf8"));

const SUBJECT_LIST = [
  "English", "Kiswahili", "Mathematics", "Biology", "Chemistry", "Physics",
  "History and Government", "Geography", "Christian Religious Education",
  "Islamic Religious Education", "Hindu Religious Education", "Agriculture",
  "Business Studies", "Home Science", "Computer Studies", "Art and Design",
  "French", "German", "Music", "Woodwork", "Metalwork", "Building Construction",
  "Power Mechanics", "Electricity", "Drawing and Design", "Aviation Technology"
];
const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E"];

app.get("/api/subjects", (req, res) => res.json({ subjects: SUBJECT_LIST, grades: GRADES }));

app.post("/api/check", (req, res) => {
  const { name, kcseYear, grades } = req.body || {};
  if (!name || !grades || typeof grades !== "object") {
    return res.status(400).json({ error: "Missing name or grades." });
  }
  const cleanGrades = {};
  for (const [subj, g] of Object.entries(grades)) {
    if (g && GRADES.includes(g)) cleanGrades[subj] = g;
  }

  const { meanPoints, meanGrade } = engine.computeMeanGrade(cleanGrades);
  const degreeEligible = engine.isDegreeEligible(meanGrade);

  let results = [];
  if (degreeEligible) {
    for (const course of COURSES) {
      const reqCheck = engine.checkMinimumRequirements(cleanGrades, course.minimumRequirements);
      if (!reqCheck.passed) continue;
      const { clusterPoints } = engine.computeClusterPoints(cleanGrades, course.subjectSlots);
      const probability = engine.probabilityLabel(clusterPoints, course.latestCutoff);
      results.push({
        progCode: course.progCode,
        programme: course.programme,
        institution: course.institution,
        cluster: course.cluster,
        subcluster: course.subcluster,
        clusterPoints,
        cutoff: course.latestCutoff,
        cutoffYear: course.latestCutoffYear,
        probability
      });
    }
    // Sort: qualifying (cluster points >= cutoff) first, then by how comfortably they qualify
    results.sort((a, b) => {
      const diffA = a.cutoff == null ? -999 : a.clusterPoints - a.cutoff;
      const diffB = b.cutoff == null ? -999 : b.clusterPoints - b.cutoff;
      return diffB - diffA;
    });
  }

  res.json({
    name, kcseYear,
    meanPoints, meanGrade,
    degreeEligible,
    totalMatches: results.length,
    results
  });
});

app.post("/api/report", (req, res) => {
  const { name, kcseYear, meanGrade, results } = req.body || {};
  if (!name || !Array.isArray(results)) {
    return res.status(400).json({ error: "Missing name or results." });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_course_report.pdf"`);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  // ---- Header ----
  doc.fontSize(20).fillColor("#7a1f3d").text("Cymor KUCCPS Course Checker Report", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("black");
  doc.text(`Name: ${name}`);
  if (kcseYear) doc.text(`KCSE Year: ${kcseYear}`);
  if (meanGrade) doc.text(`Overall Mean Grade: ${meanGrade}`);
  doc.text(`Report generated: ${new Date().toLocaleDateString()}`);
  doc.moveDown(0.5);
  doc.strokeColor("#7a1f3d").moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // ---- Eligible courses table ----
  doc.fontSize(13).fillColor("#7a1f3d").text("Courses You Qualify For", { underline: true });
  doc.moveDown(0.3);

  if (!results.length) {
    doc.fontSize(10).fillColor("black").text("No matching courses found with the grades entered. Consider diploma/certificate options or revisit your subject combination.");
  } else {
    const colX = [40, 100, 220, 360, 410, 460, 500];
    const headers = ["Code", "Course", "Institution", "Cluster Pts", "Cutoff", "Prob.", ""];
    doc.fontSize(8.5).fillColor("white");
    doc.rect(40, doc.y, 515, 16).fill("#7a1f3d");
    doc.fillColor("white");
    let hy = doc.y - 14;
    doc.text(headers[0], colX[0], hy, { width: 55 });
    doc.text(headers[1], colX[1], hy, { width: 115 });
    doc.text(headers[2], colX[2], hy, { width: 135 });
    doc.text(headers[3], colX[3], hy, { width: 45 });
    doc.text(headers[4], colX[4], hy, { width: 45 });
    doc.text(headers[5], colX[5], hy, { width: 55 });
    doc.moveDown(0.6);

    doc.fillColor("black").fontSize(8);
    results.forEach((r, i) => {
      if (doc.y > 760) { doc.addPage(); doc.y = 40; }
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(40, rowY - 2, 515, 14).fill("#f7eef1").fillColor("black");
      doc.text(r.progCode, colX[0], rowY, { width: 55 });
      doc.text(r.programme, colX[1], rowY, { width: 115 });
      doc.text(r.institution, colX[2], rowY, { width: 135 });
      doc.text(String(r.clusterPoints), colX[3], rowY, { width: 45 });
      doc.text(r.cutoff != null ? String(r.cutoff) : "N/A", colX[4], rowY, { width: 45 });
      doc.text(r.probability, colX[5], rowY, { width: 55 });
      doc.moveDown(0.75);
    });
  }

  // ---- My Top Picks ----
  doc.addPage();
  doc.fontSize(15).fillColor("#7a1f3d").text("My Top Picks", { underline: true });
  doc.moveDown(0.4);

  const highProb = results.filter(r => r.probability === "High");
  // group by programme name to find the same course across multiple institutions
  const byProgramme = {};
  highProb.forEach(r => {
    byProgramme[r.programme] = byProgramme[r.programme] || [];
    byProgramme[r.programme].push(r);
  });
  const bestProgrammeName = Object.keys(byProgramme).sort(
    (a, b) => byProgramme[b].length - byProgramme[a].length
  )[0];

  if (bestProgrammeName) {
    const picks = byProgramme[bestProgrammeName]
      .sort((a, b) => (b.clusterPoints - b.cutoff) - (a.clusterPoints - a.cutoff))
      .slice(0, 3);
    doc.fontSize(12).fillColor("black").text(`Your best-fit course: ${bestProgrammeName}`, { bold: true });
    doc.moveDown(0.3);
    const labels = ["1A", "1B", "1C"];
    picks.forEach((p, idx) => {
      doc.fontSize(10).fillColor("#7a1f3d").text(`${labels[idx]}. ${p.institution}`, { continued: false });
      doc.fontSize(9).fillColor("black").text(
        `   Course Code: ${p.progCode}  |  Your Cluster Points: ${p.clusterPoints}  |  Cutoff: ${p.cutoff ?? "N/A"}  |  Chance: ${p.probability}`
      );
      doc.moveDown(0.3);
    });
  } else {
    doc.fontSize(10).fillColor("black").text("No course scored a High probability with your current grades — see the medium-probability options below as your safer picks.");
  }

  doc.moveDown(0.6);
  doc.fontSize(11).fillColor("#7a1f3d").text("Other Strong Options:");
  doc.moveDown(0.2);
  const others = results
    .filter(r => r.programme !== bestProgrammeName)
    .filter(r => r.probability === "High" || r.probability === "Medium")
    .slice(0, 3);
  others.forEach((r, i) => {
    doc.fontSize(9.5).fillColor("black").text(
      `${i + 2}. ${r.programme} — ${r.institution} (Code: ${r.progCode}, Cluster Pts: ${r.clusterPoints}, Cutoff: ${r.cutoff ?? "N/A"}, Chance: ${r.probability})`
    );
    doc.moveDown(0.25);
  });

  doc.moveDown(1.5);
  doc.fontSize(9).fillColor("gray").text(
    "Cluster points shown are an independent estimate based on your top 4 relevant subject grades and are not an official KUCCPS computation. Always confirm on the official KUCCPS portal.",
    { align: "center" }
  );
  doc.moveDown(1);
  doc.fontSize(11).fillColor("#7a1f3d").text("Powered by Legendary Smiley Cymor", { align: "center" });
  doc.fontSize(10).fillColor("black").text("Wishing you all the best in your career.", { align: "center" });

  doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Cymor Course Checker running on port ${PORT}`));
