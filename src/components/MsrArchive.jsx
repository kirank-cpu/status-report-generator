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
  working,
  onOpen,
  onDownloadPptx,
  onDownloadJson,
  onDuplicate,
  onDelete,
}) {
  const workingNames = (working || []).map((u) => u.name);
  return (
    <div className={`report-row ${isActive ? 'is-active' : ''}`}>
      <div className="report-row-main">
        <div className="report-row-head">
          <span className="report-month">{report.month || '—'}</span>
          {isCurrent && <span className="report-badge">Current</span>}
          <span className="report-row-name">{report.title || 'Untitled report'}</span>
          {workingNames.length > 0 && (
            <span className="report-working" title={workingNames.join(', ')}>
              <span className="report-working-dot" /> {workingNames.length === 1
                ? `${workingNames[0]} is editing`
                : `${workingNames.length} people editing`}
            </span>
          )}
        </div>
        <div className="report-row-meta">
          <span>Created {fmtDate(report.createdAt)}</span>
          <span className="report-meta-dot">•</span>
          <span>Modified {fmtDate(report.modifiedAt)}</span>
          {report.modifiedByName && (
            <>
              <span className="report-meta-dot">•</span>
              <span>by {report.modifiedByName}</span>
            </>
          )}
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

function Section({ title, reports, isCurrent, isManager, activeReportId, busyId, presence, handlers }) {
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
            working={presence?.[r.id]}
            {...handlers}
          />
        ))}
      </div>
    </>
  );
}

const TABS = [
  { key: 'msr', label: 'Monthly (MSR)', noun: 'MSR' },
  { key: 'wsr', label: 'Weekly (WSR)', noun: 'WSR' },
];

export default function MsrArchive({
  reports,
  loading,
  error,
  isManager,
  activeReportId,
  busyId,
  presence,
  tab,
  onTabChange,
  onOpen,
  onNew,
  onRefresh,
  onDownloadPptx,
  onDownloadJson,
  onDuplicate,
  onDelete,
}) {
  // Reports are split by type into separate tabs; each tab is independent.
  const ofType = reports.filter((r) => (r.type || 'msr') === tab);
  const noun = TABS.find((t) => t.key === tab)?.noun || 'report';

  const thisMonth = norm(currentMonthLabel());
  const handlers = { onOpen, onDownloadPptx, onDownloadJson, onDuplicate, onDelete };
  const sectionProps = { isManager, activeReportId, busyId, presence, handlers };

  // MSR groups by month; WSR is a single newest-first list (weekly cadence).
  const current = ofType.filter((r) => norm(r.month) === thisMonth);
  const previous = ofType.filter((r) => norm(r.month) !== thisMonth);

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
            <button className="btn-ghost primary" onClick={() => onNew(tab)} disabled={loading}>
              + New {noun}
            </button>
          )}
        </div>
      </div>

      <div className="home-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`home-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => onTabChange(t.key)}
          >
            {t.label}
            <span className="home-tab-count">{reports.filter((r) => (r.type || 'msr') === t.key).length}</span>
          </button>
        ))}
      </div>

      {error && <div className="home-banner">{error}</div>}
      {loading && <p className="home-sub">Loading reports…</p>}

      {!loading && !ofType.length && !error && (
        <div className="home-empty">
          <p>No {noun} reports yet.</p>
          {isManager ? (
            <button className="btn-ghost primary" onClick={() => onNew(tab)}>
              + Create your first {noun}
            </button>
          ) : (
            <p>Ask your manager to create one.</p>
          )}
        </div>
      )}

      {tab === 'msr' ? (
        <>
          <Section title="Current month" reports={current} isCurrent {...sectionProps} />
          <Section title="Previous months" reports={previous} {...sectionProps} />
        </>
      ) : (
        <Section title="All weekly reports" reports={ofType} {...sectionProps} />
      )}
    </div>
  );
}
