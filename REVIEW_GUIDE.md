# ADMRI App - Review Guide

**Project:** Adaptive Digital Mental Health Risk Index (ADMRI)  
**Type:** Full-Stack Mental Health Assessment Application  
**Status:** Active (TRL-4)  
**Review Date:** April 29, 2026

---

## 📋 Project Overview

ADMRI is a **browser-native AI-powered clinical decision support system** for adolescent mental health risk assessment (ages 10-18). The application runs **entirely in the browser** using TensorFlow.js — no server inference, no cloud dependency, **zero data leaves the device**.

### Key Differentiators
- **4-Model Stacked Ensemble** with Monte Carlo Dropout (20 passes, 95% CI)
- **Privacy-First**: All ML inference runs client-side
- **Clinical Dataset**: 6,000 samples from standardized instruments (PHQ-9, GAD-7, ISI, SCARED)
- **Real-time NLP**: Crisis detection with 90-term lexicon
- **Monorepo Structure**: Frontend + Backend in single repository

---

## 🏗️ Architecture

### Frontend (React + TensorFlow.js)
```
INPUT → FEATURE ENGINEERING (20 features)
  ↓
SPECIALIST MODELS (DepNet, AnxNet, SleepNet)
  ↓
FUSION NET (Meta-learner, stacked generalization)
  ↓
OUTPUT: Risk Score (0-100) + Confidence Interval + Forecast
```

**Components:**
- `ADMRIEngine.js` - Core ML inference pipeline
- `ChatbotEngine.js` - NLP crisis detection
- `ClinicalDataset.js` - Training data validation
- `PlattCalibration.js` - Probability calibration
- Dashboard, patient management, charts, export (FHIR/PDF)

### Backend (Node.js + Express)
**Routes:**
- `/auth` - Authentication (JWT, bcryptjs)
- `/patients` - Patient CRUD
- `/sessions` - Assessment sessions
- `/assessments` - Risk assessment records
- `/alerts` - Crisis alerts
- `/dashboard` - Analytics

**Security:**
- Rate limiting (100 req/15min default)
- CORS enabled for localhost:3000
- JWT token auth
- Helmet headers
- Password hashing (bcryptjs)

**Database:** PostgreSQL with migrations

---

## 🔧 Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.4 | UI framework |
| TensorFlow.js | 4.22.0 | Neural networks (client-side ML) |
| Framer Motion | 12.34.3 | Animations |
| React Testing Library | 16.3.2 | Component testing |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Express | 4.18.2 | REST API |
| PostgreSQL | 8.11.3 (pg driver) | Data persistence |
| JWT | 9.0.2 | Authentication |
| bcryptjs | 2.4.3 | Password hashing |
| Nodemailer | 6.9.7 | Email notifications |
| Winston | 3.11.0 | Logging |
| Jest | 29.7.0 | Testing |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm
- PostgreSQL

### Installation
```bash
# Root directory
npm install

# Start both apps
npm run start      # Production mode
npm run dev        # Backend in watch mode
```

**Frontend:** http://localhost:3000  
**Backend:** http://localhost:5000

### Database Setup
```bash
cd admri-backend
npm run migrate    # Run migrations (schema.sql)
npm run seed       # Populate test data
```

### Environment Configuration
**File:** `admri-backend/.env`
```env
PORT=5000
CLIENT_ORIGIN=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=admri_db
DB_USER=admri_user
DB_PASSWORD=your_password
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

**Optional AI Chat:**  
Add to `admri-frontend/src/config.js`:
```js
export const ANTHROPIC_API_KEY = "your_key_here";
```

---

## 🧪 Testing

### Frontend Tests
```bash
cd admri-frontend
npm test           # Jest + React Testing Library
npm run build      # Production build
```

### Backend Tests
```bash
cd admri-backend
npm test           # Jest (single run)
```

**Test Files:**
- `admri-backend/tests/auth.test.js` - Authentication flows

---

## 📁 Directory Structure

### Frontend (`admri-frontend/src/`)
```
components/
├── charts/        - Risk visualization & trends
├── chat/          - ADMRIChatbot NLP UI
├── features/      - Schedule, TreatmentPlan, ShapExplainer
├── modals/        - Modal dialogs
└── ui/            - Sidebar, Profile, Theme

hooks/
├── useAuth        - Auth state & login
├── useChatbot     - NLP engine
├── useML          - Model inference
├── useMobile      - Responsive design
└── useTheme       - Dark/light mode

ml/
├── ADMRIEngine.js         - Main ensemble inference
├── ChatbotEngine.js       - Crisis detection NLP
├── ClinicalDataset.js     - Training data
├── trainWorker.js         - Web Worker training
└── PlattCalibration.js    - Probability calibration

pages/
├── AuthPage       - Login/signup
├── DashboardPage  - Main UI
├── PatientsPage   - Patient list
├── PatientDetailPage
└── ProfilePage
```

### Backend (`admri-backend/src/`)
```
config/
├── db.js          - PostgreSQL pool
└── logger.js      - Winston logger

controllers/
├── authController.js
├── patientController.js
├── sessionController.js
├── assessmentController.js
├── goalController.js
├── noteController.js
└── shapController.js

routes/
├── auth.js        - /auth endpoints
├── patients.js    - /patients endpoints
├── sessions.js    - /sessions endpoints
├── alerts.js      - /alerts endpoints
├── dashboard.js   - /dashboard endpoints
└── index.js       - Route aggregator

services/
└── emailService.js - Nodemailer integration

middleware/
├── auth.js        - JWT verification
└── errorHandler.js

migrations/
├── schema.sql     - DB schema definition
└── run.js         - Migration executor
```

---

## ✅ Code Review Checklist

### 1. Security
- [ ] JWT tokens validated on protected routes
- [ ] Password hashing using bcryptjs
- [ ] CORS properly configured (localhost:3000 only)
- [ ] Helmet headers enabled
- [ ] Rate limiting active
- [ ] No hardcoded credentials
- [ ] Input validation with express-validator
- [ ] SQL injection protection (parameterized queries)

### 2. Frontend (React + ML)
- [ ] ML models load correctly in browser
- [ ] Monte Carlo Dropout implementation (20 passes)
- [ ] Feature engineering pipeline tested
- [ ] Crisis detection lexicon coverage
- [ ] PDF/FHIR export functionality
- [ ] localStorage for draft saves
- [ ] Web Worker for model training (off-thread)
- [ ] Error boundaries for component crashes
- [ ] Accessibility (ARIA labels, keyboard nav)

### 3. Backend (API)
- [ ] All CRUD operations working
- [ ] Error handling consistent
- [ ] Logging (Winston) captures errors
- [ ] Database connection pooling
- [ ] Migration system functional
- [ ] Email service integration
- [ ] API response formats consistent

### 4. Database
- [ ] Schema matches migrations
- [ ] Foreign keys defined
- [ ] Indexes on frequent queries
- [ ] Test data seeding works
- [ ] Connection string properly configured

### 5. Testing
- [ ] Auth tests pass
- [ ] API endpoints tested
- [ ] Component tests for UI
- [ ] ML model outputs validated
- [ ] Test coverage > 70% (goal)

### 6. Documentation
- [ ] README complete and accurate
- [ ] API endpoints documented
- [ ] ML architecture explained
- [ ] Setup instructions clear
- [ ] Environment variables documented

---

## 🔍 Areas of Focus

### High Priority
1. **Model Accuracy**: Validate DepNet, AnxNet, SleepNet, FusionNet outputs against clinical dataset
2. **Crisis Detection**: Test NLP lexicon for false positives/negatives
3. **Authentication**: Verify JWT token lifecycle, refresh logic
4. **Data Privacy**: Confirm no data sent to cloud (TensorFlow.js only)

### Medium Priority
5. Probability calibration (Platt scaling)
6. Trajectory forecasting accuracy
7. Anomaly detection (2σ threshold tuning)
8. Performance: Model inference time < 500ms

### Nice-to-Have
9. Accessibility testing (WCAG 2.1)
10. Mobile responsiveness
11. Internationalization support
12. Dark mode consistency

---

## 📊 Key Files to Review

### Frontend Critical Path
- [admri-frontend/src/ml/ADMRIEngine.js](admri-frontend/src/ml/ADMRIEngine.js) - Core inference
- [admri-frontend/src/ml/ClinicalDataset.js](admri-frontend/src/ml/ClinicalDataset.js) - Training data
- [admri-frontend/src/hooks/useML.js](admri-frontend/src/hooks/useML.js) - ML integration
- [admri-frontend/src/pages/DashboardPage.jsx](admri-frontend/src/pages/DashboardPage.jsx) - Main UI

### Backend Critical Path
- [admri-backend/src/server.js](admri-backend/src/server.js) - Entry point
- [admri-backend/src/config/db.js](admri-backend/src/config/db.js) - Database config
- [admri-backend/src/middleware/auth.js](admri-backend/src/middleware/auth.js) - Auth middleware
- [admri-backend/migrations/schema.sql](admri-backend/migrations/schema.sql) - DB schema

---

## 📞 Questions to Clarify

Before review, confirm:
1. What's the target clinic/hospital deployment?
2. What's the compliance requirement? (HIPAA, GDPR, etc.)
3. User acceptance testing status?
4. Performance benchmarks (inference time, confidence intervals)?
5. Crisis alert thresholds and escalation procedures?

---

## 📈 Next Steps

1. **Setup Environment** → Run `npm install` & set .env
2. **Start Apps** → `npm run dev` (watch mode)
3. **Review Code** → Use checklist above, focus on security & ML accuracy
4. **Run Tests** → `npm test` in both directories
5. **Test Manually** → Create dummy patient, run assessment, check output
6. **Document Findings** → Note any issues with severity level

---

**Generated:** April 29, 2026  
**For:** Code Review Session
