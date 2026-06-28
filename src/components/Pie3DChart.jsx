import { useEffect, useRef } from 'react';
import { drawPie3D } from '../charts/pie3d';

// Redraws on every render, so the chart tracks table edits in real time.
// The canvas backing store is ~3x the display size for a crisp HD result.
export default function Pie3DChart({ title, labels, values, colors, width = 430 }) {
  const ref = useRef(null);
  useEffect(() => {
    drawPie3D(ref.current, { title, labels, values, colors });
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
