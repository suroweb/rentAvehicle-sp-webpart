# Milestones

## v1.0 MVP (Shipped: 2026-02-25)

**Phases completed:** 10 phases, 30 plans
**Timeline:** 4 days (2026-02-22 → 2026-02-25)
**Codebase:** 17,175 LOC TypeScript/SCSS, 254 files, 155 commits
**Git range:** fa07c0d → 562eb9b

**Delivered:** Full internal vehicle rental system on M365/Azure — employees self-service book vehicles with hourly precision, managers have team visibility, fleet admins manage inventory and reporting.

**Key accomplishments:**
1. SPFx + Azure Functions authentication foundation with Entra ID SSO and role-based access (Employee, Manager, Admin, SuperAdmin)
2. Complete vehicle fleet management with CRUD, status lifecycle, photo upload, and Entra ID location sync
3. Double-booking-safe reservation engine with SERIALIZABLE transactions, hourly precision, and timezone handling
4. Full booking lifecycle: visual availability timeline, check-out/check-in, smart slot suggestions, admin oversight with cancel dialog
5. M365 calendar integration: Exchange resource calendars and employee personal calendar events via Graph API
6. Email confirmations, Teams activity feed notifications, manager alerts, and scheduled reminders (pickup/return/overdue)
7. Reporting dashboards with utilization charts, trend analysis, CSV export, and manager team booking visibility
8. UX polish: navigable availability strip with week navigation, desktop side-by-side layout, mobile bottom sheet, unified date range picker

---

## v1.1 Production & Documentation (In Progress)

**Phases:** 4 phases (9-12), 14 requirements
**Started:** 2026-02-25
**Goal:** Make v1.0 deployable, verifiable, and presentable — verify live tenant integrations, create deployment and developer documentation, set up CI/CD and IaC, and add admin timezone configuration.

**Phase plan:**
1. Phase 9: Live Tenant Verification — verify calendar + notifications on real tenant (5 requirements)
2. Phase 10: Documentation — app registration guide, deployment guide, developer README (3 requirements)
3. Phase 11: CI/CD and Infrastructure — GitHub Actions + Bicep templates (4 requirements)
4. Phase 12: Admin Timezone Configuration — UI + API for timezone per location (2 requirements)

---
