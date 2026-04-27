# ADMRI App

ADMRI is a full-stack mental health risk assessment workspace with a React frontend and an Express/PostgreSQL backend. The repo is organized as a monorepo so you can run the browser app and the API together during development.

## What’s Included

- `admri-frontend/` - React application for assessments, dashboard views, patient management, charts, and the optional AI chat experience.
- `admri-backend/` - Node.js + Express API with authentication, patient/session/assessment routes, rate limiting, and PostgreSQL access.
- Root scripts for starting both apps together.

## Requirements

- Node.js 16 or newer
- npm
- PostgreSQL for the backend

## Quick Start

Install dependencies from the repo root:

```bash
npm install
```

Start both apps from the repo root:

```bash
npm run start
```

This runs the frontend on `http://localhost:3000` and the backend on `http://localhost:5000`.

If you want the backend to restart automatically while developing:

```bash
npm run dev
```

## Backend Setup

The backend reads environment variables from `admri-backend/.env`.

Suggested variables:

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

## Frontend AI Chat Key

The frontend can run without an AI key. If you want to enable the optional chat feature, set the key in `admri-frontend/src/config.js`:

```js
export const ANTHROPIC_API_KEY = "your_key_here";
```

## Available Scripts

Root:

- `npm run start` - start frontend and backend together
- `npm run dev` - start the backend in watch mode and the frontend normally

Frontend:

- `npm run start` - start the React dev server
- `npm run build` - create a production build
- `npm run test` - run frontend tests

Backend:

- `npm run start` - start the API server
- `npm run dev` - start the API with nodemon
- `npm run migrate` - run database migrations
- `npm run seed` - seed initial data
- `npm run test` - run backend tests

## Project Layout

```text
admri-frontend/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── ml/
│   ├── pages/
│   ├── styles/
│   └── utils/

admri-backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── utils/
└── migrations/
```

## Notes

- The backend health endpoint is available at `GET /api/health`.
- Patient data is handled locally by the application architecture and should be reviewed against your deployment and compliance requirements before production use.
- This project is intended for clinical decision support, not as a replacement for professional judgment.
