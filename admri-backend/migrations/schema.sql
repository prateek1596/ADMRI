-- migrations/schema_v2.sql
-- Run: psql -U admri_user -d admri_db -f migrations/schema_v2.sql

-- ── SCHEDULED SESSIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_sessions (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id       UUID         NOT NULL REFERENCES doctors(id)  ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ  NOT NULL,
  session_type    VARCHAR(50)  NOT NULL DEFAULT 'Assessment'
                    CHECK (session_type IN ('Assessment','Check-in','Review','Crisis','Family Meeting')),
  notes           TEXT,
  reminder_sent   BOOLEAN      NOT NULL DEFAULT false,
  status          VARCHAR(20)  NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming','completed','cancelled','missed')),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_patient   ON scheduled_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_doctor    ON scheduled_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled ON scheduled_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status    ON scheduled_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_reminder  ON scheduled_sessions(reminder_sent, scheduled_at)
  WHERE status = 'upcoming' AND reminder_sent = false;

-- ── TREATMENT PLAN GOALS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS treatment_goals (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id       UUID         NOT NULL REFERENCES doctors(id)  ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50)  NOT NULL
                    CHECK (category IN ('Risk Score','PHQ-9','GAD-7','Sleep','Social','Behavioural','Custom')),
  target_value    NUMERIC(6,2),
  baseline_value  NUMERIC(6,2),
  current_value   NUMERIC(6,2),
  target_date     DATE,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','achieved','paused','revised','discontinued')),
  priority        SMALLINT     NOT NULL DEFAULT 2
                    CHECK (priority IN (1,2,3)),   -- 1=high, 2=medium, 3=low
  milestones      JSONB        NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_patient ON treatment_goals(patient_id);
CREATE INDEX IF NOT EXISTS idx_goals_status  ON treatment_goals(status);

-- ── GOAL PROGRESS LOG ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_progress (
  id          BIGSERIAL    PRIMARY KEY,
  goal_id     UUID         NOT NULL REFERENCES treatment_goals(id) ON DELETE CASCADE,
  value       NUMERIC(6,2) NOT NULL,
  note        TEXT,
  recorded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress(goal_id);

-- ── SHAP SCORES (cached per assessment) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS shap_scores (
  id              BIGSERIAL    PRIMARY KEY,
  assessment_id   UUID         NOT NULL REFERENCES assessments(id) ON DELETE CASCADE UNIQUE,
  patient_id      UUID         NOT NULL REFERENCES patients(id)    ON DELETE CASCADE,
  feature_scores  JSONB        NOT NULL,  -- { "sleep_hours": 12.4, "phq9": 18.2, ... }
  base_value      NUMERIC(6,2),
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shap_assessment ON shap_scores(assessment_id);
CREATE INDEX IF NOT EXISTS idx_shap_patient    ON shap_scores(patient_id);

-- Updated_at trigger for new tables
DO $$ BEGIN
  CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON scheduled_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_goals_updated_at
    BEFORE UPDATE ON treatment_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
