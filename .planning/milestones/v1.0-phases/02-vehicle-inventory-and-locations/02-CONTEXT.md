# Phase 2: Vehicle Inventory and Locations - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin fleet management: CRUD operations for vehicles with status tracking, and automatic location sync from Entra ID corporate directory. Location admins manage vehicles at their own office; super admins have full control across all locations. Employee browsing/booking is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Fleet list view
- Data table layout — rows with columns, sortable and filterable
- Full filter bar: location, status, category, and free-text search across make/model/plate
- Small vehicle thumbnail in first column for visual identification
- Row actions menu (three-dot) for Edit, Change Status, Remove
- No click-through detail panel — actions accessible via row menu

### Vehicle form experience
- Full page form for add/edit (navigates away from fleet table)
- Single photo upload per vehicle
- Admin-defined vehicle categories — admins can create/edit category list (needs category management UI)
- Soft delete for vehicle removal — archived and hidden, data retained, can be restored

### Vehicle statuses
- Four statuses: Available, In Maintenance, Retired, Reserved (auto-set when booked)
- All status changes require confirmation dialog explaining what will happen
- Retired is reversible — admin can bring a retired vehicle back to available
- Colored badge pills in fleet table: green=available, yellow=maintenance, red=retired, blue=reserved

### Location sync
- Locations auto-synced from Entra ID, read-only (no custom locations)
- Sync triggers: on app startup + manual "Sync Locations" button for admins
- Dedicated locations list view in admin showing all synced offices with vehicle counts per location
- If a location disappears from Entra ID, vehicles assigned there are flagged for reassignment — admin must move them to another location

### Admin scoping (new: location-scoped access)
- New "SuperAdmin" Entra ID app role (4th role alongside Employee, Manager, Admin)
- Location Admin: sees and manages only vehicles at their own office (determined by Entra ID officeLocation attribute)
- Super Admin: full control everywhere — can add/edit/remove vehicles at any location, view all locations
- Location admins have no visibility into other locations

### Claude's Discretion
- Exact table column order and default sort
- Form field layout and validation messaging
- Category management UI approach (inline vs separate page)
- Confirmation dialog wording
- Sync error handling and retry behavior
- How to handle vehicles with no photo

</decisions>

<specifics>
## Specific Ideas

- Location admin scoping based on Entra ID officeLocation — no manual assignment needed
- Super Admin role is for developers/superiors who need cross-location oversight
- Vehicles are never truly deleted — soft delete ensures data integrity for historical bookings

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-vehicle-inventory-and-locations*
*Context gathered: 2026-02-23*
