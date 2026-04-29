# ADMRI Review - Quick Command Reference

## Pre-Review Setup

```bash
# Navigate to project root
cd c:\Users\prate\OneDrive\Desktop\admri-app

# Install all dependencies
npm install

# Set up environment (if not already done)
cd admri-backend
# Edit .env with your PostgreSQL credentials
# Then run:
npm run migrate
npm run seed
cd ..
```

---

## Quick Start Servers

```bash
# Option 1: Start both (production mode)
npm run start

# Option 2: Start with backend watch mode (recommended for development)
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## Running Tests

```bash
# Backend tests
cd admri-backend && npm test

# Frontend tests (interactive mode)
cd admri-frontend && npm test

# Frontend build check
npm run build
```

---

## Key Endpoint Examples

### Authentication
```bash
POST /api/auth/login
POST /api/auth/register
```

### Patients
```bash
GET /api/patients
POST /api/patients
GET /api/patients/:id
```

### Assessments
```bash
POST /api/sessions/:sessionId/assessments
GET /api/assessments
```

### Crisis Alerts
```bash
GET /api/alerts
POST /api/alerts
```

---

## ML Model Testing Checklist

- [ ] Open http://localhost:3000
- [ ] Create test patient account
- [ ] Start new assessment
- [ ] Fill questionnaire (PHQ-9, GAD-7, ISI, SCARED)
- [ ] Add journal entry (test NLP crisis detection)
- [ ] Submit assessment
- [ ] Check risk score output (0-100)
- [ ] Verify confidence interval display (±%)
- [ ] Export PDF report
- [ ] Export FHIR format
- [ ] Check forecast chart (30-day trajectory)
- [ ] Test anomaly detection alert (if score unusual)
- [ ] Check CBT recommendations (domain-specific)

---

## Database Inspection

```bash
# Connect to PostgreSQL
psql -U admri_user -d admri_db -h localhost

# View tables
\dt

# Sample queries
SELECT * FROM patients LIMIT 5;
SELECT * FROM assessments ORDER BY created_at DESC LIMIT 5;
SELECT * FROM sessions WHERE user_id = 'patient_id' LIMIT 10;
```

---

## Monitoring & Logs

### Backend Logs
```
admri-backend/logs/  (Winston output)
```

### Check Running Processes
```bash
netstat -ano | findstr :3000  # Frontend
netstat -ano | findstr :5000  # Backend
```

### Stop Services
```bash
# Kill specific port (Windows PowerShell)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess
```

---

## Code Review Focus Areas

### Must Check
1. **Security**: `admri-backend/src/middleware/auth.js`
2. **ML Inference**: `admri-frontend/src/ml/ADMRIEngine.js`
3. **Database**: `admri-backend/migrations/schema.sql`
4. **API Routes**: `admri-backend/src/routes/`
5. **Error Handling**: Look for Winston logs in controllers

### Performance Checks
```javascript
// In browser console on http://localhost:3000
performance.mark('ml-inference-start');
// Run assessment
performance.mark('ml-inference-end');
performance.measure('ML', 'ml-inference-start', 'ml-inference-end');
performance.getEntriesByType('measure').forEach(m => console.log(m.name, m.duration + 'ms'));
```

---

## Common Issues & Fixes

| Issue | Solution |
|---|---|
| Port 3000/5000 in use | `npm run prestart` or kill manually |
| DB connection error | Check .env, verify PostgreSQL running |
| ML models not loading | Check browser console, verify CORS |
| Tests failing | Run `npm install` again, check Node version |
| CORS errors | Verify CLIENT_ORIGIN in backend .env |

---

## Documentation References

- **Full Project Guide**: [README.md](README.md)
- **Frontend Details**: [admri-frontend/README.md](admri-frontend/README.md)
- **Backend Config**: `admri-backend/.env.example` → `.env`
- **Database Schema**: [admri-backend/migrations/schema.sql](admri-backend/migrations/schema.sql)
- **Dataset Docs**: [admri-frontend/DATASET_DOCUMENTATION.md](admri-frontend/DATASET_DOCUMENTATION.md)

---

**Ready to Review?** Start with `npm run dev` and open http://localhost:3000 ✅
