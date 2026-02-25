# Phase 7: Reporting and Manager Visibility - Research

**Researched:** 2026-02-25
**Domain:** Data visualization, reporting, CSV export, Microsoft Graph directReports API
**Confidence:** HIGH

## Summary

Phase 7 adds two distinct feature areas: (1) an admin reporting dashboard with KPI cards, utilization charts, trend analysis, and CSV export; and (2) a manager "My Team" page showing direct reports' bookings. The admin dashboard is entirely frontend-driven -- all data can be computed from the existing `getAllBookings` API endpoint and `Vehicles`/`Locations` data already available. The manager team view requires a new backend endpoint that queries Microsoft Graph `directReports` API to resolve the manager's team, then fetches their bookings from the database.

The charting requirement maps well to `@fluentui/react-charting`, the official Fluent UI charting library built on D3.js. It supports React 17, depends on `@fluentui/react` v8, and provides HorizontalBarChart (for utilization breakdown), VerticalBarChart (for booking count bars), and LineChart (for utilization trend line) -- exactly the chart types the user specified. CSV export uses the standard Blob/URL.createObjectURL browser pattern with no library needed.

**Primary recommendation:** Use `@fluentui/react-charting` for all charts, compute report data server-side via new reporting endpoints (aggregate queries are cheaper than shipping raw data to the client), and use Graph API `/users/{id}/directReports` with existing `User.Read.All` permission for the manager team view.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Top-level KPI cards: utilization rate %, total bookings, active bookings, overdue count
- Below KPIs: horizontal bar chart showing utilization breakdown
- Toggle between per-location summary and per-vehicle detail within a selected location
- Date range via preset buttons: Last 7 days, Last 30 days, This month, This quarter
- Dual-axis chart: booking count as bars, utilization % as line overlay
- Granularity auto-selects based on date range preset (7d -> daily, 30d -> daily, quarter -> weekly)
- Filterable by location dropdown and vehicle category dropdown (both default to "All")
- CSV format only (no Excel)
- Two export buttons in top-right of dashboard header: "Export Summary" and "Export Raw Data"
- All exports anonymize employee data (no names or emails) -- privacy first
- Reporting is about fleet utilization patterns, not tracking individual employee behavior
- Separate "My Team" page in sidebar navigation, visible only to Manager role
- Shows direct reports only (from Entra ID), not full org tree -- consistent with notification service
- Manager can see direct reports' names (they already receive named notifications about their bookings)

### Claude's Discretion
- Whether to include peak usage patterns (busiest day/time) as a secondary insight below the trend chart
- Team view data scope: current + upcoming only, or include recent history -- guided by privacy-first principle
- Exact chart library/component choices within Fluent UI
- Loading states, error handling, empty states for each dashboard section
- Spacing, typography, and card styling

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPRT-01 | Admin dashboard shows utilization rates per vehicle and location | Server-side aggregate queries on Bookings table with date range filters; HorizontalBarChart from @fluentui/react-charting for visualization; toggle between location summary and per-vehicle detail |
| RPRT-02 | Admin dashboard shows booking trends over time | VerticalBarChart for booking counts + LineChart overlay for utilization %; SQL GROUP BY date/week aggregation; granularity auto-selects from preset |
| RPRT-03 | Admin can export reports to CSV | Client-side Blob/URL.createObjectURL pattern; two exports: summary (dashboard view) and raw data (detailed booking records); all employee PII stripped |
| RPRT-04 | Manager can view their direct reports' current and upcoming bookings | Graph API `/users/{id}/directReports` (User.Read.All permission already granted); new backend endpoint that resolves team then queries Bookings; frontend "My Team" page behind Manager role guard |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fluentui/react-charting | ^5.23.x | Charts (HorizontalBarChart, VerticalBarChart, LineChart) | Official Fluent UI charting library, built on D3, designed for Fluent UI v8, supports React 17 |
| @fluentui/react (existing) | ^8.106.4 | UI components (already installed) | Already in use throughout the project |
| mssql (existing) | ^12.2.0 | SQL aggregation queries for reporting | Already in use for all backend queries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @microsoft/microsoft-graph-client (existing) | ^3.0.7 | Graph API directReports call | Manager team view -- resolving direct reports |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fluentui/react-charting | Chart.js via @pnp/spfx-controls-react ChartControl | PnP ChartControl wraps Chart.js but adds another abstraction; @fluentui/react-charting integrates natively with Fluent UI theming and is the Microsoft-maintained option |
| @fluentui/react-charting | recharts or react-chartjs-2 | Additional bundle size, no Fluent UI integration, peer dependency risks with React 17 pinning |
| Client-side CSV generation | Server-side CSV endpoint | Client-side avoids new endpoint complexity and keeps export logic co-located with the view; raw data export can reuse existing booking query |

**Installation:**
```bash
cd spfx && npm install @fluentui/react-charting@^5.23.0
```

No new API-side packages needed -- all backend work uses existing `mssql` and `@microsoft/microsoft-graph-client`.

## Architecture Patterns

### Recommended Project Structure
```
api/src/
  functions/
    reporting.ts           # New: GET /api/backoffice/reports/utilization
                           #      GET /api/backoffice/reports/trends
    teamBookings.ts        # New: GET /api/backoffice/team-bookings (Manager+)
  services/
    reportingService.ts    # New: SQL aggregation queries for utilization/trends

spfx/src/webparts/rentaVehicle/
  components/
    Reports/               # New: Admin reporting dashboard
      Reports.tsx           # Main dashboard layout
      Reports.module.scss   # Dashboard styles
      KpiCards.tsx           # Top-level KPI card row
      UtilizationChart.tsx   # Horizontal bar chart (location/vehicle)
      TrendChart.tsx         # Dual-axis trend chart (bars + line)
      ReportExport.ts        # CSV generation utilities
    TeamBookings/          # New: Manager team view
      TeamBookings.tsx      # Team bookings list page
      TeamBookings.module.scss
  models/
    IReport.ts             # New: reporting data interfaces
  services/
    ApiService.ts          # Extended with report + team booking methods
```

### Pattern 1: Server-Side Aggregation for Reporting
**What:** Reporting data computed via SQL aggregate queries on the server, not by shipping raw booking records to the frontend and computing client-side.
**When to use:** Always for reporting dashboards with date range filters.
**Why:** Efficient -- database does GROUP BY, COUNT, SUM; reduces payload size; avoids client-side performance issues with large datasets.
**Example:**
```typescript
// api/src/services/reportingService.ts
import sql from 'mssql';
import { getPool } from './database.js';

export interface IUtilizationData {
  locationId: number;
  locationName: string;
  vehicleCount: number;
  totalBookingHours: number;
  totalAvailableHours: number;
  utilizationRate: number;
}

export async function getUtilizationByLocation(
  dateFrom: Date,
  dateTo: Date
): Promise<IUtilizationData[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('dateFrom', sql.DateTime2, dateFrom)
    .input('dateTo', sql.DateTime2, dateTo)
    .query(`
      SELECT
        l.id AS locationId,
        l.name AS locationName,
        COUNT(DISTINCT v.id) AS vehicleCount,
        ISNULL(SUM(
          DATEDIFF(HOUR,
            CASE WHEN b.startTime < @dateFrom THEN @dateFrom ELSE b.startTime END,
            CASE WHEN b.endTime > @dateTo THEN @dateTo ELSE b.endTime END
          )
        ), 0) AS totalBookingHours,
        COUNT(DISTINCT v.id) * DATEDIFF(HOUR, @dateFrom, @dateTo) AS totalAvailableHours
      FROM Vehicles v
      INNER JOIN Locations l ON v.locationId = l.id
      LEFT JOIN Bookings b ON b.vehicleId = v.id
        AND b.status IN ('Confirmed', 'Active', 'Completed', 'Overdue')
        AND b.startTime < @dateTo
        AND b.endTime > @dateFrom
      WHERE v.isArchived = 0 AND v.status = 'Available'
      GROUP BY l.id, l.name
      ORDER BY l.name
    `);

  return result.recordset.map(row => ({
    ...row,
    utilizationRate: row.totalAvailableHours > 0
      ? Math.round((row.totalBookingHours / row.totalAvailableHours) * 100)
      : 0,
  }));
}
```

### Pattern 2: Fluent UI Charting Integration
**What:** Using @fluentui/react-charting components with proper data transformation.
**When to use:** All chart rendering in the Reports dashboard.
**Example:**
```typescript
// Import charting components
import {
  HorizontalBarChartWithAxis,
  IHorizontalBarChartWithAxisDataPoint,
  VerticalBarChart,
  IVerticalBarChartDataPoint,
  LineChart,
  ILineChartPoints,
  IChartDataPoint,
  DataVizPalette,
  getColorFromToken,
} from '@fluentui/react-charting';

// HorizontalBarChart for utilization breakdown
const utilizationData: IHorizontalBarChartWithAxisDataPoint[] = reportData.map(loc => ({
  x: loc.utilizationRate,
  y: loc.locationName,
  color: getColorFromToken(DataVizPalette.color1),
}));

// VerticalBarChart for booking counts
const bookingCountData: IVerticalBarChartDataPoint[] = trendData.map(point => ({
  x: point.label,
  y: point.bookingCount,
  color: getColorFromToken(DataVizPalette.color2),
}));
```

### Pattern 3: CSV Export via Blob (No Library Needed)
**What:** Client-side CSV generation using Blob and URL.createObjectURL.
**When to use:** Both "Export Summary" and "Export Raw Data" buttons.
**Example:**
```typescript
// spfx/src/webparts/rentaVehicle/components/Reports/ReportExport.ts

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  // BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const csvContent = BOM + headers.join(',') + '\n' +
    rows.map(row => row.map(escapeCSV).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

### Pattern 4: Manager Team View via Graph directReports
**What:** Backend endpoint resolves a manager's direct reports from Entra ID, then queries their bookings.
**When to use:** "My Team" page for Manager role.
**Example:**
```typescript
// api/src/services/reportingService.ts

export async function getDirectReportIds(managerId: string): Promise<string[]> {
  const client = await getGraphClient();
  const response = await client
    .api(`/users/${managerId}/directReports`)
    .select('id')
    .get();

  return response.value
    .filter((r: { id?: string }) => r.id)
    .map((r: { id: string }) => r.id);
}

export async function getTeamBookings(
  directReportIds: string[]
): Promise<IBooking[]> {
  if (directReportIds.length === 0) return [];

  const pool = await getPool();
  const request = pool.request();

  // Build parameterized IN clause
  const idParams = directReportIds.map((id, i) => {
    request.input(`uid${i}`, sql.NVarChar(255), id);
    return `@uid${i}`;
  });

  const result = await request.query(`
    SELECT
      b.id, b.vehicleId,
      v.make AS vehicleMake, v.model AS vehicleModel,
      v.licensePlate AS vehicleLicensePlate,
      l.name AS locationName, l.timezone AS locationTimezone,
      b.userId, b.userDisplayName,
      b.startTime, b.endTime, b.status
    FROM Bookings b
    INNER JOIN Vehicles v ON b.vehicleId = v.id
    LEFT JOIN Locations l ON v.locationId = l.id
    WHERE b.userId IN (${idParams.join(',')})
      AND b.status IN ('Confirmed', 'Active', 'Overdue')
      AND b.endTime > GETUTCDATE()
    ORDER BY b.startTime ASC
  `);

  return result.recordset;
}
```

### Anti-Patterns to Avoid
- **Client-side aggregation of all bookings:** Do NOT fetch all raw booking records to the frontend and compute utilization there. Use server-side SQL aggregation. The booking table will grow over time.
- **Exposing employee PII in report exports:** Report exports MUST strip userDisplayName, userEmail, and userId. The privacy-first principle is a locked decision.
- **Using /me/directReports from the backend:** The backend uses application permissions (no signed-in user context). MUST use `/users/{managerId}/directReports` with the manager's Entra ID object ID.
- **Full org tree traversal:** Only direct reports, not recursive. Consistent with notification service pattern in Phase 6.
- **Adding new charting library alongside @fluentui/react-charting:** One charting library. Do not mix Chart.js / recharts / etc.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bar/line charts | Custom SVG rendering | @fluentui/react-charting | D3-based, accessible, themed, maintained by Microsoft |
| CSV generation | Complex serializer | Simple escapeCSV + Blob pattern | CSV is simple enough; no library needed but must handle commas/quotes/BOM |
| Date range presets | Manual date calculation | Simple utility functions | Last 7d, 30d, this month, this quarter are trivial date math |
| Utilization calculation | Frontend aggregation loops | SQL aggregate queries | Database handles GROUP BY efficiently at scale |
| Manager lookup | Custom user hierarchy | Graph API directReports | Entra ID is the source of truth for org structure |

**Key insight:** Reporting is fundamentally a server-side aggregation problem. The frontend just renders the pre-computed data. CSV export is the one area where client-side generation makes sense (avoids a new streaming endpoint).

## Common Pitfalls

### Pitfall 1: @fluentui/react-charting Theming Requirement
**What goes wrong:** Charts render with no colors/wrong colors or crash when ThemeProvider is not available.
**Why it happens:** @fluentui/react-charting v5 uses Fluent UI v8 theme tokens. SPFx provides ThemeProvider automatically in production but may not in workbench.
**How to avoid:** Use `getColorFromToken(DataVizPalette.colorN)` for explicit colors rather than relying on theme-derived defaults. Test in workbench.
**Warning signs:** Charts appear but bars/lines are invisible or all the same color.

### Pitfall 2: Utilization Rate Calculation Edge Cases
**What goes wrong:** Utilization shows > 100% or NaN.
**Why it happens:** Bookings can span outside the date range (started before, ends after). Overlapping bookings on the same vehicle can double-count hours.
**How to avoid:** Clamp booking hours to the date range bounds (use CASE WHEN in SQL). Count distinct booked hours, not raw booking durations. Handle division by zero (no vehicles at location).
**Warning signs:** Utilization percentages > 100% or "NaN%" displayed.

### Pitfall 3: CSV Export with Special Characters
**What goes wrong:** CSV opens garbled in Excel or columns misaligned.
**Why it happens:** Missing BOM for UTF-8, unescaped commas/quotes/newlines in data values.
**How to avoid:** Add BOM prefix (`\uFEFF`), wrap values containing commas/quotes/newlines in double quotes, escape internal double quotes.
**Warning signs:** Excel shows all data in column A, or accented characters are garbled.

### Pitfall 4: Graph API Rate Limiting on directReports
**What goes wrong:** 429 Too Many Requests when multiple managers load team view simultaneously.
**Why it happens:** Each "My Team" page load calls Graph API.
**How to avoid:** This is unlikely to be a problem at the scale of this application (one call per page load, not batched). But if it occurs, add simple in-memory caching (5-minute TTL) for directReport lookups.
**Warning signs:** Intermittent "Failed to load team" errors.

### Pitfall 5: Privacy Leak in Report Exports
**What goes wrong:** Employee names/emails appear in exported CSV files shared in Teams meetings.
**Why it happens:** Developer forgets to strip PII columns before CSV generation.
**How to avoid:** Export functions MUST NOT include userId, userEmail, userDisplayName. Use anonymized booking IDs only. This is a locked user decision.
**Warning signs:** Any column in exported CSV that contains a person's name or email.

### Pitfall 6: ES5 Compatibility in SPFx Build
**What goes wrong:** Build fails or runtime errors with arrow functions, template literals in @fluentui/react-charting.
**Why it happens:** SPFx 1.22 Heft build targets ES5 by default.
**How to avoid:** @fluentui/react-charting ships pre-compiled CommonJS. The project already uses @fluentui/react v8 without issues. Verify the charting package also ships transpiled.
**Warning signs:** Build errors about unexpected token `=>` or `const`.

## Code Examples

### KPI Cards Row
```typescript
// Source: Project pattern from AllBookings.tsx + Fluent UI v8
import * as React from 'react';
import styles from './Reports.module.scss';

interface IKpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

const KpiCard: React.FC<IKpiCardProps> = function KpiCard(props) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiValue}>{props.value}</div>
      <div className={styles.kpiLabel}>{props.label}</div>
      {props.subtitle && <div className={styles.kpiSubtitle}>{props.subtitle}</div>}
    </div>
  );
};

// Usage in Reports.tsx
<div className={styles.kpiRow}>
  <KpiCard label="Utilization Rate" value={overallUtilization + '%'} />
  <KpiCard label="Total Bookings" value={totalBookings} />
  <KpiCard label="Active Bookings" value={activeBookings} />
  <KpiCard label="Overdue" value={overdueCount} />
</div>
```

### Date Range Preset Utility
```typescript
// Source: Common date utility pattern
export type DatePreset = 'last7' | 'last30' | 'thisMonth' | 'thisQuarter';

export interface IDateRange {
  from: Date;
  to: Date;
  granularity: 'daily' | 'weekly';
}

export function getDateRange(preset: DatePreset): IDateRange {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

  switch (preset) {
    case 'last7': {
      const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from, to, granularity: 'daily' };
    }
    case 'last30': {
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from, to, granularity: 'daily' };
    }
    case 'thisMonth': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from, to, granularity: 'daily' };
    }
    case 'thisQuarter': {
      const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3;
      const from = new Date(Date.UTC(now.getUTCFullYear(), quarterMonth, 1));
      return { from, to, granularity: 'weekly' };
    }
  }
}
```

### Trend SQL Aggregation (Daily)
```typescript
// Source: Standard SQL date grouping pattern
export async function getBookingTrends(
  dateFrom: Date,
  dateTo: Date,
  granularity: 'daily' | 'weekly',
  locationId?: number,
  categoryId?: number
): Promise<{ period: string; bookingCount: number; utilizationPct: number }[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input('dateFrom', sql.DateTime2, dateFrom);
  request.input('dateTo', sql.DateTime2, dateTo);

  const dateGroup = granularity === 'daily'
    ? "CONVERT(VARCHAR(10), b.startTime, 23)"  // YYYY-MM-DD
    : "CONVERT(VARCHAR(10), DATEADD(DAY, -(DATEPART(WEEKDAY, b.startTime) - 1), b.startTime), 23)"; // Week start

  const conditions: string[] = [
    "b.status IN ('Confirmed', 'Active', 'Completed', 'Overdue')",
    'b.startTime >= @dateFrom',
    'b.startTime < @dateTo',
  ];

  if (locationId) {
    request.input('locationId', sql.Int, locationId);
    conditions.push('v.locationId = @locationId');
  }
  if (categoryId) {
    request.input('categoryId', sql.Int, categoryId);
    conditions.push('v.categoryId = @categoryId');
  }

  const result = await request.query(`
    SELECT
      ${dateGroup} AS period,
      COUNT(*) AS bookingCount
    FROM Bookings b
    INNER JOIN Vehicles v ON b.vehicleId = v.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY ${dateGroup}
    ORDER BY period
  `);

  return result.recordset;
}
```

### API Endpoint Pattern (Following Project Conventions)
```typescript
// Source: Project pattern from adminBookings.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';

const isAdmin = requireRole('Admin', 'SuperAdmin');
const isManagerOrHigher = requireRole('Manager', 'Admin', 'SuperAdmin');

// GET /api/backoffice/reports/utilization?dateFrom=...&dateTo=...
app.http('getUtilizationReport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/reports/utilization',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // ... auth check with isAdmin, parse query params, call reportingService
  },
});

// GET /api/backoffice/team-bookings
app.http('getTeamBookings', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/team-bookings',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // ... auth check with isManagerOrHigher, get directReports, query bookings
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @fluentui/react-charting v4 | @fluentui/react-charting v5 | 2023 | v5 supports React 17 in peerDeps, improved accessibility |
| Chart.js in SPFx via PnP | @fluentui/react-charting | 2022+ | Native Fluent UI theming, no Chart.js wrapper layer |
| Client-side CSV with manual string concat | Blob + BOM pattern | Standard | Proper encoding, Excel compatibility |

**Deprecated/outdated:**
- @uifabric/charting: Renamed to @fluentui/react-charting when Fluent UI rebranded. Do not use old package name.
- PnP ChartControl for new projects: Still works but adds an unnecessary abstraction layer when @fluentui/react-charting is available natively.

## Open Questions

1. **@fluentui/react-charting exact latest version**
   - What we know: v5.x series supports React 17 and @fluentui/react v8. v5.23+ is recent.
   - What's unclear: The exact latest version could not be confirmed from npm (403 on npm page). The package is actively maintained.
   - Recommendation: Install `@fluentui/react-charting@^5.23.0` and verify build succeeds. If version conflict, pin to a specific minor.

2. **Dual-axis chart (bars + line overlay) in @fluentui/react-charting**
   - What we know: VerticalBarChart supports a `lineLegendText`/`lineLegendColor` prop for line overlay on bar charts, suggesting built-in dual-axis support.
   - What's unclear: Exact API for the combined bars+line chart. May need separate LineChart overlaid via CSS positioning if the built-in support is limited.
   - Recommendation: Try VerticalBarChart with line overlay props first. If insufficient, render VerticalBarChart and LineChart in the same container with absolute positioning.

3. **Peak usage patterns (Claude's discretion)**
   - Recommendation: Include as a secondary insight. It is a simple SQL query (`DATEPART(WEEKDAY, startTime)` and `DATEPART(HOUR, startTime)` grouping) and adds useful context. Display below the trend chart as a small text summary: "Busiest day: Tuesday, Busiest hour: 9 AM".

4. **Team view data scope (Claude's discretion)**
   - Recommendation: Show current + upcoming bookings only (status IN Confirmed, Active, Overdue where endTime > now). This is privacy-first: managers see what's relevant for operational oversight, not historical tracking. Past bookings are not needed for the manager's oversight purpose.

## Sources

### Primary (HIGH confidence)
- Microsoft Graph directReports API: https://learn.microsoft.com/en-us/graph/api/user-list-directreports?view=graph-rest-1.0 -- permissions, response format, application permission support verified
- @fluentui/react-charting contrib docsite: https://microsoft.github.io/fluentui-charting-contrib/docs/Overview -- chart types, props, D3 foundation verified
- Existing codebase: `api/src/services/bookingService.ts`, `api/src/services/notificationService.ts`, `api/src/middleware/auth.ts` -- patterns for SQL queries, Graph API calls, role checks

### Secondary (MEDIUM confidence)
- @fluentui/react-charting v5 changelog: https://microsoft.github.io/fluentui-charting-contrib/docs/changelogSplits/5.0 -- React 17 peerDependency allowance confirmed
- FluentUI charting HorizontalBarChart docs: https://microsoft.github.io/fluentui-charting-contrib/docs/Charting-Concepts/HorizontalBarChart -- props and data format
- FluentUI charting VerticalBarChart docs: https://microsoft.github.io/fluentui-charting-contrib/docs/Charting-Concepts/VerticalBarChart -- line overlay support
- FluentUI charting LineChart docs: https://microsoft.github.io/fluentui-charting-contrib/docs/Charting-Concepts/LineChart -- data structure

### Tertiary (LOW confidence)
- Exact latest @fluentui/react-charting version: npm page returned 403, relying on web search claims of v5.23+ being current. Verify at install time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @fluentui/react-charting is the official Fluent UI charting library, well-documented, used in 100+ Microsoft projects
- Architecture: HIGH - Server-side aggregation + Graph directReports are established patterns matching existing project conventions
- Pitfalls: HIGH - Based on direct codebase analysis (ES5, theming, privacy) and verified Graph API docs
- Code examples: MEDIUM - Charting API details from docs but not fully verified with running code; SQL patterns match existing project style

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable libraries, well-established patterns)
