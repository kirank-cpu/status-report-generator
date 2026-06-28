import { useEffect, useRef } from 'react';
import { drawGroupedBars } from '../charts/bar';

// Redraws on every render so the chart tracks table edits in real time. The
// canvas backing store is larger than the display size for a crisp HD result.
export default function BarChart({ title, categories, series, width = 560 }) {
  const ref = useRef(null);
  useEffect(() => {
    drawGroupedBars(ref.current, { title, categories, series });
  });
  return (
    <canvas
      ref={ref}
      width={1290}
      height={726}
      className="pie3d"
      style={{ width, aspectRatio: '1290 / 726' }}
    />
  );
}
