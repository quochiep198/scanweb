# Backend Rules

## Architecture: Service-Repository Pattern

```
Router → Service → Repository → Database
```

## Layer Responsibilities

| Layer | Responsibility |
|-------|---------------|
| `schemas/` | Request/Response validation (Pydantic) |
| `services/` | Business logic |
| `repositories/` | Data access (SQLAlchemy) |
| `models/` | Database models |
| `api/` | Route definitions, HTTP handling |

## File Structure

```
backend/app/
├── core/           # Config, DB, Security
├── models/         # SQLAlchemy models
├── schemas/        # Pydantic schemas
├── services/       # Business logic
├── repositories/   # Data access
├── api/
│   └── v1/
│       ├── endpoints/
│       └── router.py
└── main.py
```

## Naming Conventions

- Models: `PascalCase` (e.g., `Patient`)
- Schemas: `PascalCase` (e.g., `PatientCreate`, `PatientResponse`)
- Services: `snake_case_service.py`
- Routes: `snake_case.py`
- Functions: `snake_case`

## API Design

### Endpoint Convention
```
GET    /v1/resource/          # List
GET    /v1/resource/{id}      # Get one
POST   /v1/resource/           # Create
PUT    /v1/resource/{id}       # Update
DELETE /v1/resource/{id}       # Delete
```

### Response Format
```json
// Success
{ "data": {...} }

// Error
{ "detail": "Error message" }
```

## Database

- Use **Neon PostgreSQL** (as per README)
- Migrations: Alembic
- Models: SQLAlchemy ORM

## Authentication

- JWT tokens
- Access + Refresh tokens
- Use `HTTPBearer` for protected routes

## Testing

- Unit tests: pytest
- Fixtures in `tests/conftest.py`
- Test files mirror `app/` structure