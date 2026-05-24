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
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

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
