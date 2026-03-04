# Roadmap: RentAVehicle

## Milestones

- ✅ **v1.0 MVP** — Phases 1-8, 08.1, 08.1.1 (shipped 2026-02-25)
- 🚧 **v1.1 Production & Documentation** — Phases 9-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-8, 08.1, 08.1.1) — SHIPPED 2026-02-25</summary>

- [x] Phase 1: Foundation and Authentication (3/3 plans) — completed 2026-02-23
- [x] Phase 2: Vehicle Inventory and Locations (4/4 plans) — completed 2026-02-23
- [x] Phase 3: Core Booking Flow (3/3 plans) — completed 2026-02-23
- [x] Phase 4: Booking Lifecycle and Admin Oversight (3/3 plans) — completed 2026-02-24
- [x] Phase 5: M365 Calendar Integration (2/2 plans) — completed 2026-02-25
- [x] Phase 6: Notifications (2/2 plans) — completed 2026-02-25
- [x] Phase 7: Reporting and Manager Visibility (3/3 plans) — completed 2026-02-25
- [x] Phase 8: UX Polish: Availability Strip Navigation (5/5 plans) — completed 2026-02-25
- [x] Phase 08.1: Unified Date Range Picker (4/4 plans) — completed 2026-02-25
- [x] Phase 08.1.1: Remove Day View (1/1 plan) — completed 2026-02-25

</details>

### 🚧 v1.1 Production & Documentation (In Progress)

**Milestone Goal:** Make v1.0 deployable, verifiable, and presentable — verify live tenant integrations, create deployment and developer documentation, set up CI/CD and IaC, and add admin timezone configuration.

- [x] **Phase 9: Live Tenant Verification** - Verify M365 calendar integration and all notification channels work on a real tenant — completed 2026-02-26
- [x] **Phase 10: Documentation** - App registration guide, deployment guide, and developer README (completed 2026-02-26)
- [x] **Phase 11: CI/CD and Infrastructure** - GitHub Actions pipeline and Bicep IaC templates (completed 2026-03-01)
- [x] **Phase 12: Admin Timezone Configuration** - UI and API for admin-managed timezone per location (completed 2026-03-02)

## Phase Details

### Phase 9: Live Tenant Verification
**Goal**: All M365 integrations (calendars, email, Teams notifications) are confirmed working against a real tenant
**Depends on**: v1.0 shipped (Phase 08.1.1)
**Requirements**: VRFY-01, VRFY-02, VRFY-03, VRFY-04, VRFY-05
**Success Criteria** (what must be TRUE):
  1. Creating a booking produces a resource calendar event visible in Outlook for that vehicle's resource mailbox
  2. Creating a booking produces a personal calendar event in the booking employee's Outlook calendar
  3. Booking confirmation email arrives in the employee's inbox with correct booking details
  4. Teams activity feed notification appears for the booking employee and for the manager
  5. Cancelling or modifying a booking updates or removes the corresponding calendar events
**Plans**: 5 plans (3 original + 2 gap closure)
- [x] 09-01-PLAN.md — Environment setup: app registration, Graph permissions, resource mailbox, env vars, verification checklist
- [x] 09-02-PLAN.md — Calendar integration verification: resource + personal calendar events, lifecycle updates
- [x] 09-03-PLAN.md — Notification channels verification: email, Teams activity feed, manager alerts
- [x] 09-04-PLAN.md — Teams app manifest deployment and notification fix (gap closure)
- [x] 09-05-PLAN.md — Deep links and security verification (gap closure)

### Phase 10: Documentation
**Goal**: A new developer or admin can set up and deploy the application from scratch using only the documentation
**Depends on**: Phase 9 (verification findings inform accurate docs)
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. Following the app registration guide, a person can create the Entra ID app registration with correct API permissions and Graph API configuration end-to-end
  2. Following the deployment guide, a person can upload the SPFx package to the App Catalog, deploy to a SharePoint site, and add the app as a Teams tab
  3. Developer README documents architecture, local development setup, tech stack, and serves as a portfolio showcase
**Plans**: 2 plans
- [ ] 10-01-PLAN.md — Admin guides: Entra ID app registration guide and SPFx/Azure Functions deployment guide
- [ ] 10-02-PLAN.md — Portfolio README with architecture diagram, tech stack badges, and documentation links

### Phase 11: CI/CD and Infrastructure
**Goal**: Code changes are automatically validated by CI, and infrastructure can be provisioned from templates
**Depends on**: Phase 9 (verified infrastructure informs IaC templates)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04
**Success Criteria** (what must be TRUE):
  1. Pushing a commit or opening a PR triggers a GitHub Actions workflow that builds the SPFx package and Azure Functions
  2. The CI pipeline fails the build if linting or TypeScript type checking produces errors
  3. Running the Bicep templates provisions an Azure Functions App, Azure SQL database, and App Service Plan
  4. The Bicep templates configure Entra ID Easy Auth and required application settings so the deployed app authenticates without manual portal configuration
**Plans**: 2 plans
Plans:
- [ ] 11-01-PLAN.md — GitHub Actions CI workflow with parallel SPFx and API build jobs, API ESLint setup
- [ ] 11-02-PLAN.md — Bicep IaC templates: Function App, SQL, Storage, App Service Plan, Easy Auth

### Phase 12: Admin Timezone Configuration
**Goal**: Admins can manage timezone settings per location, and all booking times display in the correct local timezone
**Depends on**: Phase 9 (verified baseline before feature changes)
**Requirements**: FEAT-01, FEAT-02
**Success Criteria** (what must be TRUE):
  1. Admin can view the current timezone for each location in the admin interface
  2. Admin can edit and save a timezone setting for any location
  3. Booking times throughout the application display in the timezone configured for the booking's location
**Plans**: 5 plans (2 waves + 1 gap closure)
- [x] 12-01-PLAN.md — API: PATCH timezone endpoint, locationService timezone query fix, Zod validation, static IANA timezone data module (Wave 1)
- [x] 12-02-PLAN.md — Notifications: Replace hardcoded UTC in adaptiveCards/emailConfirmation templates, add l.timezone to notification queries (Wave 1)
- [x] 12-03-PLAN.md — Export: Add locationTimezone to report models/query, timezone-formatted CSV export (Wave 1)
- [x] 12-04-PLAN.md — Frontend: LocationList timezone column with inline ComboBox editor, auto-save, ApiService method, SCSS styles (Wave 2, depends on 01)
- [ ] 12-05-PLAN.md — Fix timezone ComboBox UX: filtered search, clear-on-open, polished dropdown (gap closure)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Authentication | v1.0 | 3/3 | Complete | 2026-02-23 |
| 2. Vehicle Inventory and Locations | v1.0 | 4/4 | Complete | 2026-02-23 |
| 3. Core Booking Flow | v1.0 | 3/3 | Complete | 2026-02-23 |
| 4. Booking Lifecycle and Admin Oversight | v1.0 | 3/3 | Complete | 2026-02-24 |
| 5. M365 Calendar Integration | v1.0 | 2/2 | Complete | 2026-02-25 |
| 6. Notifications | v1.0 | 2/2 | Complete | 2026-02-25 |
| 7. Reporting and Manager Visibility | v1.0 | 3/3 | Complete | 2026-02-25 |
| 8. UX Polish: Availability Strip Navigation | v1.0 | 5/5 | Complete | 2026-02-25 |
| 08.1. Unified Date Range Picker | v1.0 | 4/4 | Complete | 2026-02-25 |
| 08.1.1. Remove Day View | v1.0 | 1/1 | Complete | 2026-02-25 |
| 9. Live Tenant Verification | v1.1 | 5/5 | Complete | 2026-02-26 |
| 10. Documentation | v1.1 | 2/2 | Complete | 2026-02-26 |
| 11. CI/CD and Infrastructure | v1.1 | 2/2 | Complete | 2026-03-01 |
| 12. Admin Timezone Configuration | 5/5 | Complete    | 2026-03-04 | 2026-03-02 |

---
*Roadmap created: 2026-02-22*
*Last updated: 2026-03-03 after Phase 12 gap closure planning (1 plan created)*
