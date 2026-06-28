import { useState } from 'react';
import { uid } from '../constants';

// Admin-only editor for the central Team → Project → Squad name structure that
// new reports are seeded from. Names only — no execution data here.
export default function OrganisationManager({ organisation, onSave, onImportFromLatest }) {
  const [teams, setTeams] = useState(() =>
    (organisation?.teams || []).map((t) => ({
      id: t.id || uid(),
      name: t.name || '',
      projects: (t.projects || []).map((p) => ({
        id: p.id || uid(),
        name: p.name || '',
        squads: (p.squads || []).map((q) => ({ id: q.id || uid(), name: q.name || '' })),
      })),
    }))
  );
  const [status, setStatus] = useState('');

  const dirty = () => setStatus('');

  const addTeam = () => {
    dirty();
    setTeams((ts) => [...ts, { id: uid(), name: '', projects: [] }]);
  };
  const renameTeam = (id, name) => {
    dirty();
    setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
  };
  const removeTeam = (id) => {
    dirty();
    setTeams((ts) => ts.filter((t) => t.id !== id));
  };
  const addProject = (teamId) => {
    dirty();
    setTeams((ts) =>
      ts.map((t) => (t.id === teamId ? { ...t, projects: [...t.projects, { id: uid(), name: '', squads: [] }] } : t))
    );
  };
  const renameProject = (teamId, pid, name) => {
    dirty();
    setTeams((ts) =>
      ts.map((t) =>
        t.id === teamId ? { ...t, projects: t.projects.map((p) => (p.id === pid ? { ...p, name } : p)) } : t
      )
    );
  };
  const removeProject = (teamId, pid) => {
    dirty();
    setTeams((ts) =>
      ts.map((t) => (t.id === teamId ? { ...t, projects: t.projects.filter((p) => p.id !== pid) } : t))
    );
  };
  const addSquad = (teamId, pid) => {
    dirty();
    setTeams((ts) =>
      ts.map((t) =>
        t.id === teamId
          ? {
              ...t,
              projects: t.projects.map((p) =>
                p.id === pid ? { ...p, squads: [...p.squads, { id: uid(), name: '' }] } : p
              ),
            }
          : t
      )
    );
  };
  const renameSquad = (teamId, pid, sid, name) => {
    dirty();
    setTeams((ts) =>
      ts.map((t) =>
        t.id === teamId
          ? {
              ...t,
              projects: t.projects.map((p) =>
                p.id === pid ? { ...p, squads: p.squads.map((q) => (q.id === sid ? { ...q, name } : q)) } : p
              ),
            }
          : t
      )
    );
  };
  const removeSquad = (teamId, pid, sid) => {
    dirty();
    setTeams((ts) =>
      ts.map((t) =>
        t.id === teamId
          ? {
              ...t,
              projects: t.projects.map((p) =>
                p.id === pid ? { ...p, squads: p.squads.filter((q) => q.id !== sid) } : p
              ),
            }
          : t
      )
    );
  };

  const save = async () => {
    setStatus('Saving…');
    try {
      await onSave({ teams });
      setStatus('✓ Organisation saved');
    } catch (e) {
      setStatus('Could not save: ' + e.message);
    }
  };

  return (
    <div className="view">
      <h2>Manage Organisation</h2>
      <p className="hint">
        Define the Teams, Projects and Squads once. New reports are pre-filled with these names and
        empty data, so each month you only enter the numbers.
      </p>

      {teams.length === 0 && (
        <div className="panel">
          <p className="hint">No organisation defined yet.</p>
          {onImportFromLatest && (
            <button className="btn-secondary" onClick={() => setTeams(onImportFromLatest())}>
              Import structure from latest report
            </button>
          )}
        </div>
      )}

      {teams.map((t) => (
        <section key={t.id} className="panel org-team">
          <div className="org-row">
            <input
              className="org-input org-team-input"
              value={t.name}
              placeholder="Team name"
              onChange={(e) => renameTeam(t.id, e.target.value)}
            />
            <button className="btn-danger btn-sm" onClick={() => removeTeam(t.id)}>
              Remove Team
            </button>
          </div>

          {t.projects.map((p) => (
            <div key={p.id} className="org-project">
              <div className="org-row">
                <input
                  className="org-input org-project-input"
                  value={p.name}
                  placeholder="Project name"
                  onChange={(e) => renameProject(t.id, p.id, e.target.value)}
                />
                <button className="btn-secondary btn-sm" onClick={() => removeProject(t.id, p.id)}>
                  Remove Project
                </button>
              </div>

              <div className="org-squads">
                {p.squads.map((q) => (
                  <div key={q.id} className="org-row org-squad">
                    <input
                      className="org-input"
                      value={q.name}
                      placeholder="Squad name"
                      onChange={(e) => renameSquad(t.id, p.id, q.id, e.target.value)}
                    />
                    <button className="icon-btn" title="Remove squad" onClick={() => removeSquad(t.id, p.id, q.id)}>
                      ✕
                    </button>
                  </div>
                ))}
                <button className="btn-secondary btn-sm" onClick={() => addSquad(t.id, p.id)}>
                  + Add Squad
                </button>
              </div>
            </div>
          ))}

          <button className="btn-secondary btn-sm" onClick={() => addProject(t.id)}>
            + Add Project
          </button>
        </section>
      ))}

      <div className="user-actions">
        <button className="btn-secondary" onClick={addTeam}>
          + Add Team
        </button>
        <button className="btn-primary" onClick={save}>
          Save Organisation
        </button>
        {status && <span className="save-hint">{status}</span>}
      </div>
    </div>
  );
}
