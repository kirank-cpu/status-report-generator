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
