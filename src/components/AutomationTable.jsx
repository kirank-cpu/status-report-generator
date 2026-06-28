import { automationTotals, completionPct, makeAutoFeature } from '../constants';

// Editable numeric columns, in display order. Completion % is computed, so it is
// not in this list — it renders as a read-only cell between Fail and Blocked.
const NUM_KEYS = [
  'total', 'designed', 'executed',
  'rework', 'reworkInProgress', 'reworkCompleted',
  'pass', 'fail',
];

export default function AutomationTable({ features, readOnly, onChange }) {
  const update = (id, patch) =>
    onChange(features.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const totals = automationTotals(features);

  return (
    <div>
      <div className="table-scroll">
      <table className="grid">
        <thead>
          <tr>
            <th className="col-wide">Features</th>
            <th>Total</th>
            <th>Designed</th>
            <th>Executed</th>
            <th>Rework</th>
            <th>Rework In Progress</th>
            <th>Rework Completed</th>
            <th>Pass</th>
            <th>Fail</th>
            <th>Completion %</th>
            <th>Blocked/Hold</th>
            <th className="col-actions" />
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.id}>
              <td>
                <input
                  className="cell-text"
                  value={f.name}
                  placeholder="Feature name"
                  disabled={readOnly}
                  onChange={(e) => update(f.id, { name: e.target.value })}
                />
              </td>
              {NUM_KEYS.map((k) => (
                <td key={k}>
                  <input
                    className="cell-num"
                    type="number"
                    min="0"
                    value={f[k]}
                    disabled={readOnly}
                    onChange={(e) => update(f.id, { [k]: e.target.value })}
                  />
                </td>
              ))}
              <td className="computed">{completionPct(f.pass, f.executed)}</td>
              <td>
                <input
                  className="cell-num"
                  type="number"
                  min="0"
                  value={f.blocked}
                  disabled={readOnly}
                  onChange={(e) => update(f.id, { blocked: e.target.value })}
                />
              </td>
              <td className="col-actions">
                {!readOnly && (
                  <button
                    className="icon-btn"
                    title="Remove feature"
                    onClick={() => onChange(features.filter((x) => x.id !== f.id))}
                  >
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
          <tr className="total-row">
            <td>Total</td>
            {NUM_KEYS.map((k) => (
              <td key={k}>{totals[k]}</td>
            ))}
            <td>{completionPct(totals.pass, totals.executed)}</td>
            <td>{totals.blocked}</td>
            <td />
          </tr>
        </tbody>
      </table>
      </div>
      {!readOnly && (
        <button className="btn-secondary" onClick={() => onChange([...features, makeAutoFeature()])}>
          + Add Feature
        </button>
      )}
    </div>
  );
}
