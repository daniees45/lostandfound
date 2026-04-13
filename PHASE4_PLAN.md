# Phase 4 Implementation Plan

This phase focuses on production-readiness gaps and the next user-facing features with the highest leverage.

## Goals

1. Harden role security and authorization.
2. Complete the pickup lifecycle through final return.
3. Add image upload to reports and item views.
4. Add automated test coverage for core flows.
5. Add a user-facing notification center and unread chat indicators.

## Delivery Order

### P4.1 Role Security And Authorization

#### Why

- Signup currently allows privileged roles.
- Admin and pickup-point UX assumes broader data access than the current RLS policies guarantee.
- This is the main trust and integrity risk in the system.

#### Scope

- Restrict public signup to `student`.
- Add controlled role promotion flow for `admin` and `pickup_point`.
- Add explicit RLS policies for elevated roles.
- Align dashboard and pickup actions with actual DB authorization rules.

#### Files To Change

- [src/app/actions/auth.ts](src/app/actions/auth.ts)
- [src/app/auth/signup/page.tsx](src/app/auth/signup/page.tsx)
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)
- [src/app/actions/pickup.ts](src/app/actions/pickup.ts)
- [supabase/schema.sql](supabase/schema.sql)

#### Tasks

1. Change signup validation to only allow `student` from public UI.
2. Remove public role selector from signup form.
3. Add helper policies in SQL for staff access to `items`, `claims`, and `custody_logs`.
4. Review all role-based UI branches and make sure they match RLS.
5. Add admin-only promotion path design note for later implementation.

#### Acceptance Criteria

- Public users cannot self-register as `admin` or `pickup_point`.
- Pickup-point users can read and update only what their flow needs.
- Admin views load successfully under real RLS, not just optimistic UI logic.

### P4.2 Complete Pickup Return Workflow

#### Why

- Current flow stops at `held_at_pickup`.
- The system already models `returned`, but final release is not implemented end-to-end.

#### Scope

- Add final handoff action from pickup point to claimant.
- Capture identity verification method and notes.
- Mark item as `returned`.
- Write custody log for the final transfer.
- Notify claimant and finder about completion.

#### Files To Change

- [src/app/pickup/page.tsx](src/app/pickup/page.tsx)
- [src/app/actions/pickup.ts](src/app/actions/pickup.ts)
- [src/lib/notifications.ts](src/lib/notifications.ts)
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)
- [supabase/schema.sql](supabase/schema.sql)

#### Tasks

1. Add a second pickup action for release confirmation.
2. Require approved claim before final return.
3. Record verification method (`id_card` or `manual_override`) and notes.
4. Update item status to `returned`.
5. Notify both claimant and original reporter.

#### Acceptance Criteria

- Pickup staff can release only eligible items.
- Each final release creates an audit trail in `custody_logs`.
- Returned items appear correctly in dashboard and browse UI.

### P4.3 Image Upload And Item Detail Experience

#### Why

- `image_url` exists in schema but is unused.
- Images materially improve match quality and user confidence.

#### Scope

- Add image upload to report flow.
- Store files in Supabase Storage.
- Persist `image_url` on item creation.
- Render thumbnails in cards.
- Add dedicated item detail page.

#### Files To Change

- [src/app/report/page.tsx](src/app/report/page.tsx)
- [src/app/actions/items.ts](src/app/actions/items.ts)
- [src/app/items/page.tsx](src/app/items/page.tsx)
- [supabase/schema.sql](supabase/schema.sql)
- New route: `src/app/items/[id]/page.tsx`

#### Tasks

1. Add file input to report form.
2. Upload image to Supabase Storage bucket.
3. Save public or signed image URL to `items.image_url`.
4. Display image preview on browse cards.
5. Add detail page with full description, status timeline, and chat/claim actions.

#### Acceptance Criteria

- Users can attach an image while reporting.
- Uploaded image is visible on the item card and detail page.
- Item detail page becomes the main destination for rich item interaction.

### P4.4 Automated Tests

#### Why

- Core workflows are now too stateful to leave untested.
- Claim, chat, and pickup flows all depend on policy-sensitive logic.

#### Scope

- Add unit and integration coverage for server actions.
- Add smoke-level end-to-end coverage for critical journeys.

#### Files To Add

- `src/app/actions/__tests__/claims.test.ts`
- `src/app/actions/__tests__/pickup.test.ts`
- `src/app/actions/__tests__/items.test.ts`
- `tests/e2e/report-claim-pickup.spec.ts`
- Test config files depending on selected framework

#### Tasks

1. Choose test stack: Vitest for unit/integration, Playwright for e2e.
2. Cover claim submission and review rules.
3. Cover pickup verification and final return logic.
4. Cover report creation validation.
5. Add one end-to-end happy path for report to claim to pickup.

#### Acceptance Criteria

- At least one automated test covers each critical workflow.
- Failures are actionable and run locally with a documented command.

### P4.5 Notifications And Inbox

#### Why

- Notification logs exist but users cannot view them.
- Chat has no unread state, which weakens engagement and responsiveness.

#### Scope

- Add notification center page.
- Add unread notification state.
- Add unread chat badge/count per active conversation.
- Link notifications back to item or chat context.

#### Files To Change

- [src/lib/notifications.ts](src/lib/notifications.ts)
- [src/components/app-nav.tsx](src/components/app-nav.tsx)
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)
- [supabase/schema.sql](supabase/schema.sql)
- New route: `src/app/notifications/page.tsx`

#### Tasks

1. Extend notification schema with read-state metadata.
2. Build notifications page grouped by time and type.
3. Add nav badge for unread notifications.
4. Add unread count or recent message indicator for chat sessions.
5. Revalidate affected routes after reads and sends.

#### Acceptance Criteria

- Users can review their notification history in-app.
- Unread indicators clear predictably.
- Chat activity is visible without manually reopening item pages.

## Recommended Execution Strategy

1. Implement P4.1 before any other Phase 4 work.
2. Implement P4.2 immediately after P4.1 because it depends on staff authorization.
3. Implement P4.3 next for the highest user-facing impact.
4. Add P4.4 alongside each feature branch rather than leaving all testing to the end.
5. Finish with P4.5 once status and chat flows are stable.

## Out Of Scope For Phase 4

- Full moderation console
- Analytics dashboard
- Background worker infrastructure
- Cross-device profile-synced chat consent

## Immediate Next Step

Start P4.1 by locking public signup to `student` and adding the missing elevated-role RLS policies in [supabase/schema.sql](supabase/schema.sql).