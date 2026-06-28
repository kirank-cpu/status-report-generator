import { squadRow, sumRows } from '../constants';

const pct = (pass, executed) => (executed ? Math.round((pass / executed) * 100) + '%' : '-');

export function SummaryTable({ rows, totals, totalLabel = 'Total', groupHeaders = [] }) {
  // Only surface the Preprod column group when at least one squad in this table
  // actually captures Preprod data — keeps the table narrow otherwise.
  const showPreprod = rows.some((r) => r.hasPreprod);
  const totalCols = showPreprod ? 14 : 10;

  return (
    <table className="grid">
      <thead>
        <tr>
          <th className="col-wide" rowSpan={2}>Squad</th>
          <th rowSpan={2}>User Stories</th>
          <th rowSpan={2}>Designed</th>
          <th rowSpan={2}>Executed</th>
          <th colSpan={4} className="col-group">Test</th>
          {showPreprod && <th colSpan={4} className="col-group">Preprod</th>}
          <th rowSpan={2}>Open Defects</th>
          <th rowSpan={2}>Total Defects</th>
        </tr>
        <tr>
          <th>Pass</th>
          <th>Fail</th>
          <th>Blocked/Hold</th>
          <th>Pass %</th>
          {showPreprod && (
            <>
              <th>Pass</th>
              <th>Fail</th>
              <th>Blocked/Hold</th>
              <th>Pass %</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <GroupedRow
            key={r.id}
            row={r}
            showPreprod={showPreprod}
            header={groupHeaders.find((g) => g.beforeIndex === i)}
            colSpan={totalCols}
          />
        ))}
        <tr className="total-row">
          <td>{totalLabel}</td>
          <td>{totals.userStories}</td>
          <td>{totals.designed}</td>
          <td>{totals.executed}</td>
          <td>{totals.testPass}</td>
          <td>{totals.testFail}</td>
          <td>{totals.testBlocked}</td>
          <td>{pct(totals.testPass, totals.executed)}</td>
          {showPreprod && (
            <>
              <td>{totals.preprodPass}</td>
              <td>{totals.preprodFail}</td>
              <td>{totals.preprodBlocked}</td>
              <td>{pct(totals.preprodPass, totals.executed)}</td>
            </>
          )}
          <td>{totals.open}</td>
          <td>{totals.total}</td>
        </tr>
      </tbody>
    </table>
  );
}

function GroupedRow({ row, header, showPreprod, colSpan }) {
  const e = row.exec;
  return (
    <>
      {header && (
        <tr className="group-row">
          <td colSpan={colSpan}>{header.label}</td>
        </tr>
      )}
      <tr>
        <td className="row-label">{row.name}</td>
        <td className="computed">{e.userStories}</td>
        <td className="computed">{e.designed}</td>
        <td className="computed">{e.executed}</td>
        <td className="computed">{e.testPass}</td>
        <td className="computed">{e.testFail}</td>
        <td className="computed">{e.testBlocked}</td>
        <td className="computed">{pct(e.testPass, e.executed)}</td>
        {showPreprod && (
          <>
            <td className="computed">{e.preprodPass}</td>
            <td className="computed">{e.preprodFail}</td>
            <td className="computed">{e.preprodBlocked}</td>
            <td className="computed">{pct(e.preprodPass, e.executed)}</td>
          </>
        )}
        <td className="computed">{row.def.open}</td>
        <td className="computed">{row.def.total}</td>
      </tr>
    </>
  );
}

export default function SummaryView({ teams }) {
  return (
    <div className="view">
      <h2>Overall Summary</h2>
      <p className="hint">
        One table per team — each team is exported as a separate PPTX file and all totals are
        calculated independently per team.
      </p>
      {teams.map((t) => {
        const rows = [];
        const groupHeaders = [];
        for (const p of t.projects) {
          groupHeaders.push({ beforeIndex: rows.length, label: p.name || 'Untitled Project' });
          rows.push(...p.squads.map(squadRow));
        }
        return (
          <div className="panel" key={t.id}>
            <h3>{t.name || 'Untitled Team'}</h3>
            <SummaryTable
              rows={rows}
              totals={sumRows(rows)}
              totalLabel="Team Total"
              groupHeaders={groupHeaders}
            />
          </div>
        );
      })}
    </div>
  );
}
