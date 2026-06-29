import { makeWsrRegRow, wsrRegTotals, n } from '../constants';
import BulletList from './BulletList';
import LockPanel from './LockPanel';

// Test-Cases + Defects columns shared by the Test and Pre-Prod rows.
const COUNT_COLS = [
  ['designed', 'Designed'],
  ['passed', 'Passed'],
  ['fail', 'Fail'],
  ['blocked', 'Blocked'],
  ['toDo', 'To-Do'],
  ['critical', 'Critical'],
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low'],
];

// Regression-table numeric columns (in render order).
const REG_COLS = [
  ['total', 'Total'],
  ['designed', 'Designed'],
  ['reworkTotal', 'Rework'],
  ['reworkInProgress', 'Rework In Prog'],
  ['reworkCompleted', 'Rework Completed'],
  ['executed', 'Executed'],
  ['pass', 'Pass'],
  ['fail', 'Fail'],
  ['toDo', 'To Do'],
  ['blockedHold', 'Blocked/Hold'],
];

// The per-squad editor for a Weekly Status Report. Sections lock independently,
// just like the MSR editor.
export default function WsrSquadEditor({
  squad,
  readOnly,
  canDelete,
  onBack,
  backLabel,
  locks = {},
  me,
  onAcquire,
  onRelease,
  onChange,
  onSave,
  onDelete,
}) {
  const key = (section) => `${squad.id}:${section}`;
  const lockProps = (section) => ({ sectionKey: key(section), baseReadOnly: readOnly, locks, me, onAcquire, onRelease });

  const reg = squad.regression?.length ? squad.regression : [makeWsrRegRow()];
  const totals = wsrRegTotals(reg);

  // Update one count cell on the Test / Pre-Prod row.
  const setCount = (row, field, value) => onChange({ [row]: { ...squad[row], [field]: value } });
  // Update one regression row's field by id.
  const setReg = (id, field, value) =>
    onChange({ regression: reg.map((r) => (r.id === id ? { ...r, [field]: value } : r)) });
  const addReg = () => onChange({ regression: [...reg, makeWsrRegRow()] });
  const removeReg = (id) => onChange({ regression: reg.filter((r) => r.id !== id) });

  const numCell = (row, field, ro) => (
    <td key={field}>
      <input
        type="number"
        min="0"
        className="cell-input"
        value={squad[row][field] ?? 0}
        disabled={ro}
        onChange={(e) => setCount(row, field, e.target.value)}
      />
    </td>
  );

  return (
    <div className="view">
      <div className="squad-header">
        {onBack && (
          <button className="btn-secondary btn-sm btn-back" onClick={onBack}>
            ← {backLabel}
          </button>
        )}
        <input
          className="squad-name-input"
          value={squad.name}
          placeholder="Squad name"
          disabled={readOnly}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {canDelete && (
          <button className="btn-danger" onClick={onDelete}>
            Remove Squad
          </button>
        )}
      </div>

      {readOnly ? (
        <div className="banner banner-view">View only — you can edit and save only your own squad.</div>
      ) : (
        <div className={`save-bar ${squad.saved ? 'is-saved' : 'is-dirty'}`}>
          <span className="save-status">
            {squad.saved ? '✓ All changes saved' : '● You have unsaved changes'}
          </span>
          <button className="btn-primary" onClick={onSave} disabled={squad.saved}>
            Save Squad Data
          </button>
        </div>
      )}

      <LockPanel {...lockProps('reportcard')} title="Report Card">
        {(ro) => (
          <>
            <div className="form-grid">
              <label className="form-field">
                <span>Owner / tester name</span>
                <input value={squad.owner || ''} disabled={ro} placeholder="e.g. Ben Miles" onChange={(e) => onChange({ owner: e.target.value })} />
              </label>
              <label className="form-field">
                <span>Status report period</span>
                <input value={squad.period || ''} disabled={ro} placeholder="e.g. 16th-24th June 2026" onChange={(e) => onChange({ period: e.target.value })} />
              </label>
              <label className="form-field">
                <span>Report card title</span>
                <input value={squad.reportCardTitle || ''} disabled={ro} placeholder="e.g. Report Card – ABL – Sprint 4" onChange={(e) => onChange({ reportCardTitle: e.target.value })} />
              </label>
              <label className="form-field">
                <span>User stories</span>
                <input type="number" min="0" value={squad.userStories ?? 0} disabled={ro} onChange={(e) => onChange({ userStories: e.target.value })} />
              </label>
            </div>

            <label className="toggle-field" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={!!squad.hasPreprod} disabled={ro} onChange={(e) => onChange({ hasPreprod: e.target.checked })} />
              <span>Include a Pre-Prod row</span>
            </label>

            <div className="table-scroll">
              <table className="grid">
                <thead>
                  <tr>
                    <th />
                    {COUNT_COLS.map(([k, label]) => (
                      <th key={k}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="row-label">Test</td>
                    {COUNT_COLS.map(([k]) => numCell('test', k, ro))}
                  </tr>
                  {squad.hasPreprod && (
                    <tr>
                      <td className="row-label">Pre Prod</td>
                      {COUNT_COLS.map(([k]) => numCell('preprod', k, ro))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </LockPanel>

      <LockPanel {...lockProps('regression')} title="Regression / Automation">
        {(ro) => (
          <div className="table-scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th className="col-wide">Regression</th>
                  {REG_COLS.map(([k, label]) => (
                    <th key={k}>{label}</th>
                  ))}
                  <th>% Completion</th>
                  {!ro && <th className="col-actions" />}
                </tr>
              </thead>
              <tbody>
                {reg.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input className="cell-input cell-name" value={r.name || ''} disabled={ro} placeholder="Feature / module" onChange={(e) => setReg(r.id, 'name', e.target.value)} />
                    </td>
                    {REG_COLS.map(([k]) => (
                      <td key={k}>
                        <input type="number" min="0" className="cell-input" value={r[k] ?? 0} disabled={ro} onChange={(e) => setReg(r.id, k, e.target.value)} />
                      </td>
                    ))}
                    <td>
                      <input className="cell-input" value={r.completion || ''} disabled={ro} placeholder="e.g. 80%" onChange={(e) => setReg(r.id, 'completion', e.target.value)} />
                    </td>
                    {!ro && (
                      <td className="col-actions">
                        <button className="icon-btn" title="Remove row" onClick={() => removeReg(r.id)} disabled={reg.length === 1}>
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="row-total">
                  <td className="row-label">Total</td>
                  {REG_COLS.map(([k]) => (
                    <td key={k}>{n(totals[k])}</td>
                  ))}
                  <td>{totals.completion}</td>
                  {!ro && <td />}
                </tr>
              </tbody>
            </table>
            {!ro && (
              <button className="nav-add nav-add-sm" onClick={addReg} style={{ marginTop: 8 }}>
                + Add Row
              </button>
            )}
          </div>
        )}
      </LockPanel>

      <LockPanel {...lockProps('highlights')} title="Highlights & Accomplishments, Value Adds and Accolades">
        {(ro) => (
          <BulletList
            items={squad.highlights}
            readOnly={ro}
            onChange={(highlights) => onChange({ highlights })}
            placeholder="e.g. Reviewed and analysed the ISO 20022 LEI design documentation."
          />
        )}
      </LockPanel>

      <LockPanel {...lockProps('plan')} title="Pending Action Item / Dependencies and Plan for Next week">
        {(ro) => (
          <BulletList
            items={squad.plan}
            readOnly={ro}
            onChange={(plan) => onChange({ plan })}
            placeholder="e.g. Create detailed API test cases for LEI Create/Replace (POST)."
          />
        )}
      </LockPanel>

      <LockPanel {...lockProps('risks')} title="Risks, Issues & Challenges">
        {(ro) => (
          <BulletList
            items={squad.risks}
            readOnly={ro}
            onChange={(risks) => onChange({ risks })}
            placeholder="Leave empty to show “NA” on the slide."
            addLabel="+ Add Item"
          />
        )}
      </LockPanel>

      {!readOnly && (
        <div className={`save-bar save-bar-bottom ${squad.saved ? 'is-saved' : 'is-dirty'}`}>
          <span className="save-status">
            {squad.saved ? '✓ All changes saved' : '● You have unsaved changes'}
          </span>
          <button className="btn-primary" onClick={onSave} disabled={squad.saved}>
            Save Squad Data
          </button>
        </div>
      )}
    </div>
  );
}
