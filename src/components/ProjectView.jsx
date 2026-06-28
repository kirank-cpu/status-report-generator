import { squadRow, sumRows } from '../constants';
import { EXEC_COLORS, DEFECT_COLORS } from '../charts/pie3d';
import { SummaryTable } from './SummaryView';
import Pie3DChart from './Pie3DChart';

export default function ProjectView({ project, readOnly, onBack, backLabel, onChange, onDelete, onAddSquad, onSelectSquad }) {
  const rows = project.squads.map(squadRow);
  const totals = sumRows(rows);
  const anyPreprod = rows.some((r) => r.hasPreprod);

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
          value={project.name}
          placeholder="Project name"
          disabled={readOnly}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {!readOnly && (
          <button className="btn-danger" onClick={onDelete}>
            Remove Project
          </button>
        )}
      </div>

      <section className="panel">
        <h3>Project Summary</h3>
        <p className="hint">
          Totals across this project's squads — exported as the project summary slide, followed by
          one set of detail slides per squad.
        </p>
        <SummaryTable rows={rows} totals={totals} totalLabel="Project Total" />
        <div className="charts-row">
          <Pie3DChart
            title="TEST EXECUTION STATUS"
            labels={['Pass', 'Fail', 'Blocked/Hold']}
            values={[totals.testPass, totals.testFail, totals.testBlocked]}
            colors={EXEC_COLORS}
          />
          {anyPreprod && (
            <Pie3DChart
              title="PREPROD EXECUTION STATUS"
              labels={['Pass', 'Fail', 'Blocked/Hold']}
              values={[totals.preprodPass, totals.preprodFail, totals.preprodBlocked]}
              colors={EXEC_COLORS}
            />
          )}
          <Pie3DChart
            title="DEFECTS"
            labels={['Open', 'Closed', 'Blocked']}
            values={[totals.open, totals.closed, totals.dblocked]}
            colors={DEFECT_COLORS}
          />
        </div>
      </section>

      <section className="panel">
        <h3>Squads</h3>
        {project.squads.length === 0 && (
          <p className="hint">No squads yet — add one to capture its execution and defect details.</p>
        )}
        <div className="squad-links">
          {project.squads.map((q) => (
            <button key={q.id} className="btn-secondary" onClick={() => onSelectSquad(q.id)}>
              {q.name || 'Untitled Squad'}
            </button>
          ))}
          {!readOnly && (
            <button className="btn-secondary squad-link-add" onClick={onAddSquad}>
              + Add Squad
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
