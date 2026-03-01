---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - api/src/middleware/auth.ts
  - spfx/tools/generate-env.js
  - spfx/src/config/env.generated.ts
  - spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts
autonomous: true
requirements: [QUICK-5]
must_haves:
  truths:
    - "API always returns dev.config.json identity in local dev, never the real tenant user from Graph"
    - "SPFx workbench shows dev.config.json name/email in the UI, not the real SharePoint user"
    - "Changing dev.config.json values and restarting updates both API and SPFx identity"
  artifacts:
    - path: "api/src/middleware/auth.ts"
      provides: "getLocalDevUser() without Graph lookup"
      contains: "LOCAL_DEV_NAME"
    - path: "spfx/tools/generate-env.js"
      provides: "Dev user config generation for SPFx"
      contains: "DEV_USER_NAME"
    - path: "spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts"
      provides: "Test user override in local workbench"
      contains: "ENV.DEV_USER_NAME"
  key_links:
    - from: "dev.config.json"
      to: "api/local.settings.json"
      via: "scripts/sync-dev-config.js"
      pattern: "LOCAL_DEV_NAME.*LOCAL_DEV_EMAIL"
    - from: "dev.config.json"
      to: "spfx/src/config/env.generated.ts"
      via: "spfx/tools/generate-env.js"
      pattern: "DEV_USER_NAME.*DEV_USER_EMAIL"
    - from: "spfx/src/config/env.generated.ts"
      to: "RentaVehicleWebPart.ts"
      via: "ENV import"
      pattern: "ENV\\.DEV_USER_NAME"
---

<objective>
Make local development always use the test user identity from dev.config.json on both the API and SPFx sides, instead of resolving the real tenant user via Graph or SharePoint context.

Purpose: During local dev, the developer wants to test as a configurable persona (e.g., "Test User" / "test@contoso.com" / Employee role) rather than their real tenant identity. This enables testing different roles and personas without needing different tenant accounts.

Output: Modified auth middleware (API) and webpart entry point (SPFx) that always use dev.config.json values locally.
</objective>

<execution_context>
@/Users/dancomilosevici/.claude/get-shit-done/workflows/execute-plan.md
@/Users/dancomilosevici/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@api/src/middleware/auth.ts
@spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts
@spfx/src/webparts/rentaVehicle/contexts/AuthContext.tsx
@spfx/tools/generate-env.js
@scripts/sync-dev-config.js
@dev.config.json
@api/local.settings.template.json

<interfaces>
<!-- Current config pipeline: dev.config.json -> sync-dev-config.js -> api/local.settings.json -->
<!-- dev.config.json fields: { role, name, email, officeLocation } -->
<!-- Maps to env vars: LOCAL_DEV_ROLE, LOCAL_DEV_NAME, LOCAL_DEV_EMAIL, LOCAL_DEV_OFFICE_LOCATION -->

From spfx/src/config/env.generated.ts (currently):
```typescript
export const ENV = {
  AZURE_CLIENT_ID: '...',
  AZURE_TENANT_ID: '...',
  APP_BASE_URL: '',
} as const;
```

From spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts (lines 33-34):
```typescript
userDisplayName: this.context.pageContext.user.displayName,
userEmail: this.context.pageContext.user.email,
```

From api/src/middleware/auth.ts getLocalDevUser() (lines 128-175):
```typescript
export async function getLocalDevUser(): Promise<UserContext | null> {
  // Currently tries Graph lookup when AZURE_CLIENT_SECRET is set (lines 138-160)
  // Falls back to LOCAL_DEV_* env vars only if Graph fails
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: API — skip Graph lookup in getLocalDevUser(), always use env vars</name>
  <files>api/src/middleware/auth.ts</files>
  <action>
Modify `getLocalDevUser()` to remove the Graph lookup entirely. The function should always return a UserContext built from LOCAL_DEV_* environment variables, never call Graph.

Specifically:
1. Remove the `cachedLocalDevUser` and `localDevUserFetched` module-level variables (lines 111-112)
2. Remove the entire Graph lookup block (lines 137-160) and the cached user return block (lines 162-165)
3. Remove the `getGraphClient` import since it's no longer used in this file (line 4 — but only if no other function in this file uses it; check first)
4. The function should simply build and return a UserContext from env vars every time:
   ```typescript
   export async function getLocalDevUser(): Promise<UserContext | null> {
     if (process.env.LOCAL_DEV !== 'true') {
       return null;
     }

     const role = (process.env.LOCAL_DEV_ROLE || 'Employee') as AppRole;
     const validRoles: AppRole[] = ['SuperAdmin', 'Admin', 'Manager', 'Employee'];
     const effectiveRole = validRoles.includes(role) ? role : 'Employee';

     return {
       userId: 'local-dev-user-id',
       displayName: process.env.LOCAL_DEV_NAME || 'Local Dev User',
       email: process.env.LOCAL_DEV_EMAIL || 'dev@localhost',
       roles: [effectiveRole],
       effectiveRole,
       officeLocation: process.env.LOCAL_DEV_OFFICE_LOCATION || null,
     };
   }
   ```
5. Keep the function async (getUserFromRequest calls it with await)
6. Update the JSDoc to remove references to Graph lookup. New doc should say: "Returns a UserContext for local development from LOCAL_DEV_* environment variables. Only active when LOCAL_DEV=true."
7. Log the dev user on first call for visibility: `console.log('  Local dev user: ${displayName} (${email}) [${effectiveRole}]')`
  </action>
  <verify>
    <automated>cd /Users/dancomilosevici/DevLeet/Microsoft-365-Solutions/rentAvehicle-sp-webpart/api && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>getLocalDevUser() returns env-var-based UserContext directly, no Graph import or lookup, TypeScript compiles cleanly</done>
</task>

<task type="auto">
  <name>Task 2: SPFx — generate dev user config and override identity in workbench</name>
  <files>spfx/tools/generate-env.js, spfx/src/config/env.generated.ts, spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts</files>
  <action>
Two sub-steps:

**A) Extend generate-env.js to include dev user fields from dev.config.json**

1. In `spfx/tools/generate-env.js`, after reading secrets.json, also read `dev.config.json` from the project root (path: `path.resolve(__dirname, '../../dev.config.json')`)
2. Add DEV_USER_NAME and DEV_USER_EMAIL to the generated ENV object, sourced from dev.config.json's `name` and `email` fields
3. If dev.config.json doesn't exist or fields are missing, use empty strings as defaults (same pattern as APP_BASE_URL)
4. The updated output template should be:
   ```javascript
   const output = `// AUTO-GENERATED — do not edit. Source: .rentavehicle/secrets.json + dev.config.json
   export const ENV = {
     AZURE_CLIENT_ID: '${secrets.AZURE_CLIENT_ID}',
     AZURE_TENANT_ID: '${secrets.AZURE_TENANT_ID || ''}',
     APP_BASE_URL: '${secrets.APP_BASE_URL || ''}',
     DEV_USER_NAME: '${devUserName}',
     DEV_USER_EMAIL: '${devUserEmail}',
   } as const;
   `;
   ```
5. After writing, regenerate `env.generated.ts` by running: `node spfx/tools/generate-env.js`

**B) Override user identity in RentaVehicleWebPart.ts when in local dev mode**

1. In `RentaVehicleWebPart.ts`, in the `render()` method, when `this._apiClient` is null (local workbench mode), use `ENV.DEV_USER_NAME` and `ENV.DEV_USER_EMAIL` instead of `this.context.pageContext.user.displayName/email`
2. The ENV import already exists on line 11. Add the override logic:
   ```typescript
   // In local workbench (no API client), use dev.config.json identity
   const isLocalDev = this._apiClient === null;
   const userDisplayName = isLocalDev && ENV.DEV_USER_NAME
     ? ENV.DEV_USER_NAME
     : this.context.pageContext.user.displayName;
   const userEmail = isLocalDev && ENV.DEV_USER_EMAIL
     ? ENV.DEV_USER_EMAIL
     : this.context.pageContext.user.email;
   ```
3. Then pass `userDisplayName` and `userEmail` variables to AppShell instead of the direct `this.context.pageContext.user.*` references
  </action>
  <verify>
    <automated>cd /Users/dancomilosevici/DevLeet/Microsoft-365-Solutions/rentAvehicle-sp-webpart && node spfx/tools/generate-env.js && grep -q "DEV_USER_NAME" spfx/src/config/env.generated.ts && echo "PASS: env.generated.ts contains DEV_USER_NAME" || echo "FAIL"</automated>
  </verify>
  <done>generate-env.js reads dev.config.json and outputs DEV_USER_NAME/DEV_USER_EMAIL into env.generated.ts. RentaVehicleWebPart.ts uses ENV.DEV_USER_* when apiClient is null, falling back to pageContext.user when in production. Both TypeScript files compile without errors.</done>
</task>

</tasks>

<verification>
1. API: `cd api && npx tsc --noEmit` compiles cleanly
2. SPFx: `node spfx/tools/generate-env.js` generates env.generated.ts with DEV_USER_NAME and DEV_USER_EMAIL
3. SPFx: `grep "DEV_USER_NAME\|DEV_USER_EMAIL" spfx/src/config/env.generated.ts` shows both fields with dev.config.json values
4. API auth.ts: `grep -c "getGraphClient" api/src/middleware/auth.ts` returns 0 (Graph import removed)
5. WebPart: `grep "ENV.DEV_USER_NAME" spfx/src/webparts/rentaVehicle/RentaVehicleWebPart.ts` confirms override logic
</verification>

<success_criteria>
- API getLocalDevUser() always returns LOCAL_DEV_* env var values, never calls Graph
- SPFx local workbench displays dev.config.json name/email in the Welcome screen and auth context
- Production path (apiClient available) is unaffected — still uses pageContext.user
- Both projects compile without TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/5-add-test-user-override-for-local-dev-on-/5-SUMMARY.md`
</output>
