import pptxgen from 'pptxgenjs';
import { executionTotals, defectTotals, automationTotals, completionPct, n } from '../constants.js';
import { drawPie3D, EXEC_COLORS, DEFECT_COLORS, AUTO_COLORS, AUTO_LABELS } from '../charts/pie3d.js';
import { drawGroupedBars, EXEC_BAR_COLORS } from '../charts/bar.js';

const MAGENTA = 'EC008C';
const NAVY = '1F3864';
const PINK = 'F06FAE';
const ROW_A = 'DBDBDB';
const ROW_B = 'EFEFEF';
const FONT = 'Segoe UI';
const BORDER = { type: 'solid', pt: 0.75, color: '666666' };
const MASTER = 'MSR_MASTER';
const PIE_DPI = 300; // raster resolution for the embedded 3D pies

const hc = (text, extra = {}) => ({
  text,
  options: { bold: true, fill: { color: PINK }, color: '1A1A1A', align: 'center', valign: 'middle', ...extra },
});

const pctText = (pass, executed) => (executed ? Math.round((pass / executed) * 100) + '%' : '-');

const cell = (text, i, extra = {}) => ({
  text: String(text),
  options: {
    fill: { color: i % 2 === 0 ? ROW_A : ROW_B },
    align: 'center',
    valign: 'middle',
    ...extra,
  },
});

function addSlideTitle(slide, text) {
  slide.addText(text, {
    x: 0.45, y: 0.2, w: 12.4, h: 0.6,
    fontSize: 26, bold: true, color: NAVY, fontFace: FONT, align: 'left',
  });
}

// The box is laid out horizontally (wide and short) and then the whole shape is
// rotated 270° around its center, so the text never wraps. cx/cy is the desired
// center of the final vertical strip; len is the strip's vertical length.
function addVerticalLabel(slide, text, cx, cy, len) {
  slide.addText(text, {
    x: cx - len / 2, y: cy - 0.21, w: len, h: 0.42,
    rotate: 270, align: 'center', valign: 'middle',
    bold: true, fontSize: 11, color: '1A1A1A',
    fill: { color: PINK }, fontFace: FONT, charSpacing: 2,
  });
}

// Renders the shared 3D pie onto an offscreen canvas at print resolution and
// embeds it as an image — pptxgenjs has no native 3D pie chart type.
function addPie(slide, { title, labels, values, colors, x, y, w, h }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PIE_DPI);
  canvas.height = Math.round(h * PIE_DPI);
  drawPie3D(canvas, { title, labels, values, colors });
  slide.addImage({ data: canvas.toDataURL('image/png'), x, y, w, h });
}

// Same rasterize-and-embed approach as addPie, for the grouped bar chart.
function addBar(slide, { title, categories, series, x, y, w, h }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PIE_DPI);
  canvas.height = Math.round(h * PIE_DPI);
  drawGroupedBars(canvas, { title, categories, series });
  slide.addImage({ data: canvas.toDataURL('image/png'), x, y, w, h });
}

function addTitleSlide(pptx, report, teamName) {
  const slide = pptx.addSlide();
  slide.background = { color: MAGENTA };

  const brand = [report.company, report.client].filter(Boolean).join('   |   ');
  if (brand) {
    slide.addText(brand, {
      x: 0.6, y: 0.5, w: 9, h: 0.5,
      fontSize: 20, bold: true, color: 'FFFFFF', fontFace: FONT,
    });
  }

  slide.addText(report.title || 'Monthly Status Report', {
    x: 0.6, y: 2.6, w: 7.6, h: 1.1,
    fontSize: 40, bold: true, color: 'FFFFFF', fontFace: FONT,
  });
  if (teamName) {
    slide.addText(teamName, {
      x: 0.6, y: 3.7, w: 7.6, h: 0.7,
      fontSize: 28, bold: true, color: 'FFFFFF', fontFace: FONT,
    });
  }
  slide.addText([report.subtitle, report.month].filter(Boolean).join(' — '), {
    x: 0.6, y: 4.4, w: 7.6, h: 0.6,
    fontSize: 20, color: 'FFFFFF', fontFace: FONT,
  });

  // Simple decorative outline shapes echoing the brand artwork
  const line = { color: 'FFFFFF', width: 1 };
  const noFill = { color: MAGENTA };
  slide.addShape(pptx.ShapeType.ellipse, { x: 9.0, y: 1.6, w: 1.7, h: 1.7, line, fill: noFill });
  slide.addShape(pptx.ShapeType.ellipse, { x: 9.45, y: 2.05, w: 0.8, h: 0.8, line, fill: noFill });
  slide.addShape(pptx.ShapeType.rect, { x: 11.0, y: 1.6, w: 1.7, h: 1.7, line, fill: noFill });
  slide.addShape(pptx.ShapeType.ellipse, { x: 11.0, y: 3.6, w: 1.7, h: 1.7, line, fill: noFill });
  slide.addShape(pptx.ShapeType.roundRect, { x: 9.0, y: 3.6, w: 0.55, h: 1.7, rectRadius: 0.27, line, fill: noFill });
  slide.addShape(pptx.ShapeType.roundRect, { x: 9.8, y: 3.9, w: 0.55, h: 1.4, rectRadius: 0.27, line, fill: noFill });
}

function addSummarySlide(pptx, title, squads, { totalLabel = 'Total', nameHeader = 'Squad', withCharts = true } = {}) {
  const slide = pptx.addSlide({ masterName: MASTER });
  addSlideTitle(slide, title);

  // Only show the Preprod group when at least one squad in this rollup has it.
  const showPreprod = squads.some((q) => q.hasPreprod);

  // Two-row header: shared columns span both rows; Test and Preprod each cap a
  // group of Pass / Fail / Blocked / Pass % columns.
  const headerRow1 = [
    hc(nameHeader, { rowspan: 2, align: 'left' }),
    hc('User Stories', { rowspan: 2 }),
    hc('Designed', { rowspan: 2 }),
    hc('Executed', { rowspan: 2 }),
    hc('Test', { colspan: 4 }),
    ...(showPreprod ? [hc('Preprod', { colspan: 4 })] : []),
    hc('Open Defects', { rowspan: 2 }),
    hc('Total Defects', { rowspan: 2 }),
  ];
  const headerRow2Labels = showPreprod
    ? ['Pass', 'Fail', 'Blocked/Hold', 'Pass %', 'Pass', 'Fail', 'Blocked/Hold', 'Pass %']
    : ['Pass', 'Fail', 'Blocked/Hold', 'Pass %'];
  const headerRow2 = headerRow2Labels.map((t) => hc(t));

  const rows = squads.map((q, i) => {
    const t = executionTotals(q.features);
    const d = defectTotals(q.defects);
    return [
      cell(q.name, i, { align: 'left', bold: true }),
      cell(t.userStories, i), cell(t.designed, i), cell(t.executed, i),
      cell(t.testPass, i), cell(t.testFail, i), cell(t.testBlocked, i), cell(pctText(t.testPass, t.executed), i),
      ...(showPreprod
        ? [cell(t.preprodPass, i), cell(t.preprodFail, i), cell(t.preprodBlocked, i), cell(pctText(t.preprodPass, t.executed), i)]
        : []),
      cell(d.open, i), cell(d.total, i),
    ];
  });

  const all = squads.reduce(
    (a, q) => {
      const t = executionTotals(q.features);
      const d = defectTotals(q.defects);
      return {
        userStories: a.userStories + t.userStories, designed: a.designed + t.designed, executed: a.executed + t.executed,
        testPass: a.testPass + t.testPass, testFail: a.testFail + t.testFail, testBlocked: a.testBlocked + t.testBlocked,
        preprodPass: a.preprodPass + t.preprodPass, preprodFail: a.preprodFail + t.preprodFail, preprodBlocked: a.preprodBlocked + t.preprodBlocked,
        open: a.open + d.open, closed: a.closed + d.closed, dblocked: a.dblocked + d.blocked,
        total: a.total + d.total,
      };
    },
    {
      userStories: 0, designed: 0, executed: 0,
      testPass: 0, testFail: 0, testBlocked: 0,
      preprodPass: 0, preprodFail: 0, preprodBlocked: 0,
      open: 0, closed: 0, dblocked: 0, total: 0,
    }
  );
  const totalRow = [
    { text: totalLabel, options: { bold: true, fill: { color: PINK }, align: 'left', valign: 'middle' } },
    ...[
      all.userStories, all.designed, all.executed,
      all.testPass, all.testFail, all.testBlocked, pctText(all.testPass, all.executed),
      ...(showPreprod
        ? [all.preprodPass, all.preprodFail, all.preprodBlocked, pctText(all.preprodPass, all.executed)]
        : []),
      all.open, all.total,
    ].map((v) => cell(v, 0, { bold: true })),
  ];

  const colW = showPreprod
    ? [2.4, 0.75, 0.8, 0.8, 0.65, 0.65, 0.95, 0.7, 0.65, 0.65, 0.95, 0.7, 0.95, 0.95]
    : [3.6, 1.0, 1.0, 1.0, 0.95, 0.95, 1.25, 0.95, 1.15, 1.2];
  slide.addTable([headerRow1, headerRow2, ...rows, totalRow], {
    x: 0.45, y: 1.0, w: showPreprod ? 12.55 : 12.45,
    colW,
    border: BORDER, fontSize: 10, fontFace: FONT, rowH: 0.32, valign: 'middle',
  });

  const chartsY = 1.0 + (squads.length + 3) * 0.34 + 0.3;
  if (withCharts && chartsY < 4.8) {
    const ph = Math.min(6.9 - chartsY, 2.6);
    const pies = [
      {
        title: 'OVERALL TEST EXECUTION',
        labels: ['Pass', 'Fail', 'Blocked/Hold'],
        values: [all.testPass, all.testFail, all.testBlocked],
        colors: EXEC_COLORS,
      },
      ...(showPreprod
        ? [{
            title: 'OVERALL PREPROD EXECUTION',
            labels: ['Pass', 'Fail', 'Blocked/Hold'],
            values: [all.preprodPass, all.preprodFail, all.preprodBlocked],
            colors: EXEC_COLORS,
          }]
        : []),
      {
        title: 'OVERALL DEFECTS',
        labels: ['Open', 'Closed', 'Blocked'],
        values: [all.open, all.closed, all.dblocked],
        colors: DEFECT_COLORS,
      },
    ];
    // Spread the 2 or 3 pies evenly across the slide width.
    const pw = pies.length === 3 ? 4.1 : 5.4;
    const gap = (12.9 - pw * pies.length) / (pies.length + 1);
    pies.forEach((p, i) => addPie(slide, { ...p, x: 0.2 + gap + i * (pw + gap), y: chartsY, w: pw, h: ph }));
  }
}

function addProjectTag(slide, projectName) {
  if (!projectName) return;
  slide.addText(projectName, {
    x: 9.0, y: 0.28, w: 3.85, h: 0.4,
    fontSize: 12, italic: true, color: MAGENTA, align: 'right', fontFace: FONT,
  });
}

function addSquadStatusSlide(pptx, projectName, squad) {
  const slide = pptx.addSlide({ masterName: MASTER });
  addSlideTitle(slide, squad.name);
  addProjectTag(slide, projectName);

  const t = executionTotals(squad.features);
  const d = defectTotals(squad.defects);

  const showPreprod = !!squad.hasPreprod;

  // --- Execution table (full width, Test + optional Preprod groups) ---
  const execY = 0.95;
  const execRowH = 0.3;
  const execHeader1 = [
    hc('Features', { rowspan: 2, align: 'left' }),
    hc('User Stories', { rowspan: 2 }),
    hc('Designed', { rowspan: 2 }),
    hc('Executed', { rowspan: 2 }),
    hc('Test', { colspan: 3 }),
    ...(showPreprod ? [hc('Preprod', { colspan: 3 })] : []),
  ];
  const execHeader2 = (showPreprod
    ? ['Pass', 'Fail', 'Blocked/Hold', 'Pass', 'Fail', 'Blocked/Hold']
    : ['Pass', 'Fail', 'Blocked/Hold']
  ).map((x) => hc(x));
  const execRows = [
    execHeader1,
    execHeader2,
    ...squad.features.map((f, i) => [
      cell(f.name || '-', i, { align: 'left' }),
      cell(n(f.userStories), i), cell(n(f.designed), i), cell(n(f.executed), i),
      cell(n(f.testPass), i), cell(n(f.testFail), i), cell(n(f.testBlocked), i),
      ...(showPreprod ? [cell(n(f.preprodPass), i), cell(n(f.preprodFail), i), cell(n(f.preprodBlocked), i)] : []),
    ]),
    [
      { text: 'Total', options: { bold: true, fill: { color: PINK }, align: 'left', valign: 'middle' } },
      ...[
        t.userStories, t.designed, t.executed,
        t.testPass, t.testFail, t.testBlocked,
        ...(showPreprod ? [t.preprodPass, t.preprodFail, t.preprodBlocked] : []),
      ].map((v) => cell(v, 0, { bold: true })),
    ],
  ];
  const execH = (squad.features.length + 3) * execRowH;
  const execW = showPreprod ? 11.55 : 8.4;
  const execColW = showPreprod
    ? [3.0, 0.95, 0.95, 0.95, 0.85, 0.85, 1.15, 0.85, 0.85, 1.15]
    : [3.2, 1.05, 1.05, 1.05, 0.95, 0.95, 1.15];
  addVerticalLabel(slide, 'EXECUTION', 0.52, execY + execH / 2, Math.max(1.6, Math.min(execH, 2.4)));
  slide.addTable(execRows, {
    x: 0.75, y: execY, w: execW,
    colW: execColW,
    border: BORDER, fontSize: 10, fontFace: FONT, rowH: execRowH, valign: 'middle',
  });

  // --- Lower half is laid out bottom-up so it never collides with the footer.
  // The JIRA notes are pinned just above the master footer (text at y=6.98), the
  // defects table sits directly above them, and the execution pies fill whatever
  // vertical space is left between the execution table and the defects table.
  const FOOTER_TOP = 6.92;
  const defectRowH = 0.3;
  const defectsH = (squad.defects.length + 2) * defectRowH; // header + rows + total
  const noteLines = [
    `Total defects raised in JIRA- ${n(squad.jiraDefects)}`,
    `Total observations raised in JIRA comments- ${n(squad.jiraObservations)}`,
  ];
  const noteLineH = 0.26;
  const notesH = noteLines.length * noteLineH;
  const notesY = FOOTER_TOP - notesH;
  const defectsY = notesY - 0.12 - defectsH;

  // --- Execution status: one grouped bar chart (Test, plus Preprod when present) ---
  const pieY = execY + execH + 0.15;
  const pieH = Math.max(1.3, defectsY - 0.15 - pieY);
  addBar(slide, {
    title: showPreprod ? 'TEST vs PREPROD EXECUTION STATUS' : 'TEST EXECUTION STATUS',
    categories: ['Pass', 'Fail', 'Blocked/Hold'],
    series: [
      { name: 'Test', color: EXEC_BAR_COLORS[0], values: [t.testPass, t.testFail, t.testBlocked] },
      ...(showPreprod
        ? [{ name: 'Preprod', color: EXEC_BAR_COLORS[1], values: [t.preprodPass, t.preprodFail, t.preprodBlocked] }]
        : []),
    ],
    x: 2.4, y: pieY, w: 8.5, h: pieH,
  });

  // --- Defects table ---
  const defectRows = [
    [hc('Status'), hc('Open'), hc('Closed'), hc('Blocked'), hc('Total')],
    ...squad.defects.map((r, i) => [
      cell(r.severity, i, { bold: true }),
      cell(n(r.open), i), cell(n(r.closed), i), cell(n(r.blocked), i),
      cell(n(r.open) + n(r.closed) + n(r.blocked), i),
    ]),
    [
      { text: 'Total', options: { bold: true, fill: { color: PINK }, align: 'center', valign: 'middle' } },
      ...[d.open, d.closed, d.blocked, d.total].map((v) => cell(v, 0, { bold: true })),
    ],
  ];
  addVerticalLabel(slide, 'DEFECTS', 0.52, defectsY + defectsH / 2, Math.min(defectsH, 1.8));
  slide.addTable(defectRows, {
    x: 0.75, y: defectsY, w: 7.0,
    colW: [1.8, 1.3, 1.3, 1.3, 1.3],
    border: BORDER, fontSize: 11, fontFace: FONT, rowH: defectRowH, valign: 'middle',
  });
  addPie(slide, {
    title: 'DEFECTS',
    labels: ['Open', 'Closed', 'Blocked'],
    values: [d.open, d.closed, d.blocked],
    colors: DEFECT_COLORS,
    x: 8.1, y: defectsY, w: 4.8, h: Math.min(2.4, FOOTER_TOP - defectsY),
  });

  // --- JIRA counts (pinned just above the footer, beneath the defects table) ---
  slide.addText(
    noteLines.map((text, i) => ({
      text,
      options: { bold: true, fontSize: 12, breakLine: i < noteLines.length - 1 },
    })),
    { x: 0.75, y: notesY, w: 7.0, h: notesH, fontFace: FONT, color: '1A1A1A', valign: 'top' }
  );
}

function addAutomationSlide(pptx, projectName, squad) {
  const slide = pptx.addSlide({ masterName: MASTER });
  addSlideTitle(slide, `${squad.name} Automation Metrics`);
  addProjectTag(slide, projectName);

  const features = squad.automation?.features || [];
  const at = automationTotals(features);

  // --- Automation execution table ---
  const tableY = 0.95;
  const rowH = 0.32;
  const header = ['Features', 'Total', 'Designed', 'Executed', 'Rework', 'Rework In Progress', 'Rework Completed', 'Pass', 'Fail', 'Completion %', 'Blocked/Hold'].map((x, i) =>
    hc(x, i === 0 ? { align: 'left' } : {})
  );
  const bodyRows = features.map((f, i) => [
    cell(f.name || '-', i, { align: 'left' }),
    cell(n(f.total), i), cell(n(f.designed), i), cell(n(f.executed), i),
    cell(n(f.rework), i), cell(n(f.reworkInProgress), i), cell(n(f.reworkCompleted), i),
    cell(n(f.pass), i), cell(n(f.fail), i), cell(completionPct(f.pass, f.executed), i), cell(n(f.blocked), i),
  ]);
  const totalRow = [
    { text: 'Total', options: { bold: true, fill: { color: PINK }, align: 'left', valign: 'middle' } },
    ...[
      at.total, at.designed, at.executed, at.rework, at.reworkInProgress, at.reworkCompleted,
      at.pass, at.fail, completionPct(at.pass, at.executed), at.blocked,
    ].map((v) => cell(v, 0, { bold: true })),
  ];
  const tableH = (features.length + 2) * rowH;
  addVerticalLabel(slide, 'EXECUTION', 0.52, tableY + tableH / 2, Math.max(1.6, Math.min(tableH, 2.4)));
  slide.addTable([header, ...bodyRows, totalRow], {
    x: 0.75, y: tableY, w: 11.15,
    colW: [2.4, 0.75, 0.85, 0.85, 0.8, 1.05, 1.05, 0.75, 0.7, 1.0, 0.95],
    border: BORDER, fontSize: 9.5, fontFace: FONT, rowH, valign: 'middle',
  });

  // --- Highlights (left) and the outcome pie + Completion KPI (right) ---
  const lowerY = tableY + tableH + 0.35;
  const paras = [];
  pushSection(paras, 'Highlight :', squad.automation?.highlights);
  slide.addText(paras, {
    x: 0.75, y: lowerY, w: 6.6, h: 7.0 - lowerY,
    fontFace: FONT, color: '1A1A1A', valign: 'top',
  });
  const pieY = Math.min(lowerY, 3.5);
  addPie(slide, {
    title: 'AUTOMATION EXECUTION STATUS',
    labels: AUTO_LABELS,
    // Mutually-exclusive outcomes only — see AUTO_LABELS in charts/pie3d.js.
    values: [at.pass, at.fail, at.blocked],
    colors: AUTO_COLORS,
    x: 7.6, y: pieY, w: 5.4, h: Math.min(6.9 - pieY, 3.4),
  });
  // Completion % as a standalone KPI rather than a (meaningless) pie slice.
  slide.addText(
    [
      { text: `${completionPct(at.pass, at.executed)}%`, options: { fontSize: 30, bold: true, color: MAGENTA } },
      { text: '\nCompletion', options: { fontSize: 11, bold: true, color: NAVY } },
      { text: `\nPass ${at.pass} ÷ Executed ${at.executed}`, options: { fontSize: 9, color: '7A7A7A' } },
    ],
    { x: 11.55, y: pieY + 0.35, w: 1.6, h: 1.4, align: 'center', valign: 'middle', fontFace: FONT },
  );
}

function pushSection(paras, title, items) {
  paras.push({
    text: title,
    options: { bold: true, fontSize: 16, breakLine: true, paraSpaceBefore: 14, paraSpaceAfter: 8, bullet: false },
  });
  const list = (items || []).map((s) => (s || '').trim()).filter(Boolean);
  if (!list.length) {
    paras.push({ text: 'NA', options: { fontSize: 13, breakLine: true, bullet: false } });
  } else {
    list.forEach((it) =>
      paras.push({
        text: it,
        options: { bullet: { code: '2022' }, fontSize: 14, breakLine: true, paraSpaceAfter: 4, indentLevel: 0 },
      })
    );
  }
}

function addDeliverablesSlide(pptx, projectName, squad) {
  const slide = pptx.addSlide({ masterName: MASTER });
  addSlideTitle(slide, squad.name);
  addProjectTag(slide, projectName);

  const paras = [];
  pushSection(paras, 'Key Deliverables from current month:', squad.deliverables);
  pushSection(paras, 'Plan for next month:', squad.nextPlan);
  pushSection(paras, 'Pending Dependency/Challenges:', squad.challenges);

  slide.addText(paras, {
    x: 0.6, y: 1.0, w: 12.1, h: 6.0,
    fontFace: FONT, color: '1A1A1A', valign: 'top',
  });
}

function addCustomSlide(pptx, projectName, squad, cs) {
  const slide = pptx.addSlide({ masterName: MASTER });
  addSlideTitle(slide, cs.title || 'Custom Slide');
  addProjectTag(slide, [projectName, squad.name].filter(Boolean).join(' — '));

  const lines = (cs.body || '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return;
  const paras = lines.map((l) => ({
    text: l.trim().replace(/^[-•*]\s*/, ''),
    options: {
      bullet: { code: '2022' },
      indentLevel: /^\s{2,}/.test(l) ? 1 : 0,
      fontSize: 14,
      breakLine: true,
      paraSpaceAfter: 6,
    },
  }));
  slide.addText(paras, {
    x: 0.6, y: 1.0, w: 12.1, h: 6.0,
    fontFace: FONT, color: '1A1A1A', valign: 'top',
  });
}

function addThankYouSlide(pptx, report) {
  const slide = pptx.addSlide();
  slide.background = { color: MAGENTA };
  slide.addText('Thank You', {
    x: 0, y: 3.0, w: 13.33, h: 1.2,
    fontSize: 44, bold: true, color: 'FFFFFF', align: 'center', fontFace: FONT,
  });
  if (report.company) {
    slide.addText(report.company, {
      x: 0, y: 4.3, w: 13.33, h: 0.5,
      fontSize: 16, color: 'FFFFFF', align: 'center', fontFace: FONT,
    });
  }
}

// Collapses a project into a single squad-shaped row for the overall summary:
// executionTotals/defectTotals only sum rows, so concatenating every squad's
// features and defect rows yields the project aggregate.
const projectAsRow = (p) => ({
  name: p.name || 'Untitled Project',
  hasPreprod: p.squads.some((q) => q.hasPreprod),
  features: p.squads.flatMap((q) => q.features),
  defects: p.squads.flatMap((q) => q.defects),
});

const safe = (s) => (s || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');

// Builds a complete, self-contained deck for one team. Every summary and
// total inside it is calculated from this team's data only.
async function exportTeamPptx(report, team) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = report.company || 'MSR Generator';
  pptx.title = `${report.title} - ${team.name} - ${report.month}`;

  pptx.defineSlideMaster({
    title: MASTER,
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 7.31, w: '100%', h: 0.19, fill: { color: MAGENTA } } },
      {
        text: {
          text: [report.company, team.name].filter(Boolean).join(' — '),
          options: { x: 0.45, y: 6.98, w: 5, h: 0.3, fontSize: 9, color: '9A9A9A', align: 'left', fontFace: FONT },
        },
      },
    ],
    slideNumber: { x: 12.55, y: 6.98, w: 0.6, h: 0.3, fontSize: 10, color: '9A9A9A', fontFace: FONT },
  });

  addTitleSlide(pptx, report, team.name);

  // With multiple projects, lead with a team-level rollup (one row per project).
  if (team.projects.length > 1) {
    addSummarySlide(pptx, `${team.name} — Overall Summary — ${report.month}`, team.projects.map(projectAsRow), {
      nameHeader: 'Project',
      totalLabel: 'Team Total',
    });
  }

  for (const project of team.projects) {
    if (project.squads.length > 0) {
      addSummarySlide(pptx, `${project.name} — Summary`, project.squads, {
        totalLabel: 'Project Total',
      });
    }
    for (const squad of project.squads) {
      addSquadStatusSlide(pptx, project.name, squad);
      if (squad.hasAutomation) addAutomationSlide(pptx, project.name, squad);
      addDeliverablesSlide(pptx, project.name, squad);
      for (const cs of squad.customSlides || []) addCustomSlide(pptx, project.name, squad, cs);
    }
  }

  addThankYouSlide(pptx, report);

  await pptx.writeFile({
    fileName: `MSR_${safe(report.client || report.title)}_${safe(team.name)}_${safe(report.month)}.pptx`,
  });
}

// One PPTX file per team; each deck's calculations cover only that team.
export async function exportPptx(state) {
  const { report, teams } = state;
  if (!teams.length) throw new Error('Add at least one team before exporting.');
  for (const team of teams) {
    await exportTeamPptx(report, team);
  }
}
