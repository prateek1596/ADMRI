-- ADMRI Database Schema
-- Run: psql -U admri_user -d admri_db -f schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── DOCTORS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150)  NOT NULL,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  specialty       VARCHAR(100)  NOT NULL,
  license_number  VARCHAR(50)   NOT NULL UNIQUE,
  role            VARCHAR(20)   NOT NULL DEFAULT 'doctor'
                    CHECK (role IN ('doctor', 'admin', 'supervisor')),
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_email ON doctors(email);

-- ── REFRESH TOKENS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGSERIAL    PRIMARY KEY,
  token       TEXT         NOT NULL UNIQUE,
  doctor_id   UUID         NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_doctor ON refresh_tokens(doctor_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ── PATIENTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id            UUID         NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name                 VARCHAR(150) NOT NULL,
  age                  SMALLINT     NOT NULL CHECK (age BETWEEN 4 AND 25),
  gender               VARCHAR(30)  NOT NULL,
  diagnosis            VARCHAR(255),
  guardian             VARCHAR(150),
  contact              VARCHAR(50),
  notes                TEXT,
  latest_score         SMALLINT     CHECK (latest_score BETWEEN 0 AND 100),
  risk_level           VARCHAR(20)  CHECK (risk_level IN ('Minimal','Mild','Moderate','High','Severe')),
  risk_history         INTEGER[]    NOT NULL DEFAULT '{}',
  last_assessment_at   TIMESTAMPTZ,
  join_date            DATE         NOT NULL DEFAULT CURRENT_DATE,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_doctor    ON patients(doctor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_score     ON patients(latest_score) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_name      ON patients(name) WHERE deleted_at IS NULL;

-- ── ASSESSMENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessments (
  id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admri_score          NUMERIC(5,2) NOT NULL CHECK (admri_score BETWEEN 0 AND 100),
  adaptive_score       NUMERIC(5,2) CHECK (adaptive_score BETWEEN 0 AND 100),
  risk_level           VARCHAR(20)  NOT NULL
                         CHECK (risk_level IN ('Minimal','Mild','Moderate','High','Severe')),

  -- Sub-scores
  quest_score          NUMERIC(5,2) CHECK (quest_score BETWEEN 0 AND 100),
  sentiment_score      NUMERIC(5,2) CHECK (sentiment_score BETWEEN 0 AND 100),
  behavioural_score    NUMERIC(5,2) CHECK (behavioural_score BETWEEN 0 AND 100),

  -- Confidence intervals (Monte Carlo Dropout)
  confidence_mean      NUMERIC(5,2),
  confidence_lower     NUMERIC(5,2),
  confidence_upper     NUMERIC(5,2),
  confidence_label     VARCHAR(20)  CHECK (confidence_label IN ('High','Moderate','Low')),

  -- Full snapshot (JSON blobs)
  journal_text         TEXT,
  quest_answers        JSONB,
  behavioral_data      JSONB,
  domain_profile       JSONB,
  forecast             JSONB,
  model_scores         JSONB,

  -- NLP
  crisis_flags         JSONB,
  dominant_emotion     VARCHAR(50),

  -- Anomaly detection
  anomaly_detected     BOOLEAN      NOT NULL DEFAULT false,
  anomaly_delta        NUMERIC(6,2) DEFAULT 0,
  anomaly_z_score      NUMERIC(6,2) DEFAULT 0,

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_patient  ON assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created  ON assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_score    ON assessments(admri_score);
CREATE INDEX IF NOT EXISTS idx_assessments_anomaly  ON assessments(anomaly_detected) WHERE anomaly_detected = true;

-- ── NOTES ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id   UUID         NOT NULL REFERENCES doctors(id)  ON DELETE CASCADE,
  content     TEXT         NOT NULL,
  type        VARCHAR(30)  NOT NULL
                CHECK (type IN ('Session','Check-in','Crisis','Family Meeting','Progress','Discharge')),
  mood        VARCHAR(30)
                CHECK (mood IN ('Positive','Neutral','Anxious','Depressed','Agitated','Calm','Mixed')),
  tags        JSONB        NOT NULL DEFAULT '[]',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_patient   ON notes(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_doctor    ON notes(doctor_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_type      ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_created   ON notes(created_at DESC);

-- Full-text search on notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_notes_search ON notes USING GIN(search_vector);

-- ── ALERT LOGS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_logs (
  id              BIGSERIAL    PRIMARY KEY,
  patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id       UUID         NOT NULL REFERENCES doctors(id)  ON DELETE CASCADE,
  assessment_id   UUID         REFERENCES assessments(id) ON DELETE SET NULL,
  previous_score  SMALLINT,
  new_score       SMALLINT,
  delta           NUMERIC(6,2),
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_doctor  ON alert_logs(doctor_id);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alert_logs(patient_id);

-- ── AUDIT LOGS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGSERIAL    PRIMARY KEY,
  doctor_id    UUID         REFERENCES doctors(id) ON DELETE SET NULL,
  action       VARCHAR(100) NOT NULL,
  resource     VARCHAR(100),
  resource_id  UUID,
  ip_address   INET,
  user_agent   VARCHAR(255),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_doctor  ON audit_logs(doctor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Auto-cleanup old audit logs after 1 year (run as cron or pg_cron)
-- DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
