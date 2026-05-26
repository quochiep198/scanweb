---
title: Scanweb API
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---
# OsteoAI Platform

Monorepo structure for OsteoAI - medical imaging data collection.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | FastAPI |
| Database | Neon PostgreSQL |
| Deployment | Vercel |

## Quick Start

```bash
# Backend
cd backend
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

## Environment Variables

### Backend: `backend/.env`

```env
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
SECRET_KEY=change-this-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
OTP_EXPIRE_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_SECONDS=60
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=OsteoAI <noreply@python.thtsolution.online>
FRONTEND_URL=http://localhost:3000
```

### Frontend: `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Vercel Deploy

- Frontend project on Vercel:
  Set Root Directory = `frontend`
- Frontend environment variables on Vercel:
  `NEXT_PUBLIC_API_URL=https://your-backend-domain`
- Backend environment variables on Vercel:
  `DATABASE_URL`
  `SECRET_KEY`
  `ALGORITHM`
  `ACCESS_TOKEN_EXPIRE_MINUTES`
  `REFRESH_TOKEN_EXPIRE_DAYS`
  `OTP_EXPIRE_MINUTES`
  `OTP_MAX_ATTEMPTS`
  `OTP_RATE_LIMIT_SECONDS`
  `LOGIN_MAX_ATTEMPTS`
  `LOGIN_LOCKOUT_MINUTES`
  `RESEND_API_KEY`
  `EMAIL_FROM`
  `FRONTEND_URL=https://your-frontend-domain`

## Project Structure

```
scanweb/
├── backend/           # FastAPI
│   └── app/
│       ├── core/      # Config, DB, Security
│       ├── models/    # SQLAlchemy models
│       ├── schemas/   # Pydantic schemas
│       ├── services/  # Business logic
│       ├── api/       # Routes
│       └── main.py
├── frontend/          # Next.js
│   ├── app/           # App Router pages
│   ├── components/    # UI components
│   ├── lib/           # API client, utils
│   └── hooks/         # Custom hooks
└── docs/
    └── rules/         # Architecture guidelines
```

## Documentation

- [Architecture Overview](./docs/rules/architecture.md)
- [Backend Guidelines](./docs/rules/backend.md)
- [Frontend Guidelines](./docs/rules/frontend.md)

## Deploy

- **Frontend**: Vercel (set Root Directory to `frontend`)
- **Backend**: Vercel Functions or separate service
- Deploy again
