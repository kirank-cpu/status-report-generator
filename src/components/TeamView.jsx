import { squadRow, sumRows } from '../constants';
import { EXEC_COLORS, DEFECT_COLORS } from '../charts/pie3d';
import { SummaryTable } from './SummaryView';
import Pie3DChart from './Pie3DChart';

export default function TeamView({ team, readOnly, onBack, backLabel, onChange, onDelete, onAddProject, onSelect }) {
  const rows = [];
  const groupHeaders = [];
  for (const p of team.projects) {
    groupHeaders.push({ beforeIndex: rows.length, label: p.name || 'Untitled Project' });
    rows.push(...p.squads.map(squadRow));
  }
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
          value={team.name}
          placeholder="Team name"
          disabled={readOnly}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {!readOnly && (
          <button className="btn-danger" onClick={onDelete}>
            Remove Team
          </button>
        )}
      </div>

      <section className="panel">
        <h3>Team Summary</h3>
        <p className="hint">
          Totals across this team's projects and squads — this team is exported as its own PPTX
          file, with all calculations done separately from other teams.
        </p>
        <SummaryTable rows={rows} totals={totals} totalLabel="Team Total" groupHeaders={groupHeaders} />
        <div className="charts-row">
          <Pie3DChart
            title="TEAM TEST EXECUTION STATUS"
            labels={['Pass', 'Fail', 'Blocked/Hold']}
            values={[totals.testPass, totals.testFail, totals.testBlocked]}
            colors={EXEC_COLORS}
          />
          {anyPreprod && (
            <Pie3DChart
              title="TEAM PREPROD EXECUTION STATUS"
              labels={['Pass', 'Fail', 'Blocked/Hold']}
              values={[totals.preprodPass, totals.preprodFail, totals.preprodBlocked]}
              colors={EXEC_COLORS}
            />
          )}
          <Pie3DChart
            title="TEAM DEFECTS"
            labels={['Open', 'Closed', 'Blocked']}
            values={[totals.open, totals.closed, totals.dblocked]}
            colors={DEFECT_COLORS}
          />
        </div>
      </section>

      <section className="panel">
        <h3>Projects</h3>
        {team.projects.length === 0 && (
          <p className="hint">No projects yet — add one to start capturing squad details.</p>
        )}
        <div className="squad-links">
          {team.projects.map((p) => (
            <button key={p.id} className="btn-secondary" onClick={() => onSelect(p.id)}>
              {p.name || 'Untitled Project'}
            </button>
          ))}
          {!readOnly && (
            <button className="btn-secondary" onClick={onAddProject}>
              + Add Project
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
