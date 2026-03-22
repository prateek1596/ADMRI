// tests/auth.test.js
require('dotenv').config({ path: '.env.test' });
const request = require('supertest');
const app     = require('../src/server');
const { query, pool } = require('../src/config/db');

const TEST_DOCTOR = {
  name:           'Dr. Test User',
  email:          `test.${Date.now()}@admri.test`,
  password:       'TestPass123',
  specialty:      'Child Psychiatry',
  license_number: `TEST-${Date.now()}`,
};

let accessToken  = '';
let refreshToken = '';
let doctorId     = '';

afterAll(async () => {
  // Cleanup
  await query('DELETE FROM doctors WHERE email = $1', [TEST_DOCTOR.email]).catch(() => {});
  await pool.end();
});

// ── REGISTER ──────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('registers a new doctor', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(TEST_DOCTOR)
      .expect(201);

    expect(res.body.doctor).toMatchObject({
      name:     TEST_DOCTOR.name,
      email:    TEST_DOCTOR.email,
      specialty: TEST_DOCTOR.specialty,
    });
    expect(res.body.tokens.access).toBeTruthy();
    expect(res.body.tokens.refresh).toBeTruthy();

    accessToken  = res.body.tokens.access;
    refreshToken = res.body.tokens.refresh;
    doctorId     = res.body.doctor.id;
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send(TEST_DOCTOR)
      .expect(409);
  });

  it('rejects weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...TEST_DOCTOR, email: 'other@test.com', password: 'weak' })
      .expect(400);
    expect(res.body.fields).toBeDefined();
  });
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_DOCTOR.email, password: TEST_DOCTOR.password })
      .expect(200);

    expect(res.body.tokens.access).toBeTruthy();
    accessToken  = res.body.tokens.access;
    refreshToken = res.body.tokens.refresh;
  });

  it('rejects wrong password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_DOCTOR.email, password: 'WrongPass999' })
      .expect(401);
  });

  it('rejects unknown email', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@admri.test', password: 'TestPass123' })
      .expect(401);
  });
});

// ── GET ME ────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns doctor profile with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.doctor.id).toBe(doctorId);
    expect(res.body.doctor.password_hash).toBeUndefined();
  });

  it('rejects request without token', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  it('rejects invalid token', async () => {
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123')
      .expect(401);
  });
});

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  it('issues new tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);

    expect(res.body.tokens.access).toBeTruthy();
    accessToken  = res.body.tokens.access;
    refreshToken = res.body.tokens.refresh;
  });

  it('rejects reused refresh token', async () => {
    const old = refreshToken;
    await request(app).post('/api/auth/refresh').send({ refresh_token: old });
    await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: old })
      .expect(401);
  });
});

// ── PATIENTS ──────────────────────────────────────────────────────────────────
describe('Patients CRUD', () => {
  let patientId = '';

  const NEW_PATIENT = {
    name:      'Test Patient',
    age:       12,
    gender:    'Male',
    diagnosis: 'Generalised Anxiety Disorder',
    guardian:  'Parent Name',
    contact:   '9999999999',
  };

  it('creates a patient', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(NEW_PATIENT)
      .expect(201);

    expect(res.body.patient.name).toBe(NEW_PATIENT.name);
    expect(res.body.patient.doctor_id).toBe(doctorId);
    patientId = res.body.patient.id;
  });

  it('lists patients', async () => {
    const res = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.patients.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('gets single patient', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.patient.id).toBe(patientId);
  });

  it('updates patient', async () => {
    const res = await request(app)
      .patch(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ diagnosis: 'Updated Diagnosis' })
      .expect(200);
    expect(res.body.patient.diagnosis).toBe('Updated Diagnosis');
  });

  it('creates an assessment and detects first-time (no anomaly)', async () => {
    const res = await request(app)
      .post(`/api/patients/${patientId}/assessments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        admri_score:      45,
        risk_level:       'Moderate',
        quest_score:      42,
        sentiment_score:  55,
        behavioural_score:38,
        confidence_label: 'High',
        journal_text:     'Feeling a bit anxious about school.',
      })
      .expect(201);

    expect(res.body.assessment.admri_score).toBe('45.00');
    expect(res.body.assessment.anomaly_detected).toBe(false);
  });

  it('detects a risk spike on second assessment', async () => {
    const res = await request(app)
      .post(`/api/patients/${patientId}/assessments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        admri_score:  72,
        risk_level:   'High',
        journal_text: 'Everything feels very overwhelming.',
      })
      .expect(201);

    expect(res.body.assessment.anomaly_detected).toBe(true);
    expect(parseFloat(res.body.assessment.anomaly_delta)).toBeGreaterThan(14);
  });

  it('lists assessments', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}/assessments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.assessments.length).toBe(2);
  });

  it('creates a note', async () => {
    const res = await request(app)
      .post(`/api/patients/${patientId}/notes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Patient showed good engagement today.', type: 'Session', mood: 'Positive', tags: ['CBT', 'progress'] })
      .expect(201);
    expect(res.body.note.type).toBe('Session');
  });

  it('blocks access to another doctor\'s patient', async () => {
    // Register second doctor
    const d2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dr. Second', email: `second.${Date.now()}@test.com`,
        password: 'TestPass123', specialty: 'Psychology',
        license_number: `SEC-${Date.now()}`,
      });
    const token2 = d2.body.tokens.access;

    await request(app)
      .get(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    // Cleanup second doctor
    await query('DELETE FROM doctors WHERE email = $1', [d2.body.doctor.email]).catch(() => {});
  });

  it('soft-deletes patient', async () => {
    await request(app)
      .delete(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .get(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });
});
