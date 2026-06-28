// Canvas renderer for a grouped bar chart, shared by the live UI (BarChart
// component) and the PPTX export (rasterized at high resolution). It mirrors the
// drawPie3D approach so both surfaces render identically. Used for the execution
// status chart, which compares Test vs Preprod across Pass / Fail / Blocked-Hold.

const FONT = '"Segoe UI", system-ui, sans-serif';

const shade = (hex, f) => {
  const c = hex.replace('#', '');
  const ch = (i) => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * f)));
  return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
};

// Smallest "nice" axis ceiling (1/2/2.5/5 × 10ⁿ) at or above the data max.
const niceCeil = (v) => {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= v) return m * pow;
  }
  return 10 * pow;
};

// series: [{ name, color, values: number[] }], one value per category.
export function drawGroupedBars(canvas, { title, categories, series, background = '#FFFFFF' }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#1A1A1A';
  ctx.font = `700 ${Math.round(H * 0.075)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, W * 0.5, H * 0.03);

  // Legend (centered, below the title)
  const sw = H * 0.045;
  const gap = W * 0.03;
  ctx.font = `600 ${Math.round(H * 0.05)}px ${FONT}`;
  const items = series.map((s) => ({ s, w: sw * 1.4 + ctx.measureText(s.name).width }));
  const totalW = items.reduce((a, b) => a + b.w, 0) + gap * (items.length - 1);
  let lx = W * 0.5 - totalW / 2;
  const ly = H * 0.15;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const it of items) {
    ctx.fillStyle = it.s.color;
    ctx.fillRect(lx, ly - sw / 2, sw, sw);
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(it.s.name, lx + sw * 1.4, ly);
    lx += it.w + gap;
  }

  // Plot area
  const padL = W * 0.085;
  const padR = W * 0.04;
  const padT = H * 0.24;
  const padB = H * 0.11;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x0 = padL;
  const y0 = H - padB;

  const dataMax = Math.max(
    1,
    ...series.flatMap((s) => s.values.map((v) => Number(v)).filter((v) => Number.isFinite(v))),
  );
  const maxVal = niceCeil(dataMax);

  // Gridlines + y-axis labels
  const steps = 4;
  ctx.font = `500 ${Math.round(H * 0.042)}px ${FONT}`;
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= steps; i++) {
    const y = y0 - (plotH * i) / steps;
    ctx.strokeStyle = i === 0 ? '#9A9A9A' : '#E4E4E4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + plotW, y);
    ctx.stroke();
    ctx.fillStyle = '#5A5A5A';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round((maxVal / steps) * i)), x0 - W * 0.012, y);
  }

  // Grouped bars
  const n = categories.length;
  const m = series.length;
  const groupW = plotW / n;
  const innerPad = groupW * 0.16;
  const barAreaW = groupW - innerPad * 2;
  const barGap = barAreaW * 0.08;
  const barW = (barAreaW - barGap * (m - 1)) / m;

  for (let c = 0; c < n; c++) {
    const gx = x0 + groupW * c + innerPad;
    for (let s = 0; s < m; s++) {
      const val = Number(series[s].values[c]) || 0;
      const bx = gx + s * (barW + barGap);
      const bh = (val / maxVal) * plotH;
      const by = y0 - bh;
      if (bh > 0) {
        const grad = ctx.createLinearGradient(bx, by, bx, y0);
        grad.addColorStop(0, shade(series[s].color, 1.12));
        grad.addColorStop(1, shade(series[s].color, 0.85));
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, barW, bh);
      }
      // Value label above the bar
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = `700 ${Math.round(H * 0.044)}px ${FONT}`;
      ctx.fillText(String(val), bx + barW / 2, by - H * 0.006);
    }
    // Category label
    ctx.fillStyle = '#1A1A1A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${Math.round(H * 0.046)}px ${FONT}`;
    ctx.fillText(categories[c], x0 + groupW * c + groupW / 2, y0 + H * 0.018);
  }

  ctx.restore();
}

// Series colors for the execution bar chart (Test / Preprod).
export const EXEC_BAR_COLORS = ['#4472C4', '#ED7D31'];
