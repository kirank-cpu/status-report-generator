import { defectTotals, n } from '../constants';

const NUM_KEYS = ['open', 'closed', 'blocked'];

export default function DefectsTable({ rows, readOnly, onChange }) {
  const update = (severity, patch) =>
    onChange(rows.map((r) => (r.severity === severity ? { ...r, ...patch } : r)));
  const totals = defectTotals(rows);

  return (
    <table className="grid grid-narrow">
      <thead>
        <tr>
          <th>Status</th>
          <th>Open</th>
          <th>Closed</th>
          <th>Blocked</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.severity}>
            <td className="row-label">{r.severity}</td>
            {NUM_KEYS.map((k) => (
              <td key={k}>
                <input
                  className="cell-num"
                  type="number"
                  min="0"
                  value={r[k]}
                  disabled={readOnly}
                  onChange={(e) => update(r.severity, { [k]: e.target.value })}
                />
              </td>
            ))}
            <td className="computed">{n(r.open) + n(r.closed) + n(r.blocked)}</td>
          </tr>
        ))}
        <tr className="total-row">
          <td>Total</td>
          <td>{totals.open}</td>
          <td>{totals.closed}</td>
          <td>{totals.blocked}</td>
          <td>{totals.total}</td>
        </tr>
      </tbody>
    </table>
  );
}
