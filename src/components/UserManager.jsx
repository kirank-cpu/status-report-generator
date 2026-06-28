import { useState } from 'react';
import { resolveSquadIds } from '../constants';

const NEW = '__new__';

const blankForm = () => ({ username: '', password: '', name: '', squadIds: new Set() });

// Manager-only screen to create/remove employee accounts and assign each one
// to any number of squads, including squads in different projects.
export default function UserManager({ employees, teams, onSave, onRemove }) {
  const [selected, setSelected] = useState(NEW);
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState('');

  const editing = selected !== NEW;

  const pick = (username) => {
    setError('');
    setSelected(username);
    if (username === NEW) {
      setForm(blankForm());
      return;
    }
    const emp = employees.find((e) => e.username === username);
    setForm({
      username: emp.username,
      password: emp.password,
      name: emp.name || '',
      squadIds: resolveSquadIds(teams, emp.squads),
    });
  };

  const setField = (patch) => {
    setError('');
    setForm((f) => ({ ...f, ...patch }));
  };

  const toggleSquad = (id) => {
    setError('');
    setForm((f) => {
      const squadIds = new Set(f.squadIds);
      if (squadIds.has(id)) squadIds.delete(id);
      else squadIds.add(id);
      return { ...f, squadIds };
    });
  };

  // Store squad *names* (not the open report's ids) so access stays valid in
  // every monthly report, where the same squad has a different id.
  const squadNames = () => {
    const names = [];
    for (const t of teams)
      for (const p of t.projects)
        for (const q of p.squads) if (form.squadIds.has(q.id)) names.push(q.name);
    return names;
  };

  const save = async () => {
    const username = form.username.trim();
    if (!username) return setError('Username is required.');
    if (!editing && !form.password) return setError('Password is required.');
    if (form.squadIds.size === 0) return setError('Select at least one squad for this employee.');
    const result = await onSave(
      {
        username,
        password: form.password,
        name: form.name.trim() || username,
        role: 'employee',
        squads: squadNames(),
      },
      editing ? selected : null
    );
    if (result?.error) return setError(result.error);
    setSelected(username);
  };

  const remove = async () => {
    if (!editing) return;
    if (!window.confirm(`Remove employee account "${selected}"?`)) return;
    const result = await onRemove(selected);
    if (result?.error) return setError(result.error);
    pick(NEW);
  };

  return (
    <div className="view">
      <h2>Manage Users</h2>
      <p className="hint">
        Create or remove employee accounts and choose which squads each one can edit. Tick squads
        across any project. Managers are configured in the source file.
      </p>

      <div className="panel">
        <label className="form-field">
          <span>User profile</span>
          <select value={selected} onChange={(e) => pick(e.target.value)}>
            <option value={NEW}>+ New employee…</option>
            {employees.map((e) => (
              <option key={e.username} value={e.username}>
                {e.name ? `${e.name} (${e.username})` : e.username}
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
            <span>Password</span>
            <input
              value={form.password}
              placeholder="Set a password"
              onChange={(e) => setField({ password: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <h3>Squad access</h3>
        <p className="hint">Selected squads are the only ones this employee can edit and save.</p>
        {teams.map((t) => (
          <div key={t.id} className="access-team">
            <div className="access-team-name">👥 {t.name || 'Untitled Team'}</div>
            {t.projects.map((p) => (
              <div key={p.id} className="access-project">
                <div className="access-project-name">📁 {p.name || 'Untitled Project'}</div>
                <div className="access-squads">
                  {p.squads.length === 0 && <span className="hint">No squads</span>}
                  {p.squads.map((q) => (
                    <label key={q.id} className="access-squad">
                      <input
                        type="checkbox"
                        checked={form.squadIds.has(q.id)}
                        onChange={() => toggleSquad(q.id)}
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

      {error && <div className="banner banner-warn">{error}</div>}

      <div className="user-actions">
        <button className="btn-primary" onClick={save}>
          {editing ? 'Save Changes' : 'Add Employee'}
        </button>
        {editing && (
          <button className="btn-danger" onClick={remove}>
            Remove Employee
          </button>
        )}
      </div>
    </div>
  );
}
