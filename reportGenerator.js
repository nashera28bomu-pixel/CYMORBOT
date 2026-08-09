const PDFDocument = require('pdfkit');

/**
 * Cymor KUCCPS Advisor — PDF Report Generator
 *
 * This report is the paid deliverable of the product, so layout quality
 * matters: readable type, generous margins, dynamic row heights so long
 * institution/programme names never clip, repeated headers on every page,
 * and a polished cover/summary section rather than a bare table.
 */

const PALETTE = {
  navyDark: '#0A1830',
  navy: '#0F2A52',
  navyLight: '#173B6E',
  gold: '#C9A24B',
  goldLight: '#F4E9CF',
  teal: '#0E7C7B',
  ink: '#1C2530',
  slate: '#5B6472',
  faint: '#EEF1F5',
  border: '#DEE3EA',
  green: '#1F8A4C',
  white: '#FFFFFF'
};

const CONTENT_MARGIN_X = 42;
const PAGE_WIDTH = 595.28; // A4 in points
const CONTENT_WIDTH = PAGE_WIDTH - CONTENT_MARGIN_X * 2;

// Column widths tuned to sum to CONTENT_WIDTH, generous enough for long names.
const COLS = [
  { key: 'rank', label: '#', width: 22, align: 'center' },
  { key: 'programmeCode', label: 'CODE', width: 54, align: 'left' },
  { key: 'programmeName', label: 'COURSE', width: 168, align: 'left' },
  { key: 'institutionName', label: 'UNIVERSITY / INSTITUTION', width: 148, align: 'left' },
  { key: 'latestCutoff', label: 'CUTOFF', width: 52, align: 'right' },
  { key: 'learnerScore', label: 'SCORE', width: 52, align: 'right' },
  { key: 'margin', label: 'MARGIN', width: 55, align: 'right' }
];

const TABLE_TOP_FIRST_PAGE = 258;
const TABLE_TOP_OTHER_PAGES = 98;
const ROW_PADDING_Y = 5;
const ROW_MIN_HEIGHT = 20;
const FOOTER_ZONE = 82;

function fmt(n, decimals = 3) {
  if (n === null || n === undefined || Number.isNaN(n)) return '\u2013';
  return n.toFixed(decimals);
}

function fmtMargin(n) {
  if (n === null || n === undefined) return '\u2013';
  const sign = n >= 0 ? '+' : '\u2212';
  return `${sign}${Math.abs(n).toFixed(3)}`;
}

function drawCoverBand(doc, { studentSummary, datasetAcademicYear, generatedAt }) {
  doc.rect(0, 0, doc.page.width, 168).fill(PALETTE.navyDark);
  doc.rect(0, 168, doc.page.width, 3).fill(PALETTE.gold);

  doc.fillColor(PALETTE.gold).font('Helvetica-Bold').fontSize(10)
    .text('CYMOR KUCCPS ADVISOR', CONTENT_MARGIN_X, 34, { characterSpacing: 1.5 });

  doc.fillColor(PALETTE.white).font('Helvetica-Bold').fontSize(23)
    .text('University Course Qualification Report', CONTENT_MARGIN_X, 50, { width: CONTENT_WIDTH });

  doc.fillColor('#C7D2E3').font('Helvetica').fontSize(10.5)
    .text('A personalized breakdown of the university programmes you currently qualify for,', CONTENT_MARGIN_X, 84)
    .text(`based on the ${datasetAcademicYear || 'active'} KUCCPS dataset.`, CONTENT_MARGIN_X, 99);

  doc.fillColor('#8CA0C2').font('Helvetica').fontSize(8.5)
    .text(`Generated ${generatedAt}`, CONTENT_MARGIN_X, 138);

  const cardY = 186;
  const cardW = (CONTENT_WIDTH - 24) / 3;
  const cards = [
    { label: 'OVERALL MEAN GRADE', value: studentSummary.meanGrade || '\u2013' },
    { label: '7-SUBJECT AGGREGATE', value: `${studentSummary.aggregatePoints} / 84` },
    { label: 'QUALIFYING PROGRAMMES', value: String(studentSummary.qualifyingCount) }
  ];
  cards.forEach((c, i) => {
    const x = CONTENT_MARGIN_X + i * (cardW + 12);
    doc.roundedRect(x, cardY, cardW, 54, 6).fillAndStroke(PALETTE.faint, PALETTE.border);
    doc.fillColor(PALETTE.slate).font('Helvetica-Bold').fontSize(7.5)
      .text(c.label, x + 12, cardY + 10, { width: cardW - 24, characterSpacing: 0.6 });
    doc.fillColor(PALETTE.navy).font('Helvetica-Bold').fontSize(18)
      .text(c.value, x + 12, cardY + 24, { width: cardW - 24 });
  });

  doc.fillColor(PALETTE.navy).font('Helvetica-Bold').fontSize(11.5)
    .text('Your Qualifying Courses', CONTENT_MARGIN_X, 260 - 22);
  doc.fillColor(PALETTE.slate).font('Helvetica').fontSize(8.5)
    .text('Ranked by strongest margin above the most recent available cutoff. Every university offering a', CONTENT_MARGIN_X, 260 - 9)
    .text('matching programme is listed separately so you can choose your preferred institution.', CONTENT_MARGIN_X, 260 + 3);
}

function drawTableHeader(doc, top) {
  doc.roundedRect(CONTENT_MARGIN_X, top, CONTENT_WIDTH, 22, 3).fill(PALETTE.navy);
  let x = CONTENT_MARGIN_X;
  doc.font('Helvetica-Bold').fontSize(7.6).fillColor(PALETTE.white);
  for (const col of COLS) {
    doc.text(col.label, x + 6, top + 7, { width: col.width - 10, align: col.align, characterSpacing: 0.3 });
    x += col.width;
  }
  return top + 22 + 4;
}

function measureRowHeight(doc, row) {
  doc.font('Helvetica').fontSize(8.4);
  const nameH = doc.heightOfString(row.programmeName || '', { width: COLS[2].width - 10 });
  const instH = doc.heightOfString(row.institutionName || '', { width: COLS[3].width - 10 });
  const contentH = Math.max(nameH, instH);
  return Math.max(ROW_MIN_HEIGHT, contentH + ROW_PADDING_Y * 2);
}

function drawRow(doc, y, row, rowHeight, zebra) {
  if (zebra) {
    doc.rect(CONTENT_MARGIN_X, y, CONTENT_WIDTH, rowHeight).fill(PALETTE.faint);
  }
  const isTop3 = row.rank <= 3;
  if (isTop3) {
    doc.rect(CONTENT_MARGIN_X, y, 3, rowHeight).fill(PALETTE.gold);
  }

  let x = CONTENT_MARGIN_X;
  const textY = y + ROW_PADDING_Y;

  doc.font('Helvetica-Bold').fontSize(8.2).fillColor(isTop3 ? PALETTE.navy : PALETTE.ink);
  doc.text(String(row.rank), x + 6, textY, { width: COLS[0].width - 10, align: 'center' });
  x += COLS[0].width;

  doc.font('Helvetica').fontSize(8).fillColor(PALETTE.slate);
  doc.text(row.programmeCode || '\u2013', x + 6, textY, { width: COLS[1].width - 10, align: 'left' });
  x += COLS[1].width;

  doc.font('Helvetica-Bold').fontSize(8.4).fillColor(PALETTE.ink);
  doc.text(row.programmeName || '', x + 6, textY, { width: COLS[2].width - 10, align: 'left' });
  x += COLS[2].width;

  doc.font('Helvetica').fontSize(8.4).fillColor(PALETTE.ink);
  doc.text(row.institutionName || '', x + 6, textY, { width: COLS[3].width - 10, align: 'left' });
  x += COLS[3].width;

  doc.font('Helvetica').fontSize(8.2).fillColor(PALETTE.slate);
  doc.text(fmt(row.latestCutoff), x + 6, textY, { width: COLS[4].width - 10, align: 'right' });
  x += COLS[4].width;

  doc.font('Helvetica-Bold').fontSize(8.2).fillColor(PALETTE.navy);
  doc.text(fmt(row.learnerScore), x + 6, textY, { width: COLS[5].width - 10, align: 'right' });
  x += COLS[5].width;

  doc.font('Helvetica-Bold').fontSize(8.2).fillColor(row.margin >= 0 ? PALETTE.green : PALETTE.ink);
  doc.text(fmtMargin(row.margin), x + 6, textY, { width: COLS[6].width - 10, align: 'right' });

  doc.moveTo(CONTENT_MARGIN_X, y + rowHeight).lineTo(CONTENT_MARGIN_X + CONTENT_WIDTH, y + rowHeight)
    .strokeColor(PALETTE.border).lineWidth(0.5).stroke();
}

function drawFooter(doc, pageIndex, pageCount) {
  const bottom = doc.page.height - FOOTER_ZONE;
  doc.moveTo(CONTENT_MARGIN_X, bottom).lineTo(doc.page.width - CONTENT_MARGIN_X, bottom)
    .strokeColor(PALETTE.border).lineWidth(0.75).stroke();

  doc.font('Helvetica').fontSize(6.6).fillColor(PALETTE.slate)
    .text(
      'Cutoff figures represent the most recent available cutoff in the active KUCCPS dataset. Qualification based on this ' +
      'analysis does not guarantee final KUCCPS placement or admission. Cymor KUCCPS Advisor is an independent educational ' +
      'guidance tool and is not affiliated with KUCCPS.',
      CONTENT_MARGIN_X, bottom + 7, { width: CONTENT_WIDTH, lineGap: 0.5 }
    );

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.navy)
    .text('Developer: Legendary Smiley Cymor', CONTENT_MARGIN_X, bottom + 46);
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(PALETTE.gold)
    .text('Wishing you all the best.', CONTENT_MARGIN_X + 172, bottom + 46);

  doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.slate)
    .text(`Page ${pageIndex} of ${pageCount}`, doc.page.width - CONTENT_MARGIN_X - 90, bottom + 46, { width: 90, align: 'right' });
}

/**
 * Streams a qualifying-programmes PDF report to the given writable stream.
 * @param {{studentSummary:{meanGrade:string,aggregatePoints:number,qualifyingCount:number}, results:Array, datasetAcademicYear?:string}} payload
 * @param {import('stream').Writable} outStream
 */
function generateReportPdf({ studentSummary, results, datasetAcademicYear }, outStream) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, autoFirstPage: true });
  doc.pipe(outStream);

  const generatedAt = new Date().toLocaleString('en-KE', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  drawCoverBand(doc, { studentSummary, datasetAcademicYear, generatedAt });
  let y = drawTableHeader(doc, TABLE_TOP_FIRST_PAGE);

  if (!results || results.length === 0) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(PALETTE.ink)
      .text('No qualifying programmes found.', CONTENT_MARGIN_X, y + 20);
    doc.font('Helvetica').fontSize(9).fillColor(PALETTE.slate)
      .text('None of the programmes in the active dataset currently satisfy both the minimum subject requirements and the latest cutoff for the grades supplied. Review your entered grades and try again.',
        CONTENT_MARGIN_X, y + 40, { width: CONTENT_WIDTH });
  } else {
    results.forEach((row, idx) => {
      const rowHeight = measureRowHeight(doc, row);
      if (y + rowHeight > doc.page.height - FOOTER_ZONE - 6) {
        doc.addPage();
        y = drawTableHeader(doc, TABLE_TOP_OTHER_PAGES);
      }
      drawRow(doc, y, row, rowHeight, idx % 2 === 0);
      y += rowHeight;
    });
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, i + 1, range.count);
  }

  doc.end();
}

module.exports = { generateReportPdf };
