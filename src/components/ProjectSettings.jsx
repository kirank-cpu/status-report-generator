export default function ReportSettings({ report, onChange, readOnly }) {
  const field = (label, key, placeholder = '') => (
    <label className="form-field">
      <span>{label}</span>
      <input
        value={report[key] || ''}
        placeholder={placeholder}
        disabled={readOnly}
        onChange={(e) => onChange({ [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="view">
      <h2>Report Settings</h2>
      <p className="hint">
        Client-level details — these appear on the title slide and footer of every exported slide.
        Projects and squads are managed from the sidebar.
      </p>
      <div className="panel form-grid">
        {field('Report Title', 'title', 'e.g. Monthly Status Report')}
        {field('Subtitle', 'subtitle', 'e.g. QA Status across projects')}
        {field('Report Month', 'month', 'e.g. June 2026')}
        {field('Company / Prepared By', 'company', 'e.g. Everforth Quinnox')}
        {field('Client', 'client', 'e.g. Shawbrook')}
      </div>
    </div>
  );
}
