import pptxgen from 'pptxgenjs';
import { wsrRegTotals, n } from '../constants.js';

// ─── Weekly Status Report (WSR) export ───────────────────────────────────────
// One deck for the whole report (no Team level). A clean, app-themed title slide
// followed by one dense status slide per squad — matching the source layout:
// a Report Card table (Test/Pre-Prod × Test-Cases + Defects), a Regression table,
// then Highlights, Plan-for-next-week and Risks/Issues sections.

const FONT = 'Segoe UI';
const MAGENTA = 'EC008C';
const NAVY = '1F3864';
const DARKTEAL = '0E3D46';
const TEAL = '7FCFD3';
const GREEN = '8DC63F';
const PINK = 'F06FAE';
const BORDER = { type: 'solid', pt: 0.75, color: '4A4A4A' };
const MASTER = 'WSR_MASTER';

// Header cell (dark teal, white) for the big table banners.
const hHead = (text, extra = {}) => ({
  text: String(text),
  options: { bold: true, fill: { color: DARKTEAL }, color: 'FFFFFF', align: 'center', valign: 'middle', fontSize: 10, ...extra },
});
// Sub-header cell (light teal, dark text).
const hSub = (text, extra = {}) => ({
  text: String(text),
  options: { bold: true, fill: { color: TEAL }, color: '0A2A30', align: 'center', valign: 'middle', fontSize: 9, ...extra },
});
// Data cell (white).
const dCell = (text, extra = {}) => ({
  text: String(text ?? ''),
  options: { fill: { color: 'FFFFFF' }, color: '1A1A1A', align: 'center', valign: 'middle', fontSize: 9, ...extra },
});

function addTitle(slide, text) {
  slide.addText(text, {
    x: 0.4, y: 0.18, w: 12.5, h: 0.55, fontSize: 24, bold: true, color: NAVY, fontFace: FONT, align: 'left',
  });
}

// A section banner bar (dark teal) with white title text.
function addBanner(slide, text, x, y, w) {
  slide.addText(text, {
    x, y, w, h: 0.32, fill: { color: DARKTEAL }, color: 'FFFFFF', bold: true,
    fontSize: 11, align: 'left', valign: 'middle', fontFace: FONT, margin: [2, 6, 2, 6],
  });
}

// A bordered text box of bullet points (used for Highlights / Plan / Risks).
function addBullets(slide, items, x, y, w, h) {
  const clean = (items || []).map((s) => String(s || '').trim()).filter(Boolean);
  const runs = clean.length
    ? clean.map((text) => ({ text, options: { bullet: { code: '2022' }, breakLine: true, paraSpaceAfter: 4, fontSize: 10 } }))
    : [{ text: 'NA', options: { fontSize: 10 } }];
  slide.addText(runs, {
    x, y, w, h, fontFace: FONT, color: '1A1A1A', valign: 'top',
    line: BORDER, margin: [4, 6, 4, 6],
  });
}

// ── Title slide (clean app theme — no external brand assets) ──────────────────
function addTitleSlide(pptx, report, squads) {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  // Magenta accent bar.
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: MAGENTA } });
  slide.addText(report.title || 'Weekly Status Report', {
    x: 0.9, y: 2.2, w: 11.5, h: 1.0, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: FONT,
  });
  if (report.period) {
    slide.addText(`Week ending — ${report.period}`, {
      x: 0.95, y: 3.3, w: 11.5, h: 0.5, fontSize: 18, color: 'D9DEEA', fontFace: FONT,
    });
  }
  const sub = [report.client, report.company].filter(Boolean).join('  •  ');
  if (sub) {
    slide.addText(sub, { x: 0.95, y: 3.85, w: 11.5, h: 0.4, fontSize: 14, color: MAGENTA, bold: true, fontFace: FONT });
  }
  const names = squads.map((s) => s.name).filter(Boolean).join('  ·  ');
  if (names) {
    slide.addText(names, { x: 0.95, y: 5.0, w: 11.5, h: 1.5, fontSize: 12, color: '9AA6BD', fontFace: FONT, valign: 'top' });
  }
}

// ── One squad's status slide ──────────────────────────────────────────────────
function addSquadSlide(pptx, report, squad) {
  const slide = pptx.addSlide({ masterName: MASTER });
  addTitle(slide, `Weekly Status Report - ${squad.name || 'Squad'}`);

  const cardTitle = squad.reportCardTitle?.trim() || `Report Card – ${squad.name || ''}`;
  const period = squad.period?.trim() || report.period || '';
  const showPre = !!squad.hasPreprod;
  const t = squad.test || {};
  const p = squad.preprod || {};

  // ── Report Card table ──
  // 12 columns: [period/owner] [env] [user stories] [Designed Passed Fail Blocked To-Do] [Critical High Medium Low]
  const rows = [
    [hHead('Status Report Period'), hHead(cardTitle, { colspan: 11 })],
    [
      dCell(period, { rowspan: 2, bold: true }),
      hSub('', { rowspan: 2 }),
      hSub('User\nStories', { rowspan: 2 }),
      hSub('Test Cases', { colspan: 5 }),
      hSub('Defects', { colspan: 4 }),
    ],
    [hSub('Designed'), hSub('Passed'), hSub('Fail'), hSub('Blocked'), hSub('To-Do'), hSub('Critical'), hSub('High'), hSub('Medium'), hSub('Low')],
    [
      dCell(squad.owner || '', { rowspan: 2, bold: true, fill: { color: DARKTEAL }, color: 'FFFFFF' }),
      { text: 'Test', options: { bold: true, fill: { color: GREEN }, color: 'FFFFFF', align: 'center', valign: 'middle', fontSize: 10 } },
      dCell(n(squad.userStories), { rowspan: 2 }),
      dCell(n(t.designed)), dCell(n(t.passed)), dCell(n(t.fail)), dCell(n(t.blocked)), dCell(n(t.toDo)),
      dCell(n(t.critical)), dCell(n(t.high)), dCell(n(t.medium)), dCell(n(t.low)),
    ],
    [
      { text: 'Pre Prod', options: { bold: true, fill: { color: GREEN }, color: 'FFFFFF', align: 'center', valign: 'middle', fontSize: 10 } },
      dCell(showPre ? n(p.designed) : ''), dCell(showPre ? n(p.passed) : ''), dCell(showPre ? n(p.fail) : ''),
      dCell(showPre ? n(p.blocked) : ''), dCell(showPre ? n(p.toDo) : ''),
      dCell(showPre ? n(p.critical) : ''), dCell(showPre ? n(p.high) : ''), dCell(showPre ? n(p.medium) : ''), dCell(showPre ? n(p.low) : ''),
    ],
  ];
  const cardY = 0.85;
  slide.addTable(rows, {
    x: 0.35, y: cardY, w: 12.6,
    colW: [2.0, 1.1, 0.9, 0.86, 0.86, 0.86, 0.86, 0.86, 0.95, 0.95, 0.95, 0.95],
    border: BORDER, rowH: 0.3, fontFace: FONT, valign: 'middle',
  });

  // ── Regression table ──
  const reg = squad.regression?.length ? squad.regression : [];
  const totals = wsrRegTotals(reg);
  const regHead = [
    hHead('Regression', { align: 'left' }),
    hHead('Total'), hHead('Designed'), hHead('Rework'), hHead('Rework In Prog'), hHead('Rework Completed'),
    hHead('Executed'), hHead('Pass'), hHead('Fail'), hHead('To Do'), hHead('% Completion'), hHead('Blocked/Hold'),
  ];
  const regKey = ['total', 'designed', 'reworkTotal', 'reworkInProgress', 'reworkCompleted', 'executed', 'pass', 'fail', 'toDo'];
  const regBody = reg.map((r) => [
    { text: r.name || '', options: { fill: { color: PINK }, color: '1A1A1A', bold: true, align: 'center', valign: 'middle', fontSize: 9 } },
    ...regKey.map((k) => dCell(n(r[k]))),
    dCell(r.completion || ''),
    dCell(n(r.blockedHold)),
  ]);
  const regTotalRow = [
    { text: 'Total', options: { fill: { color: 'FFFFFF' }, bold: true, align: 'center', valign: 'middle', fontSize: 9 } },
    ...regKey.map((k) => dCell(n(totals[k]), { bold: true })),
    dCell(totals.completion, { bold: true }),
    dCell(n(totals.blockedHold), { bold: true }),
  ];
  const regY = cardY + 5 * 0.3 + 0.18;
  slide.addTable([regHead, ...regBody, regTotalRow], {
    x: 0.35, y: regY, w: 12.6,
    colW: [2.0, 0.9, 0.95, 0.85, 1.05, 1.2, 0.95, 0.85, 0.8, 0.8, 1.1, 1.15],
    border: BORDER, rowH: 0.3, fontFace: FONT, valign: 'middle',
  });

  // ── Highlights banner + box ──
  const hlY = regY + (regBody.length + 2) * 0.3 + 0.18;
  addBanner(slide, 'Highlights & Accomplishments, Value Adds and Accolades', 0.35, hlY, 12.6);
  const FOOTER = 7.15;
  const bottomBlockH = 1.5; // plan + risks row
  const hlBoxY = hlY + 0.34;
  const hlBoxH = Math.max(0.8, FOOTER - bottomBlockH - 0.5 - hlBoxY);
  addBullets(slide, squad.highlights, 0.35, hlBoxY, 12.6, hlBoxH);

  // ── Plan (left) + Risks (right) ──
  const bottomY = hlBoxY + hlBoxH + 0.16;
  addBanner(slide, 'Pending Action Item / Dependencies and Plan for Next week', 0.35, bottomY, 6.25);
  addBanner(slide, 'Risks, Issues & Challenges', 6.7, bottomY, 6.25);
  const boxY = bottomY + 0.34;
  const boxH = Math.max(0.7, FOOTER - 0.2 - boxY);
  addBullets(slide, squad.plan, 0.35, boxY, 6.25, boxH);
  addBullets(slide, squad.risks, 6.7, boxY, 6.25, boxH);
}

const safe = (s) => (s || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'report';

export async function exportWsrPptx(state) {
  const { report, teams } = state;
  const squads = (teams || []).flatMap((t) => (t.projects || []).flatMap((p) => p.squads || []));
  if (squads.length === 0) throw new Error('Add at least one squad before exporting.');

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = report.company || 'Status Report';
  pptx.title = `${report.title || 'Weekly Status Report'} - ${report.period || ''}`;

  pptx.defineSlideMaster({
    title: MASTER,
    background: { color: 'FFFFFF' },
    objects: [{ rect: { x: 0, y: 7.31, w: '100%', h: 0.19, fill: { color: MAGENTA } } }],
    slideNumber: { x: 12.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: '9A9A9A', fontFace: FONT },
  });

  addTitleSlide(pptx, report, squads);
  for (const squad of squads) addSquadSlide(pptx, report, squad);

  await pptx.writeFile({
    fileName: `WSR_${safe(report.client || report.title)}_${safe(report.period)}.pptx`,
  });
}
