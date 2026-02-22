# Phase 1: Foundation and Authentication - Research

**Researched:** 2026-02-23
**Domain:** SPFx webpart scaffolding, Entra ID SSO, app role RBAC, Azure Functions authentication, Teams integration, responsive mobile layout
**Confidence:** HIGH

## Summary

Phase 1 establishes the full authenticated application shell: SPFx webpart running in both SharePoint and Teams, authenticated via Entra ID SSO, with role-based access control (Employee/Manager/Admin) enforced at both UI and API layers. The technical domain is well-documented by Microsoft with official patterns for every integration point.

The authentication flow uses SPFx's built-in `AadHttpClient` to obtain bearer tokens for the Azure Functions API. The API uses App Service Authentication ("Easy Auth") to validate tokens and extract user identity including app role claims. Roles are defined as app roles in the Entra ID app registration and assigned to security groups via Enterprise Applications. The `roles` claim in the user's access token drives authorization at both the UI level (show/hide nav items) and API level (return 403 for unauthorized operations).

The most critical technical risk in this phase is the token audience mismatch between SPFx's `AadHttpClient` and the Azure Function's Easy Auth configuration. This must be validated end-to-end as the first integration milestone. The CORS + Easy Auth conflict on preflight requests is the second risk. Both are well-understood and have straightforward solutions documented below.

**Primary recommendation:** Scaffold SPFx with Heft toolchain, configure Entra ID app registration with app roles mapped to security groups, deploy Azure Functions with Easy Auth + CORS, and validate the full auth chain (SPFx-to-Functions-to-role-check) before building any UI beyond the app shell.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Sidebar navigation on the left, content area on the right
- Sidebar is always expanded (not collapsible)
- App logo and "RentAVehicle" name displayed in the sidebar header
- Initial view shows a welcome state with user's name, role badge, and loading transition into the webpart shell
- Admin-only nav items are hidden completely from non-admin users (not greyed out)
- Roles assigned via Entra ID security groups (e.g., RentAVehicle-Admins, RentAVehicle-Managers)
- If a user belongs to multiple groups, highest privilege wins (Admin > Manager > Employee)
- Users with no security group assignment default to Employee role
- SSO failure or consent needed: inline error message inside the webpart with a "Try again" button
- Configurable IT support contact: site admin can set a support email/link in webpart properties, shown in error messages
- Below 768px (tablet breakpoint): sidebar replaced with bottom tab bar
- Bottom tabs show top 3-4 items plus a "More" tab for the rest
- Role badge hidden on mobile -- accessible via profile/settings area
- Above 768px: standard sidebar layout

### Claude's Discretion
- Role badge placement in the sidebar (header vs footer)
- Token refresh strategy for expired sessions
- Loading skeleton and transition animation design
- Exact spacing, typography, and color scheme
- Error state design details beyond the inline + retry pattern

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User is authenticated via Microsoft Entra ID SSO -- no separate login | AadHttpClient handles token acquisition transparently using the signed-in user's M365 identity. No MSAL.js needed in SPFx. The SharePoint Online Client Extensibility principal manages the OAuth flow. |
| AUTH-02 | User role (Employee, Manager, Admin) determined from Entra ID App Roles | Define app roles in the API app registration, assign security groups to those roles in Enterprise Applications. Users' tokens contain a `roles` claim with their assigned role values. Default to Employee if no role assignment. |
| AUTH-03 | API endpoints enforce role-based access -- employees cannot access admin functions | Azure Functions Easy Auth validates tokens and provides `x-ms-client-principal` header. Function code decodes the header, extracts `roles` claims, and returns 403 for unauthorized role access. |
| PLAT-01 | SPFx webpart works in SharePoint pages | SPFx 1.22 webpart with `supportedHosts: ["SharePointWebPart"]` in manifest. Standard deployment to tenant app catalog. |
| PLAT-02 | SPFx webpart works as a Teams tab | Add `"TeamsTab"` and/or `"TeamsPersonalApp"` to `supportedHosts` in webpart manifest. SharePoint auto-generates Teams app manifest on deployment. Sync to Teams from SharePoint admin center. |
| PLAT-03 | UI is responsive for Teams mobile | CSS media queries at 768px breakpoint. Below 768px: bottom tab bar replaces sidebar. Fluent UI v8 Stack component for responsive layouts. Test on Teams mobile (iOS/Android). |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SPFx | 1.22.0 | Webpart framework | Only framework that embeds natively in SharePoint and Teams. Heft-based build toolchain as of 1.22. |
| React | 17.0.1 (exact) | UI rendering | Mandated by SPFx 1.22 compatibility matrix. Must use `--save-exact`. React 18 causes silent runtime failures. |
| TypeScript | 5.8 | Type-safe development | Default in SPFx 1.22 scaffolded projects. |
| Node.js | 22 LTS | Development runtime | Required by SPFx 1.22. Also used for Azure Functions. End-of-support April 2027. |
| @fluentui/react | 8.x | UI component library | Ships with SPFx. Matches SharePoint native look. v9 has known issues in SPFx context -- do not use as primary. |
| @microsoft/sp-http | Bundled | AadHttpClient for API calls | Built-in SPFx class for authenticated calls to Entra ID-secured APIs. Handles OAuth flow automatically. |
| @azure/functions | 4.11.2 | Azure Functions v4 programming model | Node.js TypeScript-native function definitions. HTTP triggers serve as REST API endpoints. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @pnp/spfx-controls-react | 3.23.0 | Pre-built SPFx React controls | PeoplePicker, ListView, and other SharePoint-native controls. Verify Heft compatibility with SPFx 1.22. |
| zod | 3.x | Runtime schema validation | Validate API request/response shapes in Azure Functions. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Easy Auth (App Service Auth) | Manual JWT validation with `jsonwebtoken` or `jose` | Easy Auth requires no code for token validation but limits control over error responses. Manual validation gives full control but requires maintaining JWKS endpoint fetching and token verification logic. Use Easy Auth for simplicity in Phase 1; consider manual validation if custom error handling is needed later. |
| AadHttpClient | MSAL.js directly in SPFx | MSAL.js is explicitly unsupported in SPFx since v1.4.1. AadHttpClient is the only supported approach. |
| CSS media queries for responsive | react-responsive library | CSS media queries are simpler and have zero bundle cost. Use react-responsive only if breakpoint logic needs to be in React component JSX. |

**Installation:**
```bash
# Global tools (one-time)
npm install -g @microsoft/generator-sharepoint@latest yo
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# SPFx project (after scaffolding)
npm install react@17.0.1 react-dom@17.0.1 --save-exact
npm install @pnp/spfx-controls-react@3.23.0
npm install zod

# Azure Functions project (separate folder)
npm install @azure/functions@4.11.2
npm install zod
npm install -D typescript @types/node
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)

```
rentavehicle/
├── spfx/                                  # SPFx solution (frontend)
│   ├── src/
│   │   └── webparts/
│   │       └── rentaVehicle/
│   │           ├── components/            # React components
│   │           │   ├── AppShell/          # Main layout: sidebar + content area
│   │           │   ├── Sidebar/           # Left nav (desktop) with logo, nav items, role badge
│   │           │   ├── BottomTabBar/      # Mobile nav (below 768px)
│   │           │   ├── WelcomeScreen/     # Initial welcome state with name + role badge
│   │           │   ├── ErrorBoundary/     # SSO/auth error display with retry
│   │           │   └── RoleGuard/         # Role-based component visibility
│   │           ├── services/              # API client wrappers
│   │           │   └── ApiService.ts      # AadHttpClient calls to Azure Functions
│   │           ├── contexts/              # React contexts
│   │           │   └── AuthContext.tsx     # User identity + role context provider
│   │           ├── models/                # TypeScript interfaces
│   │           │   ├── IUser.ts           # User identity with role
│   │           │   └── IApiResponse.ts    # Standard API response shape
│   │           ├── hooks/                 # Custom React hooks
│   │           │   └── useResponsive.ts   # Window width detection for breakpoint
│   │           ├── styles/                # Global styles + variables
│   │           │   └── variables.module.scss
│   │           └── RentaVehicleWebPart.ts # Webpart entry point
│   ├── config/
│   │   └── package-solution.json          # webApiPermissionRequests
│   └── sharepoint/
│       └── solution/                      # .sppkg output
│
├── api/                                   # Azure Functions (backend)
│   ├── src/
│   │   ├── functions/                     # Function definitions
│   │   │   ├── health.ts                  # GET /api/health -- auth test endpoint
│   │   │   └── me.ts                      # GET /api/me -- returns user identity + role
│   │   ├── middleware/                     # Shared middleware
│   │   │   └── auth.ts                    # Extract x-ms-client-principal, parse roles
│   │   ├── models/                        # Shared types
│   │   │   └── UserContext.ts             # Parsed user identity with role
│   │   └── index.ts                       # App entry point (registers hooks)
│   ├── host.json
│   ├── package.json
│   └── tsconfig.json
│
└── .planning/                             # Project planning docs
```

### Pattern 1: AadHttpClient Token Acquisition

**What:** SPFx uses the built-in `AadHttpClient` to silently obtain bearer tokens for the Azure Functions API. The token is issued by the SharePoint Online Client Extensibility service principal. The SPFx solution declares required permissions in `package-solution.json` under `webApiPermissionRequests`. A SharePoint admin approves these once.

**When to use:** Always, for all SPFx-to-Azure-Functions communication.

**Example:**
```typescript
// Source: https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient
// In RentaVehicleWebPart.ts onInit():
import { AadHttpClient, HttpClientResponse } from '@microsoft/sp-http';

private apiClient: AadHttpClient;

protected async onInit(): Promise<void> {
  await super.onInit();
  this.apiClient = await this.context.aadHttpClientFactory
    .getClient('api://<azure-functions-app-client-id>');
}

// Pass apiClient to React components via props or context
```

```typescript
// In ApiService.ts:
export class ApiService {
  constructor(private client: AadHttpClient) {}

  async getMe(): Promise<IUserProfile> {
    const response = await this.client.get(
      'https://<functionapp>.azurewebsites.net/api/me',
      AadHttpClient.configurations.v1
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }
}
```

```json
// config/package-solution.json
{
  "solution": {
    "name": "renta-vehicle-client-side-solution",
    "id": "<solution-guid>",
    "version": "1.0.0.0",
    "includeClientSideAssets": true,
    "skipFeatureDeployment": true,
    "isDomainIsolated": false,
    "webApiPermissionRequests": [
      {
        "resource": "RentAVehicle-API",
        "scope": "user_impersonation"
      }
    ]
  }
}
```

### Pattern 2: Entra ID App Roles with Security Group Assignment

**What:** Define custom app roles (Employee, Manager, Admin) in the API app registration. Assign Entra ID security groups to these roles via Enterprise Applications. When users authenticate, their token's `roles` claim contains the app role values corresponding to their group memberships. The function code extracts the `roles` claim and enforces authorization.

**When to use:** For all RBAC decisions in this application.

**Mechanism (verified against official docs):**
1. Define app roles in the app registration manifest (Employee, Manager, Admin)
2. Create security groups in Entra ID (RentAVehicle-Employees, RentAVehicle-Managers, RentAVehicle-Admins)
3. In Enterprise Applications, assign each security group to its corresponding app role
4. When a user in the group authenticates, the `roles` claim contains their assigned role value(s)
5. If user is in multiple groups, the `roles` claim contains all assigned roles -- app logic picks highest privilege

**Important clarification:** The user's CONTEXT.md says "Roles assigned via Entra ID security groups." The correct implementation is to define **app roles** in the app registration and then **assign security groups to those app roles**. This gives us the `roles` claim in the token (cleaner than the `groups` claim which uses GUIDs). The security groups are the organizational assignment mechanism; app roles are the authorization mechanism.

**App registration manifest:**
```json
{
  "appRoles": [
    {
      "allowedMemberTypes": ["User"],
      "description": "Full administrative access to RentAVehicle",
      "displayName": "Admin",
      "id": "<unique-guid-1>",
      "isEnabled": true,
      "value": "Admin"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Manager access -- view team bookings",
      "displayName": "Manager",
      "id": "<unique-guid-2>",
      "isEnabled": true,
      "value": "Manager"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Standard employee access -- browse and book vehicles",
      "displayName": "Employee",
      "id": "<unique-guid-3>",
      "isEnabled": true,
      "value": "Employee"
    }
  ]
}
```

**Token example (after group-to-role assignment):**
```json
{
  "aud": "api://rentavehicle-api",
  "iss": "https://login.microsoftonline.com/<tenant-id>/v2.0",
  "name": "Kyle Marsh",
  "oid": "<user-object-id>",
  "roles": ["Manager"],
  "sub": "<subject>",
  "tid": "<tenant-id>"
}
```

**Confidence: HIGH** -- Verified against [Configure group claims and app roles in tokens](https://learn.microsoft.com/en-us/security/zero-trust/develop/configure-tokens-group-claims-app-roles) (updated February 2026) and [Add app roles and get them from a token](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps).

### Pattern 3: Easy Auth + x-ms-client-principal for Role Extraction

**What:** Azure Functions App Service Authentication (Easy Auth) validates the bearer token from SPFx before function code executes. Easy Auth injects the user's identity and claims into the `x-ms-client-principal` HTTP header as a Base64-encoded JSON object. The function code decodes this header to extract user identity and role claims.

**When to use:** For all API endpoints that need to know who the caller is and what roles they have.

**x-ms-client-principal decoded structure:**
```json
{
  "auth_typ": "aad",
  "claims": [
    { "typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name", "val": "user@contoso.com" },
    { "typ": "name", "val": "Kyle Marsh" },
    { "typ": "oid", "val": "<user-object-id>" },
    { "typ": "http://schemas.microsoft.com/ws/2008/06/identity/claims/role", "val": "Manager" },
    { "typ": "http://schemas.microsoft.com/ws/2008/06/identity/claims/role", "val": "Employee" }
  ],
  "name_typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  "role_typ": "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
}
```

**Node.js implementation:**
```typescript
// Source: https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities
// api/src/middleware/auth.ts

export interface UserContext {
  userId: string;       // oid claim
  displayName: string;  // name claim
  email: string;        // name_typ claim value
  roles: string[];      // all role_typ claim values
  effectiveRole: 'Admin' | 'Manager' | 'Employee';
}

interface ClientPrincipalClaim {
  typ: string;
  val: string;
}

interface ClientPrincipal {
  auth_typ: string;
  claims: ClientPrincipalClaim[];
  name_typ: string;
  role_typ: string;
}

export function parseClientPrincipal(headerValue: string): UserContext | null {
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
    const principal: ClientPrincipal = JSON.parse(decoded);

    const getClaim = (type: string): string =>
      principal.claims.find(c => c.typ === type)?.val ?? '';

    const getRoleClaims = (): string[] =>
      principal.claims
        .filter(c => c.typ === principal.role_typ)
        .map(c => c.val);

    const roles = getRoleClaims();

    // Highest privilege wins: Admin > Manager > Employee
    let effectiveRole: 'Admin' | 'Manager' | 'Employee' = 'Employee';
    if (roles.includes('Admin')) {
      effectiveRole = 'Admin';
    } else if (roles.includes('Manager')) {
      effectiveRole = 'Manager';
    }

    return {
      userId: getClaim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier') ||
              getClaim('oid'),
      displayName: getClaim('name'),
      email: getClaim(principal.name_typ),
      roles,
      effectiveRole,
    };
  } catch {
    return null;
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (user: UserContext | null): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.effectiveRole);
  };
}
```

**Confidence: HIGH** -- Verified against [Work with User Identities in AuthN/AuthZ](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities) (updated July 2025).

### Pattern 4: Azure Functions v4 HTTP Triggers with Auth Check

**What:** Azure Functions v4 programming model defines functions with `app.http()`. Each function extracts the user context from the `x-ms-client-principal` header and checks roles before proceeding.

**Example:**
```typescript
// Source: https://learn.microsoft.com/en-us/azure/azure-functions/functions-node-upgrade-v4
// api/src/functions/me.ts

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseClientPrincipal } from '../middleware/auth';

export async function me(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const principalHeader = request.headers.get('x-ms-client-principal');
  if (!principalHeader) {
    return { status: 401, jsonBody: { error: 'Not authenticated' } };
  }

  const user = parseClientPrincipal(principalHeader);
  if (!user) {
    return { status: 401, jsonBody: { error: 'Invalid identity' } };
  }

  return {
    jsonBody: {
      userId: user.userId,
      displayName: user.displayName,
      email: user.email,
      role: user.effectiveRole,
    },
  };
}

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous', // Easy Auth handles auth before function code runs
  route: 'me',
  handler: me,
});
```

```typescript
// api/src/functions/health.ts -- admin-only endpoint example

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseClientPrincipal, requireRole } from '../middleware/auth';

export async function adminHealth(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const principalHeader = request.headers.get('x-ms-client-principal');
  const user = parseClientPrincipal(principalHeader ?? '');

  if (!requireRole('Admin')(user)) {
    return { status: 403, jsonBody: { error: 'Forbidden: Admin role required' } };
  }

  return {
    jsonBody: { status: 'healthy', role: user!.effectiveRole, timestamp: new Date().toISOString() },
  };
}

app.http('adminHealth', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'admin/health',
  handler: adminHealth,
});
```

### Pattern 5: Detecting Teams vs SharePoint Host

**What:** SPFx webparts detect whether they are running in SharePoint or Teams using `this.context.sdks.microsoftTeams`. In SPFx 1.16+, the direct `context` property is deprecated; use `this.context.sdks.microsoftTeams.teamsJs.app.getContext()` for the v2 Teams SDK.

**Example:**
```typescript
// In RentaVehicleWebPart.ts
protected async onInit(): Promise<void> {
  await super.onInit();

  let hostEnvironment: 'SharePoint' | 'Teams' = 'SharePoint';

  if (this.context.sdks.microsoftTeams) {
    hostEnvironment = 'Teams';
    // Access Teams context for additional info:
    const teamsContext = await this.context.sdks.microsoftTeams.teamsJs.app.getContext();
    // teamsContext.app.host.name provides the specific host (Teams, Office, Outlook)
  }

  // Pass hostEnvironment to React components
}
```

**SPFx webpart manifest for Teams support:**
```json
{
  "id": "<webpart-guid>",
  "alias": "RentaVehicleWebPart",
  "componentType": "WebPart",
  "version": "1.0.0",
  "manifestVersion": 2,
  "supportedHosts": ["SharePointWebPart", "TeamsTab", "TeamsPersonalApp"],
  "preconfiguredEntries": [{
    "title": { "default": "RentAVehicle" },
    "description": { "default": "Internal vehicle rental system" },
    "groupId": "cf066440-35c3-4b21-b040-1e33a8fc7f0d",
    "group": { "default": "Business Applications" },
    "properties": {}
  }]
}
```

**Confidence: HIGH** -- Verified against [Building Microsoft Teams Tabs using SharePoint Framework](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/integrate-with-teams-introduction) and [SPFx 1.16 release notes (deprecation of old context API)](https://github.com/SharePoint/sp-dev-docs/blob/main/docs/spfx/release-1.16.md).

### Pattern 6: Responsive Layout with 768px Breakpoint

**What:** Below 768px viewport width, the sidebar navigation is replaced with a bottom tab bar. This is implemented with CSS media queries and a React hook that tracks viewport width.

**Example:**
```typescript
// hooks/useResponsive.ts
import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useResponsive() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile };
}
```

```tsx
// components/AppShell/AppShell.tsx
import { useResponsive } from '../../hooks/useResponsive';
import { Sidebar } from '../Sidebar/Sidebar';
import { BottomTabBar } from '../BottomTabBar/BottomTabBar';

export const AppShell: React.FC<IAppShellProps> = ({ user, children }) => {
  const { isMobile } = useResponsive();

  return (
    <div className={styles.appShell}>
      {!isMobile && <Sidebar user={user} />}
      <div className={styles.contentArea}>
        {children}
      </div>
      {isMobile && <BottomTabBar />}
    </div>
  );
};
```

```scss
// styles/AppShell.module.scss
.appShell {
  display: flex;
  height: 100%;
  width: 100%;
}

.contentArea {
  flex: 1;
  overflow-y: auto;
}

@media (max-width: 767px) {
  .appShell {
    flex-direction: column;
  }
  .contentArea {
    padding-bottom: 56px; // Space for bottom tab bar
  }
}
```

### Pattern 7: Webpart Property Pane for Configurable Settings

**What:** The SPFx webpart property pane allows site admins to configure the IT support contact email/link shown in error messages. Property pane works in SharePoint pages. In Teams channel tabs, configuration is available during tab setup. In Teams personal apps, property pane is NOT available -- configuration must be handled in the webpart UI itself.

**Example:**
```typescript
// RentaVehicleWebPart.ts
import { IPropertyPaneConfiguration, PropertyPaneTextField } from '@microsoft/sp-property-pane';

export interface IRentaVehicleWebPartProps {
  supportContact: string; // Email or URL for IT support
}

protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
  return {
    pages: [{
      header: { description: 'RentAVehicle Configuration' },
      groups: [{
        groupName: 'Support',
        groupFields: [
          PropertyPaneTextField('supportContact', {
            label: 'IT Support Contact',
            description: 'Email address or URL shown in error messages',
            placeholder: 'itsupport@contoso.com',
          }),
        ],
      }],
    }],
  };
}
```

### Anti-Patterns to Avoid

- **Using MSAL.js directly in SPFx:** Explicitly unsupported since SPFx v1.4.1. Use `AadHttpClient` from `@microsoft/sp-http`. MSAL usage will break on future SPFx updates.
- **Trusting client-side role checks as security:** Hiding admin nav items in the UI is a UX concern, not a security mechanism. All role enforcement must happen in Azure Functions. A user with browser dev tools can bypass any client-side check.
- **Using `fetch()` instead of `AadHttpClient`:** Raw fetch cannot obtain Entra ID tokens in SPFx. Using fetch bypasses the entire authentication framework.
- **Handling CORS in function code when using Easy Auth:** Easy Auth + Azure portal CORS configuration must be used together. Function-level CORS code conflicts with App Service CORS settings. Let the platform handle CORS.
- **Setting Easy Auth to redirect unauthenticated requests:** Preflight OPTIONS requests from the browser have no auth header (by CORS spec). If Easy Auth is set to redirect, preflight requests get a 302 redirect to login.microsoftonline.com, which the browser cannot follow in a CORS context. Set to "Allow (return 401)."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token acquisition in SPFx | Custom MSAL.js or fetch-based auth flow | `AadHttpClient` from `@microsoft/sp-http` | SPFx manages token cache, refresh, and consent. Custom auth is unsupported and fragile. |
| JWT token validation in Azure Functions | Custom `jsonwebtoken` or `jose` validation | Easy Auth (App Service Authentication) | Easy Auth validates tokens before your code runs. Zero code for token verification. Handles JWKS rotation automatically. |
| Role extraction from tokens | Custom JWT decoding and claim parsing | `x-ms-client-principal` header from Easy Auth | Easy Auth decodes the token and provides structured claims. Just Base64-decode the header. |
| Responsive breakpoint detection | Custom window resize listener with debounce | `useResponsive` hook or CSS media queries | Standard pattern. Alternatively, Fluent UI v8's `useResponsiveMode` hook provides breakpoint detection. |
| Teams host detection | Checking user agent strings or URL parameters | `this.context.sdks.microsoftTeams` | SPFx provides official API for host detection. User agent sniffing is unreliable. |

**Key insight:** The SPFx + Easy Auth combination handles 90% of the authentication complexity. The developer's job is to (1) configure the Entra ID app registration correctly, (2) declare permissions in `package-solution.json`, (3) configure Easy Auth and CORS on the Function App, and (4) extract roles from the `x-ms-client-principal` header. No custom OAuth flows, no JWKS endpoints, no token caching code.

## Common Pitfalls

### Pitfall 1: Token Audience Mismatch (SPFx to Azure Functions)

**What goes wrong:** SPFx webpart calls Azure Function and gets HTTP 401. The token's `aud` (audience) claim does not match what the Function App's Easy Auth expects.

**Why it happens:** SPFx's `AadHttpClient.getClient()` takes either the Application ID URI (`api://rentavehicle-api`) or the client ID GUID. The value passed to `getClient()` becomes the audience in the token. The Function App's Easy Auth "Allowed token audiences" must include this exact value. Misconfiguration of either side causes rejection.

**How to avoid:**
1. Pass the Application ID URI (e.g., `api://<client-id>`) to `AadHttpClient.getClient()`
2. In the Azure portal, configure the Function App's Authentication > Allowed token audiences to include both `api://<client-id>` and the bare `<client-id>` GUID
3. Decode an actual token from SPFx using [jwt.io](https://jwt.io) and verify the `aud` value matches
4. Test this flow as the FIRST integration milestone

**Warning signs:** 401 from Azure Functions that disappears when Easy Auth is disabled. Token works in Postman but fails from SPFx.

**Recovery cost:** LOW -- Azure portal configuration change, no code change needed.

### Pitfall 2: CORS + Easy Auth Preflight Conflict

**What goes wrong:** SPFx webpart makes API call. Browser sends CORS preflight OPTIONS request. Easy Auth intercepts it (no auth header on preflight by spec) and returns 401 or 302 redirect. The actual API call never executes.

**Why it happens:** App Service Authentication runs as middleware before the Functions runtime. It processes every request, including CORS preflight, before function code or CORS configuration can respond.

**How to avoid:**
1. In the Function App's Authentication settings, set "Unauthenticated requests" to **"Allow"** (returns 401 on actual requests, passes preflight through)
2. Configure CORS in the Azure portal: Function App > CORS > add `https://<tenant>.sharepoint.com`
3. Do NOT handle CORS in function code -- it conflicts with App Service CORS
4. Test from a deployed SharePoint page, not localhost

**Warning signs:** CORS errors in browser console on OPTIONS requests. API works from Postman (no preflight) but fails from browser. 302 redirects to `login.microsoftonline.com` on OPTIONS requests.

**Recovery cost:** LOW -- Azure portal configuration change, immediate effect.

### Pitfall 3: App Roles Not Appearing in Token

**What goes wrong:** User authenticates but the `roles` claim is empty or missing from the token. The application defaults everyone to Employee.

**Why it happens:** Multiple possible causes:
1. App roles defined in the app registration but security groups not assigned to them in Enterprise Applications
2. The "User assignment required" toggle on the Enterprise App is set to "No" -- in this case, users can access the app but may not get role claims
3. The app role's `allowedMemberTypes` is set to `Application` instead of `User` (or both)
4. Entra ID P1 license is required for group-based app role assignment

**How to avoid:**
1. After defining app roles, go to Enterprise Applications (not App registrations) and assign security groups to roles
2. Set `allowedMemberTypes` to `["User"]` for user-facing roles
3. Verify with a test user: decode their token and check the `roles` claim
4. If using a free Entra ID tier, assign users directly to app roles (group assignment requires P1)

**Warning signs:** Token has no `roles` claim. All users appear as Employee regardless of group membership.

### Pitfall 4: Tenant-Wide SPFx API Permissions

**What goes wrong:** Permissions granted via `webApiPermissionRequests` apply to the entire tenant's SharePoint Online Client Extensibility principal, not just this webpart. Other SPFx solutions in the tenant can potentially request the same permissions.

**Why it happens:** The SharePoint Online Client Extensibility principal is a single service principal shared by all SPFx solutions in the tenant. Permission grants are tenant-wide.

**How to avoid:**
1. Request only the minimum scope needed: `user_impersonation` on the RentAVehicle-API app registration
2. Do NOT request broad Graph API permissions through SPFx -- route those through Azure Functions' own app registration with application permissions
3. Document which SPFx permissions exist in the tenant and why
4. Audit the SharePoint Online Client Extensibility principal's permissions

**Warning signs:** Multiple SPFx solutions requesting overlapping scopes. Security team flagging broad Graph permissions.

### Pitfall 5: Teams Personal App Has No Property Pane

**What goes wrong:** The webpart is deployed as a Teams personal app. Site admins expect to configure settings (like IT support contact) via the property pane, but it does not appear. Configuration is lost or defaults are used.

**Why it happens:** SPFx personal apps in Teams do NOT have property pane infrastructure. The property pane is only available in SharePoint pages and Teams channel tab setup flows.

**How to avoid:**
1. For Phase 1, deploy as Teams channel tab (supports property pane via Teams configuration page)
2. If personal app is needed, build configuration UI inline within the webpart itself
3. Consider storing configuration centrally (SharePoint list, tenant app catalog properties) rather than per-instance property pane
4. Detect host environment and adapt configuration approach accordingly

**Warning signs:** Users report "no settings" option in Teams. Config values are always defaults in personal app context.

## Code Examples

### Complete Webpart Entry Point with Auth Context

```typescript
// Source: Composite from official SPFx docs
// src/webparts/rentaVehicle/RentaVehicleWebPart.ts

import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { IPropertyPaneConfiguration, PropertyPaneTextField } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { AadHttpClient } from '@microsoft/sp-http';

import { AppShell } from './components/AppShell/AppShell';
import { IAppShellProps } from './components/AppShell/IAppShellProps';

export interface IRentaVehicleWebPartProps {
  supportContact: string;
}

export default class RentaVehicleWebPart extends BaseClientSideWebPart<IRentaVehicleWebPartProps> {
  private apiClient: AadHttpClient;
  private isTeams: boolean = false;

  protected async onInit(): Promise<void> {
    await super.onInit();

    // Detect host environment
    this.isTeams = !!this.context.sdks.microsoftTeams;

    // Initialize AadHttpClient for API calls
    try {
      this.apiClient = await this.context.aadHttpClientFactory
        .getClient('api://<azure-functions-app-client-id>');
    } catch (error) {
      console.error('Failed to initialize API client:', error);
      // Will render error state
    }
  }

  public render(): void {
    const element: React.ReactElement<IAppShellProps> = React.createElement(
      AppShell,
      {
        apiClient: this.apiClient,
        isTeams: this.isTeams,
        supportContact: this.properties.supportContact || '',
        userDisplayName: this.context.pageContext.user.displayName,
        userEmail: this.context.pageContext.user.email,
      }
    );
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [{
        header: { description: 'RentAVehicle Settings' },
        groups: [{
          groupName: 'Support',
          groupFields: [
            PropertyPaneTextField('supportContact', {
              label: 'IT Support Contact',
              description: 'Email or URL for IT support (shown in error messages)',
              placeholder: 'itsupport@contoso.com',
            }),
          ],
        }],
      }],
    };
  }
}
```

### Role-Based Navigation Filtering

```typescript
// src/webparts/rentaVehicle/components/Sidebar/navItems.ts

export interface INavItem {
  key: string;
  label: string;
  icon: string;
  minRole: 'Employee' | 'Manager' | 'Admin';
}

const ROLE_HIERARCHY: Record<string, number> = {
  Employee: 0,
  Manager: 1,
  Admin: 2,
};

export const NAV_ITEMS: INavItem[] = [
  { key: 'home',        label: 'Home',            icon: 'Home',            minRole: 'Employee' },
  { key: 'browse',      label: 'Browse Vehicles',  icon: 'Car',             minRole: 'Employee' },
  { key: 'myBookings',  label: 'My Bookings',      icon: 'Calendar',        minRole: 'Employee' },
  { key: 'teamBookings',label: 'Team Bookings',    icon: 'People',          minRole: 'Manager' },
  { key: 'vehicles',    label: 'Manage Vehicles',  icon: 'Settings',        minRole: 'Admin' },
  { key: 'allBookings', label: 'All Bookings',     icon: 'BulletedList',    minRole: 'Admin' },
  { key: 'reports',     label: 'Reports',          icon: 'BarChartVertical',minRole: 'Admin' },
];

export function getVisibleNavItems(userRole: string): INavItem[] {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  return NAV_ITEMS.filter(item => userLevel >= ROLE_HIERARCHY[item.minRole]);
}
```

### Bottom Tab Bar for Mobile

```tsx
// src/webparts/rentaVehicle/components/BottomTabBar/BottomTabBar.tsx

import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './BottomTabBar.module.scss';
import { INavItem, getVisibleNavItems } from '../Sidebar/navItems';

interface IBottomTabBarProps {
  userRole: string;
  activeKey: string;
  onNavigate: (key: string) => void;
}

const MAX_VISIBLE_TABS = 4;

export const BottomTabBar: React.FC<IBottomTabBarProps> = ({ userRole, activeKey, onNavigate }) => {
  const allItems = getVisibleNavItems(userRole);
  const visibleItems = allItems.slice(0, MAX_VISIBLE_TABS - 1);
  const hasMore = allItems.length > MAX_VISIBLE_TABS - 1;

  return (
    <nav className={styles.bottomTabBar}>
      {visibleItems.map(item => (
        <button
          key={item.key}
          className={`${styles.tab} ${activeKey === item.key ? styles.active : ''}`}
          onClick={() => onNavigate(item.key)}
          aria-label={item.label}
        >
          <Icon iconName={item.icon} />
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
      {hasMore && (
        <button
          className={`${styles.tab} ${activeKey === 'more' ? styles.active : ''}`}
          onClick={() => onNavigate('more')}
          aria-label="More"
        >
          <Icon iconName="More" />
          <span className={styles.label}>More</span>
        </button>
      )}
    </nav>
  );
};
```

### Entra ID App Registration Configuration (Bicep)

```bicep
// infra/modules/appRegistration.bicep -- for reference; app registrations are
// typically created via Azure portal or CLI, not Bicep (limited Bicep support)

// Manual steps (Azure portal or CLI):
// 1. Create app registration: "RentAVehicle-API"
// 2. Set Application ID URI: api://<client-id>
// 3. Expose API: add scope "user_impersonation"
// 4. Add app roles: Employee, Manager, Admin (allowedMemberTypes: User)
// 5. Add authorized client application:
//    - SharePoint Online Client Extensibility: 08e18876-6177-487e-b8b5-cf950c1e598c
//    - Authorize for scope: user_impersonation
// 6. Create client secret (store in Key Vault for OBO flow in later phases)
```

```bash
# CLI alternative for app registration setup
az ad app create \
  --display-name "RentAVehicle-API" \
  --identifier-uris "api://rentavehicle-api" \
  --app-roles '[
    {"allowedMemberTypes":["User"],"displayName":"Admin","id":"<guid-1>","isEnabled":true,"value":"Admin","description":"Admin access"},
    {"allowedMemberTypes":["User"],"displayName":"Manager","id":"<guid-2>","isEnabled":true,"value":"Manager","description":"Manager access"},
    {"allowedMemberTypes":["User"],"displayName":"Employee","id":"<guid-3>","isEnabled":true,"value":"Employee","description":"Employee access"}
  ]'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gulp-based SPFx build | Heft-based build toolchain | SPFx 1.22 (Nov 2025) | All new projects use Heft. `gulp serve` becomes `heft start`. `--ship` becomes `--production`. |
| `this.context.sdks.microsoftTeams.context` | `this.context.sdks.microsoftTeams.teamsJs.app.getContext()` | SPFx 1.16 | Old property is deprecated. Use Teams JS SDK v2 async API. |
| MSAL.js in SPFx for auth | AadHttpClient (built-in) | SPFx 1.4.1 | Direct MSAL usage is unsupported. AadHttpClient handles all OAuth flows. |
| Yeoman generator with gulp templates | Yeoman generator with Heft templates | SPFx 1.22 | Generator automatically produces Heft-based projects. No manual migration needed for new projects. |
| SharePoint Online Client Extensibility (single principal) | Two principals: Client Extensibility + Web Client Extensibility | March 2025 | New principal for modern SPFx. Existing permissions remain on old principal. Audit both. |

**Deprecated/outdated:**
- `gulp serve`, `gulp bundle --ship`, `gulp package-solution --ship` -- replaced by Heft equivalents in SPFx 1.22
- `this.context.sdks.microsoftTeams.context` -- deprecated in SPFx 1.16, use async `teamsJs.app.getContext()` instead
- Direct MSAL.js usage in SPFx -- unsupported since v1.4.1

## Open Questions

1. **@pnp/spfx-controls-react 3.23.0 compatibility with SPFx 1.22 Heft build**
   - What we know: Version 3.23.0 claims SPFx 1.21.1+ support. SPFx 1.22 introduced Heft build which changes the build pipeline.
   - What's unclear: Whether 3.23.0 builds correctly with Heft or requires configuration changes.
   - Recommendation: Validate during SPFx scaffold step. If incompatible, use raw Fluent UI v8 controls until a compatible version ships.

2. **Entra ID P1 licensing for group-based app role assignment**
   - What we know: Assigning security groups to app roles requires at minimum Entra ID P1. Direct user-to-role assignment works on free tier.
   - What's unclear: Whether the target tenant has P1 licensing.
   - Recommendation: Start with group-based assignment (the user's preferred approach). If P1 is unavailable, fall back to direct user assignment and document the limitation.

3. **Easy Auth local development experience**
   - What we know: Easy Auth runs on the Azure platform only. Local Azure Functions development with `func start` does not have Easy Auth. The `x-ms-client-principal` header is not present locally.
   - What's unclear: Best approach for local development authentication simulation.
   - Recommendation: Create a local development middleware that injects a mock `x-ms-client-principal` header based on environment variables. Use a `.env.local` file with test user identity/role. Never deploy this middleware.

## Sources

### Primary (HIGH confidence)
- [Connect to Entra ID-secured APIs in SPFx (AadHttpClient)](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient) -- Microsoft Learn, updated October 2025
- [Work with User Identities in AuthN/AuthZ (x-ms-client-principal)](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities) -- Microsoft Learn, updated July 2025
- [Add app roles and get them from a token](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps) -- Microsoft Learn
- [Configure group claims and app roles in tokens](https://learn.microsoft.com/en-us/security/zero-trust/develop/configure-tokens-group-claims-app-roles) -- Microsoft Learn, updated February 2026
- [SPFx 1.22 release notes (Heft build toolchain)](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.22) -- Microsoft Learn
- [Azure Functions v4 Node.js programming model](https://learn.microsoft.com/en-us/azure/azure-functions/functions-node-upgrade-v4) -- Microsoft Learn
- [Expose SPFx web parts in Microsoft Teams](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/build-for-teams-expose-webparts-teams) -- Microsoft Learn
- [Building Microsoft Teams Tabs using SPFx](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/integrate-with-teams-introduction) -- Microsoft Learn
- [SPFx compatibility matrix](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility) -- React 17.0.1, Node.js 22, TypeScript 5.8
- [App Service Authentication overview](https://learn.microsoft.com/en-us/azure/app-service/overview-authentication-authorization) -- Microsoft Learn
- [Changes on SPFx permission grants in Entra ID](https://devblogs.microsoft.com/microsoft365dev/changes-on-sharepoint-framework-spfx-permission-grants-in-microsoft-entra-id/) -- March 2025, SharePoint Online Web Client Extensibility principal
- [Deployment options for SPFx solutions for Microsoft Teams](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/deployment-spfx-teams-solutions) -- Microsoft Learn

### Secondary (MEDIUM confidence)
- [Securing Azure Functions with Entra ID for SPFx (Voitanos)](https://www.voitanos.io/blog/securing-an-azure-function-app-with-azure-ad-works-with-with-sharepoint-framework/) -- Andrew Connell, authoritative SPFx practitioner
- [Consider avoiding declarative permissions (Voitanos)](https://www.voitanos.io/blog/consider-avoiding-declarative-permissions-with-azure-ad-services-in-sharepoint-framework-projects/) -- Tenant-wide permissions pitfall
- [Securing Azure Function with Entra ID and calling from SPFx (RLV Blog)](https://www.rlvision.com/blog/securing-an-azure-function-with-entra-id-and-calling-it-from-spfx/) -- Step-by-step walkthrough
- [Understanding Heft in SPFx 1.22](https://www.office365clinic.com/2025/12/15/understanding-heft-in-spfx-part1/) -- Community guide on new build toolchain
- [Building Responsive SPFx Web Parts with Fluent UI Stack](https://edvaldoguimaraes.com.br/2024/11/03/building-responsive-spfx-web-parts-with-fluent-uis-stack-component/) -- Responsive layout patterns

### Tertiary (LOW confidence)
- [azure-functions-auth npm package](https://www.npmjs.com/package/azure-functions-auth) -- Alternative to Easy Auth for Node.js Functions; small package, needs validation for production use
- [ms-identity-nodejs-webapi-azurefunctions GitHub sample](https://github.com/Azure-Samples/ms-identity-nodejs-webapi-azurefunctions) -- Microsoft sample, but uses Express and older patterns; verify relevance to v4 model

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All versions verified against official SPFx 1.22 release notes and compatibility matrix
- Architecture patterns: HIGH -- All patterns verified against official Microsoft Learn docs (AadHttpClient, Easy Auth, app roles, Teams integration)
- Pitfalls: HIGH -- Token audience mismatch, CORS + Easy Auth, tenant-wide permissions all verified against official docs and confirmed Q&A threads
- Code examples: MEDIUM -- Composite patterns from multiple official sources, not from a single end-to-end sample. The `x-ms-client-principal` decoding for Node.js is adapted from the C# example in official docs.

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain, official Microsoft patterns)
