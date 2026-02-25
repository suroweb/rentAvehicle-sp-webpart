# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-02-25
**Phases:** 10 | **Plans:** 30 | **Sessions:** ~8

### What Was Built
- Full internal vehicle rental system: SPFx webpart (SharePoint + Teams) backed by Azure Functions + Azure SQL
- Employee self-service booking with double-booking prevention (SERIALIZABLE transactions), timezone handling, hourly precision
- Admin fleet management (CRUD, status lifecycle, location sync from Entra ID)
- Full booking lifecycle: check-out/check-in, smart slot suggestions, admin oversight with cancel
- M365 calendar integration: Exchange resource calendars + employee personal calendar events (Graph API, fire-and-forget)
- Notifications: email confirmations, Teams activity feed, scheduled reminders (pickup/return/overdue)
- Reporting: utilization dashboards, trend charts, CSV export, manager team view
- UX polish: navigable availability strip, desktop side-by-side layout, mobile bottom sheet, unified date range picker

### What Worked
- **Fire-and-forget pattern** for calendar sync and notifications — bookings never blocked by external service failures
- **Wave-based parallel execution** — independent phases (5, 6) ran alongside Phase 4 without conflicts
- **Consistent API patterns** — established in Phase 1 (auth middleware, ApiService, Zod schemas), reused through all phases
- **Atomic database operations** — SERIALIZABLE for bookings, atomic UPDATE with WHERE for lifecycle transitions
- **Rapid iteration** — 30 plans in 4 days, average 4.6 minutes per plan
- **Decimal phase insertion** — 08.1 and 08.1.1 cleanly inserted for UX polish without disrupting numbering

### What Was Inefficient
- **REQUIREMENTS.md checkbox tracking** — NOTF-01-04 checkboxes were not updated when Phase 6 completed, causing false "incomplete" signal at milestone completion
- **Day View built then removed** — Phase 4 + Phase 8 built AvailabilityTimeline (Day View) with full CSS Grid + drag handles, then Phase 08.1.1 removed it entirely. ~3 plans of effort discarded
- **Phase 2 plan checkboxes in ROADMAP.md** — plans 02-01 through 02-04 show as unchecked `[ ]` in roadmap despite being complete. Inconsistent state tracking
- **Photo storage as Base64** — technical debt that will need Blob Storage migration in v2

### Patterns Established
- Fire-and-forget for all M365 integrations (calendar, notifications)
- Fluent UI v8 DetailsList pattern for all admin/manager tables
- AadHttpClient.fetch() wrapper for PUT/PATCH/DELETE (SPFx only has native get/post)
- Lazy expiration on access (no background timers for auto-cancel/overdue)
- Graph API batch processing with delays for rate limiting
- ES5-compatible timezone handling (Intl.DateTimeFormat formatted string parsing)

### Key Lessons
1. **Validate UX components before building** — Day View was fully implemented with drag handles and range overlays, then removed. Should have validated the concept before investing multiple plans
2. **Keep requirement tracking in sync with execution** — stale checkboxes create confusion at milestone completion
3. **Base64 is fine for MVP but has a ceiling** — photo-heavy fleets will hit DB payload limits
4. **SPFx constraints are real** — React 17.0.1 pin, Fluent UI v8 only, no formatToParts. Research phase caught these early which saved significant rework

### Cost Observations
- Model mix: ~60% sonnet, ~30% haiku, ~10% opus (estimated from GSD agent delegation)
- Sessions: ~8 sessions over 4 days
- Notable: Average 4.6min per plan execution — highly efficient for full-stack feature implementation

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 10 | First milestone — established all patterns |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 0 | 0% | 30 plans |

### Top Lessons (Verified Across Milestones)

1. Fire-and-forget for external integrations keeps core operations resilient
2. Validate UX concepts before full implementation to avoid build-then-remove waste
