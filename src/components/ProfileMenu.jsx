import { useEffect, useRef, useState } from 'react';

// Initials for the avatar, e.g. "Asha Rao" → "AR".
const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

// Profile dropdown in the header. Collapses the per-report actions (Export, Save
// JSON, Import JSON) and Sign out behind one avatar/menu button. Export-related
// items only appear for managers with a report currently open.
export default function ProfileMenu({
  name,
  roleLabel,
  isManager,
  isAdmin,
  hasActiveReport,
  exporting,
  onSignOut,
  onExport,
  onSaveJson,
  onImportJson,
  onManageOrg,
  onManageRoles,
  onAccount,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const act = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  const showReportActions = isManager && hasActiveReport;

  return (
    <div className="profile" ref={ref}>
      <button
        className="profile-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="profile-avatar">{initials(name)}</span>
        <span className="profile-name">{name}</span>
        <span className="profile-caret">▾</span>
      </button>

      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-head">
            <span className="profile-avatar lg">{initials(name)}</span>
            <div>
              <div className="profile-menu-name">{name}</div>
              <div className="profile-menu-role">{roleLabel}</div>
            </div>
          </div>

          {isAdmin && (
            <>
              <button className="profile-menu-item" role="menuitem" onClick={act(onManageOrg)}>
                <span>🏢</span> Manage Organisation
              </button>
              <button className="profile-menu-item" role="menuitem" onClick={act(onManageRoles)}>
                <span>🛡</span> Manage Roles
              </button>
              <div className="profile-menu-sep" />
            </>
          )}

          {showReportActions && (
            <>
              <button
                className="profile-menu-item"
                role="menuitem"
                onClick={act(onExport)}
                disabled={exporting}
              >
                <span>⬇</span> {exporting ? 'Exporting…' : 'Export PPTX'}
              </button>
              <button className="profile-menu-item" role="menuitem" onClick={act(onSaveJson)}>
                <span>💾</span> Save JSON
              </button>
              <button className="profile-menu-item" role="menuitem" onClick={act(onImportJson)}>
                <span>📂</span> Import JSON
              </button>
              <div className="profile-menu-sep" />
            </>
          )}

          <button className="profile-menu-item" role="menuitem" onClick={act(onAccount)}>
            <span>⚙️</span> Account &amp; password
          </button>
          <div className="profile-menu-sep" />

          <button className="profile-menu-item danger" role="menuitem" onClick={act(onSignOut)}>
            <span>⎋</span> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
