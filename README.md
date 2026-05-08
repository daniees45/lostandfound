# Valley View Lost & Found System

Implementation of the BSc project using:
- Next.js 16 (App Router)
- TypeScript + Tailwind CSS
- Turso SQLite + Drizzle ORM
- Turso-only session auth

## Current MVP Scope
- Landing page and item search
- Report lost/found form with privacy disclaimer gate
- Role-based dashboard (`student`, `admin`, `pickup_point`)
- Claim submission and owner approval workflow
- Pickup-point handover verification with custody logging
- Notification center with unread state
- AI-assisted category/tag inference on item reports (with safe fallback)
- Keyword-based matching for related items

## Setup
1. Install dependencies:
	```bash
	npm install
	```
2. Copy env template:
	```bash
	cp .env.example .env.local
	```
3. Add required values in `.env.local`:
	- `TURSO_DATABASE_URL`
	- `TURSO_AUTH_TOKEN`
	- `AUTH_SESSION_SECRET`
	- Optional email settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
	- Optional AI settings: `OPENAI_API_KEY`, `OPENAI_TAG_MODEL`, `OPENAI_EMBED_MODEL`

4. Start dev server:
	```bash
	npm run dev
	```

5. Build for production:
	```bash
	npm run build
	```

## Routes
- `/` landing page
- `/items` browse/search items
- `/report` report lost/found item
- `/dashboard` role-based dashboard
- `/notifications` user notification inbox
- `/pickup` pickup-point handover code verification
- `/chat` currently disabled in Turso-only mode

## Phase 4
- Implementation plan: [PHASE4_PLAN.md](PHASE4_PLAN.md)
