# Phase 9: Live Tenant Verification - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify all M365 integrations (calendars, email, Teams notifications) work against a real tenant. This phase includes environment setup (app registration, resource mailboxes, Azure AD configuration), end-to-end verification of each integration, and inline fixes for any issues found. No new features — only confirming and fixing what was built in prior phases.

</domain>

<decisions>
## Implementation Decisions

### Verification Environment
- Single tenant with one licensed user who role-switches (employee, admin, manager, superadmin) for different scenarios
- App registration needs to be created from scratch — include in this phase
- Resource mailboxes need to be created — either manually in Exchange Online or auto-created when admin adds a vehicle in the app
- Test data (vehicles, bookings) created manually through the app UI, not scripted
- All necessary Graph API permissions granted as part of this phase

### Test Scenario Design
- When employee books a vehicle → calendar event created in employee's personal calendar
- Resource mailbox created when admin creates a new vehicle (or added manually in Exchange Online)
- Booking confirmation email includes basic details: vehicle name, date/time, location
- Manager for Teams notifications determined from Azure AD manager field (Graph API)
- User set as their own manager in Azure AD to test manager notification flow with single license

### Failure Handling
- Fix issues inline during verification — debug and resolve before moving to next test
- Code fixes committed as part of this phase (not deferred to a separate fix phase)
- Phase includes full setup of all required permissions — no "document only" items
- All 5 success criteria must pass before phase is considered complete

### Evidence & Sign-off
- Granular verification checklist in markdown — break each success criterion into sub-checks (e.g., create → resource event + personal event + email + Teams)
- User manually signs off that each verification passes
- Interactive guided session: Claude walks through each test step-by-step, user reports results
- Checklist stored in .planning as verification record

### Claude's Discretion
- Calendar event update strategy for modify/cancel (update in-place vs delete/recreate — choose based on Graph API best practices)
- Exact Graph API permission scopes needed
- Order of verification tests
- Checklist sub-item granularity

</decisions>

<specifics>
## Specific Ideas

- Single licensed user means creative role-switching: same user acts as employee booking a vehicle, admin creating vehicles, and manager receiving notifications
- Self-manager pattern in Azure AD enables testing the full manager notification flow
- Interactive session format: Claude says "now do X" → user reports what they see → Claude records pass/fail

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-live-tenant-verification*
*Context gathered: 2026-02-25*
