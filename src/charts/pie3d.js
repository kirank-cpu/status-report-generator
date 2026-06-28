// Canvas renderer for a PowerPoint-style 3D pie chart, shared by the live UI
// (Pie3DChart component) and the PPTX export (rasterized at high resolution).
// pptxgenjs has no native 3D pie, so the deck embeds this renderer's output.
//
// Styling follows the classic Office 3D pie: bold title, outside labels with
// the category name over its percentage (0% slices included), a plain legend
// with small square swatches, and softly shaded slices with a depth rim.

export const EXEC_COLORS = ['#4472C4', '#ED7D31', '#A5A5A5'];
export const DEFECT_COLORS = ['#4472C4', '#ED7D31', '#A5A5A5'];

// Automation execution pie: mutually-exclusive outcomes of the executed cases,
// mirroring the Test/Preprod pies. Earlier versions mixed overlapping lifecycle
// counts (Designed/Executed/Pass/Fail) and the Completion % ratio into one pie,
// which double-counted cases and let a percentage masquerade as a slice — that is
// not a valid part-of-a-whole. Completion % is now shown as a separate KPI.
export const AUTO_COLORS = ['#70AD47', '#ED7D31', '#A5A5A5'];

export const AUTO_LABELS = ['Pass', 'Fail', 'Blocked/Hold'];

const FONT = '"Segoe UI", system-ui, sans-serif';

const shade = (hex, f) => {
  const c = hex.replace('#', '');
  const ch = (i) => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * f)));
  return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
};

export function drawPie3D(canvas, { title, labels, values, colors, background = '#FFFFFF' }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const nums = values.map((v) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
  });
  const total = nums.reduce((a, b) => a + b, 0);

  // Busy pies (many categories, e.g. the 9-slice automation chart) can't fit
  // outside per-slice labels without overlapping — they shift the pie left, drop
  // the outside labels, and carry percentages in the legend instead.
  const manySlices = labels.length > 5;

  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1A1A1A';
  ctx.font = `700 ${Math.round(H * (manySlices ? 0.075 : 0.085))}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, W * 0.5, H * 0.03);

  const cx = W * (manySlices ? 0.30 : 0.40);
  const cy = H * 0.56;
  const rx = Math.min(W * (manySlices ? 0.23 : 0.29), H * 0.34);
  const ry = rx * 0.56;
  const depth = rx * 0.19;

  if (!total) {
    ctx.fillStyle = '#E8E8E8';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#888888';
    ctx.font = `600 ${Math.round(H * 0.06)}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('No data', cx, cy);
    ctx.restore();
    return;
  }

  let angle = -Math.PI / 2;
  const slices = nums.map((v, i) => {
    const frac = v / total;
    const s = {
      frac,
      a1: angle,
      a2: angle + frac * Math.PI * 2,
      color: colors[i % colors.length],
      label: labels[i],
      pct: Math.round(frac * 100),
    };
    angle = s.a2;
    return s;
  });
  const visible = slices.filter((s) => s.frac > 0);

  // Depth rim — only the front half (canvas angles 0..π) is visible.
  for (const s of visible) {
    const a1 = Math.max(s.a1, 0);
    const a2 = Math.min(s.a2, Math.PI);
    if (a2 <= a1) continue;
    const wall = ctx.createLinearGradient(0, cy, 0, cy + depth + ry);
    wall.addColorStop(0, shade(s.color, 0.88));
    wall.addColorStop(1, shade(s.color, 0.58));
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a1, a2);
    ctx.ellipse(cx, cy + depth, rx, ry, 0, a2, a1, true);
    ctx.closePath();
    ctx.fillStyle = wall;
    ctx.fill();
  }

  // Top faces with a soft satin gradient
  for (const s of visible) {
    const top = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    top.addColorStop(0, shade(s.color, 1.18));
    top.addColorStop(1, shade(s.color, 0.92));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, s.a1, s.a2);
    ctx.closePath();
    ctx.fillStyle = top;
    ctx.fill();
  }

  // Outside labels: category name over its percentage, 0% slices included.
  // Skipped for busy pies, where the legend carries the percentages instead.
  if (!manySlices) {
    const labelFont = `700 ${Math.round(H * 0.052)}px ${FONT}`;
    ctx.font = labelFont;
    const lineH = H * 0.062;
    const pad = W * 0.015;
    const labelFor = (s) => {
      const mid = (s.a1 + s.a2) / 2;
      const below = Math.sin(mid) > 0;
      return {
        slice: s,
        below,
        x: cx + Math.cos(mid) * rx * 1.08,
        y: cy + Math.sin(mid) * ry * 1.15 + (below ? depth + lineH * 0.3 : -lineH * 1.6),
        w: Math.max(ctx.measureText(s.label).width, ctx.measureText(s.pct + '%').width),
      };
    };
    const placed = slices.map(labelFor);
    // Nudge overlapping neighbours apart within the top and bottom bands.
    for (const band of [placed.filter((l) => !l.below), placed.filter((l) => l.below)]) {
      band.sort((a, b) => a.x - b.x);
      for (let i = 1; i < band.length; i++) {
        const minX = band[i - 1].x + band[i - 1].w / 2 + pad + band[i].w / 2;
        if (band[i].x < minX) band[i].x = minX;
      }
    }
    ctx.fillStyle = '#1A1A1A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const l of placed) {
      ctx.fillText(l.slice.label, l.x, l.y);
      ctx.fillText(l.slice.pct + '%', l.x, l.y + lineH);
    }
  }

  // Legend — small square swatches. Spacing adapts to the slice count so all
  // entries fit; busy pies append each slice's percentage and sit further left.
  const legendLineH = Math.min(H * 0.115, (H * 0.86) / slices.length);
  const swatch = Math.min(H * 0.042, legendLineH * 0.5);
  const legendFont = Math.min(H * 0.052, legendLineH * 0.6);
  const lx0 = W * (manySlices ? 0.56 : 0.76);
  let ly0 = cy - ((slices.length - 1) * legendLineH) / 2;
  ctx.font = `500 ${Math.round(legendFont)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const s of slices) {
    ctx.fillStyle = s.color;
    ctx.fillRect(lx0, ly0 - swatch / 2, swatch, swatch);
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(manySlices ? `${s.label} — ${s.pct}%` : s.label, lx0 + swatch * 1.6, ly0);
    ly0 += legendLineH;
  }

  ctx.restore();
}
