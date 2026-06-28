// API tests for the MSR archive. Point MSR_DB_FILE at an isolated temp database
// BEFORE requiring the app (db.js opens the file at import time), then exercise
// the CRUD surface with supertest.

const os = require('os');
const path = require('path');
const fs = require('fs');

const TMP_DB = path.join(os.tmpdir(), `msr-test-${Date.now()}.db`);
process.env.MSR_DB_FILE = TMP_DB;

const request = require('supertest');
const app = require('./server');
const resets = require('./resetStore');

const sampleData = (month = 'June 2026', title = 'Monthly Status Report') => ({
  report: { title, month, company: 'Everforth Quinnox' },
  teams: [{ id: 't1', name: 'Team 1', projects: [] }],
});

afterAll(() => {
  for (const ext of ['', '-wal', '-shm', '-journal']) {
    try {
      fs.unlinkSync(TMP_DB + ext);
    } catch {
      /* file may not exist */
    }
  }
});

describe('MSR archive API', () => {
  test('health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('starts with an empty list', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('rejects create without data', async () => {
    const res = await request(app).post('/api/reports').send({});
    expect(res.status).toBe(400);
  });

  test('full CRUD lifecycle', async () => {
    // Create
    const created = await request(app).post('/api/reports').send({ data: sampleData() });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    expect(created.body.month).toBe('June 2026');
    expect(created.body.createdAt).toBe(created.body.modifiedAt);
    const { id } = created.body;

    // List shows metadata only (no data blob)
    const list = await request(app).get('/api/reports');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(id);
    expect(list.body[0].data).toBeUndefined();

    // Read returns the full parsed document
    const got = await request(app).get(`/api/reports/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.data.report.month).toBe('June 2026');
    expect(got.body.data.teams).toHaveLength(1);

    // Update bumps modified_at and re-derives month/title from data
    await new Promise((r) => setTimeout(r, 5));
    const updated = await request(app)
      .put(`/api/reports/${id}`)
      .send({ data: sampleData('July 2026', 'Q3 Report') });
    expect(updated.status).toBe(200);
    expect(updated.body.month).toBe('July 2026');
    expect(updated.body.title).toBe('Q3 Report');
    expect(updated.body.createdAt).toBe(created.body.createdAt);
    expect(new Date(updated.body.modifiedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.body.modifiedAt).getTime()
    );

    // Delete
    const del = await request(app).delete(`/api/reports/${id}`);
    expect(del.status).toBe(204);
    const after = await request(app).get(`/api/reports/${id}`);
    expect(after.status).toBe(404);
  });

  test('duplicate creates an independent copy', async () => {
    const created = await request(app).post('/api/reports').send({ data: sampleData('Aug 2026') });
    const { id } = created.body;

    const dup = await request(app).post(`/api/reports/${id}/duplicate`);
    expect(dup.status).toBe(201);
    expect(dup.body.id).not.toBe(id);
    expect(dup.body.title).toMatch(/\(copy\)/);

    // Editing the copy must not touch the original
    await request(app).put(`/api/reports/${dup.body.id}`).send({ data: sampleData('Sept 2026') });
    const original = await request(app).get(`/api/reports/${id}`);
    expect(original.body.data.report.month).toBe('Aug 2026');
  });

  test('404s for unknown ids', async () => {
    expect((await request(app).get('/api/reports/nope')).status).toBe(404);
    expect((await request(app).put('/api/reports/nope').send({ data: sampleData() })).status).toBe(404);
    expect((await request(app).delete('/api/reports/nope')).status).toBe(404);
    expect((await request(app).post('/api/reports/nope/duplicate')).status).toBe(404);
  });
});

describe('Users API', () => {
  test('seeds default accounts (no passwords leaked)', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    const admin = res.body.find((u) => u.username === 'admin');
    expect(admin.role).toBe('admin');
    expect(admin.password).toBeUndefined();
    expect(res.body.find((u) => u.username === 'asha').role).toBe('manager');
  });

  test('login validates credentials', async () => {
    const ok = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(ok.status).toBe(200);
    expect(ok.body.role).toBe('admin');
    const bad = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  test('create, update role, and delete a user', async () => {
    const created = await request(app)
      .post('/api/users')
      .send({ username: 'newbie', password: 'pw', name: 'New Bie', role: 'employee', squads: ['Servicing Hub'] });
    expect(created.status).toBe(201);
    expect(created.body.role).toBe('employee');
    expect(created.body.squads).toEqual(['Servicing Hub']);

    // Duplicate username is rejected
    expect((await request(app).post('/api/users').send({ username: 'newbie', password: 'x', role: 'employee' })).status).toBe(400);

    // Promote to manager; blank password keeps the old one
    const promoted = await request(app)
      .put('/api/users/newbie')
      .send({ username: 'newbie', name: 'New Bie', role: 'manager', password: '' });
    expect(promoted.body.role).toBe('manager');
    expect((await request(app).post('/api/auth/login').send({ username: 'newbie', password: 'pw' })).status).toBe(200);

    const del = await request(app).delete('/api/users/newbie');
    expect(del.status).toBe(204);
    expect((await request(app).post('/api/auth/login').send({ username: 'newbie', password: 'pw' })).status).toBe(401);
  });
});

describe('Organisation API', () => {
  test('defaults to empty then persists a structure', async () => {
    const empty = await request(app).get('/api/organisation');
    expect(empty.status).toBe(200);
    expect(empty.body.teams).toEqual([]);

    const orgData = { teams: [{ id: 't1', name: 'Testing team', projects: [{ id: 'p1', name: 'Core banking', squads: [{ id: 's1', name: 'Servicing Hub' }] }] }] };
    const saved = await request(app).put('/api/organisation').send({ data: orgData });
    expect(saved.status).toBe(200);
    expect(saved.body.teams[0].name).toBe('Testing team');

    const got = await request(app).get('/api/organisation');
    expect(got.body.teams[0].projects[0].squads[0].name).toBe('Servicing Hub');
  });

  test('rejects an invalid organisation body', async () => {
    expect((await request(app).put('/api/organisation').send({})).status).toBe(400);
  });
});

describe('Account: change password + email', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/users')
      .send({ username: 'pwuser', password: 'orig123', name: 'PW User', role: 'employee', squads: ['Servicing Hub'] });
  });

  test('change-password rejects a wrong current password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ username: 'pwuser', currentPassword: 'nope', newPassword: 'brandnew1' });
    expect(res.status).toBe(400);
  });

  test('change-password enforces a minimum length', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ username: 'pwuser', currentPassword: 'orig123', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  test('change-password updates the password (old fails, new works)', async () => {
    const ok = await request(app)
      .post('/api/auth/change-password')
      .send({ username: 'pwuser', currentPassword: 'orig123', newPassword: 'brandnew1' });
    expect(ok.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ username: 'pwuser', password: 'orig123' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ username: 'pwuser', password: 'brandnew1' })).status).toBe(200);
  });

  test('account email can be set and is returned on login', async () => {
    const set = await request(app).put('/api/account/email').send({ username: 'pwuser', email: 'PW@Example.com' });
    expect(set.status).toBe(200);
    expect(set.body.email).toBe('pw@example.com'); // normalized to lowercase
    const login = await request(app).post('/api/auth/login').send({ username: 'pwuser', password: 'brandnew1' });
    expect(login.body.email).toBe('pw@example.com');
  });

  test('rejects an invalid email and a duplicate email', async () => {
    expect((await request(app).put('/api/account/email').send({ username: 'pwuser', email: 'not-an-email' })).status).toBe(400);
    await request(app)
      .post('/api/users')
      .send({ username: 'other', password: 'orig123', name: 'Other', role: 'manager' });
    const dup = await request(app).put('/api/account/email').send({ username: 'other', email: 'pw@example.com' });
    expect(dup.status).toBe(400);
  });
});

describe('Forgot / reset password', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/users')
      .send({ username: 'forgetful', password: 'orig123', name: 'For Getful', email: 'forgetful@example.com', role: 'manager' });
  });

  test('forgot-password always returns a generic 200 (no enumeration)', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'forgetful@example.com' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });

  test('reset-password rejects an invalid token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'bogus', newPassword: 'freshpass1' });
    expect(res.status).toBe(400);
  });

  test('reset-password with a valid token sets the new password', async () => {
    const { token } = await resets.createToken('forgetful');
    const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'freshpass1' });
    expect(res.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ username: 'forgetful', password: 'freshpass1' })).status).toBe(200);
    // Token is single-use.
    const reuse = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'another12' });
    expect(reuse.status).toBe(400);
  });
});

describe('Collaboration: section saves, presence, locks', () => {
  // A report with two squads so we can prove section-scoped, non-clobbering saves.
  const collabData = () => ({
    report: { title: 'Collab', month: 'June 2026', company: 'Q' },
    teams: [
      {
        id: 't1',
        name: 'Team 1',
        projects: [
          {
            id: 'p1',
            name: 'Proj 1',
            squads: [
              { id: 's1', name: 'Squad A', defects: [], deliverables: ['x'] },
              { id: 's2', name: 'Squad B', defects: [] },
            ],
          },
        ],
      },
    ],
  });

  let reportId;
  beforeAll(async () => {
    const res = await request(app).post('/api/reports').send({ data: collabData(), modifiedBy: 'admin' });
    reportId = res.body.id;
  });

  test('records modifiedBy and resolves the display name on list/get', async () => {
    const got = await request(app).get(`/api/reports/${reportId}`);
    expect(got.body.modifiedBy).toBe('admin');
    expect(got.body.modifiedByName).toBe('Admin'); // resolved via users JOIN
    const list = await request(app).get('/api/reports');
    expect(list.body.find((r) => r.id === reportId).modifiedByName).toBe('Admin');
  });

  test('PATCH squad merges only that section, leaving others intact', async () => {
    // Two independent section patches to the SAME squad must both survive.
    await request(app)
      .patch(`/api/reports/${reportId}/squad/s1`)
      .send({ patch: { defects: [{ severity: 'High', open: 2 }] }, modifiedBy: 'asha' });
    await request(app)
      .patch(`/api/reports/${reportId}/squad/s1`)
      .send({ patch: { deliverables: ['done thing'] }, modifiedBy: 'asha' });

    const got = await request(app).get(`/api/reports/${reportId}`);
    const s1 = got.body.data.teams[0].projects[0].squads[0];
    expect(s1.defects).toEqual([{ severity: 'High', open: 2 }]);
    expect(s1.deliverables).toEqual(['done thing']); // first patch not clobbered
    expect(got.body.modifiedBy).toBe('asha');
    // The other squad is untouched.
    expect(got.body.data.teams[0].projects[0].squads[1].name).toBe('Squad B');
  });

  test('PATCH structure renames/adds squads but preserves section data', async () => {
    // Seed some section data on s1 first.
    await request(app)
      .patch(`/api/reports/${reportId}/squad/s1`)
      .send({ patch: { deliverables: ['keep me'] } });

    // Rename s1, add a new squad s3, change report meta — all via structure.
    const got = await request(app).get(`/api/reports/${reportId}`);
    const teams = got.body.data.teams;
    teams[0].projects[0].squads[0].name = 'Squad A renamed';
    teams[0].projects[0].squads.push({ id: 's3', name: 'Squad C', defects: [] });

    const res = await request(app)
      .patch(`/api/reports/${reportId}/structure`)
      .send({ report: { title: 'Collab v2' }, teams, modifiedBy: 'admin' });
    expect(res.status).toBe(200);

    const after = await request(app).get(`/api/reports/${reportId}`);
    const squads = after.body.data.teams[0].projects[0].squads;
    expect(squads[0].name).toBe('Squad A renamed');
    expect(squads[0].deliverables).toEqual(['keep me']); // section data preserved
    expect(squads.find((s) => s.id === 's3')).toBeTruthy(); // new squad added
    expect(after.body.title).toBe('Collab v2'); // report meta applied
  });

  test('PATCH squad 404s for an unknown squad', async () => {
    const res = await request(app)
      .patch(`/api/reports/${reportId}/squad/nope`)
      .send({ patch: { name: 'x' } });
    expect(res.status).toBe(404);
  });

  test('presence heartbeat returns who is here + locks + meta', async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/presence`)
      .send({ username: 'asha', name: 'Asha Rao' });
    expect(res.status).toBe(200);
    expect(res.body.presence.find((u) => u.username === 'asha').name).toBe('Asha Rao');
    expect(res.body.meta.id).toBe(reportId);
    expect(res.body.meta.modifiedAt).toBeTruthy();
  });

  test('section lock is exclusive, then releasable', async () => {
    const a = await request(app)
      .post(`/api/reports/${reportId}/lock`)
      .send({ username: 'asha', name: 'Asha Rao', section: 's1:defects' });
    expect(a.status).toBe(200);
    expect(a.body.ok).toBe(true);

    // Someone else can't take the same section.
    const b = await request(app)
      .post(`/api/reports/${reportId}/lock`)
      .send({ username: 'test1', name: 'Test One', section: 's1:defects' });
    expect(b.status).toBe(409);
    expect(b.body.owner.username).toBe('asha');

    // But a different section of the same squad is free.
    const c = await request(app)
      .post(`/api/reports/${reportId}/lock`)
      .send({ username: 'test1', name: 'Test One', section: 's1:deliverables' });
    expect(c.status).toBe(200);

    // After asha releases, test1 can take it.
    await request(app).delete(`/api/reports/${reportId}/lock`).send({ username: 'asha', section: 's1:defects' });
    const d = await request(app)
      .post(`/api/reports/${reportId}/lock`)
      .send({ username: 'test1', name: 'Test One', section: 's1:defects' });
    expect(d.status).toBe(200);
  });

  test('home summary lists reports with active users, and leave clears it', async () => {
    await request(app).post(`/api/reports/${reportId}/presence`).send({ username: 'asha', name: 'Asha Rao' });
    const summary = await request(app).get('/api/presence');
    expect(summary.body[reportId]).toBeTruthy();

    await request(app).post(`/api/reports/${reportId}/leave`).send({ username: 'asha' });
    await request(app).post(`/api/reports/${reportId}/leave`).send({ username: 'test1' });
    const after = await request(app).get('/api/presence');
    expect(after.body[reportId]).toBeUndefined();
  });
});
