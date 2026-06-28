import { useState } from 'react';

const NEW = '__new__';
const ROLES = ['admin', 'manager', 'employee'];

const blankForm = () => ({ username: '', password: '', name: '', email: '', role: 'employee', squads: new Set() });

// Admin-only screen: create/remove accounts and set each one's role. For
// employees, pick squad access from the central organisation (matched by name,
// so access carries across every monthly report).
export default function RoleManager({ users, organisation, currentUsername, onSave, onRemove }) {
  const [selected, setSelected] = useState(NEW);
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState('');

  const editing = selected !== NEW;
  const orgTeams = organisation?.teams || [];

  const pick = (username) => {
    setError('');
    setSelected(username);
    if (username === NEW) return setForm(blankForm());
    const u = users.find((x) => x.username === username);
    setForm({
      username: u.username,
      password: '',
      name: u.name || '',
      email: u.email || '',
      role: u.role,
      squads: new Set(u.squads || []),
    });
  };

  const setField = (patch) => {
    setError('');
    setForm((f) => ({ ...f, ...patch }));
  };

  const toggleSquad = (name) => {
    setError('');
    setForm((f) => {
      const squads = new Set(f.squads);
      if (squads.has(name)) squads.delete(name);
      else squads.add(name);
      return { ...f, squads };
    });
  };

  const save = async () => {
    const username = form.username.trim();
    if (!username) return setError('Username is required.');
    if (!editing && !form.password) return setError('Password is required for a new account.');
    if (form.role === 'employee' && form.squads.size === 0) {
      return setError('Select at least one squad for an employee.');
    }
    const payload = {
      username,
      password: form.password, // blank on edit keeps the existing password
      name: form.name.trim() || username,
      email: form.email.trim(),
      role: form.role,
      squads: form.role === 'employee' ? [...form.squads] : [],
    };
    const result = await onSave(payload, editing ? selected : null);
    if (result?.error) return setError(result.error);
    setSelected(username);
    setForm((f) => ({ ...f, password: '' }));
  };

  const remove = async () => {
    if (!editing) return;
    if (selected === currentUsername) return setError('You cannot remove your own account.');
    if (!window.confirm(`Remove account "${selected}"?`)) return;
    const result = await onRemove(selected);
    if (result?.error) return setError(result.error);
    pick(NEW);
  };

  // Quick inline role change from the accounts table. Keeps name/squads/password
  // intact (blank password = unchanged); the backend clears squads for non-employees.
  const changeRole = async (u, role) => {
    setError('');
    const result = await onSave(
      { username: u.username, password: '', name: u.name, email: u.email || '', role, squads: u.squads || [] },
      u.username
    );
    if (result?.error) setError(result.error);
  };

  const squadsLabel = (u) =>
    u.role === 'employee' && u.squads?.length ? u.squads.join(', ') : '—';

  return (
    <div className="view">
      <h2>Manage Roles</h2>
      <p className="hint">
        Create or remove accounts and set each one&apos;s role. Admins manage the organisation and
        roles; managers edit any report; employees edit only their assigned squads.
      </p>

      <div className="panel">
        <h3>All accounts ({users.length})</h3>
        <p className="hint">
          Change a role inline, or click Edit to update the name, password or squad access.
        </p>
        <div className="table-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th className="col-wide">Name</th>
                <th>Username</th>
                <th>Role</th>
                <th className="col-wide">Squads</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="row-label">
                    No accounts yet.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.username} className={u.username === selected ? 'row-selected' : ''}>
                  <td className="row-label">{u.name || u.username}</td>
                  <td>{u.username}</td>
                  <td>
                    <select
                      className="role-select"
                      value={u.role}
                      disabled={u.username === currentUsername}
                      title={u.username === currentUsername ? 'You cannot change your own role' : 'Change role'}
                      onChange={(e) => changeRole(u, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="row-label squads-cell">{squadsLabel(u)}</td>
                  <td className="col-actions">
                    <button className="btn-secondary btn-sm" onClick={() => pick(u.username)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>{editing ? `Edit account: ${selected}` : 'Add a new account'}</h3>
        <label className="form-field">
          <span>Account</span>
          <select value={selected} onChange={(e) => pick(e.target.value)}>
            <option value={NEW}>+ New account…</option>
            {users.map((u) => (
              <option key={u.username} value={u.username}>
                {u.name ? `${u.name} (${u.username})` : u.username} — {u.role}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid" style={{ marginTop: 14 }}>
          <label className="form-field">
            <span>Username</span>
            <input
              value={form.username}
              placeholder="e.g. jsmith"
              disabled={editing}
              onChange={(e) => setField({ username: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Display name</span>
            <input
              value={form.name}
              placeholder="e.g. John Smith"
              onChange={(e) => setField({ name: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Email (for password reset)</span>
            <input
              type="email"
              value={form.email}
              placeholder="e.g. jsmith@example.com"
              onChange={(e) => setField({ email: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Role</span>
            <select value={form.role} onChange={(e) => setField({ role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{editing ? 'New password (blank = unchanged)' : 'Password'}</span>
            <input
              value={form.password}
              placeholder={editing ? 'Leave blank to keep current' : 'Set a password'}
              onChange={(e) => setField({ password: e.target.value })}
            />
          </label>
        </div>
      </div>

      {form.role === 'employee' && (
        <div className="panel">
          <h3>Squad access</h3>
          <p className="hint">
            Selected squads are the only ones this employee can edit. Squads come from Manage
            Organisation.
          </p>
          {orgTeams.length === 0 && <p className="hint">No squads defined yet — add them in Manage Organisation.</p>}
          {orgTeams.map((t) => (
            <div key={t.id || t.name} className="access-team">
              <div className="access-team-name">👥 {t.name || 'Untitled Team'}</div>
              {(t.projects || []).map((p) => (
                <div key={p.id || p.name} className="access-project">
                  <div className="access-project-name">📁 {p.name || 'Untitled Project'}</div>
                  <div className="access-squads">
                    {(p.squads || []).length === 0 && <span className="hint">No squads</span>}
                    {(p.squads || []).map((q) => (
                      <label key={q.id || q.name} className="access-squad">
                        <input
                          type="checkbox"
                          checked={form.squads.has(q.name)}
                          onChange={() => toggleSquad(q.name)}
                        />
                        <span>{q.name || 'Untitled Squad'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {error && <div className="banner banner-warn">{error}</div>}

      <div className="user-actions">
        <button className="btn-primary" onClick={save}>
          {editing ? 'Save Changes' : 'Add Account'}
        </button>
        {editing && selected !== currentUsername && (
          <button className="btn-danger" onClick={remove}>
            Remove Account
          </button>
        )}
      </div>
    </div>
  );
}
