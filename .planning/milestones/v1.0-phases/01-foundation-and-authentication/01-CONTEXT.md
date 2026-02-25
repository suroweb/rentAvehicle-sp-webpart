# Phase 1: Foundation and Authentication - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Authenticated SPFx webpart running in both SharePoint and Microsoft Teams, with Entra ID SSO and role-based access control. Users are automatically signed in with their M365 identity, their role (Employee, Manager, Admin) is determined from security groups, and the backend enforces role permissions on API calls. This phase delivers the app shell, authentication flow, and role resolution — not any business features like vehicles or bookings.

</domain>

<decisions>
## Implementation Decisions

### App shell & navigation
- Sidebar navigation on the left, content area on the right
- Sidebar is always expanded (not collapsible)
- App logo and "RentAVehicle" name displayed in the sidebar header
- Initial view shows a welcome state with user's name, role badge, and loading transition into the webpart shell
- Admin-only nav items are hidden completely from non-admin users (not greyed out)

### Role assignment & display
- Roles assigned via Entra ID security groups (e.g., RentAVehicle-Admins, RentAVehicle-Managers)
- If a user belongs to multiple groups, highest privilege wins (Admin > Manager > Employee)
- Users with no security group assignment default to Employee role
- Role badge placement: Claude's discretion

### Auth failure states
- SSO failure or consent needed: inline error message inside the webpart with a "Try again" button
- Configurable IT support contact: site admin can set a support email/link in webpart properties, shown in error messages
- Token expiry: Claude's discretion on refresh strategy

### Teams mobile layout
- Below 768px (tablet breakpoint): sidebar replaced with bottom tab bar
- Bottom tabs show top 3-4 items plus a "More" tab for the rest
- Role badge hidden on mobile — accessible via profile/settings area
- Above 768px: standard sidebar layout

### Claude's Discretion
- Role badge placement in the sidebar (header vs footer)
- Token refresh strategy for expired sessions
- Loading skeleton and transition animation design
- Exact spacing, typography, and color scheme
- Error state design details beyond the inline + retry pattern

</decisions>

<specifics>
## Specific Ideas

- Welcome state with role badge as a loading/splash screen that transitions into the webpart — not a permanent landing page
- Bottom tab bar on mobile should feel native, like standard mobile app navigation
- Error messages should include configurable IT contact, not hardcoded

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-authentication*
*Context gathered: 2026-02-23*
