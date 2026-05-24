# Architecture Overview

## Project Structure

```
scanweb/
├── backend/           # FastAPI
│   ├── app/
│   │   ├── core/      # Core configurations
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/    # SQLAlchemy/Pydantic models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── api/      # API routes
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   └── router.py
│   │   ├── services/  # Business logic
│   │   └── main.py
│   └── requirements.txt
│
├── frontend/          # Next.js
│   ├── app/           # App Router (folder-based)
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── patients/
│   │   │   ├── uploads/
│   │   │   └── reports/
│   │   ├── api/       # Server Actions
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/    # React components
│   │   ├── ui/        # Base components (Button, Input, Card...)
│   │   ├── forms/     # Form components
│   │   └── layouts/   # Layout components
│   ├── lib/           # Utilities
│   │   ├── api/       # API client
│   │   ├── utils/     # Helpers
│   │   └── constants/ # Constants
│   ├── hooks/         # Custom hooks
│   ├── types/         # TypeScript types
│   └── store/         # State management
│
└── docs/
    └── rules/         # This directory
```

## Backend Architecture (FastAPI)

### Layer Structure

```
Request → Router → Service → Repository → Database
              ↓          ↓          ↓
         Validation  Business    Data Access
         (Schemas)   Logic       (SQLAlchemy)
```

### 1. Core Layer (`app/core/`)

```python
# config.py - Environment settings
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
```

```python
# database.py - Database connection
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 2. Models Layer (`app/models/`)

```python
# models/patient.py
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### 3. Schemas Layer (`app/schemas/`)

```python
# schemas/patient.py
from pydantic import BaseModel, EmailStr
from datetime import datetime

class PatientBase(BaseModel):
    name: str
    email: EmailStr

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None

class PatientResponse(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
```

### 4. Services Layer (`app/services/`)

```python
# services/patient_service.py
from sqlalchemy.orm import Session
from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientUpdate

class PatientService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self, skip: int = 0, limit: int = 100):
        return self.db.query(Patient).offset(skip).limit(limit).all()

    def get_by_id(self, patient_id: int):
        return self.db.query(Patient).filter(Patient.id == patient_id).first()

    def create(self, patient_data: PatientCreate):
        patient = Patient(**patient_data.model_dump())
        self.db.add(patient)
        self.db.commit()
        self.db.refresh(patient)
        return patient

    def update(self, patient_id: int, patient_data: PatientUpdate):
        patient = self.get_by_id(patient_id)
        if patient:
            for key, value in patient_data.model_dump(exclude_unset=True).items():
                setattr(patient, key, value)
            self.db.commit()
            self.db.refresh(patient)
        return patient

    def delete(self, patient_id: int):
        patient = self.get_by_id(patient_id)
        if patient:
            self.db.delete(patient)
            self.db.commit()
            return True
        return False
```

### 5. API Layer (`app/api/v1/`)

```python
# api/v1/endpoints/patients.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.patient_service import PatientService
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse

router = APIRouter()

@router.get("/", response_model=list[PatientResponse])
def get_patients(db: Session = Depends(get_db)):
    service = PatientService(db)
    return service.get_all()

@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    service = PatientService(db)
    patient = service.get_by_id(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.post("/", response_model=PatientResponse, status_code=201)
def create_patient(patient_data: PatientCreate, db: Session = Depends(get_db)):
    service = PatientService(db)
    return service.create(patient_data)

@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(patient_id: int, patient_data: PatientUpdate, db: Session = Depends(get_db)):
    service = PatientService(db)
    patient = service.update(patient_id, patient_data)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.delete("/{patient_id}", status_code=204)
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    service = PatientService(db)
    if not service.delete(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
```

```python
# api/v1/router.py
from fastapi import APIRouter
from app.api.v1.endpoints import patients

router = APIRouter(prefix="/v1")
router.include_router(patients.router, prefix="/patients", tags=["patients"])
```

```python
# app/main.py
from fastapi import FastAPI
from app.api.v1.router import router as api_router

app = FastAPI(title="OsteoAI API")

app.include_router(api_router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

---

## Frontend Architecture (Next.js)

### 1. API Client (`lib/api/`)

```typescript
// lib/api/client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }

    return res.json();
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint: string): Promise<void> {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE);
```

```typescript
// lib/api/patient.ts
import { api } from './client';

export interface Patient {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export const patientApi = {
  getAll: () => api.get<Patient[]>('/v1/patients/'),

  getById: (id: number) => api.get<Patient>(`/v1/patients/${id}`),

  create: (data: Omit<Patient, 'id' | 'created_at'>) =>
    api.post<Patient>('/v1/patients/', data),

  update: (id: number, data: Partial<Patient>) =>
    api.post<Patient>(`/v1/patients/${id}`, data),

  delete: (id: number) => api.delete(`/v1/patients/${id}`),
};
```

### 2. Components (`components/`)

```typescript
// components/ui/button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors';
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
```

```typescript
// components/ui/card.tsx
import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`rounded-lg border bg-white shadow ${className}`}>
      {title && (
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
```

### 3. Hooks (`hooks/`)

```typescript
// hooks/usePatients.ts
import { useState, useEffect, useCallback } from 'react';
import { patientApi, Patient } from '@/lib/api/patient';

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await patientApi.getAll();
      setPatients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPatient = async (data: Omit<Patient, 'id' | 'created_at'>) => {
    const patient = await patientApi.create(data);
    setPatients((prev) => [...prev, patient]);
    return patient;
  };

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return { patients, loading, error, createPatient, refetch: fetchPatients };
}
```

### 4. Pages (Route Groups)

```
app/
├── layout.tsx              # Root layout
├── page.tsx                # Landing/redirect
├── (auth)/
│   ├── layout.tsx          # Auth layout (no navbar)
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx           # Dashboard layout with sidebar
│   ├── page.tsx             # Dashboard home
│   ├── patients/
│   │   ├── page.tsx         # Patient list
│   │   ├── [id]/page.tsx    # Patient detail
│   │   └── new/page.tsx     # Create patient
│   └── uploads/
│       └── page.tsx         # Upload documents
└── api/
    └── patients/route.ts   # API route handler
```

---

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Vercel (.env)
```env
NEXT_PUBLIC_API_URL=https://your-backend.vercel.app
```