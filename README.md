# Valley View Lost & Found System

Initial implementation of the proposed BSc project using:
- Next.js 16 (App Router)
- TypeScript + Tailwind CSS
- Supabase-ready data layer

## Current MVP Scope
- Landing page and item search
- Report lost/found form with privacy disclaimer gate
- Role-based dashboard (`student`, `admin`, `pickup_point`)
- Finder/claimer chat backed by Supabase tables + realtime
- Claim submission and owner approval workflow
- Pickup-point handover verification with custody logging
- Notification logs (`email` + `sms_dummy`) on status changes
- AI-assisted category/tag inference on item reports (with safe fallback)
- Semantic item search with pgvector (`match_items`) + keyword fallback

## Setup
1. Install dependencies:
	```bash
	npm install
	```
2. Copy env template:
	```bash
	cp .env.example .env.local
	```
3. Add Supabase values in `.env.local`:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- Optional email settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
	- Optional AI settings: `OPENAI_API_KEY`, `OPENAI_TAG_MODEL`, `OPENAI_EMBED_MODEL`

4. (Optional but recommended) Apply SQL schema in Supabase SQL editor:
	- `supabase/schema.sql`

5. Start dev server:
	```bash
	npm run dev
	```

6. Run automated tests:
	```bash
	npm test
	```

## Routes
- `/` landing page
- `/items` browse/search items
- `/report` report lost/found item
- `/dashboard` role-based dashboard (`?role=student|admin|pickup_point`)
- `/chat?itemId=<uuid>` privacy-gated chat restricted to item participants
- `/notifications` user notification inbox with unread state
- `/pickup` pickup-point handover code verification

## Next Build Steps
- Add image-upload + vision-based tag extraction for found items
- Add periodic backfill job for embeddings on legacy records

## Phase 4
- Implementation plan: [PHASE4_PLAN.md](PHASE4_PLAN.md)
