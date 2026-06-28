// Home page: the dark-themed Status Reports archive. Lists every report as a
// card, split into the current month and previous months, with creation/
// modification timestamps. Managers can create, duplicate, delete and download;
// everyone can open a report (editing rights are enforced downstream).

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const currentMonthLabel = () =>
  new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

const norm = (s) => String(s || '').trim().toLowerCase();

function ReportRow({
  report,
  isManager,
  isActive,
  isCurrent,
  busy,
  onOpen,
  onDownloadPptx,
  onDownloadJson,
  onDuplicate,
  onDelete,
}) {
  return (
    <div className={`report-row ${isActive ? 'is-active' : ''}`}>
      <div className="report-row-main">
        <div className="report-row-head">
          <span className="report-month">{report.month || '—'}</span>
          {isCurrent && <span className="report-badge">Current</span>}
          <span className="report-row-name">{report.title || 'Untitled report'}</span>
        </div>
        <div className="report-row-meta">
          <span>Created {fmtDate(report.createdAt)}</span>
          <span className="report-meta-dot">•</span>
          <span>Modified {fmtDate(report.modifiedAt)}</span>
        </div>
      </div>
      <div className="report-row-actions">
        <button className="btn-ghost primary" onClick={() => onOpen(report.id)} disabled={busy}>
          {isManager ? 'Open / Edit' : 'Open'}
        </button>
        <button className="btn-ghost" onClick={() => onDownloadPptx(report.id)} disabled={busy}>
          PPTX
        </button>
        <button className="btn-ghost" onClick={() => onDownloadJson(report.id)} disabled={busy}>
          JSON
        </button>
        {isManager && (
          <>
            <button className="btn-ghost" onClick={() => onDuplicate(report.id)} disabled={busy}>
              Duplicate
            </button>
            <button className="btn-ghost danger" onClick={() => onDelete(report.id)} disabled={busy}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, reports, isCurrent, isManager, activeReportId, busyId, handlers }) {
  if (!reports.length) return null;
  return (
    <>
      <h3 className="home-section">{title}</h3>
      <div className="report-list">
        {reports.map((r) => (
          <ReportRow
            key={r.id}
            report={r}
            isCurrent={isCurrent}
            isManager={isManager}
            isActive={r.id === activeReportId}
            busy={r.id === busyId}
            {...handlers}
          />
        ))}
      </div>
    </>
  );
}

export default function MsrArchive({
  reports,
  loading,
  error,
  isManager,
  activeReportId,
  busyId,
  onOpen,
  onNew,
  onRefresh,
  onDownloadPptx,
  onDownloadJson,
  onDuplicate,
  onDelete,
}) {
  const thisMonth = norm(currentMonthLabel());
  const current = reports.filter((r) => norm(r.month) === thisMonth);
  const previous = reports.filter((r) => norm(r.month) !== thisMonth);

  const handlers = { onOpen, onDownloadPptx, onDownloadJson, onDuplicate, onDelete };
  const sectionProps = { isManager, activeReportId, busyId, handlers };

  return (
    <div className="home-archive">
      <div className="home-head">
        <div>
          <h1 className="home-title">Home - Status Reports</h1>
          <p className="home-sub">Open a report to edit it, or download it as PPTX / JSON.</p>
        </div>
        <div className="home-head-actions">
          <button className="btn-ghost" onClick={onRefresh} disabled={loading}>
            ⟳ Refresh
          </button>
          {isManager && (
            <button className="btn-ghost primary" onClick={onNew} disabled={loading}>
              + New MSR
            </button>
          )}
        </div>
      </div>

      {error && <div className="home-banner">{error}</div>}
      {loading && <p className="home-sub">Loading reports…</p>}

      {!loading && !reports.length && !error && (
        <div className="home-empty">
          <p>No reports yet.</p>
          {isManager ? (
            <button className="btn-ghost primary" onClick={onNew}>
              + Create your first report
            </button>
          ) : (
            <p>Ask your manager to create this month’s report.</p>
          )}
        </div>
      )}

      <Section title="Current month" reports={current} isCurrent {...sectionProps} />
      <Section title="Previous months" reports={previous} {...sectionProps} />
    </div>
  );
}
