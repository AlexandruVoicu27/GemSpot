# Supabase Setup

## What GemSpot Uses

GemSpot uses Supabase in two ways:

- Supabase Auth stores login accounts in `auth.users`.
- GemSpot tables store app data in `public.users`, `public.games`, `public.game_files`, `public.game_claims`, and `public.reviews`.

The `public.users.id` value must match the Supabase Auth user id.

## Backend Env

Set these in `Backend/.env`:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
FRONTEND_URL="http://localhost:5173"
PORT=3000
```

`SUPABASE_SERVICE_ROLE_KEY` is backend-only. Never put it in `Frontend/.env`.

## Frontend Env

Set these in `Frontend/.env`:

```env
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
VITE_API_URL="http://localhost:3000/api"
```

## Apply Database Tables

After `DATABASE_URL` points to the Supabase Postgres database, run from `Backend`:

```bash
npm.cmd run db:migrate
```

To check whether migrations are already applied:

```bash
npx.cmd prisma migrate status
```

## Expected Tables

After migrations, Supabase Table Editor should show:

- `users`
- `games`
- `game_files`
- `game_claims`
- `reviews`

## Current Auth Flow

1. User signs up through the backend.
2. Supabase Auth creates the account.
3. Backend upserts a matching row into `public.users`.
4. Games and reviews use that same user id as `creator_id` or `user_id`.
