# Phase 7: Reporting and Manager Visibility - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Fleet admins can analyze utilization patterns and export data, and managers can see their team's rental activity. This phase delivers an admin reporting dashboard with KPI cards, trend charts, and CSV exports, plus a manager-only "My Team" page showing direct reports' bookings. All reporting data is anonymized for employee privacy — reporting tracks fleet utilization patterns, not individual employee behavior.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout and metrics
- Top-level KPI cards: utilization rate %, total bookings, active bookings, overdue count
- Below KPIs: horizontal bar chart showing utilization breakdown
- Toggle between per-location summary and per-vehicle detail within a selected location
- Date range via preset buttons: Last 7 days, Last 30 days, This month, This quarter

### Trend analysis
- Dual-axis chart: booking count as bars, utilization % as line overlay
- Granularity auto-selects based on date range preset (7d -> daily, 30d -> daily, quarter -> weekly)
- Filterable by location dropdown and vehicle category dropdown (both default to "All")

### Export format and content
- CSV format only (no Excel)
- Two export buttons in top-right of dashboard header:
  - "Export Summary" — downloads the dashboard view data
  - "Export Raw Data" — downloads detailed booking records for the selected period
- All exports anonymize employee data (no names or emails) — privacy first
- Reporting is about fleet utilization patterns, not tracking individual employee behavior

### Manager team view
- Separate "My Team" page in sidebar navigation, visible only to Manager role
- Shows direct reports only (from Entra ID), not full org tree — consistent with notification service
- Manager can see direct reports' names (they already receive named notifications about their bookings)

### Claude's Discretion
- Whether to include peak usage patterns (busiest day/time) as a secondary insight below the trend chart
- Team view data scope: current + upcoming only, or include recent history — guided by privacy-first principle
- Exact chart library/component choices within Fluent UI
- Loading states, error handling, empty states for each dashboard section
- Spacing, typography, and card styling

</decisions>

<specifics>
## Specific Ideas

- Privacy is the top priority for reporting — even though admins see names in operational views (All Bookings), reporting and exports must anonymize employee data so it can be shared in Teams or presented without exposing individual behavior
- The distinction: operational views (All Bookings) show names for managing bookings; reporting views show aggregate/anonymous data for analyzing fleet patterns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-reporting-and-manager-visibility*
*Context gathered: 2026-02-25*
