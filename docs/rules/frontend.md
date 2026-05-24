# Frontend Rules

## Component Structure

### UI Components (`components/ui/`)
Base reusable components - no business logic.

```typescript
// components/ui/
├── button.tsx
├── input.tsx
├── card.tsx
├── modal.tsx
├── badge.tsx
└── index.ts  // Export all
```

### Form Components (`components/forms/`)
Components bound to React Hook Form + Zod.

```typescript
// components/forms/
├── patient-form.tsx
└── schemas/
    └── patient.ts  // Zod schemas
```

### Layout Components (`components/layouts/`)
Structural components.

```typescript
// components/layouts/
├── sidebar.tsx
├── navbar.tsx
├── footer.tsx
└── container.tsx
```

## API Integration

### Pattern
```typescript
// lib/api/client.ts - Singleton API client
// lib/api/{resource}.ts - Resource-specific API calls

// Usage in hooks
const { data, error, loading } = useSWR('/api/patients', fetcher)
```

## Routing

- Use **App Router** (Next.js 14+)
- Route groups `(auth)`, `(dashboard)` for layout separation
- Server Components by default
- `'use client'` only when needed

## State Management

1. **Server State**: React Query / SWR
2. **Form State**: React Hook Form + Zod
3. **Global UI State**: Zustand (if needed)
4. **Server Components**: Async/await

## File Naming

- Components: `PascalCase.tsx`
- Utils/Hooks: `camelCase.ts`
- Config: `SCREAMING_SNAKE_CASE.ts`