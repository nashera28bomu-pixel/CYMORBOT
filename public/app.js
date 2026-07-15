const GRADES_FOR_FLOAT = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E"];
const DROPDOWN_GRADES = ["", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E"];

let currentSubjects = [];

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

function spawnFloatingGrades() {
  const container = document.getElementById("floatingGrades");
  const count = 26;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.textContent = GRADES_FOR_FLOAT[Math.floor(Math.random() * GRADES_FOR_FLOAT.length)];
    const size = 20 + Math.random() * 46;
    el.style.left = Math.random() * 100 + "%";
    el.style.fontSize = size + "px";
    const duration = 10 + Math.random() * 14;
    el.style.animationDuration = duration + "s";
    el.style.animationDelay = (Math.random() * duration) + "s";
    container.appendChild(el);
  }
}

function buildYearDropdown() {
  const sel = document.getElementById("yearInput");
  const now = new Date().getFullYear();
  for (let y = now; y >= now - 15; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  }
}

async function buildSubjectGrid() {
  const res = await fetch("/api/subjects");
  const data = await res.json();
  currentSubjects = data.subjects;
  const grid = document.getElementById("subjectGrid");
  grid.innerHTML = "";
  currentSubjects.forEach(subj => {
    const row = document.createElement("div");
    row.className = "subject-row";
    row.innerHTML = `
      <span>${subj}</span>
      <select data-subject="${subj}">
        ${DROPDOWN_GRADES.map(g => `<option value="${g}">${g || "-"}</option>`).join("")}
      </select>
    `;
    grid.appendChild(row);
  });
}

function collectGrades() {
  const grades = {};
  document.querySelectorAll("#subjectGrid select").forEach(sel => {
    if (sel.value) grades[sel.dataset.subject] = sel.value;
  });
  return grades;
}

function runLoadingSequence(onDone) {
  const overlay = document.getElementById("loadingOverlay");
  const textEl = document.getElementById("loadingText");
  const steps = [
    "Reading your grades...",
    "Checking minimum subject requirements...",
    "Calculating cluster points...",
    "Finding all courses you are qualified for...",
    "Almost finishing up...",
    "Ready!"
  ];
  overlay.classList.add("active");
  let i = 0;
  textEl.textContent = steps[0];
  const interval = setInterval(() => {
    i++;
    if (i < steps.length) {
      textEl.textContent = steps[i];
    } else {
      clearInterval(interval);
      overlay.classList.remove("active");
      onDone();
    }
  }, 700);
}

let lastReportData = null;

function renderResults(data) {
  lastReportData = data;
  const summary = document.getElementById("resultsSummary");
  const list = document.getElementById("resultsList");
  document.getElementById("resultsHeading").textContent = `Hi ${data.name}, here's what you qualify for`;

  if (!data.degreeEligible) {
    summary.innerHTML = `Your overall mean grade is <b>${data.meanGrade}</b>. This is below the C+ threshold required for degree courses, so no degree matches are shown. You may still qualify for diploma, certificate, or artisan courses at KUCCPS-affiliated colleges.`;
    list.innerHTML = "";
    document.getElementById("downloadPdfBtn").style.display = "none";
    return;
  }

  summary.innerHTML = `Mean Grade: <b>${data.meanGrade}</b> &nbsp;|&nbsp; Matching Courses: <b>${data.totalMatches}</b>`;
  document.getElementById("downloadPdfBtn").style.display = "block";

  if (!data.results.length) {
    list.innerHTML = `<p>No specific course matched your grades and subject combination against our current cutoff data. Try reviewing your subject entries, or check the KUCCPS portal directly for the newest list.</p>`;
    return;
  }

  list.innerHTML = data.results.slice(0, 60).map(r => `
    <div class="result-item">
      <div class="title">${r.programme}</div>
      <div class="inst">${r.institution} &middot; Code: ${r.progCode}</div>
      <div class="meta">
        <span>Your pts: ${r.clusterPoints} | Cutoff: ${r.cutoff ?? "N/A"}</span>
        <span class="badge ${r.probability}">${r.probability}</span>
      </div>
    </div>
  `).join("");
}

async function downloadPdf() {
  if (!lastReportData) return;
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lastReportData)
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${lastReportData.name.replace(/[^a-z0-9]/gi, "_")}_course_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

document.getElementById("startBtn").addEventListener("click", () => showScreen("formScreen"));

document.getElementById("submitBtn").addEventListener("click", async () => {
  const name = document.getElementById("nameInput").value.trim();
  const kcseYear = document.getElementById("yearInput").value;
  if (!name) { alert("Please enter your name."); return; }
  const grades = collectGrades();
  if (Object.keys(grades).length < 4) { alert("Please enter at least 4 subject grades."); return; }

  runLoadingSequence(async () => {
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kcseYear, grades })
      });
      const data = await res.json();
      renderResults(data);
      showScreen("resultsScreen");
    } catch (e) {
      alert("Something went wrong. Please try again.");
    }
  });
});

document.getElementById("downloadPdfBtn").addEventListener("click", downloadPdf);
document.getElementById("startOverBtn").addEventListener("click", () => showScreen("landing"));

spawnFloatingGrades();
buildYearDropdown();
buildSubjectGrid();
