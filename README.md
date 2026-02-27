# ADMRI — Adaptive Digital Mental Health Risk Index

> A browser-native AI-powered clinical decision support system for adolescent mental health risk assessment. Built with React + TensorFlow.js. No backend. No cloud. Zero data leaves the device.

![ADMRI Dashboard](https://img.shields.io/badge/Status-Active-34D399?style=flat-square) ![TRL](https://img.shields.io/badge/TRL-4-3ABFF8?style=flat-square) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) ![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.17-FF6F00?style=flat-square&logo=tensorflow) ![SDG](https://img.shields.io/badge/SDG-3%20Good%20Health-4C9F38?style=flat-square)

---

## What is ADMRI?

ADMRI is a clinician-facing web application that uses a **4-model stacked ensemble neural network** to compute a risk score (0–100) for adolescent patients aged 10–18 across depression, anxiety, sleep, and behavioural domains.

The system runs **entirely in the browser** using TensorFlow.js — no server, no database, no API calls for inference. Patient data never leaves the device.

---

## Features

| Feature | Details |
|---|---|
| **4-Model Ensemble** | DepNet + AnxNet + SleepNet + FusionNet (stacked generalisation) |
| **Monte Carlo Dropout** | 20 stochastic passes → 95% confidence interval |
| **Clinical Dataset** | 6,000 samples from PHQ-9, GAD-7, ISI, SCARED formulas |
| **NLP Crisis Detection** | 90-term lexicon + 20 crisis bigrams, real-time |
| **Trajectory Forecast** | Linear regression + EWMA ensemble |
| **Anomaly Detection** | z-score based, 2σ alert threshold |
| **PDF Export** | One-click clinical report generation |
| **CBT Recommendations** | Evidence-graded, domain-personalised |
| **Session Timeout** | 30-min auto-logout with warning |
| **Password Security** | SHA-256 via Web Crypto API |
| **Save Draft** | Assessment progress saved to localStorage |
| **Web Worker Training** | Off main thread, UI stays responsive |

---

## System Architecture

```
INPUT LAYER
├── 📋 Questionnaire (10 items · PHQ-9/GAD-7)
├── 💭 Journal NLP (sentiment · crisis detection)
└── 🏃 Behavioural (sleep · screen · exercise · social)
        │
        ▼
⚙️  20-Feature Engineering Pipeline
        │
   ┌────┴────────────┐
   ▼                 ▼                 ▼
🔴 DepNet        🟠 AnxNet        🔵 SleepNet
PHQ-9 spec.      GAD-7 spec.      ISI spec.
10 features      11 features      11 features
   │                 │                 │
   └────────┬────────┘                 │
            └──────────────────────────┘
                        │
                        ▼
            🧠 FusionNet (Meta-Learner)
            23 inputs · Stacked generalisation
                        │
                        ▼
            🎲 Monte Carlo Dropout
            20 passes · 95% CI
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ADMRI Score    Forecast        Crisis Alert
   + Domain Radar + Anomaly       + CBT Recs
```

---

## Model Architecture

### DepNet — PHQ-9 Depression Specialist
```
Input(10) → Dense(64, ReLU) → BatchNorm → Dense(32, ReLU)
→ Dropout(0.3) → Dense(16, ReLU) → Sigmoid
Optimizer: Adam(0.001) | L2: 0.002 | Weight: 20%
```

### AnxNet — GAD-7 Anxiety Specialist
```
Input(11) → Dense(64, ReLU) → BatchNorm → Dropout(0.25)
→ Dense(32, ReLU) → Dense(16, ReLU) → Sigmoid
Optimizer: Adam(0.0008) | L2: 0.002 | Weight: 20%
```

### SleepNet — ISI Sleep/Behaviour Specialist
```
Input(11) → Dense(48, ReLU) → BatchNorm → Dense(24, ReLU)
→ Dropout(0.25) → Dense(12, ReLU) → Sigmoid
Optimizer: Adam(0.001) | Weight: 15%
```

### FusionNet — Stacked Meta-Learner
```
Input(23) → Dense(128, ReLU) → BatchNorm → Dense(64, ReLU)
→ Dropout(0.35) → Dense(32, ReLU) → Dropout(0.20) → Sigmoid
Optimizer: Adam(0.0008) | L2: 0.001 | Weight: 45%
```

---

## Clinical Dataset

Training data generated from validated clinical instruments:

| Instrument | Weight | Reference |
|---|---|---|
| PHQ-9 | 30% | Kroenke et al., 2001 |
| GAD-7 | 25% | Spitzer et al., 2006 |
| ISI | 20% | Morin et al., 2011 |
| SCARED | 15% | Birmaher et al., 1997 |
| Behavioural | 10% | WHO/AASM guidelines |

**6,000 samples** with epidemiologically realistic severity distribution:
- None: 28% · Mild: 32% · Moderate: 25% · High: 10% · Severe: 5%

---

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ADMRI.git
cd ADMRI

# Install dependencies
npm install

# Start development server
npm start
```

App opens at `http://localhost:3000`

### Demo Accounts
| Clinician | Email | Password |
|---|---|---|
| Dr. Priya Sharma | priya@admri.in | doctor123 |
| Dr. Arjun Mehta | arjun@admri.in | doctor456 |

### Enable AI Chat (optional)
1. Get a free API key at [console.anthropic.com](https://console.anthropic.com)
2. Open `src/config.js`
3. Paste: `export const ANTHROPIC_API_KEY = "sk-ant-..."`

---

## First Load

1. App checks IndexedDB for saved models
2. Not found → trains all 4 models (~60 seconds)
3. Web Worker keeps UI responsive during training
4. Models saved to IndexedDB
5. All future loads → instant (<1 second)

---

## Project Structure

```
src/
├── App.js                    # Root component, routing, keyboard shortcuts
├── index.js                  # React entry point
├── index.css                 # Global CSS reset
├── config.js                 # API key configuration
├── ml/
│   ├── ADMRIEngine.js        # 4 TF.js models + NLP + forecasting
│   ├── ClinicalDataset.js    # PHQ-9/GAD-7/ISI/SCARED dataset generator
│   └── trainWorker.js        # Web Worker for off-thread training
├── hooks/
│   ├── useAuth.js            # Auth + session timeout + patient state
│   └── useML.js              # Model training lifecycle
├── pages/
│   ├── AuthPage.jsx          # Login / register
│   ├── DashboardPage.jsx     # Population analytics
│   ├── PatientsPage.jsx      # Patient registry
│   └── PatientDetailPage.jsx # Assessment + notes + history
├── components/
│   ├── ui/Sidebar.jsx        # Navigation sidebar
│   ├── ui/Primitives.jsx     # Avatar, RiskBadge, Spinner
│   ├── charts/Charts.jsx     # RiskGauge, TrendChart, DomainRadar...
│   └── modals/Modals.jsx     # AddNote, AddPatient modals
├── utils/
│   ├── storage.js            # localStorage CRUD
│   ├── crypto.js             # SHA-256 password hashing
│   └── exportReport.js       # PDF report generator
├── data/seedData.js          # Demo data + CBT library
└── styles/
    ├── theme.js              # Color tokens
    └── shared.js             # Reusable style objects
```

---

## Security

- Passwords hashed with **SHA-256** via native Web Crypto API (no external library)
- **30-minute session timeout** with 5-minute warning
- Patient data **isolated per doctor** at storage level
- Assessment drafts saved locally, never transmitted
- **No data ever sent to any server** during clinical use

---

## Technology Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 |
| ML Engine | TensorFlow.js 4.17 |
| Animation | Framer Motion |
| AI Chat | Anthropic Claude API (optional) |
| Storage | localStorage + IndexedDB |
| Security | Web Crypto API (SHA-256) |
| Threading | Web Workers API |
| Build | Create React App |

---

## Clinical Disclaimer

ADMRI is a **decision-support tool only**. Risk scores are generated by ML models trained on synthetic data and should not replace clinical judgment. All assessments must be reviewed by a qualified mental health professional.

**Crisis line: iCall — 9152987821**

---

## SDG Alignment

**SDG 3 — Good Health and Well-Being**

Addresses target 3.4 by enabling earlier identification of adolescent mental health conditions in low-resource clinical settings with no infrastructure cost.

---

## TRL Status

**TRL 4 — Technology validated in lab**

System correctly classifies risk tiers consistent with published PHQ-9/GAD-7 thresholds in controlled testing. Next step: prospective validation on real anonymised patient data under IRB approval.

---

## Sprint Timeline

| Sprint | Date | Deliverables |
|---|---|---|
| Sprint 1 | Feb 28, 2026 | Auth, patient registry, basic scoring, core UI |
| Sprint 2 | Mar 22, 2026 | 4-model ensemble, analytics, PDF export, dashboard |
| Sprint 3 | Apr 28–30, 2026 | Testing, validation, report, demo |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built with React + TensorFlow.js · ADMRI v3 · 2026*
