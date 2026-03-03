---
phase: quick
plan: 7
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Developer reading README knows how to start the API as any role using npm scripts"
    - "Developer understands that default npm start remains Employee role"
    - "Developer understands the SPFx frontend gets its role from the API /api/me endpoint"
  artifacts:
    - path: "README.md"
      provides: "Role-specific start script documentation"
      contains: "start:admin"
  key_links: []
---

<objective>
Document the role-specific npm start scripts (start:admin, start:superadmin, start:manager) in README.md so developers know how to quickly switch roles during local development.

Purpose: The scripts already exist in api/package.json but are not documented. Developers currently need to either read package.json or use the lower-level `node scripts/sync-dev-config.js --role X` command.

Output: Updated README.md with role-specific start script documentation.
</objective>

<execution_context>
@/Users/dancomilosevici/.claude/get-shit-done/workflows/execute-plan.md
@/Users/dancomilosevici/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@README.md
@api/package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Document role-specific start scripts in README.md</name>
  <files>README.md</files>
  <action>
Update two sections in README.md:

**Section "6. Start the API" (around line 203):**

After the existing `cd api` / `npm start` code block, add a subsection documenting role-specific scripts. Structure it as:

```
#### Role-specific start scripts

To start the API as a specific role without manually editing `dev.config.json`:

| Command | Role | Description |
|---------|------|-------------|
| `npm start` | Employee | Default role |
| `npm run start:admin` | Admin | Fleet and booking management |
| `npm run start:superadmin` | SuperAdmin | Full system administration |
| `npm run start:manager` | Manager | Team bookings visibility |

Each role script runs `sync-dev-config.js --role X` to update `dev.config.json` and regenerate `local.settings.json`, then starts the API. The role persists in `dev.config.json`, so subsequent `npm start` calls keep the last-set role.

> [!NOTE]
> The SPFx frontend does not need role-specific scripts. It calls the API's `/api/me` endpoint to resolve the current user's role at runtime.
```

**Section "Environment notes" (around line 232):**

Update the existing bullet point about switching roles:
- Current: "To switch roles quickly: `node scripts/sync-dev-config.js --role Admin` (also accepts `Manager`, `Employee`, `SuperAdmin`)"
- Replace with: "To switch roles: use `npm run start:admin`, `npm run start:superadmin`, or `npm run start:manager` from the `api` directory. Alternatively, run `node scripts/sync-dev-config.js --role Admin` directly (also accepts `Manager`, `Employee`, `SuperAdmin`)"

Do NOT modify any other sections. Do NOT change docs/app-registration.md (it covers Entra ID configuration, not local dev scripts).
  </action>
  <verify>
    <automated>grep -c "start:admin\|start:superadmin\|start:manager" README.md | grep -q "[3-9]" && echo "PASS: role scripts documented" || echo "FAIL: missing role script references"</automated>
  </verify>
  <done>README.md documents all three role-specific npm scripts (start:admin, start:superadmin, start:manager) in both the "Start the API" section and the "Environment notes" section. Developer can find how to switch roles by reading the Getting Started guide.</done>
</task>

</tasks>

<verification>
- README.md mentions `start:admin`, `start:superadmin`, and `start:manager`
- README.md explains that default `npm start` remains Employee
- README.md notes that SPFx frontend gets role from API /api/me endpoint
- No changes to docs/app-registration.md
</verification>

<success_criteria>
A developer reading the Getting Started section of README.md can find and use the role-specific start scripts without reading api/package.json directly.
</success_criteria>

<output>
After completion, create `.planning/quick/7-document-role-specific-start-scripts-in-/7-SUMMARY.md`
</output>
