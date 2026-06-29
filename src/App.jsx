import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeInitialState,
  makeProject,
  makeSquad,
  makeTeam,
  makeWsrProject,
  makeWsrSquad,
  migrateState,
  normalizeWsrState,
  blankWsrReport,
  unsavedSquads,
  resolveSquadIds,
  blankReportFromOrg,
  orgFromTeams,
} from './constants';
import ReportSettings from './components/ProjectSettings';
import SummaryView from './components/SummaryView';
import TeamView from './components/TeamView';
import ProjectView from './components/ProjectView';
import SquadEditor from './components/SquadEditor';
import WsrSquadEditor from './components/WsrSquadEditor';
import UserManager from './components/UserManager';
import OrganisationManager from './components/OrganisationManager';
import RoleManager from './components/RoleManager';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import SignUp from './components/SignUp';
import VerifyEmail from './components/VerifyEmail';
import AccountModal from './components/AccountModal';
import MsrArchive from './components/MsrArchive';
import ProfileMenu from './components/ProfileMenu';
import PresenceBar from './components/PresenceBar';
import { exportPptx } from './export/exportPptx';
import { exportWsrPptx } from './export/exportWsrPptx';
import {
  listReports,
  getReport,
  createReport,
  patchSquad,
  patchStructure,
  deleteReport,
  duplicateReport,
} from './api/reports';
import {
  getHomePresence,
  heartbeat as heartbeatPresence,
  acquireLock,
  releaseLock,
  leaveReport,
} from './api/collab';
import {
  login,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  updateEmail,
  forgotPassword,
  resetPassword,
  signup,
  verifyEmail,
} from './api/users';
import { getOrganisation, saveOrganisation } from './api/organisation';

// Legacy key from the single-document era. Read once to migrate that doc into the
// archive on first run; the server is the source of truth from then on.
const LEGACY_STATE_KEY = 'msr-generator-state-v1';
const SESSION_KEY = 'msr-session-v1';

function readLegacyState() {
  try {
    const raw = localStorage.getItem(LEGACY_STATE_KEY);
    if (raw) return migrateState(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return null;
}

// Optimistic session from localStorage; re-validated against the API on load.
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* no session */
  }
  return null;
}

// Find a squad by id anywhere in a report document (team→project→squad).
function findSquadInDoc(doc, squadId) {
  for (const t of doc?.teams || [])
    for (const p of t.projects || [])
      for (const q of p.squads || []) if (q.id === squadId) return q;
  return null;
}

// Merge a freshly-fetched server document with the local one, keeping this
// client's in-flight (not-yet-saved) section edits on top so a background sync
// can't overwrite what the user is currently typing. `pending` is
// { [squadId]: { field: true, … } } — the sections this client still owns.
function overlayPending(serverDoc, localDoc, pending) {
  if (!serverDoc) return serverDoc;
  const doc = structuredClone(serverDoc);
  for (const [squadId, fields] of Object.entries(pending || {})) {
    const local = findSquadInDoc(localDoc, squadId);
    const target = findSquadInDoc(doc, squadId);
    if (local && target) for (const f of Object.keys(fields)) target[f] = local[f];
  }
  return doc;
}

// Which signed-out page the current URL maps to.
function initialPublicView() {
  const p = window.location.pathname;
  if (p === '/reset-password') return 'reset';
  if (p === '/forgot-password') return 'forgot';
  if (p === '/verify-email') return 'verify';
  if (p === '/signup') return 'signup';
  return 'login';
}

// Maps the app's view state to a URL path so the address bar reflects the page.
function pathForState({ session, adminView, activeReportId, selected, hasReport }) {
  if (!session) return '/login';
  if (adminView === 'org') return '/manage-organisation';
  if (adminView === 'roles') return '/manage-roles';
  const onArchive = selected === 'archive' || !hasReport;
  if (onArchive) return '/home';
  const base = `/report/${activeReportId}`;
  return selected && selected !== 'archive' ? `${base}/${encodeURIComponent(selected)}` : base;
}

// First squad id an employee can edit in the given teams, or null.
function firstEditableSquadId(teams, user) {
  if (user?.role !== 'employee') return null;
  const ids = resolveSquadIds(teams, user.squads);
  for (const t of teams)
    for (const p of t.projects)
      for (const q of p.squads) if (ids.has(q.id)) return q.id;
  return null;
}

// Download any report document as a JSON file.
function downloadJson(data, monthLabel) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `MSR_${String(monthLabel || data?.report?.month || 'report').replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function App() {
  // `state` is the report currently open in the editor (null until one is opened).
  const [state, setState] = useState(null);
  const [users, setUsers] = useState([]);
  const [organisation, setOrganisation] = useState({ teams: [] });
  const [session, setSession] = useState(loadSession);
  const [selected, setSelected] = useState('archive');
  const [adminView, setAdminView] = useState(null); // 'org' | 'roles' | null
  const [exporting, setExporting] = useState(false);
  const [homeTab, setHomeTab] = useState('msr'); // which report type the home page shows
  // Signed-out page + the open Account modal (signed in).
  const [publicView, setPublicView] = useState(initialPublicView);
  const [accountOpen, setAccountOpen] = useState(false);
  // Reset token from the email link (?token=…); captured once at load.
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('token'));

  // Archive list + open-report bookkeeping.
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);
  const [activeReportId, setActiveReportId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Collaboration: presence + section locks ───────────────────────────────
  const [homePresence, setHomePresence] = useState({}); // reportId -> [{username,name}]
  const [reportPresence, setReportPresence] = useState([]); // who's in the open report
  const [locks, setLocks] = useState({}); // sectionKey -> { username, name }
  // Section-scoped saves: accumulate per-squad field changes, flush as patches.
  const pendingSquadPatches = useRef({}); // squadId -> { field: value }
  const pendingStructure = useRef(false); // report-settings/structure changed
  // Last server modified_at we've reconciled locally (to detect others' edits).
  const lastSyncedRef = useRef(null);
  // The report we're currently announced in, so we can "leave" it on switch.
  const presentReportRef = useRef(null);

  const fileRef = useRef(null);
  // Set right after loading a report so the autosave effect skips the load itself.
  const skipSaveRef = useRef(false);
  // URL-routing bookkeeping: the path at first load, and whether we've restored it.
  const initialPathRef = useRef(window.location.pathname);
  const didRouteInitRef = useRef(false);
  const routeRestoredRef = useRef(false);

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  // Admins inherit every manager capability, plus org/role management.
  const isAdmin = session?.role === 'admin';
  const isManager = session?.role === 'manager' || isAdmin;

  // ── Archive loading + one-time migration ──────────────────────────────────
  const loadReportList = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      let list = await listReports();
      if (list.length === 0) {
        const legacy = readLegacyState();
        if (legacy) {
          await createReport(legacy);
          localStorage.removeItem(LEGACY_STATE_KEY); // imported — don't re-import
          list = await listReports();
        }
      }
      setReports(list);
    } catch (e) {
      setReportsError(
        `Could not reach the report server. Make sure it is running (cd server && npm start). ${e.message}`
      );
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // Load the account list (used for management + session re-validation). If the
  // signed-in account has been removed/changed server-side, refresh or sign out.
  const loadUsers = useCallback(async () => {
    try {
      const list = await listUsers();
      setUsers(list);
      setSession((cur) => {
        if (!cur) return cur;
        const fresh = list.find((u) => u.username === cur.username);
        if (!fresh) return null;
        // Keep the same object reference when nothing relevant changed, so the
        // post-login effect (keyed on username) doesn't re-fire in a loop.
        const unchanged =
          fresh.role === cur.role &&
          fresh.name === cur.name &&
          fresh.status === cur.status &&
          fresh.email === cur.email &&
          JSON.stringify(fresh.squads || []) === JSON.stringify(cur.squads || []);
        return unchanged ? cur : { ...cur, ...fresh };
      });
    } catch {
      /* server unreachable — keep the optimistic session */
    }
  }, []);

  // Load the central organisation. One-time migration: if none is defined yet but
  // reports exist, seed it from the newest report's structure (names only) so
  // "New MSR" carries those Team/Project/Squad names out of the box.
  const loadOrganisation = useCallback(async () => {
    try {
      let org = await getOrganisation();
      if (!org.teams?.length) {
        const list = await listReports();
        if (list.length) {
          const newest = await getReport(list[0].id);
          const seeded = orgFromTeams(newest.data?.teams || []);
          if (seeded.teams.length) org = await saveOrganisation(seeded);
        }
      }
      setOrganisation(org);
    } catch {
      /* org stays empty; New MSR falls back to a single blank squad */
    }
  }, []);

  // Keyed on the username (a stable string) rather than the session object, so
  // refreshing the session in loadUsers can't retrigger this fetch.
  const sessionUser = session?.username;
  useEffect(() => {
    if (!sessionUser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReportList();
    loadUsers();
    loadOrganisation();
  }, [sessionUser, loadReportList, loadUsers, loadOrganisation]);

  // ── Debounced section-scoped save of the open report ──────────────────────
  // Rather than overwriting the whole document, flush only the sections this
  // client changed: a patch per touched squad, plus one structure patch when the
  // Report Settings shape/meta changed. This is what lets collaborators edit
  // different sections concurrently without clobbering one another.
  useEffect(() => {
    if (!activeReportId || !state) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const canEdit = isManager || resolveSquadIds(state.teams, session?.squads).size > 0;
    if (!canEdit) return;
    const hasSquad = Object.keys(pendingSquadPatches.current).length > 0;
    if (!hasSquad && !pendingStructure.current) return;

    const t = setTimeout(async () => {
      const by = session?.username;
      setSaving(true);
      try {
        // Snapshot then clear pending, so edits made during the awaits below are
        // captured by the next flush rather than dropped.
        const squadPatches = pendingSquadPatches.current;
        pendingSquadPatches.current = {};
        const doStructure = pendingStructure.current;
        pendingStructure.current = false;

        let modifiedAt = null;
        // Structure first so any newly-added squads exist before we patch their
        // fields, and so renames/removals land; it preserves existing squads'
        // stored section data, which the squad patches below then update.
        if (doStructure) {
          const res = await patchStructure(activeReportId, state.report, state.teams, by);
          if (res?.modifiedAt) modifiedAt = res.modifiedAt;
        }
        for (const [squadId, patch] of Object.entries(squadPatches)) {
          const res = await patchSquad(activeReportId, squadId, patch, by);
          if (res?.modifiedAt) modifiedAt = res.modifiedAt;
        }
        if (modifiedAt) {
          setReports((list) =>
            list.map((r) =>
              r.id === activeReportId
                ? {
                    ...r,
                    month: state.report?.month ?? r.month,
                    title: state.report?.title ?? r.title,
                    modifiedAt,
                    modifiedBy: by,
                    modifiedByName: session?.name || by,
                  }
                : r
            )
          );
        }
      } catch {
        /* keep editing; the next change retries (pending will repopulate) */
      } finally {
        setSaving(false);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [state, activeReportId, isManager, session]);

  // ── Presence + locks: heartbeat into the open report every ~3s ─────────────
  useEffect(() => {
    if (!activeReportId || !sessionUser) return;
    const name = session?.name || sessionUser;
    let cancelled = false;
    presentReportRef.current = activeReportId;

    const beat = async () => {
      try {
        const res = await heartbeatPresence(activeReportId, sessionUser, name);
        if (cancelled || !res) return;
        setReportPresence(res.presence || []);
        setLocks(res.locks || {});
        // Pull collaborators' changes when the doc moved on — unless we're mid
        // structural edit (reconciled on flush). Our own in-flight section edits
        // are preserved by overlaying pending patches on the fetched doc.
        const serverAt = res.meta?.modifiedAt;
        if (serverAt && serverAt !== lastSyncedRef.current && !pendingStructure.current) {
          lastSyncedRef.current = serverAt;
          try {
            const fresh = await getReport(activeReportId);
            if (cancelled) return;
            const incoming = migrateState(fresh.data) || fresh.data;
            skipSaveRef.current = true;
            setState((local) => overlayPending(incoming, local, pendingSquadPatches.current));
          } catch {
            /* keep local; the next beat retries */
          }
        }
      } catch {
        /* transient network blip; the next beat retries */
      }
    };

    beat();
    const iv = setInterval(beat, 3000);
    return () => {
      cancelled = true;
      clearInterval(iv);
      leaveReport(activeReportId, sessionUser).catch(() => {});
      setReportPresence([]);
      setLocks({});
    };
  }, [activeReportId, sessionUser, session?.name]);

  // ── Home page: poll which reports currently have people in them ────────────
  useEffect(() => {
    if (!sessionUser) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await getHomePresence();
        if (!cancelled) setHomePresence(data || {});
      } catch {
        /* ignore; next tick retries */
      }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [sessionUser]);

  // Acquire a section lock when the user starts editing it; returns whether we
  // got it (false ⇒ someone else holds it and the section stays read-only).
  const acquireSection = async (section) => {
    if (!activeReportId || !sessionUser) return false;
    const res = await acquireLock(activeReportId, section, sessionUser, session?.name || sessionUser);
    if (res?.locks) setLocks(res.locks);
    return !!res?.ok;
  };

  // Release a section lock we hold (on blur / leaving the squad page).
  const releaseSection = (section) => {
    if (!activeReportId || !sessionUser) return;
    releaseLock(activeReportId, section, sessionUser).catch(() => {});
    setLocks((cur) => {
      if (cur[section]?.username !== sessionUser) return cur;
      const next = { ...cur };
      delete next[section];
      return next;
    });
  };

  const handleLogin = (user) => {
    setSession(user);
    setSelected('archive');
  };

  const authFn = (username, password) => login(username, password);

  const signOut = () => {
    setSession(null);
    setState(null);
    setActiveReportId(null);
    setReports([]);
    setAdminView(null);
    setSelected('archive');
    setAccountOpen(false);
    // The routing effect no longer manages the URL while signed out, so reset it.
    setPublicView('login');
    if (window.location.pathname !== '/login') window.history.pushState({}, '', '/login');
  };

  // ── Account self-service (signed in) ──────────────────────────────────────
  // Change the current user's password, surfacing { error } for the modal.
  const doChangePassword = async (currentPassword, newPassword) => {
    try {
      await changePassword(session.username, currentPassword, newPassword);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  };

  // Update the current user's email; mirror it into the session + user list.
  const doUpdateEmail = async (email) => {
    try {
      const updated = await updateEmail(session.username, email);
      setSession((cur) => (cur ? { ...cur, email: updated.email } : cur));
      setUsers((list) => list.map((u) => (u.username === updated.username ? { ...u, ...updated } : u)));
      return {};
    } catch (e) {
      return { error: e.message };
    }
  };

  // ── Pre-login navigation (signed out) ─────────────────────────────────────
  const goPublic = (view) => {
    setPublicView(view);
    const path =
      view === 'forgot'
        ? '/forgot-password'
        : view === 'reset'
          ? '/reset-password'
          : view === 'signup'
            ? '/signup'
            : view === 'verify'
              ? '/verify-email'
              : '/login';
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
  };

  // ── Open / create / download / duplicate / delete reports ─────────────────
  // `desiredSelected` overrides the default landing page (used when restoring a
  // deep link like /report/<id>/summary).
  const openReport = async (id, desiredSelected) => {
    setBusyId(id);
    try {
      const r = await getReport(id);
      // WSR and MSR documents share the team→project→squad shape but normalize
      // differently; pick the loader by the report's type.
      const data =
        r.type === 'wsr'
          ? normalizeWsrState(r.data) || blankWsrReport(null)
          : migrateState(r.data) || makeInitialState();
      // Fresh open: clear any stale pending edits and mark this doc version as
      // synced so the first heartbeat doesn't needlessly refetch.
      pendingSquadPatches.current = {};
      pendingStructure.current = false;
      lastSyncedRef.current = r.modifiedAt || null;
      skipSaveRef.current = true;
      setState(data);
      setActiveReportId(id);
      // MSR employees land on their squad (or the overall summary); WSR has no
      // summary, so fall back to settings. Managers always land on settings.
      const fallback =
        session.role === 'employee'
          ? firstEditableSquadId(data.teams, session) || (r.type === 'wsr' ? 'settings' : 'summary')
          : 'settings';
      setSelected(desiredSelected || fallback);
    } catch (e) {
      window.alert('Could not open report: ' + e.message);
    } finally {
      setBusyId(null);
    }
  };

  // ── URL routing (History API) ─────────────────────────────────────────────
  // Keep the address bar in sync with the current view. First write replaces the
  // entry (so /login isn't left in history); later changes push a new entry.
  useEffect(() => {
    // While signed out, the pre-login views (login/forgot/reset) drive the URL
    // themselves — don't overwrite it (and keep the reset link's ?token query).
    if (!session) return;
    const path = pathForState({ session, adminView, activeReportId, selected, hasReport: !!state });
    if (window.location.pathname !== path) {
      if (didRouteInitRef.current) window.history.pushState({}, '', path);
      else window.history.replaceState({}, '', path);
    }
    didRouteInitRef.current = true;
  }, [session, adminView, activeReportId, selected, state]);

  // Restore the page named in the URL once, after the session is known (covers a
  // refresh on a deep link, e.g. /report/<id>/summary or /manage-roles).
  useEffect(() => {
    if (routeRestoredRef.current || !session) return;
    routeRestoredRef.current = true;
    const [root, a, b] = initialPathRef.current.split('/').filter(Boolean);
    // Deferred so the state updates aren't synchronous within the effect body.
    queueMicrotask(() => {
      if (root === 'manage-organisation' && session.role === 'admin') setAdminView('org');
      else if (root === 'manage-roles' && session.role === 'admin') setAdminView('roles');
      else if (root === 'report' && a) openReport(a, b ? decodeURIComponent(b) : undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Back/forward navigation: re-apply the page from the URL.
  useEffect(() => {
    const onPop = () => {
      if (!session) return;
      const [root, a, b] = window.location.pathname.split('/').filter(Boolean);
      if (root === 'manage-organisation' && session.role === 'admin') return setAdminView('org');
      if (root === 'manage-roles' && session.role === 'admin') return setAdminView('roles');
      setAdminView(null);
      if (root === 'report' && a) {
        if (a === activeReportId) setSelected(b ? decodeURIComponent(b) : 'settings');
        else openReport(a, b ? decodeURIComponent(b) : undefined);
        return;
      }
      setSelected('archive');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, activeReportId]);

  const newReport = async (type = 'msr') => {
    try {
      // Fresh report seeded from the org structure (names only); WSR flattens
      // teams away (Project → Squad only).
      const data = type === 'wsr' ? blankWsrReport(organisation) : blankReportFromOrg(organisation);
      const created = await createReport(data, session?.username, type);
      await loadReportList();
      openReport(created.id);
    } catch (e) {
      window.alert('Could not create report: ' + e.message);
    }
  };

  const downloadReportJson = async (id) => {
    setBusyId(id);
    try {
      const r = await getReport(id);
      downloadJson(r.data, r.month);
    } catch (e) {
      window.alert('Could not download report: ' + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const downloadReportPptx = async (id) => {
    setBusyId(id);
    try {
      const r = await getReport(id);
      if (r.type === 'wsr') await exportWsrPptx(normalizeWsrState(r.data) || r.data);
      else await exportPptx(r.data);
    } catch (e) {
      window.alert('Export failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (id) => {
    setBusyId(id);
    try {
      await duplicateReport(id);
      await loadReportList();
    } catch (e) {
      window.alert('Could not duplicate report: ' + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const removeReport = async (id) => {
    const target = reports.find((r) => r.id === id);
    if (!window.confirm(`Delete report "${target?.month || target?.title || id}"? This cannot be undone.`))
      return;
    setBusyId(id);
    try {
      await deleteReport(id);
      if (id === activeReportId) {
        setActiveReportId(null);
        setState(null);
        setSelected('archive');
      }
      await loadReportList();
    } catch (e) {
      window.alert('Could not delete report: ' + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const goToArchive = () => {
    setAdminView(null);
    setSelected('archive');
  };

  // ── User accounts (backed by the API store) ───────────────────────────────
  // Create or update an account; returns { error } on failure for the forms.
  const saveUser = async (user, originalUsername) => {
    try {
      if (originalUsername) await updateUser(originalUsername, user);
      else await createUser(user);
      await loadUsers();
      return {};
    } catch (e) {
      return { error: e.message };
    }
  };

  const removeUser = async (username) => {
    try {
      await deleteUser(username);
      if (session?.username === username) return signOut();
      await loadUsers();
      return {};
    } catch (e) {
      return { error: e.message };
    }
  };

  const saveOrg = async (data) => {
    const saved = await saveOrganisation(data);
    setOrganisation(saved);
    return saved;
  };

  // Employees may own several squads; resolve their refs against the open report.
  const mySquadIds =
    session?.role === 'employee' && state ? resolveSquadIds(state.teams, session.squads) : new Set();
  // A newly signed-up user awaiting admin approval: read-only everywhere until
  // approved and assigned squads (requirements 5 & 6).
  const isPending = session?.status === 'pending';
  const squadNotFound =
    session?.role === 'employee' && !isPending && !!state && mySquadIds.size === 0;
  const canEditSquad = (squadId) => isManager || (!isPending && mySquadIds.has(squadId));

  // ── Report-content editing (operate on the open report) ───────────────────
  // Report meta + team/project/squad shape go through the structure patch, so
  // flag it whenever one of these mutators runs.
  const markStructureDirty = () => {
    pendingStructure.current = true;
  };

  const updateReportSettings = (patch) => {
    markStructureDirty();
    setState((s) => ({ ...s, report: { ...s.report, ...patch } }));
  };

  const updateTeam = (teamId, patch) => {
    markStructureDirty();
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)),
    }));
  };

  const addTeam = () => {
    markStructureDirty();
    const team = makeTeam(`Team ${state.teams.length + 1}`);
    setState((s) => ({ ...s, teams: [...s.teams, team] }));
    setSelected(team.id);
  };

  const removeTeam = (teamId) => {
    const team = state.teams.find((t) => t.id === teamId);
    if (!window.confirm(`Remove team "${team?.name}" and all its projects and squads?`)) return;
    markStructureDirty();
    setState((s) => ({ ...s, teams: s.teams.filter((t) => t.id !== teamId) }));
    setSelected('summary');
  };

  const updateProject = (teamId, projectId, patch) => {
    markStructureDirty();
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId
          ? { ...t, projects: t.projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)) }
          : t
      ),
    }));
  };

  const addProject = (teamId) => {
    markStructureDirty();
    const team = state.teams.find((t) => t.id === teamId);
    const name = `Project ${(team?.projects.length || 0) + 1}`;
    const project = state.report?.type === 'wsr' ? makeWsrProject(name) : makeProject(name);
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId ? { ...t, projects: [...t.projects, project] } : t
      ),
    }));
    setSelected(project.id);
  };

  const removeProject = (teamId, projectId) => {
    const team = state.teams.find((t) => t.id === teamId);
    const project = team?.projects.find((p) => p.id === projectId);
    if (!window.confirm(`Remove project "${project?.name}" and all its squads?`)) return;
    markStructureDirty();
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId ? { ...t, projects: t.projects.filter((p) => p.id !== projectId) } : t
      ),
    }));
    setSelected(teamId);
  };

  // Record the changed fields (plus the dirtied `saved` flag) so the next flush
  // patches only this squad's touched section — not the whole document.
  const queueSquadPatch = (squadId, patch) => {
    pendingSquadPatches.current[squadId] = { ...pendingSquadPatches.current[squadId], ...patch };
  };

  const updateSquad = (teamId, projectId, squadId, patch) => {
    queueSquadPatch(squadId, { ...patch, saved: false });
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              projects: t.projects.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      squads: p.squads.map((q) =>
                        q.id === squadId ? { ...q, ...patch, saved: false } : q
                      ),
                    }
                  : p
              ),
            }
          : t
      ),
    }));
  };

  const saveSquad = (teamId, projectId, squadId) => {
    queueSquadPatch(squadId, { saved: true });
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              projects: t.projects.map((p) =>
                p.id === projectId
                  ? { ...p, squads: p.squads.map((q) => (q.id === squadId ? { ...q, saved: true } : q)) }
                  : p
              ),
            }
          : t
      ),
    }));
  };

  const addSquad = (teamId, projectId) => {
    markStructureDirty();
    const team = state.teams.find((t) => t.id === teamId);
    const project = team?.projects.find((p) => p.id === projectId);
    const squadName = `Squad ${(project?.squads.length || 0) + 1}`;
    const squad = state.report?.type === 'wsr' ? makeWsrSquad(squadName) : makeSquad(squadName);
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              projects: t.projects.map((p) =>
                p.id === projectId ? { ...p, squads: [...p.squads, squad] } : p
              ),
            }
          : t
      ),
    }));
    setSelected(squad.id);
  };

  const removeSquad = (teamId, projectId, squadId) => {
    const team = state.teams.find((t) => t.id === teamId);
    const project = team?.projects.find((p) => p.id === projectId);
    const squad = project?.squads.find((q) => q.id === squadId);
    if (!window.confirm(`Remove squad "${squad?.name}" and all its data?`)) return;
    markStructureDirty();
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              projects: t.projects.map((p) =>
                p.id === projectId ? { ...p, squads: p.squads.filter((q) => q.id !== squadId) } : p
              ),
            }
          : t
      ),
    }));
    setSelected(projectId);
  };

  const onExport = async () => {
    const pending = unsavedSquads(state.teams);
    if (pending.length) {
      window.alert(
        `Cannot export yet — ${pending.length} squad${pending.length > 1 ? 's have' : ' has'} ` +
          'not saved their data:\n\n• ' +
          pending.map((p) => p.path).join('\n• ') +
          '\n\nAsk each squad to open their page and click "Save Squad Data", then export again.'
      );
      return;
    }
    setExporting(true);
    try {
      if (state.report?.type === 'wsr') await exportWsrPptx(state);
      else await exportPptx(state);
    } catch (e) {
      window.alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const saveJson = () => downloadJson(state, state?.report?.month);

  // Import a JSON file as a brand-new report in the archive, then open it.
  const loadJsonFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const migrated = migrateState(JSON.parse(reader.result));
        if (!migrated) throw new Error('Not a valid MSR file');
        const created = await createReport(migrated);
        await loadReportList();
        openReport(created.id);
      } catch (err) {
        window.alert('Could not load file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // The reset/verify links are reachable whether or not a session exists (a
  // logged-in user may still click them); finishing drops them at sign in.
  if (publicView === 'reset') {
    return (
      <ResetPassword
        token={resetToken}
        onReset={(token, newPassword) => resetPassword(token, newPassword)}
        onBack={() => {
          if (session) signOut();
          goPublic('login');
        }}
      />
    );
  }

  if (publicView === 'verify') {
    return (
      <VerifyEmail
        token={resetToken}
        onVerify={(token) => verifyEmail(token)}
        onBack={() => {
          if (session) signOut();
          goPublic('login');
        }}
      />
    );
  }

  if (!session) {
    if (publicView === 'forgot') {
      return (
        <ForgotPassword
          onRequest={(email) => forgotPassword(email)}
          onBack={() => goPublic('login')}
        />
      );
    }
    if (publicView === 'signup') {
      return (
        <SignUp
          onSignUp={(username, email, password) => signup(username, email, password)}
          onBack={() => goPublic('login')}
        />
      );
    }
    return (
      <Login
        authenticate={authFn}
        onLogin={handleLogin}
        onForgot={() => goPublic('forgot')}
        onSignUp={() => goPublic('signup')}
      />
    );
  }

  // The archive is shown when explicitly selected or when no report is open yet.
  const showArchive = selected === 'archive' || !state;

  // Resolve the selected id against the open report's team → project → squad tree.
  const teams = state?.teams || [];
  // WSR documents have no Team level (a single hidden wrapper team holds the
  // projects); the editor chrome hides teams and uses the WSR squad editor.
  const isWsr = state?.report?.type === 'wsr';
  const wsrTeam = isWsr ? teams[0] : null;
  const selectedTeam = teams.find((t) => t.id === selected);
  let projectMatch = null;
  let squadMatch = null;
  for (const t of teams) {
    for (const p of t.projects) {
      if (p.id === selected) projectMatch = { team: t, project: p };
      const q = p.squads.find((sq) => sq.id === selected);
      if (q) squadMatch = { team: t, project: p, squad: q };
    }
  }

  // Breadcrumb trail for the open report's editor pages. Each crumb carries a
  // navigation `target` (a `selected` id, or 'archive'); the last crumb is the
  // current page and is not clickable. Rendered as a back + breadcrumb bar so
  // every editor page can move up the hierarchy without hunting the sidebar.
  const STATIC_LABELS = {
    settings: 'Report Settings',
    summary: 'Overall Summary',
    users: 'Manage Users',
  };
  let crumbs = null;
  if (!showArchive) {
    const trail = [{ label: '🏠 Home', target: 'archive' }];
    if (squadMatch) {
      trail.push({ label: squadMatch.team.name || 'Team', target: squadMatch.team.id });
      trail.push({ label: squadMatch.project.name || 'Project', target: squadMatch.project.id });
      trail.push({ label: squadMatch.squad.name || 'Squad', target: null });
    } else if (projectMatch) {
      trail.push({ label: projectMatch.team.name || 'Team', target: projectMatch.team.id });
      trail.push({ label: projectMatch.project.name || 'Project', target: null });
    } else if (selectedTeam) {
      trail.push({ label: selectedTeam.name || 'Team', target: null });
    } else if (STATIC_LABELS[selected]) {
      trail.push({ label: STATIC_LABELS[selected], target: null });
    }
    crumbs = trail;
  }
  // Back goes to the parent crumb (or the archive when there is no deeper parent).
  const backTarget = crumbs && crumbs.length >= 2 ? crumbs[crumbs.length - 2].target || 'archive' : 'archive';
  // Plain label for the prominent in-header back button on the editor pages.
  const backLabel = squadMatch
    ? squadMatch.project.name || 'Project'
    : projectMatch
      ? projectMatch.team.name || 'Team'
      : 'Home';
  const goBack = () => setSelected(backTarget);

  const displayName = session.name || session.username;
  const roleLabel = isAdmin
    ? `Admin · ${displayName}`
    : isManager
      ? `Manager · ${displayName}`
      : `${displayName} · ${mySquadIds.size} squad${mySquadIds.size === 1 ? '' : 's'}`;

  const profileMenu = (
    <ProfileMenu
      name={displayName}
      roleLabel={roleLabel}
      isManager={isManager}
      isAdmin={isAdmin}
      hasActiveReport={!!activeReportId}
      exporting={exporting}
      onSignOut={signOut}
      onExport={onExport}
      onSaveJson={saveJson}
      onImportJson={() => fileRef.current?.click()}
      onManageOrg={() => setAdminView('org')}
      onManageRoles={() => setAdminView('roles')}
      onAccount={() => setAccountOpen(true)}
    />
  );

  const accountModal = accountOpen && (
    <AccountModal
      user={session}
      onClose={() => setAccountOpen(false)}
      onChangePassword={doChangePassword}
      onUpdateEmail={doUpdateEmail}
    />
  );

  // Collaborators currently in the open report (shown as initials in the header).
  const presenceBar = activeReportId ? (
    <PresenceBar users={reportPresence} me={session.username} />
  ) : null;
  // Shared hidden picker for "Import JSON" (managers only).
  const hiddenFileInput = isManager ? (
    <input ref={fileRef} type="file" accept=".json" hidden onChange={loadJsonFile} />
  ) : null;

  // ── Admin screens: full-page (light), no sidebar ──────────────────────────
  if (adminView && isAdmin) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">MSR</span>
            <span className="brand-name">Monthly Status Report</span>
          </div>
          <div className="topbar-actions">
            <button className="btn-secondary btn-sm" onClick={goToArchive}>
              ← Home
            </button>
            {profileMenu}
            {hiddenFileInput}
          </div>
        </header>
        <main className="content">
          {adminView === 'org' && (
            <OrganisationManager
              organisation={organisation}
              onSave={saveOrg}
              onImportFromLatest={
                activeReportId && state ? () => orgFromTeams(state.teams).teams : null
              }
            />
          )}
          {adminView === 'roles' && (
            <RoleManager
              users={users}
              organisation={organisation}
              currentUsername={session.username}
              onSave={saveUser}
              onRemove={removeUser}
            />
          )}
        </main>
        {accountModal}
      </div>
    );
  }

  // ── Home: full-page dark screen, no sidebar ───────────────────────────────
  if (showArchive) {
    return (
      <div className="home">
        <header className="home-topbar">
          <div className="brand">
            <span className="brand-mark">MSR</span>
            <span className="brand-name">Status Reports</span>
          </div>
          <div className="topbar-actions">{profileMenu}</div>
        </header>
        <main className="home-main">
          <MsrArchive
            reports={reports}
            loading={reportsLoading}
            error={reportsError}
            isManager={isManager}
            activeReportId={activeReportId}
            busyId={busyId}
            presence={homePresence}
            tab={homeTab}
            onTabChange={setHomeTab}
            onOpen={openReport}
            onNew={newReport}
            onRefresh={loadReportList}
            onDownloadPptx={downloadReportPptx}
            onDownloadJson={downloadReportJson}
            onDuplicate={duplicate}
            onDelete={removeReport}
          />
        </main>
        {hiddenFileInput}
        {accountModal}
      </div>
    );
  }

  // ── Editor: light chrome with sidebar ─────────────────────────────────────
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">MSR</span>
          <span className="brand-name">Monthly Status Report</span>
        </div>
        <div className="topbar-actions">
          {saving && <span className="save-hint">Saving…</span>}
          {presenceBar}
          {profileMenu}
          {hiddenFileInput}
        </div>
      </header>

      <div className="layout">
        <nav className="sidebar">
          <button className="nav-item" onClick={goToArchive}>
            🏠 Home
          </button>

          {activeReportId && state && (
            <>
              <div className="nav-section">
                {state.report?.month || 'Report'}
              </div>
              <button
                className={`nav-item ${selected === 'settings' ? 'active' : ''}`}
                onClick={() => setSelected('settings')}
              >
                ⚙ Report Settings
              </button>
              {!isWsr && (
                <button
                  className={`nav-item ${selected === 'summary' ? 'active' : ''}`}
                  onClick={() => setSelected('summary')}
                >
                  ☰ Overall Summary
                </button>
              )}
              {isManager && (
                <button
                  className={`nav-item ${selected === 'users' ? 'active' : ''}`}
                  onClick={() => setSelected('users')}
                >
                  👤 Manage Users
                </button>
              )}

              {/* Squad nav button, shared by both report types. */}
              {(() => {
                const squadButton = (t, p, q) => (
                  <button
                    key={q.id}
                    className={`nav-item nav-squad ${selected === q.id ? 'active' : ''}`}
                    onClick={() => setSelected(q.id)}
                    title={q.saved ? 'Data saved' : 'Data not saved yet'}
                  >
                    <span className={`save-dot ${q.saved ? 'is-saved' : 'is-unsaved'}`} />
                    <span className="nav-squad-name">
                      {q.name || 'Untitled Squad'}
                      {mySquadIds.has(q.id) && <span className="nav-mine">you</span>}
                    </span>
                    {q.customSlides?.length > 0 && (
                      <span className="nav-pill">+{q.customSlides.length}</span>
                    )}
                  </button>
                );

                // WSR: projects → squads only (no team level).
                if (isWsr && wsrTeam) {
                  return (
                    <>
                      <div className="nav-section">Projects</div>
                      {wsrTeam.projects.map((p) => (
                        <div key={p.id} className="nav-project">
                          <button
                            className={`nav-item nav-project-name ${selected === p.id ? 'active' : ''}`}
                            onClick={() => setSelected(p.id)}
                          >
                            📁 {p.name || 'Untitled Project'}
                          </button>
                          <div className="nav-children">
                            {p.squads.map((q) => squadButton(wsrTeam, p, q))}
                            {isManager && (
                              <button className="nav-add nav-add-sm" onClick={() => addSquad(wsrTeam.id, p.id)}>
                                + Add Squad
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {isManager && (
                        <button className="nav-add" onClick={() => addProject(wsrTeam.id)}>
                          + Add Project
                        </button>
                      )}
                    </>
                  );
                }

                // MSR: teams → projects → squads.
                return (
                  <>
                    <div className="nav-section">Teams</div>
                    {teams.map((t) => (
                      <div key={t.id} className="nav-team">
                        <button
                          className={`nav-item nav-team-name ${selected === t.id ? 'active' : ''}`}
                          onClick={() => setSelected(t.id)}
                        >
                          👥 {t.name || 'Untitled Team'}
                        </button>
                        <div className="nav-children">
                          {t.projects.map((p) => (
                            <div key={p.id} className="nav-project">
                              <button
                                className={`nav-item nav-project-name ${selected === p.id ? 'active' : ''}`}
                                onClick={() => setSelected(p.id)}
                              >
                                📁 {p.name || 'Untitled Project'}
                              </button>
                              <div className="nav-children">
                                {p.squads.map((q) => squadButton(t, p, q))}
                                {isManager && (
                                  <button className="nav-add nav-add-sm" onClick={() => addSquad(t.id, p.id)}>
                                    + Add Squad
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {isManager && (
                            <button className="nav-add nav-add-sm" onClick={() => addProject(t.id)}>
                              + Add Project
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {isManager && (
                      <button className="nav-add" onClick={addTeam}>
                        + Add Team
                      </button>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </nav>

        <main className="content">
          {crumbs && (
                <nav className="crumbbar">
                  <button className="btn-secondary btn-sm" onClick={() => setSelected(backTarget)}>
                    ← Back
                  </button>
                  <ol className="crumbs">
                    {crumbs.map((c, i) => {
                      const isLast = i === crumbs.length - 1;
                      return (
                        <li key={i} className="crumb">
                          {!isLast && c.target != null ? (
                            <button className="crumb-link" onClick={() => setSelected(c.target)}>
                              {c.label}
                            </button>
                          ) : (
                            <span className="crumb-current">{c.label}</span>
                          )}
                          {!isLast && <span className="crumb-sep">›</span>}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              )}
              {isPending && (
                <div className="banner banner-view">
                  Your account is awaiting admin approval. You can view every report, but editing
                  unlocks once an admin approves your sign-up and assigns you a squad.
                </div>
              )}
              {squadNotFound && (
                <div className="banner banner-warn">
                  Your assigned squad “{session.squad}” was not found in this report, so you can’t
                  edit yet. Ask your manager to make sure a squad with that exact name exists.
                </div>
              )}
              {selected === 'settings' &&
                (isWsr ? (
                  <div className="view">
                    <h2>Report Settings</h2>
                    <div className="panel">
                      <div className="form-grid">
                        <label className="form-field">
                          <span>Report title</span>
                          <input
                            value={state.report.title || ''}
                            disabled={!isManager}
                            onChange={(e) => updateReportSettings({ title: e.target.value })}
                          />
                        </label>
                        <label className="form-field">
                          <span>Week ending / period</span>
                          <input
                            value={state.report.period || ''}
                            disabled={!isManager}
                            placeholder="e.g. 16th – 24th June 2026"
                            onChange={(e) => updateReportSettings({ period: e.target.value })}
                          />
                        </label>
                        <label className="form-field">
                          <span>Company</span>
                          <input
                            value={state.report.company || ''}
                            disabled={!isManager}
                            onChange={(e) => updateReportSettings({ company: e.target.value })}
                          />
                        </label>
                        <label className="form-field">
                          <span>Client</span>
                          <input
                            value={state.report.client || ''}
                            disabled={!isManager}
                            onChange={(e) => updateReportSettings({ client: e.target.value })}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <ReportSettings report={state.report} onChange={updateReportSettings} readOnly={!isManager} />
                ))}
              {selected === 'summary' && !isWsr && <SummaryView teams={teams} />}
              {selected === 'users' && isManager && (
                <UserManager
                  employees={users.filter((u) => u.role === 'employee')}
                  teams={teams}
                  onSave={saveUser}
                  onRemove={removeUser}
                />
              )}
              {selectedTeam && (
                <TeamView
                  key={selectedTeam.id}
                  team={selectedTeam}
                  readOnly={!isManager}
                  onBack={goBack}
                  backLabel={backLabel}
                  onChange={(patch) => updateTeam(selectedTeam.id, patch)}
                  onDelete={() => removeTeam(selectedTeam.id)}
                  onAddProject={() => addProject(selectedTeam.id)}
                  onSelect={setSelected}
                />
              )}
              {projectMatch && (
                <ProjectView
                  key={projectMatch.project.id}
                  project={projectMatch.project}
                  readOnly={!isManager}
                  onBack={goBack}
                  backLabel={backLabel}
                  onChange={(patch) =>
                    updateProject(projectMatch.team.id, projectMatch.project.id, patch)
                  }
                  onDelete={() => removeProject(projectMatch.team.id, projectMatch.project.id)}
                  onAddSquad={() => addSquad(projectMatch.team.id, projectMatch.project.id)}
                  onSelectSquad={setSelected}
                />
              )}
              {squadMatch &&
                (isWsr ? (
                  <WsrSquadEditor
                    key={squadMatch.squad.id}
                    squad={squadMatch.squad}
                    readOnly={!canEditSquad(squadMatch.squad.id)}
                    onBack={goBack}
                    backLabel={backLabel}
                    canDelete={isManager}
                    locks={locks}
                    me={session.username}
                    onAcquire={acquireSection}
                    onRelease={releaseSection}
                    onChange={(patch) =>
                      updateSquad(squadMatch.team.id, squadMatch.project.id, squadMatch.squad.id, patch)
                    }
                    onSave={() => saveSquad(squadMatch.team.id, squadMatch.project.id, squadMatch.squad.id)}
                    onDelete={() =>
                      removeSquad(squadMatch.team.id, squadMatch.project.id, squadMatch.squad.id)
                    }
                  />
                ) : (
                  <SquadEditor
                    key={squadMatch.squad.id}
                    squad={squadMatch.squad}
                    readOnly={!canEditSquad(squadMatch.squad.id)}
                    onBack={goBack}
                    backLabel={backLabel}
                    canDelete={isManager}
                    locks={locks}
                    me={session.username}
                    onAcquire={acquireSection}
                    onRelease={releaseSection}
                    onChange={(patch) =>
                      updateSquad(squadMatch.team.id, squadMatch.project.id, squadMatch.squad.id, patch)
                    }
                    onSave={() => saveSquad(squadMatch.team.id, squadMatch.project.id, squadMatch.squad.id)}
                    onDelete={() =>
                      removeSquad(squadMatch.team.id, squadMatch.project.id, squadMatch.squad.id)
                    }
                  />
                ))}
              {!selectedTeam &&
                !projectMatch &&
                !squadMatch &&
                !isWsr &&
                !['settings', 'summary', 'users'].includes(selected) && <SummaryView teams={teams} />}
        </main>
      </div>
      {accountModal}
    </div>
  );
}
