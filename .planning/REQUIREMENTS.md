# Requirements: RentAVehicle

**Defined:** 2026-02-25
**Core Value:** Employees can quickly find and book an available vehicle at their location — self-service, no approval bottleneck.

## v1.1 Requirements

Requirements for v1.1 Production & Documentation milestone. Each maps to roadmap phases.

### Verification

- [x] **VRFY-01**: M365 calendar integration creates/updates/deletes resource calendar events on live tenant
- [x] **VRFY-02**: Employee personal calendar events are created on booking via Graph API on live tenant
- [x] **VRFY-03**: Email notifications (booking confirmation, return reminder, overdue) deliver on live tenant
- [x] **VRFY-04**: Teams activity feed notifications deliver on live tenant
- [x] **VRFY-05**: Manager notification alerts deliver on live tenant

### Documentation

- [ ] **DOCS-01**: App registration guide covers Entra ID app setup, API permissions, and Graph API configuration
- [ ] **DOCS-02**: SharePoint App Catalog deployment guide covers SPFx package upload, site deployment, and Teams tab setup
- [x] **DOCS-03**: Developer README documents architecture, setup instructions, tech stack, and project showcase

### Tooling

- [ ] **TOOL-01**: GitHub Actions pipeline builds SPFx package and Azure Functions on push/PR
- [ ] **TOOL-02**: GitHub Actions pipeline runs linting and type checking
- [ ] **TOOL-03**: Bicep templates provision Azure Functions App, Azure SQL, and App Service Plan
- [ ] **TOOL-04**: Bicep templates configure Entra ID Easy Auth and application settings

### Feature

- [ ] **FEAT-01**: Admin can view and edit timezone setting for each location
- [ ] **FEAT-02**: Location timezone is used for all booking time display at that location

## Future Requirements

Deferred beyond v1.1. Tracked but not in current roadmap.

### Storage

- **STOR-01**: Vehicle photos stored in Azure Blob Storage with Valet Key pattern (replace Base64)

### Cost Allocation

- **COST-01**: Booking can be tagged with cost center
- **COST-02**: Admin can view cost allocation reports

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native app | Web-first via SPFx in SharePoint/Teams, PWA works well |
| External user access | Internal employees only |
| Vehicle GPS tracking | Not needed, location-based model sufficient |
| Payment/billing | Internal fleet, no cost allocation for v1.1 |
| Maintenance scheduling | Admin marks status manually |
| Multi-tenant | Single organization deployment |
| Approval workflow | Self-service speed is core value |
| End-to-end test suite | Deferred — manual verification sufficient for v1.1 |
| Performance benchmarking | Not needed yet at current scale |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VRFY-01 | Phase 9 | Complete |
| VRFY-02 | Phase 9 | Complete |
| VRFY-03 | Phase 9 | Complete |
| VRFY-04 | Phase 9 | Complete |
| VRFY-05 | Phase 9 | Complete |
| DOCS-01 | Phase 10 | Pending |
| DOCS-02 | Phase 10 | Pending |
| DOCS-03 | Phase 10 | Complete |
| TOOL-01 | Phase 11 | Pending |
| TOOL-02 | Phase 11 | Pending |
| TOOL-03 | Phase 11 | Pending |
| TOOL-04 | Phase 11 | Pending |
| FEAT-01 | Phase 12 | Pending |
| FEAT-02 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation (traceability complete)*
