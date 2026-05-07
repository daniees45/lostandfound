# Supabase → Turso SQLite Migration Guide

## ✅ What's Been Done

### Core Dependencies
- Added `@libsql/client` and `drizzle-orm` to package.json
- Added `drizzle-kit` to devDependencies for schema management

### Database Infrastructure
- **[src/lib/schema.ts](src/lib/schema.ts)** - Drizzle ORM schema with all tables:
  - `profiles` - User profiles with roles (student, admin, pickup_point)
  - `items` - Lost/found items with AI tags and embeddings
  - `claims` - Item claims with credibility scoring
  - `custody_logs` - Item transfer tracking
  - `notifications` - User notifications
  - `pickup_records` - Pickup status tracking

- **[src/lib/db.ts](src/lib/db.ts)** - Database initialization and client factory
  - Handles Turso connection setup
  - Exports schema for use throughout the app
  - Requires `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` env vars

- **[src/lib/auth-turso.ts](src/lib/auth-turso.ts)** - Turso profile management helpers
  - `createUserProfile()` - Create/update user profiles
  - `getUserProfile()` - Fetch user profile data

### Server Actions (All Migrated to Turso)
- **[src/app/actions/auth.ts](src/app/actions/auth.ts)** - Updated signup to create Turso profiles
- **[src/app/actions/items.ts](src/app/actions/items.ts)** - Full Turso migration for item management
- **[src/app/actions/claims.ts](src/app/actions/claims.ts)** - Turso for claim operations
- **[src/app/actions/notifications.ts](src/app/actions/notifications.ts)** - Turso notifications
- **[src/app/actions/pickup.ts](src/app/actions/pickup.ts)** - Turso pickup management
- **[src/app/actions/admin.ts](src/app/actions/admin.ts)** - Turso admin operations

### Pages Updated
- **[src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)** - Migrated to Turso for fetching user data and claims
- **[src/app/items/page.tsx](src/app/items/page.tsx)** - Migrated to Turso with keyword search (no vector search)

### Environment Configuration
- **[.env.example](.env.example)** - Updated with Turso variables

## 🚀 Setup Instructions

### 1. Create Turso Account and Database
```bash
# Install Turso CLI
curl -sSfL https://get.turso.io | bash

# Login to Turso
turso auth login

# Create a new database
turso db create lost-and-found-db

# Get connection details
turso db show lost-and-found-db --url
turso db tokens create lost-and-found-db
```

### 2. Set Environment Variables
Create `.env.local`:
```env
TURSO_DATABASE_URL=libsql://your-db-url.turso.io
TURSO_AUTH_TOKEN=your-token-here
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Initialize Database
The schema will be created automatically on first connection via Drizzle ORM.

### 5. Run Application
```bash
npm run dev
```

## ⏳ Remaining Work

The following pages still need manual updates to use Turso instead of Supabase:

### Pages to Update
- `src/app/page.tsx` - Home page (items listing)
- `src/app/items/[id]/page.tsx` - Item detail page
- `src/app/notifications/page.tsx` - Notifications listing
- `src/app/admin/page.tsx` - Admin dashboard
- `src/app/pickup/page.tsx` - Pickup management
- `src/app/chat/page.tsx` - Chat/AI features

### Components to Update
- `src/components/admin-copilot.tsx`
- `src/components/admin-items-table.tsx`
- `src/components/admin-users-table.tsx`

## 📝 Migration Pattern Reference

### Before (Supabase)
```typescript
const { data: user } = await supabase.auth.getUser();
const { data: items } = await supabase
  .from("items")
  .select("id, title, status")
  .eq("user_id", user.id);
```

### After (Turso with Drizzle)
```typescript
import { initializeDatabase } from "@/lib/db";
import { items as itemsTable } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

const db = initializeDatabase();
const userItems = await db
  .select({ id: itemsTable.id, title: itemsTable.title, status: itemsTable.status })
  .from(itemsTable)
  .where(eq(itemsTable.user_id, user.id));
```

## ⚠️ Important Notes

### Vector Search / Semantic Search
- **Removed**: PostgreSQL vector search via `match_items()` RPC function
- **Alternative**: Implemented keyword-based search using application-level filtering
- **Future**: Consider implementing SQLite FTS5 (Full-Text Search) for better performance

### Authentication
- **Kept**: Supabase Auth for user authentication
- **Migrated**: User profiles moved to Turso SQLite
- **Why**: Turso has no built-in auth provider; Supabase Auth remains the simplest solution

### Timestamps
- Stored as Unix epoch integers (seconds since 1970)
- Use `new Date(timestamp * 1000)` to convert when needed
- Drizzle ORM handles conversion automatically with `mode: "timestamp"`

### Image Storage
- Kept with Supabase Storage (separate from database)
- Could be migrated to S3, Cloudflare R2, etc. in future

## 🔧 Common Issues

### Error: "TURSO_DATABASE_URL not set"
- Check `.env.local` has correct variables
- Restart development server after adding env vars

### Error: "Schema mismatch"
- Delete Turso database and recreate: `turso db destroy lost-and-found-db`
- Create new database and redeploy

### Slow Queries
- Add indexes: Drizzle ORM has indexes defined in schema.ts
- Run migrations with `drizzle-kit push:sqlite` for production

## 📚 Reference Links
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Turso Documentation](https://docs.turso.tech/)
- [SQLite vs PostgreSQL](https://www.sqlite.org/whichisrightin.html)
