import { executionTotals, makeFeature, n } from '../constants';

// Plain numeric columns shared by both environments, then the per-environment
// Pass / Fail / Blocked groups (Test, and optionally Preprod).
const BASE_KEYS = ['userStories', 'designed', 'executed'];
const TEST_KEYS = ['testPass', 'testFail', 'testBlocked'];
const PREPROD_KEYS = ['preprodPass', 'preprodFail', 'preprodBlocked'];

export default function ExecutionTable({ features, readOnly, showPreprod = true, onChange }) {
  const update = (id, patch) =>
    onChange(features.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const totals = executionTotals(features);
  const numKeys = [...BASE_KEYS, ...TEST_KEYS, ...(showPreprod ? PREPROD_KEYS : [])];

  return (
    <div>
      <table className="grid">
        <thead>
          <tr>
            <th className="col-wide" rowSpan={2}>Features</th>
            <th rowSpan={2}>User Stories</th>
            <th rowSpan={2}>Designed</th>
            <th rowSpan={2}>Executed</th>
            <th colSpan={3} className="col-group">Test</th>
            {showPreprod && <th colSpan={3} className="col-group">Preprod</th>}
            <th className="col-actions" rowSpan={2} />
          </tr>
          <tr>
            <th>Pass</th>
            <th>Fail</th>
            <th>Blocked/Hold</th>
            {showPreprod && (
              <>
                <th>Pass</th>
                <th>Fail</th>
                <th>Blocked/Hold</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {features.map((f) => {
            // Manual execution is driven in Test, so flag rows where the Test
            // Pass/Fail/Blocked split doesn't reconcile with Executed.
            const mismatch =
              n(f.executed) !== n(f.testPass) + n(f.testFail) + n(f.testBlocked);
            return (
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
                {numKeys.map((k) => (
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
                <td className="col-actions">
                  {mismatch && (
                    <span className="warn" title="Executed ≠ Test Pass + Fail + Blocked">
                      ⚠
                    </span>
                  )}
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
            );
          })}
          <tr className="total-row">
            <td>Total</td>
            {numKeys.map((k) => (
              <td key={k}>{totals[k]}</td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
      {!readOnly && (
        <button className="btn-secondary" onClick={() => onChange([...features, makeFeature()])}>
          + Add Feature
        </button>
      )}
    </div>
  );
}
