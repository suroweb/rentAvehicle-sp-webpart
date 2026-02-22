# Stack Research

**Domain:** Internal enterprise vehicle rental application on M365/Azure
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

The user's proposed stack (Azure SQL, Azure Functions, SPFx, Entra ID, Graph API) is well-validated and represents the standard enterprise M365/Azure architecture for this class of application. Each choice is the correct one for the requirements. This document validates each component, provides exact versions, explains why alternatives were rejected, and flags the few areas requiring careful implementation.

---

## Recommended Stack

### Frontend — SharePoint Framework (SPFx)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SPFx | 1.22.0 | Web part framework for SharePoint/Teams | Only framework that embeds natively in both SharePoint pages and Teams tabs. Full developer control over UI/UX, TypeScript-first, Heft-based build toolchain. No viable alternative for the dual SharePoint+Teams requirement. |
| React | 17.0.1 (exact) | UI component library | Mandated by SPFx 1.22 compatibility matrix. Must use `--save-exact` flag. Do NOT use React 18 — it causes silent runtime failures in SPFx. |
| TypeScript | 5.8 | Type-safe development | Default in SPFx 1.22 scaffolded projects. Supports latest language features. |
| Node.js | 22 LTS | Runtime for development | Required by SPFx 1.22. Support through April 2027. |
| Fluent UI React v8 | 8.x (latest) | UI component library | Ships with SPFx and matches SharePoint's native look. Fluent UI v9 is technically usable since SPFx 1.19 but has known issues (Dialog renders outside webpart context, FluentProvider scoping problems). Stick with v8 for stability; v9 can be introduced incrementally for specific components if needed. |
| Heft (RushStack) | Bundled with SPFx 1.22 | Build orchestrator | Replaces gulp as of SPFx 1.22. Uses Webpack 5 under the hood. All new projects must use Heft — gulp is legacy. |

**Confidence: HIGH** — Versions verified against [SPFx 1.22 release notes](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.22) and [SPFx compatibility matrix](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility).

### Database — Azure SQL Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Azure SQL Database | Serverless tier, General Purpose | Primary data store for vehicles, bookings, users, locations | Relational data model (vehicles belong to locations, bookings reference vehicles and users) maps naturally to SQL. Complex reporting queries (utilization rates, trends, joins across entities) require SQL. Serverless tier auto-pauses during inactivity — ideal for internal app with business-hours usage. |

**Recommended tier:** Serverless, General Purpose, vCore model
- Auto-pause delay: 15 minutes (minimum) for cost optimization
- Min vCores: 0.5, Max vCores: 2 (scale up if needed)
- Storage: starts at 5 GB, scales to 32 GB as needed
- Estimated cost: ~$5-15/month for a lightly-used internal app (storage-only when paused)

**Confidence: HIGH** — Azure SQL is the standard choice for relational enterprise workloads. Serverless pricing verified via [Azure SQL serverless documentation](https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-overview).

### Backend API — Azure Functions

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Azure Functions | Runtime 4.x | Serverless API layer | Pay-per-execution model is cost-effective for internal app with intermittent usage. Native Entra ID integration. Built-in bindings for Azure SQL, Graph API, Service Bus. HTTP triggers serve as REST API endpoints. Timer triggers handle scheduled tasks (return reminders, calendar sync). |
| @azure/functions | 4.11.2 | Node.js programming model v4 | Latest stable. Defines functions programmatically in TypeScript. Must be in `dependencies` (not devDependencies). |
| Node.js | 22 LTS | Runtime | GA support, end-of-support April 2027. Matches SPFx dev environment. |
| TypeScript | 5.x | Backend language | Consistent with SPFx frontend. First-class support in Azure Functions v4. |

**Recommended plan:** Flex Consumption
- Per-function scaling, reduced cold starts with always-ready instances
- Virtual network support if needed later
- Slightly more expensive than legacy Consumption but Azure's recommended plan for new apps
- Monthly free grant: 250,000 executions + 100,000 GB-s

**Confidence: HIGH** — Versions verified via [Azure Functions runtime versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions) and [@azure/functions npm](https://www.npmjs.com/package/@azure/functions).

### Authentication & Authorization — Microsoft Entra ID

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Microsoft Entra ID | N/A (platform service) | SSO, role-based access control | Only identity provider for internal M365 users. App roles (Employee, Manager, Admin) defined in app registration and assigned via Entra ID groups. No alternative — this is the identity layer. |
| SPFx AadHttpClient | Bundled with SPFx | Authenticated API calls from webpart | Built-in SPFx class for calling Entra ID-secured APIs. Handles token acquisition transparently using the logged-in user's context. Recommended over raw MSAL for SPFx scenarios. |
| @azure/msal-node | Latest (for Functions) | Server-side auth in Azure Functions | For on-behalf-of (OBO) flow: Functions receives user token from SPFx, exchanges it for Graph API token. Required for delegated Graph operations (creating calendar events as the user). |

**Auth flow:** SPFx (AadHttpClient) --> Azure Functions (validates token, uses OBO flow) --> Graph API / Azure SQL

**App registrations required:**
1. **Backend API app** — Exposes API with `user_impersonation` scope, has Graph API delegated permissions
2. **SPFx permission request** — In `package-solution.json`, requests access to backend API app

**Confidence: HIGH** — Well-documented pattern. See [Securing Azure Functions with Entra ID for SPFx](https://www.voitanos.io/blog/securing-an-azure-function-app-with-azure-ad-works-with-with-sharepoint-framework/).

### Microsoft Graph API

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Microsoft Graph REST API | v1.0 | Calendar, mail, user/group data | Stable production API. Use for: creating events on equipment resource calendars (vehicle bookings visible in Outlook), sending email notifications, reading user profiles and office locations from Entra ID. |
| @microsoft/microsoft-graph-client | 3.0.7 | JS/TS SDK for Graph calls | Mature, stable client library. Note: Microsoft is developing a newer `@microsoft/msgraph-sdk` (currently 1.0.0-preview) — do NOT use the preview for production. Stick with 3.0.7. |

**Vehicle resource calendars approach:**
- Each vehicle gets an **equipment mailbox** in Exchange Online (created by Exchange admin)
- Equipment mailboxes have calendars and can auto-accept meeting requests based on availability
- Graph API creates events on the equipment mailbox calendar when a booking is made
- Employees see vehicle bookings in Outlook if they are attendees
- **Limitation:** Resource mailbox calendars do NOT support webhook subscriptions — must poll for changes

**Confidence: HIGH** — Equipment mailboxes for vehicles are a documented pattern. See [Graph API calendar overview](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview) and [room resource type](https://learn.microsoft.com/en-us/graph/api/resources/room?view=graph-rest-1.0).

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @pnp/sp | 4.17.0 | Fluent SharePoint REST API | For any direct SharePoint operations (if needed for site-level config, permissions). Not the primary data layer — Azure SQL is. |
| @pnp/graph | 4.17.0 | Fluent Graph API wrapper | Alternative to raw Graph SDK for simpler calls. Use alongside @microsoft/microsoft-graph-client. |
| @pnp/spfx-controls-react | 3.23.0 | Reusable SPFx React controls | DateTimePicker, PeoplePicker, ListView, and other pre-built controls that match SharePoint UX. Saves significant development time. |
| @pnp/spfx-property-controls | 3.x (latest) | Web part property pane controls | Custom property pane editors for web part configuration. |
| @fluentui/react | 8.x (bundled) | UI components | Primary UI library. Buttons, Dropdowns, DetailsList, Panel, Dialog, Calendar, etc. |
| date-fns or luxon | Latest | Date/time/timezone handling | UTC storage, local display per location. date-fns-tz for timezone conversions. Critical for global fleet with multiple timezones. Do NOT use moment.js (deprecated, large bundle). |
| tedious | 18.x | Azure SQL driver for Node.js | Used by Azure Functions to connect to Azure SQL. Microsoft's official TDS driver. |
| @azure/identity | Latest | Azure credential management | DefaultAzureCredential for managed identity auth from Functions to SQL (passwordless). |
| zod | 3.x | Runtime schema validation | Validate API request/response shapes. Lightweight, TypeScript-first. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @microsoft/generator-sharepoint | SPFx project scaffolding | Install globally: `npm install -g @microsoft/generator-sharepoint@latest`. Generates Heft-based projects as of 1.22. |
| Azure Functions Core Tools | Local Functions development | `npm install -g azure-functions-core-tools@4 --unsafe-perm true`. Run Functions locally. |
| Azure Data Studio or SSMS | Database management | Query Azure SQL, manage schema, debug stored procedures. |
| SPFx Fast Serve | Faster local dev builds | Speeds up `serve` by 5-10x. Check compatibility with Heft toolchain (SPFx 1.22). |
| VS Code | IDE | Extensions: SPFx Snippets, Azure Functions, Azure Databases, ESLint, Prettier. |
| Azure Storage Emulator / Azurite | Local storage emulation | Required by Azure Functions Core Tools for local development. |
| Graph Explorer | Test Graph API calls | Browser tool at https://developer.microsoft.com/graph/graph-explorer. Essential for prototyping calendar and mail operations. |

---

## Installation

```bash
# SPFx project scaffolding (global)
npm install -g @microsoft/generator-sharepoint@latest
npm install -g yo

# Azure Functions Core Tools (global)
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# SPFx project dependencies (after scaffolding)
npm install @pnp/sp@4.17.0 @pnp/graph@4.17.0 @pnp/spfx-controls-react@3.23.0
npm install react@17.0.1 react-dom@17.0.1 --save-exact
npm install date-fns date-fns-tz zod

# Azure Functions project dependencies
npm install @azure/functions@4.11.2 @microsoft/microsoft-graph-client@3.0.7
npm install @azure/identity tedious zod
npm install -D typescript @types/node
```

---

## Alternatives Considered

### Frontend: SPFx vs Power Apps

| Criterion | SPFx (Recommended) | Power Apps | Verdict |
|-----------|-------------------|------------|---------|
| SharePoint + Teams embedding | Native web part in both | Embeddable but limited customization | SPFx wins |
| UI/UX control | Full control (React, custom CSS, Fluent UI) | Constrained to Power Apps canvas controls | SPFx wins |
| Complex views (calendar, dashboards) | Build anything with React | Limited charting, no native calendar grid | SPFx wins |
| Development speed | Slower (weeks) | Faster (days) | Power Apps wins |
| ALM & DevOps | Full CI/CD, git, versioning | Limited ALM, manual deployment | SPFx wins |
| Reporting dashboards | Custom D3/charting libraries possible | Would need Power BI embedding | SPFx wins |
| Maintenance | Standard web dev skills | Power Platform-specific skills | SPFx wins (for dev team) |

**Decision: SPFx.** The requirements demand a calendar view, complex filtering, admin dashboards with reporting, and deep SharePoint+Teams integration. Power Apps would hit limitations quickly. Power Apps is better suited for simple forms and approval workflows, not data-rich dashboards with custom UX.

**Confidence: HIGH**

### Database: Azure SQL vs SharePoint Lists vs Cosmos DB

| Criterion | Azure SQL (Recommended) | SharePoint Lists | Cosmos DB |
|-----------|------------------------|------------------|-----------|
| Relational queries | Full T-SQL, JOINs, aggregations | No JOINs, no aggregations | No JOINs (document model) |
| Item limits | Billions of rows | 5,000 item view threshold, 30M max | Unlimited |
| Reporting | Native SQL aggregations, GROUP BY, window functions | Would require Power Automate + manual aggregation | Possible but requires denormalization |
| Complex queries | Booking overlaps, availability checks, utilization | Extremely difficult | Possible but unnatural for relational data |
| Cost | ~$5-15/month serverless | Included in M365 license | Minimum ~$25/month (400 RU/s) |
| Schema enforcement | Strong typing, foreign keys, constraints | Loose column types, no referential integrity | Schema-free (pro or con) |

**Decision: Azure SQL.** Vehicle rental data is inherently relational: vehicles belong to locations, bookings reference both vehicles and users, availability is a time-range overlap query, reporting needs JOINs and aggregations. SharePoint Lists would fail at the 5,000 item view threshold within months for active organizations and cannot perform availability overlap queries. Cosmos DB is designed for globally distributed, schema-flexible, high-throughput workloads — none of which apply here. It would cost more and make relational queries harder.

**Confidence: HIGH** — The 5,000 item threshold in SharePoint Lists is a hard limit that cannot be changed in SharePoint Online ([Microsoft docs](https://learn.microsoft.com/en-us/troubleshoot/sharepoint/lists-and-libraries/items-exceeds-list-view-threshold)).

### Backend: Azure Functions vs Azure App Service

| Criterion | Azure Functions (Recommended) | Azure App Service |
|-----------|------------------------------|-------------------|
| Cost model | Pay-per-execution (near-zero when idle) | Always-on monthly cost (~$13+/month minimum) |
| Scaling | Auto-scale per function | Manual or auto-scale at app level |
| Cold start | Flex Consumption reduces this; acceptable for internal app | No cold start (always running) |
| API complexity | HTTP triggers = REST endpoints, simple routing | Full Express/Fastify routing, middleware, sessions |
| Graph API integration | Built-in bindings, timer triggers for scheduled sync | Manual setup |
| Scheduled tasks | Timer triggers (native) | Requires separate scheduler |

**Decision: Azure Functions on Flex Consumption plan.** Internal app with business-hours usage means most of the day the API is idle. Pay-per-execution is dramatically cheaper than always-on App Service. Timer triggers natively handle scheduled tasks (return reminders, calendar sync). The API surface is CRUD + Graph operations — simple enough that Functions routing suffices. Cold starts on Flex Consumption are mitigated by always-ready instances.

If the app later needs complex middleware, WebSocket connections, or session management, Azure App Service becomes the better choice. For this project's requirements, Functions is optimal.

**Confidence: HIGH**

### Graph SDK: @microsoft/microsoft-graph-client vs @microsoft/msgraph-sdk

| Criterion | @microsoft/microsoft-graph-client 3.0.7 (Recommended) | @microsoft/msgraph-sdk 1.0.0-preview |
|-----------|--------------------------------------------------------|---------------------------------------|
| Stability | GA, production-ready | Preview, breaking changes expected |
| Maturity | Years in production, well-documented | New, limited documentation |
| Community adoption | 413+ dependents on npm | Minimal adoption |

**Decision: @microsoft/microsoft-graph-client 3.0.7.** The preview SDK is not ready for production. Re-evaluate when @microsoft/msgraph-sdk reaches GA (no announced timeline).

**Confidence: HIGH**

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React 18.x with SPFx | Silent runtime failures. SPFx 1.22 compatibility matrix mandates React 17.0.1 exactly. | React 17.0.1 with `--save-exact` |
| Fluent UI v9 as primary UI library | Known issues with SPFx: Dialog renders outside webpart context, FluentProvider scoping issues. Not officially supported by SPFx. | Fluent UI v8 (ships with SPFx). Use v9 only for specific components with wrappers. |
| gulp for build | Deprecated in SPFx 1.22. Heft is the new standard. Gulp-based projects still work but receive no new features. | Heft (bundled with SPFx 1.22) |
| SharePoint Lists as primary data store | 5,000 item view threshold kills performance. No JOINs. No aggregation queries. No referential integrity. | Azure SQL Database |
| Cosmos DB | Over-engineered for relational booking data. Higher cost ($25+/month minimum). No JOINs. | Azure SQL Database |
| Power Apps as frontend | Limited UI/UX customization. Cannot build calendar grid views, complex dashboards, or custom filtering experiences. Poor ALM. | SPFx with React + Fluent UI |
| moment.js | Deprecated. 300KB+ bundle size. Mutable API. | date-fns + date-fns-tz (tree-shakeable, immutable) |
| @microsoft/msgraph-sdk (preview) | Preview status, breaking changes, minimal docs. | @microsoft/microsoft-graph-client 3.0.7 |
| Azure Functions Consumption plan (legacy) | Flex Consumption has better cold start behavior, per-function scaling, VNet support. Azure recommends Flex for new apps. | Azure Functions Flex Consumption plan |
| MSAL Browser in Azure Functions | Client-side library. Azure Functions runs server-side. | @azure/msal-node for OBO flow in Functions |

---

## Stack Patterns by Variant

**If you need real-time updates (future requirement):**
- Add Azure SignalR Service
- Azure Functions has built-in SignalR bindings
- Push booking changes to connected SPFx clients in real-time

**If you need offline/mobile support (out of scope for v1):**
- Consider Azure App Service + PWA instead of SPFx
- SPFx webparts are inherently online-only within SharePoint/Teams

**If booking volume becomes very high (thousands per day):**
- Move from Azure SQL Serverless to Provisioned tier
- Add Azure Cache for Redis for availability lookups
- Consider Azure Service Bus for decoupling booking creation from calendar sync

**If you need approval workflows later:**
- Power Automate integrates naturally with both Azure SQL (via connectors) and Graph API
- Can be added without architectural changes

---

## Version Compatibility Matrix

| Component | Version | Compatible With | Notes |
|-----------|---------|-----------------|-------|
| SPFx 1.22.0 | 1.22.0 | Node.js 22, TypeScript 2.9-5.8, React 17.0.1 | Heft build toolchain only |
| @azure/functions | 4.11.2 | Node.js 20-22, Azure Functions runtime 4.x | v4 programming model, TypeScript native |
| @pnp/sp | 4.17.0 | SPFx 1.18.2+ | V4 not supported on SPFx <1.14 |
| @pnp/spfx-controls-react | 3.23.0 | SPFx 1.21.1+ (verify 1.22 Heft compat) | Check release notes for 1.22 support |
| @fluentui/react (v8) | 8.x | React 17.0.1, SPFx 1.22 | Ships with SPFx, globally available |
| @microsoft/microsoft-graph-client | 3.0.7 | Node.js 12+ | Stable, production GA |
| Azure SQL Database | Serverless Gen5 | All Azure Functions runtimes | Use managed identity for auth |
| Node.js 22 LTS | 22.x | SPFx 1.22, Azure Functions v4 | End-of-support: April 2027 |
| Node.js 20 LTS | 20.x | Azure Functions v4 | End-of-support: April 2026. Use 22 instead. |

---

## Upcoming Changes to Monitor

| What | When | Impact |
|------|------|--------|
| SPFx 1.23 | March 2026 | Open-sourced templates, new CLI replacing Yeoman generator |
| SPFx 1.24 | May 2026 | Navigation customizers |
| React 18 in SPFx | No timeline announced | Would unlock Fluent UI v9 fully. Do not wait for this. |
| @microsoft/msgraph-sdk GA | No timeline announced | Would replace @microsoft/microsoft-graph-client. Monitor. |
| Node.js 20 EOL | April 2026 | Use Node.js 22 from the start |

---

## Sources

- [SPFx 1.22 release notes](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.22) — Version details, Heft toolchain change (HIGH confidence)
- [SPFx compatibility matrix](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility) — React 17.0.1, Node.js 22, TypeScript 5.8 requirements (HIGH confidence)
- [SPFx roadmap January 2026](https://devblogs.microsoft.com/microsoft365dev/sharepoint-framework-spfx-roadmap-update-january-2026/) — SPFx 1.23 and 1.24 planned features (HIGH confidence)
- [Azure Functions runtime versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions) — Runtime 4.x, Node.js 20/22 support (HIGH confidence)
- [Azure Functions Flex Consumption plan](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan) — Plan features and pricing (HIGH confidence)
- [Azure SQL serverless tier](https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-overview) — Auto-pause, pricing model (HIGH confidence)
- [SharePoint 5,000 item threshold](https://learn.microsoft.com/en-us/troubleshoot/sharepoint/lists-and-libraries/items-exceeds-list-view-threshold) — Hard limit documentation (HIGH confidence)
- [Graph API calendar overview](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview) — Resource calendar capabilities (HIGH confidence)
- [Graph API room resource type](https://learn.microsoft.com/en-us/graph/api/resources/room?view=graph-rest-1.0) — Equipment mailbox documentation (HIGH confidence)
- [Securing Azure Functions for SPFx](https://www.voitanos.io/blog/securing-an-azure-function-app-with-azure-ad-works-with-with-sharepoint-framework/) — AadHttpClient + OBO flow pattern (MEDIUM confidence — third party, but Andrew Connell is authoritative in SPFx community)
- [Fluent UI v9 SPFx issues](https://github.com/SharePoint/sp-dev-docs/issues/10396) — Known compatibility problems (MEDIUM confidence)
- [@azure/functions 4.11.2 on npm](https://www.npmjs.com/package/@azure/functions) — Latest version verified (HIGH confidence)
- [@pnp/sp 4.17.0 on npm](https://www.npmjs.com/package/@pnp/sp) — Latest version verified (HIGH confidence)
- [@pnp/spfx-controls-react 3.23.0 on npm](https://www.npmjs.com/package/@pnp/spfx-controls-react) — Latest version verified (HIGH confidence)
- [Power Apps vs SPFx comparison](https://softreetechnology.com/blog/powerapps/power-apps-vs-spfx-choosing-the-right-framework-for-your-microsoft-365-solution/) — Framework comparison (MEDIUM confidence)
- [Azure SQL vs Cosmos DB](https://www.daymarksi.com/cole-tramps-microsoft-insights/azure-cosmos-db-vs-azure-sql-database-understanding-the-right-fit-for-modern-cloud-architectures) — Database comparison (MEDIUM confidence)

---
*Stack research for: RentAVehicle — Internal Fleet Rental System on M365/Azure*
*Researched: 2026-02-22*
