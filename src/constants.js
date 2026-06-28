export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

// Coerce form values (which may be strings or empty) to numbers
export const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

// A feature's manual execution is captured per environment: Test and Preprod
// each get their own Pass / Fail / Blocked counts, alongside the shared
// User Stories / Designed / Executed totals.
export const makeFeature = (name = '') => ({
  id: uid(),
  name,
  userStories: 0,
  designed: 0,
  executed: 0,
  testPass: 0,
  testFail: 0,
  testBlocked: 0,
  preprodPass: 0,
  preprodFail: 0,
  preprodBlocked: 0,
});

export const makeDefectRows = () =>
  SEVERITIES.map((severity) => ({ severity, open: 0, closed: 0, blocked: 0 }));

// An automation-execution row. Completion % is computed (Pass / Executed), not
// stored, so it can't drift out of sync with the counts.
export const makeAutoFeature = (name = '') => ({
  id: uid(),
  name,
  total: 0,
  designed: 0,
  executed: 0,
  rework: 0,
  reworkInProgress: 0,
  reworkCompleted: 0,
  pass: 0,
  fail: 0,
  blocked: 0,
});

export const makeAutomation = () => ({ features: [makeAutoFeature()], highlights: [''] });

export const makeCustomSlide = () => ({ id: uid(), title: 'Custom Slide', body: '' });

export const makeSquad = (name = 'New Squad') => ({
  id: uid(),
  name,
  features: [makeFeature()],
  defects: makeDefectRows(),
  jiraDefects: 0,
  jiraObservations: 0,
  // Preprod execution and Automation metrics are optional per squad — not every
  // squad runs a Preprod cycle or maintains an automation pack.
  hasPreprod: false,
  hasAutomation: false,
  automation: makeAutomation(),
  deliverables: [''],
  nextPlan: [''],
  challenges: [],
  customSlides: [],
  // Whether the squad owner has saved/submitted this month's data. New squads
  // start unsaved; the manager export is gated on every squad being saved.
  saved: false,
});

export const makeProject = (name = 'New Project') => ({
  id: uid(),
  name,
  squads: [makeSquad('Squad 1')],
});

export const makeTeam = (name = 'New Team') => ({
  id: uid(),
  name,
  projects: [makeProject('Project 1')],
});

export const EXEC_TOTALS_ZERO = {
  userStories: 0,
  designed: 0,
  executed: 0,
  testPass: 0,
  testFail: 0,
  testBlocked: 0,
  preprodPass: 0,
  preprodFail: 0,
  preprodBlocked: 0,
};

export const executionTotals = (features) =>
  features.reduce(
    (a, f) => ({
      userStories: a.userStories + n(f.userStories),
      designed: a.designed + n(f.designed),
      executed: a.executed + n(f.executed),
      testPass: a.testPass + n(f.testPass),
      testFail: a.testFail + n(f.testFail),
      testBlocked: a.testBlocked + n(f.testBlocked),
      preprodPass: a.preprodPass + n(f.preprodPass),
      preprodFail: a.preprodFail + n(f.preprodFail),
      preprodBlocked: a.preprodBlocked + n(f.preprodBlocked),
    }),
    { ...EXEC_TOTALS_ZERO }
  );

export const AUTO_TOTALS_ZERO = {
  total: 0,
  designed: 0,
  executed: 0,
  rework: 0,
  reworkInProgress: 0,
  reworkCompleted: 0,
  pass: 0,
  fail: 0,
  blocked: 0,
};

// Completion % for an automation row/total: share of executed scripts that passed.
export const completionPct = (pass, executed) =>
  n(executed) ? Math.round((n(pass) / n(executed)) * 100) : 0;

export const automationTotals = (features) =>
  (features || []).reduce(
    (a, f) => ({
      total: a.total + n(f.total),
      designed: a.designed + n(f.designed),
      executed: a.executed + n(f.executed),
      rework: a.rework + n(f.rework),
      reworkInProgress: a.reworkInProgress + n(f.reworkInProgress),
      reworkCompleted: a.reworkCompleted + n(f.reworkCompleted),
      pass: a.pass + n(f.pass),
      fail: a.fail + n(f.fail),
      blocked: a.blocked + n(f.blocked),
    }),
    { ...AUTO_TOTALS_ZERO }
  );

export const defectTotals = (rows) => {
  const t = rows.reduce(
    (a, r) => ({
      open: a.open + n(r.open),
      closed: a.closed + n(r.closed),
      blocked: a.blocked + n(r.blocked),
    }),
    { open: 0, closed: 0, blocked: 0 }
  );
  return { ...t, total: t.open + t.closed + t.blocked };
};

export const squadRow = (q) => ({
  id: q.id,
  name: q.name,
  hasPreprod: !!q.hasPreprod,
  exec: executionTotals(q.features),
  def: defectTotals(q.defects),
});

export const sumRows = (rows) =>
  rows.reduce(
    (a, r) => ({
      userStories: a.userStories + r.exec.userStories,
      designed: a.designed + r.exec.designed,
      executed: a.executed + r.exec.executed,
      testPass: a.testPass + r.exec.testPass,
      testFail: a.testFail + r.exec.testFail,
      testBlocked: a.testBlocked + r.exec.testBlocked,
      preprodPass: a.preprodPass + r.exec.preprodPass,
      preprodFail: a.preprodFail + r.exec.preprodFail,
      preprodBlocked: a.preprodBlocked + r.exec.preprodBlocked,
      open: a.open + r.def.open,
      closed: a.closed + r.def.closed,
      dblocked: a.dblocked + r.def.blocked,
      total: a.total + r.def.total,
    }),
    { ...EXEC_TOTALS_ZERO, open: 0, closed: 0, dblocked: 0, total: 0 }
  );

const sampleSquad = () => {
  const squad = makeSquad('Core Banking- Servicing Hub');
  squad.features = [
    {
      ...makeFeature('Structured Lending-Rate & Payments stream'),
      userStories: 4, designed: 20, executed: 20,
      testPass: 20, testFail: 0, testBlocked: 0,
      preprodPass: 0, preprodFail: 0, preprodBlocked: 0,
    },
    {
      ...makeFeature('BTL-Cancel arrears & Alerts'),
      userStories: 4, designed: 15, executed: 15,
      testPass: 15, testFail: 0, testBlocked: 0,
      preprodPass: 15, preprodFail: 0, preprodBlocked: 0,
    },
  ];
  squad.defects = squad.defects.map((r) =>
    r.severity === 'High' ? { ...r, closed: 1 }
      : r.severity === 'Medium' ? { ...r, closed: 3 }
      : r.severity === 'Low' ? { ...r, closed: 1 }
      : r
  );
  squad.jiraDefects = 5;
  squad.jiraObservations = 0;
  squad.hasPreprod = true;
  squad.hasAutomation = true;
  squad.automation = {
    features: [
      { ...makeAutoFeature('Structured Lending-Rate & Payments stream'), total: 20, designed: 20, executed: 20, pass: 20 },
      { ...makeAutoFeature('BTL-Cancel arrears & Alerts'), total: 15, designed: 15, executed: 15, pass: 15 },
      { ...makeAutoFeature('Regression'), total: 20, designed: 2, executed: 40, rework: 2, reworkCompleted: 2, pass: 40 },
    ],
    highlights: [
      '2 new Regression flows have been created, and 2 flows have been refactored in postman for features Alerts, Cancel arrears.',
      '24 manual hours has been saved this month by executing the whole Regression pack.',
    ],
  };
  squad.deliverables = [
    'Regression done on redemption statement flow.',
    'Performed E2E on Unsolicited payments with other squads for Prod release.',
    'Performed E2E on Redemption statement flow with other squads for Prod release.',
    'Cross-squad testing done on Cancel arrears balance in TEST environment.',
  ];
  squad.nextPlan = [
    'Change re-payment date functionality is planned for next release. Need to do E2E and Regression.',
    'Adding in-sprint automation scripts - Redemption and Unsolicited payments.',
  ];
  squad.saved = true; // sample squad ships with complete data
  return squad;
};

// Flattens the team → project → squad tree into one row per squad, each
// labelled with its full path. Used for the employee squad picker and the
// manager's "unsaved squads" export gate.
export const allSquads = (teams) => {
  const out = [];
  for (const t of teams)
    for (const p of t.projects)
      for (const q of p.squads)
        out.push({ team: t, project: p, squad: q, path: `${t.name} / ${p.name} / ${q.name}` });
  return out;
};

export const unsavedSquads = (teams) => allSquads(teams).filter(({ squad }) => !squad.saved);

// Forgiving name match (trim + case-insensitive) so an employee's assigned
// squad in users.js still resolves despite minor spacing/casing differences.
export const normalizeName = (s) => String(s || '').trim().toLowerCase();

export const findSquadByName = (teams, name) => {
  const target = normalizeName(name);
  if (!target) return null;
  return allSquads(teams).find(({ squad }) => normalizeName(squad.name) === target) || null;
};

// Resolves an employee's squad references (each a squad id or a squad name)
// to the set of live squad ids, so access survives renames and seed-by-name.
export const resolveSquadIds = (teams, refs) => {
  const all = allSquads(teams);
  const ids = new Set(all.map(({ squad }) => squad.id));
  const out = new Set();
  for (const ref of refs || []) {
    if (ids.has(ref)) out.add(ref);
    else {
      const match = all.find(({ squad }) => normalizeName(squad.name) === normalizeName(ref));
      if (match) out.add(match.squad.id);
    }
  }
  return out;
};

export const makeInitialState = () => ({
  report: {
    title: 'Monthly Status Report',
    subtitle: 'QA Status across projects',
    month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    company: 'Everforth Quinnox',
    client: 'Shawbrook',
  },
  teams: [
    {
      id: uid(),
      name: 'Team 1',
      projects: [
        {
          id: uid(),
          name: 'Customers Platform',
          squads: [sampleSquad()],
        },
      ],
    },
  ],
});

// Blank report meta (no sample squad), with the current month label.
export const makeBlankReportMeta = () => ({
  title: 'Monthly Status Report',
  subtitle: 'QA Status across projects',
  month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  company: 'Everforth Quinnox',
  client: 'Shawbrook',
});

// Builds a fresh report from the central organisation structure: the Team /
// Project / Squad *names* are carried over, but every squad starts with zeroed
// execution / defect / automation data (makeSquad already emits blanks). When the
// org is empty, falls back to a single blank team/project/squad.
export const blankReportFromOrg = (org) => {
  const orgTeams = org?.teams || [];
  if (orgTeams.length === 0) {
    return { report: makeBlankReportMeta(), teams: [makeTeam('Team 1')] };
  }
  const teams = orgTeams.map((t) => ({
    id: uid(),
    name: t.name || 'Untitled Team',
    projects: (t.projects || []).map((p) => ({
      id: uid(),
      name: p.name || 'Untitled Project',
      squads: (p.squads || []).map((q) => makeSquad(q.name || 'Untitled Squad')),
    })),
  }));
  return { report: makeBlankReportMeta(), teams };
};

// Reduces any report's team tree to the org structure (names only), used to seed
// the central organisation from an existing report.
export const orgFromTeams = (teams) => ({
  teams: (teams || []).map((t) => ({
    id: uid(),
    name: t.name || '',
    projects: (t.projects || []).map((p) => ({
      id: uid(),
      name: p.name || '',
      squads: (p.squads || []).map((q) => ({ id: uid(), name: q.name || '' })),
    })),
  })),
});

// Squads previously had a free-text `notes` field; pull the counts out of it
// so saved data keeps its numbers when upgrading to the two count fields.
const noteCount = (notes, re) => {
  const m = (notes || '').match(re);
  return m ? Number(m[1]) : 0;
};

// Features once had a single Pass/Fail/Blocked set (no environment split and no
// User Stories). Map those onto the Test environment so older reports keep their
// numbers when upgraded to the per-environment shape.
const normalizeFeature = (f) => {
  if (f && f.testPass !== undefined && f.userStories !== undefined) return f;
  const { pass, fail, blocked, ...rest } = f || {};
  return {
    ...rest,
    userStories: f?.userStories ?? 0,
    testPass: f?.testPass ?? pass ?? 0,
    testFail: f?.testFail ?? fail ?? 0,
    testBlocked: f?.testBlocked ?? blocked ?? 0,
    preprodPass: f?.preprodPass ?? 0,
    preprodFail: f?.preprodFail ?? 0,
    preprodBlocked: f?.preprodBlocked ?? 0,
  };
};

const normalizeAutoFeature = (f) => ({ ...makeAutoFeature(), ...f, id: f?.id || uid() });

const normalizeAutomation = (a) => ({
  features: (a?.features?.length ? a.features : [makeAutoFeature()]).map(normalizeAutoFeature),
  highlights: a?.highlights?.length ? a.highlights : [''],
});

const normalizeSquad = (q) => {
  let sq = q;
  if (q.jiraDefects === undefined || q.jiraObservations === undefined) {
    const { notes, ...rest } = q;
    sq = {
      ...rest,
      jiraDefects: noteCount(notes, /defects[^\d]*(\d+)/i),
      jiraObservations: noteCount(notes, /observations[^\d]*(\d+)/i),
    };
  }
  const features = (sq.features || []).map(normalizeFeature);
  // Older data has no Preprod/Automation flags. Default Preprod on only if any
  // feature actually carries Preprod numbers; Automation stays off unless a
  // saved automation pack already has data.
  const automation = normalizeAutomation(sq.automation);
  const autoHasData = automation.features.some((f) =>
    ['total', 'designed', 'executed', 'pass', 'fail', 'rework', 'reworkInProgress', 'reworkCompleted', 'blocked']
      .some((k) => n(f[k]) > 0)
  );
  // Squads saved before this field existed are treated as already saved, so
  // loading older data doesn't suddenly block the manager's export.
  return {
    ...sq,
    features,
    hasPreprod:
      sq.hasPreprod ??
      features.some((f) => n(f.preprodPass) + n(f.preprodFail) + n(f.preprodBlocked) > 0),
    hasAutomation: sq.hasAutomation ?? autoHasData,
    automation,
    saved: sq.saved ?? true,
  };
};

const normalizeProject = (p) => ({ ...p, squads: p.squads.map(normalizeSquad) });

// Accepts the current state ({ report, teams }) or either legacy shape —
// ({ report, projects }) or the original ({ project, squads }) — and returns
// the current shape, or null if it is none of them.
export const migrateState = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.report && Array.isArray(parsed.teams)) {
    return {
      ...parsed,
      teams: parsed.teams.map((t) => ({ ...t, projects: t.projects.map(normalizeProject) })),
    };
  }
  if (parsed.report && Array.isArray(parsed.projects)) {
    return {
      report: parsed.report,
      teams: [{ id: uid(), name: 'Team 1', projects: parsed.projects.map(normalizeProject) }],
    };
  }
  if (parsed.project && Array.isArray(parsed.squads)) {
    const { title, subtitle, month, company, client } = parsed.project;
    return {
      report: {
        title: 'Monthly Status Report',
        subtitle: subtitle || 'QA Status across projects',
        month: month || '',
        company: company || '',
        client: client || '',
      },
      teams: [
        {
          id: uid(),
          name: 'Team 1',
          projects: [{ id: uid(), name: title || 'Project 1', squads: parsed.squads.map(normalizeSquad) }],
        },
      ],
    };
  }
  return null;
};
