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

export default function SquadEditor({ squad, readOnly, canDelete, onBack, backLabel, onChange, onSave, onDelete }) {
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

      <section className="panel">
        <h3>Execution Status</h3>
        <p className="hint">Manual execution status per feature. Totals and the pie charts are computed automatically.</p>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={!!squad.hasPreprod}
            disabled={readOnly}
            onChange={(e) => onChange({ hasPreprod: e.target.checked })}
          />
          <span>This squad has Preprod execution data</span>
        </label>
        <ExecutionTable
          features={squad.features}
          readOnly={readOnly}
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
      </section>

      <section className="panel">
        <h3>Automation Metrics</h3>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={!!squad.hasAutomation}
            disabled={readOnly}
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
              readOnly={readOnly}
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
              readOnly={readOnly}
              onChange={(highlights) => onChange({ automation: { ...automation, highlights } })}
              placeholder="e.g. 24 manual hours saved by running the full Regression pack."
            />
          </>
        )}
      </section>

      <section className="panel">
        <h3>Defects</h3>
        <DefectsTable rows={squad.defects} readOnly={readOnly} onChange={(defects) => onChange({ defects })} />
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
              disabled={readOnly}
              onChange={(e) => onChange({ jiraDefects: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Total observations raised in JIRA comments</span>
            <input
              type="number"
              min="0"
              value={squad.jiraObservations ?? 0}
              disabled={readOnly}
              onChange={(e) => onChange({ jiraObservations: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h3>Key Deliverables from Current Month</h3>
        <BulletList
          items={squad.deliverables}
          readOnly={readOnly}
          onChange={(deliverables) => onChange({ deliverables })}
          placeholder="e.g. Regression done on redemption statement flow."
        />
      </section>

      <section className="panel">
        <h3>Plan for Next Month</h3>
        <BulletList
          items={squad.nextPlan}
          readOnly={readOnly}
          onChange={(nextPlan) => onChange({ nextPlan })}
          placeholder="e.g. E2E and Regression for change re-payment date."
        />
      </section>

      <section className="panel">
        <h3>Pending Dependency / Challenges</h3>
        <p className="hint">Leave empty to show “NA” on the slide.</p>
        <BulletList
          items={squad.challenges}
          readOnly={readOnly}
          onChange={(challenges) => onChange({ challenges })}
          placeholder="e.g. Awaiting TEST environment refresh."
          addLabel="+ Add Item"
        />
      </section>

      <section className="panel">
        <h3>Custom Slides</h3>
        <CustomSlides
          slides={squad.customSlides}
          readOnly={readOnly}
          onChange={(customSlides) => onChange({ customSlides })}
        />
      </section>

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
