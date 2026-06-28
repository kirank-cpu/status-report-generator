import { useEffect, useRef } from 'react';
import { automationTotals, completionPct, executionTotals, defectTotals, makeAutomation } from '../constants';
import { AUTO_COLORS, AUTO_LABELS, DEFECT_COLORS } from '../charts/pie3d';
import { EXEC_BAR_COLORS } from '../charts/bar';
import ExecutionTable from './ExecutionTable';
import AutomationTable from './AutomationTable';
import DefectsTable from './DefectsTable';
import BulletList from './BulletList';
import CustomSlides from './CustomSlides';
import Pie3DChart from './Pie3DChart';
import BarChart from './BarChart';

// One lockable panel. Focusing it (when editable and not held by someone else)
// acquires the section lock; moving focus out of the panel releases it. While a
// collaborator holds it, the panel is shown read-only with their name.
function LockPanel({ sectionKey, title, baseReadOnly, locks, me, onAcquire, onRelease, children }) {
  const owner = locks?.[sectionKey];
  const lockedByOther = !!owner && owner.username !== me;
  const heldByMe = !!owner && owner.username === me;
  const ro = baseReadOnly || lockedByOther;

  // Release the lock if the panel unmounts while we hold it (e.g. navigating to
  // another squad/page), since unmount fires no blur. Refs (kept current via an
  // effect) let the unmount cleanup see the latest state without re-running.
  const heldRef = useRef(false);
  const releaseRef = useRef(null);
  useEffect(() => {
    heldRef.current = heldByMe;
    releaseRef.current = () => onRelease?.(sectionKey);
  });
  useEffect(() => () => heldRef.current && releaseRef.current?.(), []);

  const handleFocus = () => {
    if (!baseReadOnly && !lockedByOther && !heldByMe) onAcquire?.(sectionKey);
  };
  const handleBlur = (e) => {
    // Ignore focus moves that stay inside this panel.
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (heldByMe) onRelease?.(sectionKey);
  };

  return (
    <section
      className={`panel lock-panel${lockedByOther ? ' is-locked' : ''}${heldByMe ? ' is-mine' : ''}`}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
      <div className="panel-head">
        <h3>{title}</h3>
        {lockedByOther && <span className="lock-badge">🔒 {owner.name} is editing</span>}
        {heldByMe && <span className="lock-badge mine">✏ You’re editing</span>}
      </div>
      {children(ro)}
    </section>
  );
}

export default function SquadEditor({
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
  // Per-section lock key helper + shared props for every LockPanel below.
  const key = (section) => `${squad.id}:${section}`;
  const lockProps = (section) => ({
    sectionKey: key(section),
    baseReadOnly: readOnly,
    locks,
    me,
    onAcquire,
    onRelease,
  });
  const t = executionTotals(squad.features);
  const d = defectTotals(squad.defects);
  const automation = squad.automation || makeAutomation();
  const at = automationTotals(automation.features);
  // Outcome breakdown only — mutually-exclusive buckets that form a valid pie.
  // Completion % is a ratio, so it is surfaced as a separate KPI, not a slice.
  const autoPieValues = [at.pass, at.fail, at.blocked];
  const autoCompletion = completionPct(at.pass, at.executed);
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
        <div className="banner banner-view">
          View only — you can edit and save only your own squad. This squad's data is
          {squad.saved ? ' saved.' : ' not saved yet.'}
        </div>
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

      <LockPanel {...lockProps('execution')} title="Execution Status">
        {(ro) => (
          <>
            <p className="hint">Manual execution status per feature. Totals and the pie charts are computed automatically.</p>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={!!squad.hasPreprod}
                disabled={ro}
                onChange={(e) => onChange({ hasPreprod: e.target.checked })}
              />
              <span>This squad has Preprod execution data</span>
            </label>
            <ExecutionTable
              features={squad.features}
              readOnly={ro}
              showPreprod={!!squad.hasPreprod}
              onChange={(features) => onChange({ features })}
            />
            <div className="charts-row">
              <BarChart
                title={squad.hasPreprod ? 'TEST vs PREPROD EXECUTION STATUS' : 'TEST EXECUTION STATUS'}
                categories={['Pass', 'Fail', 'Blocked/Hold']}
                series={[
                  { name: 'Test', color: EXEC_BAR_COLORS[0], values: [t.testPass, t.testFail, t.testBlocked] },
                  ...(squad.hasPreprod
                    ? [{ name: 'Preprod', color: EXEC_BAR_COLORS[1], values: [t.preprodPass, t.preprodFail, t.preprodBlocked] }]
                    : []),
                ]}
              />
            </div>
          </>
        )}
      </LockPanel>

      <LockPanel {...lockProps('automation')} title="Automation Metrics">
        {(ro) => (
          <>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={!!squad.hasAutomation}
                disabled={ro}
                onChange={(e) => onChange({ hasAutomation: e.target.checked })}
              />
              <span>This squad has Automation execution / scripting data</span>
            </label>
            {squad.hasAutomation && (
              <>
                <p className="hint">
                  Completion % is computed as Pass ÷ Executed. Add highlights to call out new flows,
                  refactors, or manual-hours saved.
                </p>
                <AutomationTable
                  features={automation.features}
                  readOnly={ro}
                  onChange={(features) => onChange({ automation: { ...automation, features } })}
                />
                <div className="charts-row">
                  <Pie3DChart
                    title="AUTOMATION EXECUTION STATUS"
                    labels={AUTO_LABELS}
                    values={autoPieValues}
                    colors={AUTO_COLORS}
                    width={560}
                  />
                  <div className="kpi-card">
                    <div className="kpi-value">{autoCompletion}%</div>
                    <div className="kpi-label">Completion</div>
                    <div className="kpi-sub">Pass {at.pass} ÷ Executed {at.executed}</div>
                  </div>
                </div>
                <h4 className="subhead">Highlights</h4>
                <BulletList
                  items={automation.highlights}
                  readOnly={ro}
                  onChange={(highlights) => onChange({ automation: { ...automation, highlights } })}
                  placeholder="e.g. 24 manual hours saved by running the full Regression pack."
                />
              </>
            )}
          </>
        )}
      </LockPanel>

      <LockPanel {...lockProps('defects')} title="Defects">
        {(ro) => (
          <>
            <DefectsTable rows={squad.defects} readOnly={ro} onChange={(defects) => onChange({ defects })} />
            <div className="charts-row">
              <Pie3DChart
                title="DEFECTS"
                labels={['Open', 'Closed', 'Blocked']}
                values={[d.open, d.closed, d.blocked]}
                colors={DEFECT_COLORS}
              />
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="form-field">
                <span>Total defects raised in JIRA</span>
                <input
                  type="number"
                  min="0"
                  value={squad.jiraDefects ?? 0}
                  disabled={ro}
                  onChange={(e) => onChange({ jiraDefects: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Total observations raised in JIRA comments</span>
                <input
                  type="number"
                  min="0"
                  value={squad.jiraObservations ?? 0}
                  disabled={ro}
                  onChange={(e) => onChange({ jiraObservations: e.target.value })}
                />
              </label>
            </div>
          </>
        )}
      </LockPanel>

      <LockPanel {...lockProps('deliverables')} title="Key Deliverables from Current Month">
        {(ro) => (
          <BulletList
            items={squad.deliverables}
            readOnly={ro}
            onChange={(deliverables) => onChange({ deliverables })}
            placeholder="e.g. Regression done on redemption statement flow."
          />
        )}
      </LockPanel>

      <LockPanel {...lockProps('nextPlan')} title="Plan for Next Month">
        {(ro) => (
          <BulletList
            items={squad.nextPlan}
            readOnly={ro}
            onChange={(nextPlan) => onChange({ nextPlan })}
            placeholder="e.g. E2E and Regression for change re-payment date."
          />
        )}
      </LockPanel>

      <LockPanel {...lockProps('challenges')} title="Pending Dependency / Challenges">
        {(ro) => (
          <>
            <p className="hint">Leave empty to show “NA” on the slide.</p>
            <BulletList
              items={squad.challenges}
              readOnly={ro}
              onChange={(challenges) => onChange({ challenges })}
              placeholder="e.g. Awaiting TEST environment refresh."
              addLabel="+ Add Item"
            />
          </>
        )}
      </LockPanel>

      <LockPanel {...lockProps('customSlides')} title="Custom Slides">
        {(ro) => (
          <CustomSlides
            slides={squad.customSlides}
            readOnly={ro}
            onChange={(customSlides) => onChange({ customSlides })}
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
